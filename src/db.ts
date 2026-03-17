import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const dbFile = "database.sqlite";
let _db: Database.Database;

function getLatestBackup(): string | null {
  const BACKUP_DIR = path.join(process.cwd(), "Backup_data");
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.sqlite'))
    .map(file => ({ name: file, time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
  return files.length > 0 ? path.join(BACKUP_DIR, files[0].name) : null;
}

function checkAndRepairDatabase() {
  console.log("DEBUG: Running database integrity check...");
  const integrity = _db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  if (integrity.integrity_check !== "ok") {
    console.error("DEBUG: Database corruption detected:", integrity.integrity_check);
    const latestBackup = getLatestBackup();
    if (latestBackup) {
      console.log("DEBUG: Attempting automated restore from latest backup:", latestBackup);
      _db.close();
      if (fs.existsSync("database.sqlite-wal")) fs.unlinkSync("database.sqlite-wal");
      if (fs.existsSync("database.sqlite-shm")) fs.unlinkSync("database.sqlite-shm");
      fs.copyFileSync(latestBackup, dbFile);
      _db = new Database(dbFile);
      _db.pragma('journal_mode = WAL');
      console.log("DEBUG: Automated restore successful.");
    } else {
      console.error("DEBUG: Database corrupted and no backups found!");
    }
  } else {
    console.log("DEBUG: Database integrity check passed.");
  }
}

// Proxy to allow reassigning the underlying database instance
export const db = new Proxy({} as Database.Database, {
  get(target, prop) {
    return _db[prop as keyof Database.Database];
  }
});

try {
  _db = new Database(dbFile);
  _db.pragma('journal_mode = WAL');
  checkAndRepairDatabase();
} catch (err: any) {
  console.error("Database initialization failed:", err.message);
  // ... existing recovery logic ...
  const latestBackup = getLatestBackup();
  if (latestBackup) {
    console.log("Attempting to recover from latest backup...");
    if (fs.existsSync("database.sqlite-wal")) fs.unlinkSync("database.sqlite-wal");
    if (fs.existsSync("database.sqlite-shm")) fs.unlinkSync("database.sqlite-shm");
    fs.copyFileSync(latestBackup, dbFile);
    _db = new Database(dbFile);
    _db.pragma('journal_mode = WAL');
    console.log("Recovery successful.");
  } else {
    console.error("No backups found to recover from. Starting with a fresh database.");
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    _db = new Database(dbFile);
    _db.pragma('journal_mode = WAL');
  }
}

// Initialize schema
export function initSchema() {
  console.log("DEBUG: Running initSchema.");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      name TEXT NOT NULL,
      permissions TEXT
    );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    create_date TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    type TEXT,
    content TEXT,
    feedback_from_customer TEXT,
    last_update TEXT,
    status TEXT,
    completed_date TEXT,
    pro_account TEXT,
    sale_owner TEXT,
    sale_updated TEXT,
    other TEXT,
    pipeline_stage TEXT NOT NULL DEFAULT 'NewIntegration',
    priority TEXT DEFAULT 'Med',
    next_follow_up_date TEXT,
    tags TEXT,
    status_in_production TEXT,
    date_to_production TEXT,
    date_have_traffic TEXT
  );
`);
  console.log("DEBUG: initSchema complete.");

// Add new columns if they don't exist (for existing databases)
try { _db.exec("ALTER TABLE customers ADD COLUMN status_in_production TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE customers ADD COLUMN date_to_production TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE customers ADD COLUMN date_have_traffic TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE customers ADD COLUMN is_imported INTEGER DEFAULT 0;"); } catch (e) {}
try { _db.exec("ALTER TABLE customers ADD COLUMN stage_updated_at TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE customers ADD COLUMN custom_data TEXT DEFAULT '{}';"); } catch (e) {}
try { _db.exec("ALTER TABLE users ADD COLUMN permissions TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE users ADD COLUMN is_disabled INTEGER DEFAULT 0;"); } catch (e) {}
try { _db.exec("ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0;"); } catch (e) {}
try { _db.exec("ALTER TABLE users ADD COLUMN deleted_at TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE users ADD COLUMN ip_whitelist TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE customers ADD COLUMN deleted_at TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE kpi_records ADD COLUMN deleted_at TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;"); } catch (e) {}
try { _db.exec("ALTER TABLE sms_logs ADD COLUMN sender TEXT;"); } catch (e) {}

_db.exec(`
  CREATE TABLE IF NOT EXISTS column_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline_stage TEXT NOT NULL,
    columns_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entityId TEXT,
    details TEXT,
    userId INTEGER,
    userName TEXT,
    timestamp TEXT NOT NULL,
    ip_address TEXT
  );

  CREATE TABLE IF NOT EXISTS kpi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    create_date DATE NOT NULL,
    company TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_by TEXT NOT NULL,
    problem TEXT NOT NULL,
    problem_type TEXT NOT NULL,
    response_time TEXT NOT NULL,
    resolve_time TEXT NOT NULL,
    solution TEXT,
    resolved_same_day TEXT DEFAULT 'Y',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    task TEXT NOT NULL,
    time TEXT NOT NULL,
    result TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_assign TEXT NOT NULL,
    time TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS internal_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    action_tasks TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_kpi_create_date ON kpi_records(create_date);

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sms_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    content TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    message_id TEXT NOT NULL,
    sms_parts INTEGER NOT NULL,
    sender TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY,
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  `);

  // Add new columns if they don't exist (for existing databases)
  try { _db.exec("ALTER TABLE customers ADD COLUMN status_in_production TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE customers ADD COLUMN date_to_production TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE customers ADD COLUMN date_have_traffic TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE customers ADD COLUMN is_imported INTEGER DEFAULT 0;"); } catch (e) {}
  try { _db.exec("ALTER TABLE customers ADD COLUMN stage_updated_at TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE customers ADD COLUMN custom_data TEXT DEFAULT '{}';"); } catch (e) {}
  try { _db.exec("ALTER TABLE users ADD COLUMN permissions TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE users ADD COLUMN is_disabled INTEGER DEFAULT 0;"); } catch (e) {}
  try { _db.exec("ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0;"); } catch (e) {}
  try { _db.exec("ALTER TABLE users ADD COLUMN deleted_at TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE users ADD COLUMN ip_whitelist TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE customers ADD COLUMN deleted_at TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE kpi_records ADD COLUMN deleted_at TEXT;"); } catch (e) {}
  try { _db.exec("ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;"); } catch (e) {}

  // One-time cleanup: mark all existing records as imported to clear the graph history
  try { _db.exec("UPDATE customers SET is_imported = 1 WHERE stage_updated_at IS NULL"); } catch (e) {}

  // Create default admin user if none exists
  const superadminExists = _db.prepare("SELECT * FROM users WHERE is_superadmin = 1").get();
  const defaultPermissions = JSON.stringify({
    menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'Reports', 'InternalReports', 'AdminPanel', 'AuditLogs'],
    can_create: true,
    can_edit: true,
    can_delete: true,
    can_move: true,
    can_import: true,
    can_export: true,
    can_manage_columns: true,
    can_delete_audit_logs: true
  });

  if (!superadminExists) {
    const adminByEmail = _db.prepare("SELECT * FROM users WHERE email = 'admin@admin.com'").get() as any;
    if (adminByEmail) {
      _db.prepare("UPDATE users SET is_superadmin = 1, role = 'admin', permissions = ? WHERE id = ?").run(defaultPermissions, adminByEmail.id);
    } else {
      const firstUser = _db.prepare("SELECT * FROM users ORDER BY id ASC LIMIT 1").get() as any;
      if (firstUser) {
        _db.prepare("UPDATE users SET is_superadmin = 1, role = 'admin', permissions = ? WHERE id = ?").run(defaultPermissions, firstUser.id);
      } else {
        const hash = bcrypt.hashSync("admin123", 10);
        _db.prepare("INSERT INTO users (email, password_hash, role, name, permissions, is_superadmin) VALUES (?, ?, ?, ?, ?, 1)").run("admin@admin.com", hash, "admin", "Admin User", defaultPermissions);
      }
    }
  } else {
    // Ensure superadmin always has admin role and full permissions
    _db.prepare("UPDATE users SET role = 'admin', permissions = ? WHERE is_superadmin = 1").run(defaultPermissions);
  }
}

initSchema();

export function restoreDatabase(backupPath: string) {
  try {
    console.log("DEBUG: Running initSchema before restore.");
    initSchema(); // Ensure tables exist
    
    console.log("DEBUG: Attaching backup database.");
    _db.prepare(`ATTACH DATABASE ? AS backup`).run(backupPath);
    
    // Verify tables
    const tablesInBackup = _db.prepare("SELECT name FROM backup.sqlite_master WHERE type='table'").all();
    console.log("DEBUG: Tables in backup:", JSON.stringify(tablesInBackup));
    
    // For each table, insert or replace
    const tables = ['users', 'customers', 'column_settings', 'audit_logs', 'kpi_records', 'support_reports', 'task_reports', 'internal_reports', 'system_settings'];
    
    _db.transaction(() => {
      for (const table of tables) {
        // Check if table exists in backup
        const tableExists = tablesInBackup.some((t: any) => t.name === table);
        if (tableExists) {
          console.log(`DEBUG: Merging table ${table}`);
          try {
            if (table === 'internal_reports') {
              _db.exec(`INSERT OR REPLACE INTO internal_reports (id, date, action_tasks, result, created_at, deleted_at) SELECT id, date, action_tasks, result, created_at, deleted_at FROM backup.internal_reports`);
            } else {
              _db.exec(`INSERT OR REPLACE INTO ${table} SELECT * FROM backup.${table}`);
            }
          } catch (e) {
            console.error(`DEBUG: Failed to merge table ${table}:`, e);
          }
        } else {
          console.log(`DEBUG: Table ${table} not found in backup.`);
        }
      }
    })();
    
    console.log("DEBUG: Detaching backup database.");
    _db.prepare(`DETACH DATABASE backup`).run();
    
    console.log("DEBUG: Restore complete.");
  } catch (err) {
    console.error("DEBUG: Restore failed:", err);
    throw err;
  }
}
