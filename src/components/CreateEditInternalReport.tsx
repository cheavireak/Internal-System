import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";

export default function CreateEditInternalReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    action_tasks: "",
    result: ""
  });

  useEffect(() => {
    if (id) {
      fetch(`/api/internal_reports/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
        .then(res => res.json())
        .then(data => setFormData(data));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(id ? `/api/internal_reports/${id}` : "/api/internal_reports", {
        method: id ? "PUT" : "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        showToast(id ? "Record updated successfully" : "Record created successfully", "success");
        navigate("/internal-reports");
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
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4">{id ? "Edit" : "Add"} Internal Report</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action/Tasks</label>
            <textarea value={formData.action_tasks} onChange={e => setFormData({...formData, action_tasks: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" rows={5} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Result</label>
            <textarea value={formData.result} onChange={e => setFormData({...formData, result: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500" rows={5} required />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={() => navigate("/internal-reports")} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-sm transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">Save Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}
