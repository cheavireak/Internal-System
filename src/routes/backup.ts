import express from "express";
import * as dbModule from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

import { exec } from "child_process";
import util from "util";
const execAsync = util.promisify(exec);

const router = express.Router();
const BACKUP_DIR = path.join(process.cwd(), "Backup_data");

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BACKUP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `uploaded_backup_${Date.now()}${ext || '.sql'}`);
  }
});
const upload = multer({ storage });

// Get list of backups
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.sql') || file.endsWith('.sqlite'))
      .map(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return {
          name: file,
          size: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new backup or overwrite an existing one
router.post("/create", authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { filename: providedFilename } = req.body;
    let filename = providedFilename;

    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `backup_${timestamp}.sql`;
    }

    // Use pg_dump for PostgreSQL
    const databaseUrl = process.env.DATABASE_URL || 'postgres://your_username:your_password@localhost:5432/internal-system';
    const backupPath = path.join(BACKUP_DIR, filename);
    
    const pgDumpCmd = `pg_dump -d "${databaseUrl}" -F c -f "${backupPath}"`;
    await execAsync(pgDumpCmd);
    
    const actionMsg = providedFilename ? `Overwrote backup: ${filename}` : `Created backup: ${filename}`;
    logAction(providedFilename ? 'update' : 'create', 'backup', null, actionMsg, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, message: actionMsg, file: filename });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from a backup
router.post("/restore", authenticate, requireAdmin, async (req: any, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup file not found" });
  }

  try {
    const stats = fs.statSync(backupPath);
    console.log("DEBUG: Backup file size:", stats.size);
    
    // Get the current user before restoring
    const currentUser = await dbModule.db.prepare("SELECT * FROM users WHERE email = ?").get((req as any).user.email) as any;
    console.log("DEBUG: Current user before restore:", currentUser ? currentUser.email : "null");
    
    // RESTORE LOGIC
    if (filename.endsWith('.sqlite') || filename.endsWith('.db')) {
      console.log("DEBUG: Restoring from SQLite...");
      const Database = (await import('better-sqlite3')).default;
      const sqliteDb = new Database(backupPath);
      
      const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      
      for (const table of tables) {
        const tableName = table.name.toLowerCase();
        if (tableName === 'sqlite_sequence') continue;
        
        console.log(`DEBUG: Migrating table ${tableName}...`);
        const rows = sqliteDb.prepare(`SELECT * FROM ${table.name}`).all() as any[];
        
        if (rows.length === 0) continue;
        
        // Clear existing data in Postgres
        await dbModule.pool.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
        
        // Get column types from Postgres to identify date/timestamp columns
        const tableInfo = await dbModule.pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        
        if (tableInfo.rows.length === 0) {
          console.warn(`DEBUG: Table ${tableName} from SQLite does not exist in PostgreSQL. Skipping.`);
          continue;
        }
        
        const dateColumns = tableInfo.rows
          .filter(r => r.data_type.toLowerCase().includes('date') || r.data_type.toLowerCase().includes('timestamp'))
          .map(r => r.column_name);

        const postgresColumns = tableInfo.rows.map(r => r.column_name);
        const columns = Object.keys(rows[0]).filter(col => postgresColumns.includes(col));
        
        if (columns.length === 0) {
          console.warn(`DEBUG: No matching columns found for table ${tableName}. Skipping.`);
          continue;
        }

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        for (const row of rows) {
          const values = columns.map(col => {
            let val = row[col];
            // Sanitize date/timestamp columns
            if (dateColumns.includes(col) && val && typeof val === 'string') {
              const date = new Date(val);
              if (isNaN(date.getTime())) {
                console.warn(`DEBUG: Invalid date value "${val}" in column "${col}" for table "${tableName}". Setting to NULL.`);
                return null;
              }
            }
            return val;
          });
          try {
            await dbModule.pool.query(insertSql, values);
          } catch (insertError: any) {
            console.error(`DEBUG: Error inserting into ${tableName}:`, insertError.message);
            console.error(`DEBUG: Row data:`, JSON.stringify(row));
            throw insertError;
          }
        }
      }
      sqliteDb.close();
    } else {
      // Use pg_restore for PostgreSQL
      const databaseUrl = process.env.DATABASE_URL || 'postgres://your_username:your_password@localhost:5432/internal-system';
      const pgRestoreCmd = `pg_restore -d "${databaseUrl}" -1 -c "${backupPath}"`;
      await execAsync(pgRestoreCmd);
    }
    console.log("DEBUG: Database restored.");
    
    // Check if data exists
    const count = await dbModule.db.prepare("SELECT COUNT(*) as count FROM customers").get() as any;
    console.log("DEBUG: Customer count after restore:", count.count);
    
    // Ensure the user who initiated the restore is still in the restored database with their exact permissions
    if (currentUser) {
      const userInNewDb = await dbModule.db.prepare("SELECT * FROM users WHERE email = ?").get(currentUser.email) as any;
      console.log("DEBUG: User in new DB:", userInNewDb ? userInNewDb.email : "null");

      if (userInNewDb) {
        console.log("DEBUG: Updating user in new DB.");
        await dbModule.db.prepare("UPDATE users SET is_superadmin = ?, role = ?, permissions = ?, name = ? WHERE email = ?").run(
          currentUser.is_superadmin,
          currentUser.role,
          currentUser.permissions,
          currentUser.name,
          currentUser.email
        );
      } else {
        console.log("DEBUG: Inserting user into new DB.");
        await dbModule.db.prepare("INSERT INTO users (email, password_hash, role, name, permissions, is_superadmin) VALUES (?, ?, ?, ?, ?, ?)").run(
          currentUser.email, 
          currentUser.password_hash, 
          currentUser.role, 
          currentUser.name, 
          currentUser.permissions,
          currentUser.is_superadmin
        );
      }
    }
    
    logAction('restore', 'backup', null, `Restored database from: ${filename}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, message: "Database restored successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download a backup file
router.get("/download/:filename", authenticate, requireAdmin, async (req: any, res) => {
  const { filename } = req.params;
  const backupPath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup file not found" });
  }

  logAction('download', 'backup', null, `Downloaded backup: ${filename}`, req.user.id, req.user.name, getClientIp(req));
  res.download(backupPath);
});

// Upload a backup file
router.post("/upload", authenticate, requireAdmin, upload.single("file"), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  logAction('upload', 'backup', null, `Uploaded backup: ${req.file.filename}`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true, message: "Backup uploaded successfully", file: req.file.filename });
});

// Delete a backup
router.delete("/:filename", authenticate, requireAdmin, async (req: any, res) => {
  const { filename } = req.params;
  const backupPath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup file not found" });
  }

  try {
    fs.unlinkSync(backupPath);
    logAction('delete', 'backup', null, `Deleted backup: ${filename}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, message: "Backup deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
