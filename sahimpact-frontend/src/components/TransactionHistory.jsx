import React, { useState } from 'react'
import { 
    Edit2, 
    Trash2, 
    Check, 
    X, 
    Lock, 
    History, 
    AlertTriangle,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TransactionHistory = ({ 
    transactions, 
    onUpdateTransaction, 
    onDeleteTransaction, 
    onDeleteAllTransactions, 
    onBulkDeleteTransactions,
    currencySymbol = '£',
    user,
    className
}) => {
    const isAdmin = user && String(user.role).toLowerCase() === 'admin';
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [selectedTxs, setSelectedTxs] = useState([])

    const formatCurrency = (val) => `${currencySymbol}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleEditClick = (tx) => {
        setEditingId(tx.id)
        setEditForm(tx)
    }

    const handleSave = () => {
        const numVal = parseFloat(editForm.amount)
        if (!isNaN(numVal) && numVal > 0) {
            onUpdateTransaction({ ...editForm, amount: numVal })
            setEditingId(null)
        }
    }

    const handleSelectAll = (checked) => {
        if (checked) setSelectedTxs(transactions.map(t => t.id))
        else setSelectedTxs([])
    }

    const handleSelectOne = (id) => {
        if (selectedTxs.includes(id)) setSelectedTxs(selectedTxs.filter(tId => tId !== id))
        else setSelectedTxs([...selectedTxs, id])
    }

    const executeBulkDelete = () => {
        if (selectedTxs.length > 0) {
            const idsToDelete = [...selectedTxs]
            setSelectedTxs([])
            onBulkDeleteTransactions(idsToDelete)
        }
    }

    if (transactions.length === 0) {
        return (
            <Card className={cn("bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm", className)}>
                <CardHeader>
                    <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Ledger Registry</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Historical record of all verified movements</CardDescription>
                </CardHeader>
                <CardContent className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
                    <History className="w-12 h-12 text-text-muted" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">No historical data available</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn("bg-bg-surface border-border-muted/50 overflow-hidden shadow-sm", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-border-muted/10 bg-bg-base/30">
                <div>
                    <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Ledger Registry</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-text-muted">Historical record of all verified movements</CardDescription>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-2">
                        {selectedTxs.length > 0 && (
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-8 text-[9px] font-black uppercase tracking-widest px-3 rounded-lg animate-in zoom-in-95"
                                onClick={executeBulkDelete}
                            >
                                <Trash2 className="w-3 h-3 mr-2" /> Delete ({selectedTxs.length})
                            </Button>
                        )}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 px-3 rounded-lg"
                            onClick={onDeleteAllTransactions}
                        >
                            Purge Records
                        </Button>
                    </div>
                )}
            </CardHeader>
            
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-bg-base/50">
                        <TableRow className="hover:bg-transparent border-border-muted/10">
                            {isAdmin && (
                                <TableHead className="w-12 px-6">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded-md border-border-muted bg-bg-base text-primary focus:ring-primary/20"
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        checked={transactions.length > 0 && selectedTxs.length === transactions.length}
                                    />
                                </TableHead>
                            )}
                            <TableHead className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted">Status & Date</TableHead>
                            <TableHead className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted">Entity</TableHead>
                            <TableHead className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted">Classification</TableHead>
                            <TableHead className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted">Description</TableHead>
                            <TableHead className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-right">Value</TableHead>
                            <TableHead className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((tx) => (
                            <TableRow key={tx.id} className="hover:bg-primary/[0.02] border-border-muted/5 transition-colors group">
                                {isAdmin && (
                                    <TableCell className="px-6">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded-md border-border-muted bg-bg-base text-primary focus:ring-primary/20"
                                            checked={selectedTxs.includes(tx.id)}
                                            onChange={() => handleSelectOne(tx.id)}
                                        />
                                    </TableCell>
                                )}
                                
                                {editingId === tx.id ? (
                                    <>
                                        <TableCell className="px-6 py-4">
                                            <span className="text-[10px] font-bold text-text-muted">{tx.date}</span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest opacity-50">{tx.created_by || 'System'}</Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <Select 
                                                value={editForm.type} 
                                                onValueChange={(val) => setEditForm({ ...editForm, type: val })}
                                            >
                                                <SelectTrigger className="h-8 text-[10px] font-black uppercase tracking-widest bg-bg-base border-border-muted/50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-bg-surface border-border-muted">
                                                    <SelectItem value="sales" className="text-[10px] font-black uppercase tracking-widest">Revenue</SelectItem>
                                                    <SelectItem value="expense" className="text-[10px] font-black uppercase tracking-widest">Expense</SelectItem>
                                                    <SelectItem value="salary" className="text-[10px] font-black uppercase tracking-widest">Salary</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <Input 
                                                value={editForm.description} 
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                className="h-8 text-xs font-bold bg-bg-base border-border-muted/50"
                                            />
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-black text-text-muted">{currencySymbol}</span>
                                                <Input 
                                                    type="number"
                                                    value={editForm.amount} 
                                                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                                    className="h-8 text-xs font-black bg-bg-base border-border-muted/50 w-24 text-right"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" className="w-7 h-7 text-primary hover:bg-primary/10" onClick={handleSave}>
                                                    <Check className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="w-7 h-7 text-text-muted hover:bg-bg-base" onClick={() => setEditingId(null)}>
                                                    <X className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    {tx.is_closed ? <Lock className="w-2.5 h-2.5 text-destructive" /> : <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />}
                                                    <span className="text-[10px] font-black text-text-main font-tabular">{tx.date}</span>
                                                </div>
                                                <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest ml-3.5">Verified Entry</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <Badge variant="ghost" className="text-[9px] font-black uppercase tracking-widest text-text-muted/60 bg-bg-base border border-border-muted/10 h-5 px-2">
                                                {tx.created_by || 'System'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <Badge className={cn(
                                                "text-[9px] font-black uppercase tracking-widest rounded-md border-none h-5 px-2",
                                                tx.type === 'sales' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                                            )}>
                                                {tx.type === 'sales' ? 'Revenue' : tx.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <span className="text-xs font-bold text-text-main group-hover:text-primary transition-colors">{tx.description}</span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn(
                                                    "text-sm font-black font-tabular tracking-tight",
                                                    tx.type === 'sales' ? 'text-primary' : 'text-text-main'
                                                )}>
                                                    {tx.type === 'sales' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            {!tx.is_closed ? (
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="w-7 h-7 text-text-muted hover:text-primary hover:bg-primary/10" onClick={() => handleEditClick(tx)}>
                                                        <Edit2 className="w-3 h-3" />
                                                    </Button>
                                                    {isAdmin && (
                                                        <Button size="icon" variant="ghost" className="w-7 h-7 text-text-muted hover:text-destructive hover:bg-destructive/10" onClick={() => onDeleteTransaction(tx.id)}>
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <Lock className="w-3 h-3 text-text-muted/30 ml-auto" />
                                            )}
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <CardFooter className="bg-bg-base/30 border-t border-border-muted/10 p-4">
                <div className="flex items-center gap-2 text-[9px] font-black text-text-muted/40 uppercase tracking-[0.2em]">
                    <AlertTriangle className="w-3 h-3" /> Transactions are immutable once period is closed.
                </div>
            </CardFooter>
        </Card>
    )
}

export default TransactionHistory
