/**
 * Tests for Login page component.
 * Validates form rendering, submission, error display, and redirect logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock dependencies before imports
vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn()
}));

const showNotificationMock = vi.fn();
vi.mock('../context/NotificationContext', () => ({
    useNotification: () => ({ showNotification: showNotificationMock })
}));

vi.mock('../context/BrandingContext', () => ({
    useBranding: () => ({ logo_url: null, company_name: 'SahimPact' })
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn()
    };
});

import { useAuth } from '../context/AuthContext';
import Login from '../pages/Login';

const renderLogin = (loginMock = vi.fn()) => {
    vi.mocked(useAuth).mockReturnValue({ login: loginMock, isAuthenticated: false });
    return render(
        <MemoryRouter>
            <Login />
        </MemoryRouter>
    );
};

describe('Login Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders username and password inputs', () => {
        renderLogin();
        expect(screen.getByPlaceholderText(/enter your id/i)).toBeTruthy();
        expect(screen.getByPlaceholderText(/••••••••/)).toBeTruthy();
    });

    it('renders a login button', () => {
        renderLogin();
        const btn = screen.getByRole('button', { name: /authenticate/i });
        expect(btn).toBeTruthy();
    });

    it('calls login with entered credentials on submit', async () => {
        const loginMock = vi.fn().mockResolvedValue({ role: 'PARTNER', company_id: 1 });
        renderLogin(loginMock);

        fireEvent.change(screen.getByPlaceholderText(/enter your id/i), {
            target: { value: 'testuser' }
        });
        fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
            target: { value: 'password123' }
        });

        fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

        await waitFor(() => {
            expect(loginMock).toHaveBeenCalledWith('testuser', 'password123');
        });
    });

    it('shows an error when login fails', async () => {
        const loginMock = vi.fn().mockRejectedValue({
            response: { data: { detail: 'Incorrect username or password' } }
        });
        renderLogin(loginMock);

        fireEvent.change(screen.getByPlaceholderText(/enter your id/i), {
            target: { value: 'wronguser' }
        });
        fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
            target: { value: 'wrongpass' }
        });
        fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

        await waitFor(() => {
            expect(showNotificationMock).toHaveBeenCalledWith(
                'Incorrect username or password',
                'error'
            );
        });
    });

    it('disables the button while logging in', async () => {
        const loginMock = vi.fn(() => new Promise(() => {}));
        renderLogin(loginMock);

        fireEvent.change(screen.getByPlaceholderText(/enter your id/i), {
            target: { value: 'user' }
        });
        fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
            target: { value: 'password123' }
        });
        
        // Find by role 'button' and type 'submit'
        const btn = screen.getByRole('button', { name: /authenticate/i });
        fireEvent.click(btn);

        await waitFor(() => {
            // After click, it should be loading, so look for the button with the loader (no text)
            // Or just check if the button is disabled
            const buttons = screen.getAllByRole('button');
            const submitBtn = buttons.find(b => b.getAttribute('type') === 'submit');
            expect(submitBtn.disabled).toBe(true);
        });
    });
});
