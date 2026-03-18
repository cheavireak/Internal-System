import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

router.get("/:stage", authenticate, async (req: any, res) => {
  const stage = req.params.stage;
  const row = await db.prepare("SELECT columns_json FROM column_settings WHERE pipeline_stage = ?").get(stage) as any;
  if (row) {
    res.json(JSON.parse(row.columns_json));
  } else {
    res.json(null);
  }
});

router.post("/:stage", authenticate, async (req: any, res) => {
  const user = req.user;
  let permissions = {};
  try {
    if (user.permissions) permissions = JSON.parse(user.permissions);
  } catch (e) {}
  
  const canManageColumns = (permissions as any).can_manage_columns ?? user.role === 'admin';
  if (!canManageColumns) {
    return res.status(401).json({ error: "Forbidden: You do not have permission to manage columns." });
  }

  const stage = req.params.stage;
  const columns = req.body;
  
  const existing = await db.prepare("SELECT id FROM column_settings WHERE pipeline_stage = ?").get(stage) as any;
  if (existing) {
    await db.prepare("UPDATE column_settings SET columns_json = ? WHERE pipeline_stage = ?").run(JSON.stringify(columns), stage);
  } else {
    await db.prepare("INSERT INTO column_settings (pipeline_stage, columns_json) VALUES (?, ?)").run(stage, JSON.stringify(columns));
  }

  // Update hidden state for other stages
  const allSettings = await db.prepare("SELECT pipeline_stage, columns_json FROM column_settings WHERE pipeline_stage != ?").all(stage) as any[];
  for (const setting of allSettings) {
    let otherColumns = JSON.parse(setting.columns_json);
    let changed = false;
    for (const col of columns) {
      const otherCol = otherColumns.find((c: any) => c.key === col.key);
      if (otherCol && otherCol.hidden !== col.hidden) {
        otherCol.hidden = col.hidden;
        changed = true;
      }
    }
    if (changed) {
      await db.prepare("UPDATE column_settings SET columns_json = ? WHERE pipeline_stage = ?").run(JSON.stringify(otherColumns), setting.pipeline_stage);
    }
  }

  logAction('update', 'system', null, `Updated columns for stage: ${stage}`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

export default router;
