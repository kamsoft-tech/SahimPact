import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import { 
    Banknote, TrendingUp, Receipt, Heart, ShieldCheck, Users, 
    Building2, UserRound, FileSignature, Eye, X, History, 
    TrendingDown, Calendar as CalendarIcon, Info, ChevronRight,
    Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const closePeriodSchema = z.object({
    negligent_user_id: z.string().optional().nullable(),
});

const ThePulse = () => {
    const { role, company_id } = useAuth();
    const { logo_url } = useBranding();
    const [stats, setStats] = useState({
        total_revenue: 0,
        total_expenses: 0,
        net_profit: 0,
        active_partners: 0
    });
    const [contingency, setContingency] = useState({ balance: 0, minimum: 10000 });
    const [charityFund, setCharityFund] = useState({ balance: 0 });
    const [reports, setReports] = useState([]);
    const [forecast, setForecast] = useState({ net_profit: 0, partners: [], contingency_allocation: 0, global_charity: 0 });
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [filterMode, setFilterMode] = useState('current'); 
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const { showNotification } = useNotification();
    const [isLoading, setIsLoading] = useState(true);
    const [isProposingClose, setIsProposingClose] = useState(false);

    const form = useForm({
        resolver: zodResolver(closePeriodSchema),
        defaultValues: {
            negligent_user_id: "",
        }
    });

    useEffect(() => {
        fetchPulseData();
    }, [filterMode, selectedMonth, selectedYear]);

    const fetchPulseData = async () => {
        setIsLoading(true);
        try {
            const params = { month: selectedMonth, year: selectedYear };
            const [statsRes, contRes, settingsRes, reportsRes, forecastRes, charityRes] = await Promise.all([
                axios.get('/api/ledger/stats', { params }),
                axios.get('/api/distribution/contingency-balance'),
                axios.get('/api/settings'),
                axios.get('/api/distribution/reports'),
                axios.get('/api/distribution/forecast', { params }),
                axios.get('/api/distribution/charity-balance', { params })
            ]);
            setStats(statsRes.data);
            setContingency({ 
                balance: contRes.data.balance || 0, 
                minimum: settingsRes.data.contingency_pot_minimum || 10000 
            });
            setCharityFund({ balance: charityRes.data.balance || 0 });
            setReports(reportsRes.data);
            setForecast(forecastRes.data);
        } catch (error) {
            console.error("Failed to fetch Pulse data", error);
            showNotification("Failed to fetch dashboard data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleProposePeriodClose = async (values) => {
        setIsProposingClose(true);
        setShowCloseConfirmModal(false);
        try {
            await axios.post('/api/agreements/propose-close', {
                negligent_user_id: values.negligent_user_id ? parseInt(values.negligent_user_id) : null
            });
            showNotification("Period close agreement proposed! All partners must sign off to finalize.", "success");
            fetchPulseData();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to propose period close", "error");
        } finally {
            setIsProposingClose(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-text-muted font-brand font-bold animate-pulse tracking-widest uppercase text-xs">Synchronizing Pulse...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 md:gap-8 animate-slide-in p-4 md:p-8 max-w-7xl mx-auto font-data">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-5">
                    {logo_url && (
                        <div className="p-2 bg-bg-surface border border-border-muted rounded-2xl shadow-inner">
                            <img src={logo_url} alt="Logo" className="w-12 h-12 object-contain" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-extrabold tracking-tight font-brand text-text-main">The Pulse</h1>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black tracking-widest px-2 py-0">LIVE</Badge>
                        </div>
                        <p className="text-text-muted text-sm mt-1">
                            {role === 'SUPER_ADMIN' ? 'Global System Monitoring & Governance' : 'Real-time financial performance and equity projections.'}
                            {company_name && <span className="ml-2 text-[10px] font-black text-primary uppercase tracking-[0.1em] border-l border-border-muted/30 pl-2">{company_name}</span>}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-bg-surface/50 p-1.5 rounded-2xl border border-border-muted shadow-xl backdrop-blur-sm">
                    <Button 
                        variant={filterMode === 'current' ? 'primary' : 'ghost'}
                        onClick={() => setFilterMode('current')}
                        className={`rounded-xl px-6 h-10 ${filterMode === 'current' ? 'shadow-lg shadow-primary/20' : ''}`}
                    >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Live
                    </Button>
                    <Button 
                        variant={filterMode === 'period' ? 'primary' : 'ghost'}
                        onClick={() => setFilterMode('period')}
                        className={`rounded-xl px-6 h-10 ${filterMode === 'period' ? 'shadow-lg shadow-primary/20' : ''}`}
                    >
                        <History className="w-4 h-4 mr-2" />
                        Historical
                    </Button>
                    
                    {filterMode === 'period' && (
                        <div className="flex items-center gap-2 pl-3 border-l border-border-muted ml-1">
                            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-[130px] bg-transparent border-none focus:ring-0 font-bold text-sm h-10">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent className="bg-bg-surface border-border-muted">
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger className="w-[90px] bg-transparent border-none focus:ring-0 font-bold text-sm h-10">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent className="bg-bg-surface border-border-muted">
                                    {[2024, 2025, 2026].map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                <Card className="bg-bg-surface border-border-muted hover:border-primary/50 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Total Revenue</CardTitle>
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <Banknote className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-text-main font-tabular">£{(stats?.total_revenue || 0).toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card className="bg-bg-surface border-border-muted hover:border-primary/50 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Net Profit</CardTitle>
                        <div className={`p-2 rounded-lg transition-colors ${stats?.net_profit < 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary'}`}>
                            {stats?.net_profit < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-extrabold font-tabular ${stats?.net_profit < 0 ? 'text-destructive' : 'text-primary'}`}>
                            £{(stats?.net_profit || 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-bg-surface border-border-muted hover:border-destructive/50 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Total Expenses</CardTitle>
                        <div className="p-2 rounded-lg bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-white transition-colors">
                            <Receipt className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-text-main font-tabular">£{(stats?.total_expenses || 0).toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card className="bg-bg-surface border-border-muted hover:border-primary/50 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Charity Fund</CardTitle>
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <Heart className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-text-main font-tabular">£{(charityFund.balance || 0).toLocaleString()}</div>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="bg-primary/5 text-primary text-[10px] font-bold">
                                +£{(forecast?.global_charity || 0).toLocaleString()} Forecast
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-bg-surface border-border-muted hover:border-secondary/50 transition-all group border-l-4 border-l-secondary/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Contingency Pot</CardTitle>
                        <div className={`p-2 rounded-lg transition-colors ${contingency.balance >= contingency.minimum ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-text-main font-tabular">£{(contingency?.balance || 0).toLocaleString()}</div>
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                <span className="text-text-muted">Progress to £{contingency.minimum.toLocaleString()}</span>
                                <span className={contingency.balance >= contingency.minimum ? 'text-primary' : 'text-secondary'}>
                                    {Math.round((contingency.balance / (contingency.minimum || 1)) * 100)}%
                                </span>
                            </div>
                            <Progress 
                                value={Math.min(100, (contingency.balance / (contingency.minimum || 1)) * 100)} 
                                className="h-1.5"
                                indicatorClassName={contingency.balance >= contingency.minimum ? 'bg-primary' : 'bg-secondary'}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-bg-surface border-border-muted hover:border-primary/50 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Team Hours</CardTitle>
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <Users className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-text-main font-tabular">{forecast?.total_hours_logged || 0}</div>
                        <p className="text-[10px] text-text-muted mt-1 uppercase font-bold tracking-widest">Logged this period</p>
                    </CardContent>
                </Card>

                {role === 'SUPER_ADMIN' && (
                    <>
                        <Card className="bg-bg-surface border-border-muted hover:border-secondary/50 transition-all group border-l-4 border-l-secondary/40">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Total Companies</CardTitle>
                                <div className="p-2 rounded-lg bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-extrabold text-text-main font-tabular">{stats?.company_count || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-bg-surface border-border-muted hover:border-secondary/50 transition-all group border-l-4 border-l-secondary/40">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">System Users</CardTitle>
                                <div className="p-2 rounded-lg bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                                    <UserRound className="w-5 h-5" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-extrabold text-text-main font-tabular">{stats?.user_count || 0}</div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Forecast Section */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-primary" />
                            <h2 className="text-2xl font-extrabold text-text-main font-brand uppercase tracking-tighter">Current Period Forecast</h2>
                        </div>
                        <p className="text-sm text-text-muted">Real-time equity projection based on unclosed transactions.</p>
                    </div>
                    <Card className="bg-primary/5 border-primary/20 shadow-xl shadow-primary/5">
                        <CardContent className="p-4 md:p-6 text-right">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] block mb-1">Distributable Profit</span>
                            <span className="text-3xl font-black text-text-main font-tabular">£{(forecast?.distributable_profit || 0).toLocaleString()}</span>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border-muted/50 bg-bg-surface overflow-hidden shadow-2xl">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                        <TableHeader className="bg-bg-base/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[10px] font-black text-text-muted uppercase tracking-[0.25em] h-14">Partner</TableHead>
                                <TableHead className="text-[10px] font-black text-text-muted uppercase tracking-[0.25em] text-right h-14">Hours</TableHead>
                                <TableHead className="text-[10px] font-black text-text-muted uppercase tracking-[0.25em] text-right h-14">Gross Share</TableHead>
                                <TableHead className="text-[10px] font-black text-secondary uppercase tracking-[0.25em] text-right h-14">Vol. Charity</TableHead>
                                <TableHead className="text-[10px] font-black text-primary uppercase tracking-[0.25em] text-right h-14">Net Share</TableHead>
                                <TableHead className="text-[10px] font-black text-text-muted uppercase tracking-[0.25em] text-right h-14">Expenses</TableHead>
                                <TableHead className="text-[10px] font-black text-text-main uppercase tracking-[0.25em] text-right h-14">Total Est.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {forecast.partners.map((p, i) => (
                                <TableRow key={i} className="hover:bg-primary/[0.03] transition-colors border-border-muted/20">
                                    <TableCell className="font-black text-text-main font-brand">{p.partner_name}</TableCell>
                                    <TableCell className="text-right font-tabular text-text-muted">{(p.hours || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-tabular text-text-muted">£{(p?.gross_payout || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-black font-tabular text-secondary">£{(p?.voluntary_charity || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-black font-tabular text-primary">£{(p?.forecasted_share || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-tabular text-text-muted">£{(p?.reimbursements || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-black font-tabular text-text-main bg-primary/[0.02]">£{(p?.total_estimated || 0).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-border-muted/10">
                        {forecast.partners.map((p, i) => (
                            <div key={i} className="p-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black text-text-main font-brand">{p.partner_name}</h3>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Net Share</span>
                                        <span className="font-black text-primary font-tabular text-lg">£{(p?.forecasted_share || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 bg-bg-base/40 p-3 rounded-xl border border-border-muted/10">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block">Hours</span>
                                        <span className="font-bold font-tabular text-sm">{(p.hours || 0).toFixed(2)} hrs</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-secondary uppercase tracking-widest block">Vol. Charity</span>
                                        <span className="font-bold font-tabular text-sm text-secondary">£{(p?.voluntary_charity || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block">Expenses</span>
                                        <span className="font-bold font-tabular text-sm">£{(p?.reimbursements || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-text-main uppercase tracking-widest block">Total Estimated</span>
                                        <span className="font-black font-tabular text-sm">£{(p?.total_estimated || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-bg-base/30 p-4 border-t border-border-muted/50 flex justify-between items-center">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Contingency Allocation (Re-investment)</span>
                        <span className="font-black text-secondary font-tabular text-lg">£{(forecast?.contingency_allocation || 0).toLocaleString()}</span>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
                <div>
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-secondary" />
                        <h2 className="text-xl md:text-2xl font-extrabold text-text-main font-brand uppercase tracking-tighter">Agreement Ledger</h2>
                    </div>
                    <p className="text-sm text-text-muted mt-1">Formal historical distributions locked and verified.</p>
                </div>
                
                <Dialog open={showCloseConfirmModal} onOpenChange={setShowCloseConfirmModal}>
                    <DialogTrigger asChild>
                        <Button disabled={isProposingClose} className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl px-6">
                            <FileSignature className="w-4 h-4 mr-2" />
                            {isProposingClose ? 'Proposing...' : 'Propose Period Close'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-bg-surface border-border-muted max-w-[95vw] sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-text-main font-brand uppercase tracking-tighter">Propose Period Close</DialogTitle>
                            <DialogDescription className="text-text-muted leading-relaxed">
                                This will create a formal agreement to lock the period. All partners must sign off before the distributions are finalized and transactions archived.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleProposePeriodClose)} className="space-y-6">
                                {forecast.distributable_profit < 0 && (
                                    <FormField
                                        control={form.control}
                                        name="negligent_user_id"
                                        render={({ field }) => (
                                            <FormItem className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                                                <FormLabel className="text-[10px] font-black text-destructive uppercase tracking-widest block mb-2">Identify Negligent Partner (Optional)</FormLabel>
                                                <p className="text-[10px] text-text-muted mb-3 leading-tight font-bold">If selected, this partner will carry 100% of the loss for this period.</p>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-bg-base border-border-muted text-text-main font-bold">
                                                            <SelectValue placeholder="No Negligence (Proportional Loss)" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-bg-surface border-border-muted">
                                                        <SelectItem value="">No Negligence (Proportional Loss)</SelectItem>
                                                        {forecast.partners.map(p => (
                                                            <SelectItem key={p.partner_user_id || p.partner_name} value={p.partner_user_id?.toString()}>
                                                                {p.partner_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <DialogFooter className="gap-3 sm:gap-0">
                                    <Button type="button" variant="ghost" onClick={() => setShowCloseConfirmModal(false)} className="font-black rounded-xl">Cancel</Button>
                                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl shadow-lg shadow-primary/20 flex-1">
                                        Send Proposal
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {reports.length === 0 ? (
                    <Card className="h-48 flex items-center justify-center border-dashed border-border-muted/50 bg-bg-surface/30 text-center">
                        <div className="space-y-2">
                            <Info className="w-8 h-8 text-text-muted mx-auto opacity-20" />
                            <p className="text-text-muted font-bold text-sm">No historical distributions found.<br/>Generate a report to lock the current period.</p>
                        </div>
                    </Card>
                ) : (
                    reports.map(report => (
                        <Card key={report.id} className="flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/40 transition-all border-l-4 border-l-primary/50 bg-bg-surface border-border-muted/50 overflow-hidden group">
                            <div className="p-6 pb-0 md:pb-6">
                                <h3 className="text-xl font-extrabold text-text-main font-brand">{report.period_name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <CalendarIcon className="w-3 h-3 text-text-muted" />
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Locked on {new Date(report.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-8 md:gap-12 text-right p-6 pt-0 md:pt-6 bg-bg-base/20 md:bg-transparent">
                                <div>
                                    <span className="text-[10px] text-text-muted uppercase font-black tracking-widest block mb-1">Profit Distributed</span>
                                    <span className="font-black text-text-main font-tabular text-lg">£{(report?.net_profit || 0).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-secondary uppercase font-black tracking-widest block mb-1">Total Charity</span>
                                    <span className="font-black text-secondary font-tabular text-lg">£{((report?.global_charity || 0) + (report?.voluntary_charity || 0)).toLocaleString()}</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedReport(report)} className="rounded-full hover:bg-primary/10 hover:text-primary transition-all">
                                    <Eye className="w-5 h-5" />
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Detailed Report Modal */}
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="bg-bg-surface border-border-muted max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader className="border-b border-border-muted/30 pb-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="text-3xl font-black text-text-main font-brand uppercase tracking-tighter">
                                    {selectedReport?.period_name}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-text-muted uppercase tracking-[0.2em]">
                                    Sealed on {selectedReport && new Date(selectedReport.created_at).toLocaleString()}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 my-6">
                        <div className="p-4 bg-bg-base/50 rounded-2xl border border-border-muted/20">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Gross Profit</p>
                            <p className="text-xl font-black text-text-main mt-1 font-tabular">£{(selectedReport?.net_profit || 0).toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/20">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Contingency</p>
                            <p className="text-xl font-black text-secondary mt-1 font-tabular">
                                £{(selectedReport?.report_data?.contingency_pot_allocation || 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Global Charity</p>
                            <p className="text-xl font-black text-primary mt-1 font-tabular">£{(selectedReport?.global_charity || 0).toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Vol. Charity</p>
                            <p className="text-xl font-black text-primary mt-1 font-tabular">£{(selectedReport?.voluntary_charity || 0).toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-bg-base/50 rounded-2xl border border-border-muted/20">
                            <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Distributed</p>
                            <p className="text-xl font-black text-text-main mt-1 font-tabular">
                                £{((selectedReport?.report_data?.distributable_net_profit || selectedReport?.net_profit || 0) - (selectedReport?.global_charity || 0)).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <Card className="border border-border-muted/50 bg-bg-base/30 overflow-hidden shadow-inner">
                        <div className="overflow-x-auto">
                            <Table>
                            <TableHeader className="bg-bg-base/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Partner</TableHead>
                                    <TableHead className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Capital £</TableHead>
                                    <TableHead className="p-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Labour £</TableHead>
                                    <TableHead className="p-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right">Charity £</TableHead>
                                    <TableHead className="p-4 text-[10px] font-black uppercase tracking-widest text-text-main text-right">Total Payout</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedReport?.report_data?.distributions?.map((dist, idx) => (
                                    <TableRow key={idx} className="hover:bg-primary/[0.02] border-border-muted/10">
                                        <TableCell className="p-4 font-black font-brand text-text-main whitespace-nowrap">
                                            {dist.partner_name || `Partner ${dist.user_id}`}
                                        </TableCell>
                                        <TableCell className="p-4 text-right font-tabular text-text-muted">£{(dist.capital_payout || 0).toLocaleString()}</TableCell>
                                        <TableCell className="p-4 text-right font-tabular text-text-muted">£{(dist.labor_payout || 0).toLocaleString()}</TableCell>
                                        <TableCell className="p-4 text-right font-black text-secondary font-tabular">£{(dist.voluntary_charity_amount || 0).toLocaleString()}</TableCell>
                                        <TableCell className="p-4 text-right font-black text-primary font-tabular bg-primary/[0.02]">
                                            £{(dist.total_payout || 0).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                    </Card>
                    
                    <DialogFooter>
                        <Button onClick={() => setSelectedReport(null)} className="bg-primary hover:bg-primary/90 text-on-primary font-black rounded-xl w-full h-12">
                            Close Report View
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ThePulse;
