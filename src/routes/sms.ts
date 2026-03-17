import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

// Helper to calculate SMS parts
function calculateSmsParts(text: string): number {
  // Check if text contains any non-GSM-7 characters (Unicode)
  // A simple check: if any char code is > 127, it's likely Unicode.
  // Actually, GSM-7 has specific characters, but checking for > 127 is a safe approximation for Khmer, Korean, Chinese.
  const isUnicode = [...text].some(char => char.charCodeAt(0) > 127);
  const length = text.length;

  if (isUnicode) {
    if (length <= 70) return 1;
    return Math.ceil(length / 67);
  } else {
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
  }
}

// Get SMS Config
router.get("/config", authenticate, (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  const configRow = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_config'").get() as any;
  let config = { url: "https://sandbox.mekongsms.com/api/postsms.aspx", username: "", pass: "", int: "0" };
  if (configRow) {
    config = JSON.parse(configRow.value);
  }
  res.json(config);
});

// Get SMS Test Config
router.get("/config-test", authenticate, (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  const configRow = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_test_config'").get() as any;
  let config = { 
    url: "", 
    username: "", 
    password: "", 
    messageType: "", 
    gateways: [
      "SMPP Gateway GTS",
      "SMPP Gateway Alicloud",
      "SMPP Gateway Braxis",
      "SMPP Gateway CHUNC",
      "SMPP Gateway CHUNC ALI",
      "SMPP Gateway CHUNC CU",
      "SMPP Gateway Fallback",
      "SMPP Gateway Gapit",
      "SMPP Gateway MacroKiosk",
      "SMPP Gateway MacroKiosk MKT",
      "SMPP Gateway MacroKiosk Pro",
      "SMPP Gateway Peacom",
      "SMPP Gateway Seatel",
      "SMPP Gateway Tyntec"
    ] 
  };
  if (configRow) {
    config = JSON.parse(configRow.value);
  }
  res.json(config);
});

// Save SMS Config
router.post("/config", authenticate, (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  const { url, username, pass, int } = req.body;
  const config = { url, username, pass, int };
  
  db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('sms_config', ?)").run(JSON.stringify(config));
  logAction('update', 'sms_config', null, `Updated SMS Configuration`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

// Save SMS Test Config
router.post("/config-test", authenticate, (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  const { url, username, password, messageType, gateways } = req.body;
  const config = { url, username, password, messageType, gateways };
  
  db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('sms_test_config', ?)").run(JSON.stringify(config));
  logAction('update', 'sms_test_config', null, `Updated SMS Test Configuration`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

// Send SMS
router.post("/send", authenticate, async (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  
  const { sender, gsm, smstext } = req.body;
  
  if (!sender || !gsm || !smstext) {
    return res.status(400).json({ error: "Sender, phone number, and content are required." });
  }

  const configRow = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_config'").get() as any;
  if (!configRow) {
    return res.status(400).json({ error: "SMS configuration is missing. Please configure it first." });
  }
  
  const config = JSON.parse(configRow.value);
  
  try {
    const params = new URLSearchParams();
    params.append('username', config.username);
    params.append('pass', config.pass);
    params.append('sender', sender);
    params.append('smstext', smstext);
    params.append('gsm', gsm);
    if (config.int) {
      params.append('int', config.int);
    }

    const response = await fetch(config.url, {
      method: 'POST',
      body: params
    });

    const resultText = await response.text();
    
    // Parse result: "0" means success, followed by message ID or just "0[Success]"
    // Actually API says: "0 Successful, sent message ID is the return value" or "0[Success]"
    if (resultText.startsWith("0")) {
      const messageId = resultText; // Store the whole return value or extract ID
      const smsParts = calculateSmsParts(smstext);
      const time = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO sms_logs (time, content, phone_number, message_id, sms_parts, sender)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(time, smstext, gsm, messageId, smsParts, sender);
      
      logAction('send', 'sms', null, `Sent SMS to ${gsm}`, req.user.id, req.user.name, getClientIp(req));
      
      res.json({ success: true, messageId, parts: smsParts });
    } else {
      res.status(400).json({ error: `Failed to send SMS: ${resultText}` });
    }
  } catch (error: any) {
    console.error("SMS Send Error:", error);
    res.status(500).json({ error: "Internal server error while sending SMS." });
  }
});

// Send SMS (Test Route)
router.post("/send-test", authenticate, async (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  
  const { sender, gsm, smstext, gateway } = req.body;
  
  if (!sender || !gsm || !smstext || !gateway) {
    return res.status(400).json({ error: "Sender, phone number, content, and gateway are required." });
  }

  const configRow = db.prepare("SELECT value FROM system_settings WHERE key = 'sms_test_config'").get() as any;
  if (!configRow) {
    return res.status(400).json({ error: "SMS Test configuration is missing. Please configure it first." });
  }
  
  const config = JSON.parse(configRow.value);
  
  try {
    const params = new URLSearchParams();
    params.append('username', config.username);
    params.append('password', config.password);
    params.append('message-type', config.messageType);
    params.append('to', gsm);
    params.append('from', sender);
    params.append('gateway', gateway);
    params.append('message', smstext);

    // Using POST method as per working implementation
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const resultText = await response.text();
    
    // Assuming 200 OK means success for this test route, or we can just log it
    if (response.ok && !resultText.includes("ERROR")) {
      const messageId = resultText || `TEST-${Date.now()}`;
      const smsParts = calculateSmsParts(smstext);
      const time = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO sms_logs (time, content, phone_number, message_id, sms_parts, sender)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(time, smstext, gsm, messageId, smsParts, sender);
      
      logAction('send', 'sms_test', null, `Sent Test SMS to ${gsm} via ${gateway}`, req.user.id, req.user.name, getClientIp(req));
      
      res.json({ success: true, messageId, parts: smsParts, result: resultText });
    } else {
      res.status(400).json({ error: `Failed to send SMS: ${resultText}` });
    }
  } catch (error: any) {
    console.error("SMS Test Send Error:", error);
    res.status(500).json({ error: "Internal server error while sending test SMS." });
  }
});

// Get SMS Logs
router.get("/logs", authenticate, (req: any, res) => {
  if (!req.user.is_superadmin && !req.user.permissions?.menus?.includes('SMS')) {
    return res.status(401).json({ error: "Access denied" });
  }
  const logs = db.prepare("SELECT * FROM sms_logs ORDER BY time DESC").all();
  res.json(logs);
});

export default router;
