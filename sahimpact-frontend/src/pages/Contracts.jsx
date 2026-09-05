import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { useNotification } from '../context/NotificationContext';
import { api } from '../services/api';

const Contracts = () => {
    const { addNotification } = useNotification();
    const [clauses, setClauses] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('clauses'); // clauses or templates
    
    // New Clause Form
    const [showClauseForm, setShowClauseForm] = useState(false);
    const [newClause, setNewClause] = useState({
        key: '', category: '', title: '', body: '', contract_type: 'Mudarabah', mandatory: false
    });

    useEffect(() => {
        fetchContractsData();
    }, []);

    const fetchContractsData = async () => {
        try {
            const [clausesRes, templatesRes] = await Promise.all([
                api.get('/contracts/clauses'),
                api.get('/contracts/templates')
            ]);
            setClauses(clausesRes.data);
            setTemplates(templatesRes.data);
            setLoading(false);
        } catch (error) {
            addNotification('error', 'Failed to load contracts library');
            setLoading(false);
        }
    };

    const handleCreateClause = async (e) => {
        e.preventDefault();
        try {
            await api.post('/contracts/clauses', newClause);
            addNotification('success', 'Contract Clause certified and added');
            setShowClauseForm(false);
            setNewClause({ key: '', category: '', title: '', body: '', contract_type: 'Mudarabah', mandatory: false });
            fetchContractsData();
        } catch (error) {
            addNotification('error', 'Failed to create clause');
        }
    };

    if (loading) return <div className="p-8">Loading Contract Library...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-light tracking-tight">Contract <span className="font-semibold text-primary">Library</span></h1>
                    <p className="text-muted-foreground mt-1">Manage certified Shariah clauses and templates.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-md">
                    <Button 
                        variant={activeTab === 'clauses' ? 'secondary' : 'ghost'}
                        onClick={() => setActiveTab('clauses')}
                        size="sm"
                        className="px-4"
                    >
                        Clauses
                    </Button>
                    <Button 
                        variant={activeTab === 'templates' ? 'secondary' : 'ghost'}
                        onClick={() => setActiveTab('templates')}
                        size="sm"
                        className="px-4"
                    >
                        Templates
                    </Button>
                </div>
            </header>

            {activeTab === 'clauses' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-medium tracking-tight">Certified Clauses</h2>
                        <Button onClick={() => setShowClauseForm(!showClauseForm)}>
                            {showClauseForm ? 'Cancel' : 'Add Clause'}
                        </Button>
                    </div>

                    {showClauseForm && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="pt-6">
                                <form onSubmit={handleCreateClause} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-wider text-muted-foreground">Unique Key</label>
                                            <Input required placeholder="e.g. loss_rule_hanafi" value={newClause.key} onChange={e => setNewClause({...newClause, key: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
                                            <Input required placeholder="e.g. Loss Allocation" value={newClause.category} onChange={e => setNewClause({...newClause, category: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-wider text-muted-foreground">Title</label>
                                            <Input required value={newClause.title} onChange={e => setNewClause({...newClause, title: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-wider text-muted-foreground">Contract Type</label>
                                            <Select value={newClause.contract_type} onValueChange={val => setNewClause({...newClause, contract_type: val})}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Mudarabah">Mudarabah</SelectItem>
                                                    <SelectItem value="Musharakah">Musharakah</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase tracking-wider text-muted-foreground">Certified Body (Text)</label>
                                        <Textarea 
                                            required 
                                            rows={4}
                                            value={newClause.body}
                                            onChange={e => setNewClause({...newClause, body: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id="mandatory" 
                                            checked={newClause.mandatory} 
                                            onCheckedChange={checked => setNewClause({...newClause, mandatory: checked})} 
                                        />
                                        <label htmlFor="mandatory" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Mandatory (Cannot be removed from templates)
                                        </label>
                                    </div>
                                    <Button type="submit">Certify & Save</Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {clauses.map(clause => (
                            <Card key={clause.id} className="hover:border-primary/50 transition-colors">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg">{clause.title}</h3>
                                                {clause.mandatory && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">Mandatory</span>}
                                            </div>
                                            <p className="text-xs font-mono text-muted-foreground mt-1">{clause.key} &bull; {clause.contract_type} &bull; {clause.category}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Version {clause.version}</div>
                                            {clause.locked && <div className="text-[10px] font-semibold text-orange-500 uppercase mt-1 tracking-wider">Locked</div>}
                                        </div>
                                    </div>
                                    <div className="bg-muted p-4 rounded-md font-serif text-sm leading-relaxed border-l-2 border-primary">
                                        {clause.body}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {clauses.length === 0 && <p className="text-muted-foreground text-sm">No clauses available.</p>}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <h2 className="text-xl font-medium tracking-tight">Contract Templates</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {templates.map(temp => (
                            <Card key={temp.id}>
                                <CardHeader>
                                    <CardTitle>{temp.name}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{temp.contract_type}</p>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm mb-4">{temp.description}</p>
                                    <div className="space-y-2">
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Included Clauses</div>
                                        <ul className="text-sm space-y-1 list-inside list-disc text-muted-foreground">
                                            {temp.clause_order.map(key => (
                                                <li key={key}>{key}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-border">
                                        <Button variant="outline" className="w-full" onClick={() => window.open(`/api/contracts/templates/${temp.id}/render`, '_blank')}>
                                            Preview Rendered Document
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {templates.length === 0 && <p className="text-muted-foreground text-sm">No templates available.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contracts;
