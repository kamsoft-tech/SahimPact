import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";

const Layout = () => {
    const location = useLocation();
    const [isSidebarOpen, setSidebarOpen] = React.useState(false);
    
    // Close sidebar on route change (mobile)
    React.useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Map paths to titles
    const titles = {
        '/': 'Dashboard',
        '/pulse': 'The Pulse',
        '/super-dashboard': 'System Overview',
        '/partnerships': 'Partnerships',
        '/ledger': 'Ledger & Transactions',
        '/timelog': 'Time Log',
        '/charity': 'Charity Fund',
        '/config': 'System Configuration',
        '/master': 'Master Fund Dashboard',
        '/contracts': 'Contract Library',
        '/account': 'My Account'
    };

    return (
        <div className="flex min-h-screen bg-[#05080D] relative font-brand selection:bg-primary/30 selection:text-primary-foreground">
            {/* Global Ambient Glow */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[120px]"></div>
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className={cn(
                "flex-1 flex flex-col min-h-screen transition-all duration-500 ease-in-out relative z-10",
                "md:ml-64"
            )}>
                <Header 
                    title={titles[location.pathname] || 'SahimPact'} 
                    onMenuToggle={() => setSidebarOpen(!isSidebarOpen)}
                />
                
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Outlet />
                    </div>
                </main>

                {/* Subtle page footer */}
                <footer className="p-6 md:p-8 border-t border-border-muted/5 bg-bg-surface/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/30">
                    <p className="text-center md:text-left">© 2026 SAHIMPACT PROTOCOL • ALL RIGHTS RESERVED</p>
                    <p className="flex items-center gap-6">
                        <span className="hover:text-primary transition-colors cursor-pointer">Security Audit</span>
                        <span className="hover:text-primary transition-colors cursor-pointer">API Status</span>
                    </p>
                </footer>
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] md:hidden animate-in fade-in duration-300" 
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
};

export default Layout;
