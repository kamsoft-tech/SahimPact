import React, { createContext, useContext, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = useCallback((message, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications((prev) => [...prev, { id, message, type }]);
        
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
                {notifications.map((n) => (
                    <Toast key={n.id} message={n.message} type={n.type} onClose={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

const Toast = ({ message, type, onClose }) => {
    const styles = {
        success: 'bg-[#10B981] text-white border-[#059669]',
        error: 'bg-error text-on-error border-error-container',
        info: 'bg-secondary text-on-secondary border-secondary-container',
        warning: 'bg-tertiary text-on-tertiary border-tertiary-container'
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };

    return (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl animate-slide-in ${styles[type] || styles.info}`}>
            <span className="material-symbols-outlined text-xl">{icons[type] || icons.info}</span>
            <p className="font-medium text-sm">{message}</p>
            <Button variant="ghost" size="icon" onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 transition-opacity w-6 h-6 p-0 hover:bg-transparent">
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
};
