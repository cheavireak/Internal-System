import { db } from "../db.js";

// Helper for server-side logging
export const logAction = (action: string, entity: string, entityId: string | null, details: string, userId: number | null, userName: string | null, ipAddress: string | null = null) => {
  try {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, action, entity, entityId, details, userId, userName, timestamp, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, action, entity, entityId, details, userId, userName, timestamp, ipAddress);
  } catch (e) {
    console.error("Failed to log action:", e);
  }
};
