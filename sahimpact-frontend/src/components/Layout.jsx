import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Outlet, useLocation } from 'react-router-dom';

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
        '/account': 'My Account'
    };

    return (
        <div className="flex min-h-screen bg-background relative">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300">
                <Header 
                    title={titles[location.pathname] || 'SahimPact'} 
                    onMenuToggle={() => setSidebarOpen(!isSidebarOpen)}
                />
                <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                    <div className="max-w-6xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;

