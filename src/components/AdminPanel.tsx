import React, { useState, useEffect } from "react";
import { UserPlus, Shield, Key, Trash2, Edit2, X, Save, Power, PowerOff, AlertTriangle, RefreshCw } from "lucide-react";
import TrashModal from "./TrashModal";
import { useToast } from "../contexts/ToastContext";

const AVAILABLE_MENUS = [
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

export default function AdminPanel({ currentUser }: { currentUser?: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "user", name: "" });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<{id: number, email: string} | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmAction, setConfirmAction] = useState<{type: 'delete', user: any} | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const { showToast } = useToast();

  const fetchUsers = () => {
    fetch("/api/users", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error("Expected array of users, got:", data);
      }
    })
    .catch(err => console.error("Error fetching users:", err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'manager' && newUser.role === 'admin') {
      showToast("Managers cannot create admin users.", "error");
      return;
    }
    
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(newUser)
      });
      
      if (res.ok) {
        setNewUser({ email: "", password: "", role: "user", name: "" });
        fetchUsers();
        showToast("User created successfully", "success");
      } else {
        const data = await res.json();
        showToast(`Failed to create user: ${data.error || 'Unknown error'}`, "error");
      }
    } catch (err) {
      console.error("Error creating user:", err);
      showToast("An error occurred while creating the user.", "error");
    }
  };

  const submitResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    
    try {
      const res = await fetch(`/api/users/${resetPasswordUser.id}/password`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (res.ok) {
        showToast("Password updated successfully.", "success");
        setResetPasswordUser(null);
        setNewPassword("");
      } else {
        const data = await res.json();
        showToast(`Failed to update password: ${data.error || 'Unknown error'}`, "error");
      }
    } catch (err) {
      console.error("Error updating password:", err);
      showToast("An error occurred while updating the password.", "error");
    }
  };

  const handleDeleteUser = (user: any) => {
    if (user.is_superadmin) {
      showToast("The superadmin user cannot be deleted.", "error");
      return;
    }
    if (currentUser?.role === 'manager' && user.role === 'admin') {
      showToast("Managers cannot delete admin users.", "error");
      return;
    }
    setConfirmAction({ type: 'delete', user });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    
    try {
      if (type === 'delete') {
        const res = await fetch(`/api/users/${user.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            fetchUsers();
            showToast("User deleted successfully", "success");
        }
        else showToast(`Failed to delete user: ${(await res.json()).error}`, "error");
      }
    } catch (err) {
      console.error(`Error executing ${type}:`, err);
      showToast("An error occurred.", "error");
    } finally {
      setConfirmAction(null);
    }
  };

  const handleEditUser = (user: any) => {
    if (currentUser?.role === 'manager' && user.role === 'admin') {
      showToast("Managers cannot edit admin users.", "error");
      return;
    }
    const defaultPerms = {
      menus: ['NewIntegration', 'SandboxToProduction', 'Delay', 'Lost', 'Expired', 'SMPP', 'Reports', 'InternalReports', 'SMS', ...(user.role === 'admin' ? ['AdminPanel', 'AuditLogs'] : [])],
      can_create: user.role === 'manager' || user.role === 'admin',
      can_edit: user.role === 'manager' || user.role === 'admin',
      can_delete: user.role === 'admin',
      can_move: user.role === 'manager' || user.role === 'admin',
      can_import: user.role === 'admin',
      can_export: user.role === 'admin',
      can_manage_columns: user.role === 'admin',
      can_delete_audit_logs: user.role === 'admin',
      can_view_dashboard: true,
      can_view_sms_logs: true,
      can_view_reports: true,
      can_view_internal_reports: true,
      can_view_kpi: true,
      can_view_audit_logs: user.role === 'admin',
      can_manage_users: user.role === 'admin',
      can_manage_settings: user.role === 'admin',
      can_restore_records: user.role === 'admin',
      can_empty_trash: user.role === 'admin',
      can_send_sms: user.role === 'admin' || user.role === 'manager'
    };
    
    let currentPerms;
    if (user.permissions) {
      if (Array.isArray(user.permissions)) {
        currentPerms = { ...defaultPerms, menus: user.permissions };
      } else {
        currentPerms = { ...defaultPerms, ...user.permissions };
      }
    } else {
      currentPerms = defaultPerms;
    }

    setEditingUser({
      ...user,
      permissions: currentPerms
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    let finalPermissions = { ...editingUser.permissions };
    
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          email: editingUser.email,
          role: editingUser.role,
          name: editingUser.name,
          permissions: finalPermissions,
          is_disabled: editingUser.is_disabled,
          ip_whitelist: editingUser.ip_whitelist
        })
      });
      
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
        showToast("User updated successfully", "success");
      } else {
        const data = await res.json();
        showToast(`Failed to update user: ${data.error || 'Unknown error'}`, "error");
      }
    } catch (err) {
      console.error("Error updating user:", err);
      showToast("An error occurred while updating the user.", "error");
    }
  };

  const toggleMenuPermission = (menuId: string) => {
    if (!editingUser) return;
    const menus = editingUser.permissions.menus || [];
    const newMenus = menus.includes(menuId) 
      ? menus.filter((m: string) => m !== menuId)
      : [...menus, menuId];
      
    setEditingUser({
      ...editingUser,
      permissions: { ...editingUser.permissions, menus: newMenus }
    });
  };

  const toggleActionPermission = (action: string) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      permissions: { 
        ...editingUser.permissions, 
        [action]: !editingUser.permissions[action] 
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Admin Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage users, roles, and system configuration.</p>
      </div>

      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reset Password</h2>
              <button onClick={() => { setResetPasswordUser(null); setNewPassword(""); }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter a new password for <strong>{resetPasswordUser.email}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input 
                  type="password" 
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
              <button onClick={() => { setResetPasswordUser(null); setNewPassword(""); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-sm transition-colors">
                Cancel
              </button>
              <button 
                onClick={submitResetPassword} 
                disabled={!newPassword}
                className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 font-medium text-sm flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 flex items-start space-x-4">
              <div className="p-3 rounded-full shrink-0 bg-red-100 text-red-600 dark:text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="pt-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Move to Trash
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Are you sure you want to move {confirmAction.user.email} to trash? It will be kept for 30 days.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
              <button 
                onClick={() => setConfirmAction(null)} 
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeConfirmAction} 
                className="px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors flex items-center bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit User: {editingUser.name}</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input type="text" className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select 
                    className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                    value={editingUser.role} 
                    onChange={e => {
                      const newRole = e.target.value;
                      const newMenus = newRole === 'user' 
                        ? (editingUser.permissions.menus || []).filter((m: string) => m !== 'AdminPanel')
                        : editingUser.permissions.menus;
                      setEditingUser({
                        ...editingUser, 
                        role: newRole,
                        permissions: { ...editingUser.permissions, menus: newMenus }
                      });
                    }}
                    disabled={editingUser.is_superadmin || (currentUser?.role === 'manager' && editingUser.role === 'admin')}
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    {currentUser?.role === 'admin' && <option value="admin">Admin</option>}
                  </select>
                  {editingUser.is_superadmin && <p className="text-xs text-gray-500 mt-1">Superadmin role cannot be changed.</p>}
                </div>
              </div>

              {!editingUser.is_superadmin && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 border-b pb-2">Account Status</h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        checked={!!editingUser.is_disabled}
                        onChange={e => setEditingUser({...editingUser, is_disabled: e.target.checked})}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Disable Account</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-7">If checked, this user will not be able to log in to the system.</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 border-b pb-2">Menu Access</h3>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_MENUS.map(menu => {
                    if (menu.id === 'AdminPanel' && editingUser.role === 'user') return null;
                    return (
                      <label key={menu.id} className={`flex items-center space-x-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900/50 border border-transparent hover:border-gray-200 transition-colors ${editingUser.is_superadmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                          checked={(editingUser.permissions.menus || []).includes(menu.id) || editingUser.is_superadmin}
                          onChange={() => !editingUser.is_superadmin && toggleMenuPermission(menu.id)}
                          disabled={editingUser.is_superadmin}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{menu.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 border-b pb-2">Action Permissions</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'can_create', label: 'Create Records' },
                    { id: 'can_edit', label: 'Edit Records' },
                    { id: 'can_delete', label: 'Delete Records' },
                    { id: 'can_move', label: 'Move Records' },
                    { id: 'can_import', label: 'Import Excel' },
                    { id: 'can_export', label: 'Export Excel' },
                    { id: 'can_manage_columns', label: 'Manage Columns' },
                    { id: 'can_delete_audit_logs', label: 'Delete Audit Logs' },
                    { id: 'can_view_dashboard', label: 'View Dashboard' },
                    { id: 'can_view_sms_logs', label: 'View SMS Logs' },
                    { id: 'can_view_reports', label: 'View Reports' },
                    { id: 'can_view_internal_reports', label: 'View Internal Reports' },
                    { id: 'can_view_kpi', label: 'View KPI' },
                    { id: 'can_view_audit_logs', label: 'View Audit Logs' },
                    { id: 'can_manage_users', label: 'Manage Users' },
                    { id: 'can_manage_settings', label: 'Manage Settings' },
                    { id: 'can_restore_records', label: 'Restore Records' },
                    { id: 'can_empty_trash', label: 'Empty Trash' },
                    { id: 'can_send_sms', label: 'Send SMS' }
                  ].map(action => {
                    if (action.id === 'can_delete_audit_logs' && editingUser.role !== 'admin') return null;
                    return (
                    <label key={action.id} className={`flex items-center space-x-3 p-2 rounded hover:bg-gray-50 dark:bg-gray-900/50 border border-transparent hover:border-gray-200 transition-colors ${editingUser.is_superadmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                        checked={!!editingUser.permissions[action.id] || editingUser.is_superadmin}
                        onChange={() => !editingUser.is_superadmin && toggleActionPermission(action.id)}
                        disabled={editingUser.is_superadmin}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                    </label>
                  );
                })}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 sticky bottom-0">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 font-medium text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveUser} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center transition-colors">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-indigo-600" />
              Add New User
            </h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" required className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input type="email" required className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input type="password" required className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  {currentUser?.role === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>
              <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors mt-4">
                Create User
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Shield className="w-5 h-5 mr-2 text-indigo-600" />
                User Management
              </h2>
              {(currentUser?.permissions?.can_restore_records || currentUser?.permissions?.can_empty_trash) && (
                <button 
                  onClick={() => setShowTrashModal(true)}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Recycle Bin
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:bg-gray-900/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <span className={user.is_disabled ? 'text-gray-400 line-through' : ''}>{user.name}</span>
                          {user.is_superadmin && <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">Superadmin</span>}
                          {user.is_disabled && <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">Disabled</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <span className={user.is_disabled ? 'text-gray-400 line-through' : ''}>{user.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                            user.role === 'manager' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800 dark:text-gray-200'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3">
                        {!(currentUser?.role === 'manager' && user.role === 'admin') && (
                          <button onClick={() => handleEditUser(user)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 flex items-center transition-colors" title="Edit User">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {!user.is_superadmin && !(currentUser?.role === 'manager' && user.role === 'admin') && (
                          <button onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-900 flex items-center transition-colors" title="Move to Trash">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {!(currentUser?.role === 'manager' && user.role === 'admin') && (
                          <button onClick={() => setResetPasswordUser({ id: user.id, email: user.email })} className="text-indigo-600 hover:text-indigo-900 flex items-center transition-colors" title="Reset Password">
                            <Key className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <TrashModal 
        type="user" 
        isOpen={showTrashModal} 
        onClose={() => setShowTrashModal(false)} 
        onRestore={fetchUsers} 
        user={currentUser}
      />
    </div>
  );
}
