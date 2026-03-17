import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Calendar, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { generateWeeklyReport } from "../services/reportService";
import { useToast } from "../contexts/ToastContext";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md min-w-[250px]">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">{label}</p>
        {payload.map((entry: any, index: number) => {
          const totalKey = `total${entry.dataKey.charAt(0).toUpperCase() + entry.dataKey.slice(1)}`;
          const totalVal = entry.payload[totalKey];
          return (
            <div key={index} className="flex items-center justify-between gap-4 text-sm mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{entry.name}:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: entry.color }}>{entry.value}</span>
                <span className="text-gray-400 text-xs w-16 text-right">(Total: {totalVal})</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [summary, setSummary] = useState({
    totals: {
      newIntegration: 0,
      delayProject: 0,
      lostLeads: 0,
      toProduction: 0
    },
    weekly: {
      newIntegration: 0,
      delayProject: 0,
      lostLeads: 0,
      toProduction: 0
    },
    weeklyDetails: {
      newIntegration: [],
      delayProject: [],
      lostLeads: [],
      toProduction: []
    },
    graphData: []
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [modalData, setModalData] = useState<{ title: string; customers: any[] } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let url = "/api/summary";
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.totals) {
        setSummary(data);
      } else {
        // Fallback for old data format during transition
        setSummary({
          totals: data,
          weekly: { newIntegration: 0, delayProject: 0, lostLeads: 0, toProduction: 0 },
          weeklyDetails: { newIntegration: [], delayProject: [], lostLeads: [], toProduction: [] },
          graphData: []
        });
      }
    });
  }, [startDate, endDate]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateWeeklyReport();
      showToast("Report generated successfully", "success");
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Failed to generate report. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const todayStr = format(new Date(), 'dd-MMM-yyyy');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Summary Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Presentation Date: {todayStr}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <input 
              type="date" 
              className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-300 focus:ring-0 p-0 cursor-pointer"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-300 focus:ring-0 p-0 cursor-pointer"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-xs text-red-500 hover:text-red-700 ml-2 font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "Generating Report..." : "Export Weekly Report (Excel)"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="New Integrations" 
          total={summary.totals.newIntegration} 
          weekly={summary.weekly.newIntegration} 
          icon={BarChart3} 
          color="bg-blue-500" 
          periodLabel={startDate && endDate ? "in selected range" : "this week"}
          onClickWeekly={() => setModalData({ title: startDate && endDate ? "New Integrations in Range" : "New Integrations This Week", customers: summary.weeklyDetails.newIntegration })}
        />
        <StatCard 
          title="Sandbox → Production" 
          total={summary.totals.toProduction} 
          weekly={summary.weekly.toProduction} 
          icon={CheckCircle2} 
          color="bg-green-500" 
          periodLabel={startDate && endDate ? "in selected range" : "this week"}
          onClickWeekly={() => setModalData({ title: startDate && endDate ? "Sandbox → Production in Range" : "Sandbox → Production This Week", customers: summary.weeklyDetails.toProduction })}
        />
        <StatCard 
          title="Delayed Projects" 
          total={summary.totals.delayProject} 
          weekly={summary.weekly.delayProject} 
          icon={AlertTriangle} 
          color="bg-orange-500" 
          periodLabel={startDate && endDate ? "in selected range" : "this week"}
          onClickWeekly={() => setModalData({ title: startDate && endDate ? "Delayed Projects in Range" : "Delayed Projects This Week", customers: summary.weeklyDetails.delayProject })}
        />
        <StatCard 
          title="Lost API Leads" 
          total={summary.totals.lostLeads} 
          weekly={summary.weekly.lostLeads} 
          icon={TrendingUp} 
          color="bg-red-500" 
          periodLabel={startDate && endDate ? "in selected range" : "this week"}
          onClickWeekly={() => setModalData({ title: startDate && endDate ? "Lost API Leads in Range" : "Lost API Leads This Week", customers: summary.weeklyDetails.lostLeads })}
        />
      </div>

      {modalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{modalData.title}</h3>
              <button 
                onClick={() => setModalData(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {modalData.customers.length > 0 ? (
                <ul className="space-y-2">
                  {modalData.customers.map((c: any, i: number) => (
                    <li key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-500 text-xs">{format(new Date(c.date), 'dd-MMM-yyyy')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No customers moved to this stage in this period.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pipeline Movements</h2>
          <p className="text-sm text-gray-500 mt-1">Tracks new integrations and customers moved to other stages over time.</p>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={summary.graphData}
              margin={{ top: 5, right: 30, left: 20, bottom: summary.graphData.length > 8 ? 40 : 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                stroke="#6B7280"
                fontSize={11}
                tickMargin={10}
                angle={summary.graphData.length > 8 ? -45 : 0}
                textAnchor={summary.graphData.length > 8 ? "end" : "middle"}
                height={summary.graphData.length > 8 ? 60 : 30}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" name="New Integration" dataKey="newIntegration" stroke="#3B82F6" strokeWidth={summary.graphData.length > 20 ? 2 : 3} dot={{ r: summary.graphData.length > 20 ? 2 : 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="To Production" dataKey="toProduction" stroke="#22C55E" strokeWidth={summary.graphData.length > 20 ? 2 : 3} dot={{ r: summary.graphData.length > 20 ? 2 : 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="Delayed" dataKey="delayProject" stroke="#F97316" strokeWidth={summary.graphData.length > 20 ? 2 : 3} dot={{ r: summary.graphData.length > 20 ? 2 : 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="Lost Leads" dataKey="lostLeads" stroke="#EF4444" strokeWidth={summary.graphData.length > 20 ? 2 : 3} dot={{ r: summary.graphData.length > 20 ? 2 : 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, total, weekly, icon: Icon, color, onClickWeekly, periodLabel = "this week" }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 p-6 flex items-center transition-transform hover:-translate-y-1 duration-200">
      <div className={`p-3 rounded-lg ${color} text-white mr-4 shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{total}</p>
          <p className="text-sm font-medium text-gray-500">Total</p>
        </div>
        <div className="mt-2 text-sm">
          <span 
            className="font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer"
            onClick={onClickWeekly}
          >
            +{weekly}
          </span>
          <span className="text-gray-500 ml-1">{periodLabel}</span>
        </div>
      </div>
    </div>
  );
}
