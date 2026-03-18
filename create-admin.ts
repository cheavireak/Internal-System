import { db, initSchema } from "./src/db.js";

async function updateAdmin() {
  await initSchema(); // Ensure tables exist
  
  const email = "cheavireak2021@gmail.com";
  
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

  // Update the existing user
  const result = await db.prepare(`
    UPDATE users 
    SET is_superadmin = true, permissions = ?
    WHERE email = ?
  `).run(JSON.stringify(permissions), email);
  
  if (result.changes > 0) {
    console.log("Admin user updated successfully with full permissions!");
  } else {
    console.log("Admin user not found.");
  }
}

updateAdmin();
