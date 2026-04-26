import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SuperAdminDashboard = () => {
  const { token, logout, user } = useAuth();
  const [companies, setCompanies] = useState([]);
  
  // Forms state
  const [newCompanyName, setNewCompanyName] = useState("");
  const [adminSetupCompanyId, setAdminSetupCompanyId] = useState(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchCompanies = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/companies", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [token]);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/companies", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newCompanyName.trim() })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create company");
      }
      
      setNewCompanyName("");
      fetchCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim() || !adminSetupCompanyId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/api/companies/${adminSetupCompanyId}/admin`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          username: adminUsername.trim(),
          password: adminPassword 
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create admin");
      }

      setAdminSetupCompanyId(null);
      setAdminUsername("");
      setAdminPassword("");
      alert("Company Admin successfully created!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f18] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between glass-card p-6 rounded-2xl border border-indigo-500/30">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              IYI Super Admin Console
            </h1>
            <p className="text-gray-400 mt-2">Manage Instances and Tenant Accounts</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Logged in as: <strong className="text-white">{user?.username}</strong></span>
            <button 
              onClick={logout}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/20"
            >
              Log Out
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Companies List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-indigo-400">🏢</span> Registered Companies
              </h2>
              
              <div className="space-y-4">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center justify-between p-4 bg-[#1f2937] border border-gray-700 rounded-xl hover:border-indigo-500/50 transition-colors">
                    <div>
                      <h3 className="font-semibold text-lg">{company.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        ID: {company.id} &bull; Created: {new Date(company.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setAdminSetupCompanyId(company.id)}
                      className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-lg text-sm font-medium transition-all"
                    >
                      + Add Company Admin
                    </button>
                  </div>
                ))}
                
                {companies.length === 0 && (
                  <div className="text-center p-8 text-gray-500 italic border border-dashed border-gray-700 rounded-xl">
                    No companies found. Create one to get started.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Panels */}
          <div className="space-y-6">
            
            {/* Create Company Form */}
            <div className="glass-card p-6 rounded-2xl border-t-4 border-emerald-500">
              <h2 className="text-xl font-bold mb-4">New Company</h2>
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. Acme Corp"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Create Company
                </button>
              </form>
            </div>

            {/* Create Admin Form (Dynamic) */}
            {adminSetupCompanyId && (
              <div className="glass-card p-6 rounded-2xl border-t-4 border-indigo-500 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Setup Company Admin</h2>
                  <button onClick={() => setAdminSetupCompanyId(null)} className="text-gray-500 hover:text-white">&times;</button>
                </div>
                <p className="text-sm text-indigo-300 mb-4">
                  Creating admin for: <strong>{companies.find(c => c.id === adminSetupCompanyId)?.name}</strong>
                </p>
                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Username</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="admin_acme"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Password</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-900/50 disabled:opacity-50"
                  >
                    Create Admin Account
                  </button>
                </form>
              </div>
            )}
            
          </div>

        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
