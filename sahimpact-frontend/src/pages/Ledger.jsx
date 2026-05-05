import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
    Upload, 
    Plus, 
    Banknote, 
    ShoppingCart, 
    TrendingUp, 
    AlertTriangle, 
    Check, 
    Trash2, 
    FileText, 
    ArrowUpRight, 
    ArrowDownLeft,
    Calendar,
    Search,
    Loader2,
    Info,
    MoreVertical
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const manualEntrySchema = z.object({
    type: z.enum(["sales", "expense"]),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    description: z.string().min(3, "Description must be at least 3 characters"),
});

const Ledger = () => {
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({ total_revenue: 0, total_expenses: 0, net_profit: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [file, setFile] = useState(null);
    const [rejectConfirm, setRejectConfirm] = useState({ isOpen: false, txId: null });
    const { showNotification } = useNotification();

    const form = useForm({
        resolver: zodResolver(manualEntrySchema),
        defaultValues: {
            type: "expense",
            amount: "",
            description: "",
        },
    });

    useEffect(() => {
        fetchTransactions();
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/ledger/stats');
            setStats(res.data);
        } catch (error) {
            console.error("Failed to fetch stats", error);
        }
    };

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('/api/ledger');
            setTransactions(res.data);
        } catch (error) {
            console.error("Failed to fetch ledger", error);
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (data) => {
        try {
            await axios.post('/api/ledger', data);
            showNotification("Transaction logged successfully!", "success");
            setShowModal(false);
            form.reset();
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification("Failed to log transaction", "error");
        }
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            showNotification("Please select a file to upload.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setIsLoading(true);
            const res = await axios.post('/api/ingest/bank-statement', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showNotification(res.data.message || "CSV processed successfully!", "success");
            setShowUploadModal(false);
            setFile(null);
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to process CSV", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (txId) => {
        try {
            await axios.put(`/api/ledger/${txId}/approve`);
            showNotification("Transaction approved", "success");
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification("Failed to approve", "error");
        }
    };

    const handleReject = (txId) => {
        setRejectConfirm({ isOpen: true, txId });
    };

    const executeReject = async () => {
        const { txId } = rejectConfirm;
        try {
            await axios.delete(`/api/ledger/${txId}/reject`);
            showNotification("Transaction rejected", "success");
            fetchTransactions();
            fetchStats();
        } catch (error) {
            showNotification("Failed to reject", "error");
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-border-muted/30 pb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">Financial Ledger</h1>
                    <p className="text-text-muted mt-2 font-medium text-sm">Real-time oversight of company revenue, operating expenses, and cash flow.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-border-muted hover:bg-bg-base/50 font-black rounded-xl h-12 flex-1 md:flex-none px-6">
                                <Upload className="w-4 h-4 mr-2" />
                                Bank CSV
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-bg-surface border-border-muted max-w-[95vw] sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Import Statement</DialogTitle>
                                <DialogDescription className="text-text-muted">Upload a bank export to automatically generate ledger entries.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleFileUpload} className="space-y-6 py-4">
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Info className="w-3 h-3" /> System Capability
                                    </p>
                                    <p className="text-xs text-text-muted font-bold leading-relaxed">
                                        The AI ingestion engine will map bank columns and attempt to identify recurring transactions. All imported entries will start as "Pending" for your review.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Select CSV File</FormLabel>
                                    <Input 
                                        type="file" 
                                        accept=".csv"
                                        onChange={(e) => setFile(e.target.files[0])}
                                        className="bg-bg-base border-border-muted cursor-pointer font-bold h-11 pt-2"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setShowUploadModal(false)} className="font-black rounded-xl">Cancel</Button>
                                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl flex-1 h-11" disabled={!file || isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                        Start Import
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showModal} onOpenChange={setShowModal}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl h-12 flex-1 md:flex-none px-6 shadow-lg shadow-primary/20">
                                <Plus className="w-5 h-5 mr-2" />
                                Manual Entry
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-bg-surface border-border-muted max-w-[95vw] sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">New Ledger Entry</DialogTitle>
                                <DialogDescription className="text-text-muted">Record a single transaction with automatic double-entry mapping.</DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Transaction Type</FormLabel>
                                                <FormControl>
                                                    <Tabs defaultValue={field.value} onValueChange={field.onChange} className="w-full">
                                                        <TabsList className="grid w-full grid-cols-2 bg-bg-base h-12 p-1 border border-border-muted/30">
                                                            <TabsTrigger 
                                                                value="expense" 
                                                                className="data-[state=active]:bg-destructive data-[state=active]:text-white font-black uppercase tracking-widest text-[10px]"
                                                            >
                                                                Expense
                                                            </TabsTrigger>
                                                            <TabsTrigger 
                                                                value="sales" 
                                                                className="data-[state=active]:bg-primary data-[state=active]:text-on-primary font-black uppercase tracking-widest text-[10px]"
                                                            >
                                                                Revenue
                                                            </TabsTrigger>
                                                        </TabsList>
                                                    </Tabs>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Amount (£)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="number" placeholder="0.00" className="bg-bg-base border-border-muted font-black text-xl h-14 font-tabular" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Description</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="e.g. Domain Registration" className="bg-bg-base border-border-muted font-bold h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="p-4 bg-bg-base/50 rounded-xl border border-border-muted/10">
                                        <p className="text-[10px] text-text-muted font-bold italic">
                                            * This will debit the {form.watch('type') === 'sales' ? 'Cash' : 'Operating Expense'} account and credit {form.watch('type') === 'sales' ? 'Sales Revenue' : 'Cash'} in the underlying ledger.
                                        </p>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="font-black rounded-xl">Cancel</Button>
                                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl flex-1 h-11">Save Entry</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-primary/[0.03] border-primary/20 shadow-sm overflow-hidden group">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="ghost" className="bg-primary/10 text-primary uppercase font-black tracking-widest text-[9px] px-2">Cash Inflow</Badge>
                            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <Banknote className="w-4 h-4 text-primary" />
                            </div>
                        </div>
                        <CardTitle className="text-[10px] font-black text-primary uppercase tracking-widest mt-4">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-4xl font-black text-text-main font-tabular">£{stats.total_revenue.toLocaleString()}</span>
                    </CardContent>
                </Card>

                <Card className="bg-destructive/[0.03] border-destructive/20 shadow-sm overflow-hidden group">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="ghost" className="bg-destructive/10 text-destructive uppercase font-black tracking-widest text-[9px] px-2">Cash Outflow</Badge>
                            <div className="p-2 bg-destructive/10 rounded-lg group-hover:bg-destructive/20 transition-colors">
                                <ShoppingCart className="w-4 h-4 text-destructive" />
                            </div>
                        </div>
                        <CardTitle className="text-[10px] font-black text-destructive uppercase tracking-widest mt-4">Operating Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-4xl font-black text-text-main font-tabular">£{stats.total_expenses.toLocaleString()}</span>
                    </CardContent>
                </Card>

                <Card className="bg-secondary/[0.03] border-secondary/20 shadow-sm overflow-hidden group sm:col-span-2 lg:col-span-1">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="ghost" className="bg-secondary/10 text-secondary uppercase font-black tracking-widest text-[9px] px-2">Performance</Badge>
                            <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                                <TrendingUp className="w-4 h-4 text-secondary" />
                            </div>
                        </div>
                        <CardTitle className="text-[10px] font-black text-secondary uppercase tracking-widest mt-4">Net Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-4xl font-black text-secondary font-tabular">£{stats.net_profit.toLocaleString()}</span>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-bg-base/50">
                            <TableRow className="hover:bg-transparent border-border-muted/10">
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Date</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Description</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Type</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Amount</TableHead>
                                <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {transactions.map((tx) => (
                                <TableRow key={tx.id} className={cn(
                                    "hover:bg-primary/[0.02] border-border-muted/10 transition-colors group",
                                    tx.is_pending && "bg-secondary/[0.03] border-l-4 border-l-secondary"
                                )}>
                                    <TableCell className="px-6 py-5 text-xs font-bold text-text-muted font-tabular">
                                        {new Date(tx.date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-black text-text-main">{tx.description}</span>
                                            {tx.is_pending && (
                                                <Badge variant="ghost" className="w-fit h-5 text-[9px] font-black uppercase tracking-widest text-secondary bg-secondary/10 p-1 px-2 border border-secondary/20">
                                                    <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Pending Approval
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <Badge variant="outline" className={cn(
                                            "text-[9px] font-black uppercase tracking-widest rounded-md",
                                            tx.type === 'sales' ? 'border-primary/30 text-primary bg-primary/5' : 'border-destructive/30 text-destructive bg-destructive/5'
                                        )}>
                                            {tx.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={cn(
                                        "px-6 py-5 text-right font-black font-tabular text-base",
                                        tx.type === 'sales' ? 'text-primary' : 'text-text-main'
                                    )}>
                                        {tx.type === 'sales' ? '+' : '-'}£{tx.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="px-6 py-5 text-right">
                                        {tx.is_pending ? (
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={() => handleApprove(tx.id)}
                                                    className="w-9 h-9 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-on-primary shadow-sm"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={() => handleReject(tx.id)}
                                                    className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white shadow-sm"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="ghost" size="icon" className="w-9 h-9 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="w-4 h-4 text-text-muted" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden divide-y divide-border-muted/10">
                    {transactions.map((tx) => (
                        <div key={tx.id} className={cn(
                            "p-4 flex flex-col gap-4",
                            tx.is_pending && "bg-secondary/[0.03] border-l-4 border-l-secondary"
                        )}>
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-text-muted font-tabular">
                                        {new Date(tx.date).toLocaleDateString()}
                                    </span>
                                    <h3 className="text-sm font-black text-text-main leading-tight">{tx.description}</h3>
                                    {tx.is_pending && (
                                        <Badge variant="ghost" className="h-5 text-[9px] font-black uppercase tracking-widest text-secondary bg-secondary/10 p-1 px-2 border border-secondary/20">
                                            Pending Approval
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className={cn(
                                        "font-black font-tabular text-lg",
                                        tx.type === 'sales' ? 'text-primary' : 'text-text-main'
                                    )}>
                                        {tx.type === 'sales' ? '+' : '-'}£{tx.amount.toLocaleString()}
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "text-[8px] font-black uppercase tracking-widest rounded-md mt-1",
                                        tx.type === 'sales' ? 'border-primary/30 text-primary bg-primary/5' : 'border-destructive/30 text-destructive bg-destructive/5'
                                    )}>
                                        {tx.type}
                                    </Badge>
                                </div>
                            </div>
                            
                            {tx.is_pending && (
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={() => handleApprove(tx.id)}
                                        className="flex-1 rounded-xl bg-primary text-on-primary font-black text-[10px] uppercase tracking-widest h-10"
                                    >
                                        <Check className="w-3.5 h-3.5 mr-2" /> Approve
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        onClick={() => handleReject(tx.id)}
                                        className="flex-1 rounded-xl border-destructive/20 text-destructive font-black text-[10px] uppercase tracking-widest h-10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Reject
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {transactions.length === 0 && !isLoading && (
                    <div className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-30">
                            <FileText className="w-12 h-12 text-text-muted" />
                            <p className="text-text-muted font-bold uppercase tracking-widest text-xs">No records found.</p>
                        </div>
                    </div>
                )}
                
                {isLoading && (
                    <div className="py-20 text-center">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                    </div>
                )}
            </Card>
            <ConfirmDialog
                isOpen={rejectConfirm.isOpen}
                onOpenChange={(open) => setRejectConfirm(prev => ({ ...prev, isOpen: open }))}
                title="Reject Transaction"
                description="Are you sure you want to reject and delete this pending transaction? This action cannot be undone."
                confirmText="Reject & Delete"
                variant="destructive"
                onConfirm={executeReject}
            />
        </div>
    );
};

export default Ledger;
