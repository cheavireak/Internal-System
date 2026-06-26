import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:04122@localhost:5432/internal-system',
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
      
      // Add route column to sms_logs if it doesn't exist
      try {
        await pool.query('ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS route VARCHAR(100) DEFAULT \'no gateway\'');
      } catch (e) {
        console.warn('Could not add route column to sms_logs:', e);
      }
      
      // Ensure boolean columns are correctly typed in Postgres
      try {
        await pool.query(`
          ALTER TABLE users ALTER COLUMN is_superadmin DROP DEFAULT;
          ALTER TABLE users ALTER COLUMN is_superadmin TYPE boolean USING (
            CASE 
              WHEN is_superadmin::text = '1' THEN TRUE
              WHEN is_superadmin::text = '0' THEN FALSE
              WHEN is_superadmin::text = 'true' THEN TRUE
              WHEN is_superadmin::text = 'false' THEN FALSE
              ELSE FALSE
            END
          );
          ALTER TABLE users ALTER COLUMN is_superadmin SET DEFAULT false;
          
          ALTER TABLE users ALTER COLUMN is_disabled DROP DEFAULT;
          ALTER TABLE users ALTER COLUMN is_disabled TYPE boolean USING (
            CASE 
              WHEN is_disabled::text = '1' THEN TRUE
              WHEN is_disabled::text = '0' THEN FALSE
              WHEN is_disabled::text = 'true' THEN TRUE
              WHEN is_disabled::text = 'false' THEN FALSE
              ELSE FALSE
            END
          );
          ALTER TABLE users ALTER COLUMN is_disabled SET DEFAULT false;

          ALTER TABLE customers ALTER COLUMN is_imported DROP DEFAULT;
          ALTER TABLE customers ALTER COLUMN is_imported TYPE boolean USING (
            CASE 
              WHEN is_imported::text = '1' THEN TRUE
              WHEN is_imported::text = '0' THEN FALSE
              WHEN is_imported::text = 'true' THEN TRUE
              WHEN is_imported::text = 'false' THEN FALSE
              ELSE FALSE
            END
          );
          ALTER TABLE customers ALTER COLUMN is_imported SET DEFAULT false;
        `);
      } catch (e) {
        console.warn('Could not migrate boolean columns:', e);
      }
      
      console.log("PostgreSQL schema initialized successfully.");
      
      // Automatically seed a default admin user if none exists in the database
      try {
        const defaultEmail = 'cheavireak2021@gmail.com';
        const defaultPassword = 'Admin@123456';
        const passwordHash = bcrypt.hashSync(defaultPassword, 10);
        const permissions = JSON.stringify({
          menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'AdminPanel', 'AuditLogs', 'Reports', 'InternalReports', 'SMS'],
          can_create: true,
          can_edit: true,
          can_delete: true,
          can_move: true,
          can_import: true,
          can_export: true,
          can_manage_columns: true,
          can_delete_audit_logs: true
        });

        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [defaultEmail]);
        if (userRes.rows.length === 0) {
          await pool.query(
            `INSERT INTO users (email, password_hash, role, name, permissions, is_superadmin, is_disabled) 
             VALUES ($1, $2, 'admin', 'Super Admin', $3, true, false)`,
            [defaultEmail, passwordHash, permissions]
          );
          console.log(`[SEED] Super Admin user '${defaultEmail}' created successfully!`);
        } else {
          await pool.query(
            `UPDATE users 
             SET password_hash = $1, role = 'admin', permissions = $2, is_superadmin = true, is_disabled = false, deleted_at = NULL 
             WHERE email = $3`,
            [passwordHash, permissions, defaultEmail]
          );
          console.log(`[SEED] Super Admin user '${defaultEmail}' updated successfully!`);
        }
      } catch (e) {
        console.warn('[SEED] Could not seed default admin user:', e);
      }
    } else {
      console.log("schema.sql not found, skipping schema initialization.");
    }
  } catch (error) {
    // Re-throw so server.ts can catch it and gracefully exit
    throw error;
  }
}

