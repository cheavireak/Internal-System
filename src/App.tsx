/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, UserPlus, LogOut, FileSpreadsheet, Settings as SettingsIcon, FileText, AlertCircle, Clock, CheckCircle, Menu, X, Sun, Moon, Shield, MessageSquare } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Components
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import PipelineView from "./components/PipelineView";
import AdminPanel from "./components/AdminPanel";
import AuditLogs from "./components/AuditLogs";
import CommandPalette from "./components/CommandPalette";
import KPITracker from "./components/KPITracker";
import CreateEditKPI from "./components/CreateEditKPI";
import CreateEditInternalReport from "./components/CreateEditInternalReport";
import Settings from "./components/Settings";
import InternalReports from "./components/InternalReports";
import SMS from "./components/SMS";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<any>(null);
  const [hiddenMenus, setHiddenMenus] = useState<string[]>([]);
  const [sessionTimeout, setSessionTimeout] = useState<number>(() => {
    const saved = localStorage.getItem("sessionTimeout");
    return saved ? Number(saved) : 15;
  }); // default 15 mins
  
  useEffect(() => {
    if (!token) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("Session timeout reached. Logging out.");
        localStorage.removeItem("token");
        setToken(null);
      }, sessionTimeout * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, resetTimer));
    
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearTimeout(timeoutId);
    };
  }, [sessionTimeout, token]);
  
  useEffect(() => {
    console.log("hiddenMenus updated:", hiddenMenus);
  }, [hiddenMenus]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Expose a function to refresh hidden menus
  const refreshHiddenMenus = () => {
    console.log("Refreshing hidden menus...");
    if (token) {
      fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        console.log("Fetched settings:", data);
        if (data.hidden_menus) {
          const val = data.hidden_menus;
          setHiddenMenus(Array.isArray(val) ? val : (Array.isArray(val?.value) ? val.value : []));
        }
      })
      .catch(err => console.error("Failed to fetch settings", err));
    }
  };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return false; // Default to light mode
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        else {
          localStorage.removeItem("token");
          setToken(null);
        }
      });
      
      fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.hidden_menus) {
          const val = data.hidden_menus;
          setHiddenMenus(Array.isArray(val) ? val : (Array.isArray(val?.value) ? val.value : []));
        }
        if (data.session_timeout) {
          const timeoutValue = typeof data.session_timeout === 'object' ? data.session_timeout.value : data.session_timeout;
          setSessionTimeout(timeoutValue || 15);
          localStorage.setItem("sessionTimeout", String(timeoutValue || 15));
        }
      })
      .catch(err => console.error("Failed to fetch settings", err));
    }
  }, [token]);

  if (!token) {
    return <Login setToken={(t) => {
      localStorage.setItem("token", t);
      setToken(t);
    }} />;
  }

  return (
    <Router>
      <CommandPalette />
      <div className="flex h-full bg-gray-50 dark:bg-gray-900 transition-colors">
        <Sidebar user={user} setToken={setToken} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} hiddenMenus={hiddenMenus} />
        <main className="flex-1 overflow-y-auto p-8 relative">
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-8 left-8 p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 z-20 flex items-center gap-2"
            >
              <Menu className="h-5 w-5" />
              <span className="text-sm font-medium">Menu</span>
            </button>
          )}
          <div className={!isSidebarOpen ? "mt-12" : ""}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/kpi" element={<KPITracker />} />
              <Route path="/kpi/create" element={<CreateEditKPI />} />
              <Route path="/kpi/edit/:id" element={<CreateEditKPI />} />
              {user?.permissions?.menus?.includes('NewIntegration') && <Route path="/new-integration" element={<PipelineView stage="NewIntegration" title="New Integration" user={user} />} />}
              {user?.permissions?.menus?.includes('SandboxToProduction') && <Route path="/sandbox-to-production" element={<PipelineView stage="SandboxToProduction" title="Sandbox To Production" user={user} />} />}
              {user?.permissions?.menus?.includes('Delay') && <Route path="/delay-project" element={<PipelineView stage="Delay" title="Delay Project" user={user} />} />}
              {user?.permissions?.menus?.includes('Lost') && <Route path="/lost-leads" element={<PipelineView stage="Lost" title="Lost API Leads" user={user} />} />}
              {user?.permissions?.menus?.includes('Expired') && <Route path="/expired" element={<PipelineView stage="Expired" title="Expired" user={user} />} />}
              {user?.permissions?.menus?.includes('SMPP') && <Route path="/smpp" element={<PipelineView stage="SMPP" title="SMPP" user={user} />} />}
              <Route path="/internal-reports" element={<InternalReports />} />
              <Route path="/internal-reports/create" element={<CreateEditInternalReport />} />
              <Route path="/internal-reports/edit/:id" element={<CreateEditInternalReport />} />
              {user?.permissions?.menus?.includes('SMS') && <Route path="/sms" element={<SMS />} />}
              {user?.permissions?.menus?.includes('AdminPanel') && user?.role !== 'user' && <Route path="/admin" element={<AdminPanel currentUser={user} />} />}
              {user?.permissions?.menus?.includes('AuditLogs') && user?.role !== 'user' && <Route path="/audit-logs" element={<AuditLogs user={user} />} />}
              {(user?.is_superadmin || user?.role === 'admin') && <Route path="/settings" element={<Settings currentUser={user} refreshHiddenMenus={refreshHiddenMenus} hiddenMenus={hiddenMenus} sessionTimeout={sessionTimeout} setSessionTimeout={setSessionTimeout} />} />}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

function Sidebar({ user, setToken, isOpen, setIsOpen, isDarkMode, setIsDarkMode, hiddenMenus = [] }: { user: any, setToken: (t: string | null) => void, isOpen: boolean, setIsOpen: (v: boolean) => void, isDarkMode: boolean, setIsDarkMode: (v: boolean) => void, hiddenMenus: string[] }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const links = [
    { name: "Weekly Summary", path: "/", icon: LayoutDashboard, id: 'Dashboard' },
    { name: "New Integration", path: "/new-integration", icon: FileText, id: 'NewIntegration' },
    { name: "Sandbox → Production", path: "/sandbox-to-production", icon: CheckCircle, id: 'SandboxToProduction' },
    { name: "Delay Project", path: "/delay-project", icon: Clock, id: 'Delay' },
    { name: "Lost API Leads", path: "/lost-leads", icon: AlertCircle, id: 'Lost' },
    { name: "Expired", path: "/expired", icon: FileSpreadsheet, id: 'Expired' },
    { name: "SMPP", path: "/smpp", icon: FileSpreadsheet, id: 'SMPP' },
    { name: "Reports", path: "/kpi", icon: FileSpreadsheet, id: 'Reports' },
    { name: "Internal Reports", path: "/internal-reports", icon: FileSpreadsheet, id: 'InternalReports' },
    { name: "SMS", path: "/sms", icon: MessageSquare, id: 'SMS' },
  ];

  const visibleLinks = links.filter(link => {
    console.log(`Checking link: ${link.id}, hidden: ${hiddenMenus.includes(link.id)}, permission: ${user?.permissions?.menus?.includes(link.id)}`);
    // Check if the menu is hidden globally
    if (hiddenMenus.includes(link.id)) {
      return false;
    }
    
    // Check if the user has permission for this menu
    // Dashboard, Reports, and Internal Reports are always visible unless hidden
    if (link.id === 'Dashboard' || link.id === 'Reports' || link.id === 'InternalReports') {
      return true;
    }
    
    return user?.permissions?.menus?.includes(link.id);
  });

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-sm z-10 relative transition-all duration-300">
      <div className="p-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Internal System</h1>
          <div className="flex items-center mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Welcome, {user?.name}</p>
            {user?.role && (
              <span className={`ml-2 px-2 py-0.5 text-[10px] leading-tight font-semibold rounded-full uppercase tracking-wider
                ${user.is_superadmin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 
                  user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 
                  user.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 
                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                {user.is_superadmin ? 'Superadmin' : user.role}
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          title="Hide Sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={cn(
                "w-full flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                isActive ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Icon strokeWidth={2.5} className={cn("mr-2.5 h-4 w-4", isActive ? "text-indigo-700 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")} />
              {link.name}
            </button>
          );
        })}
        {user?.permissions?.menus?.includes('AdminPanel') && user?.role !== 'user' && !hiddenMenus.includes('AdminPanel') && (
          <button
            onClick={() => navigate("/admin")}
            className={cn(
              "w-full flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 mt-4",
              location.pathname === "/admin" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <SettingsIcon strokeWidth={2.5} className={cn("mr-2.5 h-4 w-4", location.pathname === "/admin" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")} />
            Admin Panel
          </button>
        )}
        {user?.permissions?.menus?.includes('AuditLogs') && user?.role !== 'user' && !hiddenMenus.includes('AuditLogs') && (
          <button
            onClick={() => navigate("/audit-logs")}
            className={cn(
              "w-full flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 mt-1",
              location.pathname === "/audit-logs" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <Shield strokeWidth={2.5} className={cn("mr-2.5 h-4 w-4", location.pathname === "/audit-logs" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")} />
            Audit Logs
          </button>
        )}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {(user?.is_superadmin || user?.role === 'admin') && (
          <button
            onClick={() => navigate("/settings")}
            className={cn(
              "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
              location.pathname === "/settings" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <SettingsIcon strokeWidth={2.5} className={cn("mr-3 h-5 w-5", location.pathname === "/settings" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")} />
            Settings
          </button>
        )}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {isDarkMode ? (
            <>
              <Sun strokeWidth={2.5} className="mr-3 h-5 w-5" />
              Light Mode
            </>
          ) : (
            <>
              <Moon strokeWidth={2.5} className="mr-3 h-5 w-5" />
              Dark Mode
            </>
          )}
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            setToken(null);
          }}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
