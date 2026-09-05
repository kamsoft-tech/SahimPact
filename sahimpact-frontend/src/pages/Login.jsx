import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
    User, 
    Lock, 
    Handshake, 
    Loader2, 
    ArrowRight,
    ShieldCheck,
    Building2,
    CheckCircle2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
});

const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [pendingCompanies, setPendingCompanies] = useState([]);
    const { login, switchCompany } = useAuth();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const { logo_url, company_name } = useBranding();

    const form = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: '', password: '' },
    });

    const onSubmit = async (data) => {
        setIsLoading(true);
        try {
            const authData = await login(data.username, data.password);
            
            if (authData.companies && authData.companies.length > 1) {
                setPendingCompanies(authData.companies);
                showNotification("Authentication successful. Please select a company context.", "success");
            } else {
                showNotification(`Welcome back to SahimPact, ${data.username}!`, "success");
                navigate('/');
            }
        } catch (error) {
            showNotification(error.response?.data?.detail || "Login failed", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectCompany = (companyId) => {
        switchCompany(companyId);
        showNotification("Company context established. Redirecting...", "success");
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-[#05080D] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px] animate-pulse delay-700"></div>
            
            <Card className="w-full max-w-lg relative z-10 border-border-muted/30 shadow-2xl bg-bg-surface/80 backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700">
                <CardHeader className="pt-8 sm:pt-12 pb-6 sm:pb-8 text-center space-y-4 px-4 sm:px-12">
                    <div className="flex justify-center">
                        {logo_url ? (
                            <img src={logo_url} alt="Logo" className="w-20 h-20 object-contain drop-shadow-2xl" />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-on-primary shadow-xl shadow-primary/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                <Handshake className="w-10 h-10" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl sm:text-3xl font-black text-text-main font-brand uppercase leading-tight">
                            Equity Earned. <span className="text-primary text-xl sm:text-2xl block sm:inline mt-1 sm:mt-0">Trust Sealed.</span>
                        </CardTitle>
                        <CardDescription className="text-text-muted text-sm max-w-sm mx-auto leading-relaxed font-medium">
                            The definitive administrative ledger for modern co-founders. Seamlessly blend capital and sweat equity.
                        </CardDescription>
                    </div>
                </CardHeader>
                
                <CardContent className="px-6 sm:px-10 pb-8 sm:pb-12">
                    {pendingCompanies.length > 0 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-primary" />
                                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Active Enterprise</div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {pendingCompanies.map(company => (
                                    <Button
                                        key={company.id}
                                        variant="outline"
                                        onClick={() => handleSelectCompany(company.id)}
                                        className="w-full h-auto group flex items-center justify-between p-4 bg-bg-base border-border-muted/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-bg-surface flex items-center justify-center border border-border-muted/20 group-hover:bg-primary/10 transition-colors">
                                                <Building2 className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-text-main uppercase tracking-tight">{company.name}</div>
                                                <div className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest mt-0.5">Enterprise Node</div>
                                            </div>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Button>
                                ))}
                            </div>
                            <Button 
                                variant="ghost" 
                                onClick={() => setPendingCompanies([])}
                                className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/40 hover:text-text-muted"
                            >
                                Back to Authentication
                            </Button>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">System Username</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
                                                    <Input {...field} className="bg-bg-base border-border-muted pl-11 h-12 font-bold" placeholder="Enter your ID" />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center justify-between">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Security Key</FormLabel>
                                                <Button variant="ghost" type="button" className="text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary h-auto p-0">Forgot Password?</Button>
                                            </div>
                                            <FormControl>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
                                                    <Input type="password" {...field} className="bg-bg-base border-border-muted pl-11 h-12 font-bold" placeholder="••••••••" />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <Button 
                                    type="submit" 
                                    className="w-full h-14 bg-primary hover:bg-primary/90 text-on-primary font-black uppercase tracking-widest text-base shadow-lg shadow-primary/20 rounded-xl group"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Authenticate <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
                
                <CardFooter className="bg-bg-base/30 border-t border-border-muted/10 p-6 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-text-muted/50 uppercase tracking-[0.2em]">
                        <ShieldCheck className="w-3 h-3" /> NIST Compliant Protocol
                    </div>
                    <p className="text-[9px] font-black text-text-muted/30 uppercase tracking-[0.3em]">
                        {company_name} • System v2.0.0-PACT
                    </p>
                    <div className="pt-2 opacity-20 hover:opacity-50 transition-opacity">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white">Encrypted Session</span>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Login;
