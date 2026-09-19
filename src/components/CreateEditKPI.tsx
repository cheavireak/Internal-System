import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { Copy, Check, ChevronDown, Search, X, RotateCcw, Building2, AlertCircle } from "lucide-react";

export default function CreateEditKPI() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    create_date: new Date().toISOString().split('T')[0],
    company: "",
    contact_name: "",
    contact_by: "Telegram",
    problem: "",
    problem_type: "Support",
    response_time: "5mn",
    resolve_time: "15mn",
    solution: "",
    resolved_same_day: "Y"
  });

  // Copied state
  const [copiedInfo, setCopiedInfo] = useState<{ id: number | string; originalDate?: string; company?: string } | null>(null);

  // Companies autocomplete list from report list
  const [companies, setCompanies] = useState<string[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick Copy modal inside CreateEditKPI
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [existingRecords, setExistingRecords] = useState<any[]>([]);
  const [searchCopyQuery, setSearchCopyQuery] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Fetch companies list from reports / customers / KPI
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/kpi/companies", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setCompanies(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error("Failed to fetch companies:", err);
      }
    };
    fetchCompanies();
  }, []);

  // Filter companies whenever input changes or company list updates
  useEffect(() => {
    const query = (formData.company || "").trim().toLowerCase();
    if (!query) {
      setFilteredCompanies(companies.slice(0, 30));
    } else {
      // Prioritize items that start with the query, followed by items that contain the query
      const startsWithMatches: string[] = [];
      const containsMatches: string[] = [];

      for (const item of companies) {
        const lower = item.toLowerCase();
        if (lower.startsWith(query)) {
          startsWithMatches.push(item);
        } else if (lower.includes(query)) {
          containsMatches.push(item);
        }
      }

      startsWithMatches.sort((a, b) => a.localeCompare(b));
      containsMatches.sort((a, b) => a.localeCompare(b));

      setFilteredCompanies([...startsWithMatches, ...containsMatches].slice(0, 30));
    }
    setHighlightedIndex(-1);
  }, [formData.company, companies]);

  // Click outside to close company dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Edit Mode or Copy Mode on initial mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const copyFromId = searchParams.get("copyFrom");

    if (id) {
      // Edit mode
      fetch(`/api/kpi/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
        .then(res => res.json())
        .then(data => {
          let cDate = data.create_date;
          if (cDate && typeof cDate === "string" && cDate.includes("T")) {
            cDate = cDate.split("T")[0];
          }
          setFormData({
            ...data,
            create_date: cDate || new Date().toISOString().split("T")[0]
          });
        })
        .catch(err => console.error("Error fetching record for edit:", err));
    } else if (location.state?.copyRecord) {
      // Direct copy passed via router state
      const rec = location.state.copyRecord;
      applyCopiedRecord(rec);
    } else if (copyFromId) {
      // Copy via URL parameter
      fetch(`/api/kpi/${copyFromId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
        .then(res => res.json())
        .then(data => {
          applyCopiedRecord(data);
        })
        .catch(err => console.error("Error fetching record to copy:", err));
    }
  }, [id, location.search, location.state]);

  const applyCopiedRecord = (rec: any) => {
    let origDate = rec.create_date;
    if (origDate && typeof origDate === "string" && origDate.includes("T")) {
      origDate = origDate.split("T")[0];
    }
    setFormData({
      create_date: new Date().toISOString().split("T")[0],
      company: rec.company || "",
      contact_name: rec.contact_name || "",
      contact_by: rec.contact_by || "Telegram",
      problem: rec.problem || "",
      problem_type: rec.problem_type || "Support",
      response_time: rec.response_time || "5mn",
      resolve_time: rec.resolve_time || "15mn",
      solution: rec.solution || "",
      resolved_same_day: rec.resolved_same_day || "Y"
    });
    setCopiedInfo({
      id: rec.id,
      originalDate: origDate,
      company: rec.company
    });
    showToast(`Data pre-filled from KPI record #${rec.id} (${rec.company || 'Unknown'})`, "info");
  };

  const resetForm = () => {
    setFormData({
      create_date: new Date().toISOString().split('T')[0],
      company: "",
      contact_name: "",
      contact_by: "Telegram",
      problem: "",
      problem_type: "Support",
      response_time: "5mn",
      resolve_time: "15mn",
      solution: "",
      resolved_same_day: "Y"
    });
    setCopiedInfo(null);
  };

  // Open copy modal to search past records
  const openCopyModal = async () => {
    setShowCopyModal(true);
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/kpi?limit=50", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExistingRecords(data.records || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleSearchCopy = async (val: string) => {
    setSearchCopyQuery(val);
    try {
      const res = await fetch(`/api/kpi?limit=50&search=${encodeURIComponent(val)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExistingRecords(data.records || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCompany = (companyName: string) => {
    setFormData({ ...formData, company: companyName });
    setShowDropdown(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setShowDropdown(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredCompanies.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredCompanies.length - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filteredCompanies.length) {
        e.preventDefault();
        handleSelectCompany(filteredCompanies[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(id ? `/api/kpi/${id}` : "/api/kpi", {
        method: id ? "PUT" : "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        showToast(id ? "Record updated successfully" : "Record created successfully", "success");
        navigate("/kpi");
      } else {
        const data = await res.json();
        showToast(`Failed to save record: ${data.error}`, "error");
      }
    } catch (err) {
      showToast("An error occurred while saving the record", "error");
    }
  };

  // Helper to highlight matching text in suggestions
  const renderHighlighted = (text: string, query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return <span>{text}</span>;
    const lowerText = text.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return <span>{text}</span>;

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + trimmed.length);
    const after = text.substring(idx + trimmed.length);

    return (
      <span>
        {before}
        <span className="font-semibold text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400">
          {match}
        </span>
        {after}
      </span>
    );
  };

  return (
    <div className="p-6 h-full">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {id ? "Edit KPI Record" : "Add KPI Record"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {id ? `Editing record #${id}` : "Create a new record or copy values from an existing record"}
            </p>
          </div>

          {!id && (
            <button
              type="button"
              onClick={openCopyModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50 rounded-lg text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
              title="Copy details from an existing record"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy From Existing Record
            </button>
          )}
        </div>

        {/* Copied Banner */}
        {copiedInfo && (
          <div className="mb-6 p-4 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-lg flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-md mt-0.5">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                  Pre-filled with data copied from Record #{copiedInfo.id} ({copiedInfo.company || 'Unnamed Company'})
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  All fields have been filled with the selected record&apos;s details. Date is set to today ({formData.create_date}). You can edit any value before saving.
                  {copiedInfo.originalDate && copiedInfo.originalDate !== formData.create_date && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, create_date: copiedInfo.originalDate! })}
                      className="ml-2 underline hover:text-indigo-900 dark:hover:text-white font-medium"
                    >
                      Use original date ({copiedInfo.originalDate})
                    </button>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 shrink-0 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              title="Clear all fields"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input 
                type="date" 
                value={formData.create_date} 
                onChange={e => setFormData({...formData, create_date: e.target.value})} 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" 
                required 
              />
            </div>

            {/* Searchable Autocomplete Company Input */}
            <div className="relative">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Company
                </label>
                {companies.length > 0 && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {companies.length} from report list
                  </span>
                )}
              </div>
              
              <div className="relative">
                <input 
                  ref={inputRef}
                  type="text" 
                  value={formData.company} 
                  onChange={e => {
                    setFormData({...formData, company: e.target.value});
                    setShowDropdown(true);
                  }} 
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type to search company (e.g. Smart Axiata, ABA...)"
                  className="w-full p-2 pr-16 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" 
                  required 
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
                  {formData.company && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, company: "" });
                        if (inputRef.current) inputRef.current.focus();
                      }}
                      className="p-1 hover:text-gray-600 dark:hover:text-gray-200"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="p-1 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Toggle company list"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Company Dropdown Suggestions */}
              {showDropdown && (
                <div 
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                  <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
                    <span>
                      {formData.company.trim() 
                        ? `${filteredCompanies.length} matching sender/company` 
                        : "Available companies from reports"}
                    </span>
                    <span className="text-[10px] text-gray-400">↑↓ to navigate, Enter to pick</span>
                  </div>

                  {filteredCompanies.length > 0 ? (
                    <ul className="py-1">
                      {filteredCompanies.map((cName, idx) => {
                        const isSelected = formData.company === cName;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <li key={cName}>
                            <button
                              type="button"
                              onClick={() => handleSelectCompany(cName)}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                                isHighlighted
                                  ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-900 dark:text-white"
                                  : isSelected
                                  ? "bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                                  : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate">
                                  {renderHighlighted(cName, formData.company)}
                                </span>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">
                      No matching company in report list.
                      <p className="mt-0.5 text-gray-400 dark:text-gray-500">
                        You can keep &quot;{formData.company}&quot; as a new company name.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
              <input 
                type="text" 
                value={formData.contact_name} 
                onChange={e => setFormData({...formData, contact_name: e.target.value})} 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" 
                required 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact By</label>
              <select 
                value={formData.contact_by} 
                onChange={e => setFormData({...formData, contact_by: e.target.value})} 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
              >
                {['Telegram', 'WeChat', 'Line', 'WhatsApp', 'Microsoft Teams', 'Other'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Problem</label>
            <textarea 
              value={formData.problem} 
              onChange={e => setFormData({...formData, problem: e.target.value})} 
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" 
              rows={3} 
              required 
            />
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                <select 
                  value={formData.problem_type} 
                  onChange={e => setFormData({...formData, problem_type: e.target.value})} 
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {['Support', 'API', 'Webportal', 'Other'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resp. Time</label>
                <select 
                  value={formData.response_time} 
                  onChange={e => setFormData({...formData, response_time: e.target.value})} 
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {['under 1mn', '2mn', '5mn', '10mn', '15mn', '30mn', '1h', '2h'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resolve Time</label>
                <select 
                  value={formData.resolve_time} 
                  onChange={e => setFormData({...formData, resolve_time: e.target.value})} 
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {['2mn', '5mn', '10mn', '15mn', '30mn', '1h', '2h'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resolved Today</label>
                <select 
                  value={formData.resolved_same_day} 
                  onChange={e => setFormData({...formData, resolved_same_day: e.target.value})} 
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Solution</label>
            <textarea 
              value={formData.solution} 
              onChange={e => setFormData({...formData, solution: e.target.value})} 
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" 
              rows={3} 
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              {copiedInfo && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Duplicating from Record #{copiedInfo.id}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => navigate("/kpi")} 
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {id ? "Save Changes" : (copiedInfo ? "Create Record (Copied)" : "Save Record")}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Copy Picker Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Copy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Copy From Existing KPI Record
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Pick any record to copy all its fields into the current form
                </p>
              </div>
              <button 
                onClick={() => setShowCopyModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter in modal */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by company, contact, or problem..."
                  value={searchCopyQuery}
                  onChange={e => handleSearchCopy(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
            </div>

            {/* List of records */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingRecords ? (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading KPI records...
                </div>
              ) : existingRecords.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No records found matching your query.
                </div>
              ) : (
                existingRecords.map(rec => (
                  <div 
                    key={rec.id}
                    className="p-3 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {rec.company || "Unnamed Company"}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded font-medium">
                          {rec.problem_type || "Support"}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {rec.create_date ? (typeof rec.create_date === 'string' && rec.create_date.includes('T') ? rec.create_date.split('T')[0] : rec.create_date) : "-"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-1">
                        <strong className="text-gray-500 dark:text-gray-400 font-normal">Contact:</strong> {rec.contact_name || "-"} ({rec.contact_by || "Telegram"})
                        {rec.problem && <> • <strong className="text-gray-500 dark:text-gray-400 font-normal">Problem:</strong> {rec.problem}</>}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        applyCopiedRecord(rec);
                        setShowCopyModal(false);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy This
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
