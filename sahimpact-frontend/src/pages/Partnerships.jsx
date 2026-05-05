import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
    UserPlus, 
    KeyRound, 
    Edit2, 
    FileSignature, 
    Lock, 
    CheckCircle2, 
    ShieldCheck, 
    X, 
    MoreVertical, 
    Search,
    History,
    Fingerprint,
    Info,
    Loader2
} from "lucide-react";

import ConfirmDialog from "@/components/ui/confirm-dialog";

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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const addPartnerSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_]+$/, "Alphanumeric and underscores only"),
    full_name: z.string().min(2, "Full name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["PARTNER", "COMPANY_ADMIN"]),
});

const editPartnerSchema = z.object({
    full_name: z.string().min(2, "Full name is required"),
    role: z.enum(["PARTNER", "COMPANY_ADMIN"]),
    capital_share_fixed: z.coerce.number().min(0, "Capital must be positive"),
    voluntary_charity_percentage: z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100"),
});

const resetPasswordSchema = z.object({
    new_password: z.string().min(8, "Password must be at least 8 characters"),
});

const Partnerships = () => {
    const { showNotification } = useNotification();
    const [users, setUsers] = useState([]);
    const [shares, setShares] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingAgreement, setPendingAgreement] = useState(null);
    const [agreementHistory, setAgreementHistory] = useState([]);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [targetUser, setTargetUser] = useState(null);
    const [agreementConfirm, setAgreementConfirm] = useState({ isOpen: false, id: null, action: null });

    const addForm = useForm({
        resolver: zodResolver(addPartnerSchema),
        defaultValues: {
            username: "",
            full_name: "",
            password: "",
            role: "PARTNER",
        },
    });

    const editForm = useForm({
        resolver: zodResolver(editPartnerSchema),
    });

    const resetForm = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { new_password: "" },
    });

    useEffect(() => {
        fetchData();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('agreement')) {
            setTimeout(() => {
                document.getElementById('agreement-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 500);
        }
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, sharesRes, pendingAgRes, historyRes] = await Promise.all([
                axios.get('/api/admin/users'),
                axios.get('/api/admin/shares'),
                axios.get('/api/agreements/pending'),
                axios.get('/api/agreements/history')
            ]);
            setUsers(usersRes.data);
            setShares(sharesRes.data);
            setPendingAgreement(pendingAgRes.data);
            setAgreementHistory(historyRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPartner = async (data) => {
        try {
            await axios.post('/api/admin/users', data);
            showNotification("Partner added successfully!", "success");
            setShowAddModal(false);
            addForm.reset();
            fetchData();
        } catch (error) {
            showNotification("Failed to add partner", "error");
        }
    };

    const handleEditUser = async (data) => {
        try {
            await axios.put(`/api/admin/users/${targetUser.id}`, {
                full_name: data.full_name,
                role: data.role
            });

            await axios.put(`/api/admin/shares/${targetUser.id}`, {
                capital_share_fixed: data.capital_share_fixed,
                labor_share_variable: 0,
                voluntary_charity_percentage: data.voluntary_charity_percentage / 100
            });

            showNotification("Update proposed. All partners must sign the agreement to finalize changes.", "success");
            setShowEditModal(false);
            fetchData();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to update user", "error");
        }
    };

    const handleResetPassword = async (data) => {
        try {
            await axios.post('/api/admin/reset-password', {
                user_id: targetUser.id,
                new_password: data.new_password
            });
            showNotification(`Password reset for ${targetUser.username}`, "success");
            setShowResetModal(false);
            resetForm.reset();
        } catch (error) {
            showNotification("Failed to reset password", "error");
        }
    };

    const handleSignAgreement = (id, action) => {
        setAgreementConfirm({ isOpen: true, id, action });
    };

    const executeSignAgreement = async () => {
        const { id, action } = agreementConfirm;
        try {
            await axios.post(`/api/agreements/${id}/sign`, { action });
            showNotification(action === 'APPROVE' ? "Agreement signed!" : "Agreement rejected", "success");
            fetchData();
        } catch (error) {
            showNotification("Failed to record signature", "error");
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-muted/30 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">Partnerships</h1>
                    <p className="text-text-muted mt-2 font-medium">Manage company partners, equity distribution, and digital governance.</p>
                </div>
                <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl h-12 px-6">
                            <UserPlus className="w-5 h-5 mr-2" />
                            Add Partner
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-bg-surface border-border-muted max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Add New Partner</DialogTitle>
                            <DialogDescription className="text-text-muted">Create a new system account and assign starting roles.</DialogDescription>
                        </DialogHeader>
                        <Form {...addForm}>
                            <form onSubmit={addForm.handleSubmit(handleAddPartner)} className="space-y-4 py-4">
                                <FormField
                                    control={addForm.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Username</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="bg-bg-base border-border-muted font-bold h-11" placeholder="e.g. john_doe" />
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="full_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Full Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="bg-bg-base border-border-muted font-bold h-11" placeholder="Display Name" />
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Initial Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} className="bg-bg-base border-border-muted font-bold h-11" placeholder="Min 8 characters" />
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">System Role</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-bg-base border-border-muted font-bold h-11">
                                                        <SelectValue placeholder="Select a role" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-bg-surface border-border-muted">
                                                    <SelectItem value="PARTNER">Partner</SelectItem>
                                                    <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="pt-4">
                                    <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="font-black rounded-xl">Cancel</Button>
                                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl flex-1 h-11">Add Partner</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => {
                    const userShare = shares.find(s => s.user_id === user.id);
                    return (
                        <Card key={user.id} className="group hover:border-primary/40 transition-all duration-300 bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/5">
                            <CardHeader className="pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-black uppercase shadow-inner">
                                        {user.full_name ? user.full_name.substring(0, 2) : user.username.substring(0, 2)}
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "font-black tracking-widest text-[9px] uppercase h-6 rounded-lg",
                                        user.role === 'COMPANY_ADMIN' 
                                        ? 'bg-secondary/10 text-secondary border-secondary/20' 
                                        : 'bg-primary/10 text-primary border-primary/20'
                                    )}>
                                        {user.role.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <div className="mt-4">
                                    <CardTitle className="text-xl font-black text-text-main font-brand">{user.full_name || 'No Name Set'}</CardTitle>
                                    <CardDescription className="text-text-muted font-bold flex items-center gap-1 mt-1">
                                        <Fingerprint className="w-3 h-3" /> @{user.username}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-6">
                                <div className="bg-bg-base/50 rounded-2xl p-4 grid grid-cols-2 gap-4 border border-border-muted/10">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-text-muted uppercase font-black tracking-widest block">Investment</span>
                                        <span className="font-black text-text-main font-tabular text-lg">£{(userShare?.capital_share_fixed || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-1 border-l border-border-muted/20 pl-4">
                                        <span className="text-[10px] text-secondary uppercase font-black tracking-widest block">Vol. Charity</span>
                                        <span className="font-black text-secondary font-tabular text-lg">{(userShare?.voluntary_charity_percentage * 100 || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4 border-t border-border-muted/10 gap-3 bg-bg-base/10 group-hover:bg-bg-base/30 transition-colors">
                                <Button 
                                    variant="ghost" 
                                    className="flex-1 font-black text-[10px] uppercase tracking-widest h-10 rounded-xl hover:bg-bg-surface hover:text-primary"
                                    onClick={() => { 
                                        setTargetUser(user); 
                                        resetForm.reset();
                                        setShowResetModal(true); 
                                    }}
                                >
                                    <KeyRound className="w-3.5 h-3.5 mr-2" /> Reset PW
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    className="flex-1 font-black text-[10px] uppercase tracking-widest h-10 rounded-xl hover:bg-bg-surface hover:text-primary"
                                    onClick={() => {
                                        setTargetUser(user);
                                        editForm.reset({
                                            full_name: user.full_name || '',
                                            role: user.role,
                                            capital_share_fixed: userShare?.capital_share_fixed || 0,
                                            voluntary_charity_percentage: (userShare?.voluntary_charity_percentage || 0) * 100
                                        });
                                        setShowEditModal(true);
                                    }}
                                >
                                    <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
                {users.length === 0 && !isLoading && (
                    <Card className="col-span-full py-16 flex flex-col items-center justify-center border-dashed border-border-muted/50 bg-bg-surface/30">
                        <Info className="w-12 h-12 text-text-muted opacity-20 mb-4" />
                        <p className="text-text-muted font-bold uppercase tracking-widest text-sm text-center">No partners found.<br/>Add one to get started.</p>
                    </Card>
                )}
                {isLoading && (
                    <div className="col-span-full py-20 flex justify-center">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                )}
            </div>

            {/* Password Reset Modal */}
            <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
                <DialogContent className="bg-bg-surface border-border-muted max-w-[95vw] sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Reset Password</DialogTitle>
                        <DialogDescription className="text-text-muted font-medium">
                            Enter a new password for <span className="text-text-main font-black">@{targetUser?.username}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...resetForm}>
                        <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-6 py-4">
                            <FormField
                                control={resetForm.control}
                                name="new_password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} className="bg-bg-base border-border-muted font-bold h-11" placeholder="Min 8 characters" />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setShowResetModal(false)} className="font-black rounded-xl">Cancel</Button>
                                <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl flex-1">Reset Now</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Edit User Modal */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="bg-bg-surface border-border-muted max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Edit User: @{targetUser?.username}</DialogTitle>
                        <DialogDescription className="text-text-muted font-medium">Modify partner details and financial participation.</DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-5 py-4">
                            <FormField
                                control={editForm.control}
                                name="full_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Full Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="bg-bg-base border-border-muted font-bold h-11" placeholder="Display Name" />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={editForm.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">System Role</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-bg-base border-border-muted font-bold h-11">
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-bg-surface border-border-muted">
                                                <SelectItem value="PARTNER">Partner</SelectItem>
                                                <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={editForm.control}
                                    name="capital_share_fixed"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Investment (£)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-bg-base border-border-muted font-black h-11" />
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editForm.control}
                                    name="voluntary_charity_percentage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Vol. Charity (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.1" {...field} className="bg-bg-base border-border-muted font-black h-11" />
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)} className="font-black rounded-xl">Cancel</Button>
                                <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl flex-1">Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Partnership Agreement & Sign-off Section */}
            <div id="agreement-section" className="mt-16 border-t border-border-muted/30 pt-16">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <FileSignature className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-text-main font-brand uppercase tracking-tighter">Partnership Agreements</h2>
                        <p className="text-text-muted font-medium text-sm">Review, digitally sign, and audit institutional changes.</p>
                    </div>
                </div>

                {pendingAgreement ? (
                    <Card className={cn(
                        "border-2 mb-16 animate-in fade-in zoom-in-95 duration-500 overflow-hidden",
                        pendingAgreement.agreement_type === 'PERIOD_CLOSE' 
                        ? 'border-secondary/30 bg-secondary/[0.02]' 
                        : 'border-primary/30 bg-primary/[0.02]'
                    )}>
                        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border-muted/20">
                            <div className="flex-1 p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <Badge className={cn(
                                        "px-4 py-1.5 font-black tracking-[0.2em] uppercase rounded-full text-[10px]",
                                        pendingAgreement.agreement_type === 'PERIOD_CLOSE' 
                                        ? 'bg-secondary text-on-secondary' 
                                        : 'bg-primary text-on-primary'
                                    )}>
                                        Action Required
                                    </Badge>
                                    <span className="text-xs text-text-muted font-black uppercase tracking-widest">
                                        Proposed by {pendingAgreement.proposed_by_name} • {new Date(pendingAgreement.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                
                                <h3 className="text-2xl font-black text-text-main font-brand mb-3">{pendingAgreement.change_summary}</h3>
                                <p className="text-text-muted font-medium leading-relaxed mb-8 max-w-2xl">
                                    {pendingAgreement.agreement_type === 'PERIOD_CLOSE' 
                                        ? "A request to lock and distribute profits for the current period has been submitted. This will finalize all partner payouts and archive current transactions."
                                        : "A modification to partnership parameters or equity allocation has been proposed. All partners must review and sign off before the new rules take effect."
                                    }
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {pendingAgreement.agreement_type === 'PARAMETER_CHANGE' && (
                                        <>
                                            {pendingAgreement.proposed_settings && (
                                                <div className="bg-bg-base/40 rounded-2xl p-6 border border-border-muted/10">
                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-4">Financial Parameters</h4>
                                                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                                                        <div>
                                                            <span className="text-[10px] block text-text-muted font-bold">Charity Pot</span>
                                                            <span className="font-black text-text-main">{(pendingAgreement.proposed_settings.charity_percentage * 100).toFixed(1)}%</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] block text-text-muted font-bold">Capital Pool</span>
                                                            <span className="font-black text-text-main">{(pendingAgreement.proposed_settings.capital_pool_percentage * 100).toFixed(0)}%</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] block text-text-muted font-bold">Labour Pool</span>
                                                            <span className="font-black text-text-main">{(pendingAgreement.proposed_settings.labour_pool_percentage * 100).toFixed(0)}%</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] block text-text-muted font-bold">Min. Contingency</span>
                                                            <span className="font-black text-text-main">£{pendingAgreement.proposed_settings.contingency_pot_minimum.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {pendingAgreement.proposed_shares && (
                                                <div className="bg-bg-base/40 rounded-2xl p-6 border border-border-muted/10">
                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-4">Proposed Investment</h4>
                                                    <div className="space-y-3">
                                                        {pendingAgreement.proposed_shares.map((share, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-border-muted/10 last:border-0 last:pb-0">
                                                                <span className="font-black text-text-main">{users.find(u => u.id === share.user_id)?.full_name || 'Partner'}</span>
                                                                <span className="font-black font-tabular text-primary">£{share.capital_share_fixed.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {pendingAgreement.agreement_type === 'PERIOD_CLOSE' && (
                                        <div className="col-span-full bg-bg-base/60 rounded-2xl p-8 border border-secondary/20 shadow-inner">
                                            <div className="flex items-center gap-4 text-secondary mb-6">
                                                <Lock className="w-6 h-6" />
                                                <h4 className="text-lg font-black uppercase tracking-tighter">Period Closure Ledger</h4>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                                                <div className="bg-bg-surface/50 p-4 rounded-xl border border-border-muted/10">
                                                    <span className="text-[10px] uppercase font-black text-text-muted tracking-widest block mb-1">Fiscal Period</span>
                                                    <span className="text-xl font-black text-text-main font-brand">{pendingAgreement.period_name}</span>
                                                </div>
                                                {pendingAgreement.negligent_user_id && (
                                                    <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/20">
                                                        <span className="text-[10px] uppercase font-black text-destructive tracking-widest block mb-1">Negligence Liability</span>
                                                        <span className="text-xl font-black text-destructive font-brand">
                                                            {users.find(u => u.id === pendingAgreement.negligent_user_id)?.full_name || `Partner ${pendingAgreement.negligent_user_id}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 p-4 bg-secondary/5 rounded-xl border border-secondary/10">
                                                <Info className="w-4 h-4 text-secondary" />
                                                <p className="text-xs text-text-muted font-bold italic">
                                                    Signing this will freeze all current ledger entries and finalize the automated distribution cycle.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full lg:w-96 p-8 bg-bg-base/40">
                                <div className="flex items-center gap-3 mb-8">
                                    <ShieldCheck className="w-6 h-6 text-primary" />
                                    <h4 className="text-lg font-black text-text-main font-brand uppercase tracking-tighter">Digital Multi-Sig</h4>
                                </div>
                                
                                <div className="space-y-5 mb-10">
                                    {pendingAgreement.signoffs.map(sign => (
                                        <div key={sign.id} className="flex items-center justify-between p-4 bg-bg-surface/50 rounded-2xl border border-border-muted/10 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-3 h-3 rounded-full animate-pulse",
                                                    sign.status === 'APPROVED' ? 'bg-primary shadow-[0_0_10px_rgba(46,222,164,0.5)]' : 'bg-text-muted/30'
                                                )}></div>
                                                <span className="text-sm font-black text-text-main">{sign.full_name || sign.username}</span>
                                            </div>
                                            {sign.status === 'APPROVED' ? (
                                                <CheckCircle2 className="w-5 h-5 text-primary" />
                                            ) : (
                                                <Badge variant="ghost" className="text-[9px] font-black tracking-widest text-text-muted uppercase">Pending</Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button 
                                        size="lg"
                                        onClick={() => handleSignAgreement(pendingAgreement.id, 'APPROVE')}
                                        className="w-full h-14 bg-primary hover:bg-primary/90 text-on-primary font-black rounded-2xl shadow-lg shadow-primary/20 text-lg uppercase tracking-widest"
                                    >
                                        Seal & Approve
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        size="lg"
                                        onClick={() => handleSignAgreement(pendingAgreement.id, 'REJECT')}
                                        className="w-full h-12 border-destructive/20 text-destructive hover:bg-destructive/5 font-black rounded-2xl uppercase tracking-widest text-xs"
                                    >
                                        Reject Proposal
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="py-20 flex flex-col items-center justify-center border-dashed border-border-muted/50 bg-bg-surface/30 mb-16">
                        <ShieldCheck className="w-12 h-12 text-primary opacity-20 mb-4" />
                        <p className="text-text-muted font-bold uppercase tracking-widest text-sm">No pending agreements. System is synchronized.</p>
                    </Card>
                )}

                <Card className="bg-bg-surface border-border-muted/50 overflow-hidden">
                    <CardHeader className="border-b border-border-muted/10 pb-6">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-secondary" />
                            <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Agreement Archive</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                            <TableHeader className="bg-bg-base/50">
                                <TableRow className="hover:bg-transparent border-border-muted/10">
                                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Timestamp</TableHead>
                                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Type</TableHead>
                                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Summary</TableHead>
                                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Initiator</TableHead>
                                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Result</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agreementHistory.map(ag => (
                                    <TableRow key={ag.id} className="hover:bg-primary/[0.02] border-border-muted/10">
                                        <TableCell className="px-6 py-5 text-xs font-bold text-text-muted">
                                            {new Date(ag.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="px-6 py-5">
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] font-black uppercase tracking-tight",
                                                ag.agreement_type === 'PERIOD_CLOSE' ? 'border-secondary/30 text-secondary bg-secondary/5' : 'border-primary/30 text-primary bg-primary/5'
                                            )}>
                                                {ag.agreement_type?.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-5 font-black text-text-main font-brand">{ag.change_summary}</TableCell>
                                        <TableCell className="px-6 py-5 text-sm font-bold text-text-muted">{ag.proposed_by_name}</TableCell>
                                        <TableCell className="px-6 py-5 text-right">
                                            <Badge className={cn(
                                                "px-3 py-1 font-black text-[9px] uppercase tracking-[0.2em] rounded-md",
                                                ag.status === 'APPROVED' ? 'bg-primary text-on-primary' : 
                                                ag.status === 'REJECTED' ? 'bg-destructive text-white' : 
                                                'bg-bg-base text-text-muted'
                                            )}>
                                                {ag.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-border-muted/10">
                            {agreementHistory.map(ag => (
                                <div key={ag.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-text-muted">
                                                {new Date(ag.created_at).toLocaleDateString()}
                                            </span>
                                            <h3 className="text-sm font-black text-text-main leading-tight">{ag.change_summary}</h3>
                                        </div>
                                        <Badge className={cn(
                                            "px-2 py-0.5 font-black text-[8px] uppercase tracking-widest rounded-md",
                                            ag.status === 'APPROVED' ? 'bg-primary text-on-primary' : 
                                            ag.status === 'REJECTED' ? 'bg-destructive text-white' : 
                                            'bg-bg-base text-text-muted'
                                        )}>
                                            {ag.status}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <Badge variant="outline" className={cn(
                                            "text-[8px] font-black uppercase tracking-tight",
                                            ag.agreement_type === 'PERIOD_CLOSE' ? 'border-secondary/30 text-secondary' : 'border-primary/30 text-primary'
                                        )}>
                                            {ag.agreement_type?.replace('_', ' ')}
                                        </Badge>
                                        <span className="font-bold text-text-muted">By {ag.proposed_by_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {agreementHistory.length === 0 && (
                            <div className="py-12 text-center text-text-muted font-bold italic opacity-50 text-xs">
                                No previous agreements recorded in the immutable ledger.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            <ConfirmDialog
                isOpen={agreementConfirm.isOpen}
                onOpenChange={(open) => setAgreementConfirm(prev => ({ ...prev, isOpen: open }))}
                title={agreementConfirm.action === 'APPROVE' ? "Confirm Signature" : "Confirm Rejection"}
                description={agreementConfirm.action === 'APPROVE' 
                    ? "Are you sure you want to digitally sign and approve this partnership agreement? This action will be recorded in the immutable audit log."
                    : "Are you sure you want to reject this proposed agreement? This will notify all partners and stop the proposal process."}
                confirmText={agreementConfirm.action === 'APPROVE' ? "Seal & Approve" : "Reject Proposal"}
                variant={agreementConfirm.action === 'APPROVE' ? "default" : "destructive"}
                onConfirm={executeSignAgreement}
            />
        </div>
    );
};

export default Partnerships;
