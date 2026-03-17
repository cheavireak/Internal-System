import cron from 'node-cron';
import { db } from './db.js';
import { logAction } from './utils/audit.js';
import fs from 'fs';
import path from 'path';

export function startScheduler() {
  console.log('Scheduler started...');

  // Run every 12 hours for backup
  cron.schedule('0 */12 * * *', async () => {
    console.log('Running 12-hour backup task...');
    try {
      const BACKUP_DIR = path.join(process.cwd(), "Backup_data");
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }

      // Find the latest backup file
      const files = fs.readdirSync(BACKUP_DIR).filter(file => file.endsWith('.sqlite'));
      let latestFile = null;
      let latestTime = 0;

      for (const file of files) {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        if (stats.mtimeMs > latestTime) {
          latestTime = stats.mtimeMs;
          latestFile = file;
        }
      }

      let filename = latestFile;
      let actionType = 'update';
      
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `backup_auto_${timestamp}.sqlite`;
        actionType = 'create';
      }

      const backupPath = path.join(BACKUP_DIR, filename);
      
      await db.backup(backupPath);
      console.log(`Auto backup ${actionType === 'create' ? 'created' : 'updated'}: ${backupPath}`);
      logAction(actionType, 'system', 'backup', `Auto-${actionType} backup: ${filename}`, 0, 'System');
    } catch (error) {
      console.error('Error running auto backup:', error);
    }
  });

  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily cleanup task...');
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString();

      // Delete old users
      const deletedUsers = db.prepare("DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?").run(cutoffDate);
      if (deletedUsers.changes > 0) {
        console.log(`Permanently deleted ${deletedUsers.changes} users older than 30 days.`);
        logAction('delete', 'system', 'cleanup', `Auto-deleted ${deletedUsers.changes} users from recycle bin`, 0, 'System');
      }

      // Delete old customers
      const deletedCustomers = db.prepare("DELETE FROM customers WHERE deleted_at IS NOT NULL AND deleted_at < ?").run(cutoffDate);
      if (deletedCustomers.changes > 0) {
        console.log(`Permanently deleted ${deletedCustomers.changes} customers older than 30 days.`);
        logAction('delete', 'system', 'cleanup', `Auto-deleted ${deletedCustomers.changes} customers from recycle bin`, 0, 'System');
      }

    } catch (error) {
      console.error('Error running daily cleanup:', error);
    }
  });
}
