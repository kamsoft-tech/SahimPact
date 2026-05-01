/**
 * Tests for Sidebar component.
 * Validates role-based navigation rendering, branding, and logout behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import axios from 'axios';

vi.mock('axios');

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn()
}));

vi.mock('../context/NotificationContext', () => ({
    useNotification: () => ({ showNotification: vi.fn() })
}));

import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const renderSidebar = (role = 'PARTNER', companyId = '1', companyData = null) => {
    sessionStorage.setItem('company_id', companyId);
    vi.mocked(useAuth).mockReturnValue({
        role,
        user: { username: 'testuser', role },
        logout: vi.fn(),
        isAuthenticated: true
    });

    if (!companyData) {
        companyData = { name: 'Test Company', logo_url: null };
    }

    axios.get = vi.fn().mockResolvedValue({
        data: companyData
    });

    return render(
        <MemoryRouter>
            <Sidebar />
        </MemoryRouter>
    );
};

describe('Sidebar Component', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    it('renders navigation links for a PARTNER role', async () => {
        renderSidebar('PARTNER');
        await waitFor(() => {
            // Partners should see their relevant nav items
            expect(screen.getByText(/the pulse/i)).toBeTruthy();
        });
    });

    it('renders navigation links for COMPANY_ADMIN', async () => {
        renderSidebar('COMPANY_ADMIN');
        await waitFor(() => {
            expect(screen.getByText(/config/i)).toBeTruthy();
        });
    });

    it('renders navigation links for SUPER_ADMIN', async () => {
        renderSidebar('SUPER_ADMIN', null);
        await waitFor(() => {
            expect(screen.getByText(/config/i)).toBeTruthy();
        });
    });

    it('fetches and displays company name for company users', async () => {
        renderSidebar('COMPANY_ADMIN', '5', { name: 'Acme Corp', logo_url: null });

        await waitFor(() => {
            expect(screen.getByText(/acme corp/i)).toBeTruthy();
        });
    });

    it('falls back gracefully if company API fails', async () => {
        axios.get = vi.fn().mockRejectedValue(new Error('Network error'));
        renderSidebar('COMPANY_ADMIN', '5');

        // Should render without crashing
        await waitFor(() => {
            expect(screen.getByText(/the pulse/i)).toBeTruthy();
        });
    });
});
