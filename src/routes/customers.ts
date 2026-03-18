import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";
import multer from "multer";
import * as xlsx from "xlsx";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/", authenticate, async (req: any, res) => {
  const { pipeline_stage, page, limit = 50, highlight } = req.query;
  let query = "SELECT * FROM customers WHERE deleted_at IS NULL";
  let countQuery = "SELECT COUNT(*) as total FROM customers WHERE deleted_at IS NULL";
  let params: any[] = [];
  
  if (pipeline_stage) {
    query += " AND pipeline_stage = ?";
    countQuery += " AND pipeline_stage = ?";
    params.push(pipeline_stage);
  }
  
  query += " ORDER BY create_date DESC";
  
  let total = 0;
  let targetPage = Number(page) || 1;

  if (highlight) {
    // Find the row number of the highlighted customer to determine its page
    const allIdsQuery = `SELECT id FROM customers WHERE deleted_at IS NULL ${pipeline_stage ? "AND pipeline_stage = ?" : ""} ORDER BY create_date DESC`;
    const allIdsParams = pipeline_stage ? [pipeline_stage] : [];
    const allIds = await db.prepare(allIdsQuery).all(...allIdsParams) as { id: number }[];
    
    const index = allIds.findIndex(c => c.id === Number(highlight));
    if (index !== -1) {
      targetPage = Math.floor(index / Number(limit)) + 1;
    }
  }

  if (page || highlight) {
    const totalResult = await db.prepare(countQuery).get(...params) as { total: number };
    total = totalResult.total;
    
    const offset = (targetPage - 1) * Number(limit);
    query += " LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);
  }
  
  const customers = await db.prepare(query).all(...params) as any[];
  
  const parsedCustomers = customers.map(c => {
    let customData = {};
    try {
      if (c.custom_data) customData = JSON.parse(c.custom_data);
    } catch (e) {}
    
    const { custom_data, ...rest } = c;
    return { ...rest, ...customData };
  });
  
  if (page || highlight) {
    res.json({
      customers: parsedCustomers,
      total,
      page: targetPage,
      limit: Number(limit)
    });
  } else {
    res.json(parsedCustomers);
  }
});

// Get deleted customers (Trash)
router.get("/trash", authenticate, async (req: any, res) => {
  const customers = await db.prepare("SELECT * FROM customers WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all() as any[];
  const parsedCustomers = customers.map(c => {
    let customData = {};
    try {
      if (c.custom_data) customData = JSON.parse(c.custom_data);
    } catch (e) {}
    
    const { custom_data, ...rest } = c;
    return { ...rest, ...customData };
  });
  res.json(parsedCustomers);
});

// Restore deleted customer
router.post("/:id/restore", authenticate, async (req: any, res) => {
  try {
    const currentCustomer = await db.prepare("SELECT customer_name FROM customers WHERE id = ?").get(req.params.id) as any;
    if (!currentCustomer) return res.status(404).json({ error: "Customer not found" });

    await db.prepare("UPDATE customers SET deleted_at = NULL WHERE id = ?").run(req.params.id);
    logAction('restore', 'customer', req.params.id, `Restored customer: ${currentCustomer.customer_name}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/", authenticate, async (req: any, res) => {
  try {
    const data = req.body;
    const createDate = data.create_date || new Date().toISOString().split('T')[0];
    
    // Extract custom data
    const standardKeys = ['create_date', 'customer_name', 'type', 'content', 'feedback_from_customer', 'last_update', 'status', 'completed_date', 'pro_account', 'sale_owner', 'sale_updated', 'other', 'pipeline_stage', 'priority', 'next_follow_up_date', 'tags', 'status_in_production', 'date_to_production', 'date_have_traffic'];
    const customData: any = {};
    Object.keys(data).forEach(key => {
      if (!standardKeys.includes(key) && key !== 'id') {
        customData[key] = data[key];
      }
    });

    const stmt = db.prepare(`
      INSERT INTO customers (
        create_date, customer_name, type, content, feedback_from_customer,
        last_update, status, completed_date, pro_account, sale_owner,
        sale_updated, other, pipeline_stage, priority, next_follow_up_date, tags,
        status_in_production, date_to_production, date_have_traffic, is_imported, stage_updated_at, custom_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);
    
    const result = await stmt.run(
      createDate,
      data.customer_name || 'Unnamed Customer',
      data.type || '',
      data.content || '',
      data.feedback_from_customer || '',
      data.last_update || new Date().toISOString().split('T')[0],
      data.status || 'Testing',
      data.completed_date || null,
      data.pro_account || 'No',
      data.sale_owner || req.user.name,
      data.sale_updated || '',
      data.other || '',
      data.pipeline_stage || 'NewIntegration',
      data.priority || 'Med',
      data.next_follow_up_date || null,
      data.tags || '',
      data.status_in_production || '',
      data.date_to_production || null,
      data.date_have_traffic || null,
      new Date().toISOString(),
      JSON.stringify(customData)
    );
    
    logAction('create', 'customer', String(result.lastInsertRowid), `Created customer: ${data.customer_name || 'Unnamed'}`, req.user.id, req.user.name, getClientIp(req));
    res.json({ id: result.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", authenticate, async (req: any, res) => {
  try {
    const data = req.body;
    
    // Extract custom data
    const standardKeys = ['create_date', 'customer_name', 'type', 'content', 'feedback_from_customer', 'last_update', 'status', 'completed_date', 'pro_account', 'sale_owner', 'sale_updated', 'other', 'pipeline_stage', 'priority', 'next_follow_up_date', 'tags', 'status_in_production', 'date_to_production', 'date_have_traffic'];
    const customData: any = {};
    Object.keys(data).forEach(key => {
      if (!standardKeys.includes(key) && key !== 'id') {
        customData[key] = data[key];
      }
    });

    // Check if pipeline_stage changed or if stage_updated_at was explicitly changed
    const currentCustomer = await db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id) as any;
    if (!currentCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    // Calculate changed fields
    const changedFields = [];
    for (const key in data) {
      if (key !== 'id' && data[key] !== currentCustomer[key]) {
        changedFields.push(`${key}: ${currentCustomer[key]} -> ${data[key]}`);
      }
    }
    
    const isMove = currentCustomer.pipeline_stage !== data.pipeline_stage || (data.stage_updated_at && data.stage_updated_at !== currentCustomer.stage_updated_at);

    let stmt;
    if (isMove) {
      stmt = db.prepare(`
        UPDATE customers SET
          create_date = ?, customer_name = ?, type = ?, content = ?, feedback_from_customer = ?,
          last_update = ?, status = ?, completed_date = ?, pro_account = ?,
          sale_owner = ?, sale_updated = ?, other = ?, pipeline_stage = ?,
          priority = ?, next_follow_up_date = ?, tags = ?,
          status_in_production = ?, date_to_production = ?, date_have_traffic = ?,
          stage_updated_at = ?, custom_data = ?
        WHERE id = ?
      `);
      await stmt.run(
        data.create_date, data.customer_name, data.type, data.content, data.feedback_from_customer,
        data.last_update, data.status, data.completed_date, data.pro_account,
        data.sale_owner, data.sale_updated, data.other, data.pipeline_stage,
        data.priority, data.next_follow_up_date, data.tags,
        data.status_in_production, data.date_to_production, data.date_have_traffic,
        data.stage_updated_at || new Date().toISOString(),
        JSON.stringify(customData),
        req.params.id
      );
      
      if (currentCustomer.pipeline_stage !== data.pipeline_stage) {
        const action = ['Delay', 'Lost', 'Production'].includes(data.pipeline_stage) ? 'integration' : 'move';
        logAction(action, 'customer', req.params.id, `Moved customer: ${data.customer_name} from ${currentCustomer.pipeline_stage} to ${data.pipeline_stage}.`, req.user.id, req.user.name, getClientIp(req));
      } else {
        logAction('update', 'customer', req.params.id, `Updated move date for customer: ${data.customer_name} in ${data.pipeline_stage}.`, req.user.id, req.user.name, getClientIp(req));
      }
    } else {
      stmt = db.prepare(`
        UPDATE customers SET
          create_date = ?, customer_name = ?, type = ?, content = ?, feedback_from_customer = ?,
          last_update = ?, status = ?, completed_date = ?, pro_account = ?,
          sale_owner = ?, sale_updated = ?, other = ?, pipeline_stage = ?,
          priority = ?, next_follow_up_date = ?, tags = ?,
          status_in_production = ?, date_to_production = ?, date_have_traffic = ?,
          custom_data = ?
        WHERE id = ?
      `);
      await stmt.run(
        data.create_date, data.customer_name, data.type, data.content, data.feedback_from_customer,
        data.last_update, data.status, data.completed_date, data.pro_account,
        data.sale_owner, data.sale_updated, data.other, data.pipeline_stage,
        data.priority, data.next_follow_up_date, data.tags,
        data.status_in_production, data.date_to_production, data.date_have_traffic,
        JSON.stringify(customData),
        req.params.id
      );
      
      logAction('update', 'customer', req.params.id, `Updated customer: ${data.customer_name}. Changed fields: ${changedFields.join(', ')}`, req.user.id, req.user.name, getClientIp(req));
    }
    
    res.json({ success: true });
  } catch (e: any) {
    console.error("Error updating customer:", e);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", authenticate, async (req: any, res) => {
  const currentCustomer = await db.prepare("SELECT customer_name FROM customers WHERE id = ?").get(req.params.id) as any;
  await db.prepare("UPDATE customers SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  
  logAction('delete', 'customer', req.params.id, `Soft deleted customer: ${currentCustomer?.customer_name || 'Unknown'}`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

router.delete("/:id/permanent", authenticate, async (req: any, res) => {
  const currentCustomer = await db.prepare("SELECT customer_name FROM customers WHERE id = ?").get(req.params.id) as any;
  await db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
  
  logAction('delete_permanent', 'customer', req.params.id, `Permanently deleted customer: ${currentCustomer?.customer_name || 'Unknown'}`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

router.delete("/trash/clear", authenticate, async (req: any, res) => {
  await db.prepare("DELETE FROM customers WHERE deleted_at IS NOT NULL").run();
  logAction('clear_trash', 'customer', null, `Cleared customer trash`, req.user.id, req.user.name, getClientIp(req));
  res.json({ success: true });
});

export default router;
