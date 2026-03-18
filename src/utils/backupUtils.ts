import fs from 'fs';
import { pool } from '../db.js';

export async function createPostgresBackup(backupPath: string) {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  
  let sqlDump = '-- PostgreSQL database dump (Node.js generated)\n\n';
  
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    const dataRes = await pool.query(`SELECT * FROM ${tableName}`);
    
    if (dataRes.rows.length === 0) continue;
    
    const columns = Object.keys(dataRes.rows[0]);
    
    for (const dataRow of dataRes.rows) {
      const values = columns.map(col => {
        const val = dataRow[col];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number' || typeof val === 'boolean') return val.toString();
        if (val instanceof Date) return `'${val.toISOString()}'`;
        // Escape single quotes
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      
      sqlDump += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    sqlDump += '\n';
  }
  
  fs.writeFileSync(backupPath, sqlDump);
}

export async function restorePostgresBackup(backupPath: string) {
  const sql = fs.readFileSync(backupPath, 'utf8');
  
  if (sql.startsWith('PGDMP')) {
    throw new Error("Custom format dumps (.dump, .backup) are not supported. Please upload a plain text SQL dump.");
  }

  const lines = sql.split('\n');
  let inCopy = false;
  let tableName = '';
  let columns: string[] = [];
  
  // Truncate all tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  
  for (const row of tablesRes.rows) {
    try {
      await pool.query(`TRUNCATE TABLE ${row.table_name} RESTART IDENTITY CASCADE`);
    } catch (e) {
      console.warn(`Could not truncate ${row.table_name}:`, e);
    }
  }
  
  let currentBatch = '';
  let batchCount = 0;
  
  const executeBatch = async () => {
    if (currentBatch.trim()) {
      await pool.query(currentBatch);
      currentBatch = '';
      batchCount = 0;
    }
  };
  
  let inInsert = false;
  let insertStatement = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle COPY
    if (line.startsWith('COPY ')) {
      inCopy = true;
      const match = line.match(/COPY\s+(?:public\.)?([^\s(]+)(?:\s*\(([^)]+)\))?\s+FROM\s+stdin;/i);
      if (match) {
        tableName = match[1].replace(/"/g, '');
        columns = match[2] ? match[2].split(',').map(c => c.trim().replace(/"/g, '')) : [];
      }
      continue;
    }
    
    if (inCopy) {
      if (line.trim() === '\\.') {
        inCopy = false;
        continue;
      }
      if (line.trim() === '') continue;
      
      const values = line.split('\t').map(val => {
        if (val === '\\N') return 'NULL';
        let unescaped = val.replace(/\\([bfnrtv\\])/g, (match, p1) => {
          switch (p1) {
            case 'b': return '\b';
            case 'f': return '\f';
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            case 'v': return '\v';
            case '\\': return '\\';
            default: return match;
          }
        });
        return `'${unescaped.replace(/'/g, "''")}'`;
      });
      
      const colsPart = columns.length > 0 ? ` (${columns.join(', ')})` : '';
      currentBatch += `INSERT INTO ${tableName}${colsPart} VALUES (${values.join(', ')});\n`;
      batchCount++;
      if (batchCount > 100) await executeBatch();
      continue;
    }
    
    // Handle INSERT
    if (line.toUpperCase().startsWith('INSERT INTO ')) {
      inInsert = true;
      insertStatement = line + '\n';
      if (line.trim().endsWith(';')) {
        inInsert = false;
        currentBatch += insertStatement;
        batchCount++;
        if (batchCount > 100) await executeBatch();
      }
      continue;
    }
    
    if (inInsert) {
      insertStatement += line + '\n';
      if (line.trim().endsWith(';')) {
        inInsert = false;
        currentBatch += insertStatement;
        batchCount++;
        if (batchCount > 100) await executeBatch();
      }
      continue;
    }
  }
  
  await executeBatch();
}
