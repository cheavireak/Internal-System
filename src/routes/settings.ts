import express from "express";
import { db } from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { getClientIp } from "../utils/ip.js";
import { logAction } from "../utils/audit.js";

const router = express.Router();

// Get all system settings
router.get("/", authenticate, (req, res) => {
  console.log("Fetching system settings");
  try {
    const settings = db.prepare("SELECT * FROM system_settings").all() as any[];
    console.log("Settings found:", settings);
    const settingsObj = settings.reduce((acc, curr) => {
      acc[curr.key] = JSON.parse(curr.value);
      return acc;
    }, {});
    res.json(settingsObj);
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific system setting
router.get("/:key", authenticate, (req, res) => {
  try {
    const { key } = req.params;
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as any;
    if (setting) {
      res.json(JSON.parse(setting.value));
    } else {
      res.json({ value: null });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a system setting
router.put("/:key", authenticate, requireAdmin, (req, res) => {
  try {
    const { key } = req.params;
    const value = req.body; // Expecting the full body object as the value
    
    // IP Whitelist Validation
    if (key === 'ip_whitelist' && value.enabled) {
      const clientIp = getClientIp(req);
      
      const allowedIps = value.value ? value.value.split(';').map((ip: string) => ip.trim()).filter((ip: string) => ip) : [];
      if (!allowedIps.includes(clientIp)) {
        allowedIps.push(clientIp);
        value.value = allowedIps.join(';');
      }
    }
    
    const existing = db.prepare("SELECT key FROM system_settings WHERE key = ?").get(key);
    if (existing) {
      db.prepare("UPDATE system_settings SET value = ? WHERE key = ?").run(JSON.stringify(value), key);
    } else {
      db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
    }
    
    let details = `Updated setting: ${key}`;
    if (key === 'session_timeout') {
      details = `Set session timeout to ${value.value} minutes`;
    } else if (key === 'ip_whitelist') {
      details = `IP whitelist updated: ${value.value} (Enabled: ${value.enabled})`;
    } else if (key === 'hidden_menus') {
      details = `Updated hidden menus: ${JSON.stringify(value.value)}`;
    }
    
    logAction('update', 'system', null, details, (req as any).user.id, (req as any).user.name, getClientIp(req));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
