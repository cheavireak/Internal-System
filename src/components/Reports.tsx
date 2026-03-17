import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import * as xlsx from 'xlsx';

interface Customer {
  id: number;
  create_date: string;
  customer_name: string;
  type: string;
  content: string;
  feedback_from_customer: string;
  status: string;
  sale_owner: string;
}

interface TaskReport {
  id: number;
  task_assign: string;
  time: string;
  result: string;
  created_at: string;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'support' | 'tasks'>('support');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<TaskReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ task_assign: '', time: '', result: '' });
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const fetchData = () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    Promise.all([
      fetch('/api/customers', { headers }).then(res => res.json()),
      fetch('/api/reports/tasks', { headers }).then(res => res.json())
    ]).then(([customersData, tasksData]) => {
      setCustomers(customersData);
      setTasks(tasksData);
      setLoading(false);
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/reports/tasks', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem("token")}` 
      },
      body: JSON.stringify(newTask)
    });
    setNewTask({ task_assign: '', time: '', result: '' });
    setShowTaskForm(false);
    fetchData();
  };

  const exportExcel = () => {
    const wb = xlsx.utils.book_new();
    
    const wsSupport = xlsx.utils.json_to_sheet(customers.map(c => ({
      Date: c.create_date,
      Company: c.customer_name,
      Type: c.type,
      Content: c.content,
      Feedback: c.feedback_from_customer,
      Status: c.status,
      Owner: c.sale_owner
    })));
    xlsx.utils.book_append_sheet(wb, wsSupport, 'Customer Support Records');

    const wsTasks = xlsx.utils.json_to_sheet(tasks.map(t => ({
      'Task Assign': t.task_assign,
      Time: t.time,
      Result: t.result
    })));
    xlsx.utils.book_append_sheet(wb, wsTasks, 'Task Assign Records');

    xlsx.writeFile(wb, 'Reports.xlsx');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <div className="flex gap-2">
          {activeTab === 'tasks' && (
            <button onClick={() => setShowTaskForm(!showTaskForm)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </button>
          )}
          <button onClick={exportExcel} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      {showTaskForm && (
        <form onSubmit={handleCreateTask} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-3 gap-4">
            <input type="text" placeholder="Task Assign" value={newTask.task_assign} onChange={e => setNewTask({...newTask, task_assign: e.target.value})} className="p-2 border rounded" required />
            <input type="text" placeholder="Time" value={newTask.time} onChange={e => setNewTask({...newTask, time: e.target.value})} className="p-2 border rounded" required />
            <input type="text" placeholder="Result" value={newTask.result} onChange={e => setNewTask({...newTask, result: e.target.value})} className="p-2 border rounded" required />
          </div>
          <button type="submit" className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Task Report</button>
        </form>
      )}

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button 
          onClick={() => setActiveTab('support')}
          className={`px-4 py-2 font-medium ${activeTab === 'support' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
        >
          Customer Support Records
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 font-medium ${activeTab === 'tasks' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
        >
          Task Assign Records
        </button>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading reports...</p>
        </div>
      ) : activeTab === 'support' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Content</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Feedback</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.slice((page - 1) * itemsPerPage, page * itemsPerPage).map(c => (
                <tr key={c.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{c.create_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{c.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{c.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{c.content}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{c.feedback_from_customer}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{c.status}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Task Assign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tasks.slice((page - 1) * itemsPerPage, page * itemsPerPage).map(t => (
                <tr key={t.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{t.task_assign}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{t.time}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{t.result}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-b-lg shadow">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total: <span className="font-medium">{activeTab === 'support' ? customers.length : tasks.length}</span>
          </div>
          <div className="flex gap-2 items-center">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(page - 1)} 
              className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">{page}</span>
            <button 
              disabled={page >= Math.ceil((activeTab === 'support' ? customers.length : tasks.length) / itemsPerPage) || (activeTab === 'support' ? customers.length : tasks.length) === 0} 
              onClick={() => setPage(page + 1)} 
              className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
