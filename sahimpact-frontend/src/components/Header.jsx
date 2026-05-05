import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';
import { useBranding } from '../context/BrandingContext';
import { 
    Bell, 
    Menu, 
    FileText, 
    ArrowRight, 
    CheckCircle2, 
    CircleDashed,
    Building2
} from "lucide-react";
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const Header = ({ title, onMenuToggle }) => {
    const { user } = useAuth();
    const { company_name } = useBranding();
    const { showNotification } = useNotification();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingTxs, setPendingTxs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAgreement, setPendingAgreement] = useState(null);

    const fetchPending = async () => {
        try {
            const [countRes, listRes, agreementRes] = await Promise.all([
                axios.get('/api/ledger/pending/count'),
                axios.get('/api/ledger/pending'),
                axios.get('/api/agreements/pending')
            ]);
            setPendingCount(countRes.data.count);
            setPendingTxs(listRes.data);
            setPendingAgreement(agreementRes.data);
        } catch (error) {
            console.error("Failed to fetch pending notifications", error);
        }
    };

    useEffect(() => {
        fetchPending();
        const interval = setInterval(fetchPending, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (id, action) => {
        setIsLoading(true);
        try {
            if (action === 'approve') {
                await axios.put(`/api/ledger/${id}/approve`);
                showNotification("Transaction approved", "success");
            } else {
                await axios.delete(`/api/ledger/${id}/reject`);
                showNotification("Transaction rejected", "info");
            }
            fetchPending();
            window.dispatchEvent(new CustomEvent('ledgerUpdate'));
        } catch (error) {
            showNotification("Action failed", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const totalActions = pendingCount + (pendingAgreement ? 1 : 0);

    return (
        <header className="bg-bg-surface/80 backdrop-blur-xl h-16 border-b border-border-muted/30 sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 transition-all">
            <div className="flex items-center gap-4">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onMenuToggle}
                    className="md:hidden text-text-muted hover:text-text-main"
                >
                    <Menu className="w-5 h-5" />
                </Button>
                <div className="flex flex-col">
                    <h2 className="text-sm font-black text-text-main font-brand uppercase tracking-widest truncate">{title}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <Building2 className="w-3 h-3 text-primary" />
                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">{company_name}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                                "relative rounded-xl hover:bg-bg-base transition-all duration-300",
                                totalActions > 0 ? "text-primary bg-primary/5" : "text-text-muted"
                            )}
                        >
                            <Bell className={cn("w-5 h-5", totalActions > 0 && "animate-in zoom-in duration-300")} />
                            {totalActions > 0 && (
                                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground font-black text-[10px] border-2 border-bg-surface rounded-full shadow-lg">
                                    {totalActions}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 bg-bg-surface border-border-muted/50 shadow-2xl rounded-2xl overflow-hidden" align="end">
                        <div className="p-4 border-b border-border-muted/10 bg-bg-base/30 flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Action Queue</h3>
                            <Badge variant="secondary" className="font-black text-[10px] bg-secondary/10 text-secondary border-none">
                                {totalActions} Items
                            </Badge>
                        </div>
                        <ScrollArea className="max-h-[400px]">
                            <div className="p-2 space-y-1">
                                {pendingAgreement && (
                                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                                        <div className="flex gap-3 items-start mb-3">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-[11px] font-black text-primary uppercase tracking-tight">Legal Execution Required</h4>
                                                <p className="text-[10px] text-text-muted mt-0.5 leading-tight font-medium">New Partnership Agreement requires cryptographic signature.</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm"
                                            onClick={() => window.location.href = '/partnerships?agreement=true'}
                                            className="w-full bg-primary hover:bg-primary/90 text-on-primary font-black text-[10px] uppercase tracking-widest h-8 rounded-lg"
                                        >
                                            Review Agreement <ArrowRight className="ml-2 w-3 h-3" />
                                        </Button>
                                    </div>
                                )}

                                {pendingTxs.length === 0 && !pendingAgreement ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                                        <div className="w-12 h-12 rounded-full bg-bg-base flex items-center justify-center mb-3">
                                            <CheckCircle2 className="w-6 h-6 text-text-muted/20" />
                                        </div>
                                        <p className="text-xs font-black text-text-muted/40 uppercase tracking-widest">Nexus Clean</p>
                                    </div>
                                ) : (
                                    pendingTxs.map(tx => (
                                        <div key={tx.id} className="p-3 hover:bg-bg-base/50 rounded-xl transition-all border border-transparent hover:border-border-muted/10">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[9px] font-black text-text-muted/60 uppercase tracking-widest">{tx.date}</span>
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] font-black px-1.5 h-5 border-none",
                                                    tx.type === 'sales' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                                                )}>
                                                    £{tx.amount.toLocaleString()}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] font-medium text-text-main line-clamp-2 mb-3 bg-bg-base/30 p-2 rounded-lg">{tx.description}</p>
                                            <div className="flex gap-2">
                                                <Button 
                                                    size="sm"
                                                    disabled={isLoading}
                                                    onClick={() => handleAction(tx.id, 'approve')}
                                                    className="flex-1 h-8 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-black uppercase tracking-widest rounded-lg border-none"
                                                >
                                                    {isLoading ? <CircleDashed className="w-3 h-3 animate-spin" /> : "Authorize"}
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    disabled={isLoading}
                                                    variant="ghost"
                                                    onClick={() => handleAction(tx.id, 'reject')}
                                                    className="flex-1 h-8 text-destructive hover:bg-destructive/10 text-[10px] font-black uppercase tracking-widest rounded-lg"
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>

                <div className="flex items-center gap-3 pl-4 border-l border-border-muted/30 h-8">
                    <div className="flex flex-col items-end hidden sm:flex">
                        <span className="text-[11px] font-black text-text-main uppercase tracking-tight">
                            {user?.full_name || user?.username || localStorage.getItem('username')}
                        </span>
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.2em] h-4 px-1.5 bg-bg-base/50 border-border-muted/20 text-text-muted/80">
                            {user?.role || 'Operator'}
                        </Badge>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-bg-surface border border-border-muted/30 shadow-sm flex items-center justify-center text-primary font-black relative overflow-hidden group cursor-pointer hover:border-primary/30 transition-all">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative z-10">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
