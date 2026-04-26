import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Login from './components/Login.jsx';
import SuperAdminDashboard from './components/SuperAdminDashboard.jsx';
import { useAuth } from './context/AuthContext.jsx';

function App() {
  const { isAuthenticated, token, loading, logout, user } = useAuth();
  const isAdmin = user && String(user.role).toLowerCase() === 'admin';
  const isSuperAdmin = user && String(user.role).toLowerCase() === 'super_admin';

  // Financial State
  const [partnersShares, setPartnerShares] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [charityPercentage, setCharityPercentage] = useState(0.06);
  const [partnershipMode, setPartnershipMode] = useState('both');
  const [labourShareMode, setLabourShareMode] = useState('time');
  const [currencySymbol, setCurrencySymbol] = useState('£');
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [reports, setReports] = useState([]);
  const [pulseData, setPulseData] = useState({ revenue: 0, expenses: 0, netProfit: 0 });
  const [transactions, setTransactions] = useState([]);

  // Dynamic Partner derived arrays
  const partnerNames = partnersShares.map(s => s.partner_name || `Partner ${s.user_id}`);
  const capitalInvestments = partnersShares.map(s => s.capital_share_fixed);
  const laborShares = partnersShares.map(s => s.labor_share_variable);
  
  // UI State
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Derived state
  const totalCapital = capitalInvestments.reduce((sum, val) => sum + val, 0);
  const capitalShares = capitalInvestments.map(inv => totalCapital > 0 ? (inv / totalCapital) * 100 : 0);

  // Recalculate pulse from transactions
  useEffect(() => {
    const openTxs = transactions.filter(tx => !tx.is_closed);
    const revenue = openTxs
      .filter(tx => tx.type === 'sales')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = openTxs
      .filter(tx => tx.type !== 'sales')
      .reduce((sum, tx) => sum + tx.amount, 0);
    setPulseData({ revenue, expenses, netProfit: revenue - expenses });
  }, [transactions]);

  // Reload transactions from the backend
  const refreshTransactions = (headers) => {
    fetch('http://localhost:8000/api/ledger/', { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .catch(err => console.error("Error fetching ledger:", err));
  };

  const refreshTimeEntries = (headers) => {
    fetch('http://localhost:8000/api/time/all', { headers })
      .then(res => res.json())
      .then(data => {
        setTimeEntries(data);
        // Also refresh shares whenever time is refreshed, because shares depend dynamically on time!
        fetch('http://localhost:8000/api/shares', { headers })
          .then(r => r.json())
          .then(sharesData => {
            setPartnerShares(sharesData);
          }).catch(e => console.error(e));
      })
      .catch(err => console.error("Error fetching time entries:", err));
  };

  // Sync with Backend
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;

    const headers = { 'Authorization': `Bearer ${token}` };

    // Fetch Global Settings
    fetch('http://localhost:8000/api/settings', { headers })
      .then(res => res.json())
      .then(data => {
        setCharityPercentage(data.charity_percentage);
        setPartnershipMode(data.partnership_mode || 'both');
        setLabourShareMode(data.labour_share_mode || 'time');
        setCurrencySymbol(data.currency_symbol || '£');
        setIsSetupComplete(data.is_setup_complete);
      })
      .catch(err => console.error("Error fetching settings:", err));

    // Fetch Partner Shares
    fetch('http://localhost:8000/api/shares', { headers })
      .then(res => res.json())
      .then(data => {
        setPartnerShares(data);
      })
      .catch(err => console.error("Error fetching shares:", err));

    // Fetch Historical Reports
    fetch('http://localhost:8000/api/distribution/reports', { headers })
      .then(res => res.json())
      .then(data => setReports(data))
      .catch(err => console.error("Error fetching reports:", err));

    // Fetch Ledger Transactions
    refreshTransactions(headers);

    // Fetch Time Entries
    refreshTimeEntries(headers);
  }, [isAuthenticated, token]);

  // (Removed localStorage for capital since we rely strictly on DB now)

  const updatePartnerShare = (userId, updatedFields) => {
    const share = partnersShares.find(s => s.user_id === userId);
    if (!share) return;

    const previousShares = [...partnersShares];
    const newShare = { ...share, ...updatedFields };

    setPartnerShares(prev => prev.map(s => s.user_id === userId ? newShare : s));

    fetch(`http://localhost:8000/api/shares/${userId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newShare)
    })
      .then(res => {
        if (!res.ok) throw new Error('Update failed');
        // Let's re-fetch to ensure all dynamic names/shares are absolutely pristine and correctly formatted
        return fetch('http://localhost:8000/api/shares', { headers: { 'Authorization': `Bearer ${token}` } });
      })
      .then(res => res.json())
      .then(data => setPartnerShares(data))
      .catch(err => {
        setPartnerShares(previousShares);
        console.error("Update failed, rolled back.", err);
      });
  };

  const handleCreatePartner = async (name, initialCapital) => {
    try {
      const res = await fetch(`http://localhost:8000/api/shares/new_partner`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, capital_share_fixed: initialCapital })
      });
      if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.detail || 'Failed to add partner');
      }
      const newPartner = await res.json();
      setPartnerShares(prev => [...prev, newPartner]);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleRenamePartner = async (userId, newName) => {
    try {
      const res = await fetch(`http://localhost:8000/api/shares/${userId}/rename`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.detail || 'Failed to rename partner');
      }
      
      const resShares = await fetch('http://localhost:8000/api/shares', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await resShares.json();
      setPartnerShares(data);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleDeletePartner = async (userId) => {
    if(!window.confirm("Are you sure you want to remove this partner?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/shares/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.detail || 'Failed to disable partner');
      }
      setPartnerShares(prev => prev.filter(s => s.user_id !== userId));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const updateCharityPercentage = (val) => {
    setCharityPercentage(val);
    fetch('http://localhost:8000/api/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        charity_percentage: val,
        partnership_mode: partnershipMode,
        labour_share_mode: labourShareMode,
        currency_symbol: currencySymbol,
        is_setup_complete: isSetupComplete
      })
    }).catch(err => console.error("Error updating settings:", err));
  };

  const completeSetup = (pMode, lMode) => {
    setPartnershipMode(pMode);
    setLabourShareMode(lMode);
    setIsSetupComplete(true);
    fetch('http://localhost:8000/api/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        charity_percentage: charityPercentage,
        partnership_mode: pMode,
        labour_share_mode: lMode,
        currency_symbol: currencySymbol,
        is_setup_complete: true
      })
    })
    .then(() => refreshTimeEntries({ 'Authorization': `Bearer ${token}` }))
    .catch(err => console.error("Error completing setup:", err));
  };

  const updateSystemModes = (pMode, lMode, cSym = currencySymbol) => {
    setPartnershipMode(pMode);
    setLabourShareMode(lMode);
    setCurrencySymbol(cSym);
    fetch('http://localhost:8000/api/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        charity_percentage: charityPercentage,
        partnership_mode: pMode,
        labour_share_mode: lMode,
        currency_symbol: cSym,
        is_setup_complete: isSetupComplete
      })
    })
    .then(() => refreshTimeEntries({ 'Authorization': `Bearer ${token}` })) // Force a refresh to recalculate shares
    .catch(err => console.error("Error updating settings:", err));
  };

  const handleNewTransaction = async (type, amount, description) => {
    try {
      const res = await fetch('http://localhost:8000/api/ledger/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, amount, description })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save transaction');
      }
      // Refresh transactions from backend
      refreshTransactions({ 'Authorization': `Bearer ${token}` });
    } catch (err) {
      console.error("Transaction save error:", err);
      alert(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleCloseOut = () => {
    setShowReportModal(true);
  };

  const confirmCloseOut = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('http://localhost:8000/api/distribution/month-end-close', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Report generation failed');
      }
      alert("Distribution Report Generated Successfully!");
      
      // Refresh both reports and transactions
      const headers = { 'Authorization': `Bearer ${token}` };
      const reportsRes = await fetch('http://localhost:8000/api/distribution/reports', { headers });
      const reportsData = await reportsRes.json();
      setReports(reportsData);
      refreshTransactions(headers);
      refreshTimeEntries(headers);
    } catch (err) {
      console.error(err);
      alert(`Failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setShowReportModal(false);
    }
  };

  const handleUpdateTransaction = (updatedTx) => {
    // Optimistic update — backend doesn't support edit yet
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
  };

  const handleUpdateTimeEntry = async (entryId, updatedFields) => {
    try {
      const res = await fetch(`http://localhost:8000/api/time/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedFields)
      });
      if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.detail || 'Failed to update time entry');
      }
      refreshTimeEntries({ 'Authorization': `Bearer ${token}` });
    } catch (err) {
      console.error("Time Entry Update error:", err);
      alert(`Failed: ${err.message}`);
      throw err;
    }
  };

  const handleOverridePulse = (field, amount) => {
    setPulseData(prev => {
      const newData = { ...prev, [field]: amount };
      newData.netProfit = newData.revenue - newData.expenses;
      return newData;
    });
  };

  const handleDeleteTimeEntry = async (entryId) => {
    if (!window.confirm("Are you sure you want to delete this time entry?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/time/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errData.detail || 'Failed to delete');
      }
      alert("Time entry deleted successfully.");
      refreshTimeEntries({ 'Authorization': `Bearer ${token}` });
    } catch (err) {
      console.error(err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDeleteAllTimeEntries = async () => {
    if (!window.confirm("CRITICAL: This will delete ALL open shift logs for ALL partners. Proceed?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/time`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errData.detail || 'Failed to delete all');
      }
      alert("All open time entries cleared.");
      refreshTimeEntries({ 'Authorization': `Bearer ${token}` });
    } catch (err) {
      console.error(err);
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  const handleDeleteTransaction = async (txId) => {
    if (!window.confirm("Delete this transaction and its ledger records?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/ledger/${txId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errData.detail || 'Failed to delete transaction');
      }
      alert("Transaction deleted successfully.");
      refreshTransactions({ 'Authorization': `Bearer ${token}` });
    } catch (err) {
      console.error(err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDeleteAllTransactions = async () => {
    if (!window.confirm("DANGER: This will delete ALL unclosed transactions. This cannot be undone. Proceed?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/ledger`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errData.detail || 'Bulk delete failed');
      }
      alert("All unclosed transactions cleared.");
      refreshTransactions({ 'Authorization': `Bearer ${token}` });
    } catch (err) {
      console.error(err);
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f18] flex items-center justify-center text-white">
      <div className="animate-pulse text-xl">Loading IYI PL System...</div>
    </div>
  );

  if (!isAuthenticated) return <Login />;

  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      overflow: 'hidden',
      background: 'var(--bg-dark)'
    }}>
      {/* Fixed sidebar */}
      <aside style={{
        width: '320px',
        minWidth: '320px',
        height: '100vh',
        overflowY: 'auto',
        padding: '1.5rem 1rem',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(12px)'
      }}>
        <Sidebar 
          partnerNames={partnerNames}
          capitalInvestments={capitalInvestments}
          laborShares={laborShares}
          charityPercentage={charityPercentage}
          onUpdateCharity={updateCharityPercentage}
          partnershipMode={partnershipMode}
          labourShareMode={labourShareMode}
          currencySymbol={currencySymbol}
          onUpdateSystemModes={updateSystemModes}
          partnerShares={partnersShares}
          onUpdatePartnerShare={updatePartnerShare}
          onCreatePartner={handleCreatePartner}
          onRenamePartner={handleRenamePartner}
          onDeletePartner={handleDeletePartner}
          onNewTransaction={handleNewTransaction}
          user={user}
          token={token}
          onLogout={logout}
          onCloseOut={handleCloseOut}
          timeEntries={timeEntries}
          onRefreshTimeEntries={() => refreshTimeEntries({ 'Authorization': `Bearer ${token}` })}
        />
      </aside>

      {/* Scrollable main content */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem'
      }}>
        <Dashboard 
          pulseData={pulseData}
          onOverridePulse={handleOverridePulse}
          partnerNames={partnerNames}
          capitalShares={capitalShares}
          laborShares={laborShares}
          transactions={transactions}
          timeEntries={timeEntries}
          charityPercentage={charityPercentage}
          partnershipMode={partnershipMode}
          labourShareMode={labourShareMode}
          currencySymbol={currencySymbol}
          partnerShares={partnersShares}
          onUpdateTransaction={handleUpdateTransaction}
          reports={reports}
          setReports={setReports}
          token={token}
          onRefreshTransactions={() => refreshTransactions({ 'Authorization': `Bearer ${token}` })}
          onCloseOut={handleCloseOut}
          onUpdateTimeEntry={handleUpdateTimeEntry}
          onDeleteTimeEntry={handleDeleteTimeEntry}
          onDeleteAllTimeEntries={handleDeleteAllTimeEntries}
          onDeleteTransaction={handleDeleteTransaction}
          onDeleteAllTransactions={handleDeleteAllTransactions}
          user={user}
        />
      </main>

      {/* Confirmation Modal Overlay */}
      {showReportModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
        }}>
            <div className="glass-card animate-fade-in flex-column" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)', padding: '2rem' }}>
                <div className="mb-4 text-center">
                    <div style={{ 
                        width: '60px', height: '60px', borderRadius: '50%', 
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                        color: '#ef4444'
                    }}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="mb-2 text-xl">Generate Distribution Report?</h3>
                    <p className="text-muted text-sm my-4">
                        This action will <strong>lock all currently open transactions</strong> and trigger the formal profit distribution logic. 
                        A PDF snapshot will be generated.
                    </p>
                </div>

                <div className="flex gap-3 mt-6" style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        onClick={() => setShowReportModal(false)}
                        className="btn w-full"
                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                        disabled={isGenerating}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmCloseOut}
                        className="btn btn-danger w-full flex items-center justify-center gap-2"
                        style={{ flex: 1 }}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <span className="animate-pulse">Generating...</span>
                        ) : (
                            <span>Proceed</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
      {/* Onboarding Modal Overlay */}
      {!isSetupComplete && isAdmin && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', backgroundColor: 'var(--bg-card)' }}>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2 text-center">
              Welcome to IYI Partner Ledger
            </h1>
            <p className="text-muted text-center mb-8">Let's configure your partnership model to get started.</p>

            <div className="flex-column" style={{ gap: '1.5rem' }}>
              <div>
                <label className="text-sm fw-bold mb-2 block">1. Partnership Model</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => setPartnershipMode('capital')}
                    className={`btn ${partnershipMode === 'capital' ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    Capital Only (Profit shared by Investment)
                  </button>
                  <button 
                    onClick={() => setPartnershipMode('labour')}
                    className={`btn ${partnershipMode === 'labour' ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    Labour Only (Profit shared by Time/Share)
                  </button>
                  <button 
                    onClick={() => setPartnershipMode('both')}
                    className={`btn ${partnershipMode === 'both' ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    Hybrid Model (Both Capital & Labour)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm fw-bold mb-2 block">2. Labour Share Calculation</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => setLabourShareMode('time')}
                    className={`btn ${labourShareMode === 'time' ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    Time Based (Log Daily Hours)
                  </button>
                  <button 
                    onClick={() => setLabourShareMode('percentage')}
                    className={`btn ${labourShareMode === 'percentage' ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    Fixed Percentage (Manual Adjust)
                  </button>
                </div>
              </div>

              <button 
                className="btn btn-primary w-full mt-4 py-4 text-lg"
                onClick={() => completeSetup(partnershipMode, labourShareMode)}
              >
                Complete Setup & Enter Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
