import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { useNotification } from '../context/NotificationContext';
import { api } from '../services/api';

const MasterDashboard = () => {
    const { addNotification } = useNotification();
    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [pool, setPool] = useState(null);
    const [rules, setRules] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newFundName, setNewFundName] = useState('');

    // New rule form state
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [newRule, setNewRule] = useState({
        target_company_id: '',
        basis: 'FIXED_AMOUNT',
        value: '',
        max_cap: ''
    });

    useEffect(() => {
        fetchEntities();
    }, []);

    useEffect(() => {
        if (selectedEntity) {
            fetchPoolAndRules(selectedEntity.id);
        }
    }, [selectedEntity]);

    const fetchEntities = async () => {
        try {
            const res = await api.get('/master/entities');
            setEntities(res.data);
            if (res.data.length > 0) {
                setSelectedEntity(res.data[0]);
            }
            setLoading(false);
        } catch (error) {
            addNotification('error', 'Failed to load master entities');
            setLoading(false);
        }
    };

    const fetchPoolAndRules = async (entityId) => {
        try {
            const [poolRes, rulesRes, allocationsRes] = await Promise.all([
                api.get(`/master/${entityId}/pool`),
                api.get(`/master/${entityId}/allocation-rules`),
                api.get(`/master/${entityId}/allocations`)
            ]);
            setPool(poolRes.data);
            setRules(rulesRes.data);
            setAllocations(allocationsRes.data);
        } catch (error) {
            addNotification('error', 'Failed to load fund details');
        }
    };

    const handleCreateEntity = async () => {
        if (!newFundName) return;
        try {
            const res = await api.post(`/master/entities?name=${encodeURIComponent(newFundName)}`);
            setEntities([...entities, res.data]);
            setSelectedEntity(res.data);
            addNotification('success', 'Master Fund created');
            setIsCreateDialogOpen(false);
            setNewFundName('');
        } catch (error) {
            addNotification('error', 'Failed to create entity');
        }
    };

    const handleCreateRule = async (e) => {
        e.preventDefault();
        try {
            const ruleData = {
                master_entity_id: selectedEntity.id,
                target_company_id: parseInt(newRule.target_company_id),
                basis: newRule.basis,
                value: parseFloat(newRule.value),
                max_cap: newRule.max_cap ? parseFloat(newRule.max_cap) : null
            };
            await api.post('/master/allocation-rules', ruleData);
            addNotification('success', 'Allocation Rule created');
            setShowRuleForm(false);
            fetchPoolAndRules(selectedEntity.id);
        } catch (error) {
            addNotification('error', 'Failed to create rule');
        }
    };

    const handleAllocate = async (ruleId) => {
        try {
            await api.post(`/master/allocate/${ruleId}`);
            addNotification('success', 'Capital successfully allocated to venture');
            fetchPoolAndRules(selectedEntity.id);
        } catch (error) {
            addNotification('error', error.response?.data?.detail || 'Failed to allocate capital');
        }
    };

    if (loading) return <div className="p-8">Loading Master Dashboard...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-light tracking-tight">Master Fund <span className="font-semibold text-primary">Dashboard</span></h1>
                    <p className="text-muted-foreground mt-1">Manage cross-venture capital allocation and performance.</p>
                </div>
                <div className="flex gap-4">
                    <Select value={selectedEntity?.id?.toString() || ''} onValueChange={(val) => setSelectedEntity(entities.find(en => en.id === parseInt(val)))}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select Master Fund" />
                        </SelectTrigger>
                        <SelectContent>
                            {entities.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">New Fund</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Master Fund</DialogTitle>
                                <DialogDescription>Enter a name for the new master fund entity.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input 
                                    placeholder="e.g. Global Master Fund 1" 
                                    value={newFundName} 
                                    onChange={(e) => setNewFundName(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateEntity}>Create Fund</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            {!selectedEntity ? (
                <Card className="p-12 text-center text-muted-foreground">
                    No Master Fund selected or available. Create one to begin.
                </Card>
            ) : (
                <>
                    {/* Capital Pool Stats */}
                    {pool && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="bg-primary/5 border-primary/20">
                                    <CardContent className="pt-6">
                                        <div className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Total Capital</div>
                                        <div className="text-4xl font-light text-primary">${pool.total_capital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Unallocated Capital</div>
                                        <div className="text-4xl font-light">${pool.unallocated_capital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Allocated Capital</div>
                                        <div className="text-4xl font-light">${(pool.total_capital - pool.unallocated_capital).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                    </CardContent>
                                </Card>
                            </div>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-medium text-muted-foreground">Allocation Progress</span>
                                        <span className="font-medium">{Math.round(((pool.total_capital - pool.unallocated_capital) / pool.total_capital) * 100) || 0}% Allocated</span>
                                    </div>
                                    <Progress value={((pool.total_capital - pool.unallocated_capital) / pool.total_capital) * 100 || 0} className="h-3" />
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Allocation Rules & History */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xl font-medium tracking-tight">Allocation Rules</CardTitle>
                                <Button size="sm" onClick={() => setShowRuleForm(!showRuleForm)}>
                                    {showRuleForm ? 'Cancel' : 'New Rule'}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {showRuleForm && (
                                    <form onSubmit={handleCreateRule} className="mb-6 space-y-4 p-4 border border-border rounded-lg bg-muted/30">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Venture (Company ID)</label>
                                                <Input 
                                                    type="number" 
                                                    required 
                                                    value={newRule.target_company_id}
                                                    onChange={e => setNewRule({...newRule, target_company_id: e.target.value})}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Basis</label>
                                                <Select value={newRule.basis} onValueChange={(val) => setNewRule({...newRule, basis: val})}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                                                        <SelectItem value="PERCENTAGE_OF_POOL">Percentage of Pool</SelectItem>
                                                        <SelectItem value="CAPITAL_RATIO">Capital Ratio</SelectItem>
                                                        <SelectItem value="PERFORMANCE">Performance</SelectItem>
                                                        <SelectItem value="NEEDS_BASED">Needs Based</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Value {newRule.basis === 'PERCENTAGE_OF_POOL' ? '(%)' : '($)'}</label>
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    required 
                                                    value={newRule.value}
                                                    onChange={e => setNewRule({...newRule, value: e.target.value})}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Max Cap ($)</label>
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={newRule.max_cap}
                                                    onChange={e => setNewRule({...newRule, max_cap: e.target.value})}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full">Save Rule</Button>
                                    </form>
                                )}

                                {rules.length > 0 && (
                                    <div className="mb-6 space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex flex-col">
                                                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total % Claimed</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-light">{rules.filter(r => r.basis === 'PERCENTAGE_OF_POOL').reduce((acc, r) => acc + r.value, 0)}%</span>
                                                    <Progress value={rules.filter(r => r.basis === 'PERCENTAGE_OF_POOL').reduce((acc, r) => acc + r.value, 0)} className="h-2 w-full" />
                                                </div>
                                            </div>
                                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex flex-col">
                                                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Fixed Commitments</span>
                                                <span className="text-lg font-light">${rules.filter(r => r.basis === 'FIXED_AMOUNT').reduce((acc, r) => acc + r.value, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {rules.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No allocation rules configured.</p>
                                    ) : (
                                        rules.map(rule => (
                                            <div key={rule.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors bg-card">
                                                <div>
                                                    <div className="font-medium text-sm">Venture ID: {rule.target_company_id}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Basis: <span className="font-semibold text-foreground">{rule.basis.replace(/_/g, ' ')}</span> &bull; 
                                                        Value: {rule.basis === 'PERCENTAGE_OF_POOL' ? `${rule.value}%` : `$${rule.value.toLocaleString()}`}
                                                        {rule.max_cap && ` (Cap: $${rule.max_cap.toLocaleString()})`}
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => handleAllocate(rule.id)}>Execute</Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl font-medium tracking-tight">Recent Allocations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {allocations.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No allocation history.</p>
                                    ) : (
                                        allocations.slice().reverse().map(alloc => (
                                            <div key={alloc.id} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                                                <div>
                                                    <div className="text-sm font-medium">To Venture ID: {alloc.target_company_id}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(alloc.date).toLocaleDateString()} &bull; 
                                                        <span className="text-green-500 ml-1">{alloc.status}</span>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold text-primary">
                                                    ${alloc.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default MasterDashboard;
