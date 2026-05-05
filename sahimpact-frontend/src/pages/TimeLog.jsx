import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
    Plus,
    Calendar,
    Clock,
    Users,
    User as UserIcon,
    History,
    Edit2,
    Trash2,
    Lock,
    Unlock,
    Loader2,
    Search,
    ChevronDown,
    Activity
} from "lucide-react";

import ConfirmDialog from "@/components/ui/confirm-dialog";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const timeEntrySchema = z.object({
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    description: z.string().min(1, "Description is mandatory").max(1000, "Description too long"),
}).refine((data) => {
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);
    return end > start;
}, {
    message: "End time must be after start time",
    path: ["end_time"],
}).refine((data) => {
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);
    const hours = (end - start) / (1000 * 60 * 60);
    return hours <= 15;
}, {
    message: "Maximum 15 hours per entry",
    path: ["end_time"],
});

const TimeLog = () => {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [timeStats, setTimeStats] = useState({ my_total_hours: 0, company_total_hours: 0 });
    const { showNotification } = useNotification();
    const { user, role } = useAuth();
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, entryId: null });

    const currentUserId = user?.id || parseInt(sessionStorage.getItem('user_id'));
    const isAdmin = role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN';

    const [viewMode, setViewMode] = useState('my');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const form = useForm({
        resolver: zodResolver(timeEntrySchema),
        defaultValues: {
            start_time: "",
            end_time: "",
            description: "",
        },
    });

    // Auto-sync end_time date when start_time changes
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'start_time' && value.start_time) {
                const currentEnd = form.getValues('end_time');
                // If end_time is empty or before start_time, or same date sync is requested
                if (!currentEnd || currentEnd < value.start_time) {
                    form.setValue('end_time', value.start_time);
                } else {
                    // Just sync the date part if it's different (optional, but requested)
                    const startDate = value.start_time.split('T')[0];
                    const endDate = currentEnd.split('T')[0];
                    if (startDate !== endDate) {
                        const endTime = currentEnd.split('T')[1];
                        form.setValue('end_time', `${startDate}T${endTime}`);
                    }
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);

    useEffect(() => {
        fetchEntries();
        fetchStats();
    }, [viewMode, selectedMonth, selectedYear]);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/time/stats');
            setTimeStats(res.data || { my_total_hours: 0, company_total_hours: 0 });
        } catch (error) {
            console.error("Failed to fetch time stats", error);
        }
    };

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const endpoint = viewMode === 'my' ? '/api/time' : '/api/time/all';
            const params = { month: selectedMonth, year: selectedYear };
            const res = await axios.get(endpoint, { params });
            setEntries(res.data);
        } catch (error) {
            showNotification("Failed to load time entries", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (values) => {
        try {
            const payload = {
                start_time: new Date(values.start_time).toISOString(),
                end_time: new Date(values.end_time).toISOString(),
                description: values.description.trim()
            };

            if (isEditing) {
                await axios.put(`/api/time/${isEditing}`, payload);
                showNotification("Time entry updated!", "success");
            } else {
                await axios.post('/api/time', payload);
                showNotification("Time entry saved!", "success");
            }

            closeModal();
            fetchEntries();
            fetchStats(); // Added to refresh dashboard tiles
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to save entry", "error");
        }
    };

    const handleDelete = (id) => {
        setDeleteConfirm({ isOpen: true, entryId: id });
    };

    const executeDelete = async () => {
        const { entryId } = deleteConfirm;
        try {
            await axios.delete(`/api/time/${entryId}`);
            showNotification("Entry deleted", "success");
            fetchEntries();
            fetchStats(); // Added to refresh dashboard tiles
        } catch (error) {
            showNotification("Failed to delete entry", "error");
        }
    };

    const openEditModal = (entry) => {
        setIsEditing(entry.id);
        const start = new Date(entry.start_time);
        const end = new Date(entry.end_time);

        const toLocalISO = (date) => {
            const tzOffset = date.getTimezoneOffset() * 60000;
            return new Date(date - tzOffset).toISOString().slice(0, 16);
        };

        form.reset({
            start_time: toLocalISO(start),
            end_time: toLocalISO(end),
            description: entry.description || '',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setIsEditing(null);
        form.reset();
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border-muted/30 pb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">Time Log</h1>
                    <p className="text-text-muted mt-2 font-medium">Verify and audit working contributions across the partnership.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-bg-surface rounded-xl p-1 border border-border-muted/30 w-full md:w-auto">
                        <Button
                            variant="ghost"
                            onClick={() => setViewMode('my')}
                            className={cn(
                                "flex-1 md:flex-none h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-lg transition-all",
                                viewMode === 'my' ? "bg-primary text-on-primary shadow-sm hover:bg-primary/90" : "text-text-muted hover:bg-bg-base"
                            )}
                        >
                            My Logs
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setViewMode('company')}
                            className={cn(
                                "flex-1 md:flex-none h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-lg transition-all",
                                viewMode === 'company' ? "bg-secondary text-on-secondary shadow-sm hover:bg-secondary/90" : "text-text-muted hover:bg-bg-base"
                            )}
                        >
                            Collective
                        </Button>
                    </div>
                    <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl h-12 flex-1 md:flex-none px-6 shadow-lg shadow-primary/20">
                        <Plus className="w-5 h-5 mr-2" />
                        Log Hours
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-primary/[0.03] border-primary/20 shadow-sm overflow-hidden group">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="ghost" className="bg-primary/10 text-primary uppercase font-black tracking-widest text-[9px] px-2">Individual Effort</Badge>
                            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <UserIcon className="w-4 h-4 text-primary" />
                            </div>
                        </div>
                        <CardTitle className="text-[10px] font-black text-primary uppercase tracking-widest mt-4">Personal Contributions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-4xl font-black text-text-main font-tabular">{(timeStats?.my_total_hours || 0).toFixed(1)} <small className="text-sm opacity-40">HRS</small></span>
                    </CardContent>
                </Card>

                <Card className="bg-secondary/[0.03] border-secondary/20 shadow-sm overflow-hidden group">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="ghost" className="bg-secondary/10 text-secondary uppercase font-black tracking-widest text-[9px] px-2">Collective Effort</Badge>
                            <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                                <Users className="w-4 h-4 text-secondary" />
                            </div>
                        </div>
                        <CardTitle className="text-[10px] font-black text-secondary uppercase tracking-widest mt-4">Total Partnership Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-4xl font-black text-text-main font-tabular">{(timeStats?.company_total_hours || 0).toFixed(1)} <small className="text-sm opacity-40">HRS</small></span>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-bg-surface p-4 rounded-2xl border border-border-muted/30 shadow-sm">
                <div className="flex items-center gap-3 flex-1 w-full">
                    <div className="flex items-center gap-2 bg-bg-base px-3 py-2 rounded-xl border border-border-muted/20 flex-1">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" />
                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="w-full border-none font-bold h-7 p-0 focus:ring-0 uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent className="bg-bg-surface border-border-muted">
                                {months.map((m, i) => (
                                    <SelectItem key={m} value={(i + 1).toString()} className="text-[10px] font-black uppercase tracking-widest">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 bg-bg-base px-3 py-2 rounded-xl border border-border-muted/20 flex-1">
                        <Activity className="w-3.5 h-3.5 text-text-muted" />
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-full border-none font-bold h-7 p-0 focus:ring-0 uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent className="bg-bg-surface border-border-muted">
                                {years.map(y => (
                                    <SelectItem key={y} value={y.toString()} className="text-[10px] font-black uppercase tracking-widest">{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="text-[9px] text-text-muted font-black uppercase tracking-[0.2em] whitespace-nowrap sm:pr-2">
                    Auditing {entries.length} logs
                </div>
            </div>

            <Card className="bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm">
                {/* Mobile Entry View */}
                <div className="md:hidden divide-y divide-border-muted/10">
                    {entries.map((entry) => (
                        <div key={entry.id} className="p-4 flex flex-col gap-3 hover:bg-primary/[0.02] transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary border border-primary/20">
                                        {entry.partner_name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-[11px] font-black text-text-main uppercase tracking-tighter">{entry.partner_name}</span>
                                </div>
                                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-black font-tabular text-[10px] h-6 rounded-md">
                                    {(entry.hours || 0).toFixed(1)}h
                                </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-text-main">{new Date(entry.start_time).toLocaleDateString()}</span>
                                    <span className="text-[8px] text-text-muted font-black uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!entry.is_closed && (isAdmin || entry.user_id === currentUserId) ? (
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(entry)} className="w-8 h-8 rounded-lg hover:bg-bg-base">
                                                <Edit2 className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-destructive">
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ) : entry.is_closed && (
                                        <Lock className="w-3 h-3 text-text-muted/30" />
                                    )}
                                </div>
                            </div>
                            
                            {entry.description && (
                                <p className="text-[10px] text-text-muted font-medium bg-bg-base/50 p-2 rounded-lg italic">
                                    "{entry.description}"
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-bg-base/50">
                            <TableRow className="hover:bg-transparent border-border-muted/10">
                                <TableHead className={cn("px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted", viewMode === 'my' && "hidden lg:table-cell")}>Partner</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Interval</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Hrs</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted hidden xl:table-cell">Activity Description</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted hidden sm:table-cell">State</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry) => (
                                <TableRow key={entry.id} className="hover:bg-primary/[0.02] border-border-muted/10 transition-colors group">
                                    <TableCell className={cn("px-6 py-5", viewMode === 'my' && "hidden lg:table-cell")}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
                                                {entry.partner_name?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-black text-text-main">{entry.partner_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-black text-text-main">{new Date(entry.start_time).toLocaleDateString()}</span>
                                            <span className="text-[9px] text-text-muted font-black uppercase tracking-widest flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5 text-right">
                                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-black font-tabular text-sm px-2 h-7 rounded-lg">
                                            {(entry.hours || 0).toFixed(1)}h
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-6 py-5 hidden xl:table-cell">
                                        <p className="text-xs text-text-muted font-medium line-clamp-1 max-w-[200px]" title={entry.description}>
                                            {entry.description || 'N/A'}
                                        </p>
                                    </TableCell>
                                    <TableCell className="px-6 py-5 hidden sm:table-cell">
                                        <div className="flex items-center gap-2">
                                            {entry.is_closed ? (
                                                <Badge className="bg-bg-base text-text-muted border-border-muted font-black text-[9px] tracking-widest h-6 rounded-md">
                                                    <Lock className="w-2.5 h-2.5 mr-1" /> Locked
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[9px] tracking-widest h-6 rounded-md">
                                                    <Unlock className="w-2.5 h-2.5 mr-1" /> Open
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5 text-right">
                                        {!entry.is_closed && (isAdmin || entry.user_id === currentUserId) ? (
                                            <div className="flex items-center justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditModal(entry)}
                                                    className="w-9 h-9 rounded-xl hover:bg-bg-base hover:text-primary"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="w-9 h-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ) : entry.is_closed && (
                                            <div className="flex justify-end opacity-20">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {entries.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <History className="w-12 h-12 text-text-muted" />
                                            <p className="text-text-muted font-bold uppercase tracking-widest text-xs">No entries found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center">
                                        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Dialog open={showModal} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent className="max-w-[95vw] sm:max-w-md bg-bg-surface border-border-muted/50 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">
                            {isEditing ? 'Modify Entry' : 'Log Labour'}
                        </DialogTitle>
                        <DialogDescription className="text-text-muted font-medium">
                            Record your contributions to the partnership for audit purposes.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="start_time"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Start Interval</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <Input
                                                        type="datetime-local"
                                                        max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                                        {...field}
                                                        onClick={(e) => e.target.showPicker?.()}
                                                        className="bg-bg-base border-border-muted font-bold h-11 pr-10"
                                                    />
                                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary pointer-events-none" />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="end_time"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">End Interval</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <Input
                                                        type="datetime-local"
                                                        max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                                        {...field}
                                                        onClick={(e) => e.target.showPicker?.()}
                                                        className="bg-bg-base border-border-muted font-bold h-11 pr-10"
                                                    />
                                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary pointer-events-none" />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Activity Summary</FormLabel>
                                        <FormControl>
                                            <textarea
                                                className="flex min-h-[120px] w-full rounded-xl border border-border-muted bg-bg-base px-4 py-3 text-sm font-medium ring-offset-background placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all"
                                                placeholder="Briefly describe your contribution..."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px] font-medium text-text-muted italic">Max 15 hours per entry for security compliance.</FormDescription>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter className="gap-3">
                                <Button type="button" variant="ghost" onClick={closeModal} className="flex-1 h-12 font-black rounded-xl">Cancel</Button>
                                <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary flex-1 h-12 font-black rounded-xl shadow-lg shadow-primary/20 uppercase tracking-widest text-[11px]">
                                    {isEditing ? 'Update Entry' : 'Seal Entry'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, isOpen: open }))}
                title="Delete Time Entry"
                description="Are you sure you want to delete this time entry? This action cannot be undone."
                confirmText="Delete Entry"
                variant="destructive"
                onConfirm={executeDelete}
            />
        </div>
    );
};

export default TimeLog;
