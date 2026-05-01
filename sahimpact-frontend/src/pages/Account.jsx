import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Account = () => {
    const { user, refreshUser } = useAuth();
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [charityPct, setCharityPct] = useState(0);
    const [status, setStatus] = useState({ loading: false, success: '', error: '' });

    useEffect(() => {
        fetchCharity();
    }, []);

    const fetchCharity = async () => {
        try {
            const res = await axios.get('/api/my-share');
            setCharityPct(res.data.voluntary_charity_percentage * 100);
        } catch (error) {
            console.error("Failed to fetch charity settings");
        }
    };

    const handleUpdateProfile = async () => {
        setStatus({ loading: true, success: '', error: '' });
        try {
            await axios.put('/api/me', { full_name: fullName });
            await refreshUser();
            setStatus({ loading: false, success: 'Profile updated successfully!', error: '' });
        } catch (error) {
            setStatus({ 
                loading: false, 
                success: '', 
                error: error.response?.data?.detail || 'Failed to update profile' 
            });
        }
    };

    const handleUpdateCharity = async () => {
        setStatus({ loading: true, success: '', error: '' });
        try {
            await axios.put('/api/my-share', {
                voluntary_charity_percentage: parseFloat(charityPct) / 100,
                capital_share_fixed: 0, // backend ignored
                labor_share_variable: 0 // backend ignored
            });
            setStatus({ loading: false, success: 'Charity preferences updated!', error: '' });
        } catch (error) {
            setStatus({ loading: false, success: '', error: 'Failed to update charity settings' });
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            setStatus({ loading: false, success: '', error: 'Passwords do not match' });
            return;
        }

        setStatus({ loading: true, success: '', error: '' });
        try {
            await axios.put('/api/me/password', {
                current_password: passwords.current,
                new_password: passwords.new
            });
            setStatus({ loading: false, success: 'Password changed successfully!', error: '' });
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (error) {
            setStatus({ 
                loading: false, 
                success: '', 
                error: error.response?.data?.detail || 'Failed to change password' 
            });
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-slide-in pb-20 p-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">Account Settings</h1>
                <p className="text-on-surface-variant">Manage your profile and security preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <div className="card flex flex-col items-center gap-4 text-center">
                        <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-4xl font-black">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{user?.username}</h2>
                            <p className="text-sm text-on-surface-variant uppercase tracking-widest">{user?.role}</p>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 flex flex-col gap-8">
                    {/* Profile Information */}
                    <div className="card flex flex-col gap-6 shadow-sm border-outline-variant/20">
                        <h3 className="font-bold text-xl flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">person</span>
                            Profile Information
                        </h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Display Name</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input 
                                        type="text" 
                                        className="input-field flex-1"
                                        placeholder="Add your full name"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleUpdateProfile}
                                        disabled={status.loading || fullName === user?.full_name}
                                        className="btn-primary w-full sm:w-auto"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                                <p className="text-[10px] sm:text-xs text-on-surface-variant leading-relaxed">This name will be displayed across the system instead of your username.</p>
                            </div>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="card flex flex-col gap-6">
                        <h3 className="font-bold text-xl flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">security</span>
                            Security
                        </h3>
                        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Current Password</label>
                                <input 
                                    type="password" 
                                    className="input-field"
                                    value={passwords.current}
                                    onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">New Password</label>
                                <input 
                                    type="password" 
                                    className="input-field"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Confirm New Password</label>
                                <input 
                                    type="password" 
                                    className="input-field"
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                    required
                                />
                            </div>

                            {status.error && (
                                <div className="p-3 rounded-lg bg-error/10 text-error text-sm font-medium border border-error/20">
                                    {status.error}
                                </div>
                            )}

                            {status.success && (
                                <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                                    {status.success}
                                </div>
                            )}

                            <button 
                                type="submit" 
                                className="btn-primary mt-2"
                                disabled={status.loading}
                            >
                                {status.loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>

                    {/* Partner Settings */}
                    <div className="card flex flex-col gap-6">
                        <h3 className="font-bold text-xl flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">volunteer_activism</span>
                            Profit Distribution Preferences
                        </h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-on-surface-variant">Voluntary Charity %</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            className="input-field w-full pr-10"
                                            placeholder="e.g. 2.5"
                                            value={charityPct}
                                            onChange={(e) => setCharityPct(e.target.value)}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">%</span>
                                    </div>
                                    <button 
                                        onClick={handleUpdateCharity}
                                        disabled={status.loading}
                                        className="btn-primary w-full sm:w-auto"
                                    >
                                        Update Preferences
                                    </button>
                                </div>
                                <p className="text-[10px] sm:text-xs text-on-surface-variant leading-relaxed">This percentage will be deducted from your net profit share and donated to the company charity pool.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;
