import express from "express";
import { db } from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

router.get("/", authenticate, requireAdmin, (req: any, res) => {
  try {
    const blocked = db.prepare("SELECT * FROM blocked_ips ORDER BY blocked_at DESC").all();
    res.json(blocked);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/block", authenticate, requireAdmin, (req: any, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP is required" });
    
    db.prepare("INSERT OR IGNORE INTO blocked_ips (ip) VALUES (?)").run(ip);
    logAction('block', 'ip', ip, `Manually blocked IP: ${ip}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/unblock", authenticate, requireAdmin, (req: any, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP is required" });
    
    db.prepare("DELETE FROM blocked_ips WHERE ip = ?").run(ip);
    db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip);
    logAction('unblock', 'ip', ip, `Unblocked IP: ${ip}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
