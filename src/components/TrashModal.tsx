import React, { useState, useEffect } from "react";
import { X, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface TrashModalProps {
  type: 'user' | 'customer';
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void; // Callback to refresh parent list
  user?: any;
}

export default function TrashModal({ type, isOpen, onClose, onRestore, user }: TrashModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const { showToast } = useToast();

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const endpoint = type === 'user' ? '/api/users/trash' : '/api/customers/trash';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch trash:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrash();
    }
  }, [isOpen, type]);

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      const endpoint = type === 'user' ? `/api/users/${id}/restore` : `/api/customers/${id}/restore`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (res.ok) {
        setItems(items.filter(item => item.id !== id));
        onRestore();
        showToast("Item restored successfully", "success");
      } else {
        showToast("Failed to restore item", "error");
      }
    } catch (error) {
      console.error("Restore failed:", error);
      showToast("An error occurred while restoring", "error");
    } finally {
      setRestoringId(null);
    }
  };

  const [clearConfirm, setClearConfirm] = useState(false);

  const handleDelete = async (id: number) => {
    try {
      const endpoint = type === 'user' ? `/api/users/${id}/permanent` : `/api/customers/${id}/permanent`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (res.ok) {
        setItems(items.filter(item => item.id !== id));
        onRestore();
        showToast("Item deleted permanently", "success");
      } else {
        showToast("Failed to delete item", "error");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      showToast("An error occurred while deleting", "error");
    }
  };

  const handleClearTrash = async () => {
    try {
      const endpoint = type === 'user' ? '/api/users/trash/clear' : '/api/customers/trash/clear';
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (res.ok) {
        setItems([]);
        onRestore();
        setClearConfirm(false);
        showToast("Trash cleared successfully", "success");
      } else {
        showToast("Failed to clear trash", "error");
      }
    } catch (error) {
      console.error("Clear trash failed:", error);
      showToast("An error occurred while clearing trash", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {type === 'user' ? 'User Recycle Bin' : 'Customer Recycle Bin'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (user?.permissions?.can_empty_trash) && (
              <button 
                onClick={() => setClearConfirm(true)}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
              >
                Clear Trash
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>The recycle bin is empty.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-300 transition-colors">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {type === 'user' ? item.name : item.customer_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {type === 'user' ? item.email : (item.pipeline_stage || 'Unknown Stage')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Deleted: {item.deleted_at ? new Date(item.deleted_at).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.permissions?.can_restore_records && (
                      <button
                        onClick={() => handleRestore(item.id)}
                        disabled={restoringId === item.id}
                        className="flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        {restoringId === item.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2 text-green-600" />
                        )}
                        Restore
                      </button>
                    )}
                    {user?.permissions?.can_empty_trash && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex items-center px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {clearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Clear Trash</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to permanently delete all items in the trash? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setClearConfirm(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearTrash}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl text-xs text-gray-500 dark:text-gray-400 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
          Items in the recycle bin will be permanently deleted after 30 days.
        </div>
      </div>
    </div>
  );
}
