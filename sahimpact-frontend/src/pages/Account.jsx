import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
    User, 
    ShieldCheck, 
    Heart, 
    LogOut, 
    Check, 
    Loader2, 
    Fingerprint,
    Save,
    KeyRound
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
    full_name: z.string().min(2, "Full name is required"),
});

const passwordSchema = z.object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string().min(8, "Confirmation must be at least 8 characters"),
}).refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
});

const charitySchema = z.object({
    voluntary_charity_percentage: z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100"),
});

const Account = () => {
    const { user, refreshUser } = useAuth();
    const { showNotification } = useNotification();
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [isUpdatingCharity, setIsUpdatingCharity] = useState(false);

    const profileForm = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: { full_name: user?.full_name || '' },
    });

    const passwordForm = useForm({
        resolver: zodResolver(passwordSchema),
        defaultValues: { current_password: '', new_password: '', confirm_password: '' },
    });

    const charityForm = useForm({
        resolver: zodResolver(charitySchema),
        defaultValues: { voluntary_charity_percentage: 0 },
    });

    useEffect(() => {
        fetchCharity();
    }, []);

    const fetchCharity = async () => {
        try {
            const res = await axios.get('/api/my-share');
            charityForm.setValue('voluntary_charity_percentage', res.data.voluntary_charity_percentage * 100);
        } catch (error) {
            console.error("Failed to fetch charity settings");
        }
    };

    const onUpdateProfile = async (data) => {
        setIsUpdatingProfile(true);
        try {
            await axios.put('/api/me', data);
            await refreshUser();
            showNotification("Profile updated successfully!", "success");
        } catch (error) {
            showNotification(error.response?.data?.detail || "Update failed", "error");
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const onUpdatePassword = async (data) => {
        setIsUpdatingPassword(true);
        try {
            await axios.put('/api/me/password', {
                current_password: data.current_password,
                new_password: data.new_password
            });
            showNotification("Password changed successfully!", "success");
            passwordForm.reset();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Password change failed", "error");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const onUpdateCharity = async (data) => {
        setIsUpdatingCharity(true);
        try {
            await axios.put('/api/my-share', {
                voluntary_charity_percentage: data.voluntary_charity_percentage / 100,
                capital_share_fixed: 0,
                labor_share_variable: 0
            });
            showNotification("Charity preferences updated!", "success");
        } catch (error) {
            showNotification("Failed to update preferences", "error");
        } finally {
            setIsUpdatingCharity(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="border-b border-border-muted/30 pb-8">
                <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">Account Settings</h1>
                <p className="text-text-muted mt-2 font-medium">Configure your personal profile, security, and distribution preferences.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Profile Snapshot */}
                <div className="lg:col-span-4">
                    <Card className="bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm">
                        <div className="h-24 bg-gradient-to-br from-primary/20 to-secondary/20 border-b border-border-muted/10"></div>
                        <CardContent className="pt-0 flex flex-col items-center -mt-12">
                            <div className="w-24 h-24 rounded-3xl bg-bg-surface border-4 border-bg-surface shadow-xl flex items-center justify-center relative group">
                                <div className="w-full h-full rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl font-black uppercase">
                                    {user?.username?.charAt(0)}
                                </div>
                                <div className="absolute inset-0 bg-primary/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <User className="w-6 h-6 text-primary" />
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <h2 className="text-2xl font-black text-text-main font-brand">{user?.full_name || user?.username}</h2>
                                <p className="text-text-muted font-bold flex items-center justify-center gap-1 mt-1 text-sm">
                                    <Fingerprint className="w-3.5 h-3.5" /> @{user?.username}
                                </p>
                            </div>
                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[9px] px-3 h-7 rounded-lg">
                                    {user?.role?.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline" className="text-text-muted border-border-muted font-black uppercase tracking-widest text-[9px] px-3 h-7 rounded-lg">
                                    Verified
                                </Badge>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-bg-base/30 border-t border-border-muted/10 p-4">
                            <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl">
                                <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="mt-6 bg-secondary/[0.03] border-secondary/20 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Pro Tip</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-text-muted font-medium leading-relaxed">
                                Your display name is used in all formal partnership agreements and period close proposals. Use your legal name for compliance.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Settings Areas */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Personal Information */}
                    <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Profile Details</CardTitle>
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Manage how you appear to other partners</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <Form {...profileForm}>
                                <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-6">
                                    <FormField
                                        control={profileForm.control}
                                        name="full_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Legal Full Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} className="bg-bg-base border-border-muted font-bold h-12" placeholder="e.g. John Alexander Smith" />
                                                </FormControl>
                                                <FormDescription className="text-[10px] font-medium text-text-muted">This name will be used on all generated legal documents.</FormDescription>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex justify-end">
                                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl px-8 h-12 shadow-lg shadow-primary/20" disabled={isUpdatingProfile}>
                                            {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    {/* Security & Access */}
                    <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Security</CardTitle>
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Keep your account and partnership safe</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={passwordForm.control}
                                            name="current_password"
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-2">
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Current Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} className="bg-bg-base border-border-muted font-bold h-12" />
                                                    </FormControl>
                                                    <FormMessage className="text-[10px] font-bold" />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={passwordForm.control}
                                            name="new_password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">New Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} className="bg-bg-base border-border-muted font-bold h-12" />
                                                    </FormControl>
                                                    <FormMessage className="text-[10px] font-bold" />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={passwordForm.control}
                                            name="confirm_password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Confirm Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} className="bg-bg-base border-border-muted font-bold h-12" />
                                                    </FormControl>
                                                    <FormMessage className="text-[10px] font-bold" />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl px-8 h-12 shadow-lg shadow-primary/20" disabled={isUpdatingPassword}>
                                            {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                                            Update Password
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    {/* Impact Preferences */}
                    <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                                    <Heart className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Impact Settings</CardTitle>
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Configure your voluntary charity contributions</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <Form {...charityForm}>
                                <form onSubmit={charityForm.handleSubmit(onUpdateCharity)} className="space-y-6">
                                    <FormField
                                        control={charityForm.control}
                                        name="voluntary_charity_percentage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Voluntary Charity Contribution (%)</FormLabel>
                                                <div className="flex gap-4">
                                                    <FormControl className="flex-1">
                                                        <div className="relative">
                                                            <Input type="number" step="0.1" {...field} className="bg-bg-base border-border-muted font-black text-xl h-14 font-tabular pr-12" />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-text-muted">%</span>
                                                        </div>
                                                    </FormControl>
                                                    <Button type="submit" className="bg-secondary hover:bg-secondary/90 text-on-secondary font-black rounded-xl px-8 h-14 shadow-lg shadow-secondary/20" disabled={isUpdatingCharity}>
                                                        {isUpdatingCharity ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                                                        Apply
                                                    </Button>
                                                </div>
                                                <FormDescription className="text-[10px] font-medium text-text-muted pt-2 leading-relaxed">
                                                    This percentage is deducted from your individual net profit share and added to the company's collective charity pot. This is in addition to the base 2.5% Sahim contribution.
                                                </FormDescription>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Account;
