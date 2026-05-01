import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';

const Partnerships = () => {
    const { showNotification } = useNotification();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [targetUser, setTargetUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    
    // Add Partner Form
    const [addUsername, setAddUsername] = useState('');
    const [addFullName, setAddFullName] = useState('');
    const [addPassword, setAddPassword] = useState('');
    const [addRole, setAddRole] = useState('PARTNER');

    const [shares, setShares] = useState([]);
    
    // Edit User Form
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editRole, setEditRole] = useState('PARTNER');
    const [editCapital, setEditCapital] = useState(0);
    const [editVoluntaryCharity, setEditVoluntaryCharity] = useState(0);

    const [pendingAgreement, setPendingAgreement] = useState(null);
    const [agreementHistory, setAgreementHistory] = useState([]);

    useEffect(() => {
        fetchData();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('agreement')) {
            // Give it a moment to render
            setTimeout(() => {
                document.getElementById('agreement-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 500);
        }
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, sharesRes, pendingAgRes, historyRes] = await Promise.all([
                axios.get('/api/admin/users'),
                axios.get('/api/admin/shares'),
                axios.get('/api/agreements/pending'),
                axios.get('/api/agreements/history')
            ]);
            setUsers(usersRes.data);
            setShares(sharesRes.data);
            setPendingAgreement(pendingAgRes.data);
            setAgreementHistory(historyRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignAgreement = async (id, action) => {
        try {
            await axios.post(`/api/agreements/${id}/sign`, { action });
            showNotification(action === 'APPROVE' ? "Agreement signed!" : "Agreement rejected", "success");
            fetchData();
        } catch (error) {
            showNotification("Failed to record signature", "error");
        }
    };

    const fetchUsers = fetchData; // For backward compatibility in existing code

    const handleResetPassword = async () => {
        try {
            await axios.post('/api/admin/reset-password', {
                user_id: targetUser.id,
                new_password: newPassword
            });
            showNotification(`Password reset for ${targetUser.username}`, "success");
            setShowResetModal(false);
            setNewPassword('');
        } catch (error) {
            showNotification("Failed to reset password", "error");
        }
    };

    const handleAddPartner = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/users', {
                username: addUsername,
                full_name: addFullName,
                password: addPassword,
                role: addRole
            });
            showNotification("Partner added successfully!", "success");
            setShowAddModal(false);
            setAddUsername('');
            setAddFullName('');
            setAddPassword('');
            setAddRole('PARTNER');
            fetchData();
        } catch (error) {
            showNotification("Failed to add partner", "error");
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        try {
            // Update User Info
            await axios.put(`/api/admin/users/${targetUser.id}`, {
                full_name: editFullName,
                role: editRole
            });

            // Update Share Info
            await axios.put(`/api/admin/shares/${targetUser.id}`, {
                capital_share_fixed: parseFloat(editCapital),
                labor_share_variable: 0, // Placeholder
                voluntary_charity_percentage: parseFloat(editVoluntaryCharity) / 100
            });

            showNotification("User and equity updated successfully!", "success");
            setShowEditModal(false);
            fetchData();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to update user", "error");
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-slide-in">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Partnerships</h1>
                    <p className="text-on-surface-variant mt-2">Manage company partners, admins, and access controls.</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="btn-primary">
                    <span className="material-symbols-outlined text-sm">person_add</span> Add Partner
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => (
                    <div key={user.id} className="card flex flex-col gap-4 group hover:scale-[1.02] transition-all duration-300">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold uppercase">
                                {user.full_name ? user.full_name.substring(0, 2) : user.username.substring(0, 2)}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border ${
                                user.role === 'COMPANY_ADMIN' 
                                ? 'bg-secondary/10 text-secondary border-secondary/20' 
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}>
                                {user.role.replace('_', ' ')}
                            </span>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{user.full_name || 'No Name Set'}</h3>
                            <p className="text-sm text-on-surface-variant">@{user.username}</p>
                        </div>
                        <div className="bg-surface-container rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-[10px] text-on-surface-variant uppercase font-bold block mb-0.5">Investment Part</span>
                                <span className="font-black">£{(shares.find(s => s.user_id === user.id)?.capital_share_fixed || 0).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-on-surface-variant uppercase font-bold block mb-0.5">Vol. Charity</span>
                                <span className="font-black">{(shares.find(s => s.user_id === user.id)?.voluntary_charity_percentage * 100 || 0).toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-4 border-t border-outline-variant/30 mt-auto">
                            <button 
                                className="btn-ghost flex-1 text-xs py-1.5" 
                                onClick={() => { setTargetUser(user); setShowResetModal(true); }}
                            >
                                <span className="material-symbols-outlined text-sm">lock_reset</span> Reset PW
                            </button>
                            <button 
                                className="btn-ghost flex-1 text-xs py-1.5"
                                onClick={() => {
                                    const userShare = shares.find(s => s.user_id === user.id);
                                    setTargetUser(user);
                                    setEditFullName(user.full_name || '');
                                    setEditRole(user.role);
                                    setEditCapital(userShare?.capital_share_fixed || 0);
                                    setEditVoluntaryCharity((userShare?.voluntary_charity_percentage || 0) * 100);
                                    setShowEditModal(true);
                                }}
                            >
                                <span className="material-symbols-outlined text-sm">edit</span> Edit
                            </button>
                        </div>
                    </div>
                ))}
                {users.length === 0 && !isLoading && (
                    <div className="col-span-full py-12 text-center card border-dashed">
                        <p className="text-on-surface-variant">No partners found. Add one to get started.</p>
                    </div>
                )}
                {isLoading && (
                    <div className="col-span-full py-12 text-center">
                         <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                )}
            </div>

            {/* Password Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="card w-full max-w-sm animate-slide-in shadow-2xl">
                        <h3 className="text-xl font-bold mb-2">Reset Password</h3>
                        <p className="text-sm text-on-surface-variant mb-6">Enter a new password for <b>{targetUser.username}</b></p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="label-text">New Password</label>
                                <input 
                                    type="password" 
                                    className="input-field w-full" 
                                    placeholder="Min 8 characters" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowResetModal(false)} className="btn-ghost flex-1">Cancel</button>
                                <button onClick={handleResetPassword} className="btn-primary flex-1">Reset Now</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Partner Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="card w-full max-w-md animate-slide-in shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Add New Partner</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-on-surface">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleAddPartner} className="flex flex-col gap-4">
                            <div>
                                <label className="label-text">Username</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full" 
                                    placeholder="alphanumeric only" 
                                    value={addUsername}
                                    onChange={(e) => setAddUsername(e.target.value)}
                                    required 
                                />
                            </div>
                            <div>
                                <label className="label-text">Full Name</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full" 
                                    placeholder="Display Name" 
                                    value={addFullName}
                                    onChange={(e) => setAddFullName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label-text">Initial Password</label>
                                <input 
                                    type="password" 
                                    className="input-field w-full" 
                                    placeholder="Min 8 characters" 
                                    value={addPassword}
                                    onChange={(e) => setAddPassword(e.target.value)}
                                    required 
                                />
                            </div>
                            <div>
                                <label className="label-text">System Role</label>
                                <select 
                                    className="input-field w-full"
                                    value={addRole}
                                    onChange={(e) => setAddRole(e.target.value)}
                                >
                                    <option value="PARTNER">Partner</option>
                                    <option value="COMPANY_ADMIN">Company Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Add Partner</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="card w-full max-w-md animate-slide-in shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Edit User: @{targetUser.username}</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-on-surface-variant hover:text-on-surface">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleEditUser} className="flex flex-col gap-4">
                            <div>
                                <label className="label-text">Full Name</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full" 
                                    placeholder="Display Name" 
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label-text">System Role</label>
                                <select 
                                    className="input-field w-full"
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                >
                                    <option value="PARTNER">Partner</option>
                                    <option value="COMPANY_ADMIN">Company Admin</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-text">Investment Part (£)</label>
                                    <input 
                                        type="number" 
                                        className="input-field w-full" 
                                        value={editCapital}
                                        onChange={(e) => setEditCapital(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label-text">Vol. Charity (%)</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="input-field w-full" 
                                        value={editVoluntaryCharity}
                                        onChange={(e) => setEditVoluntaryCharity(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowEditModal(false)} className="btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Partnership Agreement & Sign-off Section */}
            <div id="agreement-section" className="mt-12 border-t border-outline-variant pt-12">
                <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-3xl text-primary">history_edu</span>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Partnership Agreements</h2>
                        <p className="text-on-surface-variant text-sm">Review, sign, and audit partnership parameter changes.</p>
                    </div>
                </div>                {pendingAgreement ? (
                    <div className={`card border-2 mb-12 animate-fade-in ${
                        pendingAgreement.agreement_type === 'PERIOD_CLOSE' 
                        ? 'border-secondary/30 bg-secondary/5' 
                        : 'border-primary/30 bg-primary/5'
                    }`}>
                        <div className="flex flex-col lg:flex-row gap-8">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                                        pendingAgreement.agreement_type === 'PERIOD_CLOSE' 
                                        ? 'bg-secondary text-on-secondary' 
                                        : 'bg-primary text-on-primary'
                                    }`}>
                                        Action Required
                                    </span>
                                    <span className="text-xs text-on-surface-variant font-medium">
                                        Proposed by {pendingAgreement.proposed_by_name} • {new Date(pendingAgreement.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold mb-2">{pendingAgreement.change_summary}</h3>
                                <p className="text-sm text-on-surface-variant mb-6">
                                    {pendingAgreement.agreement_type === 'PERIOD_CLOSE' 
                                        ? "A request to lock and distribute profits for the current period has been submitted. Review the distribution details before signing."
                                        : "A new set of partnership parameters has been proposed. All partners must review and sign these changes before they are applied to system calculations."
                                    }
                                </p>
                                
                                <div className="space-y-6">
                                    {pendingAgreement.agreement_type === 'PARAMETER_CHANGE' && pendingAgreement.proposed_settings && (
                                        <div className="bg-surface-container rounded-xl p-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-3">Proposed Financial Parameters</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-[10px] block text-on-surface-variant">Charity Pot</span>
                                                    <span className="font-bold">{(pendingAgreement.proposed_settings.charity_percentage * 100).toFixed(1)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] block text-on-surface-variant">Capital Pool</span>
                                                    <span className="font-bold">{(pendingAgreement.proposed_settings.capital_pool_percentage * 100).toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] block text-on-surface-variant">Labour Pool</span>
                                                    <span className="font-bold">{(pendingAgreement.proposed_settings.labour_pool_percentage * 100).toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] block text-on-surface-variant">Contingency</span>
                                                    <span className="font-bold">£{pendingAgreement.proposed_settings.contingency_pot_minimum.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {pendingAgreement.agreement_type === 'PARAMETER_CHANGE' && pendingAgreement.proposed_shares && (
                                        <div className="bg-surface-container rounded-xl p-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-3">Proposed Investment Shares</h4>
                                            <div className="space-y-2">
                                                {pendingAgreement.proposed_shares.map((share, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-outline-variant/30 last:border-0">
                                                        <span className="font-medium">{users.find(u => u.id === share.user_id)?.full_name || 'Partner'}</span>
                                                        <span className="font-bold">£{share.capital_share_fixed.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {pendingAgreement.agreement_type === 'PERIOD_CLOSE' && (
                                        <div className="bg-surface-container rounded-xl p-6 border border-secondary/20">
                                            <div className="flex items-center gap-3 text-secondary mb-4">
                                                <span className="material-symbols-outlined">lock_clock</span>
                                                <h4 className="font-bold">Period Closure Details</h4>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                <div className="bg-surface/50 p-3 rounded-lg">
                                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Period</span>
                                                    <span className="font-black">{pendingAgreement.period_name}</span>
                                                </div>
                                                {pendingAgreement.negligent_user_id && (
                                                    <div className="bg-error/5 p-3 rounded-lg border border-error/20">
                                                        <span className="text-[10px] uppercase font-bold text-error block mb-1">Negligence Claim</span>
                                                        <span className="font-black text-error">
                                                            {users.find(u => u.id === pendingAgreement.negligent_user_id)?.full_name || `Partner ${pendingAgreement.negligent_user_id}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-on-surface-variant mt-4 italic">
                                                * Signing this will freeze all transactions for the period and trigger the automated profit/loss distribution.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full lg:w-80 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/50">
                                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">signature</span>
                                    Sign-off Status
                                </h4>
                                <div className="space-y-4 mb-6">
                                    {pendingAgreement.signoffs.map(sign => (
                                        <div key={sign.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${sign.status === 'APPROVED' ? 'bg-primary' : 'bg-on-surface-variant/30'}`}></div>
                                                <span className="text-xs font-medium">{sign.full_name || sign.username}</span>
                                            </div>
                                            {sign.status === 'APPROVED' ? (
                                                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                                            ) : (
                                                <span className="text-[10px] text-on-surface-variant font-bold">PENDING</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => handleSignAgreement(pendingAgreement.id, 'APPROVE')}
                                        className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold hover:shadow-lg transition-all"
                                    >
                                        Digitally Sign
                                    </button>
                                    <button 
                                        onClick={() => handleSignAgreement(pendingAgreement.id, 'REJECT')}
                                        className="w-full py-3 rounded-xl bg-error/10 text-error font-bold hover:bg-error/20 transition-all"
                                    >
                                        Reject Proposal
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-surface-container rounded-2xl p-8 text-center border border-dashed border-outline-variant mb-12">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">verified_user</span>
                        <p className="text-sm text-on-surface-variant">No pending agreements. All partnership parameters are up to date and signed.</p>
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Agreement History</h3>
                    
                    {/* Desktop View */}
                    <div className="hidden sm:block overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-black tracking-widest text-[10px]">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Date</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Summary</th>
                                    <th className="px-4 py-3">Proposed By</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/30">
                                {agreementHistory.map(ag => (
                                    <tr key={ag.id} className="hover:bg-surface-container/30 transition-colors">
                                        <td className="px-4 py-4 whitespace-nowrap">{new Date(ag.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-bold uppercase tracking-tight ${ag.agreement_type === 'PERIOD_CLOSE' ? 'text-secondary' : 'text-primary'}`}>
                                                {ag.agreement_type?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-bold">{ag.change_summary}</td>
                                        <td className="px-4 py-4">{ag.proposed_by_name}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                ag.status === 'APPROVED' ? 'bg-primary/10 text-primary border-primary/20' : 
                                                ag.status === 'REJECTED' ? 'bg-error/10 text-error border-error/20' : 
                                                'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant'
                                            }`}>
                                                {ag.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="sm:hidden space-y-4">
                        {agreementHistory.map(ag => (
                            <div key={ag.id} className="card bg-surface-container-low border-outline-variant/30">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-on-surface-variant">{new Date(ag.created_at).toLocaleDateString()}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                                        ag.status === 'APPROVED' ? 'bg-primary/10 text-primary border-primary/20' : 
                                        ag.status === 'REJECTED' ? 'bg-error/10 text-error border-error/20' : 
                                        'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant'
                                    }`}>
                                        {ag.status}
                                    </span>
                                </div>
                                <h4 className="font-bold text-sm mb-1">{ag.change_summary}</h4>
                                <div className="flex justify-between items-end mt-4">
                                    <span className="text-[10px] text-on-surface-variant">By {ag.proposed_by_name}</span>
                                    <span className={`text-[9px] font-black uppercase ${ag.agreement_type === 'PERIOD_CLOSE' ? 'text-secondary' : 'text-primary'}`}>
                                        {ag.agreement_type?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {agreementHistory.length === 0 && (
                        <div className="py-12 text-center text-on-surface-variant italic card border-dashed">
                            No previous agreements recorded.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Partnerships;
