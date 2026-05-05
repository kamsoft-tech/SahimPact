import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { isAuthenticated, role, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#05080D] flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                </div>
                <div className="flex flex-col items-center gap-1 animate-pulse">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Authenticating</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/40">Secure Session Initialization</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.some(r => r.trim().toUpperCase() === role?.trim().toUpperCase())) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
