import React, { useState, useEffect, useMemo } from "react";
import { Save, Send, History, Settings, MessageSquare, Search, ChevronLeft, ChevronRight, Copy, Trash2, AlertTriangle, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";

export default function SMS() {
  const [activeTab, setActiveTab] = useState<'send' | 'logs' | 'config'>('send');
  
  // Config state
  const [config, setConfig] = useState({ url: "", username: "", pass: "", int: "0" });
  const [testConfig, setTestConfig] = useState({ url: "", username: "", password: "", messageType: "", gateways: [] as string[] });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState("");
  const [configTab, setConfigTab] = useState<'standard' | 'test'>('standard');
  const [gatewayToDelete, setGatewayToDelete] = useState<number | null>(null);
  const [hiddenGateways, setHiddenGateways] = useState<number[]>([]);
  const [isGatewaysVisible, setIsGatewaysVisible] = useState(true);

  // Send state
  const [sendRoute, setSendRoute] = useState<'standard' | 'test'>('standard');
  const [sender, setSender] = useState("");
  const [gsm, setGsm] = useState("");
  const [smstext, setSmstext] = useState("");
  const [gateway, setGateway] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [sendError, setSendError] = useState("");

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  useEffect(() => {
    fetchConfig();
    fetchTestConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (hiddenGateways.includes(testConfig.gateways.indexOf(gateway))) {
      setGateway("");
    }
  }, [hiddenGateways, testConfig.gateways]);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/sms/config", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch SMS config", error);
    }
  };

  const fetchTestConfig = async () => {
    try {
      const res = await fetch("/api/sms/config-test", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTestConfig(data);
        if (data.gateways && data.gateways.length > 0) {
          setGateway(data.gateways[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch SMS test config", error);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/sms/logs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch SMS logs", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMessage("");

    if (configTab === 'test' && (testConfig.url.toLowerCase().includes('smpp') || testConfig.url.includes(':9710'))) {
      setConfigMessage("Warning: The URL appears to be an SMPP server. This application only supports HTTP/HTTPS APIs. The test may fail.");
    }

    try {
      const res = await fetch(configTab === 'standard' ? "/api/sms/config" : "/api/sms/config-test", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify(configTab === 'standard' ? config : testConfig)
      });
      if (res.ok) {
        setConfigMessage("Configuration saved successfully!");
        setTimeout(() => setConfigMessage(""), 3000);
      } else {
        setConfigMessage("Failed to save configuration.");
      }
    } catch (error) {
      setConfigMessage("Error saving configuration.");
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendMessage("");
    setSendError("");
    try {
      const endpoint = sendRoute === 'standard' ? "/api/sms/send" : "/api/sms/send-test";
      const payload = sendRoute === 'standard' 
        ? { sender, gsm, smstext } 
        : { sender, gsm, smstext, gateway };
        
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSendMessage(`SMS sent successfully! Message ID: ${data.messageId}`);
        setGsm("");
        setSmstext("");
        setTimeout(() => setSendMessage(""), 5000);
      } else {
        setSendError(data.error || "Failed to send SMS.");
        setTimeout(() => setSendError(""), 5000);
      }
    } catch (error: any) {
      console.error("SMS Send Error:", error);
      if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
        setSendError("Connection timed out. Please ensure the API URL is a valid HTTP/HTTPS endpoint and not an SMPP server.");
      } else {
        setSendError("Error sending SMS.");
      }
      setTimeout(() => setSendError(""), 5000);
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (log: any) => {
    setSender(log.sender || "");
    setGsm(log.phone_number || "");
    setSmstext(log.content || "");
    setActiveTab('send');
  };

  const filteredLogs = useMemo(() => {
    let result = logs;
    
    if (dateFilter) {
      // log.time is ISO string like "2026-03-16T08:42:14.000Z"
      result = result.filter(log => log.time.startsWith(dateFilter));
    }
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(log => 
        log.phone_number.toLowerCase().includes(lowerQuery) || 
        (log.message_id && log.message_id.toString().toLowerCase().includes(lowerQuery))
      );
    }
    
    return result;
  }, [logs, searchQuery, dateFilter]);

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * logsPerPage;
    return filteredLogs.slice(startIndex, startIndex + logsPerPage);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter]);

  return (
    <div className="p-6 max-w-[95%] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <MessageSquare className="mr-2 h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          SMS Management
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center transition-colors ${
              activeTab === 'send' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-700 dark:border-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <Send className="w-4 h-4 mr-2" />
            Send SMS
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center transition-colors ${
              activeTab === 'logs' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-700 dark:border-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            SMS Logs
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center transition-colors ${
              activeTab === 'config' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-700 dark:border-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configuration
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'send' && (
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Send New SMS</h2>
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                  <button
                    onClick={() => setSendRoute('standard')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      sendRoute === 'standard' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Standard Route
                  </button>
                  <button
                    onClick={() => setSendRoute('test')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      sendRoute === 'test' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Test Route
                  </button>
                </div>
              </div>
              {sendMessage && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md border border-green-200 dark:border-green-800">
                  {sendMessage}
                </div>
              )}
              {sendError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
                  {sendError}
                </div>
              )}
              <form onSubmit={handleSendSMS} className="space-y-4">
                {sendRoute === 'test' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gateway</label>
                    <select
                      required
                      value={gateway}
                      onChange={(e) => setGateway(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="" disabled>Select a gateway</option>
                      {testConfig.gateways
                        .map((gw, idx) => ({ gw, idx }))
                        .filter(({ idx }) => !hiddenGateways.includes(idx))
                        .map(({ gw, idx }) => (
                          <option key={idx} value={gw}>{gw}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sender ID</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g. MyCompany"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Alphanumeric string: max length 11 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination Phone Number(s)</label>
                  <input
                    type="text"
                    required
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g. 85598123456;85512xxxxxx"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum 50 numbers, separated by semicolon (;)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Content</label>
                  <textarea
                    required
                    rows={4}
                    value={smstext}
                    onChange={(e) => setSmstext(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter your message here..."
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      English: 160 chars/part (153 for multi). Unicode: 70 chars/part (67 for multi).
                    </p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Length: {smstext.length} chars
                    </p>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send SMS
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">SMS Sending History</h2>
                <div className="flex space-x-4">
                  <div className="relative">
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white text-sm h-full"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search phone or Message ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 text-sm"
                    />
                  </div>
                </div>
              </div>
              {loadingLogs ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  No SMS logs found.
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">No.</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sender</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Content</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Parts</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message ID</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {paginatedLogs.map((log, index) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {(currentPage - 1) * logsPerPage + index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(log.time).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {log.sender || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {log.phone_number}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 min-w-[300px] max-w-2xl whitespace-normal break-words">
                              {log.content}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {log.sms_parts}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                              {log.message_id ? log.message_id.toString().replace(/\D/g, '') : ''}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleCopy(log)}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center justify-end w-full"
                                title="Copy to Send SMS"
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 mt-4">
                      <div className="flex flex-1 justify-between sm:hidden">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Showing <span className="font-medium text-gray-900 dark:text-white">{(currentPage - 1) * logsPerPage + 1}</span> to <span className="font-medium text-gray-900 dark:text-white">{Math.min(currentPage * logsPerPage, filteredLogs.length)}</span> of{' '}
                            <span className="font-medium text-gray-900 dark:text-white">{filteredLogs.length}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                            >
                              <span className="sr-only">Previous</span>
                              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                            </button>
                            {Array.from({ length: totalPages }).map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  currentPage === i + 1
                                    ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500'
                                    : 'text-gray-900 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                                }`}
                              >
                                {i + 1}
                              </button>
                            ))}
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                            >
                              <span className="sr-only">Next</span>
                              <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">API Configuration</h2>
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                  <button
                    onClick={() => setConfigTab('standard')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      configTab === 'standard' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Standard API
                  </button>
                  <button
                    onClick={() => setConfigTab('test')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      configTab === 'test' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Test API
                  </button>
                </div>
              </div>
              {configMessage && (
                <div className={`mb-4 p-3 rounded-md border ${configMessage.includes('success') ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
                  {configMessage}
                </div>
              )}
              <form onSubmit={handleSaveConfig} className="space-y-4">
                {configTab === 'standard' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL</label>
                      <input
                        type="url"
                        required
                        value={config.url}
                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="https://sandbox.mekongsms.com/api/postsms.aspx"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={config.username}
                        onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="xxx@apitest"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MD5 Password</label>
                      <input
                        type="password"
                        required
                        value={config.pass}
                        onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="MD5 hash string of your password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">International Sending (int)</label>
                      <select
                        value={config.int}
                        onChange={(e) => setConfig({ ...config, int: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="0">0 - Local numbers only</option>
                        <option value="1">1 - Enable international numbers</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL (GET Method)</label>
                      <input
                        type="url"
                        required
                        value={testConfig.url}
                        onChange={(e) => setTestConfig({ ...testConfig, url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="https://api.example.com/send"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={testConfig.username}
                        onChange={(e) => setTestConfig({ ...testConfig, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="Username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Raw Password</label>
                      <input
                        type="password"
                        required
                        value={testConfig.password}
                        onChange={(e) => setTestConfig({ ...testConfig, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="Raw password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Type</label>
                      <input
                        type="text"
                        required
                        value={testConfig.messageType}
                        onChange={(e) => setTestConfig({ ...testConfig, messageType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g. text"
                      />
                    </div>
                    <div>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-1"
                        onClick={() => setIsGatewaysVisible(!isGatewaysVisible)}
                      >
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Gateways
                        </label>
                        {isGatewaysVisible ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                      {isGatewaysVisible && (
                        <div className="space-y-2">
                          {testConfig.gateways.map((gw, idx) => (
                            <div key={idx} className={`flex items-center gap-2 ${hiddenGateways.includes(idx) ? 'opacity-50' : ''}`}>
                              <input
                                type="text"
                                value={gw}
                                onChange={(e) => {
                                  const newGateways = [...testConfig.gateways];
                                  newGateways[idx] = e.target.value;
                                  setTestConfig({ ...testConfig, gateways: newGateways });
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (hiddenGateways.includes(idx)) {
                                    setHiddenGateways(hiddenGateways.filter(i => i !== idx));
                                  } else {
                                    setHiddenGateways([...hiddenGateways, idx]);
                                  }
                                }}
                                className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
                                title={hiddenGateways.includes(idx) ? "Show Gateway" : "Hide Gateway"}
                              >
                                {hiddenGateways.includes(idx) ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setGatewayToDelete(idx)}
                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                title="Delete Gateway"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTestConfig({ ...testConfig, gateways: [...testConfig.gateways, ""] })}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
                          >
                            + Add Gateway
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {configSaving ? 'Saving...' : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {gatewayToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-transparent dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 mx-auto">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">Delete Gateway</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Are you sure you want to delete the gateway "{testConfig.gateways[gatewayToDelete]}"? This action cannot be undone.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end space-x-3 border-t border-transparent dark:border-gray-700">
              <button
                type="button"
                onClick={() => setGatewayToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const newGateways = testConfig.gateways.filter((_, i) => i !== gatewayToDelete);
                  setTestConfig({ ...testConfig, gateways: newGateways });
                  setGatewayToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
