import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, 
    Users, 
    UserX, 
    Handshake, 
    PlusCircle, 
    UserPlus, 
    Activity, 
    Database, 
    ChevronRight,
    Loader2,
    ShieldCheck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SuperDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        total_companies: 0,
        total_users: 0,
        total_transactions: 0,
        active_partners: 0,
        orphaned_partners: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/api/admin/stats');
                const orphansRes = await axios.get('/api/companies/orphaned-partners');
                setStats({
                    ...res.data,
                    orphaned_partners: orphansRes.data.length
                });
            } catch (error) {
                console.error("Failed to fetch system stats", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const cards = [
        { title: 'Registered Companies', value: stats.total_companies, icon: Building2, color: 'primary', description: 'Total onboarded enterprises' },
        { title: 'Global User Base', value: stats.total_users, icon: Users, color: 'secondary', description: 'Across all business units' },
        { title: 'Orphaned Records', value: stats.orphaned_partners, icon: UserX, color: 'destructive', description: 'Partners awaiting assignment' },
        { title: 'Active Partners', value: stats.active_partners, icon: Handshake, color: 'primary', description: 'Engaged equity holders' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="border-b border-border-muted/30 pb-8">
                <h1 className="text-4xl font-black text-text-main font-brand uppercase tracking-tighter">System Intelligence</h1>
                <p className="text-text-muted mt-2 font-medium">Global governance monitoring and multi-tenant administrative oversight.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, index) => (
                    <Card key={index} className="group hover:border-primary/40 transition-all duration-300 bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className={cn(
                                    "p-3 rounded-2xl transition-colors duration-300",
                                    card.color === 'primary' ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary' :
                                    card.color === 'secondary' ? 'bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary' :
                                    'bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-white'
                                )}>
                                    <card.icon className="w-5 h-5" />
                                </div>
                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-border-muted/30">Live</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">{card.title}</h3>
                            <p className="text-4xl font-black text-text-main font-tabular">{card.value}</p>
                            <p className="text-[10px] text-text-muted/60 font-bold mt-2">{card.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                        <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Command Center</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Direct actions for infrastructure management</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Button 
                                variant="outline"
                                onClick={() => navigate('/config?tab=companies')}
                                className="h-auto p-6 border-border-muted/50 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-start gap-4 transition-all group rounded-2xl"
                            >
                                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <PlusCircle className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-text-main uppercase tracking-tight">Onboard Company</p>
                                    <p className="text-[10px] text-text-muted font-bold">Initialize a new enterprise tenant.</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
                            </Button>

                            <Button 
                                variant="outline"
                                onClick={() => navigate('/config?tab=orphans')}
                                className="h-auto p-6 border-border-muted/50 hover:border-destructive/30 hover:bg-destructive/[0.02] flex flex-col items-start gap-4 transition-all group rounded-2xl"
                            >
                                <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <UserX className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-text-main uppercase tracking-tight">Resolve Orphans</p>
                                    <p className="text-[10px] text-text-muted font-bold">Re-link unassigned partner records.</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
                            </Button>

                            <Button 
                                variant="outline"
                                onClick={() => navigate('/config?tab=companies')}
                                className="h-auto p-6 border-border-muted/50 hover:border-secondary/30 hover:bg-secondary/[0.02] flex flex-col items-start gap-4 transition-all group rounded-2xl"
                            >
                                <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <UserPlus className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-text-main uppercase tracking-tight">Admin Governance</p>
                                    <p className="text-[10px] text-text-muted font-bold">Manage credentials for company owners.</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
                            </Button>

                            <Button 
                                variant="outline"
                                className="h-auto p-6 border-border-muted/50 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-start gap-4 transition-all group rounded-2xl opacity-50 cursor-not-allowed"
                            >
                                <div className="w-12 h-12 rounded-xl bg-bg-base text-text-muted flex items-center justify-center">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-text-muted uppercase tracking-tight">Audit Logs</p>
                                    <p className="text-[10px] text-text-muted font-bold">Immutable system change record.</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                        <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Core Services</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Real-time infrastructure health</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-base/50 border border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-black text-text-main uppercase tracking-tight">API Gateway</span>
                            </div>
                            <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] tracking-widest h-6 px-3">ACTIVE</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-base/50 border border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Database className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-black text-text-main uppercase tracking-tight">PostgreSQL Cluster</span>
                            </div>
                            <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] tracking-widest h-6 px-3">ACTIVE</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-base/50 border border-border-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-black text-text-main uppercase tracking-tight">Identity Provider</span>
                            </div>
                            <Badge className="bg-secondary/20 text-secondary border-none font-black text-[9px] tracking-widest h-6 px-3">SECURE</Badge>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-bg-base/10 border-t border-border-muted/5 p-4">
                        <p className="text-[9px] text-text-muted font-black uppercase tracking-[0.3em] w-full text-center">System uptime: 99.99%</p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default SuperDashboard;
