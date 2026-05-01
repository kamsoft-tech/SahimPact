import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SuperDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        total_companies: 0,
        total_users: 0,
        total_transactions: 0,
        active_partners: 0,
        orphaned_partners: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/api/admin/stats');
                const orphansRes = await axios.get('/api/companies/orphaned-partners');
                setStats({
                    ...res.data,
                    orphaned_partners: orphansRes.data.length
                });
            } catch (error) {
                console.error("Failed to fetch system stats", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const cards = [
        { title: 'Total Companies', value: stats.total_companies, icon: 'corporate_fare', color: 'primary' },
        { title: 'Total Users', value: stats.total_users, icon: 'group', color: 'secondary' },
        { title: 'Orphaned Partners', value: stats.orphaned_partners, icon: 'person_off', color: 'error' },
        { title: 'Active Partners', value: stats.active_partners, icon: 'handshake', color: 'secondary' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 animate-slide-in pb-20 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">System Overview</h1>
                <p className="text-on-surface-variant">Global health metrics across all registered companies.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, index) => (
                    <div key={index} className="card group hover:scale-[1.02] transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl bg-${card.color}/10 text-${card.color} group-hover:bg-${card.color} group-hover:text-on-${card.color} transition-colors duration-300`}>
                                <span className="material-symbols-outlined">{card.icon}</span>
                            </div>
                        </div>
                        <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">{card.title}</h3>
                        <p className="text-4xl font-black">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 card flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl">Quick Management</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button 
                            onClick={() => navigate('/config?tab=companies')}
                            className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high transition-all text-left w-full"
                        >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <span className="material-symbols-outlined">add_business</span>
                            </div>
                            <div>
                                <p className="font-bold">Add New Company</p>
                                <p className="text-xs text-on-surface-variant">Onboard a new enterprise partner.</p>
                            </div>
                        </button>
                        <button 
                            onClick={() => navigate('/config?tab=orphans')}
                            className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high transition-all text-left w-full"
                        >
                            <div className="w-10 h-10 rounded-lg bg-error/10 text-error flex items-center justify-center">
                                <span className="material-symbols-outlined">person_off</span>
                            </div>
                            <div>
                                <p className="font-bold">Manage Orphaned Partners</p>
                                <p className="text-xs text-on-surface-variant">Link unassigned partners to companies.</p>
                            </div>
                        </button>
                        <button 
                            onClick={() => navigate('/config?tab=companies')}
                            className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high transition-all text-left w-full"
                        >
                            <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                                <span className="material-symbols-outlined">person_add</span>
                            </div>
                            <div>
                                <p className="font-bold">Manage Company Admins</p>
                                <p className="text-xs text-on-surface-variant">Reset passwords and manage access.</p>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="card flex flex-col gap-6">
                    <h3 className="font-bold text-xl">System Status</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                <span className="text-sm font-medium">API Server</span>
                            </div>
                            <span className="text-xs font-bold text-primary">OPERATIONAL</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                <span className="text-sm font-medium">Database</span>
                            </div>
                            <span className="text-xs font-bold text-primary">OPERATIONAL</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperDashboard;
