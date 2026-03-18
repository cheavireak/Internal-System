import express from "express";
import * as dbModule from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";
import { createPostgresBackup, restorePostgresBackup } from "../utils/backupUtils.js";

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

    const backupPath = path.join(BACKUP_DIR, filename);
    
    await createPostgresBackup(backupPath);
    
    const actionMsg = providedFilename ? `Overwrote backup: ${filename}` : `Created backup: ${filename}`;
    logAction(providedFilename ? 'update' : 'create', 'backup', null, actionMsg, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, message: actionMsg, file: filename });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset sequences for all tables to prevent duplicate key errors
async function resetSequences() {
  console.log("DEBUG: Starting sequence reset for all tables...");
  try {
    const tablesToReset = await dbModule.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    for (const row of tablesToReset.rows) {
      const tableName = row.table_name;
      
      // Find columns that are likely primary keys or have sequences
      // We check for SERIAL, IDENTITY, or columns with nextval in default
      const serialColumns = await dbModule.pool.query(`
        SELECT column_name, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND (
          column_default LIKE 'nextval%' 
          OR is_identity = 'YES'
          OR (column_name = 'id' AND data_type LIKE '%int%')
        )
      `, [tableName]);

      for (const col of serialColumns.rows) {
        const columnName = col.column_name;
        console.log(`DEBUG: Attempting to reset sequence for ${tableName}.${columnName}...`);
        
        try {
          // Try to get the sequence name
          const seqRes = await dbModule.pool.query(`
            SELECT pg_get_serial_sequence($1, $2) as seq_name
          `, [tableName, columnName]);
          
          let seqName = seqRes.rows[0]?.seq_name;
          
          if (!seqName) {
            // Fallback: common naming convention if pg_get_serial_sequence fails
            seqName = `${tableName}_${columnName}_seq`;
            console.log(`DEBUG: pg_get_serial_sequence failed, trying fallback name: ${seqName}`);
          }

          // Check if sequence exists before trying to set it
          const seqExists = await dbModule.pool.query(`
            SELECT EXISTS (
              SELECT 1 FROM pg_class c 
              JOIN pg_namespace n ON n.oid = c.relnamespace 
              WHERE c.relkind = 'S' AND c.relname = $1
            ) as exists
          `, [seqName.includes('.') ? seqName.split('.')[1] : seqName]);

          if (seqExists.rows[0].exists) {
            await dbModule.pool.query(`
              SELECT setval($1, COALESCE((SELECT MAX(${columnName}) FROM ${tableName}), 1))
            `, [seqName]);
            console.log(`DEBUG: Successfully reset sequence ${seqName}`);
          } else {
            console.warn(`DEBUG: Sequence ${seqName} does not exist. Skipping.`);
          }
        } catch (seqErr: any) {
          console.warn(`DEBUG: Could not reset sequence for ${tableName}.${columnName}:`, seqErr.message);
        }
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error("DEBUG: Error during sequence reset:", err.message);
    throw err;
  }
}

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
    await restorePostgresBackup(backupPath);
    console.log("DEBUG: Database restored.");

    // Reset sequences for all tables to prevent duplicate key errors
    await resetSequences();
    
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
    console.error("Restore error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sequence reset endpoint
router.post("/fix-sequences", authenticate, requireAdmin, async (req: any, res) => {
  try {
    await resetSequences();
    logAction('fix_sequences', 'system', null, `Manually reset database sequences`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, message: "Database sequences reset successfully." });
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
