import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNotification } from '../context/NotificationContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Plus, Save, Trash2, GripVertical, AlertTriangle } from "lucide-react";

export const CompanyTemplatesCard = () => {
    const { showNotification } = useNotification();
    const [globalSections, setGlobalSections] = useState([]);
    const [companySections, setCompanySections] = useState([]);
    const [selections, setSelections] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingSection, setEditingSection] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [globalRes, companyRes, selectionRes] = await Promise.all([
                axios.get('/api/templates/global'),
                axios.get('/api/templates/company'),
                axios.get('/api/templates/selection')
            ]);
            setGlobalSections(globalRes.data);
            setCompanySections(companyRes.data);
            setSelections(selectionRes.data);
        } catch (error) {
            showNotification('Failed to load templates', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCustom = async () => {
        if (!editingSection.title || !editingSection.content) {
            showNotification('Title and content are required', 'error');
            return;
        }

        try {
            if (isCreating) {
                await axios.post('/api/templates/company', editingSection);
                showNotification('Custom section created successfully', 'success');
            } else {
                await axios.put(`/api/templates/company/${editingSection.id}`, editingSection);
                showNotification('Custom section updated successfully', 'success');
            }
            setEditingSection(null);
            setIsCreating(false);
            fetchData();
        } catch (error) {
            showNotification('Failed to save custom section', 'error');
        }
    };

    const handleDeleteCustom = async (id) => {
        if (!window.confirm("Are you sure you want to delete this custom section?")) return;
        try {
            await axios.delete(`/api/templates/company/${id}`);
            showNotification('Custom section deleted', 'success');
            fetchData();
        } catch (error) {
            showNotification('Failed to delete custom section', 'error');
        }
    };

    const toggleSelection = async (globalSectionId, companySectionId, currentStatus) => {
        const newStatus = !currentStatus;
        
        // Build new selections array
        const newSelections = [...selections];
        const existingIndex = newSelections.findIndex(
            s => s.global_section_id === globalSectionId && s.company_section_id === companySectionId
        );
        
        if (existingIndex >= 0) {
            newSelections[existingIndex].is_included = newStatus;
        } else {
            newSelections.push({
                global_section_id: globalSectionId,
                company_section_id: companySectionId,
                is_included: newStatus
            });
        }
        
        setSelections(newSelections);

        // Map to update payload
        const payload = newSelections.map(s => ({
            global_section_id: s.global_section_id,
            company_section_id: s.company_section_id,
            is_included: s.is_included
        }));

        try {
            await axios.put('/api/templates/selection', payload);
            showNotification('Selection saved', 'success');
        } catch (error) {
            showNotification('Failed to save selection', 'error');
            fetchData(); // Revert on error
        }
    };

    const isSectionIncluded = (globalSectionId, companySectionId, isMandatory) => {
        if (isMandatory) return true;
        const sel = selections.find(s => s.global_section_id === globalSectionId && s.company_section_id === companySectionId);
        return sel ? sel.is_included : false; // Default to false if not explicitly selected
    };

    // All sections combined for display (can be reordered locally, but for now we just list globals then customs)
    const combinedList = [
        ...globalSections.map(s => ({ ...s, isGlobal: true })),
        ...companySections.map(s => ({ ...s, isGlobal: false }))
    ];

    return (
        <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden col-span-full">
            <CardHeader className="bg-bg-base/30 border-b border-border-muted/10 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-3 text-xl font-black text-text-main font-brand uppercase tracking-tighter">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileSignature className="h-5 w-5" />
                        </div>
                        Contract Builder
                    </CardTitle>
                    <CardDescription className="text-text-muted font-medium mt-2">
                        Construct your partnership agreement by selecting optional standard clauses or adding your own custom clauses.
                    </CardDescription>
                </div>
                {!editingSection && (
                    <Button onClick={() => {
                        setIsCreating(true);
                        setEditingSection({ title: '', content: '', order_index: companySections.length });
                    }} className="bg-primary text-on-primary">
                        <Plus className="w-4 h-4 mr-2" /> Add Custom Section
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-6">
                {editingSection ? (
                    <div className="space-y-6">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-amber-500 text-sm">Notice: Unreviewed Clause</h4>
                                <p className="text-xs text-text-muted mt-1">Custom sections added here have not been reviewed by Shariah scholars. They will be explicitly marked as such in the final document to ensure full transparency with your partners.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Section Title</label>
                            <Input 
                                value={editingSection.title} 
                                onChange={e => setEditingSection({...editingSection, title: e.target.value})}
                                placeholder="e.g., Specific Local Regulations" 
                            />
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
                            <Button onClick={handleSaveCustom} className="bg-primary text-on-primary">
                                <Save className="w-4 h-4 mr-2" /> Save Custom Section
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {combinedList.length === 0 && !loading && (
                            <div className="text-center py-12 text-text-muted">
                                <FileSignature className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="font-bold">No templates available.</p>
                            </div>
                        )}
                        {combinedList.map((section, index) => {
                            const isIncluded = section.isGlobal 
                                ? isSectionIncluded(section.id, null, section.is_mandatory)
                                : isSectionIncluded(null, section.id, true); // Customs are always 'included' once created, unless we want to toggle them too. Wait, we can toggle customs!
                                
                            // Actually, customs can be toggled if we use the selection table.
                            // Let's assume custom sections are automatically active, but we can allow toggling them.
                            // For simplicity, let's say they are toggleable as well.
                            const isActive = section.isGlobal 
                                ? isSectionIncluded(section.id, null, section.is_mandatory)
                                : isSectionIncluded(null, section.id, false); // By default customs are false until we check them? Actually let's assume if it exists, it should be selectable. Let's make it toggleable!

                            // Let's auto-include custom sections on create, but since we didn't, let's just make it toggleable.

                            return (
                                <div key={section.isGlobal ? `g_${section.id}` : `c_${section.id}`} 
                                    className={`flex items-start gap-4 p-4 border rounded-xl transition-all
                                        ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border-muted/20 bg-bg-base/30 opacity-60 hover:opacity-100'}
                                    `}
                                >
                                    <div className="pt-1">
                                        <input 
                                            type="checkbox" 
                                            checked={isActive}
                                            disabled={section.isGlobal && section.is_mandatory}
                                            onChange={() => toggleSelection(
                                                section.isGlobal ? section.id : null, 
                                                !section.isGlobal ? section.id : null, 
                                                isActive
                                            )}
                                            className="w-5 h-5 rounded border-border-muted bg-bg-base accent-primary"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-black text-lg text-text-main">{section.title}</h3>
                                            {section.isGlobal ? (
                                                <Badge variant={section.is_mandatory ? "default" : "secondary"} className="text-[10px] uppercase tracking-widest">
                                                    {section.is_mandatory ? "Global Mandatory" : "Global Optional"}
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-600 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Custom (Unreviewed)
                                                </Badge>
                                            )}
                                        </div>
                                        <div 
                                            className="text-sm text-text-muted line-clamp-2 prose prose-sm prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: section.content }} 
                                        />
                                    </div>
                                    {!section.isGlobal && (
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setEditingSection(section)}>Edit</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDeleteCustom(section.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
