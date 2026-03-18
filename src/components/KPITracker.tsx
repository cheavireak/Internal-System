import React, { useState, useEffect } from "react";
import { Plus, Download, Search, Trash2, Edit2, ChevronLeft, ChevronRight, RefreshCw, Upload, RotateCcw, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as xlsx from "xlsx";
import { useToast } from "../contexts/ToastContext";
import { format, parseISO, isValid } from "date-fns";

export default function KPITracker() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState("");
  const [months, setMonths] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      return isValid(date) ? format(date, "dd-MMM-yyyy") : String(dateStr);
    } catch (e) {
      return String(dateStr);
    }
  };

  const [importFile, setImportFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [excelData, setExcelData] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText: string;
    confirmColor: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: '',
    confirmColor: 'bg-red-600 hover:bg-red-700'
  });

  const kpiColumns = [
    { key: 'create_date', label: 'Date' },
    { key: 'company', label: 'Company' },
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'contact_by', label: 'Contact By' },
    { key: 'problem', label: 'Problem' },
    { key: 'problem_type', label: 'Problem Type' },
    { key: 'response_time', label: 'Response Time' },
    { key: 'resolve_time', label: 'Resolve Time' },
    { key: 'solution', label: 'Solution' },
    { key: 'resolved_same_day', label: 'Resolved Same Day' }
  ];

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const endpoint = viewMode === 'trash' ? '/api/kpi/trash' : '/api/kpi';
      const res = await fetch(`${endpoint}?page=${page}&month=${month}&search=${search}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      if (viewMode === 'active') {
        setMonths(data.months || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, month, search, viewMode]);

  const handleDelete = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Move to Trash',
      message: 'Are you sure you want to move this record to trash? It will be kept for 30 days.',
      confirmText: 'Move to Trash',
      confirmColor: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/kpi/${id}`, { 
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            fetchRecords();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            showToast("Record moved to trash", "success");
          } else {
            showToast("Failed to move record to trash", "error");
          }
        } catch (err) {
          showToast("An error occurred", "error");
        }
      }
    });
  };

  const handleRestore = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Record',
      message: 'Are you sure you want to restore this record?',
      confirmText: 'Restore',
      confirmColor: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/kpi/${id}/restore`, { 
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            fetchRecords();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            showToast("Record restored successfully", "success");
          } else {
            showToast("Failed to restore record", "error");
          }
        } catch (err) {
          showToast("An error occurred", "error");
        }
      }
    });
  };

  const handlePermanentDelete = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Permanently',
      message: 'Are you sure you want to permanently delete this record? This cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/kpi/${id}/force`, { 
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            fetchRecords();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            showToast("Record deleted permanently", "success");
          } else {
            showToast("Failed to delete record", "error");
          }
        } catch (err) {
          showToast("An error occurred", "error");
        }
      }
    });
  };

  const handleEmptyTrash = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Empty Trash',
      message: 'Are you sure you want to permanently delete ALL records in the trash? This cannot be undone.',
      confirmText: 'Empty Trash',
      confirmColor: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/kpi/trash/empty`, { 
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            fetchRecords();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            showToast("Trash emptied successfully", "success");
          } else {
            showToast("Failed to empty trash", "error");
          }
        } catch (err) {
          showToast("An error occurred", "error");
        }
      }
    });
  };

  const exportExcel = async () => {
    try {
      const res = await fetch(`/api/kpi/export?month=${month}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KPI_Report_${month || 'All'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Data exported successfully", "success");
    } catch (err) {
      showToast("Failed to export data", "error");
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
      kpiColumns.forEach(dbCol => {
        if (rowStrings.some(s => s === dbCol.label.toLowerCase() || s === dbCol.key.toLowerCase())) {
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
      kpiColumns.forEach(dbCol => {
        let match = headers.find(h => 
          h.toLowerCase().trim() === dbCol.label.toLowerCase().trim() || 
          h.toLowerCase().trim() === dbCol.key.toLowerCase().trim()
        );
        
        if (!match) {
          if (dbCol.key === 'response_time') match = headers.find(h => h.toLowerCase().trim().includes('resp'));
          else if (dbCol.key === 'resolve_time') match = headers.find(h => h.toLowerCase().trim().includes('res.'));
          else if (dbCol.key === 'resolved_same_day') match = headers.find(h => h.toLowerCase().trim().includes('done'));
          else if (dbCol.key === 'contact_by') match = headers.find(h => h.toLowerCase().trim() === 'via');
          else if (dbCol.key === 'problem_type') match = headers.find(h => h.toLowerCase().trim() === 'type');
          else if (dbCol.key === 'contact_name') match = headers.find(h => h.toLowerCase().trim() === 'contact');
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
    
    let mappedData = excelData.map(row => {
      const newRow: any = {};
      kpiColumns.forEach(dbCol => {
        const excelCol = columnMapping[dbCol.key];
        if (excelCol && row[excelCol] !== undefined && row[excelCol] !== "") {
          let val = row[excelCol];
          if (dbCol.key === 'create_date') {
            val = parseExcelDate(val);
          }
          newRow[dbCol.key] = val;
        }
      });
      return newRow;
    });

    fetch("/api/kpi/import-json", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}` 
      },
      body: JSON.stringify({ data: mappedData })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(`Imported ${data.count} records successfully.`, "success");
        fetchRecords();
        setShowImportModal(false);
        setImportFile(null);
      } else {
        showToast("Import failed: " + data.error, "error");
      }
    });
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {viewMode === 'trash' ? 'KPI Trash' : 'All KPI Records'}
        </h1>
        <div className="flex gap-2">
          {viewMode === 'trash' ? (
            <>
              <button onClick={() => { setViewMode('active'); setPage(1); }} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm font-medium flex items-center shadow-sm">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Active
              </button>
              <button onClick={handleEmptyTrash} className="bg-red-600 dark:bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm font-medium flex items-center shadow-sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Empty Trash
              </button>
            </>
          ) : (
            <>
              <button onClick={fetchRecords} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm font-medium flex items-center shadow-sm" title="Refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button onClick={() => { setViewMode('trash'); setPage(1); }} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm font-medium flex items-center shadow-sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Trash
              </button>
              <label className="cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium flex items-center shadow-sm">
                <Upload className="w-4 h-4 mr-2" />
                Import Excel
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileSelect} />
              </label>
              <button onClick={exportExcel} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm font-medium flex items-center shadow-sm">
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </button>
              <button onClick={() => navigate("/kpi/create")} className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors text-sm font-medium flex items-center shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Create New
              </button>
            </>
          )}
        </div>
      </div>

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {kpiColumns.map(col => (
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-4">
          <input 
            type="text" 
            placeholder="Search..." 
            className="p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" onChange={(e) => { setMonth(e.target.value); setPage(1); }}>
            <option value="">Show All</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Company</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Contact</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Via</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 min-w-[250px]">Problem</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 min-w-[250px]">Solution</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 min-w-[110px]">Resp. Time</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 min-w-[110px]">Res. Time</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Done?</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(r.create_date)}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{r.company}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{r.contact_name}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-800 dark:text-gray-200">{r.contact_by}</span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 min-w-[250px] max-w-xs whitespace-normal break-words">{r.problem}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{r.problem_type}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 min-w-[250px] max-w-xs whitespace-normal break-words">{r.solution}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-normal break-words min-w-[110px]">{r.response_time}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-normal break-words min-w-[110px]">{r.resolve_time}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${r.resolved_same_day === 'Y' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {r.resolved_same_day}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                      {viewMode === 'active' ? (
                        <>
                          <button onClick={() => navigate(`/kpi/edit/${r.id}`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3" title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Move to Trash"><Trash2 size={16} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleRestore(r.id)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 mr-3" title="Restore"><RotateCcw size={16} /></button>
                          <button onClick={() => handlePermanentDelete(r.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete Permanently"><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing <span className="font-medium">{(page - 1) * 10 + 1}</span> to <span className="font-medium">{Math.min(page * 10, total)}</span> of <span className="font-medium">{total}</span> results
          </div>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300"><ChevronLeft size={20} /></button>
            <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">{page}</span>
            <button disabled={page * 10 >= total} onClick={() => setPage(page + 1)} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
