import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";
import * as xlsx from "xlsx";
import multer from "multer";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/", authenticate, async (req: any, res) => {
  const { month, page = 1, search } = req.query;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  let query = "SELECT * FROM internal_reports WHERE deleted_at IS NULL";
  let countQuery = "SELECT COUNT(*) as count FROM internal_reports WHERE deleted_at IS NULL";
  let params: any[] = [];

  if (month) {
    query += " AND strftime('%Y-%m', date) = ?";
    countQuery += " AND strftime('%Y-%m', date) = ?";
    params.push(month);
  }

  if (search) {
    const searchParam = `%${search}%`;
    query += " AND (action_tasks LIKE ? OR result LIKE ?)";
    countQuery += " AND (action_tasks LIKE ? OR result LIKE ?)";
    params.push(searchParam, searchParam);
  }

  const total = await db.prepare(countQuery).get(...params) as any;
  
  query += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?";
  const records = await db.prepare(query).all(...params, pageSize, offset) as any[];

  const months = await db.prepare("SELECT DISTINCT strftime('%Y-%m', date) as month FROM internal_reports WHERE deleted_at IS NULL ORDER BY month DESC").all() as any[];

  res.json({
    records,
    total: total.count,
    pages: Math.ceil(total.count / pageSize),
    months: months.map(m => m.month)
  });
});

router.post("/", authenticate, async (req: any, res) => {
  try {
    const { date, action_tasks, result } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO internal_reports (
        date, action_tasks, result
      ) VALUES (?, ?, ?)
    `);
    
    const dbResult = await stmt.run(date, action_tasks, result);
    res.json({ id: dbResult.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/import", authenticate, upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet) as any[];
    
    const stmt = db.prepare(`
      INSERT INTO internal_reports (
        date, action_tasks, result
      ) VALUES (?, ?, ?)
    `);
    
    const parseDate = (val: any) => {
      if (!val) return new Date().toISOString().split('T')[0];
      if (val instanceof Date) {
        const offset = val.getTimezoneOffset() * 60000;
        return new Date(val.getTime() - offset).toISOString().split('T')[0];
      }
      if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
      }
      if (typeof val === 'string') {
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }
      return String(val);
    };

    for (const row of data) {
      await stmt.run(
        parseDate(row.Date || row.date),
        row["Action/Tasks"] || row.action_tasks || '',
        row.Result || row.result || ''
      );
    }
    
    fs.unlinkSync(req.file.path);
    logAction('import', 'internal_report', null, `Imported ${data.length} Internal Reports`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, count: data.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/import-json", authenticate, async (req: any, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: "Invalid data format" });

    const stmt = db.prepare(`
      INSERT INTO internal_reports (
        date, action_tasks, result
      ) VALUES (?, ?, ?)
    `);

    await db.transaction(async () => {
      for (const row of data) {
        await stmt.run(
          row.date || new Date().toISOString().split('T')[0],
          row.action_tasks || '',
          row.result || ''
        );
      }
    })();

    logAction('import', 'internal_report', null, `Imported ${data.length} Internal Reports via Excel`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, count: data.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/trash", authenticate, async (req: any, res) => {
  const { page = 1, search } = req.query;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  let query = "SELECT * FROM internal_reports WHERE deleted_at IS NOT NULL";
  let countQuery = "SELECT COUNT(*) as count FROM internal_reports WHERE deleted_at IS NOT NULL";
  let params: any[] = [];

  if (search) {
    const searchParam = `%${search}%`;
    query += " AND (action_tasks LIKE ? OR result LIKE ?)";
    countQuery += " AND (action_tasks LIKE ? OR result LIKE ?)";
    params.push(searchParam, searchParam);
  }

  const total = await db.prepare(countQuery).get(...params) as any;
  
  query += " ORDER BY deleted_at DESC LIMIT ? OFFSET ?";
  const records = await db.prepare(query).all(...params, pageSize, offset) as any[];

  res.json({
    records,
    total: total.count,
    pages: Math.ceil(total.count / pageSize)
  });
});

router.post("/:id/restore", authenticate, async (req: any, res) => {
  try {
    await db.prepare("UPDATE internal_reports SET deleted_at = NULL WHERE id = ?").run(req.params.id);
    logAction('restore', 'internal_report', req.params.id, 'Restored Internal Report', req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id/force", authenticate, async (req: any, res) => {
  try {
    await db.prepare("DELETE FROM internal_reports WHERE id = ?").run(req.params.id);
    logAction('delete_permanent', 'internal_report', req.params.id, 'Permanently deleted Internal Report', req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/trash/empty", authenticate, async (req: any, res) => {
  try {
    await db.prepare("DELETE FROM internal_reports WHERE deleted_at IS NOT NULL").run();
    logAction('empty_trash', 'internal_report', null, 'Emptied Internal Report trash', req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/export", authenticate, async (req: any, res) => {
  const { month } = req.query;
  let query = "SELECT * FROM internal_reports WHERE deleted_at IS NULL";
  let params: any[] = [];
  
  if (month) {
    query += " AND strftime('%Y-%m', date) = ?";
    params.push(month);
  }
  query += " ORDER BY date DESC";
  
  const records = await db.prepare(query).all(...params) as any[];
  
  const worksheet = xlsx.utils.json_to_sheet(records.map(r => ({
    Date: r.date,
    'Action/Tasks': r.action_tasks,
    Result: r.result
  })));
  
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Internal Reports");
  
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Internal_Report_${month || 'All'}.xlsx"`);
  res.send(buffer);
});

router.get("/:id", authenticate, async (req: any, res) => {
  try {
    const record = await db.prepare("SELECT * FROM internal_reports WHERE id = ?").get(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", authenticate, async (req: any, res) => {
  try {
    const { date, action_tasks, result } = req.body;
    
    const stmt = db.prepare(`
      UPDATE internal_reports SET
        date = ?, action_tasks = ?, result = ?
      WHERE id = ?
    `);
    
    await stmt.run(date, action_tasks, result, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", authenticate, async (req: any, res) => {
  await db.prepare("UPDATE internal_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  logAction('delete', 'internal_report', req.params.id, 'Soft deleted Internal Report', req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

export default router;