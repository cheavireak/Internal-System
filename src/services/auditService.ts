export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'delete_permanent' | 'restore' | 'import' | 'login' | 'login_failed' | 'clear_trash' | 'empty_trash' | 'other';
  entity: 'customer' | 'user' | 'system' | 'kpi' | 'report' | 'task_report';
  entityId?: string;
  details: string;
  userId?: string;
  userName?: string;
  timestamp: string;
  ip_address?: string;
}

export const getLogs = async (): Promise<AuditLog[]> => {
  const token = localStorage.getItem('token');
  if (!token) return [];
  
  try {
    const res = await fetch('/api/audit-logs', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch logs: ${res.status} ${res.statusText} - ${errorText}`);
    }
    return await res.json();
  } catch (e) {
    console.error("Error fetching audit logs:", e);
    return [];
  }
};

export const addLog = async (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(log)
    });
  } catch (e) {
    console.error("Error adding audit log:", e);
  }
};

export const clearLogs = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await fetch('/api/audit-logs', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (e) {
    console.error("Error clearing audit logs:", e);
  }
};
