import * as XLSX from 'xlsx-js-style';
import { addLog } from './auditService';

const STAGES = [
  { id: 'NewIntegration', title: 'APITestingReview NewIntegration', color: "4472C4" }, // Blue
  { id: 'SandboxToProduction', title: 'C.SandboxToProduction', color: "548235" }, // Green
  { id: 'Delay', title: 'CustomerDelayProject', color: "FFC000" }, // Yellow
  { id: 'Lost', title: 'LostAPILeads', color: "C00000" }, // Red
  { id: 'Expired', title: 'Expired', color: "7030A0" }, // Purple
  { id: 'SMPP', title: 'SMPP', color: "ED7D31" } // Orange
];

const SUMMARY_ROWS = [
  { title: 'New integration Customer (All)', stage: 'NewIntegration' },
  { title: 'Delay project (All)', stage: 'Delay' },
  { title: 'LOST API LEADS (ByWeek)', stage: 'Lost' },
  { title: 'Customer To Production (ByWeek)', stage: 'SandboxToProduction' }
];

export const generateWeeklyReport = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Fetch current user for logging
  let currentUser = null;
  try {
    const userRes = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userData = await userRes.json();
    if (userData.user) {
      currentUser = userData.user;
    }
  } catch (err) {
    console.error("Failed to fetch user for logging:", err);
  }

  const workbook = XLSX.utils.book_new();
  const allData: Record<string, any[]> = {};

  // Fetch data for all stages
  for (const stage of STAGES) {
    try {
      const response = await fetch(`/api/customers?pipeline_stage=${stage.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      allData[stage.id] = Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error fetching data for ${stage.id}:`, error);
      allData[stage.id] = [];
    }
  }

  // --- 1. Weekly Summary Sheet ---
  const summaryWs = createSummarySheet(allData);
  XLSX.utils.book_append_sheet(workbook, summaryWs, "WeeklySummary");

  // --- 2. Stage Sheets ---
  for (const stage of STAGES) {
    const ws = createStageSheet(stage.id, allData[stage.id], stage.color);
    XLSX.utils.book_append_sheet(workbook, ws, stage.title);
  }

  // Generate filename
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const filename = `API Review-Present (${dateStr}).xlsx`;

  // Download
  XLSX.writeFile(workbook, filename);

  // Log the action
  if (currentUser) {
    addLog({
      action: 'other',
      entity: 'system',
      details: `Exported Weekly Report: ${filename}`,
      userId: currentUser.id,
      userName: currentUser.name
    });
  }
};

const createSummarySheet = (allData: Record<string, any[]>) => {
  // Mock previous dates for structure
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  const getCountUpToDate = (data: any[], maxDate: Date, stage: string) => {
    if (!data) return 0;
    return data.filter(item => {
      let dateToUse = item.create_date;
      if (stage === 'SandboxToProduction') {
        dateToUse = item.date_to_production || item.completed_date || item.last_update || item.create_date;
      } else if (stage === 'Lost') {
        dateToUse = item.completed_date || item.last_update || item.create_date;
      } else {
        dateToUse = item.create_date;
      }
      if (!dateToUse) return true; // If no date, assume it counts
      const d = new Date(dateToUse).getTime();
      return isNaN(d) || d <= maxDate.getTime();
    }).length;
  };

  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

  const headers = [
    [`API Review (${formatDate(twoWeeksAgo)})`, '', `API Review (${formatDate(oneWeekAgo)})`, '', `API Review (${formatDate(today)})`, ''],
    ['Title', 'Total', 'Title', 'Total', 'Title', 'Total']
  ];

  const dataRows = SUMMARY_ROWS.map(row => {
    const stageData = allData[row.stage] || [];
    return [
      row.title, getCountUpToDate(stageData, twoWeeksAgo, row.stage), // Previous 2 weeks
      row.title, getCountUpToDate(stageData, oneWeekAgo, row.stage), // Previous 1 week
      row.title, stageData.length // Current
    ];
  });

  // Create worksheet
  const wsData = [
    ['New lead customer or New integration customer'], // Main Title
    ...headers,
    ...dataRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Styling
  const baseStyle = {
    font: { name: "Calibri", sz: 11 },
    alignment: { vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  const headerStyle = {
    ...baseStyle,
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "C65911" } }, // Orange/Brown
    alignment: { horizontal: "center", vertical: "center" }
  };

  const subHeaderStyle = {
    ...baseStyle,
    font: { name: "Calibri", sz: 11, bold: true },
    alignment: { horizontal: "center", vertical: "center" }
  };

  // Apply styles
  // Row 0: Main Title (Merged)
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
  ws['A1'].s = { font: { name: "Calibri", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } };

  // Row 1: Date Headers (Merged pairs)
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } });
  ws['!merges'].push({ s: { r: 1, c: 2 }, e: { r: 1, c: 3 } });
  ws['!merges'].push({ s: { r: 1, c: 4 }, e: { r: 1, c: 5 } });

  ['A2', 'C2', 'E2'].forEach(ref => {
    if (ws[ref]) ws[ref].s = headerStyle;
  });

  // Row 2: Sub Headers
  ['A3', 'B3', 'C3', 'D3', 'E3', 'F3'].forEach(ref => {
    if (ws[ref]) ws[ref].s = subHeaderStyle;
  });

  // Data Rows
  const startRow = 3;
  dataRows.forEach((_, idx) => {
    const r = startRow + idx;
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(c => {
      const ref = `${c}${r + 1}`;
      if (ws[ref]) ws[ref].s = baseStyle;
    });
    // Center align totals and titles
    ['B', 'D', 'F'].forEach(c => {
      const ref = `${c}${r + 1}`;
      if (ws[ref]) {
        ws[ref].s = { ...baseStyle, alignment: { horizontal: "center", vertical: "center" }, font: { name: "Calibri", sz: 11, color: { rgb: "0000FF" }, underline: true } }; // Blue link style
      }
    });
  });

  // Column Widths
  ws['!cols'] = [
    { wch: 40 }, { wch: 10 },
    { wch: 40 }, { wch: 10 },
    { wch: 40 }, { wch: 10 }
  ];

  return ws;
};

const createStageSheet = (stageId: string, data: any[], tabColor: string) => {
  let columns = [];
  
  if (stageId === 'SandboxToProduction') {
    columns = [
      { key: 'create_date', label: 'Create Date', width: 15 },
      { key: 'customer_name', label: 'Customer', width: 25 },
      { key: 'type', label: 'Type', width: 15 },
      { key: 'content', label: 'Content', width: 15 },
      { key: 'status_in_production', label: 'Status in Production', width: 40, wrap: true },
      { key: 'last_update', label: 'Last Update', width: 15 },
      { key: 'status', label: 'Status', width: 15 },
      { key: 'completed_date', label: 'Completed date', width: 15 },
      { key: 'sale_owner', label: 'Sale', width: 15 },
      { key: 'date_to_production', label: 'Date to Production', width: 18 },
      { key: 'date_have_traffic', label: 'Date Have Traffic', width: 18 },
      { key: 'other', label: 'Other', width: 30, wrap: true }
    ];
  } else {
    columns = [
      { key: 'create_date', label: 'Create Date', width: 15 },
      { key: 'customer_name', label: 'Customer', width: 25 },
      { key: 'type', label: 'Type', width: 15 },
      { key: 'content', label: 'Content', width: 15 },
      { key: 'feedback_from_customer', label: 'Feedback from customer', width: 50, wrap: true },
      { key: 'last_update', label: 'Last Update', width: 15 },
      { key: 'status', label: 'Status', width: 15 },
      { key: 'completed_date', label: 'Completed date', width: 15 },
      { key: 'pro_account', label: 'Pro. Account', width: 12 },
      { key: 'sale_owner', label: 'Sale', width: 15 },
      { key: 'sale_updated', label: 'Sale updated', width: 15 },
      { key: 'other', label: 'Other', width: 30, wrap: true }
    ];
  }

  // Map data
  const rows = data.map(item => {
    const row: any[] = [];
    columns.forEach(col => {
      let val = item[col.key] || '';
      
      // Format date fields
      if (val && typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            // Format as YYYY-MM-DD
            val = d.toISOString().split('T')[0];
          }
        } catch (e) {}
      }
      
      row.push(val);
    });
    return row;
  });

  // Create sheet
  const wsData = [
    [stageId === 'NewIntegration' ? 'New Lead Customer or New integration Customer' : stageId], // Title
    columns.map(c => c.label), // Header
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Styling
  const baseStyle = {
    font: { name: "Calibri", sz: 11 },
    alignment: { vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  const titleStyle = {
    ...baseStyle,
    font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: tabColor } }, // Use specific stage color
    alignment: { horizontal: "center", vertical: "center" }
  };

  const headerStyle = {
    ...baseStyle,
    font: { name: "Calibri", sz: 11, bold: true },
    fill: { fgColor: { rgb: "D9E1F2" } }, // Lighter Blue (default)
    alignment: { horizontal: "center", vertical: "center" }
  };

  // Apply styles
  // Row 0: Title (Merged)
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } });
  ws['A1'].s = titleStyle;

  // Row 1: Header
  columns.forEach((_, idx) => {
    const colLetter = XLSX.utils.encode_col(idx);
    const ref = `${colLetter}2`;
    if (ws[ref]) ws[ref].s = headerStyle;
  });

  // Data Rows
  rows.forEach((row, rIdx) => {
    // Calculate age based on Create Date
    const createDateStr = row[0]; // Assuming create_date is first column
    let ageInDays = 0;
    if (createDateStr) {
      const createDate = new Date(createDateStr);
      if (!isNaN(createDate.getTime())) {
        const diffTime = Math.abs(new Date().getTime() - createDate.getTime());
        ageInDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      }
    }

    columns.forEach((col, cIdx) => {
      const colLetter = XLSX.utils.encode_col(cIdx);
      const ref = `${colLetter}${rIdx + 3}`;
      
      if (ws[ref]) {
        let style: any = { ...baseStyle };
        
        // Text Wrapping
        if (col.wrap) {
          style.alignment = { ...style.alignment, wrapText: true };
        }

        // Status Color Highlighting (Based on Age)
        if (col.key === 'status') {
           style.alignment = { ...style.alignment, horizontal: "center" };
           if (ageInDays <= 7) {
             style.fill = { fgColor: { rgb: "92D050" } }; // Green (< 1 week)
           } else if (ageInDays <= 30) {
             style.fill = { fgColor: { rgb: "FFFF00" } }; // Yellow (1 week - 1 month)
           } else {
             style.fill = { fgColor: { rgb: "FF0000" } }; // Red (> 1 month)
           }
        }

        // Remove background color from column 1 (Create Date)
        if (cIdx === 0) {
           delete style.fill;
        }

        ws[ref].s = style;
      }
    });
  });

  // Column Widths
  ws['!cols'] = columns.map(col => ({ wch: col.width }));

  return ws;
};
