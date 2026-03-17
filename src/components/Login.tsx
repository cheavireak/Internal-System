import React, { useState } from "react";
import { Lock, Mail } from "lucide-react";

export default function Login({ setToken }: { setToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;
    
    console.log("Login attempt for:", email);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        console.log("Login response:", data);
        if (res.ok) {
          setToken(data.token);
        } else {
          if (data.error === "IP_BLOCKED") {
            setIsBlocked(true);
            setError(data.message || "Your IP has been blocked due to too many failed login attempts.");
          } else {
            setError(data.error || "Login failed");
          }
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        if (res.status === 403) {
          setError("Access denied: Login from this network location is not authorized.");
        } else if (res.status === 401) {
          setError("Authentication failed. Please check your credentials.");
        } else if (res.status === 400) {
          setError("Request failed. Please check your input.");
        } else {
          setError(`Server error (${res.status}): Received non-JSON response. Please check server logs.`);
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Sign in</h2>
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">Internal IMS Dashboard</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 p-3 rounded-lg">{error}</div>}
          <div className="space-y-4">
            <div>
              <label className="sr-only">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  disabled={isBlocked}
                  className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-shadow disabled:opacity-50"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="sr-only">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  disabled={isBlocked}
                  className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-shadow disabled:opacity-50"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isBlocked}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
