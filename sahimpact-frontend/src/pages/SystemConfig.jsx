import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
    Palette, 
    Banknote, 
    Building2, 
    Users, 
    Trash2, 
    AlertTriangle, 
    History, 
    RotateCcw, 
    Plus, 
    MoreVertical, 
    Settings2,
    ShieldAlert,
    ExternalLink,
    KeyRound,
    UserPlus,
    RefreshCw,
    Loader2
} from "lucide-react";

import ConfirmDialog from "@/components/ui/confirm-dialog";

import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const settingsSchema = z.object({
    primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
    secondary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
    logo_url: z.string().url().or(z.string().length(0)),
    favicon_url: z.string().url().or(z.string().length(0)),
    company_name: z.string().optional(),
});

const companySchema = z.object({
    name: z.string().min(2, "Company name must be at least 2 characters"),
    admin_username: z.string().min(3, "Username must be at least 3 characters"),
    admin_password: z.string().min(8, "Password must be at least 8 characters"),
});

const resetPasswordSchema = z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const newUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

const SystemConfig = () => {
    const { showNotification } = useNotification();
    const { role } = useAuth();
    const location = useLocation();
    const { refreshBranding } = useBranding();
    
    // Check for tab param in URL
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'global';
    
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isLoading, setIsLoading] = useState(false);
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab) {
            setActiveTab(tab);
            if (tab === 'orphans' && role === 'SUPER_ADMIN') {
                fetchCompanies();
                fetchOrphanedPartners();
            }
        }
    }, [location.search, role]);
    
    // Global Settings State
    const [settings, setSettings] = useState({
        primary_color: '#94d4ad',
        secondary_color: '#bfc1ff',
        logo_url: '',
        favicon_url: '',
        company_name: ''
    });

    // Forms
    const settingsForm = useForm({
        resolver: zodResolver(settingsSchema),
        defaultValues: settings
    });

    const companyForm = useForm({
        resolver: zodResolver(companySchema),
        defaultValues: { name: '', admin_username: '', admin_password: '' }
    });

    const resetPasswordForm = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { newPassword: '' }
    });

    const newUserForm = useForm({
        resolver: zodResolver(newUserSchema),
        defaultValues: { username: '', password: '' }
    });

    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [resetPasswordModal, setResetPasswordModal] = useState({ isOpen: false, userId: null, username: '' });
    const [manageUsersModal, setManageUsersModal] = useState({ 
        isOpen: false, 
        companyId: null, 
        companyName: '', 
        users: [],
        showOrphanList: false
    });

    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, companyId: null, companyName: '' });
    const [wipeConfirm, setWipeConfirm] = useState(false);
    const [userDeactivateConfirm, setUserDeactivateConfirm] = useState({ isOpen: false, userId: null, username: '' });
    const [orphanedPartners, setOrphanedPartners] = useState([]);


    const [pendingAgreement, setPendingAgreement] = useState(null);

    useEffect(() => {
        fetchSettings();
        if (role === 'SUPER_ADMIN') {
            fetchCompanies();
            fetchOrphanedPartners();
        }
    }, [role]);

    const fetchSettings = async () => {
        try {
            const [settingsRes, pendingRes] = await Promise.all([
                axios.get('/api/settings'),
                axios.get('/api/agreements/pending')
            ]);
            
            let companyName = '';
            if (role === 'COMPANY_ADMIN') {
                const companyId = sessionStorage.getItem('company_id');
                if (companyId && companyId !== 'null') {
                    const companyRes = await axios.get(`/api/companies/${companyId}`);
                    companyName = companyRes.data?.name || '';
                }
            }

            const fetchedSettings = { ...settingsRes.data, company_name: companyName };
            setSettings(fetchedSettings);
            settingsForm.reset(fetchedSettings);
            setPendingAgreement(pendingRes.data);
            
            if (settingsRes.data.primary_color) document.documentElement.style.setProperty('--primary-brand', settingsRes.data.primary_color);
            if (settingsRes.data.secondary_color) document.documentElement.style.setProperty('--secondary-brand', settingsRes.data.secondary_color);
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const fetchCompanies = async () => {
        try {
            const res = await axios.get('/api/companies');
            setCompanies(res.data);
        } catch (error) {
            console.error("Failed to fetch companies", error);
        }
    };

    const fetchOrphanedPartners = async () => {
        try {
            const res = await axios.get('/api/companies/orphaned-partners');
            setOrphanedPartners(res.data);
        } catch (error) {
            console.error("Failed to fetch orphaned partners", error);
        }
    };

    const onSettingsSubmit = async (values) => {
        setIsLoading(true);
        try {
            await axios.put('/api/settings', values);
            
            if (role === 'COMPANY_ADMIN' && values.company_name) {
                const companyId = sessionStorage.getItem('company_id');
                if (companyId && companyId !== 'null') {
                    await axios.put(`/api/companies/${companyId}`, { name: values.company_name });
                }
            }

            showNotification("Changes proposed! All partners must sign to apply.", "success");
            fetchSettings();
            refreshBranding();
        } catch (error) {
            showNotification("Failed to update settings", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const onCompanySubmit = async (values) => {
        setIsLoading(true);
        try {
            // 1. Create Company
            const companyRes = await axios.post('/api/companies', { name: values.name });
            const companyId = companyRes.data.id;

            // 2. Create Admin
            await axios.post(`/api/companies/${companyId}/admin`, {
                username: values.admin_username,
                password: values.admin_password
            });

            showNotification(`Company ${values.name} created successfully!`, "success");
            setIsCompanyModalOpen(false);
            companyForm.reset();
            fetchCompanies();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to create company", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCompanyUsers = async (companyId) => {
        try {
            const res = await axios.get(`/api/companies/${companyId}/users`);
            setManageUsersModal(prev => ({ ...prev, users: res.data }));
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };

    const openManageUsersModal = (companyId, companyName) => {
        setManageUsersModal({ 
            isOpen: true, 
            companyId, 
            companyName, 
            users: [], 
            showOrphanList: false
        });
        newUserForm.reset();
        fetchCompanyUsers(companyId);
    };

    const handleToggleCompanyActive = async (companyId) => {
        try {
            await axios.put(`/api/companies/${companyId}/toggle-active`);
            showNotification("Company status toggled successfully.", "success");
            fetchCompanies();
        } catch (error) {
            showNotification("Failed to toggle company status", "error");
        }
    };

    const handleHardDeleteCompany = (companyId, companyName) => {
        setDeleteConfirm({ isOpen: true, companyId, companyName });
    };

    const executeHardDeleteCompany = async () => {
        const { companyId, companyName } = deleteConfirm;
        try {
            await axios.delete(`/api/companies/${companyId}`);
            showNotification(`${companyName} and all its data have been purged.`, "success");
            fetchCompanies();
        } catch (error) {
            showNotification("Failed to delete company", "error");
        }
    };

    const handleAdoptPartner = async (userId, companyId) => {
        try {
            await axios.post(`/api/companies/${companyId}/adopt-partner/${userId}`);
            showNotification("Partner linked to company successfully.", "success");
            
            // Refresh everything
            fetchOrphanedPartners();
            if (manageUsersModal.isOpen) {
                fetchCompanyUsers(manageUsersModal.companyId);
                setManageUsersModal(prev => ({ ...prev, showOrphanList: false }));
            }
            fetchCompanies();
        } catch (error) {
            showNotification("Failed to link partner", "error");
        }
    };

    const handleSystemWipe = () => {
        setWipeConfirm(true);
    };

    const executeSystemWipe = async () => {
        setIsLoading(true);
        try {
            await axios.post('/api/admin/system-wipe');
            showNotification("System wiped successfully. Resetting application...", "success");
            // Clear company context and redirect to companies tab
            sessionStorage.removeItem('company_id');
            setActiveTab('companies');
            fetchCompanies();
            fetchOrphanedPartners();
        } catch (error) {
            showNotification("Failed to wipe system data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const onNewUserSubmit = async (values) => {
        const { companyId, companyName } = manageUsersModal;
        
        setIsLoading(true);
        try {
            await axios.post(`/api/companies/${companyId}/admin`, {
                username: values.username,
                password: values.password
            });
            showNotification(`Admin account added to ${companyName} successfully.`, "success");
            newUserForm.reset();
            fetchCompanyUsers(companyId);
            fetchCompanies();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to add admin", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateUserRole = async (userId, newRole) => {
        const { companyId } = manageUsersModal;
        try {
            await axios.put(`/api/companies/${companyId}/users/${userId}/role`, { role: newRole });
            showNotification(`User role updated successfully.`, "success");
            fetchCompanyUsers(companyId);
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to update role", "error");
        }
    };

    const handleDeactivateUser = (userId, username) => {
        setUserDeactivateConfirm({ isOpen: true, userId, username });
    };

    const executeDeactivateUser = async () => {
        const { userId } = userDeactivateConfirm;
        const { companyId } = manageUsersModal;
        try {
            await axios.delete(`/api/companies/${companyId}/users/${userId}`);
            showNotification(`User account deactivated.`, "success");
            fetchCompanyUsers(companyId);
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to deactivate user", "error");
        }
    };

    const openResetPasswordModal = (userId, username) => {
        setResetPasswordModal({ isOpen: true, userId, username });
        resetPasswordForm.reset({ newPassword: '' });
    };

    const onResetPasswordSubmit = async (values) => {
        const { userId, username } = resetPasswordModal;
        
        try {
            await axios.post('/api/admin/reset-password', {
                user_id: userId,
                new_password: values.newPassword
            });
            showNotification(`Password for ${username} reset successfully.`, "success");
            setResetPasswordModal({ isOpen: false, userId: null, username: '' });
        } catch (error) {
            showNotification("Failed to reset password", "error");
        }
    };


    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="border-b border-border-muted/30 pb-8">
                <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">System Nexus</h1>
                <p className="text-text-muted mt-2 font-medium">Enterprise governance, global constants, and multi-tenant oversight.</p>
            </div>

            {pendingAgreement && activeTab === 'global' && (
                <Alert className="bg-primary/5 border-primary/20">
                    <History className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary font-bold">Pending Governance Change</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <span>A proposal for partnership governance is currently pending approval.</span>
                        <Button variant="outline" size="sm" asChild>
                            <a href="/partnerships?tab=agreements">Review Agreement</a>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {role === 'SUPER_ADMIN' && (
                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-10 h-auto bg-bg-surface border border-border-muted/30 p-1 rounded-2xl shadow-sm">
                        <TabsTrigger value="global" className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] rounded-xl data-[state=active]:bg-primary data-[state=active]:text-on-primary data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all">
                            <Palette className="h-3.5 w-3.5" /> Branding & Identity
                        </TabsTrigger>
                        <TabsTrigger value="companies" className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] rounded-xl data-[state=active]:bg-primary data-[state=active]:text-on-primary data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all">
                            <Building2 className="h-3.5 w-3.5" /> Enterprise Registry
                        </TabsTrigger>
                        <TabsTrigger value="orphans" className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] rounded-xl data-[state=active]:bg-primary data-[state=active]:text-on-primary data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all">
                            <Users className="h-3.5 w-3.5" /> Orphan Audit
                            {orphanedPartners.length > 0 && (
                                <Badge className="ml-2 bg-destructive text-destructive-foreground font-black text-[9px] px-1.5 h-4 min-w-[16px] flex items-center justify-center">
                                    {orphanedPartners.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="danger" className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] rounded-xl data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground transition-all">
                            <ShieldAlert className="h-3.5 w-3.5" /> Critical Zone
                        </TabsTrigger>
                    </TabsList>
                )}

                <TabsContent value="global" className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                            <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                                <CardTitle className="flex items-center gap-3 text-xl font-black text-text-main font-brand uppercase tracking-tighter">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <Palette className="h-5 w-5" />
                                    </div>
                                    Visual Identity
                                </CardTitle>
                                <CardDescription className="text-text-muted font-medium">System-wide UI white-labeling and brand presence.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...settingsForm}>
                                    <form className="space-y-4">
                                        {role === 'COMPANY_ADMIN' && (
                                            <FormField
                                                control={settingsForm.control}
                                                name="company_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Company Name</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="Enter your enterprise name" />
                                                        </FormControl>
                                                        <FormDescription>
                                                            This identifies your organization across the protocol.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={settingsForm.control}
                                                name="primary_color"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Primary Color</FormLabel>
                                                        <div className="flex gap-2">
                                                            <FormControl>
                                                                <Input type="color" className="w-12 p-1 h-10" {...field} disabled={role === 'PARTNER'} />
                                                            </FormControl>
                                                            <FormControl>
                                                                <Input {...field} disabled={role === 'PARTNER'} />
                                                            </FormControl>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={settingsForm.control}
                                                name="secondary_color"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Secondary Color</FormLabel>
                                                        <div className="flex gap-2">
                                                            <FormControl>
                                                                <Input type="color" className="w-12 p-1 h-10" {...field} disabled={role === 'PARTNER'} />
                                                            </FormControl>
                                                            <FormControl>
                                                                <Input {...field} disabled={role === 'PARTNER'} />
                                                            </FormControl>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>

                    {role !== 'PARTNER' && (
                        <div className="flex justify-end pt-4">
                            <Button 
                                size="lg" 
                                className="shadow-2xl shadow-primary/30 h-14 px-8 bg-primary hover:bg-primary/90 text-on-primary font-black uppercase tracking-widest text-sm rounded-xl" 
                                onClick={settingsForm.handleSubmit(onSettingsSubmit)}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
                                {isLoading ? 'Updating...' : 'Save Branding Changes'}
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="companies" className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-bg-surface p-6 rounded-2xl border border-border-muted/30 shadow-sm mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Enterprise Registry</h2>
                            <p className="text-text-muted text-xs font-medium">Multi-tenant management and data isolation controls.</p>
                        </div>
                        <Button onClick={() => setIsCompanyModalOpen(true)} className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl h-12 px-6 shadow-lg shadow-primary/20 w-full sm:w-auto">
                            <Plus className="mr-2 h-5 w-5" /> New Enterprise
                        </Button>
                    </div>

                    <Card className="bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm">
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-bg-base/50">
                                    <TableRow className="hover:bg-transparent border-border-muted/10">
                                        <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Company Name</TableHead>
                                        <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Status</TableHead>
                                        <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Created</TableHead>
                                        <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {companies.map((company) => (
                                        <TableRow key={company.id} className="hover:bg-primary/[0.02] border-border-muted/10 transition-colors group">
                                            <TableCell className="px-6 py-5 font-bold">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-secondary/10 text-secondary flex items-center justify-center text-xs font-black">
                                                        {company.name.charAt(0)}
                                                    </div>
                                                    {company.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-6 py-5">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${company.is_active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                                                    {company.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-6 py-5 text-muted-foreground text-sm font-medium">
                                                {new Date(company.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        title={company.is_active ? "Deactivate" : "Reactivate"}
                                                        onClick={() => handleToggleCompanyActive(company.id)}
                                                        className={cn("w-9 h-9 rounded-xl", company.is_active ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-bg-base")}
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        title="Purge Data"
                                                        onClick={() => handleHardDeleteCompany(company.id, company.name)}
                                                        className="w-9 h-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        title="Manage Users"
                                                        onClick={() => openManageUsersModal(company.id, company.name)}
                                                        className="w-9 h-9 rounded-xl hover:bg-primary/10 hover:text-primary"
                                                    >
                                                        <Users className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        title="Reset Password"
                                                        onClick={() => openResetPasswordModal(company.admin_id, company.admin_username || (company.name + ' Admin'))}
                                                        className="w-9 h-9 rounded-xl hover:bg-primary/10 hover:text-primary"
                                                    >
                                                        <KeyRound className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {companies.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-medium text-xs">
                                                No companies found. Create one to get started.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="md:hidden divide-y divide-border-muted/10">
                            {companies.map((company) => (
                                <div key={company.id} className="p-4 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-black">
                                                {company.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-text-main">{company.name}</h3>
                                                <p className="text-[10px] text-text-muted font-medium">Created {new Date(company.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${company.is_active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                                            {company.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => openManageUsersModal(company.id, company.name)}
                                            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10"
                                        >
                                            <Users className="w-3.5 h-3.5 mr-2" /> Users
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => openResetPasswordModal(company.admin_id, company.admin_username || (company.name + ' Admin'))}
                                            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10"
                                        >
                                            <KeyRound className="w-3.5 h-3.5 mr-2" /> Password
                                        </Button>
                                        <Button 
                                            variant={company.is_active ? "secondary" : "default"}
                                            size="sm" 
                                            onClick={() => handleToggleCompanyActive(company.id)}
                                            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5 mr-2" /> {company.is_active ? 'Deactivate' : 'Activate'}
                                        </Button>
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={() => handleHardDeleteCompany(company.id, company.name)}
                                            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 shadow-lg shadow-destructive/20"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Purge
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="orphans" className="space-y-8">
                    <div className="flex flex-col gap-1 border-l-4 border-destructive pl-4 py-2">
                        <h2 className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Orphan Audit</h2>
                        <p className="text-text-muted text-sm font-medium">Partners detected without a parent enterprise association.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {orphanedPartners.map(orphan => (
                            <Card key={orphan.id} className="border-dashed">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold text-xl">
                                            {orphan.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">@{orphan.username}</CardTitle>
                                            <CardDescription>{orphan.full_name || 'No full name'}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link to Company</label>
                                        <Select onValueChange={(val) => handleAdoptPartner(orphan.id, val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a company..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {companies.map(c => (
                                                    <SelectItem key={c.id} value={c.id.toString()}>
                                                        {c.name} {!c.is_active && '(Inactive)'}
                                                    </SelectItem>
                                                ))}
                                                {companies.length === 0 && <SelectItem disabled value="none">No companies available</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {orphanedPartners.length === 0 && (
                            <Card className="col-span-full border-dashed p-12 text-center">
                                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <CardTitle className="text-muted-foreground">All clear!</CardTitle>
                                <CardDescription>No orphaned partners found.</CardDescription>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="danger" className="space-y-8">
                    <div className="flex flex-col gap-1 border-l-4 border-destructive pl-4 py-2">
                        <h2 className="text-2xl font-black text-destructive font-brand uppercase tracking-tighter">Critical Zone</h2>
                        <p className="text-text-muted text-sm font-medium">Destructive system-level actions. Execute with absolute caution.</p>
                    </div>

                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <ShieldAlert className="h-5 w-5" /> System Reset (Production Wipe)
                            </CardTitle>
                            <CardDescription className="text-destructive/80">
                                This will PERMANENTLY DELETE all enterprise records, transactions, partners, and reports. 
                                Only your account remains.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="bg-destructive/10 border-t border-destructive/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-destructive text-xs font-bold uppercase tracking-widest">
                                <AlertTriangle className="h-4 w-4" /> This action cannot be undone
                            </div>
                            <Button variant="destructive" onClick={handleSystemWipe} disabled={isLoading}>
                                {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isLoading ? 'Wiping System...' : 'Wipe All System Data'}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isCompanyModalOpen} onOpenChange={setIsCompanyModalOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg bg-bg-surface border-border-muted/50 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Register Enterprise</DialogTitle>
                        <DialogDescription className="text-text-muted font-medium">Initialize a new isolated business entity and administrative authority.</DialogDescription>
                    </DialogHeader>
                    <Form {...companyForm}>
                        <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-4">
                            <FormField
                                control={companyForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Company Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter company name..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="space-y-4 pt-4 border-t">
                                <h4 className="text-xs font-black uppercase tracking-widest text-secondary">Primary Admin Account</h4>
                                <FormField
                                    control={companyForm.control}
                                    name="admin_username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Admin username" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={companyForm.control}
                                    name="admin_password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Initial Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="At least 8 characters" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-on-primary font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-primary/20" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize Enterprise Creation'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={resetPasswordModal.isOpen} onOpenChange={(open) => !open && setResetPasswordModal(prev => ({...prev, isOpen: false}))}>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Enter a new password for <span className="font-bold text-foreground">{resetPasswordModal.username}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...resetPasswordForm}>
                        <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                            <FormField
                                control={resetPasswordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="At least 8 characters" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="submit" className="w-full">Save Password</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={manageUsersModal.isOpen} onOpenChange={(open) => !open && setManageUsersModal(prev => ({...prev, isOpen: false}))}>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Manage Users</DialogTitle>
                        <DialogDescription>
                            Managing users for <span className="font-bold text-foreground">{manageUsersModal.companyName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Existing Users</h3>
                                <Button variant="outline" size="sm" onClick={() => setManageUsersModal(prev => ({ ...prev, showOrphanList: !prev.showOrphanList }))}>
                                    {manageUsersModal.showOrphanList ? "Show Member List" : "Add Existing Partner"}
                                </Button>
                            </div>

                            {manageUsersModal.showOrphanList ? (
                                <div className="space-y-4 border-2 border-dashed border-primary/20 p-4 rounded-2xl bg-primary/5">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <UserPlus className="h-4 w-4" /> Available Partners
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {orphanedPartners.map(orphan => (
                                            <div key={orphan.id} className="flex items-center justify-between p-3 bg-bg-surface rounded-xl border border-border-muted/20">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                        {orphan.username.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">@{orphan.username}</p>
                                                        <p className="text-[10px] text-text-muted">{orphan.full_name}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => handleAdoptPartner(orphan.id, manageUsersModal.companyId)} className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                    Adopt
                                                </Button>
                                            </div>
                                        ))}
                                        {orphanedPartners.length === 0 && (
                                            <p className="text-center py-4 text-xs font-medium text-text-muted italic">No orphaned partners detected.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-border-muted/10 rounded-2xl overflow-hidden bg-bg-base/30">
                                    <div className="hidden sm:block">
                                        <Table>
                                            <TableHeader className="bg-bg-base/50">
                                                <TableRow className="hover:bg-transparent border-border-muted/10">
                                                    <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted">Username</TableHead>
                                                    <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted">Role</TableHead>
                                                    <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {manageUsersModal.users.map(u => (
                                                    <TableRow key={u.id} className="border-border-muted/10">
                                                        <TableCell className="font-bold text-sm text-text-main">{u.username}</TableCell>
                                                        <TableCell>
                                                            <Select defaultValue={u.role} onValueChange={(val) => handleUpdateUserRole(u.id, val)}>
                                                                <SelectTrigger className="h-9 w-[150px] rounded-xl font-bold text-xs bg-bg-base">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="PARTNER" className="font-bold text-xs">Partner</SelectItem>
                                                                    <SelectItem value="COMPANY_ADMIN" className="font-bold text-xs">Company Admin</SelectItem>
                                                                    <SelectItem value="SUPER_ADMIN" className="font-bold text-xs text-primary">Super Admin</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="w-9 h-9 rounded-xl text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDeactivateUser(u.id, u.username)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <div className="sm:hidden divide-y divide-border-muted/10">
                                        {manageUsersModal.users.map(u => (
                                            <div key={u.id} className="p-4 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-black text-text-main">{u.username}</span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="w-8 h-8 rounded-lg text-destructive"
                                                        onClick={() => handleDeactivateUser(u.id, u.username)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <Select defaultValue={u.role} onValueChange={(val) => handleUpdateUserRole(u.id, val)}>
                                                    <SelectTrigger className="h-10 w-full rounded-xl font-bold text-xs bg-bg-base">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PARTNER" className="font-bold text-xs">Partner</SelectItem>
                                                        <SelectItem value="COMPANY_ADMIN" className="font-bold text-xs">Company Admin</SelectItem>
                                                        <SelectItem value="SUPER_ADMIN" className="font-bold text-xs text-primary">Super Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 pt-6 border-t">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Add New Admin Account</h3>
                            <Form {...newUserForm}>
                                <form onSubmit={newUserForm.handleSubmit(onNewUserSubmit)} className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={newUserForm.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2 sm:col-span-1">
                                                <FormLabel>Username</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Username" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={newUserForm.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2 sm:col-span-1">
                                                <FormLabel>Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="col-span-2 h-12 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/10" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialogs */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, isOpen: open }))}
                title="Purge Enterprise Data"
                description={`WARNING: This will PERMANENTLY delete ${deleteConfirm.companyName} and ALL associated data (transactions, accounts, users). This action cannot be undone.`}
                confirmText="Purge Everything"
                variant="destructive"
                onConfirm={executeHardDeleteCompany}
            />

            <ConfirmDialog
                isOpen={wipeConfirm}
                onOpenChange={setWipeConfirm}
                title="Total System Reset"
                description="🚨 CRITICAL WARNING: You are about to PERMANENTLY WIPE ALL SYSTEM DATA. This includes all companies, users, transactions, and reports. Only your master account will remain."
                confirmText="Execute System Wipe"
                variant="destructive"
                requireText="PURGE"
                onConfirm={executeSystemWipe}
            />

            <ConfirmDialog
                isOpen={userDeactivateConfirm.isOpen}
                onOpenChange={(open) => setUserDeactivateConfirm(prev => ({ ...prev, isOpen: open }))}
                title="Deactivate User Account"
                description={`Are you sure you want to deactivate the account for ${userDeactivateConfirm.username}? They will lose all access to the system immediately.`}
                confirmText="Deactivate Account"
                variant="destructive"
                onConfirm={executeDeactivateUser}
            />
        </div>
    );
};

export default SystemConfig;
