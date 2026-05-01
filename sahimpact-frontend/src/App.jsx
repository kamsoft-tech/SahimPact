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
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

const HomeRedirect = () => {
    const { role, loading } = useAuth();
    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
                            <Layout />
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
                            <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
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
                        <Route path="/account" element={<Account />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </Router>
        </NotificationProvider>
    );
};

export default App;
