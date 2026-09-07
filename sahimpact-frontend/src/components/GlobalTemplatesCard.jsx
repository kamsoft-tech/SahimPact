import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNotification } from '../context/NotificationContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Plus, Save, Trash2, GripVertical } from "lucide-react";

export const GlobalTemplatesCard = () => {
    const { showNotification } = useNotification();
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingSection, setEditingSection] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchSections();
    }, []);

    const fetchSections = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/templates/global');
            setSections(res.data);
        } catch (error) {
            showNotification('Failed to load global templates', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingSection.title || !editingSection.content) {
            showNotification('Title and content are required', 'error');
            return;
        }

        try {
            if (isCreating) {
                await axios.post('/api/templates/global', editingSection);
                showNotification('Section created successfully', 'success');
            } else {
                await axios.put(`/api/templates/global/${editingSection.id}`, editingSection);
                showNotification('Section updated successfully', 'success');
            }
            setEditingSection(null);
            setIsCreating(false);
            fetchSections();
        } catch (error) {
            showNotification('Failed to save section', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this global section?")) return;
        try {
            await axios.delete(`/api/templates/global/${id}`);
            showNotification('Section deleted', 'success');
            fetchSections();
        } catch (error) {
            showNotification('Failed to delete section', 'error');
        }
    };

    const moveSection = async (index, direction) => {
        const newSections = [...sections];
        if (direction === 'up' && index > 0) {
            [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
        } else if (direction === 'down' && index < newSections.length - 1) {
            [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
        } else {
            return;
        }
        
        // Update order_index
        const updated = newSections.map((sec, idx) => ({ ...sec, order_index: idx }));
        setSections(updated);
        
        // Save to backend
        try {
            await Promise.all(updated.map(sec => axios.put(`/api/templates/global/${sec.id}`, sec)));
            showNotification('Order updated', 'success');
        } catch (error) {
            showNotification('Failed to update order', 'error');
            fetchSections();
        }
    };

    return (
        <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden col-span-full">
            <CardHeader className="bg-bg-base/30 border-b border-border-muted/10 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-3 text-xl font-black text-text-main font-brand uppercase tracking-tighter">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileSignature className="h-5 w-5" />
                        </div>
                        Global Legal Templates
                    </CardTitle>
                    <CardDescription className="text-text-muted font-medium mt-2">
                        Manage standardized document sections. These are verified and form the core of the partnership agreement.
                    </CardDescription>
                </div>
                {!editingSection && (
                    <Button onClick={() => {
                        setIsCreating(true);
                        setEditingSection({ title: '', content: '', is_mandatory: false, order_index: sections.length });
                    }} className="bg-primary text-on-primary">
                        <Plus className="w-4 h-4 mr-2" /> Add Section
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-6">
                {editingSection ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Section Title</label>
                                <Input 
                                    value={editingSection.title} 
                                    onChange={e => setEditingSection({...editingSection, title: e.target.value})}
                                    placeholder="e.g., Termination Clause" 
                                />
                            </div>
                            <div className="space-y-2 flex flex-col justify-center">
                                <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Requirement Status</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        checked={editingSection.is_mandatory}
                                        onChange={e => setEditingSection({...editingSection, is_mandatory: e.target.checked})}
                                        className="w-4 h-4 rounded border-border-muted bg-bg-base"
                                    />
                                    <span className="text-sm font-medium text-text-main">
                                        Mandatory (Companies cannot opt-out)
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-2 bg-white rounded-lg text-black">
                            <ReactQuill 
                                theme="snow" 
                                value={editingSection.content} 
                                onChange={(content) => setEditingSection({...editingSection, content})} 
                                style={{ height: '300px', marginBottom: '50px' }}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border-muted/10">
                            <Button variant="outline" onClick={() => {
                                setEditingSection(null);
                                setIsCreating(false);
                            }}>Cancel</Button>
                            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-on-primary">
                                <Save className="w-4 h-4 mr-2" /> Save Section
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sections.length === 0 && !loading && (
                            <div className="text-center py-12 text-text-muted">
                                <FileSignature className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="font-bold">No global templates defined.</p>
                            </div>
                        )}
                        {sections.map((section, index) => (
                            <div key={section.id} className="flex items-start gap-4 p-4 border border-border-muted/20 rounded-xl bg-bg-base/30 group">
                                <div className="flex flex-col gap-1 mt-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => moveSection(index, 'up')} disabled={index === 0} className="hover:text-primary disabled:opacity-30">▲</button>
                                    <GripVertical className="w-4 h-4 text-text-muted" />
                                    <button onClick={() => moveSection(index, 'down')} disabled={index === sections.length - 1} className="hover:text-primary disabled:opacity-30">▼</button>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-black text-lg text-text-main">{section.title}</h3>
                                        <Badge variant={section.is_mandatory ? "default" : "secondary"} className="text-[10px] uppercase tracking-widest">
                                            {section.is_mandatory ? "Mandatory" : "Optional"}
                                        </Badge>
                                    </div>
                                    <div 
                                        className="text-sm text-text-muted line-clamp-2 prose prose-sm prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: section.content }} 
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setEditingSection(section)}>Edit</Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(section.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
