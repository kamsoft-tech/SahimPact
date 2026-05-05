import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import {
    CalendarIcon,
    RefreshCw,
    Heart,
    History,
    ArrowUpRight,
    Info,
    Loader2,
    Calendar as CalendarIconLucide,
    ShieldCheck
} from "lucide-react";

import ConfirmDialog from "@/components/ui/confirm-dialog";

import { Button } from "@/components/ui/button";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const payoutSchema = z.object({
    amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: "Amount must be a positive number",
    }),
    description: z.string().min(1, "Recipient / Cause is required"),
    date: z.date({
        required_error: "A date of payout is required.",
    }),
});

const CharityManagement = () => {
    const { showNotification } = useNotification();
    const [balance, setBalance] = useState(0);
    const [payouts, setPayouts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [payoutConfirm, setPayoutConfirm] = useState({ isOpen: false, data: null });

    const form = useForm({
        resolver: zodResolver(payoutSchema),
        defaultValues: {
            amount: "",
            description: "",
            date: new Date(),
        },
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [balRes, payRes] = await Promise.all([
                axios.get(`/api/distribution/charity-balance?t=${Date.now()}`),
                axios.get(`/api/distribution/charity-payouts?t=${Date.now()}`)
            ]);
            setBalance(balRes.data.balance || 0);
            setPayouts(payRes.data || []);
        } catch (error) {
            showNotification('Failed to fetch charity data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = (values) => {
        if (parseFloat(values.amount) > balance) {
            showNotification('Insufficient charity funds', 'error');
            return;
        }
        setPayoutConfirm({ isOpen: true, data: values });
    };

    const executePayout = async () => {
        const values = payoutConfirm.data;
        try {
            await axios.post('/api/distribution/charity-payout', {
                amount: parseFloat(values.amount),
                description: values.description,
                date: format(values.date, "yyyy-MM-dd")
            });
            showNotification('Charity payout recorded successfully', 'success');
            form.reset();
            fetchData();
        } catch (error) {
            showNotification('Failed to record payout', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="border-b border-border-muted/30 pb-8">
                <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">Charity Fund Management</h1>
                <p className="text-text-muted mt-2 font-medium">Global governance of charitable distributions and social impact reserves.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Balance & Record Payout */}
                <div className="lg:col-span-1 flex flex-col gap-8">
                    <Card className="bg-primary text-on-primary shadow-2xl shadow-primary/20 border-none overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                            <Heart className="w-24 h-24" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Available Impact Reserve</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <h2 className="text-5xl font-black font-tabular tracking-tighter">£{balance.toLocaleString()}</h2>
                        </CardContent>
                        <CardFooter className="bg-black/10 py-3">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Locked in SahimPact Vault
                            </p>
                        </CardFooter>
                    </Card>

                    <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <ArrowUpRight className="w-5 h-5" />
                                </div>
                                <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Record Payout</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Recipient / Cause</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. UNICEF Donation" {...field} className="bg-bg-base border-border-muted font-bold h-12" />
                                                </FormControl>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Distribution Amount (£)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" placeholder="0.00" {...field} className="bg-bg-base border-border-muted font-black text-xl h-14 font-tabular" />
                                                </FormControl>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-text-muted">Transaction Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full h-12 pl-3 text-left font-bold bg-bg-base border-border-muted hover:bg-bg-base/80",
                                                                    !field.value && "text-text-muted"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, "PPP")
                                                                ) : (
                                                                    <span>Select date</span>
                                                                )}
                                                                <CalendarIconLucide className="ml-auto h-4 w-4 text-text-muted" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 bg-bg-surface border-border-muted" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value}
                                                            onSelect={field.onChange}
                                                            disabled={(date) =>
                                                                date > new Date() || date < new Date("1900-01-01")
                                                            }
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage className="text-[10px] font-bold" />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                        <p className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <Info className="w-3 h-3" /> Reserve Constraint
                                        </p>
                                        <p className="text-[10px] text-text-muted font-bold">
                                            Payouts cannot exceed the total available reserve of £{balance.toLocaleString()}.
                                        </p>
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-primary text-on-primary hover:bg-primary/90 h-14 font-black uppercase tracking-widest text-base shadow-lg shadow-primary/20 rounded-xl"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize Distribution'}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                {/* History */}
                <div className="lg:col-span-2">
                    <Card className="h-full bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden flex flex-col">
                        <CardHeader className="bg-bg-base/30 border-b border-border-muted/10 flex flex-row items-center justify-between pb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                                    <History className="w-5 h-5" />
                                </div>
                                <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Impact History</CardTitle>
                            </div>
                            <Button variant="ghost" size="icon" onClick={fetchData} className="rounded-xl hover:bg-bg-base">
                                <RefreshCw className={cn("w-4 h-4 text-text-muted", isLoading && "animate-spin")} />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 flex-1">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-bg-base/50">
                                        <TableRow className="border-b border-border-muted/10 hover:bg-transparent">
                                            <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Timestamp</TableHead>
                                            <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Recipient / Cause</TableHead>
                                            <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payouts.length === 0 && !isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                                        <History className="w-12 h-12 text-text-muted" />
                                                        <p className="text-text-muted font-bold uppercase tracking-widest text-xs">No historical records.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            payouts.map((payout) => (
                                                <TableRow key={payout.id} className="hover:bg-primary/[0.02] border-border-muted/10 transition-colors group">
                                                    <TableCell className="px-6 py-5 text-xs font-bold text-text-muted font-tabular">
                                                        {new Date(payout.date).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5">
                                                        <span className="text-sm font-black text-text-main uppercase tracking-tight">{payout.description}</span>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-right">
                                                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-black font-tabular text-base px-3 h-9 rounded-lg">
                                                            £{payout.amount.toLocaleString()}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                        {isLoading && payouts.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-20 text-center">
                                                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <ConfirmDialog
                isOpen={payoutConfirm.isOpen}
                onOpenChange={(open) => setPayoutConfirm(prev => ({ ...prev, isOpen: open }))}
                title="Authorize Distribution"
                description={`Are you sure you want to authorize a distribution of £${payoutConfirm.data?.amount} for "${payoutConfirm.data?.description}"? This will be permanently recorded.`}
                confirmText="Authorize & Disburse"
                variant="default"
                onConfirm={executePayout}
            />
        </div>
    );
};

export default CharityManagement;
