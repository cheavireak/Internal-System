import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'internal-system',
  password: 'your_password',
  port: 5432,
});

// Helper to convert SQLite ? to Postgres $1, $2
function convertSql(sql: string) {
  let i = 1;
  let pgSql = sql.replace(/\?/g, () => `$${i++}`);
  
  // Convert SQLite datetime('now') to CURRENT_TIMESTAMP
  pgSql = pgSql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
  pgSql = pgSql.replace(/datetime\('now',\s*'-15 minutes'\)/g, "NOW() - INTERVAL '15 minutes'");
  pgSql = pgSql.replace(/datetime\('now',\s*'-15 seconds'\)/g, "NOW() - INTERVAL '15 seconds'");
  
  // Convert strftime('%s', 'now') to EXTRACT(EPOCH FROM NOW())
  pgSql = pgSql.replace(/strftime\('%s',\s*'now'\)/g, 'EXTRACT(EPOCH FROM NOW())');
  pgSql = pgSql.replace(/strftime\('%s',\s*([a-zA-Z_]+)\)/g, 'EXTRACT(EPOCH FROM $1)');
  
  // Convert strftime('%Y-%m', column) to SUBSTRING(CAST(column AS TEXT) FROM 1 FOR 7)
  pgSql = pgSql.replace(/strftime\('%Y-%m',\s*([a-zA-Z_]+)\)/g, "SUBSTRING(CAST($1 AS TEXT) FROM 1 FOR 7)");
  
  // Convert INSERT OR REPLACE to INSERT ... ON CONFLICT DO NOTHING (or UPDATE)
  // Since ON CONFLICT requires knowing the unique constraint, we'll try to handle common ones
  if (pgSql.includes('INSERT OR REPLACE INTO blocked_ips')) {
    pgSql = pgSql.replace('INSERT OR REPLACE INTO blocked_ips (ip, blocked_at) VALUES ($1, CURRENT_TIMESTAMP)', 
                          'INSERT INTO blocked_ips (ip, blocked_at) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (ip) DO UPDATE SET blocked_at = CURRENT_TIMESTAMP');
  }
  if (pgSql.includes('INSERT OR REPLACE INTO system_settings')) {
    pgSql = pgSql.replace('INSERT OR REPLACE INTO system_settings (key, value) VALUES ($1, $2)',
                          'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value');
  }
  if (pgSql.includes('INSERT OR REPLACE INTO column_settings')) {
    pgSql = pgSql.replace('INSERT OR REPLACE INTO column_settings (pipeline_stage, columns_json) VALUES ($1, $2)',
                          'INSERT INTO column_settings (pipeline_stage, columns_json) VALUES ($1, $2) ON CONFLICT (pipeline_stage) DO UPDATE SET columns_json = EXCLUDED.columns_json');
  }
  
  // Handle last_insert_rowid()
  if (pgSql.includes('last_insert_rowid()')) {
     // This is usually used in a separate query, which won't work in Postgres easily without RETURNING.
     // We will need to fix those manually in the routes.
  }

  return pgSql;
}

export const db = {
  transaction: (fn: Function) => {
    return async (...args: any[]) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(...args);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    };
  },
  prepare: (sql: string) => {
    const pgSql = convertSql(sql);
    return {
      get: async (...params: any[]) => {
        const res = await pool.query(pgSql, params);
        return res.rows[0];
      },
      all: async (...params: any[]) => {
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      run: async (...params: any[]) => {
        // If it's an insert, we try to append RETURNING id to get the last insert id
        let runSql = pgSql;
        if (runSql.trim().toUpperCase().startsWith('INSERT') && !runSql.toUpperCase().includes('RETURNING')) {
           runSql += ' RETURNING id';
        }
        try {
          const res = await pool.query(runSql, params);
          return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id };
        } catch (e: any) {
          // If RETURNING id fails (e.g., table has no id column), fallback
          if (e.message.includes('does not exist')) {
            const res = await pool.query(pgSql, params);
            return { changes: res.rowCount };
          }
          throw e;
        }
      }
    };
  }
};

export function restoreDatabase(backupPath: string) {
  console.error("restoreDatabase is not supported in PostgreSQL mode. Use pg_restore instead.");
}

export async function initSchema() {
  try {
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log("PostgreSQL schema initialized successfully.");
    } else {
      console.log("schema.sql not found, skipping schema initialization.");
    }
  } catch (error) {
    console.error("Error initializing schema:", error);
  }
}

