import { db } from "../db.js";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

// Middleware to authenticate
export const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare("SELECT id, email, role, name, permissions, is_superadmin FROM users WHERE email = ?").get(decoded.email) as any;
    if (!user) return res.status(401).json({ error: "User not found" });
    
    let permissions: any = {};
    try {
      permissions = user.permissions ? JSON.parse(user.permissions) : {
        menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'Reports', 'InternalReports', 'SMS', user.role === 'admin' ? 'AdminPanel' : '', user.role === 'admin' ? 'AuditLogs' : ''],
        can_create: user.role === 'manager' || user.role === 'admin',
        can_edit: user.role === 'manager' || user.role === 'admin',
        can_delete: user.role === 'admin',
        can_move: user.role === 'manager' || user.role === 'admin',
        can_import: user.role === 'admin',
        can_export: user.role === 'admin',
        can_delete_audit_logs: user.role === 'admin'
      };
      
      // Enforce admin permissions
      if (user.role === 'admin') {
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
      permissions = {
        menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'Reports', 'InternalReports', 'SMS', user.role === 'admin' ? 'AdminPanel' : '', user.role === 'admin' ? 'AuditLogs' : ''],
        can_create: user.role === 'manager' || user.role === 'admin',
        can_edit: user.role === 'manager' || user.role === 'admin',
        can_delete: user.role === 'admin',
        can_move: user.role === 'manager' || user.role === 'admin',
        can_import: user.role === 'admin',
        can_export: user.role === 'admin',
        can_delete_audit_logs: user.role === 'admin'
      };
    }

    req.user = {
      ...user,
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
  if (req.user.role === "user") {
    return res.status(401).json({ error: "Access denied" });
  }
  const hasAdminPanel = req.user.permissions?.menus?.includes('AdminPanel');
  if (req.user.role !== "admin" && req.user.role !== "manager" && !hasAdminPanel) {
    return res.status(401).json({ error: "Admin access required" });
  }
  next();
};
