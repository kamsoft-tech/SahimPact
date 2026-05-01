import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';

const Ledger = () => {
    const [transactions, setTransactions] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ total_revenue: 0, total_expenses: 0, net_profit: 0 });
    const { showNotification } = useNotification();
    
    // Form State (Manual)
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('expense'); // 'sales', 'expense'

    // Form State (Upload)
    const [file, setFile] = useState(null);

    // Form State (POS)
    const [posDate, setPosDate] = useState(new Date().toISOString().split('T')[0]);
    const [grossSales, setGrossSales] = useState('');
    const [taxCollected, setTaxCollected] = useState('');
    const [tipsCollected, setTipsCollected] = useState('');

    useEffect(() => {
        fetchTransactions();
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/ledger/stats');
            setStats(res.data);
        } catch (error) {
            console.error("Failed to fetch stats", error);
        }
    };

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('/api/ledger');
            setTransactions(res.data);
        } catch (error) {
            console.error("Failed to fetch ledger", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/ledger', {
                type,
                amount: parseFloat(amount),
                description
            });
            showNotification("Transaction logged successfully!", "success");
            setShowModal(false);
            setAmount('');
            setDescription('');
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification("Failed to log transaction", "error");
        }
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            showNotification("Please select a file to upload.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setIsLoading(true);
            const res = await axios.post('/api/ingest/bank-statement', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            showNotification(res.data.message || "CSV processed successfully!", "success");
            setShowUploadModal(false);
            setFile(null);
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to process CSV", "error");
            setIsLoading(false);
        }
    };

    const handleApprove = async (txId) => {
        try {
            await axios.put(`/api/ledger/${txId}/approve`);
            showNotification("Transaction approved", "success");
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification("Failed to approve", "error");
        }
    };

    const handleReject = async (txId) => {
        if (!window.confirm("Are you sure you want to reject and delete this transaction?")) return;
        try {
            await axios.delete(`/api/ledger/${txId}/reject`);
            showNotification("Transaction rejected", "success");
            fetchTransactions();
        } catch (error) {
            showNotification("Failed to reject", "error");
        }
    };


    return (
        <div className="flex flex-col gap-6 md:gap-8 animate-slide-in">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-outline-variant pb-6 gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Ledger & Transactions</h1>
                    <p className="text-sm text-on-surface-variant mt-2">Manage financial records and out-of-pocket reimbursements.</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <button onClick={() => setShowUploadModal(true)} className="btn-secondary shadow-lg shadow-secondary/20 flex-1 md:flex-none">
                        <span className="material-symbols-outlined text-sm">upload_file</span> <span className="md:hidden lg:inline">Bank CSV</span>
                    </button>
                    <button onClick={() => setShowModal(true)} className="btn-primary shadow-lg shadow-primary/20 flex-1 md:flex-none">
                        <span className="material-symbols-outlined text-sm">add</span> Manual Entry
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card bg-primary/5 border-primary/20 p-6 flex flex-col gap-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-primary text-xl">payments</span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Revenue</span>
                    </div>
                    <span className="text-3xl font-black text-primary">£{stats.total_revenue.toLocaleString()}</span>
                </div>
                <div className="card bg-error/5 border-error/20 p-6 flex flex-col gap-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-error text-xl">shopping_cart</span>
                        <span className="text-[10px] font-black text-error uppercase tracking-[0.2em]">Expenses</span>
                    </div>
                    <span className="text-3xl font-black text-error">£{stats.total_expenses.toLocaleString()}</span>
                </div>
                <div className="card bg-secondary/5 border-secondary/20 p-6 flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-secondary text-xl">trending_up</span>
                        <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Net Profit</span>
                    </div>
                    <span className="text-3xl font-black text-secondary">£{stats.net_profit.toLocaleString()}</span>
                </div>
            </div>

            <div className="card overflow-hidden p-0 border-outline-variant/20 shadow-sm">
                <div className="overflow-x-auto hidden sm:block">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-surface-container-highest border-b border-outline-variant">
                            <tr>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Amount</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/30">
                             {transactions.map((tx) => (
                                <tr key={tx.id} className={`hover:bg-surface-container-high transition-colors group ${tx.is_pending ? 'bg-secondary/5 border-l-4 border-l-secondary' : ''}`}>
                                    <td className="px-4 md:px-6 py-4 text-sm text-on-surface-variant">
                                        {new Date(tx.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-sm font-medium">
                                        {tx.description}
                                        {tx.is_pending && (
                                            <div className="flex items-center gap-1 text-[10px] text-secondary font-bold uppercase mt-1">
                                                <span className="material-symbols-outlined text-xs">warning</span> Potential Duplicate
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            tx.type === 'sales' 
                                            ? 'bg-primary/10 text-primary border-primary/20' 
                                            : 'bg-error/10 text-error border-error/20'
                                        }`}>
                                            {tx.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className={`px-4 md:px-6 py-4 text-sm text-right font-bold ${tx.type === 'sales' ? 'text-primary' : 'text-error'}`}>
                                        {tx.type === 'sales' ? '+' : '-'}£{tx.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-right">
                                        {tx.is_pending && (
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleApprove(tx.id)}
                                                    className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                                    title="Approve"
                                                >
                                                    <span className="material-symbols-outlined text-lg">check</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleReject(tx.id)}
                                                    className="p-1.5 rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all shadow-sm"
                                                    title="Reject"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-on-surface-variant">
                                        No transactions found. Log an entry to see it here.
                                    </td>
                                </tr>
                            )}
                            {isLoading && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center">
                                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Cards */}
                <div className="flex flex-col divide-y divide-outline-variant/20 sm:hidden">
                    {transactions.map((tx) => (
                        <div key={tx.id} className={`p-5 flex flex-col gap-4 hover:bg-surface-container-high transition-colors ${tx.is_pending ? 'bg-secondary/5 border-l-4 border-l-secondary' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{new Date(tx.date).toLocaleDateString()}</span>
                                    <span className="text-sm font-black mt-1">{tx.description}</span>
                                    {tx.is_pending && (
                                        <div className="flex items-center gap-1 text-[10px] text-secondary font-black uppercase mt-1">
                                            <span className="material-symbols-outlined text-xs">warning</span> Potential Duplicate
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`text-lg font-black ${tx.type === 'sales' ? 'text-primary' : 'text-error'}`}>
                                        {tx.type === 'sales' ? '+' : '-'}£{tx.amount.toLocaleString()}
                                    </span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                                        tx.type === 'sales' 
                                        ? 'bg-primary/10 text-primary' 
                                        : 'bg-error/10 text-error'
                                    }`}>
                                        {tx.type.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {tx.is_pending && (
                                <div className="flex gap-2 mt-2">
                                    <button 
                                        onClick={() => handleApprove(tx.id)}
                                        className="btn-primary flex-1 py-2 text-xs"
                                    >
                                        Approve
                                    </button>
                                    <button 
                                        onClick={() => handleReject(tx.id)}
                                        className="btn-ghost text-error hover:bg-error/10 flex-1 py-2 text-xs"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {transactions.length === 0 && !isLoading && (
                        <div className="p-12 text-center text-on-surface-variant italic">
                            No transactions found.
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Entry Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="card w-full max-w-md animate-slide-in shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Log New Expense</h3>
                            <button onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-on-surface">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="label-text">Transaction Type</label>
                                <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/30">
                                    <button 
                                        type="button"
                                        onClick={() => setType('expense')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'expense' ? 'bg-error text-on-error shadow-lg shadow-error/20' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                                    >
                                        Operating Expense
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setType('sales')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'sales' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                                    >
                                        Sales Revenue
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="label-text">Amount (£)</label>
                                <input 
                                    type="number" 
                                    className="input-field w-full" 
                                    placeholder="0.00" 
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required 
                                />
                            </div>
                            <div>
                                <label className="label-text">Description</label>
                                <input 
                                    type="text" 
                                    className="input-field w-full" 
                                    placeholder="e.g., Domain Registration" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required 
                                />
                            </div>
                            <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
                                <p className="text-xs text-on-surface-variant">
                                    <span className="font-bold text-primary">Double-Entry Note:</span> {type === 'sales' ? 'Debits Cash, Credits Sales Revenue.' : 'Debits Operating Expense, Credits Cash.'}
                                </p>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Entry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bank CSV Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="card w-full max-w-md animate-slide-in shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Upload Bank Statement</h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-on-surface-variant hover:text-on-surface">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleFileUpload} className="flex flex-col gap-4">
                            <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
                                <p className="text-xs text-on-surface-variant">
                                    Upload a CSV exported from your bank (e.g., Tide, Wise). The system will automatically map the columns and generate double-entry ledger records.
                                </p>
                            </div>
                            <div>
                                <label className="label-text">Select CSV File</label>
                                <input 
                                    type="file" 
                                    accept=".csv"
                                    className="input-field w-full" 
                                    onChange={(e) => setFile(e.target.files[0])}
                                    required 
                                />
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1" disabled={!file || isLoading}>
                                    {isLoading ? 'Processing...' : 'Upload & Process'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Ledger;
