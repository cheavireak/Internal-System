import { db } from "../db.js";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

// Middleware to authenticate
export const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await db.prepare("SELECT id, email, role, name, permissions, is_superadmin FROM users WHERE email = ?").get(decoded.email) as any;
    if (!user) return res.status(401).json({ error: "User not found" });
    
    let permissions: any = {};
    const defaultPermissions = {
      menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'Reports', 'InternalReports', 'SMS', user.role === 'admin' ? 'AdminPanel' : '', user.role === 'admin' ? 'AuditLogs' : ''],
      can_create: user.role === 'manager' || user.role === 'admin',
      can_edit: user.role === 'manager' || user.role === 'admin',
      can_delete: user.role === 'admin',
      can_move: user.role === 'manager' || user.role === 'admin',
      can_import: user.role === 'admin',
      can_export: user.role === 'admin',
      can_delete_audit_logs: user.role === 'admin'
    };

    try {
      if (user.permissions) {
        const parsed = JSON.parse(user.permissions);
        if (Array.isArray(parsed)) {
          // If it's an empty array, use default permissions instead of wiping everything
          if (parsed.length === 0) {
            permissions = defaultPermissions;
          } else {
            permissions = { ...defaultPermissions, menus: parsed };
          }
        } else {
          permissions = parsed;
        }
      } else {
        permissions = defaultPermissions;
      }
      
      // Enforce admin/superadmin permissions
      if (user.is_superadmin) {
        permissions.menus = ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'Reports', 'InternalReports', 'SMS', 'AdminPanel', 'AuditLogs'];
        permissions.can_create = true;
        permissions.can_edit = true;
        permissions.can_delete = true;
        permissions.can_move = true;
        permissions.can_import = true;
        permissions.can_export = true;
        permissions.can_manage_columns = true;
        permissions.can_delete_audit_logs = true;
      } else if (user.role === 'admin') {
        if (!permissions.menus) permissions.menus = [];
        if (!permissions.menus.includes('AdminPanel')) permissions.menus.push('AdminPanel');
        if (!permissions.menus.includes('AuditLogs')) permissions.menus.push('AuditLogs');
        if (!permissions.menus.includes('Reports')) permissions.menus.push('Reports');
        if (!permissions.menus.includes('InternalReports')) permissions.menus.push('InternalReports');
        if (!permissions.menus.includes('SMS')) permissions.menus.push('SMS');
        permissions.can_delete_audit_logs = true;
      }
    } catch (e) {
      console.error("Failed to parse user permissions:", e);
      // Fallback to default permissions
      permissions = defaultPermissions;
    }

    req.user = {
      ...user,
      name: user.name || user.email.split('@')[0],
      is_superadmin: !!user.is_superadmin,
      permissions
    };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    console.error("Auth middleware error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.is_superadmin) return next();
  if (req.user.role === "user") {
    return res.status(401).json({ error: "Access denied" });
  }
  const hasAdminPanel = req.user.permissions?.menus?.includes('AdminPanel');
  if (req.user.role !== "admin" && req.user.role !== "manager" && !hasAdminPanel) {
    return res.status(401).json({ error: "Admin access required" });
  }
  next();
};
