import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';

const SystemConfig = () => {
    const { showNotification } = useNotification();
    const { role } = useAuth();
    const location = useLocation();
    const { refreshBranding } = useBranding();
    
    // Check for tab param in URL
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'global';
    
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab) {
            setActiveTab(tab);
            if (tab === 'orphans' && role === 'SUPER_ADMIN') {
                fetchCompanies();
                fetchOrphanedPartners();
            }
        }
    }, [location.search, role]);
    
    // Global Settings State
    const [settings, setSettings] = useState({
        primary_color: '#94d4ad',
        secondary_color: '#bfc1ff',
        logo_url: '',
        favicon_url: '',
        currency_symbol: '£',
        charity_percentage: 0.06,
        partnership_mode: 'both',
        labour_share_mode: 'time',
        capital_pool_percentage: 0.5,
        labour_pool_percentage: 0.5,
        contingency_pot_minimum: 10000,
        company_name: ''
    });

    // Company Management State
    const [companies, setCompanies] = useState([]);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [newCompany, setNewCompany] = useState({ name: '', admin_username: '', admin_password: '' });
    
    // Reset Password State
    const [resetPasswordModal, setResetPasswordModal] = useState({ isOpen: false, userId: null, username: '', newPassword: '' });

    // Manage Users State
    const [manageUsersModal, setManageUsersModal] = useState({ 
        isOpen: false, 
        companyId: null, 
        companyName: '', 
        users: [],
        orphans: [], // Available orphans to add
        newUsername: '', 
        newPassword: '',
        showOrphanList: false
    });

    const [orphanedPartners, setOrphanedPartners] = useState([]);


    const [pendingAgreement, setPendingAgreement] = useState(null);

    useEffect(() => {
        fetchSettings();
        if (role === 'SUPER_ADMIN') {
            fetchCompanies();
            fetchOrphanedPartners();
        }
    }, [role]);

    const fetchSettings = async () => {
        try {
            const [settingsRes, pendingRes] = await Promise.all([
                axios.get('/api/settings'),
                axios.get('/api/agreements/pending')
            ]);
            
            let companyName = '';
            if (role === 'COMPANY_ADMIN') {
                const companyId = sessionStorage.getItem('company_id');
                if (companyId && companyId !== 'null') {
                    const companyRes = await axios.get(`/api/companies/${companyId}`);
                    companyName = companyRes.data?.name || '';
                }
            }

            setSettings({ ...settingsRes.data, company_name: companyName });
            setPendingAgreement(pendingRes.data);
            
            if (settingsRes.data.primary_color) document.documentElement.style.setProperty('--primary-brand', settingsRes.data.primary_color);
            if (settingsRes.data.secondary_color) document.documentElement.style.setProperty('--secondary-brand', settingsRes.data.secondary_color);
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const fetchCompanies = async () => {
        try {
            const res = await axios.get('/api/companies');
            setCompanies(res.data);
        } catch (error) {
            console.error("Failed to fetch companies", error);
        }
    };

    const fetchOrphanedPartners = async () => {
        try {
            const res = await axios.get('/api/companies/orphaned-partners');
            setOrphanedPartners(res.data);
        } catch (error) {
            console.error("Failed to fetch orphaned partners", error);
        }
    };

    const handleSaveSettings = async () => {
        setIsLoading(true);
        try {
            await axios.put('/api/settings', settings);
            
            if (role === 'COMPANY_ADMIN' && settings.company_name) {
                const companyId = sessionStorage.getItem('company_id');
                if (companyId && companyId !== 'null') {
                    await axios.put(`/api/companies/${companyId}`, { name: settings.company_name });
                }
            }

            showNotification("Changes proposed! All partners must sign to apply.", "success");
            fetchSettings();
            refreshBranding();
        } catch (error) {
            showNotification("Failed to update settings", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // 1. Create Company
            const companyRes = await axios.post('/api/companies', { name: newCompany.name });
            const companyId = companyRes.data.id;

            // 2. Create Admin
            await axios.post(`/api/companies/${companyId}/admin`, {
                username: newCompany.admin_username,
                password: newCompany.admin_password
            });

            showNotification(`Company ${newCompany.name} created successfully!`, "success");
            setIsCompanyModalOpen(false);
            setNewCompany({ name: '', admin_username: '', admin_password: '' });
            fetchCompanies();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to create company", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCompanyUsers = async (companyId) => {
        try {
            const res = await axios.get(`/api/companies/${companyId}/users`);
            setManageUsersModal(prev => ({ ...prev, users: res.data }));
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };

    const openManageUsersModal = (companyId, companyName) => {
        setManageUsersModal({ 
            isOpen: true, 
            companyId, 
            companyName, 
            users: [], 
            orphans: orphanedPartners,
            newUsername: '', 
            newPassword: '',
            showOrphanList: false
        });
        fetchCompanyUsers(companyId);
    };

    const handleToggleCompanyActive = async (companyId) => {
        try {
            await axios.put(`/api/companies/${companyId}/toggle-active`);
            showNotification("Company status toggled successfully.", "success");
            fetchCompanies();
        } catch (error) {
            showNotification("Failed to toggle company status", "error");
        }
    };

    const handleHardDeleteCompany = async (companyId, companyName) => {
        if (!window.confirm(`WARNING: This will PERMANENTLY delete ${companyName} and ALL associated data (transactions, accounts, users). This action cannot be undone. Are you sure?`)) {
            return;
        }

        try {
            await axios.delete(`/api/companies/${companyId}`);
            showNotification(`${companyName} and all its data have been purged.`, "success");
            fetchCompanies();
        } catch (error) {
            showNotification("Failed to delete company", "error");
        }
    };

    const handleAdoptPartner = async (userId, companyId) => {
        try {
            await axios.post(`/api/companies/${companyId}/adopt-partner/${userId}`);
            showNotification("Partner linked to company successfully.", "success");
            
            // Refresh everything
            fetchOrphanedPartners();
            if (manageUsersModal.isOpen) {
                fetchCompanyUsers(manageUsersModal.companyId);
                setManageUsersModal(prev => ({ ...prev, showOrphanList: false }));
            }
            fetchCompanies();
        } catch (error) {
            showNotification("Failed to link partner", "error");
        }
    };

    const handleSystemWipe = async () => {
        const confirm1 = window.confirm("🚨 CRITICAL WARNING: You are about to PERMANENTLY WIPE ALL SYSTEM DATA. This includes all companies, users, transactions, and reports. Only your account will remain. Are you absolutely sure?");
        if (!confirm1) return;

        const confirm2 = window.prompt("Type 'PURGE' to confirm this destructive action:");
        if (confirm2 !== 'PURGE') {
            showNotification("Wipe cancelled. Confirmation text mismatch.", "error");
            return;
        }

        setIsLoading(true);
        try {
            await axios.post('/api/admin/system-wipe');
            showNotification("System wiped successfully. Resetting application...", "success");
            // Clear company context and redirect to companies tab
            sessionStorage.removeItem('company_id');
            setActiveTab('companies');
            fetchCompanies();
            fetchOrphanedPartners();
        } catch (error) {
            showNotification("Failed to wipe system data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        const { companyId, companyName, newUsername, newPassword } = manageUsersModal;
        
        if (!newPassword || newPassword.length < 8) {
            showNotification("Password must be at least 8 characters.", "error");
            return;
        }

        setIsLoading(true);
        try {
            await axios.post(`/api/companies/${companyId}/admin`, {
                username: newUsername,
                password: newPassword
            });
            showNotification(`Admin account added to ${companyName} successfully.`, "success");
            setManageUsersModal(prev => ({ ...prev, newUsername: '', newPassword: '' }));
            fetchCompanyUsers(companyId);
            fetchCompanies();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to add admin", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateUserRole = async (userId, newRole) => {
        const { companyId } = manageUsersModal;
        try {
            await axios.put(`/api/companies/${companyId}/users/${userId}/role`, { role: newRole });
            showNotification(`User role updated successfully.`, "success");
            fetchCompanyUsers(companyId);
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to update role", "error");
        }
    };

    const handleDeactivateUser = async (userId) => {
        const { companyId } = manageUsersModal;
        try {
            await axios.delete(`/api/companies/${companyId}/users/${userId}`);
            showNotification(`User deactivated successfully.`, "success");
            fetchCompanyUsers(companyId);
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to deactivate user", "error");
        }
    };

    const openResetPasswordModal = (userId, username) => {

        setResetPasswordModal({ isOpen: true, userId, username, newPassword: '' });
    };

    const handleResetAdminPassword = async (e) => {
        e.preventDefault();
        const { userId, username, newPassword } = resetPasswordModal;
        
        if (!newPassword || newPassword.length < 8) {
            showNotification("Password must be at least 8 characters.", "error");
            return;
        }

        try {
            await axios.post('/api/admin/reset-password', {
                user_id: userId,
                new_password: newPassword
            });
            showNotification(`Password for ${username} reset successfully.`, "success");
            setResetPasswordModal({ isOpen: false, userId: null, username: '', newPassword: '' });
        } catch (error) {
            showNotification("Failed to reset password", "error");
        }
    };


    return (
        <div className="flex flex-col gap-8 animate-slide-in pb-20 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-extrabold tracking-tight">System Configuration</h1>
                    <p className="text-on-surface-variant">Manage global constants, branding, and enterprise entities.</p>
                </div>

                {role === 'SUPER_ADMIN' && (
                    <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                        <div className="flex gap-1 p-1 bg-surface-container-low rounded-xl w-max border border-outline-variant/20">
                        <button 
                            onClick={() => setActiveTab('global')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'global' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                        >
                            Global Settings
                        </button>
                        <button 
                            onClick={() => setActiveTab('companies')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'companies' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                        >
                            Company Management
                        </button>
                        <button 
                            onClick={() => setActiveTab('orphans')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orphans' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                        >
                            Orphaned Partners
                            {orphanedPartners.length > 0 && <span className="ml-2 bg-error text-on-error rounded-full px-1.5 py-0.5 text-[10px]">{orphanedPartners.length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('danger')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'danger' ? 'bg-error text-on-error shadow-lg shadow-error/20' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                        >
                            Danger Zone
                        </button>
                        </div>
                    </div>
                )}
            </div>

            {pendingAgreement && activeTab === 'global' && (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined">pending_actions</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-primary">Pending Partnership Agreement</h4>
                            <p className="text-xs text-on-surface-variant">There is an active proposal for financial parameters. New changes will overwrite the current proposal.</p>
                        </div>
                    </div>
                    <a href="/partnerships?agreement=true" className="btn-ghost text-xs py-2 px-4">Review Agreement</a>
                </div>
            )}

            {activeTab === 'global' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                    {/* Brand & Appearance */}
                    <div className="card flex flex-col gap-6">
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined">palette</span>
                            <h3 className="font-bold">White-Labeling & Branding</h3>
                        </div>
                        
                        <div className="space-y-4">
                            {role === 'COMPANY_ADMIN' && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-on-surface-variant">Company Name</label>
                                    <input 
                                        type="text" 
                                        className="input-field w-full" 
                                        value={settings.company_name || ''}
                                        onChange={(e) => setSettings({...settings, company_name: e.target.value})}
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Primary Brand Color</label>
                                <div className="flex gap-3">
                                    <input 
                                        type="color" 
                                        className="w-12 h-10 rounded-lg border border-outline-variant bg-transparent cursor-pointer disabled:opacity-50" 
                                        value={settings.primary_color || '#94d4ad'}
                                        onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                                        disabled={role === 'PARTNER'}
                                    />
                                    <input 
                                        type="text" 
                                        className="input-field flex-1 disabled:opacity-50" 
                                        value={settings.primary_color || '#94d4ad'}
                                        onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                                        disabled={role === 'PARTNER'}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Secondary Brand Color</label>
                                <div className="flex gap-3">
                                    <input 
                                        type="color" 
                                        className="w-12 h-10 rounded-lg border border-outline-variant bg-transparent cursor-pointer disabled:opacity-50" 
                                        value={settings.secondary_color || '#bfc1ff'}
                                        onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
                                        disabled={role === 'PARTNER'}
                                    />
                                    <input 
                                        type="text" 
                                        className="input-field flex-1 disabled:opacity-50" 
                                        value={settings.secondary_color || '#bfc1ff'}
                                        onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
                                        disabled={role === 'PARTNER'}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Logo URL</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full disabled:opacity-50" 
                                    placeholder="https://example.com/logo.png"
                                    value={settings.logo_url || ''}
                                    onChange={(e) => setSettings({...settings, logo_url: e.target.value})}
                                    disabled={role === 'PARTNER'}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-on-surface-variant">Favicon URL</label>
                                    <button 
                                        type="button"
                                        onClick={() => setSettings({...settings, favicon_url: settings.logo_url})}
                                        className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
                                        disabled={!settings.logo_url}
                                    >
                                        Use Logo as Favicon
                                    </button>
                                </div>
                                <input 
                                    type="text" 
                                    className="input-field w-full disabled:opacity-50" 
                                    placeholder="https://example.com/favicon.ico"
                                    value={settings.favicon_url || ''}
                                    onChange={(e) => setSettings({...settings, favicon_url: e.target.value})}
                                    disabled={role === 'PARTNER'}
                                />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl overflow-hidden border border-primary/20">
                                {settings.logo_url ? <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-1" /> : settings.primary_color?.charAt(1).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-bold">Brand Preview</p>
                                <p className="text-xs text-on-surface-variant mb-2">Interface will adapt to these colors.</p>
                                <div className="flex gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: settings.primary_color }}></div>
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: settings.secondary_color }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Constants */}
                    <div className="card flex flex-col gap-6">
                        <div className="flex items-center gap-2 text-secondary">
                            <span className="material-symbols-outlined">account_balance</span>
                            <h3 className="font-bold">Financial Parameters</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Currency Symbol</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full text-xl font-bold disabled:opacity-50" 
                                    value={settings.currency_symbol}
                                    onChange={(e) => setSettings({...settings, currency_symbol: e.target.value})}
                                    disabled={role === 'PARTNER'}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Global Charity %</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className="input-field w-full pr-10 disabled:opacity-50" 
                                        value={Math.round(settings.charity_percentage * 10000) / 100}
                                        onChange={(e) => setSettings({...settings, charity_percentage: parseFloat(e.target.value) / 100})}
                                        disabled={role === 'PARTNER'}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">%</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Capital Pool %</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="input-field w-full disabled:opacity-50" 
                                    value={Math.round(settings.capital_pool_percentage * 10000) / 100}
                                    onChange={(e) => setSettings({...settings, capital_pool_percentage: parseFloat(e.target.value) / 100})}
                                    disabled={role === 'PARTNER'}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Labour Pool %</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="input-field w-full disabled:opacity-50" 
                                    value={Math.round(settings.labour_pool_percentage * 10000) / 100}
                                    onChange={(e) => setSettings({...settings, labour_pool_percentage: parseFloat(e.target.value) / 100})}
                                    disabled={role === 'PARTNER'}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Partnership Mode</label>
                                <select 
                                    className="input-field w-full disabled:opacity-50" 
                                    value={settings.partnership_mode}
                                    onChange={(e) => setSettings({...settings, partnership_mode: e.target.value})}
                                    disabled={role === 'PARTNER'}
                                >
                                    <option value="both">Both (Capital & Labour)</option>
                                    <option value="capital_only">Capital Only</option>
                                    <option value="labour_only">Labour Only</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Labour Share Mode</label>
                                <select 
                                    className="input-field w-full disabled:opacity-50" 
                                    value={settings.labour_share_mode}
                                    onChange={(e) => setSettings({...settings, labour_share_mode: e.target.value})}
                                    disabled={role === 'PARTNER'}
                                >
                                    <option value="time">Time Logged (Dynamic)</option>
                                    <option value="fixed">Fixed Percentage</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2 sm:col-span-2">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{settings.currency_symbol}</span>
                                    <input 
                                        type="number" 
                                        className="input-field w-full pl-10 disabled:opacity-50" 
                                        value={settings.contingency_pot_minimum}
                                        onChange={(e) => setSettings({...settings, contingency_pot_minimum: parseFloat(e.target.value)})}
                                        disabled={role === 'PARTNER'}
                                    />
                                </div>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">
                                    Current: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(settings.contingency_pot_minimum).replace('£', settings.currency_symbol)}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {role !== 'PARTNER' && (
                        <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[60]">
                            <button 
                                onClick={handleSaveSettings} 
                                disabled={isLoading}
                                className="btn-primary px-6 py-4 md:px-8 md:py-4 shadow-2xl shadow-primary/40 text-sm md:text-lg flex items-center gap-3 rounded-2xl"
                            >
                                <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>
                                    {isLoading ? 'sync' : 'history_edu'}
                                </span>
                                <span>{isLoading ? 'Staging...' : 'Propose Changes'}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'companies' && (
                <div className="flex flex-col gap-6 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold">Registered Companies</h2>
                        <button 
                            onClick={() => setIsCompanyModalOpen(true)}
                            className="btn-secondary px-6 py-2 text-sm"
                        >
                            <span className="material-symbols-outlined">add</span>
                            New Company
                        </button>
                    </div>

                    <div className="card overflow-hidden !p-0 border-outline-variant/20 shadow-sm">
                        <div className="overflow-x-auto hidden sm:block">
                            <table className="min-w-[800px] w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-container-high border-b border-outline-variant/30">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-on-surface-variant">Company Name</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-on-surface-variant">Created</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-on-surface-variant">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/10">
                                {companies.map((company) => (
                                    <tr key={company.id} className="hover:bg-surface-container-low transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-secondary/10 text-secondary flex items-center justify-center font-bold">
                                                    {company.name.charAt(0)}
                                                </div>
                                                <span className="font-bold">{company.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${company.is_active ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                                                {company.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                                            {new Date(company.created_at).toLocaleDateString()}
                                        </td>
                                                <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button 
                                                    className={`p-2 rounded-lg hover:bg-surface-container-high transition-all ${company.is_active ? 'text-primary' : 'text-on-surface-variant'}`}
                                                    title={company.is_active ? "Soft Delete (Deactivate)" : "Reactivate"}
                                                    onClick={() => handleToggleCompanyActive(company.id)}
                                                >
                                                    <span className="material-symbols-outlined text-sm">{company.is_active ? 'toggle_on' : 'toggle_off'}</span>
                                                </button>
                                                <button 
                                                    className="p-2 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-all"
                                                    title="Hard Delete (Purge Data)"
                                                    onClick={() => handleHardDeleteCompany(company.id, company.name)}
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                                                </button>
                                                <div className="w-[1px] h-4 bg-outline-variant/30 self-center mx-1"></div>
                                                <button 
                                                    className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-all"
                                                    title="Manage Users"
                                                    onClick={() => openManageUsersModal(company.id, company.name)}
                                                >
                                                    <span className="material-symbols-outlined text-sm">manage_accounts</span>
                                                </button>
                                                <button 
                                                    className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-all"
                                                    title="Reset Admin Password"
                                                    onClick={() => openResetPasswordModal(company.admin_id, company.admin_username || (company.name + ' Admin'))}
                                                >
                                                    <span className="material-symbols-outlined text-sm">lock_reset</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {companies.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-on-surface-variant">
                                            No companies found. Create one to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                    {/* Mobile Company Cards */}
                    <div className="flex flex-col divide-y divide-outline-variant/20 sm:hidden">
                        {companies.map((company) => (
                            <div key={company.id} className="p-5 flex flex-col gap-4 hover:bg-surface-container-low transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-secondary/10 text-secondary flex items-center justify-center font-bold">
                                            {company.name.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black">{company.name}</span>
                                            <span className="text-[10px] text-on-surface-variant font-bold">Created {new Date(company.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${company.is_active ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                                        {company.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                
                                <div className="flex gap-2 justify-end mt-2">
                                    <button 
                                        className="p-2 rounded-xl bg-surface-container text-on-surface-variant"
                                        onClick={() => openManageUsersModal(company.id, company.name)}
                                        title="Manage Users"
                                    >
                                        <span className="material-symbols-outlined text-lg">manage_accounts</span>
                                    </button>
                                    <button 
                                        className="p-2 rounded-xl bg-surface-container text-on-surface-variant"
                                        onClick={() => openResetPasswordModal(company.admin_id, company.admin_username || (company.name + ' Admin'))}
                                        title="Reset Password"
                                    >
                                        <span className="material-symbols-outlined text-lg">lock_reset</span>
                                    </button>
                                    <button 
                                        className={`p-2 rounded-xl ${company.is_active ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}
                                        onClick={() => handleToggleCompanyActive(company.id)}
                                    >
                                        <span className="material-symbols-outlined text-lg">{company.is_active ? 'toggle_on' : 'toggle_off'}</span>
                                    </button>
                                    <button 
                                        className="p-2 rounded-xl bg-error/10 text-error"
                                        onClick={() => handleHardDeleteCompany(company.id, company.name)}
                                    >
                                        <span className="material-symbols-outlined text-lg">delete_forever</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {companies.length === 0 && (
                            <div className="p-12 text-center text-on-surface-variant italic">
                                No companies found.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'orphans' && (
                <div className="flex flex-col gap-6 animate-fade-in">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-xl font-bold">Orphaned Partners</h2>
                        <p className="text-sm text-on-surface-variant">Partners created without a company association or whose previous company was hard-deleted.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {orphanedPartners.map(orphan => (
                            <div key={orphan.id} className="card flex flex-col gap-4 border-dashed border-error/30 hover:border-error transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center font-bold">
                                        {orphan.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold">@{orphan.username}</h4>
                                        <p className="text-xs text-on-surface-variant">{orphan.full_name || 'No full name'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 mt-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Link to Company</label>
                                    <select 
                                        className="input-field text-sm"
                                        onChange={(e) => handleAdoptPartner(orphan.id, e.target.value)}
                                        value=""
                                    >
                                        <option value="" disabled>Select a company...</option>
                                        {companies.length > 0 ? (
                                            companies.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} {!c.is_active && '(Inactive)'}</option>
                                            ))
                                        ) : (
                                            <option disabled>No companies available</option>
                                        )}
                                    </select>
                                    {companies.length === 0 && (
                                        <p className="text-[10px] text-error mt-1">Create a company first to link this partner.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {orphanedPartners.length === 0 && (
                            <div className="col-span-full py-16 text-center card border-dashed">
                                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">person_check</span>
                                <p className="text-on-surface-variant">No orphaned partners found. All partners are associated with companies.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'danger' && role === 'SUPER_ADMIN' && (
                <div className="flex flex-col gap-8 animate-fade-in">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-xl font-bold text-error">Danger Zone</h2>
                        <p className="text-sm text-on-surface-variant">Sensitive system-level destructive actions. Proceed with extreme caution.</p>
                    </div>

                    <div className="card border-error/50 bg-error/5 flex flex-col gap-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-error/10 text-error">
                                <span className="material-symbols-outlined text-3xl">terminal</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-error mb-1">System Reset (Production Wipe)</h3>
                                <p className="text-sm text-on-surface-variant leading-relaxed">
                                    This action will <span className="font-bold">PERMANENTLY DELETE</span> all enterprise records, transaction histories, partners, and reports. 
                                    Your Super Admin account will be the only data preserved. This is used to clear test data before a live onboarding.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-error/10 rounded-xl border border-error/20 gap-4">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-error">warning</span>
                                <span className="text-xs font-bold uppercase tracking-widest text-error">This action cannot be undone</span>
                            </div>
                            <button 
                                onClick={handleSystemWipe}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-6 py-3 bg-error text-on-error rounded-xl font-bold hover:bg-error/90 transition-all shadow-lg shadow-error/20 disabled:opacity-50"
                            >
                                {isLoading ? 'Wiping System...' : 'Wipe All System Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Company Modal */}
            {isCompanyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm animate-fade-in">
                    <div className="card w-full max-w-lg shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">New Enterprise</h2>
                            <button onClick={() => setIsCompanyModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleCreateCompany} className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Company Name</label>
                                <input 
                                    type="text" 
                                    className="input-field" 
                                    placeholder="Enter company name..."
                                    value={newCompany.name}
                                    onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                                    required
                                />
                            </div>
                            <hr className="border-outline-variant/30" />
                            <div className="flex flex-col gap-4">
                                <p className="text-xs font-black uppercase tracking-widest text-secondary">Primary Admin Account</p>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-on-surface-variant">Username</label>
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        placeholder="Admin username"
                                        value={newCompany.admin_username}
                                        onChange={(e) => setNewCompany({...newCompany, admin_username: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-on-surface-variant">Initial Password</label>
                                    <input 
                                        type="password" 
                                        className="input-field" 
                                        placeholder="At least 8 characters"
                                        value={newCompany.admin_password}
                                        onChange={(e) => setNewCompany({...newCompany, admin_password: e.target.value})}
                                        required
                                        minLength={8}
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={isLoading} className="btn-primary py-3">
                                {isLoading ? 'Creating...' : 'Create Company & Admin'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm animate-fade-in">
                    <div className="card w-full max-w-sm shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Reset Password</h2>
                            <button onClick={() => setResetPasswordModal({ isOpen: false, userId: null, username: '', newPassword: '' })} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-on-surface-variant mb-4">
                            Enter a new password for <span className="font-bold text-on-surface">{resetPasswordModal.username}</span>.
                        </p>
                        <form onSubmit={handleResetAdminPassword} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">New Password</label>
                                <input 
                                    type="password" 
                                    className="input-field" 
                                    placeholder="At least 8 characters"
                                    value={resetPasswordModal.newPassword}
                                    onChange={(e) => setResetPasswordModal({...resetPasswordModal, newPassword: e.target.value})}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => setResetPasswordModal({ isOpen: false, userId: null, username: '', newPassword: '' })} className="btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Users Modal */}
            {manageUsersModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm animate-fade-in">
                    <div className="card w-full max-w-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Manage Users</h2>
                            <button onClick={() => setManageUsersModal({ isOpen: false, companyId: null, companyName: '', users: [], newUsername: '', newPassword: '' })} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-on-surface-variant mb-4">
                            Managing users for <span className="font-bold text-on-surface">{manageUsersModal.companyName}</span>.
                        </p>

                        <div className="flex flex-col gap-4 mb-8">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Existing Users</h3>
                                <button 
                                    onClick={() => setManageUsersModal(prev => ({ ...prev, showOrphanList: !prev.showOrphanList }))}
                                    className="btn-ghost py-1 px-3 text-xs flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">{manageUsersModal.showOrphanList ? 'close' : 'person_add'}</span>
                                    {manageUsersModal.showOrphanList ? 'Close Orphan List' : 'Add Existing Partner'}
                                </button>
                            </div>

                            {manageUsersModal.showOrphanList && (
                                <div className="p-4 bg-surface-container-high rounded-xl border border-outline-variant/30 animate-fade-in mb-4">
                                    <h4 className="text-xs font-bold mb-3">Available Orphaned Partners</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {orphanedPartners.map(orphan => (
                                            <button 
                                                key={orphan.id}
                                                onClick={() => handleAdoptPartner(orphan.id, manageUsersModal.companyId)}
                                                className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/30 hover:border-primary hover:text-primary transition-all text-xs font-medium flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-sm">add</span>
                                                {orphan.username}
                                            </button>
                                        ))}
                                        {orphanedPartners.length === 0 && <p className="text-xs text-on-surface-variant">No unassigned partners available.</p>}
                                    </div>
                                </div>
                            )}

                            <div className="border border-outline-variant/30 rounded-xl overflow-x-auto scrollbar-hide">
                                <table className="w-full text-left min-w-[500px]">
                                    <thead className="bg-surface-container-low">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-on-surface-variant">Username</th>
                                            <th className="px-4 py-3 text-xs font-bold text-on-surface-variant">Role</th>
                                            <th className="px-4 py-3 text-xs font-bold text-on-surface-variant">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold text-on-surface-variant text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant/10">
                                        {manageUsersModal.users.map(u => (
                                            <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                                                <td className="px-4 py-3 font-medium whitespace-nowrap">{u.username}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${u.role === 'COMPANY_ADMIN' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                                                        {u.role === 'COMPANY_ADMIN' ? 'Admin' : 'Partner'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {u.is_active ? (
                                                        <span className="text-primary text-xs font-bold">Active</span>
                                                    ) : (
                                                        <span className="text-error text-xs font-bold">Deactivated</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                                        {u.is_active && u.role === 'PARTNER' && (
                                                            <button onClick={() => handleUpdateUserRole(u.id, 'COMPANY_ADMIN')} className="text-xs text-primary hover:underline font-bold">Promote to Admin</button>
                                                        )}
                                                        {u.is_active && u.role === 'COMPANY_ADMIN' && (
                                                            <button onClick={() => handleUpdateUserRole(u.id, 'PARTNER')} className="text-xs text-secondary hover:underline font-bold">Demote to Partner</button>
                                                        )}
                                                        {u.is_active && (
                                                            <button onClick={() => handleDeactivateUser(u.id)} className="text-xs text-error hover:underline font-bold ml-2">Deactivate</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {manageUsersModal.users.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-8 text-center text-on-surface-variant">No users found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <form onSubmit={handleCreateAdmin} className="flex flex-col gap-4 bg-surface-container p-4 rounded-xl border border-outline-variant/20">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Create New Admin</h3>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-sm font-bold text-on-surface-variant">Admin Username</label>
                                    <input 
                                        type="text" 
                                        className="input-field bg-background" 
                                        placeholder="Username"
                                        value={manageUsersModal.newUsername}
                                        onChange={(e) => setManageUsersModal({...manageUsersModal, newUsername: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-sm font-bold text-on-surface-variant">Initial Password</label>
                                    <input 
                                        type="password" 
                                        className="input-field bg-background" 
                                        placeholder="At least 8 characters"
                                        value={manageUsersModal.newPassword}
                                        onChange={(e) => setManageUsersModal({...manageUsersModal, newPassword: e.target.value})}
                                        required
                                        minLength={8}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end mt-2">
                                <button type="submit" disabled={isLoading} className="btn-primary">
                                    {isLoading ? 'Creating...' : 'Create Admin Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemConfig;
