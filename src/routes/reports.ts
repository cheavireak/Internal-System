import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();

// Get support reports
router.get("/support", authenticate, (req: any, res) => {
  const reports = db.prepare("SELECT * FROM support_reports WHERE type = 'support' ORDER BY date DESC").all();
  res.json(reports);
});

// Get internal test reports
router.get("/internal", authenticate, (req: any, res) => {
  const reports = db.prepare("SELECT * FROM support_reports WHERE type = 'internal' ORDER BY date DESC").all();
  res.json(reports);
});

// Create report
router.post("/", authenticate, (req: any, res) => {
  const { date, task, time, result, type } = req.body;
  const stmt = db.prepare("INSERT INTO support_reports (date, task, time, result, type) VALUES (?, ?, ?, ?, ?)");
  stmt.run(date, task, time, result, type);
  logAction('create', 'report', null, `Created ${type} report`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

// Get task reports
router.get("/tasks", authenticate, (req: any, res) => {
  const reports = db.prepare("SELECT * FROM task_reports ORDER BY created_at DESC").all();
  res.json(reports);
});

// Create task report
router.post("/tasks", authenticate, (req: any, res) => {
  const { task_assign, time, result } = req.body;
  const stmt = db.prepare("INSERT INTO task_reports (task_assign, time, result, created_at) VALUES (?, ?, ?, ?)");
  stmt.run(task_assign, time, result, new Date().toISOString());
  logAction('create', 'task_report', null, `Created task report`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

// Get internal reports
router.get("/internal_reports", authenticate, (req: any, res) => {
  const reports = db.prepare("SELECT * FROM internal_reports ORDER BY created_at DESC").all();
  res.json(reports);
});

// Create internal report
router.post("/internal_reports", authenticate, (req: any, res) => {
  const { date, action_tasks, result } = req.body;
  const stmt = db.prepare("INSERT INTO internal_reports (date, action_tasks, result, created_at) VALUES (?, ?, ?, ?)");
  stmt.run(date, action_tasks, result, new Date().toISOString());
  logAction('create', 'internal_report', null, `Created internal report`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

export default router;
