import React, { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, Layout, Settings as SettingsIcon, Database, Download, Upload, Trash2, RefreshCw, Clock } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface SettingsProps {
  currentUser?: any;
  refreshHiddenMenus: () => void;
  hiddenMenus: string[];
  sessionTimeout: number;
  setSessionTimeout: (timeout: number) => void;
}

const AVAILABLE_MENUS = [
  { id: 'Dashboard', label: 'Weekly Summary' },
  { id: 'NewIntegration', label: 'New Integration' },
  { id: 'SandboxToProduction', label: 'Sandbox → Production' },
  { id: 'Delay', label: 'Delay Project' },
  { id: 'Lost', label: 'Lost API Leads' },
  { id: 'Expired', label: 'Expired' },
  { id: 'SMPP', label: 'SMPP' },
  { id: 'Reports', label: 'Reports' },
  { id: 'InternalReports', label: 'Internal Reports' },
  { id: 'SMS', label: 'SMS' },
  { id: 'AdminPanel', label: 'Admin Panel' },
  { id: 'AuditLogs', label: 'Audit Logs' }
];

export default function Settings({ currentUser, refreshHiddenMenus, hiddenMenus = [], sessionTimeout, setSessionTimeout }: SettingsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempTimeout, setTempTimeout] = useState(sessionTimeout);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState("");
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'restore' | 'delete', filename: string } | null>(null);
  const [isBackupsVisible, setIsBackupsVisible] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<string>('');
  const { showToast } = useToast();

  useEffect(() => {
    setTempTimeout(sessionTimeout);
  }, [sessionTimeout]);

  useEffect(() => {
    // Fetch initial IP whitelist settings
    fetch("/api/settings/ip_whitelist", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => res.json())
    .then(data => {
      setIpWhitelist(data.value || "");
      setIpWhitelistEnabled(!!data.enabled);
    })
    .catch(err => console.error("Failed to fetch IP whitelist", err));
    
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const response = await fetch("/api/backup", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (e) {
      console.error("Failed to fetch backups", e);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async (filename?: string) => {
    try {
      const response = await fetch("/api/backup/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify(filename ? { filename } : {})
      });
      if (response.ok) {
        showToast(filename ? "Backup overwritten successfully" : "Backup created successfully", "success");
        fetchBackups();
        setShowBackupModal(false);
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to create backup", "error");
      }
    } catch (e) {
      showToast("Failed to create backup", "error");
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    setConfirmAction(null);
    setRestoring(filename);
    try {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify({ filename })
      });
      
      if (response.ok) {
        showToast("Database restored successfully.", "success");
        fetchBackups();
        setRestoring(null);
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to restore backup", "error");
        setRestoring(null);
      }
    } catch (e) {
      showToast("Failed to restore backup", "error");
      setRestoring(null);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const response = await fetch(`/api/backup/download/${filename}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to download backup", "error");
      }
    } catch (e) {
      showToast("Failed to download backup", "error");
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    setConfirmAction(null);
    try {
      const response = await fetch(`/api/backup/${filename}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (response.ok) {
        showToast("Backup deleted successfully", "success");
        fetchBackups();
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to delete backup", "error");
      }
    } catch (e) {
      showToast("Failed to delete backup", "error");
    }
  };

  const handleUploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/backup/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData
      });
      
      if (response.ok) {
        showToast("Backup uploaded successfully", "success");
        fetchBackups();
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to upload backup", "error");
      }
    } catch (e) {
      showToast("Failed to upload backup", "error");
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleSaveIpWhitelist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/settings/ip_whitelist", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ value: ipWhitelist, enabled: ipWhitelistEnabled }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save IP whitelist");
      }
      
      // Refetch to get the potentially auto-added IP
      const updatedRes = await fetch("/api/settings/ip_whitelist", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const updatedData = await updatedRes.json();
      setIpWhitelist(updatedData.value || "");
      setIpWhitelistEnabled(!!updatedData.enabled);
      
      showToast("IP whitelist settings saved successfully!", "success");
    } catch (err: any) {
      setError(err.message || "Failed to save IP whitelist");
      showToast(err.message || "Failed to save IP whitelist", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTimeout = async () => {
    if (tempTimeout < 0.10) {
      setError("Minimum session timeout is 0.10 minutes.");
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const response = await fetch("/api/settings/session_timeout", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ value: tempTimeout }),
      });
      if (!response.ok) throw new Error("Failed to save session timeout");
      setSessionTimeout(tempTimeout);
      localStorage.setItem("sessionTimeout", String(tempTimeout));
      showToast("Session timeout saved successfully!", "success");
    } catch (err) {
      setError("Failed to save session timeout");
      showToast("Failed to save session timeout", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateHiddenMenus = async (newHiddenMenus: string[]) => {
    try {
      const response = await fetch("/api/settings/hidden_menus", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ value: newHiddenMenus })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`);
      }
      
      console.log("Settings updated successfully");
      refreshHiddenMenus();
      showToast("Menu visibility updated successfully", "success");
    } catch (e) {
      console.error("Failed to update settings", e);
      setError(e instanceof Error ? e.message : "Failed to update settings");
      showToast("Failed to update menu visibility", "error");
    }
  };

  const toggleGlobalMenu = async (menuId: string) => {
    const newHiddenMenus = hiddenMenus.includes(menuId)
      ? hiddenMenus.filter(m => m !== menuId)
      : [...hiddenMenus, menuId];
    updateHiddenMenus(newHiddenMenus);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            System Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage global application settings and preferences.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Database Backup Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Database Backup & Restore</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage system backups. Auto-backups run every 12 hours.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsBackupsVisible(!isBackupsVisible)} 
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                {isBackupsVisible ? 'Hide Backups' : 'Show Backups'}
              </button>
              {currentUser?.role === 'admin' && (
                <label className="cursor-pointer px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Backup
                  <input type="file" accept=".sql" className="hidden" onChange={handleUploadBackup} />
                </label>
              )}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => {
                    setSelectedBackupFile('');
                    setShowBackupModal(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Backup Now
                </button>
              )}
            </div>
          </div>
        </div>
        
        {isBackupsVisible && (
          <div className="p-6">
            {loadingBackups ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No backups found.
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700">
                        <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{backup.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(backup.createdAt).toLocaleString()}
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                          {(backup.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmAction({ type: 'restore', filename: backup.name })}
                        disabled={!!restoring}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors disabled:opacity-50"
                      >
                        {restoring === backup.name ? 'Restoring...' : 'Restore'}
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => handleDownloadBackup(backup.name)}
                          disabled={!!restoring}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                          title="Download Backup"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'delete', filename: backup.name })}
                          disabled={!!restoring}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                          title="Delete Backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Menu Visibility Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Global Menu Visibility</h2>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsMenuVisible(!isMenuVisible)} 
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
              >
                {isMenuVisible ? 'Hide Menu' : 'Show Menu'}
              </button>
            </div>
          </div>
          
          {isMenuVisible && (
            <div className="p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Control which menu items are visible in the sidebar for all users. 
                Hiding a menu here removes it for everyone, regardless of their individual permissions.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AVAILABLE_MENUS.map(menu => {
                  const isHidden = hiddenMenus.includes(menu.id);
                  return (
                    <div 
                      key={menu.id}
                      onClick={() => toggleGlobalMenu(menu.id)}
                      className={`
                        relative flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200
                        ${isHidden 
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-75' 
                          : 'border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20'
                        }
                        hover:border-indigo-300 dark:hover:border-indigo-700
                      `}
                    >
                      <div className={`
                        p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 mr-3 transition-colors
                        ${isHidden 
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' 
                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        }
                      `}>
                        {isHidden ? <EyeOff className="w-4 h-4" strokeWidth={2.5} /> : <Eye className="w-4 h-4" strokeWidth={2.5} />}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium ${isHidden ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {menu.label}
                        </h3>
                      </div>

                      <div className={`
                        w-4 h-4 rounded-full border flex items-center justify-center
                        ${isHidden 
                          ? 'border-gray-300 dark:border-gray-600' 
                          : 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                        }
                      `}>
                        {!isHidden && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Session Timeout Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security & Session</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure automatic session timeout for inactivity.
          </p>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Timeout Duration (minutes):</label>
            <input 
              type="number"
              min="0.10"
              step="0.01"
              className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 w-24"
              value={tempTimeout}
              onChange={(e) => setTempTimeout(Number(e.target.value))}
            />
            <button
              onClick={handleSaveTimeout}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* IP Whitelist Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IP Whitelist</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={ipWhitelistEnabled}
                onChange={(e) => setIpWhitelistEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                {ipWhitelistEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Restrict access to specific IP addresses (IPv4, IPv6..). Separate multiple IPs with a semicolon (;).
          </p>
          <div className="flex items-center gap-4">
            <input 
              type="text"
              className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 w-full"
              placeholder="e.g., 192.168.1.1;10.0.0.1"
              value={ipWhitelist}
              onChange={(e) => setIpWhitelist(e.target.value)}
              disabled={!ipWhitelistEnabled}
            />
            <button
              onClick={handleSaveIpWhitelist}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create Backup
            </h3>
            
            <div className="mb-6 space-y-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <input 
                  type="radio" 
                  name="backupType" 
                  checked={selectedBackupFile === ''} 
                  onChange={() => setSelectedBackupFile('')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Create New Backup</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Generate a new backup file with current timestamp</div>
                </div>
              </label>

              {backups.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Or overwrite existing backup:</div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    {backups.map(backup => (
                      <label key={backup.name} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input 
                          type="radio" 
                          name="backupType" 
                          checked={selectedBackupFile === backup.name} 
                          onChange={() => setSelectedBackupFile(backup.name)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{backup.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(backup.createdAt).toLocaleString()} • {(backup.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateBackup(selectedBackupFile || undefined)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                {selectedBackupFile ? 'Overwrite Backup' : 'Create Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {confirmAction.type === 'restore' ? 'Confirm Restore' : 'Confirm Delete'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {confirmAction.type === 'restore' 
                ? `Are you sure you want to restore from ${confirmAction.filename}? This will overwrite the current database.`
                : `Are you sure you want to delete backup ${confirmAction.filename}?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'restore') {
                    handleRestoreBackup(confirmAction.filename);
                  } else {
                    handleDeleteBackup(confirmAction.filename);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmAction.type === 'restore' 
                    ? 'bg-indigo-600 hover:bg-indigo-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction.type === 'restore' ? 'Restore' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
