import { db, initSchema } from "./src/db.js";
import bcrypt from "bcryptjs";

async function createAdmin() {
  await initSchema(); // Ensure tables exist
  
  const email = "cheavireak2021@gmail.com";
  const password = "password123";
  
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user already exists
  const existingUser = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingUser) {
    console.log("User with this email already exists.");
    return;
  }

  await db.prepare(`
    INSERT INTO users (email, password_hash, role, name, is_superadmin, permissions)
    VALUES (?, ?, 'admin', 'Admin User', true, '{"menus": ["NewIntegration", "SandboxToProduction", "Delay", "Lost", "Expired", "SMPP", "AdminPanel", "AuditLogs", "Reports", "InternalReports", "SMS"], "can_create": true, "can_edit": true, "can_delete": true, "can_move": true, "can_import": true, "can_export": true, "can_manage_columns": true, "can_delete_audit_logs": true}')
  `).run(email, hashedPassword);
  
  console.log("Super admin user created successfully!");
}

createAdmin();
