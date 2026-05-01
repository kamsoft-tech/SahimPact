import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';

const Header = ({ title, onMenuToggle }) => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingTxs, setPendingTxs] = useState([]);
    const [showPopover, setShowPopover] = useState(false);
    const popoverRef = useRef(null);

    const [pendingAgreement, setPendingAgreement] = useState(null);

    const fetchPending = async () => {
        try {
            const [countRes, listRes, agreementRes] = await Promise.all([
                axios.get('/api/ledger/pending/count'),
                axios.get('/api/ledger/pending'),
                axios.get('/api/agreements/pending')
            ]);
            setPendingCount(countRes.data.count);
            setPendingTxs(listRes.data);
            setPendingAgreement(agreementRes.data);
        } catch (error) {
            console.error("Failed to fetch pending notifications", error);
        }
    };

    useEffect(() => {
        fetchPending();
        const interval = setInterval(fetchPending, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setShowPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = async (id, action) => {
        try {
            if (action === 'approve') {
                await axios.put(`/api/ledger/${id}/approve`);
                showNotification("Transaction approved", "success");
            } else {
                await axios.delete(`/api/ledger/${id}/reject`);
                showNotification("Transaction rejected", "info");
            }
            fetchPending();
            // Also trigger a refresh in Ledger page if it's open - we can use custom events or context for this
            window.dispatchEvent(new CustomEvent('ledgerUpdate'));
        } catch (error) {
            showNotification("Action failed", "error");
        }
    };

    return (
        <header className="bg-bg-surface/90 backdrop-blur-md h-16 border-b border-border-muted sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 transition-all font-data">
            <div className="flex items-center gap-3">
                <button 
                    onClick={onMenuToggle}
                    className="p-2 rounded-lg hover:bg-bg-base text-text-muted md:hidden transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h2 className="text-base md:text-lg font-bold text-text-main font-brand truncate">{title}</h2>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
                <div className="relative" ref={popoverRef}>
                    <button 
                        onClick={() => setShowPopover(!showPopover)}
                        className={`p-2 rounded-md transition-colors relative ${showPopover ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}
                    >
                        <span className="material-symbols-outlined text-xl">notifications</span>
                        {(pendingCount > 0 || pendingAgreement) && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-error text-[10px] font-bold text-white flex items-center justify-center rounded-full border-2 border-bg-surface animate-pulse">
                                {pendingCount + (pendingAgreement ? 1 : 0)}
                            </span>
                        )}
                    </button>

                    {showPopover && (
                        <div className="absolute right-0 mt-2 w-72 md:w-80 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-in">
                            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                                <h3 className="text-sm font-bold">Pending Actions</h3>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">
                                    {pendingCount + (pendingAgreement ? 1 : 0)} Items
                                </span>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {pendingAgreement && (
                                    <div className="p-4 bg-primary/10 border-b border-primary/20">
                                        <div className="flex gap-3 items-start mb-3">
                                            <div className="p-2 rounded-lg bg-primary/20 text-primary">
                                                <span className="material-symbols-outlined text-xl">contract</span>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-primary mb-0.5">Agreement Required</h4>
                                                <p className="text-[10px] text-primary/80 leading-relaxed font-medium">A new Partnership Agreement proposal requires your signature.</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setShowPopover(false);
                                                window.location.href = '/partnerships?agreement=true';
                                            }}
                                            className="w-full py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            Review & Sign
                                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </button>
                                    </div>
                                )}

                                {pendingTxs.length === 0 && !pendingAgreement ? (
                                    <div className="p-8 text-center text-on-surface-variant text-xs">
                                        <span className="material-symbols-outlined text-4xl opacity-20 mb-2">check_circle</span>
                                        <p>All clear!</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-outline-variant/30">
                                        {pendingTxs.map(tx => (
                                            <div key={tx.id} className="p-3 hover:bg-surface-container-low transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-bold text-on-surface-variant">{tx.date}</span>
                                                    <span className={`text-[10px] font-black ${tx.type === 'sales' ? 'text-primary' : 'text-error'}`}>
                                                        £{tx.amount.toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-medium line-clamp-2 mb-3">{tx.description}</p>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleAction(tx.id, 'approve')}
                                                        className="flex-1 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-bold transition-all"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAction(tx.id, 'reject')}
                                                        className="flex-1 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error hover:text-on-error text-[10px] font-bold transition-all"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 pl-2 border-l border-border-muted">
                    <span className="text-xs md:text-sm font-medium text-text-main hidden sm:block">
                        {user?.full_name || user?.username || localStorage.getItem('username')}
                    </span>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-border-muted bg-bg-base flex items-center justify-center">
                        <span className="material-symbols-outlined text-text-muted text-lg">person</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
