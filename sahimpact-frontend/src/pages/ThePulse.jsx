import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';

const ThePulse = () => {
    const { role, company_id } = useAuth();
    const { logo_url } = useBranding();
    const [stats, setStats] = useState({
        total_revenue: 0,
        total_expenses: 0,
        net_profit: 0,
        active_partners: 0
    });
    const [contingency, setContingency] = useState({ balance: 0, minimum: 10000 });
    const [charityFund, setCharityFund] = useState({ balance: 0 });
    const [reports, setReports] = useState([]);
    const [forecast, setForecast] = useState({ net_profit: 0, partners: [], contingency_allocation: 0, global_charity: 0 });
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [filterMode, setFilterMode] = useState('current'); 
    const [isClosing, setIsClosing] = useState(false);
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const { showNotification } = useNotification();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchPulseData();
    }, [filterMode, selectedMonth, selectedYear]);

    const fetchPulseData = async () => {
        setIsLoading(true);
        try {
            const params = { month: selectedMonth, year: selectedYear };
            const [statsRes, contRes, settingsRes, reportsRes, forecastRes, charityRes] = await Promise.all([
                axios.get('/api/ledger/stats', { params }),
                axios.get('/api/distribution/contingency-balance'),
                axios.get('/api/settings'),
                axios.get('/api/distribution/reports'),
                axios.get('/api/distribution/forecast', { params }),
                axios.get('/api/distribution/charity-balance', { params })
            ]);
            setStats(statsRes.data);
            setContingency({ 
                balance: contRes.data.balance || 0, 
                minimum: settingsRes.data.contingency_pot_minimum || 10000 
            });
            setCharityFund({ balance: charityRes.data.balance || 0 });
            setReports(reportsRes.data);
            setForecast(forecastRes.data);
        } catch (error) {
            console.error("Failed to fetch Pulse data", error);
            showNotification("Failed to fetch dashboard data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const [negligentUserId, setNegligentUserId] = useState(null);
    const [isProposingClose, setIsProposingClose] = useState(false);

    const handleProposePeriodClose = async () => {
        setIsProposingClose(true);
        setShowCloseConfirmModal(false);
        try {
            await axios.post('/api/agreements/propose-close', {
                negligent_user_id: negligentUserId
            });
            showNotification("Period close agreement proposed! All partners must sign off to finalize.", "success");
            fetchPulseData();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to propose period close", "error");
        } finally {
            setIsProposingClose(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 md:gap-8 animate-slide-in p-4 md:p-6 max-w-7xl mx-auto font-data">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    {logo_url && <img src={logo_url} alt="Logo" className="w-16 h-16 object-contain drop-shadow-lg" />}
                    <div className="flex flex-col">
                        <h1 className="text-4xl font-extrabold tracking-tight font-brand text-text-main">The Pulse</h1>
                        <p className="text-text-muted text-sm">
                            {role === 'SUPER_ADMIN' ? 'Global System Monitoring' : 'Real-time financial performance and equity projections.'}
                            {company_id && <span className="ml-2 px-2 py-0.5 bg-bg-base rounded text-[10px] font-black tracking-widest border border-border-muted/30">ID: #{company_id}</span>}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-bg-surface p-2 rounded-2xl border border-border-muted shadow-lg">
                    <button 
                        onClick={() => setFilterMode('current')}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${filterMode === 'current' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-bg-base hover:text-text-main'}`}
                    >
                        Live
                    </button>
                    <button 
                        onClick={() => setFilterMode('period')}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${filterMode === 'period' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-bg-base hover:text-text-main'}`}
                    >
                        Historical
                    </button>
                    
                    {filterMode === 'period' && (
                        <div className="flex items-center gap-2 pl-4 border-l border-border-muted ml-2">
                            <select 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="bg-transparent text-sm font-bold text-text-main focus:outline-none cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1} className="bg-bg-surface">
                                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                            <select 
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="bg-transparent text-sm font-bold text-text-main focus:outline-none cursor-pointer"
                            >
                                {[2024, 2025, 2026].map(y => (
                                    <option key={y} value={y} className="bg-bg-surface">{y}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="card group hover:border-primary/50 transition-all duration-300 p-5">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <span className="material-symbols-outlined text-2xl md:text-3xl">payments</span>
                        </div>
                    </div>
                    <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Total Revenue</span>
                    <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">£{(stats?.total_revenue || 0).toLocaleString()}</span>
                </div>

                <div className="card group hover:border-primary/50 transition-all duration-300 p-5">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <span className="material-symbols-outlined text-2xl md:text-3xl">trending_up</span>
                        </div>
                    </div>
                    <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Net Profit</span>
                    <span className={`text-4xl font-extrabold block mt-2 font-tabular ${stats?.net_profit < 0 ? 'text-text-danger' : 'text-primary'}`}>
                        £{(stats?.net_profit || 0).toLocaleString()}
                    </span>
                </div>

                <div className="card group hover:border-text-danger/50 transition-all duration-300 p-5">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div className="p-2.5 rounded-xl bg-text-danger/10 text-text-danger group-hover:bg-text-danger group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl md:text-3xl">receipt_long</span>
                        </div>
                    </div>
                    <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Total Expenses</span>
                    <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">£{(stats?.total_expenses || 0).toLocaleString()}</span>
                </div>

                <div className="card group hover:border-primary/50 transition-all duration-300 bg-bg-surface/50">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined text-3xl">volunteer_activism</span>
                        </div>
                    </div>
                    <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Charity Fund</span>
                    <div className="flex flex-col">
                        <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">£{(charityFund.balance || 0).toLocaleString()}</span>
                        <div className="flex items-center gap-2 mt-3 p-2 bg-primary/5 rounded-lg border border-primary/10 w-fit">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">Forecasted Addition</span>
                            <span className="text-xs font-black text-primary font-tabular">+£{(forecast?.global_charity || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="card group hover:border-secondary/50 transition-all duration-300 bg-bg-surface/50 border-secondary/20">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-xl transition-colors ${contingency.balance >= contingency.minimum ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                            <span className="material-symbols-outlined text-3xl">shield</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${contingency.balance >= contingency.minimum ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary/10 text-secondary border border-secondary/20'}`}>
                            {contingency.balance >= contingency.minimum ? 'Secured' : 'Target Needed'}
                        </span>
                    </div>
                    <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Contingency Pot</span>
                    <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">£{(contingency?.balance || 0).toLocaleString()}</span>
                    <div className="mt-6 w-full bg-bg-base rounded-full h-2 overflow-hidden border border-border-muted/30">
                        <div 
                            className={`h-full transition-all duration-500 ${contingency.balance >= contingency.minimum ? 'bg-primary shadow-[0_0_8px_rgba(46,222,164,0.5)]' : 'bg-secondary shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} 
                            style={{ width: `${Math.min(100, (contingency.balance / (contingency.minimum || 1)) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-3">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">Goal: £{(contingency?.minimum || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="card group hover:border-primary/50 transition-all duration-300 bg-bg-surface/50">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined text-3xl">group</span>
                        </div>
                    </div>
                    <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Team Hours</span>
                    <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">{forecast?.total_hours_logged || 0}</span>
                </div>

                {role === 'SUPER_ADMIN' && (
                    <>
                        <div className="card group hover:border-secondary/50 transition-all duration-300 border-secondary/20">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                                    <span className="material-symbols-outlined text-3xl">corporate_fare</span>
                                </div>
                            </div>
                            <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Total Companies</span>
                            <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">{stats?.company_count || 0}</span>
                        </div>
                        <div className="card group hover:border-secondary/50 transition-all duration-300 border-secondary/20">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                                    <span className="material-symbols-outlined text-3xl">badge</span>
                                </div>
                            </div>
                            <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">Total System Users</span>
                            <span className="text-4xl font-extrabold block mt-2 text-text-main font-tabular">{stats?.user_count || 0}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Forecast Section */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-extrabold text-text-main font-brand uppercase tracking-tighter">Current Period Forecast</h2>
                        <p className="text-xs md:text-sm text-text-muted mt-1">Real-time equity projection based on unclosed transactions.</p>
                    </div>
                    <div className="px-5 py-3 md:px-6 md:py-4 bg-primary/5 border border-primary/20 rounded-2xl shadow-xl shadow-primary/5 w-full md:w-auto">
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] block mb-1">Distributable Profit</span>
                        <span className="text-2xl md:text-3xl font-black text-text-main font-tabular">£{(forecast?.distributable_profit || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="card p-0 overflow-hidden border-border-muted/50 bg-bg-surface shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-bg-base/50 border-b border-border-muted/50">
                                <tr>
                                    <th className="px-6 py-5 text-[10px] font-black text-text-muted uppercase tracking-[0.25em]">Partner</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-text-muted uppercase tracking-[0.25em] text-right">Hours</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-text-muted uppercase tracking-[0.25em] text-right">Gross Share</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-secondary uppercase tracking-[0.25em] text-right">Vol. Charity</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-primary uppercase tracking-[0.25em] text-right">Net Share</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-text-muted uppercase tracking-[0.25em] text-right">Expenses</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-text-main uppercase tracking-[0.25em] text-right">Total Est.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-muted/30">
                                {forecast.partners.map((p, i) => (
                                    <tr key={i} className="hover:bg-primary/[0.03] transition-colors">
                                        <td className="px-6 py-5 font-black text-text-main font-brand">{p.partner_name}</td>
                                        <td className="px-6 py-5 text-right font-tabular text-text-muted">{(p.hours || 0).toFixed(2)}</td>
                                        <td className="px-6 py-5 text-right font-tabular text-text-muted">£{(p?.gross_payout || 0).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-right font-black font-tabular text-secondary">£{(p?.voluntary_charity || 0).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-right font-black font-tabular text-primary">£{(p?.forecasted_share || 0).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-right font-tabular text-text-muted">£{(p?.reimbursements || 0).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-right font-black font-tabular text-text-main bg-primary/[0.02]">£{(p?.total_estimated || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-bg-base/30 border-t border-border-muted/50">
                                <tr>
                                    <td className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest" colSpan="2">Contingency Allocation</td>
                                    <td className="px-6 py-4 text-right font-black text-secondary font-tabular" colSpan="5">£{(forecast?.contingency_allocation || 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
                <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-text-main font-brand uppercase tracking-tighter">Agreement Ledger</h2>
                    <p className="text-xs md:text-sm text-text-muted mt-1">Formal historical distributions locked and verified.</p>
                </div>
                <button 
                    onClick={() => {
                        setNegligentUserId(null);
                        setShowCloseConfirmModal(true);
                    }} 
                    disabled={isProposingClose}
                    className="btn-primary w-full md:w-auto"
                >
                    <span className="material-symbols-outlined text-lg">history_edu</span> 
                    {isProposingClose ? 'Proposing...' : 'Propose Period Close'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {reports.length === 0 ? (
                    <div className="card h-48 flex items-center justify-center border-dashed border-border-muted text-center">
                        <p className="text-text-muted font-bold">No historical distributions found.<br/>Generate a report to lock the current period.</p>
                    </div>
                ) : (
                    reports.map(report => (
                        <div key={report.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/40 transition-all border-l-4 border-l-primary/50">
                            <div>
                                <h3 className="text-xl font-extrabold text-text-main font-brand">{report.period_name}</h3>
                                <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">Locked on {new Date(report.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex flex-wrap gap-12 text-right">
                                <div>
                                    <span className="text-[10px] text-text-muted uppercase font-black tracking-widest block mb-1">Profit Distributed</span>
                                    <span className="font-black text-text-main font-tabular text-lg">£{(report?.net_profit || 0).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-secondary uppercase font-black tracking-widest block mb-1">Total Charity</span>
                                    <span className="font-black text-secondary font-tabular text-lg">£{((report?.global_charity || 0) + (report?.voluntary_charity || 0)).toLocaleString()}</span>
                                </div>
                                <button className="btn-ghost" onClick={() => setSelectedReport(report)}>
                                    <span className="material-symbols-outlined">visibility</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals - Simplified for brevity in this overhaul but kept consistent with theme */}
            {showCloseConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg-base/90 backdrop-blur-md animate-fade-in">
                    <div className="card w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] border-border-muted/30">
                        <h2 className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter mb-4">Propose Period Close</h2>
                        <p className="text-text-muted leading-relaxed mb-6">
                            This will create a formal agreement to lock the period. All partners must sign off before the distributions are finalized and transactions archived.
                        </p>

                        {forecast.distributable_profit < 0 && (
                            <div className="mb-8 p-4 bg-text-danger/5 border border-text-danger/20 rounded-xl">
                                <label className="text-[10px] font-black text-text-danger uppercase tracking-widest block mb-2">Identify Negligent Partner (Optional)</label>
                                <p className="text-[10px] text-text-muted mb-3 leading-tight">If selected, this partner will carry 100% of the loss for this period.</p>
                                <select 
                                    value={negligentUserId || ''} 
                                    onChange={(e) => setNegligentUserId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full bg-bg-base border border-border-muted rounded-lg p-2 text-sm font-bold text-text-main focus:ring-1 focus:ring-text-danger outline-none"
                                >
                                    <option value="">No Negligence (Proportional Loss)</option>
                                    {forecast.partners.map(p => (
                                        <option key={p.partner_user_id || p.partner_name} value={p.partner_user_id}>{p.partner_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button onClick={() => setShowCloseConfirmModal(false)} className="btn-ghost flex-1 font-black">Cancel</button>
                            <button onClick={handleProposePeriodClose} className="btn-primary flex-1 shadow-primary/20">
                                Send Proposal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Report Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg-base/95 backdrop-blur-xl animate-fade-in overflow-y-auto">
                    <div className="card w-full max-w-4xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border-border-muted my-auto bg-bg-surface">
                        <div className="flex justify-between items-center mb-8 border-b border-border-muted/30 pb-6">
                            <div>
                                <h2 className="text-3xl font-black text-text-main font-brand">{selectedReport.period_name}</h2>
                                <p className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mt-1">Sealed on {new Date(selectedReport.created_at).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="p-3 rounded-full hover:bg-bg-base transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                            <div className="p-4 bg-bg-base/50 rounded-2xl border border-border-muted/20">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Gross Profit</p>
                                <p className="text-xl font-black text-text-main mt-1 font-tabular">£{(selectedReport?.net_profit || 0).toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/20">
                                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Contingency</p>
                                <p className="text-xl font-black text-secondary mt-1 font-tabular">
                                    £{(selectedReport?.report_data?.contingency_pot_allocation || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Global Charity</p>
                                <p className="text-xl font-black text-primary mt-1 font-tabular">£{(selectedReport?.global_charity || 0).toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Vol. Charity</p>
                                <p className="text-xl font-black text-primary mt-1 font-tabular">£{(selectedReport?.voluntary_charity || 0).toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-bg-base/50 rounded-2xl border border-border-muted/20">
                                <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Distributed</p>
                                <p className="text-xl font-black text-text-main mt-1 font-tabular">
                                    £{((selectedReport?.report_data?.distributable_net_profit || selectedReport?.net_profit || 0) - (selectedReport?.global_charity || 0)).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="border border-border-muted/50 rounded-2xl overflow-x-auto scrollbar-hide shadow-inner">
                            <table className="w-full text-left min-w-[700px]">
                                <thead className="bg-bg-base/50">
                                    <tr>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Partner</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Capital £</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Labour £</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right">Charity £</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-text-main text-right">Total Payout</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-muted/20">
                                    {selectedReport.report_data?.distributions?.map((dist, idx) => (
                                        <tr key={idx} className="hover:bg-primary/[0.02]">
                                            <td className="p-4 font-black font-brand text-text-main whitespace-nowrap">{dist.partner_name || `Partner ${dist.user_id}`}</td>
                                            <td className="p-4 text-right font-tabular text-text-muted">£{(dist.capital_payout || 0).toLocaleString()}</td>
                                            <td className="p-4 text-right font-tabular text-text-muted">£{(dist.labor_payout || 0).toLocaleString()}</td>
                                            <td className="p-4 text-right font-black text-secondary font-tabular">£{(dist.voluntary_charity_amount || 0).toLocaleString()}</td>
                                            <td className="p-4 text-right font-black text-primary font-tabular bg-primary/[0.02]">
                                                £{(dist.total_payout || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={() => setSelectedReport(null)} className="btn-primary w-full mt-8">Close Report View</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThePulse;
