import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";

export default function CreateEditKPI() {
  const { id } = useParams();
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

  useEffect(() => {
    if (id) {
      fetch(`/api/kpi/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
        .then(res => res.json())
        .then(data => setFormData(data));
    }
  }, [id]);

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

  return (
    <div className="p-6 h-full">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4">{id ? "Edit" : "Add"} KPI Record</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input type="date" value={formData.create_date} onChange={e => setFormData({...formData, create_date: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
              <input type="text" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData({...formData, contact_name: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact By</label>
              <select value={formData.contact_by} onChange={e => setFormData({...formData, contact_by: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500">
                {['Telegram', 'WeChat', 'Line', 'WhatsApp', 'Microsoft Teams', 'Other'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Problem</label>
            <textarea value={formData.problem} onChange={e => setFormData({...formData, problem: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" rows={3} required />
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                <select value={formData.problem_type} onChange={e => setFormData({...formData, problem_type: e.target.value})} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  {['Support', 'API', 'Webportal', 'Other'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resp. Time</label>
                <select value={formData.response_time} onChange={e => setFormData({...formData, response_time: e.target.value})} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  {['under 1mn', '2mn', '5mn', '10mn', '15mn', '30mn', '1h', '2h'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resolve Time</label>
                <select value={formData.resolve_time} onChange={e => setFormData({...formData, resolve_time: e.target.value})} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  {['2mn', '5mn', '10mn', '15mn', '30mn', '1h', '2h'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resolved Today</label>
                <select value={formData.resolved_same_day} onChange={e => setFormData({...formData, resolved_same_day: e.target.value})} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Solution</label>
            <textarea value={formData.solution} onChange={e => setFormData({...formData, solution: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={() => navigate("/kpi")} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-sm transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">Save Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}
