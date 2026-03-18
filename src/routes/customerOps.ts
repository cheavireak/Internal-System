import express from "express";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import * as xlsx from "xlsx";
import multer from "multer";
import fs from "fs";
import { logAction } from "../utils/audit.js";
import { getClientIp } from "../utils/ip.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/summary", authenticate, async (req: any, res) => {
  const { startDate, endDate } = req.query;
  const customers = await db.prepare("SELECT id, customer_name, pipeline_stage, create_date, last_update, is_imported, stage_updated_at FROM customers WHERE deleted_at IS NULL").all() as any[];
  console.log("DEBUG: Summary route - customers count:", customers.length);

  const intervals: any[] = [];
  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    let currentStart = new Date(rangeStart);
    currentStart.setDate(currentStart.getDate() - currentStart.getDay());
    currentStart.setHours(0, 0, 0, 0);

    let finalEnd = new Date(rangeEnd);
    finalEnd.setDate(finalEnd.getDate() + (6 - finalEnd.getDay()));
    finalEnd.setHours(23, 59, 59, 999);

    while (currentStart < finalEnd) {
      let currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);
      currentEnd.setHours(23, 59, 59, 999);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${months[currentStart.getMonth()]} ${currentStart.getDate()} - ${months[currentEnd.getMonth()]} ${currentEnd.getDate()}`;

      intervals.push({
        start: new Date(currentStart),
        end: new Date(currentEnd),
        label,
        newIntegration: 0,
        toProduction: 0,
        delayProject: 0,
        lostLeads: 0,
        totalNewIntegration: 0,
        totalToProduction: 0,
        totalDelayProject: 0,
        totalLostLeads: 0,
        newIntegrationCustomers: [],
        toProductionCustomers: [],
        delayProjectCustomers: [],
        lostLeadsCustomers: []
      });

      currentStart.setDate(currentStart.getDate() + 7);
    }
  } else {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToSaturday = 6 - currentDay;
    
    const currentWeekEnd = new Date(now);
    currentWeekEnd.setDate(now.getDate() + daysToSaturday);
    currentWeekEnd.setHours(23, 59, 59, 999);

    const NUM_WEEKS = 4;

    for (let i = NUM_WEEKS - 1; i >= 0; i--) {
      const end = new Date(currentWeekEnd);
      end.setDate(currentWeekEnd.getDate() - (i * 7));
      
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}`;

      intervals.push({
        start,
        end,
        label,
        newIntegration: 0,
        toProduction: 0,
        delayProject: 0,
        lostLeads: 0,
        totalNewIntegration: 0,
        totalToProduction: 0,
        totalDelayProject: 0,
        totalLostLeads: 0,
        newIntegrationCustomers: [],
        toProductionCustomers: [],
        delayProjectCustomers: [],
        lostLeadsCustomers: []
      });
    }
  }

  let totalNew = 0, totalProd = 0, totalDelay = 0, totalLost = 0;

  let periodWeekly = {
    newIntegration: 0,
    delayProject: 0,
    lostLeads: 0,
    toProduction: 0
  };
  let periodDetails = {
    newIntegration: [] as any[],
    delayProject: [] as any[],
    lostLeads: [] as any[],
    toProduction: [] as any[]
  };

  customers.forEach(c => {
    if (!c.create_date) return;
    const createTime = new Date(c.create_date).getTime();
    const updateTime = new Date(c.last_update || c.create_date).getTime();
    
    const isImported = c.is_imported === 1;
    const stageUpdateTime = c.stage_updated_at ? new Date(c.stage_updated_at).getTime() : updateTime;
    const newIntegrationTime = c.stage_updated_at ? new Date(c.stage_updated_at).getTime() : createTime;
    
    // Is it a real move?
    const isRealMove = c.stage_updated_at ? true : (!isImported && (updateTime - createTime) > 10000);

    // If date range is provided, count cumulative totals up to the end of the range
    if (rangeStart && rangeEnd) {
      const rStart = rangeStart.getTime();
      const rEnd = rangeEnd.getTime();
      
      if (c.pipeline_stage === 'NewIntegration' && newIntegrationTime <= rEnd) totalNew++;
      if (c.pipeline_stage === 'SandboxToProduction' && stageUpdateTime <= rEnd) totalProd++;
      if (c.pipeline_stage === 'Delay' && stageUpdateTime <= rEnd) totalDelay++;
      if (c.pipeline_stage === 'Lost' && stageUpdateTime <= rEnd) totalLost++;

      // Calculate exact period movements
      if (c.pipeline_stage === 'NewIntegration') {
        const isNewIntMove = c.stage_updated_at ? true : !isImported;
        if (isNewIntMove && newIntegrationTime >= rStart && newIntegrationTime <= rEnd) {
          periodWeekly.newIntegration++;
          periodDetails.newIntegration.push({ id: c.id, name: c.customer_name, date: new Date(newIntegrationTime).toISOString() });
        }
      }
      if (c.pipeline_stage === 'SandboxToProduction' && isRealMove) {
        if (stageUpdateTime >= rStart && stageUpdateTime <= rEnd) {
          periodWeekly.toProduction++;
          periodDetails.toProduction.push({ id: c.id, name: c.customer_name, date: new Date(stageUpdateTime).toISOString() });
        }
      }
      if (c.pipeline_stage === 'Delay' && isRealMove) {
        if (stageUpdateTime >= rStart && stageUpdateTime <= rEnd) {
          periodWeekly.delayProject++;
          periodDetails.delayProject.push({ id: c.id, name: c.customer_name, date: new Date(stageUpdateTime).toISOString() });
        }
      }
      if (c.pipeline_stage === 'Lost' && isRealMove) {
        if (stageUpdateTime >= rStart && stageUpdateTime <= rEnd) {
          periodWeekly.lostLeads++;
          periodDetails.lostLeads.push({ id: c.id, name: c.customer_name, date: new Date(stageUpdateTime).toISOString() });
        }
      }
    } else {
      if (c.pipeline_stage === 'NewIntegration') totalNew++;
      if (c.pipeline_stage === 'SandboxToProduction') totalProd++;
      if (c.pipeline_stage === 'Delay') totalDelay++;
      if (c.pipeline_stage === 'Lost') totalLost++;
    }

    intervals.forEach(w => {
      const wStart = w.start.getTime();
      const wEnd = w.end.getTime();

      // Interval movements
      if (c.pipeline_stage === 'NewIntegration') {
        const isNewIntMove = c.stage_updated_at ? true : !isImported;
        if (isNewIntMove && newIntegrationTime >= wStart && newIntegrationTime <= wEnd) {
          w.newIntegration++;
          w.newIntegrationCustomers.push({ id: c.id, name: c.customer_name, date: new Date(newIntegrationTime).toISOString() });
        }
      }
      if (c.pipeline_stage === 'SandboxToProduction' && isRealMove) {
        if (stageUpdateTime >= wStart && stageUpdateTime <= wEnd) {
          w.toProduction++;
          w.toProductionCustomers.push({ id: c.id, name: c.customer_name, date: new Date(stageUpdateTime).toISOString() });
        }
      }
      if (c.pipeline_stage === 'Delay' && isRealMove) {
        if (stageUpdateTime >= wStart && stageUpdateTime <= wEnd) {
          w.delayProject++;
          w.delayProjectCustomers.push({ id: c.id, name: c.customer_name, date: new Date(stageUpdateTime).toISOString() });
        }
      }
      if (c.pipeline_stage === 'Lost' && isRealMove) {
        if (stageUpdateTime >= wStart && stageUpdateTime <= wEnd) {
          w.lostLeads++;
          w.lostLeadsCustomers.push({ id: c.id, name: c.customer_name, date: new Date(stageUpdateTime).toISOString() });
        }
      }

      // Cumulative totals (including imports) up to this interval
      if (c.pipeline_stage === 'NewIntegration' && newIntegrationTime <= wEnd) w.totalNewIntegration++;
      if (c.pipeline_stage === 'SandboxToProduction' && stageUpdateTime <= wEnd) w.totalToProduction++;
      if (c.pipeline_stage === 'Delay' && stageUpdateTime <= wEnd) w.totalDelayProject++;
      if (c.pipeline_stage === 'Lost' && stageUpdateTime <= wEnd) w.totalLostLeads++;
    });
  });

  if (!rangeStart || !rangeEnd) {
    const lastInterval = intervals[intervals.length - 1];
    periodWeekly = {
      newIntegration: lastInterval.newIntegration,
      delayProject: lastInterval.delayProject,
      lostLeads: lastInterval.lostLeads,
      toProduction: lastInterval.toProduction
    };
    periodDetails = {
      newIntegration: lastInterval.newIntegrationCustomers,
      delayProject: lastInterval.delayProjectCustomers,
      lostLeads: lastInterval.lostLeadsCustomers,
      toProduction: lastInterval.toProductionCustomers
    };
  }

  res.json({
    totals: {
      newIntegration: totalNew,
      delayProject: totalDelay,
      lostLeads: totalLost,
      toProduction: totalProd
    },
    weekly: periodWeekly,
    weeklyDetails: periodDetails,
    graphData: intervals.map(w => ({
      date: w.label,
      newIntegration: w.newIntegration,
      toProduction: w.toProduction,
      delayProject: w.delayProject,
      lostLeads: w.lostLeads,
      totalNewIntegration: w.totalNewIntegration,
      totalToProduction: w.totalToProduction,
      totalDelayProject: w.totalDelayProject,
      totalLostLeads: w.totalLostLeads
    }))
  });
});

router.get("/export", authenticate, async (req: any, res) => {
  const customers = await db.prepare("SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY create_date DESC").all();
  
  const ws = xlsx.utils.json_to_sheet(customers);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Customers");
  
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  
  res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

router.post("/import-json", authenticate, async (req: any, res) => {
  const { data, pipelineStage } = req.body;
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: "Invalid data format" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO customers (
        create_date, customer_name, type, content, feedback_from_customer,
        last_update, status, completed_date, pro_account, sale_owner,
        sale_updated, other, pipeline_stage, priority, next_follow_up_date, tags,
        status_in_production, date_to_production, date_have_traffic, is_imported, stage_updated_at, custom_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
    `);
    
    const standardKeys = ['create_date', 'customer_name', 'type', 'content', 'feedback_from_customer', 'last_update', 'status', 'completed_date', 'pro_account', 'sale_owner', 'sale_updated', 'other', 'pipeline_stage', 'priority', 'next_follow_up_date', 'tags', 'status_in_production', 'date_to_production', 'date_have_traffic'];

    const insertMany = db.transaction(async (rows: any[]) => {
      for (const row of rows) {
        const customData: any = {};
        Object.keys(row).forEach(key => {
          if (!standardKeys.includes(key) && key !== 'id') {
            customData[key] = row[key];
          }
        });

        await stmt.run(
          row.create_date || new Date().toISOString().split('T')[0],
          row.customer_name || 'Unknown',
          row.type || '',
          row.content || '',
          row.feedback_from_customer || '',
          row.last_update || new Date().toISOString().split('T')[0],
          row.status || 'Testing',
          row.completed_date || null,
          row.pro_account || 'No',
          row.sale_owner || req.user.name,
          row.sale_updated || '',
          row.other || '',
          pipelineStage || 'NewIntegration',
          row.priority || 'Med',
          row.next_follow_up_date || null,
          row.tags || '',
          row.status_in_production || '',
          row.date_to_production || null,
          row.date_have_traffic || null,
          JSON.stringify(customData)
        );
      }
    });
    
    await insertMany(data);
    logAction('import', 'customer', null, `Imported ${data.length} customers via Excel`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, count: data.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/import", authenticate, upload.single("file"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
  const sheetName = req.body.sheetName;
  const pipelineStage = req.body.pipelineStage || 'NewIntegration';
  
  try {
    const fileData = fs.readFileSync(req.file.path);
    const wb = xlsx.read(fileData, { type: 'buffer' });
    const ws = sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Sheet not found");
    const data = xlsx.utils.sheet_to_json(ws);
    
    const stmt = db.prepare(`
      INSERT INTO customers (
        create_date, customer_name, type, content, feedback_from_customer,
        last_update, status, completed_date, pro_account, sale_owner,
        sale_updated, other, pipeline_stage, priority, next_follow_up_date, tags,
        is_imported, stage_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
    `);
    
    const insertMany = db.transaction(async (rows: any[]) => {
      for (const row of rows) {
        await stmt.run(
          row['Create Date'] || row.create_date || new Date().toISOString().split('T')[0],
          row['Customer'] || row.customer_name || 'Unknown',
          row['Type'] || row.type || '',
          row['Content'] || row.content || '',
          row['Feedback from customer'] || row.feedback_from_customer || '',
          row['Last Update'] || row.last_update || new Date().toISOString().split('T')[0],
          row['Status'] || row.status || 'Testing',
          row['Completed date'] || row.completed_date || null,
          row['Pro. Account'] || row.pro_account || 'No',
          row['Sale'] || row.sale_owner || req.user.name,
          row['Sale updated'] || row.sale_updated || '',
          row['Other'] || row.other || '',
          pipelineStage,
          row['Priority'] || row.priority || 'Med',
          row['Next Follow Up'] || row.next_follow_up_date || null,
          row['Tags'] || row.tags || ''
        );
      }
    });
    
    await insertMany(data);
    fs.unlinkSync(req.file.path);
    
    logAction('import', 'customer', null, `Imported ${data.length} customers via Excel`, req.user.id, req.user.name, getClientIp(req));
    res.json({ success: true, count: data.length });
  } catch (e: any) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: e.message });
  }
});

export default router;
