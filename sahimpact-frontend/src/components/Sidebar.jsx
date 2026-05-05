import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import axios from 'axios';
import { 
    LayoutDashboard, 
    Timer, 
    Wallet, 
    Heart, 
    Handshake, 
    Settings, 
    User, 
    LogOut, 
    X,
    ShieldCheck,
    ChevronRight,
    Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout, role, companies, activeCompanyId, switchCompany } = useAuth();
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
        { name: 'The Pulse', icon: Activity, path: '/pulse', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Time Log', icon: Timer, path: '/timelog', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Ledger', icon: Wallet, path: '/ledger', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Charity Fund', icon: Heart, path: '/charity', roles: ['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'Partnerships', icon: Handshake, path: '/partnerships', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
        { name: 'System Nexus', icon: Settings, path: '/config', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
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

            <nav className={cn(
                "fixed left-0 top-0 z-50 h-screen w-64 bg-bg-surface border-r border-border-muted/30 flex flex-col transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                {/* Brand Header */}
                <div className="p-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {logo_url ? (
                            <img src={logo_url} alt="Logo" className="w-10 h-10 object-contain drop-shadow-lg" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-black shadow-lg shadow-primary/30 transform rotate-3">
                                {username ? username[0].toUpperCase() : 'S'}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-text-main font-brand uppercase tracking-tighter leading-none" title={company_name}>
                                {company_name}
                            </h1>
                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1.5 opacity-80">SahimPact v2</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="md:hidden text-text-muted hover:text-text-main">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Company Switcher (Multi-company support) */}
                {companies.length > 1 && (
                    <div className="px-6 pb-4">
                        <Select value={activeCompanyId?.toString()} onValueChange={(val) => switchCompany(parseInt(val))}>
                            <SelectTrigger className="w-full bg-bg-base/30 border-border-muted/10 h-10 text-[10px] font-black uppercase tracking-widest focus:ring-primary/20">
                                <div className="flex items-center gap-2 truncate">
                                    <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <SelectValue placeholder="Switch Company" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-bg-surface border-border-muted/20">
                                {companies.map((company) => (
                                    <SelectItem 
                                        key={company.id} 
                                        value={company.id.toString()}
                                        className="text-[10px] font-black uppercase tracking-widest focus:bg-primary focus:text-on-primary"
                                    >
                                        {company.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Navigation Links */}
                <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                    {menuItems.filter(item => {
                        const userRole = (role || '').trim().toUpperCase();
                        return item.roles.includes(userRole);
                    }).map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={() => { if(window.innerWidth < 768) onClose(); }}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                    isActive 
                                        ? "bg-primary text-on-primary font-black shadow-lg shadow-primary/20" 
                                        : "text-text-muted hover:text-text-main hover:bg-bg-base/50"
                                )}
                            >
                                <Icon className={cn(
                                    "w-5 h-5 transition-transform duration-300",
                                    "group-hover:scale-110"
                                )} />
                                <span className="text-xs font-black uppercase tracking-widest flex-1">{item.name}</span>
                                {item.name === 'Ledger' && pendingCount > 0 && (
                                    <Badge className="bg-destructive text-destructive-foreground font-black text-[9px] h-4 min-w-[18px] flex items-center justify-center px-1 border-none">
                                        {pendingCount}
                                    </Badge>
                                )}
                                <ChevronRight className={cn(
                                    "w-3 h-3 opacity-0 -translate-x-2 transition-all duration-300",
                                    "group-hover:opacity-40 group-hover:translate-x-0"
                                )} />
                            </NavLink>
                        );
                    })}
                </div>

                {/* User Profile Footer */}
                <div className="p-4 border-t border-border-muted/10 bg-bg-base/20">
                    <div className="px-4 py-4 mb-4 bg-bg-surface/50 rounded-2xl border border-border-muted/10 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs border border-primary/20">
                                {username ? username[0].toUpperCase() : 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-text-main truncate uppercase tracking-tight">{user?.full_name || username}</p>
                                <p className="text-[9px] font-black text-text-muted/60 uppercase tracking-widest truncate mt-0.5">{role}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <NavLink 
                            to="/account" 
                            onClick={() => { if(window.innerWidth < 768) onClose(); }}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                isActive ? "text-primary bg-primary/5" : "text-text-muted hover:text-text-main hover:bg-bg-base/50"
                            )}
                        >
                            <User className="w-4 h-4" /> Account Settings
                        </NavLink>
                        <button 
                            onClick={logout}
                            className="w-full flex items-center gap-3 text-text-muted/60 hover:text-destructive px-4 py-3 hover:bg-destructive/5 transition-all duration-300 rounded-xl text-xs font-black uppercase tracking-widest"
                        >
                            <LogOut className="w-4 h-4" /> Terminate Session
                        </button>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-[8px] font-black text-text-muted/30 uppercase tracking-[0.3em]">
                        <ShieldCheck className="w-3 h-3" /> NIST-PACT Protocol
                    </div>
                </div>
            </nav>
        </>
    );
};

export default Sidebar;
