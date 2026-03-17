import express from "express";
import { db } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get Client IP
    const clientIp = getClientIp(req);
    console.log("DEBUG: Login attempt from IP:", clientIp);

    // Clean up expired blocks
    db.prepare("DELETE FROM blocked_ips WHERE blocked_at <= datetime('now', '-15 minutes')").run();

    // Check if IP is blocked
    const isBlocked = db.prepare("SELECT *, (strftime('%s', 'now') - strftime('%s', blocked_at)) as elapsed FROM blocked_ips WHERE ip = ?").get(clientIp) as any;
    if (isBlocked) {
      const remainingSeconds = 900 - isBlocked.elapsed; // 15 mins = 900 seconds
      const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
      return res.status(401).json({ 
        error: "IP_BLOCKED", 
        message: `Your IP has been blocked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.` 
      });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    const handleFailedLogin = (reason: string, userId?: number, userName?: string) => {
      logAction('login_failed', 'user', userId ? String(userId) : null, `Login failed for ${email || 'unknown'}: ${reason}`, userId || null, userName || null, clientIp);
      
      // Track failed attempt
      db.prepare("INSERT INTO login_attempts (ip) VALUES (?)").run(clientIp);
      
      // Clean up old attempts
      db.prepare("DELETE FROM login_attempts WHERE timestamp < datetime('now', '-15 seconds')").run();
      
      // Check if limit reached
      const recentAttempts = db.prepare("SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND timestamp >= datetime('now', '-15 seconds')").get(clientIp) as {count: number};
      if (recentAttempts.count >= 5) {
        db.prepare("INSERT OR REPLACE INTO blocked_ips (ip, blocked_at) VALUES (?, datetime('now'))").run(clientIp);
        logAction('block', 'ip', clientIp, `IP blocked due to 5 failed login attempts in 15s`, null, 'System', clientIp);
        return res.status(401).json({ error: "IP_BLOCKED", message: "Your IP has been blocked due to too many failed attempts. Please try again in 15 minutes." });
      }
      
      return res.status(401).json({ error: "Invalid credentials" });
    };

    // 1. Check User Existence
    if (!user) {
      return handleFailedLogin("User not found");
    }

    // 2. Check Password
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return handleFailedLogin("Invalid Password", user.id, user.name);
    }

    // Clear failed attempts on successful password match
    db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(clientIp);

    // 3. Check Account Status (Deleted)
    if (user.deleted_at) {
      logAction('login_failed', 'user', String(user.id), `Login failed for user: ${user.name} (Account Deleted)`, user.id, user.name, clientIp);
      return res.status(400).json({ error: "Account Deleted" });
    }

    // 4. Check Account Status (Disabled)
    if (user.is_disabled) {
      logAction('login_failed', 'user', String(user.id), `Login failed for user: ${user.name} (Account Disabled)`, user.id, user.name, clientIp);
      return res.status(400).json({ error: "Account Disabled" });
    }

    // 5. IP Whitelist Check
    try {
      const ipWhitelistSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'ip_whitelist'").get() as any;
      if (ipWhitelistSetting) {
        const parsed = JSON.parse(ipWhitelistSetting.value);
        const enabled = parsed.enabled;
        if (enabled) {
          // Check global whitelist
          if (parsed.value && parsed.value.length > 0) {
            const allowedIps = parsed.value.split(';').map((ip: string) => ip.trim());
            if (!allowedIps.includes(clientIp)) {
              logAction('login_failed', 'user', String(user.id), `Login failed for user: ${user.name} (IP not whitelisted: ${clientIp})`, user.id, user.name, clientIp);
              return res.status(400).json({ error: "Account Access Denied" });
            }
          }
        }
      }
    } catch (e) {
      console.error("Error in IP whitelist check:", e);
    }

    logAction('login', 'user', String(user.id), `User logged in: ${user.name}`, user.id, user.name, clientIp);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, is_superadmin: !!user.is_superadmin } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "An unexpected error occurred during login." });
  }
});

router.get("/me", authenticate, (req: any, res) => {
  // Return the user object populated by the authenticate middleware
  // This ensures default permissions are applied if missing in DB
  res.json({ user: req.user });
});

export default router;
