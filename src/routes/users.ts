import express from "express";
import { db } from "../db.js";
import bcrypt from "bcryptjs";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

// Get all active users
router.get("/", authenticate, async (req: any, res) => {
  const users = await db.prepare("SELECT id, email, role, name, permissions, is_disabled, is_superadmin, ip_whitelist FROM users WHERE deleted_at IS NULL").all() as any[];
  const parsedUsers = users.map(u => ({
    ...u,
    permissions: u.permissions ? JSON.parse(u.permissions) : null,
    is_disabled: !!u.is_disabled,
    is_superadmin: !!u.is_superadmin,
    ip_whitelist: u.ip_whitelist || ""
  }));
  res.json(parsedUsers);
});

// Get deleted users (Trash)
router.get("/trash", authenticate, requireAdmin, async (req: any, res) => {
  const users = await db.prepare("SELECT id, email, role, name, permissions, is_disabled, is_superadmin, deleted_at FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all() as any[];
  const parsedUsers = users.map(u => ({
    ...u,
    permissions: u.permissions ? JSON.parse(u.permissions) : null,
    is_disabled: !!u.is_disabled,
    is_superadmin: !!u.is_superadmin
  }));
  res.json(parsedUsers);
});

// Restore deleted user
router.post("/:id/restore", authenticate, requireAdmin, async (req: any, res) => {
  try {
    const targetUser = await db.prepare("SELECT email, name FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    await db.prepare("UPDATE users SET deleted_at = NULL WHERE id = ?").run(req.params.id);
    logAction('restore', 'user', req.params.id, `Restored user: ${targetUser.name}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/", authenticate, requireAdmin, async (req: any, res) => {
  const { email, password, role, name, permissions } = req.body;
  try {
    if (req.user.role === 'manager' && role === 'admin') {
      return res.status(401).json({ error: "Managers cannot create admin users" });
    }
    const hash = bcrypt.hashSync(password, 10);
    let defaultPerms;
    if (role === 'admin') {
      defaultPerms = {
        menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'AdminPanel', 'AuditLogs', 'Reports', 'InternalReports', 'SMS'],
        can_create: true,
        can_edit: true,
        can_delete: true,
        can_move: true,
        can_import: true,
        can_export: true,
        can_manage_columns: true,
        can_delete_audit_logs: true
      };
    } else {
      defaultPerms = {
        menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP'],
        can_create: role === 'manager',
        can_edit: role === 'manager',
        can_delete: false,
        can_move: role === 'manager',
        can_import: false,
        can_export: false,
        can_manage_columns: false
      };
    }
    const permsString = permissions ? JSON.stringify(permissions) : JSON.stringify(defaultPerms);
    const result = await db.prepare("INSERT INTO users (email, password_hash, role, name, permissions, ip_whitelist) VALUES (?, ?, ?, ?, ?, ?)").run(email, hash, role, name, permsString, req.body.ip_whitelist || "");
    
    logAction('create', 'user', String(result.lastInsertRowid), `Created user: ${name} (${role})`, req.user.id, req.user.name, getClientIp(req));
    res.json({ id: result.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", authenticate, requireAdmin, async (req: any, res) => {
  const { email, role, name, permissions, is_disabled } = req.body;
  try {
    const targetUser = await db.prepare("SELECT role, is_superadmin, name FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    if (req.user.role === 'manager') {
      if (targetUser.role === 'admin') {
        return res.status(401).json({ error: "Managers cannot edit admin users" });
      }
      if (role === 'admin') {
        return res.status(401).json({ error: "Managers cannot promote users to admin" });
      }
    }

    // Prevent changing superadmin role or permissions
    if (targetUser.is_superadmin) {
      if (role !== 'admin') {
        return res.status(400).json({ error: "Cannot change role of superadmin user" });
      }
      if (is_disabled) {
        return res.status(400).json({ error: "Cannot disable superadmin user" });
      }
      // Force full permissions for superadmin
      const defaultPermissions = JSON.stringify({
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
      await db.prepare("UPDATE users SET email = ?, name = ?, permissions = ?, is_disabled = 0, ip_whitelist = ? WHERE id = ?").run(email, name, defaultPermissions, req.body.ip_whitelist || "", req.params.id);
      logAction('update', 'user', req.params.id, `Updated superadmin user: ${name}`, req.user.id, req.user.name, getClientIp(req));
      return res.json({ success: true });
    }

    const permsString = permissions ? JSON.stringify(permissions) : null;
    const disabledVal = is_disabled ? 1 : 0;
    const ipWhitelistVal = req.body.ip_whitelist || "";
    if (permsString) {
      await db.prepare("UPDATE users SET email = ?, role = ?, name = ?, permissions = ?, is_disabled = ?, ip_whitelist = ? WHERE id = ?").run(email, role, name, permsString, disabledVal, ipWhitelistVal, req.params.id);
    } else {
      await db.prepare("UPDATE users SET email = ?, role = ?, name = ?, is_disabled = ?, ip_whitelist = ? WHERE id = ?").run(email, role, name, disabledVal, ipWhitelistVal, req.params.id);
    }
    
    let details = `Updated user: ${name}`;
    if (targetUser.role !== role) details += ` (Role changed from ${targetUser.role} to ${role})`;
    if (targetUser.is_disabled !== disabledVal) details += ` (Status changed to ${disabledVal ? 'Disabled' : 'Enabled'})`;
    
    logAction('update', 'user', req.params.id, details, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    if (e.message.includes("UNIQUE constraint failed: users.email")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id/password", authenticate, requireAdmin, async (req: any, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }
  try {
    const targetUser = await db.prepare("SELECT role, name FROM users WHERE id = ?").get(req.params.id) as any;
    if (req.user.role === 'manager' && targetUser?.role === 'admin') {
      return res.status(401).json({ error: "Managers cannot reset password of admin users" });
    }

    const hash = bcrypt.hashSync(password, 10);
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.params.id);
    
    logAction('update', 'user', req.params.id, `Reset password for user: ${targetUser?.name || 'Unknown'}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id/toggle-status", authenticate, requireAdmin, async (req: any, res) => {
  try {
    const targetUser = await db.prepare("SELECT email, is_disabled, name FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    
    if (targetUser.email === 'admin@admin.com') {
      return res.status(400).json({ error: "Cannot disable the default admin user" });
    }

    const newStatus = targetUser.is_disabled ? 0 : 1;
    await db.prepare("UPDATE users SET is_disabled = ? WHERE id = ?").run(newStatus, req.params.id);
    
    logAction('update', 'user', req.params.id, `Toggled user status: ${targetUser.name} (Disabled: ${newStatus})`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, is_disabled: !!newStatus });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", authenticate, requireAdmin, async (req: any, res) => {
  try {
    const targetUser = await db.prepare("SELECT role, is_superadmin, name FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    
    if (req.user.role === 'manager' && targetUser.role === 'admin') {
      return res.status(401).json({ error: "Managers cannot delete admin users" });
    }

    if (targetUser.is_superadmin) {
      return res.status(400).json({ error: "Cannot delete the superadmin user" });
    }

    await db.prepare("UPDATE users SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
    
    logAction('delete', 'user', req.params.id, `Soft deleted user: ${targetUser.name}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id/permanent", authenticate, requireAdmin, async (req: any, res) => {
  try {
    const targetUser = await db.prepare("SELECT name FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    await db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    
    logAction('delete_permanent', 'user', req.params.id, `Permanently deleted user: ${targetUser.name}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/trash/clear", authenticate, requireAdmin, async (req: any, res) => {
  try {
    await db.prepare("DELETE FROM users WHERE deleted_at IS NOT NULL").run();
    logAction('clear_trash', 'user', null, `Cleared user trash`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
