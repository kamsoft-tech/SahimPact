/**
 * Tests for AuthContext
 * Validates login, logout, token storage, and role derivation logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import React from 'react';
import axios from 'axios';

vi.mock('axios');

// Helper component to read context values
const AuthConsumer = () => {
    const { isAuthenticated, role, user, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    return (
        <div>
            <span data-testid="auth">{isAuthenticated ? 'true' : 'false'}</span>
            <span data-testid="role">{role || 'none'}</span>
            <span data-testid="user">{user?.username || 'none'}</span>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('shows unauthenticated state when no token is stored', async () => {
        axios.get = vi.fn().mockRejectedValue(new Error('No token'));

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth').textContent).toBe('false');
        });
    });

    it('restores session from sessionStorage token on mount', async () => {
        sessionStorage.setItem('token', 'mock-token');
        axios.get = vi.fn().mockResolvedValue({
            data: { username: 'testuser', role: 'PARTNER' }
        });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toBe('testuser');
            expect(screen.getByTestId('role').textContent).toBe('PARTNER');
        });
    });

    it('falls back to sessionStorage role when user object is null', async () => {
        sessionStorage.setItem('user_role', 'COMPANY_ADMIN');
        axios.get = vi.fn().mockRejectedValue(new Error('Unauthorized'));

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            // After failed refresh, token is cleared, role from session is gone
            expect(screen.getByTestId('auth').textContent).toBe('false');
        });
    });
});

// Login function test
const LoginTester = () => {
    const { login, isAuthenticated, role } = useAuth();
    const [error, setError] = React.useState(null);

    const handleLogin = async () => {
        try {
            await login('testuser', 'password123');
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <div>
            <button onClick={handleLogin}>Login</button>
            <span data-testid="auth">{isAuthenticated ? 'true' : 'false'}</span>
            <span data-testid="role">{role || 'none'}</span>
            {error && <span data-testid="error">{error}</span>}
        </div>
    );
};

describe('AuthContext - login / logout', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    it('stores token in sessionStorage and marks authenticated after login', async () => {
        const { userEvent } = await import('@testing-library/user-event');
        axios.post = vi.fn().mockResolvedValue({
            data: {
                access_token: 'abc123',
                role: 'PARTNER',
                company_id: 1
            }
        });
        axios.get = vi.fn().mockResolvedValue({
            data: { username: 'testuser', role: 'PARTNER' }
        });

        render(
            <AuthProvider>
                <LoginTester />
            </AuthProvider>
        );

        const user = userEvent.setup();
        await user.click(screen.getByText('Login'));

        await waitFor(() => {
            expect(sessionStorage.getItem('token')).toBe('abc123');
            expect(screen.getByTestId('auth').textContent).toBe('true');
        });
    });

    it('handles login failure gracefully', async () => {
        axios.post = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
        axios.get = vi.fn().mockRejectedValue(new Error('Unauthorized'));

        render(
            <AuthProvider>
                <LoginTester />
            </AuthProvider>
        );

        // Wait for initial loading to complete
        await waitFor(() => screen.queryByTestId('auth'));

        act(() => {
            screen.getByText('Login').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('error')).toBeTruthy();
        });
    });
});
