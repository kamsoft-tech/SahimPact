import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const { logo_url, company_name } = useBranding();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(username, password);
            showNotification(`Welcome back to SahimPact, ${username}!`, "success");
            navigate('/');
        } catch (error) {
            showNotification(error.response?.data?.detail || "Login failed", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-base flex items-center justify-center p-6 relative overflow-hidden font-data">
            {/* Premium background decorative elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px]"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary/5 rounded-full blur-[150px]"></div>

            <div className="card w-full max-w-lg p-12 relative z-10 border-border-muted shadow-2xl backdrop-blur-xl bg-bg-surface/90">
                <div className="flex flex-col items-center gap-2 mb-12 text-center">
                    {logo_url ? (
                        <img src={logo_url} alt="Logo" className="w-24 h-24 object-contain mb-6 drop-shadow-2xl" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-on-primary shadow-2xl shadow-primary/30 transform rotate-3 mb-4">
                            <span className="material-symbols-outlined text-5xl">handshake</span>
                        </div>
                    )}
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main font-brand mb-2">Equity earned. Trust sealed.</h1>
                    <p className="text-text-muted text-sm max-w-sm leading-relaxed">
                        SahimPact is the definitive ledger for modern co-founders. Seamlessly blend capital and sweat equity, automate your charity, and lock your agreements into a single, indisputable pact.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-8">
                    <div className="space-y-1">
                        <label className="label-text">Username</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-xl group-focus-within:text-primary transition-colors">person</span>
                            <input 
                                type="text" 
                                className="input-field w-full pl-12" 
                                placeholder="Enter username" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required 
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="label-text">Password</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-xl group-focus-within:text-primary transition-colors">lock</span>
                            <input 
                                type="password" 
                                className="input-field w-full pl-12" 
                                placeholder="••••••••" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="btn-primary w-full py-4 mt-4 text-lg font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? 'Authenticating...' : 'Sign In'}
                    </button>
                    
                    <div className="flex items-center justify-between mt-6">
                        <button type="button" className="text-xs font-bold text-text-muted hover:text-primary transition-colors uppercase tracking-widest">Forgot Password?</button>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{company_name} v2.0.0-pact</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
