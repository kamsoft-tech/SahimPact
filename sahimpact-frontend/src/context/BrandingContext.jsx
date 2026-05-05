import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const BrandingContext = createContext();

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider = ({ children }) => {
    const { role } = useAuth();
    const [branding, setBranding] = useState({
        logo_url: '/logo.png',
        favicon_url: '/favicon.png',
        primary_color: '#2EDEA4',
        secondary_color: '#F59E0B',
        company_name: 'SahimPact'
    });

    const refreshBranding = async () => {
        const token = sessionStorage.getItem('token');
        if (!token) return;

        // Ensure axios has the token (fallback for race conditions)
        if (!axios.defaults.headers.common['Authorization']) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        try {
            const companyId = sessionStorage.getItem('company_id');

            // If we don't have a companyId yet, we can't fetch company-specific branding
            if (!companyId && role !== 'SUPER_ADMIN') return;

            const [settingsRes, companyRes] = await Promise.all([
                axios.get('/api/settings').catch(err => {
                    console.warn("Settings fetch failed, using defaults", err);
                    return { data: {} };
                }),
                (role && role !== 'SUPER_ADMIN' && companyId)
                    ? axios.get(`/api/companies/${companyId}`).catch(err => {
                        console.warn("Company fetch failed", err);
                        return { data: null };
                    })
                    : Promise.resolve({ data: null })
            ]);

            const settings = settingsRes.data;
            const company = companyRes.data;

            const newBranding = {
                logo_url: settings?.logo_url || '/logo.png',
                favicon_url: settings?.favicon_url || '/favicon.png',
                primary_color: settings?.primary_color || '#2EDEA4',
                secondary_color: settings?.secondary_color || '#F59E0B',
                company_name: company?.name || 'Sahim Pact'
            };

            setBranding(newBranding);
            applyBranding(newBranding);
        } catch (error) {
            console.error("Critical failure in branding refresh:", error);
        }
    };

    const applyBranding = (data) => {
        // Apply CSS Variables
        if (data.primary_color) document.documentElement.style.setProperty('--primary-brand', data.primary_color);
        if (data.secondary_color) document.documentElement.style.setProperty('--secondary-brand', data.secondary_color);

        // Apply Favicon
        const faviconUrl = data.favicon_url || data.logo_url;
        if (faviconUrl) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = faviconUrl;
        }
    };

    useEffect(() => {
        // Initial setup - apply default branding early
        applyBranding({
            favicon_url: '/favicon.png',
            primary_color: '#94d4ad',
            secondary_color: '#bfc1ff'
        });
        
        refreshBranding();
        
        // Listen for company switches to re-fetch branding
        const handleSwitch = () => {
            refreshBranding();
        };
        window.addEventListener('company-switched', handleSwitch);
        return () => window.removeEventListener('company-switched', handleSwitch);
    }, [role]);

    return (
        <BrandingContext.Provider value={{ ...branding, refreshBranding }}>
            {children}
        </BrandingContext.Provider>
    );
};

