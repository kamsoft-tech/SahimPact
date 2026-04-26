import React, { useState } from 'react'

const Sidebar = ({ 
    partnerNames, 
    capitalInvestments, 
    laborShares, 
    charityPercentage, 
    onUpdateCharity, 
    capitalPoolPercentage,
    labourPoolPercentage,
    onUpdatePoolPercentages,
    partnerShares,
    onUpdatePartnerShare,
    onCreatePartner,
    onRenamePartner,
    onDeletePartner,
    onNewTransaction,
    user,
    token, // new prop for API calls
    onLogout,
    onCloseOut,
    timeEntries,
    onRefreshTimeEntries,
    partnershipMode,
    labourShareMode,
    currencySymbol,
    onUpdateSystemModes,
    contingencyPotMinimum,
    contingencyPotBalance,
    onUpdateContingency
}) => {
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
    const [entryType, setEntryType] = useState('expense') // 'sales', 'expense', 'salary'
    const [entryAmount, setEntryAmount] = useState('')
    const [entryDescription, setEntryDescription] = useState('')

    const [logStartTime, setLogStartTime] = useState('')
    const [logEndTime, setLogEndTime] = useState('')
    const [logDesc, setLogDesc] = useState('')

    // Partner Management State
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)
    const [newPartnerName, setNewPartnerName] = useState('')
    const [newPartnerCapital, setNewPartnerCapital] = useState('')
    const [editingPartnerId, setEditingPartnerId] = useState(null)
    const [editPartnerName, setEditPartnerName] = useState('')

    // Password Management State
    const [passwordModalUserId, setPasswordModalUserId] = useState(null)
    const [passwordModalName, setPasswordModalName] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [passwordSaving, setPasswordSaving] = useState(false)

    const handleSetPassword = async () => {
        if (!newPassword || newPassword.length < 4) {
            alert("Password must be at least 4 characters.");
            return;
        }
        setPasswordSaving(true);
        try {
            const res = await fetch(`/api/users/${passwordModalUserId}/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ password: newPassword })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed');
            }
            alert(`Password set for ${passwordModalName}. They can now log in with username "${passwordModalName}" and this password.`);
            setPasswordModalUserId(null);
            setNewPassword('');
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setPasswordSaving(false);
        }
    };

    // Handlers
    const handleLogTime = async () => {
        if (!logStartTime || !logEndTime) {
            alert("Please select both a start and end time.");
            return;
        }
        
        const start = new Date(logStartTime);
        const end = new Date(logEndTime);
        
        if (end <= start) {
            alert("End time must be after start time.");
            return;
        }

        try {
            const res = await fetch('/api/time/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    description: logDesc 
                })
            });

            if (!res.ok) {
                 const errData = await res.json();
                 throw new Error(errData.detail || "Failed to log time");
            }
            
            setLogStartTime('');
            setLogEndTime('');
            setLogDesc('');
            if (onRefreshTimeEntries) onRefreshTimeEntries();
            
        } catch (err) {
            console.error(err);
            alert(`Failed to log time: ${err.message}`);
        }
    };

    const handleCapitalInput = (index, val) => {
        const numVal = parseFloat(val)
        if (partnerShares && partnerShares[index]) {
            onUpdatePartnerShare(partnerShares[index].user_id, { capital_share_fixed: isNaN(numVal) ? 0 : numVal });
        }
    }

    const handleLabourInput = (index, val) => {
        const numVal = parseFloat(val)
        if (partnerShares && partnerShares[index]) {
            onUpdatePartnerShare(partnerShares[index].user_id, { labor_share_variable: isNaN(numVal) ? 0 : numVal });
        }
    }

    const handleAddPartner = async (e) => {
        e.preventDefault();
        if (!newPartnerName) return;
        const cap = parseFloat(newPartnerCapital) || 0;
        await onCreatePartner(newPartnerName, cap);
        setNewPartnerName('');
        setNewPartnerCapital('');
        setIsAddPartnerOpen(false);
    };

    const handleStartRename = (share) => {
        setEditingPartnerId(share.user_id);
        setEditPartnerName(share.partner_name);
    };

    const handleSaveRename = async () => {
        if (!editPartnerName) return;
        await onRenamePartner(editingPartnerId, editPartnerName);
        setEditingPartnerId(null);
    };

    const handleVoluntaryCharitySlider = (index, val) => {
        if (partnerShares && partnerShares[index]) {
            onUpdatePartnerShare(partnerShares[index].user_id, { voluntary_charity_percentage: parseFloat(val) / 100 });
        }
    }

    // Validations
    const myTimeEntries = timeEntries ? timeEntries.filter(t => t.user_id === user?.id) : [];
    const myTotalHours = myTimeEntries.reduce((sum, t) => sum + t.hours, 0);

    const handleAddEntry = async (e) => {
        e.preventDefault()
        const amt = parseFloat(entryAmount)
        if (!isNaN(amt) && amt > 0) {
            try {
                await onNewTransaction(entryType, amt, entryDescription || `${entryType} entry`)
                alert(`Entry ${entryType.toUpperCase()} saved to the ledger successfully!`)
                setIsEntryModalOpen(false)
                setEntryAmount('')
                setEntryDescription('')
            } catch (err) {
                // Error is handled in onNewTransaction (App.jsx)
            }
        }
    }

    return (
        <div className="flex-column" style={{ gap: '2rem' }}>
            {/* User Profile Section */}
            <div className="glass-card mb-4" style={{ padding: '1rem', border: '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.05)' }}>
                <div className="flex-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-white">{user?.username}</div>
                            <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">{user?.role}</div>
                        </div>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-semibold uppercase tracking-wider"
                        title="Sign Out"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>

            <div>
                <h3 className="mb-4">Quick Actions</h3>
                <button
                    className="btn btn-primary w-full"
                    style={{ width: '100%', marginBottom: '1rem' }}
                    onClick={() => setIsEntryModalOpen(true)}
                >
                    + Add Transaction
                </button>
                <button className="btn w-full flex-center" style={{ width: '100%', justifyContent: 'center' }}>
                    Export PDF Report
                </button>
            </div>

            {/* Partner Management Section (Admin Only) */}
            <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div className="flex-between mb-4">
                    <h3 className="text-sm uppercase text-blue-400 m-0">Partner Administration</h3>
                    <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                        onClick={() => setIsAddPartnerOpen(true)}
                    >
                        + Add
                    </button>
                </div>

                <div className="flex-column" style={{ gap: '0.75rem' }}>
                    {partnerShares.map((share, i) => (
                        <div key={share.user_id} className="border-b pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex-between items-center mb-1">
                                {editingPartnerId === share.user_id ? (
                                    <div className="flex gap-1 items-center flex-1 mr-2">
                                        <input 
                                            type="text" 
                                            value={editPartnerName} 
                                            onChange={e => setEditPartnerName(e.target.value)}
                                            style={{ 
                                                width: '100%', padding: '0.2rem', fontSize: '0.8rem', 
                                                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--primary)', borderRadius: '4px', color: 'white' 
                                            }}
                                        />
                                        <button onClick={handleSaveRename} className="text-success text-xs fw-bold">OK</button>
                                    </div>
                                ) : (
                                    <span className="text-sm font-semibold">{share.partner_name}</span>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => handleStartRename(share)} className="text-[10px] text-gray-500 hover:text-white uppercase tracking-tighter">Rename</button>
                                    <button 
                                        onClick={() => { setPasswordModalUserId(share.user_id); setPasswordModalName(share.partner_name); setNewPassword(''); }} 
                                        className="text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
                                    >Set Login</button>
                                    <button onClick={() => onDeletePartner(share.user_id)} className="text-[10px] text-red-900 hover:text-red-500 uppercase tracking-tighter">Remove</button>
                                </div>
                            </div>
                            
                            <div className="flex-between items-center mb-1">
                                <span className="text-[10px] text-gray-500 uppercase">Capital Amount</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-600 text-[10px]">{currencySymbol}</span>
                                    <input
                                        type="number"
                                        min="0" step="100"
                                        value={share.capital_share_fixed}
                                        onChange={(e) => handleCapitalInput(i, e.target.value)}
                                        style={{
                                            width: '80px', padding: '0.15rem 0.3rem', borderRadius: '4px',
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'white', textAlign: 'right', fontSize: '11px'
                                        }}
                                    />
                                </div>
                            </div>
                            {labourShareMode === 'percentage' && (
                                <div className="flex-between items-center">
                                    <span className="text-[10px] text-gray-500 uppercase">Labour Share</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-gray-600 text-[10px]">%</span>
                                        <input
                                            type="number"
                                            min="0" step="1"
                                            value={share.labor_share_variable}
                                            onChange={(e) => handleLabourInput(i, e.target.value)}
                                            style={{
                                                width: '60px', padding: '0.15rem 0.3rem', borderRadius: '4px',
                                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', textAlign: 'right', fontSize: '11px'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {partnerShares.length === 0 && (
                        <p className="text-xs text-muted text-center italic">No partners added yet.</p>
                    )}
                </div>
            </div>

            {/* Add Partner Modal */}
            {isAddPartnerOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                }}>
                    <div className="glass-card flex-column" style={{ width: '300px', padding: '1.5rem', background: '#0f172a' }}>
                        <h3 className="mb-4">Invite New Partner</h3>
                        <form onSubmit={handleAddPartner} className="flex-column" style={{ gap: '1rem' }}>
                            <div>
                                <label className="text-xs text-muted block mb-1">Partner Name</label>
                                <input 
                                    type="text" required value={newPartnerName} 
                                    onChange={e => setNewPartnerName(e.target.value)}
                                    placeholder="e.g. Faisal Khan"
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted block mb-1">Initial Capital ({currencySymbol})</label>
                                <input 
                                    type="number" value={newPartnerCapital} 
                                    onChange={e => setNewPartnerCapital(e.target.value)}
                                    placeholder="10000"
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddPartnerOpen(false)} className="btn flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Log Daily Hours */}
            {user?.role?.toLowerCase() !== 'admin' && labourShareMode === 'time' && (
            <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                <h3 className="mb-4 text-sm uppercase text-muted">Log My Shift</h3>
                
                <div className="mb-4 flex-between border-b pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-sm">My open period hours:</span>
                    <span className="text-secondary fw-bold">{myTotalHours.toFixed(1)} hrs</span>
                </div>

                <div className="mb-3">
                    <label className="text-xs text-muted block mb-1">Start Time</label>
                    <input
                        type="datetime-local"
                        value={logStartTime}
                        onChange={(e) => setLogStartTime(e.target.value)}
                        style={{
                            width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white'
                        }}
                    />
                </div>
                
                <div className="mb-3">
                    <label className="text-xs text-muted block mb-1">End Time</label>
                    <input
                        type="datetime-local"
                        value={logEndTime}
                        onChange={(e) => setLogEndTime(e.target.value)}
                        style={{
                            width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white'
                        }}
                    />
                </div>

                <div className="mb-4">
                    <label className="text-xs text-muted block mb-1">Description (optional)</label>
                    <input
                        type="text"
                        placeholder="e.g. Closing shift"
                        value={logDesc}
                        onChange={(e) => setLogDesc(e.target.value)}
                        style={{
                            width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white'
                        }}
                    />
                </div>

                <button 
                    className="btn btn-primary w-full"
                    onClick={handleLogTime}
                    disabled={!logStartTime || !logEndTime}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    Log Time
                </button>
            </div>
            )}

            {/* Global Settings Configuration */}
            {user?.role?.toLowerCase() === 'admin' && (
                <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                    <h3 className="mb-4 text-sm uppercase text-muted">System Configuration</h3>

                    <div className="mb-4">
                        <label className="text-xs text-muted block mb-1">Partnership Model</label>
                        <select
                            value={partnershipMode}
                            onChange={(e) => onUpdateSystemModes(e.target.value, labourShareMode, currencySymbol)}
                            style={{
                                width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', fontSize: '12px'
                            }}
                        >
                            <option value="both">Both (Capital & Labour)</option>
                            <option value="capital">Capital Only</option>
                            <option value="labour">Labour Only</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs text-muted block mb-1">Labour Share Method</label>
                        <select
                            value={labourShareMode}
                            onChange={(e) => onUpdateSystemModes(partnershipMode, e.target.value, currencySymbol)}
                            style={{
                                width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', fontSize: '12px'
                            }}
                        >
                            <option value="time">Time Based (Dynamic)</option>
                            <option value="percentage">Fixed Percentage (Manual)</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs text-muted block mb-1">Currency Symbol</label>
                        <select
                            value={currencySymbol}
                            onChange={(e) => onUpdateSystemModes(partnershipMode, labourShareMode, e.target.value)}
                            style={{
                                width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', fontSize: '12px'
                            }}
                        >
                            <option value="£">GBP (£)</option>
                            <option value="$">USD ($)</option>
                            <option value="€">EUR (€)</option>
                            <option value="Fr">CHF O (Fr)</option>
                            <option value="د.إ">AED (د.إ)</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <div className="flex-between mb-2">
                            <span className="text-sm">Global Charity %</span>
                            <span className="text-secondary fw-bold">{(charityPercentage * 100).toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="10" step="0.1"
                            value={charityPercentage * 100}
                            onChange={(e) => onUpdateCharity(parseFloat(e.target.value) / 100)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div className="mb-4">
                        <div className="flex-between mb-2">
                            <span className="text-sm">Contingency Pot Target</span>
                            <span className="text-secondary fw-bold">{currencySymbol}{contingencyPotMinimum?.toLocaleString()}</span>
                        </div>
                        <input
                            type="number"
                            min="10000" step="500"
                            value={contingencyPotMinimum}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                    onUpdateContingency(val);
                                }
                            }}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (val < 10000 || isNaN(val)) {
                                    onUpdateContingency(10000);
                                }
                            }}
                            style={{
                                width: '100%', padding: '0.4rem', borderRadius: '4px',
                                background: 'rgba(255,255,255,0.05)', color: 'white',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Minimum 10,000 required. Reserves filled before profit split.</p>
                        {contingencyPotBalance !== undefined && (
                            <p className="text-xs mt-2" style={{ color: contingencyPotBalance >= contingencyPotMinimum ? 'var(--primary)' : 'var(--accent)' }}>
                                Current Balance: <strong>{currencySymbol}{contingencyPotBalance.toLocaleString()}</strong> / {currencySymbol}{(contingencyPotMinimum || 0).toLocaleString()}
                            </p>
                        )}
                    </div>

                    {/* Capital vs Labour Pool Split */}
                    <div className="mb-4">
                        <div className="flex-between mb-2">
                            <span className="text-sm">Capital Pool %</span>
                            <span className="text-secondary fw-bold text-blue-400">{(capitalPoolPercentage * 100).toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="100" step="1"
                            value={capitalPoolPercentage * 100}
                            onChange={(e) => {
                                const cap = parseFloat(e.target.value) / 100;
                                const lab = 1.0 - cap;
                                onUpdatePoolPercentages(cap, lab);
                            }}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="mb-4">
                        <div className="flex-between mb-2">
                            <span className="text-sm">Labour Pool %</span>
                            <span className="text-secondary fw-bold text-emerald-400">{(labourPoolPercentage * 100).toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="100" step="1"
                            value={labourPoolPercentage * 100}
                            onChange={(e) => {
                                const lab = parseFloat(e.target.value) / 100;
                                const cap = 1.0 - lab;
                                onUpdatePoolPercentages(cap, lab);
                            }}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            )}

            {/* Partner Voluntary Charity Deductions */}
            <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                <h3 className="mb-4 text-sm uppercase text-muted">Voluntary Partner Charity</h3>

                {partnerShares.map((share, i) => {
                    const volPct = share ? (share.voluntary_charity_percentage * 100).toFixed(1) : 0;
                    return (
                        <div key={share.user_id} className="mb-4">
                            <div className="flex-between mb-2">
                                <span className="text-sm">{share.partner_name}</span>
                                <span className="text-secondary fw-bold">{volPct}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="100" step="1"
                                value={volPct}
                                onChange={(e) => handleVoluntaryCharitySlider(i, e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="mt-auto pt-8">
                <button 
                    className="btn btn-danger w-full" 
                    style={{ width: '100%', padding: '1rem', fontWeight: 'bold' }}
                    onClick={onCloseOut}
                >
                    GENERATE REPORT
                </button>
                <p className="text-muted text-sm mt-3 text-center">Locks open transactions & triggers payouts</p>
            </div>

            {/* Transaction Modal Overlay */}
            {isEntryModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
                        <div className="flex-between mb-4">
                            <h3>Add Ledger Entry</h3>
                            <button onClick={() => setIsEntryModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
                        </div>

                        <div className="flex gap-2 mb-4" style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                className={`btn w - full ${entryType === 'sales' ? 'btn-primary' : ''} `}
                                onClick={() => setEntryType('sales')}
                            >Sales</button>
                            <button
                                type="button"
                                className={`btn w - full ${entryType === 'expense' ? 'btn-primary' : ''} `}
                                onClick={() => setEntryType('expense')}
                            >Purchase</button>
                            <button
                                type="button"
                                className={`btn w - full ${entryType === 'salary' ? 'btn-primary' : ''} `}
                                onClick={() => setEntryType('salary')}
                            >Salary</button>
                        </div>

                        <form onSubmit={handleAddEntry} className="flex-column" style={{ gap: '1rem' }}>
                            <div>
                                <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Amount ({currencySymbol})</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    value={entryAmount}
                                    onChange={(e) => setEntryAmount(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
                                <input
                                    type="text"
                                    required
                                    placeholder={
                                        entryType === 'sales' ? "e.g. Daily POS Batch" :
                                            entryType === 'salary' ? "e.g. Weekly Kitchen Staff" :
                                                "e.g. Produce restock"
                                    }
                                    value={entryDescription}
                                    onChange={(e) => setEntryDescription(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>

                            {entryType === 'expense' && (
                                <div>
                                    <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Expense Category</label>
                                    <select style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                        background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white'
                                    }}>
                                        <option>Cost of Goods Sold (COGS)</option>
                                        <option>Operating Expense (OpEx)</option>
                                        <option>Marketing / Advertising</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>
                                    {entryType === 'sales' ? 'Upload Z-Report / POS Data' : 'Upload Receipt / Invoice'} (PDF/IMG)
                                </label>
                                <input type="file" style={{
                                    width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.3)',
                                    color: 'white', fontSize: '0.9rem'
                                }} />
                            </div>
                            <button type="submit" className="btn btn-primary w-full mt-2" style={{ width: '100%' }}>Post to Ledger</button>
                        </form>
                    </div>
                </div>
            )}
                {/* Set Password Modal */}
            {passwordModalUserId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
                }}>
                    <div className="glass-card flex-column" style={{ width: '320px', padding: '1.5rem', background: '#0f172a' }}>
                        <h3 className="mb-1">Set Login Password</h3>
                        <p className="text-xs text-muted mb-4">
                            Partner: <strong>{passwordModalName}</strong><br />
                            Username: <strong>{passwordModalName}</strong>
                        </p>
                        <input
                            type="password"
                            placeholder="Enter new password (min. 4 chars)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '0.6rem', marginBottom: '1rem',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '6px', color: 'white'
                            }}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setPasswordModalUserId(null)} className="btn flex-1">Cancel</button>
                            <button onClick={handleSetPassword} className="btn btn-primary flex-1" disabled={passwordSaving}>
                                {passwordSaving ? 'Saving...' : 'Set Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
    )
}

export default Sidebar
