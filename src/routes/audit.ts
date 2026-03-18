import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

router.get("/", authenticate, async (req: any, res) => {
  // Only users with AuditLogs permission or superadmin can view logs
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('AuditLogs')) {
    return res.status(401).json({ error: "Access denied" });
  }
  const logs = await db.prepare(`
    SELECT 
      id, 
      action, 
      entity, 
      entityId as "entityId", 
      details, 
      userId as "userId", 
      userName as "userName", 
      timestamp, 
      ip_address
    FROM audit_logs 
    ORDER BY timestamp DESC 
    LIMIT 1000
  `).all();
  res.json(logs);
});

router.post("/", authenticate, async (req: any, res) => {
  const { action, entity, entityId, details } = req.body;
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Get Client IP
  const clientIp = getClientIp(req);
  
  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, action, entity, entityId, details, userId, userName, timestamp, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, action, entity, entityId, details, req.user.id, req.user.name, timestamp, clientIp);
    res.json({ success: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/", authenticate, async (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('AuditLogs')) {
    return res.status(401).json({ error: "Only authorized users can clear logs" });
  }
  try {
    await db.prepare("DELETE FROM audit_logs").run();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
