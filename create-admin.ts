import { db, initSchema } from "./src/db.js";
import bcrypt from "bcryptjs";

async function updateAdmin() {
  await initSchema(); // Ensure tables exist
  
  const email = "cheavireak2021@gmail.com";
  const defaultPassword = "Admin@123456";
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);
  
  // Define the full permissions object
  const permissions = {
    menus: ["NewIntegration", "SandboxToProduction", "Delay", "Lost", "Expired", "SMPP", "AdminPanel", "AuditLogs", "Reports", "InternalReports", "SMS"],
    can_create: true,
    can_edit: true,
    can_delete: true,
    can_move: true,
    can_import: true,
    can_export: true,
    can_manage_columns: true,
    can_delete_audit_logs: true
  };

  const permsString = JSON.stringify(permissions);

  // Check if user already exists
  const existingUser = await db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

  if (existingUser) {
    // Update the existing user
    const result = await db.prepare(`
      UPDATE users 
      SET is_superadmin = 1, password_hash = ?, permissions = ?, is_disabled = 0, deleted_at = NULL
      WHERE email = ?
    `).run(passwordHash, permsString, email);
    
    if (result.changes > 0) {
      console.log(`Admin user '${email}' updated successfully with full permissions and password reset!`);
    } else {
      console.log("Admin user update failed.");
    }
  } else {
    // Create a new superadmin user
    const result = await db.prepare(`
      INSERT INTO users (email, password_hash, role, name, permissions, is_superadmin, is_disabled)
      VALUES (?, ?, 'admin', 'Super Admin', ?, 1, 0)
    `).run(email, passwordHash, permsString);

    if (result.changes > 0) {
      console.log(`Super Admin user '${email}' created successfully!`);
      console.log(`Temporary Password: ${defaultPassword}`);
    } else {
      console.log("Failed to create Super Admin user.");
    }
  }
}

updateAdmin();
