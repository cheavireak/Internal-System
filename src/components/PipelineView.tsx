import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Save, X, Upload, ArrowRight, Copy, Settings, Eye, EyeOff, ArrowUp, ArrowDown, Clock, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import * as xlsx from "xlsx";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import TrashModal from "./TrashModal";
import CustomerTimeline from "./CustomerTimeline";
import { useToast } from "../contexts/ToastContext";

export default function PipelineView({ stage, title, user }: { stage: string, title: string, user?: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const itemsPerPage = 20;
  const [editingId, setEditingId] = useState<number | null>(null);
  const [inlineEditCol, setInlineEditCol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);
  const { showToast } = useToast();
  
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [excelData, setExcelData] = useState<any[]>([]);
  
  const [moveCustomer, setMoveCustomer] = useState<any>(null);
  const [moveTargetStage, setMoveTargetStage] = useState<string>("");
  const [moveDate, setMoveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [timelineCustomer, setTimelineCustomer] = useState<any>(null);
  const [viewingCustomer, setViewingCustomer] = useState<any>(null);
  const [isViewModeEditable, setIsViewModeEditable] = useState(false);
  const [viewFontSize, setViewFontSize] = useState(14);

  const defaultDbColumns = stage === 'SandboxToProduction' ? [
    { key: 'create_date', label: 'Create Date', type: 'date' },
    { key: 'customer_name', label: 'Customer', type: 'text' },
    { key: 'type', label: 'Type', type: 'text' },
    { key: 'content', label: 'Content', type: 'text' },
    { key: 'status_in_production', label: 'Status in Production', type: 'text' },
    { key: 'last_update', label: 'Last Update', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: ['Testing', 'Completed', 'Not yet', 'Lost', 'Delay', 'Production'] },
    { key: 'completed_date', label: 'Completed date', type: 'date' },
    { key: 'sale_owner', label: 'Sale', type: 'text' },
    { key: 'date_to_production', label: 'Date to Production', type: 'date' },
    { key: 'date_have_traffic', label: 'Date Have Traffic', type: 'date' },
    { key: 'other', label: 'Other', type: 'text' }
  ] : [
    { key: 'create_date', label: 'Create Date', type: 'date' },
    { key: 'customer_name', label: 'Customer', type: 'text' },
    { key: 'type', label: 'Type', type: 'text' },
    { key: 'content', label: 'Content', type: 'text' },
    { key: 'feedback_from_customer', label: 'Feedback', type: 'text' },
    { key: 'last_update', label: 'Last Update', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: ['Testing', 'Completed', 'Not yet', 'Lost', 'Delay', 'Production'] },
    { key: 'completed_date', label: 'Completed Date', type: 'date' },
    { key: 'pro_account', label: 'Pro. Account', type: 'select', options: ['No', 'Yes'] },
    { key: 'sale_owner', label: 'Sale Owner', type: 'text' },
    { key: 'sale_updated', label: 'Sale Updated', type: 'text' },
    { key: 'other', label: 'Other', type: 'text' }
  ];

  const [dbColumns, setDbColumns] = useState<any[]>(defaultDbColumns);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [editingColumns, setEditingColumns] = useState<any[]>([]);
  const [newColumn, setNewColumn] = useState({ label: '', type: 'text', insertAfter: '' });
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
  const [editColumnData, setEditColumnData] = useState({ label: '', type: '' });

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      // Handle dd-MMM-yyyy format (e.g., 18-Mar-2026)
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIdx = months.indexOf(parts[1].toLowerCase());
          if (monthIdx !== -1) {
            const day = parts[0].padStart(2, '0');
            const year = parts[2];
            const month = (monthIdx + 1).toString().padStart(2, '0');
            const date = new Date(`${year}-${month}-${day}`);
            if (isValid(date)) return format(date, "dd-MMM-yyyy");
          }
        }
      }

      const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      if (!isValid(date)) return dateStr;
      return format(date, "dd-MMM-yyyy");
    } catch (e) {
      return dateStr;
    }
  };

  const formatForInput = (dateStr: any) => {
    if (!dateStr) return "";
    try {
      // If it's already YYYY-MM-DD, return it
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }

      // Handle dd-MMM-yyyy format (e.g., 18-Mar-2026)
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIdx = months.indexOf(parts[1].toLowerCase());
          if (monthIdx !== -1) {
            const day = parts[0].padStart(2, '0');
            const year = parts[2];
            const month = (monthIdx + 1).toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
      }

      const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      if (!isValid(date)) return "";
      return format(date, "yyyy-MM-dd");
    } catch (e) {
      return "";
    }
  };

  const fetchColumns = () => {
    fetch(`/api/columns/${stage}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => res.json())
    .then(data => {
      let cols = data && Array.isArray(data) ? data : defaultDbColumns;
      
      // Apply hidden state from localStorage
      const hiddenStateStr = localStorage.getItem(`hiddenColumns_${stage}`);
      if (hiddenStateStr) {
        try {
          const hiddenState = JSON.parse(hiddenStateStr);
          cols = cols.map((c: any) => ({
            ...c,
            hidden: hiddenState[c.key] !== undefined ? hiddenState[c.key] : c.hidden
          }));
        } catch (e) {}
      }
      
      setDbColumns(cols);
    });
  };

  const fetchCustomers = () => {
    setIsLoading(true);
    const searchParams = new URLSearchParams(location.search);
    const highlight = searchParams.get('highlight');
    
    let url = `/api/customers?pipeline_stage=${stage}&page=${currentPage}&limit=${itemsPerPage}`;
    if (highlight) {
      url += `&highlight=${highlight}`;
    }

    fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.customers) {
        setCustomers(data.customers);
        setTotalCustomers(data.total);
        if (data.page && data.page !== currentPage) {
          setCurrentPage(data.page);
        }
      } else {
        setCustomers(data);
        setTotalCustomers(data.length);
      }
      setIsLoading(false);

      if (highlight) {
        setHighlightedId(Number(highlight));
        setTimeout(() => {
          const el = rowRefs.current[Number(highlight)];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        
        // Remove highlight from URL immediately so pagination works
        const searchParams = new URLSearchParams(location.search);
        searchParams.delete('highlight');
        const newSearch = searchParams.toString();
        navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true });

        // Remove highlight visual after 3 seconds
        setTimeout(() => {
          setHighlightedId(null);
        }, 3000);
      }
    })
    .catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [stage]);

  useEffect(() => {
    fetchColumns();
    fetchCustomers();
  }, [stage, currentPage, location.search]);

  const handleSaveColumns = async () => {
    try {
      const res = await fetch(`/api/columns/${stage}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(editingColumns)
      });
      
      if (res.ok) {
        // Save hidden state to localStorage
        const hiddenState: Record<string, boolean> = {};
        editingColumns.forEach(c => {
          hiddenState[c.key] = !!c.hidden;
        });
        localStorage.setItem(`hiddenColumns_${stage}`, JSON.stringify(hiddenState));

        setDbColumns(editingColumns);
        setShowColumnModal(false);
        showToast("Columns updated successfully", "success");
      } else {
        showToast("Failed to update columns", "error");
      }
    } catch (err) {
      showToast("An error occurred while saving columns", "error");
    }
  };

  const handleAddColumn = () => {
    if (!newColumn.label) return;
    const key = newColumn.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCol = { key, label: newColumn.label, type: newColumn.type, isCustom: true };
    
    let updated = [...editingColumns];
    if (newColumn.insertAfter) {
      const idx = updated.findIndex(c => c.key === newColumn.insertAfter);
      if (idx !== -1) {
        updated.splice(idx + 1, 0, newCol);
      } else {
        updated.push(newCol);
      }
    } else {
      updated.push(newCol);
    }
    
    setEditingColumns(updated);
    setNewColumn({ label: '', type: 'text', insertAfter: '' });
    setShowAddColumn(false);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === editingColumns.length - 1) return;
    
    const updated = [...editingColumns];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setEditingColumns(updated);
  };

  const toggleColumnVisibility = (index: number) => {
    const updated = [...editingColumns];
    updated[index] = { ...updated[index], hidden: !updated[index].hidden };
    setEditingColumns(updated);
  };

  const deleteColumn = (index: number) => {
    const updated = [...editingColumns];
    updated.splice(index, 1);
    setEditingColumns(updated);
  };

  const saveColumnEdit = (index: number) => {
    if (!editColumnData.label) return;
    const updated = [...editingColumns];
    updated[index].label = editColumnData.label;
    updated[index].type = editColumnData.type;
    setEditingColumns(updated);
    setEditingColumnIndex(null);
  };

  const handleEdit = (customer: any) => {
    setEditingId(customer.id);
    setEditForm(customer);
    setInlineEditCol(null);
  };

  const handleSave = async (id: number) => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        setEditingId(null);
        setInlineEditCol(null);
        fetchCustomers();
        showToast("Record updated successfully", "success");
      } else {
        const err = await res.json();
        showToast(`Failed to update record: ${err.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Update error:", error);
      showToast("An error occurred while updating the record", "error");
    }
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    try {
      const res = await fetch(`/api/customers/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (res.ok) {
        setDeleteId(null);
        fetchCustomers();
        showToast("Record moved to trash", "success");
      } else {
        const err = await res.json();
        showToast(`Failed to delete record: ${err.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Delete error:", error);
      showToast("An error occurred while deleting the record.", "error");
    }
  };

  const confirmMove = async () => {
    if (!moveCustomer || !moveTargetStage) return;

    const updatedData = { 
      ...moveCustomer, 
      pipeline_stage: moveTargetStage,
      stage_updated_at: moveDate ? new Date(moveDate).toISOString() : new Date().toISOString()
    };

    // If moving to SandboxToProduction, copy feedback to status_in_production
    if (moveTargetStage === 'SandboxToProduction') {
      updatedData.status_in_production = updatedData.feedback_from_customer || updatedData.status_in_production;
    }

    try {
      const res = await fetch(`/api/customers/${moveCustomer.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(updatedData)
      });

      if (res.ok) {
        setMoveCustomer(null);
        setMoveTargetStage("");
        setMoveDate(new Date().toISOString().split('T')[0]);
        fetchCustomers();
        showToast("Customer moved successfully", "success");
      } else {
        const err = await res.json();
        showToast(`Failed to move customer: ${err.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Move error:", error);
      showToast("An error occurred while moving the customer", "error");
    }
  };

  const handleViewSave = async (id: number) => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        setViewingCustomer({ ...viewingCustomer, ...editForm });
        setIsViewModeEditable(false);
        fetchCustomers();
        showToast("Record updated successfully", "success");
      } else {
        const err = await res.json();
        showToast(`Failed to update record: ${err.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      showToast("Failed to update record", "error");
    }
  };

  const handleAdd = async () => {
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ ...editForm, pipeline_stage: stage })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add record");
      }

      setIsAdding(false);
      setEditForm({});
      fetchCustomers();
      showToast("Record added successfully!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const processExcelSheet = (wb: xlsx.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    
    let headerRowIndex = 0;
    let maxMatches = 0;
    
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      if (!row || !Array.isArray(row)) continue;
      
      let matches = 0;
      const rowStrings = row.map(String).map(s => s.toLowerCase().trim());
      dbColumns.forEach(dbCol => {
        if (rowStrings.some(s => s === dbCol.label.toLowerCase() || s === dbCol.key.toLowerCase() || (dbCol.key === 'sale_owner' && s === 'sale'))) {
          matches++;
        }
      });
      
      if (matches > maxMatches) {
        maxMatches = matches;
        headerRowIndex = i;
      }
    }
    
    const data = xlsx.utils.sheet_to_json(ws, { range: headerRowIndex, defval: "" });
    setExcelData(data);
    
    if (data.length > 0) {
      const headers = Object.keys(data[0] as object);
      setExcelHeaders(headers);
      
      const initialMapping: Record<string, string> = {};
      dbColumns.forEach(dbCol => {
        let match = headers.find(h => 
          h.toLowerCase().trim() === dbCol.label.toLowerCase().trim() || 
          h.toLowerCase().trim() === dbCol.key.toLowerCase().trim()
        );
        
        if (!match) {
          if (dbCol.key === 'sale_owner') {
            match = headers.find(h => h.toLowerCase().trim() === 'sale');
          } else if (dbCol.key === 'feedback_from_customer') {
            match = headers.find(h => h.toLowerCase().trim().includes('feedback'));
          } else if (dbCol.key === 'completed_date') {
            match = headers.find(h => h.toLowerCase().trim().includes('completed'));
          } else if (dbCol.key === 'pro_account') {
            match = headers.find(h => h.toLowerCase().trim().includes('pro. account') || h.toLowerCase().trim().includes('pro account'));
          }
        }
        
        if (match) {
          initialMapping[dbCol.key] = match;
        }
      });
      setColumnMapping(initialMapping);
    } else {
      setExcelHeaders([]);
      setColumnMapping({});
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = xlsx.read(bstr, { type: 'binary', cellDates: true });
      setSheetNames(wb.SheetNames);
      
      const firstSheet = wb.SheetNames[0];
      setSelectedSheet(firstSheet);
      
      processExcelSheet(wb, firstSheet);
      
      setShowImportModal(true);
    };
    reader.readAsBinaryString(file);
    
    e.target.value = '';
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (!importFile) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = xlsx.read(bstr, { type: 'binary', cellDates: true });
      processExcelSheet(wb, sheetName);
    };
    reader.readAsBinaryString(importFile);
  };

  const parseExcelDate = (excelDate: any) => {
    if (!excelDate) return "";
    if (excelDate instanceof Date) {
      const offset = excelDate.getTimezoneOffset() * 60000;
      return new Date(excelDate.getTime() - offset).toISOString().split('T')[0];
    }
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().split('T')[0];
    }
    if (typeof excelDate === 'string') {
      const parsed = new Date(excelDate);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return String(excelDate);
  };

  const confirmImport = () => {
    if (excelData.length === 0) return;
    
    const dateColumns = ['create_date', 'last_update', 'completed_date', 'next_follow_up_date', 'date_to_production', 'date_have_traffic'];

    let mappedData = excelData.map(row => {
      const newRow: any = {};
      dbColumns.forEach(dbCol => {
        const excelCol = columnMapping[dbCol.key];
        if (excelCol && row[excelCol] !== undefined && row[excelCol] !== "") {
          let val = row[excelCol];
          if (dateColumns.includes(dbCol.key)) {
            val = parseExcelDate(val);
          }
          newRow[dbCol.key] = val;
        }
      });
      return newRow;
    });

    // Sort by create_date descending (newest first)
    mappedData.sort((a, b) => {
      if (!a.create_date) return 1;
      if (!b.create_date) return -1;
      return new Date(b.create_date).getTime() - new Date(a.create_date).getTime();
    });

    fetch("/api/import-json", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}` 
      },
      body: JSON.stringify({ data: mappedData, pipelineStage: stage })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(`Imported ${data.count} records successfully.`, "success");
        fetchCustomers();
        setShowImportModal(false);
        setImportFile(null);
      } else {
        showToast("Import failed: " + data.error, "error");
      }
    });
  };

  const handleCopyData = () => {
    if (customers.length === 0) {
      showToast('No data to copy.', "error");
      return;
    }

    const textToCopy = customers.map(customer => {
      return dbColumns.filter(col => !col.hidden).map(col => {
        let val = customer[col.key] || '';
        if (typeof val === 'string') {
          // Escape quotes and wrap in quotes if there are newlines or tabs
          if (val.includes('\n') || val.includes('\t') || val.includes('"')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
        }
        return val;
      }).join('\t');
    }).join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Data copied to clipboard!', "success");
    }).catch(err => {
      console.error('Failed to copy data: ', err);
      showToast('Failed to copy data', "error");
    });
  };

  const canCreate = user?.permissions?.can_create;
  const canEdit = user?.permissions?.can_edit;
  const canDelete = user?.permissions?.can_delete;
  const canMove = user?.permissions?.can_move;
  const canImport = user?.permissions?.can_import;
  const canExport = user?.permissions?.can_export;
  const canManageColumns = user?.permissions?.can_manage_columns ?? user?.role === 'admin';

  return (
    <div className="max-w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setShowTrashModal(true)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm font-medium flex items-center shadow-sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Trash
          </button>
          {canExport && (
            <button
              onClick={handleCopyData}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm font-medium flex items-center shadow-sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Data
            </button>
          )}
          {canImport && (
            <label className="cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium flex items-center shadow-sm">
              <Upload className="w-4 h-4 mr-2" />
              Import Excel
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileSelect} />
            </label>
          )}
          {canCreate && (
            <button
              onClick={() => { setIsAdding(true); setEditForm({}); }}
              className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors text-sm font-medium flex items-center shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </button>
          )}
          {canManageColumns && (
            <button
              onClick={() => { setEditingColumns([...dbColumns]); setShowColumnModal(true); }}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium flex items-center shadow-sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Columns
            </button>
          )}
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Import Data</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Map the columns from your Excel sheet to the system fields.</p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Sheet</label>
              <select 
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
              >
                {sheetNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Column Mapping</h3>
              <div className="grid grid-cols-2 gap-4">
                {dbColumns.filter(col => !col.hidden).map(col => (
                  <div key={col.key} className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{col.label}</label>
                    <select
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      value={columnMapping[col.key] || ""}
                      onChange={(e) => setColumnMapping({...columnMapping, [col.key]: e.target.value})}
                    >
                      <option value="">-- Ignore --</option>
                      {excelHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button 
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmImport}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                Import {excelData.length} Records
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Move to Trash</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">Are you sure you want to move this record to trash? It will be kept for 30 days.</p>
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 font-medium text-sm"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {moveCustomer !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Move Customer</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">Move <strong>{moveCustomer.customer_name}</strong> to a different pipeline stage.</p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destination Stage</label>
              <select 
                className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500"
                value={moveTargetStage}
                onChange={(e) => setMoveTargetStage(e.target.value)}
              >
                <option value="">Select stage...</option>
                <option value="NewIntegration">New Integration</option>
                <option value="SandboxToProduction">Sandbox → Production</option>
                <option value="Delay">Delay Project</option>
                <option value="Lost">Lost API Leads</option>
                <option value="Expired">Expired</option>
                <option value="SMPP">SMPP</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Move Date</label>
              <input 
                type="date" 
                className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-4">
              <button 
                onClick={() => { setMoveCustomer(null); setMoveTargetStage(""); setMoveDate(new Date().toISOString().split('T')[0]); }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmMove}
                disabled={!moveTargetStage}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm disabled:opacity-50"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-1 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[30px]">No.</th>
                {dbColumns.filter(col => !col.hidden).map(col => {
                  const isWrapCol = col.key === 'feedback_from_customer' || col.key === 'status_in_production';
                  const isOtherCol = col.key === 'other';
                  let thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider";
                  if (isOtherCol) thClass += " w-[240px] min-w-[240px] max-w-[240px]";
                  else if (isWrapCol) thClass += " w-[300px] min-w-[300px] max-w-[300px]";
                  return (
                    <th key={col.key} className={thClass}>{col.label}</th>
                  );
                })}
                {(canEdit || canDelete || canMove) && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={dbColumns.filter(col => !col.hidden).length + 2} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {isAdding && canCreate && (
                    <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                      <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[30px] text-center">-</td>
                      {dbColumns.filter(col => !col.hidden).map(col => (
                        <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                          {col.type === 'select' ? (
                            <select className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={editForm[col.key] || ''} onChange={e => setEditForm({...editForm, [col.key]: e.target.value})}>
                              <option value="">Select...</option>
                              {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : col.type === 'textarea' ? (
                            <textarea placeholder={col.label} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={editForm[col.key] || ''} onChange={e => setEditForm({...editForm, [col.key]: e.target.value})} />
                          ) : (
                            <input 
                              type={col.type} 
                              placeholder={col.label} 
                              className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                              value={col.type === 'date' ? formatForInput(editForm[col.key]) : (editForm[col.key] || '')} 
                              onChange={e => setEditForm({...editForm, [col.key]: e.target.value})} 
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium w-1">
                        <button onClick={handleAdd} className="text-green-600 dark:text-green-400 hover:text-green-900 mr-3 transition-colors"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setIsAdding(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  )}
                  {customers.map((customer, index) => {
                let noColorClass = "text-gray-500";
                if (customer.create_date) {
                  try {
                    const createDate = typeof customer.create_date === 'string' ? parseISO(customer.create_date) : new Date(customer.create_date);
                    if (isValid(createDate)) {
                      const diffDays = differenceInDays(new Date(), createDate);
                      
                      if (diffDays <= 7) {
                        noColorClass = "bg-green-100 text-green-800 font-bold";
                      } else if (diffDays <= 30) {
                        noColorClass = "bg-yellow-100 text-yellow-800 font-bold";
                      } else {
                        noColorClass = "bg-red-100 text-red-800 font-bold";
                      }
                    }
                  } catch (e) {}
                }

                return (
                <tr 
                  key={customer.id} 
                  ref={(el) => { rowRefs.current[customer.id] = el; }}
                  className={`transition-all duration-1000 ${
                    highlightedId === customer.id 
                      ? "bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700 z-10 relative" 
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {editingId === customer.id ? (
                    <>
                      <td className="px-1 py-3 whitespace-nowrap text-sm w-[30px] text-center text-gray-900 dark:text-gray-100">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      {dbColumns.filter(col => !col.hidden).map(col => {
                        const isWrapCol = col.key === 'feedback_from_customer' || col.key === 'status_in_production' || col.key === 'sale_updated' || col.key === 'date_have_traffic';
                        const isOtherCol = col.key === 'other';
                        const isNotEditedInline = inlineEditCol && inlineEditCol !== col.key;
                        
                        let tdClass = "px-2 py-2 text-sm text-gray-600 dark:text-gray-400 ";
                        if (isOtherCol) {
                          tdClass += "w-[240px] min-w-[240px] max-w-[240px] whitespace-pre-wrap break-words";
                        } else if (isWrapCol) {
                          tdClass += "w-[300px] min-w-[300px] max-w-[300px] whitespace-pre-wrap break-words";
                        } else {
                          tdClass += "whitespace-nowrap max-w-xs truncate";
                        }

                        return (
                          <td key={col.key} className={tdClass}>
                            {isNotEditedInline ? (
                              col.key === 'status' ? (
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${customer.status?.trim().toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' : 
                                    customer.status?.trim().toLowerCase() === 'testing' ? 'bg-yellow-100 text-yellow-800' : 
                                    customer.status?.trim().toLowerCase() === 'lost' ? 'bg-red-100 text-red-800' : 
                                    customer.status?.trim().toLowerCase() === 'delay' ? 'bg-orange-100 text-orange-800' : 
                                    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>
                                  {customer.status}
                                </span>
                              ) : (
                                col.type === 'date' ? formatDate(customer[col.key]) : customer[col.key]
                              )
                            ) : (
                              col.type === 'select' ? (
                                <select className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={editForm[col.key] || ''} onChange={e => setEditForm({...editForm, [col.key]: e.target.value})}>
                                  <option value="">Select...</option>
                                  {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              ) : col.type === 'textarea' || isWrapCol || isOtherCol ? (
                                <textarea placeholder={col.label} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px] min-w-[200px]" value={editForm[col.key] || ''} onChange={e => setEditForm({...editForm, [col.key]: e.target.value})} />
                              ) : (
                                <input 
                                  type={col.type} 
                                  placeholder={col.label} 
                                  className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                  value={col.type === 'date' ? formatForInput(editForm[col.key]) : (editForm[col.key] || '')} 
                                  onChange={e => setEditForm({...editForm, [col.key]: e.target.value})} 
                                />
                              )
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium w-1">
                        <button onClick={() => handleSave(customer.id)} className="text-green-600 hover:text-green-900 mr-3 transition-colors"><Save className="w-4 h-4" /></button>
                        <button onClick={() => { setEditingId(null); setInlineEditCol(null); }} className="text-gray-500 hover:text-gray-900 dark:text-white transition-colors"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td 
                        className={`px-1 py-3 whitespace-nowrap text-sm w-[30px] text-center ${noColorClass} cursor-pointer hover:opacity-80`}
                        onClick={() => {
                          setViewingCustomer(customer);
                          setIsViewModeEditable(false);
                          setEditForm({ ...customer });
                          setViewFontSize(14);
                        }}
                      >
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      {dbColumns.filter(col => !col.hidden).map(col => {
                        const isWrapCol = col.key === 'feedback_from_customer' || col.key === 'status_in_production' || col.key === 'sale_updated' || col.key === 'date_have_traffic';
                        const isOtherCol = col.key === 'other';
                        const isInlineEditable = col.key === 'feedback_from_customer';
                        
                        let tdClass = "px-2 py-2 text-sm text-gray-600 dark:text-gray-400 ";
                        if (isOtherCol) {
                          tdClass += "w-[240px] min-w-[240px] max-w-[240px] whitespace-pre-wrap break-words";
                        } else if (isWrapCol) {
                          tdClass += "w-[300px] min-w-[300px] max-w-[300px] whitespace-pre-wrap break-words";
                        } else {
                          tdClass += "whitespace-nowrap max-w-xs truncate";
                        }
                        
                        if (isInlineEditable && canEdit) {
                          tdClass += " cursor-pointer transition-colors";
                        }

                        return (
                          <td 
                            key={col.key} 
                            className={tdClass} 
                            onDoubleClick={() => {
                              if (isInlineEditable && canEdit) {
                                setEditingId(customer.id);
                                setEditForm({ ...customer });
                                setInlineEditCol(col.key);
                              }
                            }}
                          >
                            {col.key === 'status' ? (
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${customer.status?.trim().toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' : 
                                  customer.status?.trim().toLowerCase() === 'testing' ? 'bg-yellow-100 text-yellow-800' : 
                                  customer.status?.trim().toLowerCase() === 'lost' ? 'bg-red-100 text-red-800' : 
                                  customer.status?.trim().toLowerCase() === 'delay' ? 'bg-orange-100 text-orange-800' : 
                                  'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>
                                {customer.status}
                              </span>
                            ) : (
                              col.type === 'date' ? formatDate(customer[col.key]) : customer[col.key]
                            )}
                          </td>
                        );
                      })}
                      {(canEdit || canDelete || canMove) && (
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium w-1">
                          {canMove && <button onClick={() => { setMoveCustomer(customer); setMoveTargetStage(""); }} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 mr-3 transition-colors" title="Move to another stage"><ArrowRight className="w-4 h-4" /></button>}
                          <button onClick={() => setTimelineCustomer(customer)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mr-3 transition-colors" title="View History"><Clock className="w-4 h-4" /></button>
                          {canEdit && <button onClick={() => handleEdit(customer)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 mr-3 transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>}
                          {canDelete && <button onClick={() => handleDelete(customer.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 transition-colors" title="Move to Trash"><Trash2 className="w-4 h-4" /></button>}
                        </td>
                      )}
                    </>
                  )}
                </tr>
                );
              })}
              {!isLoading && customers.length === 0 && !isAdding && (
                <tr>
                  <td colSpan={dbColumns.filter(col => !col.hidden).length + ((canEdit || canDelete || canMove) ? 2 : 1)} className="px-6 py-12 text-center text-gray-500 text-sm">
                    No records found for this pipeline stage.
                  </td>
                </tr>
              )}
            </>
          )}
            </tbody>
          </table>
        </div>
        
        {totalCustomers > itemsPerPage && (
          <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCustomers)}</span> of <span className="font-medium">{totalCustomers}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCustomers / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(totalCustomers / itemsPerPage)}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {timelineCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{timelineCustomer.customer_name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">History & Timeline</p>
              </div>
              <button onClick={() => setTimelineCustomer(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <CustomerTimeline customerId={timelineCustomer.id} />
            
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setTimelineCustomer(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showColumnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Columns</h2>
              <button onClick={() => setShowColumnModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2 mb-6">
              {editingColumns.map((col, index) => (
                <div key={col.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 rounded-lg">
                  {editingColumnIndex === index ? (
                    <div className="flex items-center gap-3 w-full">
                      <input 
                        type="text" 
                        value={editColumnData.label} 
                        onChange={e => setEditColumnData({...editColumnData, label: e.target.value})} 
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded p-1.5 text-sm flex-1" 
                      />
                      <select 
                        value={editColumnData.type} 
                        onChange={e => setEditColumnData({...editColumnData, type: e.target.value})} 
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded p-1.5 text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                      </select>
                      <button onClick={() => saveColumnEdit(index)} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingColumnIndex(null)} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:bg-gray-700 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <button onClick={() => moveColumn(index, 'up')} disabled={index === 0} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={() => moveColumn(index, 'down')} disabled={index === editingColumns.length - 1} className="text-gray-400 hover:text-gray-700 dark:text-gray-300 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                        </div>
                        <span className={`font-medium ${col.hidden ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{col.label}</span>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">{col.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleColumnVisibility(index)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded">
                          {col.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setEditingColumnIndex(index); setEditColumnData({ label: col.label, type: col.type }); }} className="p-1.5 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteColumn(index)} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {showAddColumn ? (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 mb-6">
                <h3 className="text-sm font-semibold text-indigo-900 mb-3">Add Custom Column</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Column Name</label>
                    <input type="text" value={newColumn.label} onChange={e => setNewColumn({...newColumn, label: e.target.value})} className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded p-2 text-sm" placeholder="e.g. Budget" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Data Type</label>
                    <select value={newColumn.type} onChange={e => setNewColumn({...newColumn, type: e.target.value})} className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded p-2 text-sm">
                      <option value="text">Text</option>
                      <option value="date">Date</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Insert After</label>
                    <select value={newColumn.insertAfter} onChange={e => setNewColumn({...newColumn, insertAfter: e.target.value})} className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded p-2 text-sm">
                      <option value="">-- At the end --</option>
                      {editingColumns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddColumn(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded">Cancel</button>
                  <button onClick={handleAddColumn} className="px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded">Add Column</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddColumn(true)} className="flex items-center text-sm text-indigo-600 font-medium hover:text-indigo-800 mb-6">
                <Plus className="w-4 h-4 mr-1" /> Add Custom Column
              </button>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={() => setShowColumnModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
              <button onClick={handleSaveColumns} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium">Save Changes</button>
            </div>
          </div>
        </div>
      )}
      
      <TrashModal 
        type="customer" 
        isOpen={showTrashModal} 
        onClose={() => setShowTrashModal(false)} 
        onRestore={fetchCustomers} 
      />

      {viewingCustomer && (() => {
        const highlightKey = stage === 'SandboxToProduction' ? 'status_in_production' : 'feedback_from_customer';
        const highlightLabel = stage === 'SandboxToProduction' ? 'Status in Production' : 'Feedback';

        return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingCustomer.customer_name || 'Unnamed Customer'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Customer Details & {highlightLabel}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Font Size Controls */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button 
                    onClick={() => setViewFontSize(prev => Math.max(10, prev - 2))}
                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-md shadow-sm transition-all"
                    title="Decrease Font Size"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3ch] text-center">
                    {viewFontSize}
                  </span>
                  <button 
                    onClick={() => setViewFontSize(prev => Math.min(32, prev + 2))}
                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-md shadow-sm transition-all"
                    title="Increase Font Size"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setViewingCustomer(null);
                    setIsViewModeEditable(false);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6" style={{ fontSize: `${viewFontSize}px` }}>
                {/* Highlighted Feedback Section */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    {highlightLabel}
                  </label>
                  {isViewModeEditable ? (
                    <textarea
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[120px] text-gray-900 dark:text-gray-100 transition-all"
                      style={{ fontSize: `${viewFontSize + 2}px` }}
                      value={editForm[highlightKey] || ''}
                      onChange={(e) => setEditForm({ ...editForm, [highlightKey]: e.target.value })}
                    />
                  ) : (
                    <div 
                      className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed font-medium"
                      style={{ fontSize: `${viewFontSize + 2}px` }}
                    >
                      {viewingCustomer[highlightKey] || <span className="text-gray-400 italic">No {highlightLabel.toLowerCase()} provided</span>}
                    </div>
                  )}
                </div>

                {/* Other Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                  {dbColumns.filter(col => !col.hidden && col.key !== highlightKey).map(col => {
                    const isHalfWidth = col.key === 'sale_updated' || col.key === 'other';
                    const colSpanClass = isHalfWidth ? 'md:col-span-3' : 'md:col-span-2';
                    
                    return (
                    <div key={col.key} className={colSpanClass}>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        {col.label}
                      </label>
                      {isViewModeEditable ? (
                        col.type === 'select' ? (
                          <select
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
                            style={{ fontSize: 'inherit' }}
                            value={editForm[col.key] || ''}
                            onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.value })}
                          >
                            <option value="">Select...</option>
                            {col.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : col.type === 'textarea' || isHalfWidth ? (
                          <textarea
                            rows={1}
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[46px] text-gray-900 dark:text-gray-100 resize-y"
                            style={{ fontSize: 'inherit' }}
                            value={editForm[col.key] || ''}
                            onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.value })}
                          />
                        ) : (
                          <input
                            type={col.type}
                            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
                            style={{ fontSize: 'inherit' }}
                            value={col.type === 'date' ? formatForInput(editForm[col.key]) : (editForm[col.key] || '')}
                            onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.value })}
                          />
                        )
                      ) : (
                        <div className="text-gray-900 dark:text-gray-100 font-medium break-words whitespace-pre-wrap">
                          {col.key === 'status' ? (
                            <span className={`px-3 py-1 inline-flex font-semibold rounded-full 
                              ${viewingCustomer.status?.trim().toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' : 
                                viewingCustomer.status?.trim().toLowerCase() === 'testing' ? 'bg-yellow-100 text-yellow-800' : 
                                viewingCustomer.status?.trim().toLowerCase() === 'lost' ? 'bg-red-100 text-red-800' : 
                                viewingCustomer.status?.trim().toLowerCase() === 'delay' ? 'bg-orange-100 text-orange-800' : 
                                'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}
                              style={{ fontSize: '0.85em' }}
                            >
                              {viewingCustomer.status}
                            </span>
                          ) : (
                            col.type === 'date' ? formatDate(viewingCustomer[col.key]) : (viewingCustomer[col.key] || <span className="text-gray-400 italic font-normal">-</span>)
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
              {canEdit && (
                <button
                  onClick={() => {
                    if (isViewModeEditable) {
                      handleViewSave(viewingCustomer.id);
                    } else {
                      setIsViewModeEditable(true);
                    }
                  }}
                  className={`px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                    isViewModeEditable 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isViewModeEditable ? (
                    <><Save className="w-4 h-4" /> Save</>
                  ) : (
                    <><Edit2 className="w-4 h-4" /> Edit</>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setViewingCustomer(null);
                  setIsViewModeEditable(false);
                }}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
