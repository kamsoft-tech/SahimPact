import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import axios from 'axios';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout, role } = useAuth();
    const username = user?.username || sessionStorage.getItem('username');
    const [pendingCount, setPendingCount] = useState(0);

    const { logo_url, company_name } = useBranding();

    const fetchPendingCount = async () => {
        try {
            const res = await axios.get('/api/ledger/pending/count');
            setPendingCount(res.data.count);
        } catch (error) {
            console.error("Failed to fetch pending count", error);
        }
    };

    useEffect(() => {
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const menuItems = [
        { name: 'The Pulse', icon: 'dashboard', path: '/pulse', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Time Log', icon: 'timer', path: '/timelog', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Ledger', icon: 'account_balance_wallet', path: '/ledger', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Charity Fund', icon: 'volunteer_activism', path: '/charity', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Partnerships', icon: 'handshake', path: '/partnerships', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'System Config', icon: 'settings_suggest', path: '/config', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] md:hidden"
                    onClick={onClose}
                />
            )}

            <nav className={`bg-bg-surface h-screen w-64 border-r border-border-muted flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 font-data ${
                isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}>
                <div className="p-6 border-b border-border-muted flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {logo_url ? (
                            <img src={logo_url} alt="Company Logo" className="w-10 h-10 object-contain rounded-lg" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold shadow-lg shadow-primary/20 transform -rotate-3">
                                {username ? username[0].toUpperCase() : 'S'}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 className="text-xl font-extrabold text-primary tracking-tighter leading-none truncate font-brand" title={company_name}>
                                {company_name}
                            </h1>
                            <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mt-1">Portal v2.0</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="md:hidden text-text-muted hover:text-text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
                    {menuItems.filter(item => {
                        const userRole = (role || '').trim();
                        return item.roles.includes(userRole);
                    }).map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            onClick={() => { if(window.innerWidth < 768) onClose(); }}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                                    isActive 
                                    ? 'bg-primary text-on-primary font-black shadow-lg shadow-primary/20' 
                                    : 'text-text-muted hover:text-text-main hover:bg-bg-base'
                                }`
                            }
                        >
                            <span className={`material-symbols-outlined text-xl ${item.name === 'The Pulse' ? 'fill-current' : ''}`}>{item.icon}</span>
                            <span className="text-sm font-bold flex-1">{item.name}</span>
                            {item.name === 'Ledger' && pendingCount > 0 && (
                                <span className="bg-error text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {pendingCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </div>

                <div className="p-4 border-t border-border-muted bg-bg-base/30">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black truncate text-text-main">{user?.full_name || username}</p>
                            <p className="text-[10px] text-text-muted uppercase tracking-widest truncate">{role}</p>
                        </div>
                    </div>
                    <ul className="space-y-1">
                        <li>
                            <NavLink 
                                to="/account" 
                                onClick={() => { if(window.innerWidth < 768) onClose(); }}
                                className={({ isActive }) => 
                                    `flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all font-bold ${
                                        isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'
                                    }`
                                }
                            >
                                <span className="material-symbols-outlined text-lg">person</span> Account
                            </NavLink>
                        </li>
                        <li>
                            <button 
                                onClick={logout}
                                className="w-full flex items-center gap-3 text-text-muted hover:text-text-danger px-4 py-2 hover:bg-text-danger/10 transition-all duration-200 rounded-lg text-sm font-bold"
                            >
                                <span className="material-symbols-outlined text-lg">logout</span> Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>
        </>
    );
};

export default Sidebar;
