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

  let query = "SELECT * FROM kpi_records WHERE deleted_at IS NULL";
  let countQuery = "SELECT COUNT(*) as count FROM kpi_records WHERE deleted_at IS NULL";
  let params: any[] = [];

  if (month) {
    query += " AND strftime('%Y-%m', create_date) = ?";
    countQuery += " AND strftime('%Y-%m', create_date) = ?";
    params.push(month);
  }

  if (search) {
    const searchParam = `%${search}%`;
    query += " AND (company LIKE ? OR contact_name LIKE ? OR problem LIKE ?)";
    countQuery += " AND (company LIKE ? OR contact_name LIKE ? OR problem LIKE ?)";
    params.push(searchParam, searchParam, searchParam);
  }

  const total = await db.prepare(countQuery).get(...params) as any;
  
  query += " ORDER BY create_date DESC, id DESC LIMIT ? OFFSET ?";
  const records = await db.prepare(query).all(...params, pageSize, offset) as any[];

  const months = await db.prepare("SELECT DISTINCT strftime('%Y-%m', create_date) as month FROM kpi_records WHERE deleted_at IS NULL ORDER BY month DESC").all() as any[];

  res.json({
    records,
    total: total.count,
    pages: Math.ceil(total.count / pageSize),
    months: months.map(m => m.month)
  });
});

router.post("/", authenticate, async (req: any, res) => {
  try {
    const { create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO kpi_records (
        create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.run(create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day || 'Y');
    res.json({ id: result.lastInsertRowid });
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
      INSERT INTO kpi_records (
        create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        parseDate(row.Date || row.create_date),
        row.Company || row.company || '',
        row.Contact || row.contact_name || '',
        row.Via || row.contact_by || 'Telegram',
        row.Problem || row.problem || '',
        row.Type || row.problem_type || 'Support',
        row["Resp. Time"] || row.response_time || '5mn',
        row["Res. Time"] || row.resolve_time || '15mn',
        row.Solution || row.solution || '',
        row["Done?"] || row.resolved_same_day || 'Y'
      );
    }
    
    fs.unlinkSync(req.file.path);
    logAction('import', 'kpi', null, `Imported ${data.length} KPI records`, req.user.id, req.user.name, getClientIp(req));
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
      INSERT INTO kpi_records (
        create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await db.transaction(async () => {
      for (const row of data) {
        await stmt.run(
          row.create_date || new Date().toISOString().split('T')[0],
          row.company || '',
          row.contact_name || '',
          row.contact_by || 'Telegram',
          row.problem || '',
          row.problem_type || 'Support',
          row.response_time || '5mn',
          row.resolve_time || '15mn',
          row.solution || '',
          row.resolved_same_day || 'Y'
        );
      }
    })();

    logAction('import', 'kpi', null, `Imported ${data.length} KPI records via Excel`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, count: data.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/trash", authenticate, async (req: any, res) => {
  const { page = 1, search } = req.query;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  let query = "SELECT * FROM kpi_records WHERE deleted_at IS NOT NULL";
  let countQuery = "SELECT COUNT(*) as count FROM kpi_records WHERE deleted_at IS NOT NULL";
  let params: any[] = [];

  if (search) {
    const searchParam = `%${search}%`;
    query += " AND (company LIKE ? OR contact_name LIKE ? OR problem LIKE ?)";
    countQuery += " AND (company LIKE ? OR contact_name LIKE ? OR problem LIKE ?)";
    params.push(searchParam, searchParam, searchParam);
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
    await db.prepare("UPDATE kpi_records SET deleted_at = NULL WHERE id = ?").run(req.params.id);
    logAction('restore', 'kpi', req.params.id, 'Restored KPI record', req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id/force", authenticate, async (req: any, res) => {
  try {
    await db.prepare("DELETE FROM kpi_records WHERE id = ?").run(req.params.id);
    logAction('delete_permanent', 'kpi', req.params.id, 'Permanently deleted KPI record', req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/trash/empty", authenticate, async (req: any, res) => {
  try {
    await db.prepare("DELETE FROM kpi_records WHERE deleted_at IS NOT NULL").run();
    logAction('empty_trash', 'kpi', null, 'Emptied KPI trash', req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/export", authenticate, async (req: any, res) => {
  const { month } = req.query;
  let query = "SELECT * FROM kpi_records WHERE deleted_at IS NULL";
  let params: any[] = [];
  
  if (month) {
    query += " AND strftime('%Y-%m', create_date) = ?";
    params.push(month);
  }
  query += " ORDER BY create_date DESC";
  
  const records = await db.prepare(query).all(...params) as any[];
  
  const worksheet = xlsx.utils.json_to_sheet(records.map(r => {
    let create_date = r.create_date;
    if (create_date && typeof create_date === 'string' && create_date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      try {
        const d = new Date(create_date);
        if (!isNaN(d.getTime())) create_date = d.toISOString().split('T')[0];
      } catch (e) {}
    }
    return {
      create_date,
      company: r.company,
      contact_name: r.contact_name,
      contact_by: r.contact_by,
      problem: r.problem,
      problem_type: r.problem_type,
      solution: r.solution,
      resolved_same_day: r.resolved_same_day,
      response_time: r.response_time,
      resolve_time: r.resolve_time
    };
  }));
  
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "KPI Records");
  
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="KPI_Report_${month || 'All'}.xlsx"`);
  res.send(buffer);
});

router.get("/:id", authenticate, async (req: any, res) => {
  try {
    const record = await db.prepare("SELECT * FROM kpi_records WHERE id = ?").get(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", authenticate, async (req: any, res) => {
  try {
    const { create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day } = req.body;
    
    const stmt = db.prepare(`
      UPDATE kpi_records SET
        create_date = ?, company = ?, contact_name = ?, contact_by = ?, problem = ?, problem_type = ?, response_time = ?, resolve_time = ?, solution = ?, resolved_same_day = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    await stmt.run(create_date, company, contact_name, contact_by, problem, problem_type, response_time, resolve_time, solution, resolved_same_day, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", authenticate, async (req: any, res) => {
  await db.prepare("UPDATE kpi_records SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  logAction('delete', 'kpi', req.params.id, 'Soft deleted KPI record', req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

export default router;
