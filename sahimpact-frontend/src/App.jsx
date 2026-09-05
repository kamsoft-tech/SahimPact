import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import ThePulse from './pages/ThePulse';
import Ledger from './pages/Ledger';
import Partnerships from './pages/Partnerships';
import SystemConfig from './pages/SystemConfig';
import SuperDashboard from './pages/SuperDashboard';
import Account from './pages/Account';
import Login from './pages/Login';
import TimeLog from './pages/TimeLog';
import CharityManagement from './pages/CharityManagement';
import MasterDashboard from './pages/MasterDashboard';
import Contracts from './pages/Contracts';
import CompanySelector from './pages/CompanySelector';
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

const HomeRedirect = () => {
    const { role, loading } = useAuth();
    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin relative z-10"></div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">Synchronizing</p>
        </div>
    );
    
    // Normalize role for redirection
    const normalizedRole = role?.trim().toUpperCase();
    
    return <Navigate to="/pulse" replace />;
};

const App = () => {
    return (
        <NotificationProvider>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />

                    {/* Private Routes */}
                    <Route element={
                        <ProtectedRoute>
                            <CompanyGuard>
                                <Layout />
                            </CompanyGuard>
                        </ProtectedRoute>
                    }>
                        <Route path="/" element={<HomeRedirect />} />
                        <Route path="/super-dashboard" element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                                <SuperDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/pulse" element={
                            <ProtectedRoute allowedRoles={['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                                <ThePulse />
                            </ProtectedRoute>
                        } />
                        <Route path="/ledger" element={
                            <ProtectedRoute allowedRoles={['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                                <Ledger />
                            </ProtectedRoute>
                        } />
                        <Route path="/partnerships" element={
                            <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'PARTNER']}>
                                <Partnerships />
                            </ProtectedRoute>
                        } />
                        <Route path="/config" element={
                            <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                                <SystemConfig />
                            </ProtectedRoute>
                        } />
                        <Route path="/timelog" element={<TimeLog />} />
                        <Route path="/charity" element={
                            <ProtectedRoute allowedRoles={['PARTNER', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                                <CharityManagement />
                            </ProtectedRoute>
                        } />
                        <Route path="/master" element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MASTER_ADMIN']}>
                                <MasterDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/contracts" element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COMPANY_ADMIN']}>
                                <Contracts />
                            </ProtectedRoute>
                        } />
                        <Route path="/account" element={<Account />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </Router>
        </NotificationProvider>
    );
};

const CompanyGuard = ({ children }) => {
    const { isAuthenticated, activeCompanyId, companies, loading } = useAuth();
    
    if (loading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    
    // If user belongs to multiple companies and hasn't picked one
    if (companies.length > 1 && !activeCompanyId) {
        return <CompanySelector />;
    }
    
    return children;
};

export default App;
