import { useState, useEffect } from 'react';
import { AuditLog, getLogs, clearLogs, addLog } from '../services/auditService';
import { Search, Trash2, RefreshCw, ChevronLeft, ChevronRight, Download, AlertTriangle, Filter, X, ShieldBan, Unlock } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function AuditLogs({ user }: { user?: any }) {
  const [activeTab, setActiveTab] = useState<'logs' | 'blocked_ips'>('logs');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [blockedIps, setBlockedIps] = useState<any[]>([]);
  const [newBlockIp, setNewBlockIp] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const itemsPerPage = 20;
  const { showToast } = useToast();

  // Check permissions
  const canDeleteLogs = user?.is_superadmin || (user?.role === 'admin' && user?.permissions?.can_delete_audit_logs);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [userOrIpFilter, setUserOrIpFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [detailsFilter, setDetailsFilter] = useState('');

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    } else {
      loadBlockedIps();
    }
  }, [activeTab]);

  const loadLogs = async () => {
    setIsLoading(true);
    const data = await getLogs();
    setLogs(data);
    setCurrentPage(1);
    setIsLoading(false);
  };

  const loadBlockedIps = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/blocked-ips', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setBlockedIps(await res.json());
      }
    } catch (e) {
      console.error('Failed to load blocked IPs', e);
    }
    setIsLoading(false);
  };

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockIp) return;
    try {
      const res = await fetch('/api/blocked-ips/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ip: newBlockIp })
      });
      if (res.ok) {
        showToast(`IP ${newBlockIp} blocked successfully`, 'success');
        setNewBlockIp('');
        loadBlockedIps();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to block IP', 'error');
      }
    } catch (e) {
      showToast('An error occurred', 'error');
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      const res = await fetch('/api/blocked-ips/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ip })
      });
      if (res.ok) {
        showToast(`IP ${ip} unblocked successfully`, 'success');
        loadBlockedIps();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to unblock IP', 'error');
      }
    } catch (e) {
      showToast('An error occurred', 'error');
    }
  };

  const handleClearLogs = async () => {
    await clearLogs();
    await loadLogs();
    setShowClearConfirm(false);
    showToast("Audit logs cleared successfully", "success");
  };

  const handleBackupLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `audit_logs_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Log the action
    if (user) {
      addLog({
        action: 'other',
        entity: 'system',
        details: `Downloaded Audit Logs Backup: ${filename}`,
        userId: user.id,
        userName: user.name
      });
      // Refresh logs to show the new entry immediately
      // We need to wait a brief moment for the log to be saved to local storage before reloading
      setTimeout(loadLogs, 100);
    }
    showToast("Audit logs backed up successfully", "success");
  };

  const clearFilters = () => {
    setDateFilter('');
    setUserOrIpFilter('');
    setActionFilter('');
    setEntityFilter('');
    setDetailsFilter('');
    setCurrentPage(1);
  };

  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
    const matchesDate = !dateFilter || logDate === dateFilter;
    const matchesUserOrIp = !userOrIpFilter || 
      (log.userName && log.userName.toLowerCase().includes(userOrIpFilter.toLowerCase())) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(userOrIpFilter.toLowerCase()));
    const matchesAction = !actionFilter || log.action.toLowerCase().includes(actionFilter.toLowerCase());
    const matchesEntity = !entityFilter || log.entity.toLowerCase().includes(entityFilter.toLowerCase());
    const matchesDetails = !detailsFilter || log.details.toLowerCase().includes(detailsFilter.toLowerCase());

    return matchesDate && matchesUserOrIp && matchesAction && matchesEntity && matchesDetails;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Audit Logs</h1>
          <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'logs' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('blocked_ips')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'blocked_ips' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Blocked IPs
            </button>
          </div>
        </div>
        
        {activeTab === 'logs' && (
          <div className="flex gap-2">
            <button onClick={loadLogs} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title="Refresh Logs">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={handleBackupLogs} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Backup Logs">
              <Download className="w-5 h-5" />
            </button>
            {canDeleteLogs && (
              <button onClick={() => setShowClearConfirm(true)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Clear All Logs">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'logs' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col flex-1">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </h3>
            {(dateFilter || userOrIpFilter || actionFilter || entityFilter || detailsFilter) && (
              <button onClick={clearFilters} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center">
                <X className="w-3 h-3 mr-1" />
                Clear Filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <input
                type="date"
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                placeholder="Filter by Date"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Filter User or IP..."
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                value={userOrIpFilter}
                onChange={(e) => { setUserOrIpFilter(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div>
              <select
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="delete_permanent">Delete Permanent</option>
                <option value="restore">Restore</option>
                <option value="import">Import</option>
                <option value="login">Login</option>
                <option value="login_failed">Login Failed</option>
                <option value="clear_trash">Clear Trash</option>
                <option value="empty_trash">Empty Trash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <select
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Entities</option>
                <option value="customer">Customer</option>
                <option value="user">User</option>
                <option value="system">System</option>
                <option value="kpi">KPI</option>
                <option value="report">Report</option>
                <option value="task_report">Task Report</option>
              </select>
            </div>
            <div>
              <input
                type="text"
                placeholder="Filter Details..."
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                value={detailsFilter}
                onChange={(e) => { setDetailsFilter(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 w-48">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 w-32">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 w-48">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 w-32">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 w-32">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading logs...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {log.userName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${log.action === 'create' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                            log.action === 'delete' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                            log.action === 'delete_permanent' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' : 
                            log.action === 'update' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 
                            log.action === 'login' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                            log.action === 'login_failed' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                            log.action === 'restore' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                            log.action === 'import' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' :
                            ['clear_trash', 'empty_trash'].includes(log.action) ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 uppercase">
                        {log.entity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-normal break-words">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                  {paginatedLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No logs found matching the filters.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="font-medium">{filteredLogs.length}</span> results
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col flex-1">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <form onSubmit={handleBlockIp} className="flex gap-4 items-end">
              <div className="flex-1 max-w-sm">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Block New IP Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.1.1"
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                  value={newBlockIp}
                  onChange={(e) => setNewBlockIp(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center transition-colors h-[38px]"
              >
                <ShieldBan className="w-4 h-4 mr-2" />
                Block IP
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Blocked At</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center space-x-2 text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span>Loading blocked IPs...</span>
                      </div>
                    </td>
                  </tr>
                ) : blockedIps.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No blocked IP addresses found.
                    </td>
                  </tr>
                ) : (
                  blockedIps.map((ip) => (
                    <tr key={ip.ip} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {ip.ip}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(ip.blocked_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleUnblockIp(ip.ip)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center justify-end w-full"
                        >
                          <Unlock className="w-4 h-4 mr-1" />
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 flex items-start space-x-4">
              <div className="p-3 rounded-full shrink-0 bg-red-100 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="pt-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Clear All Logs
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Are you sure you want to permanently delete all audit logs? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
              <button 
                onClick={() => setShowClearConfirm(false)} 
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearLogs} 
                className="px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors flex items-center bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600"
              >
                Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
