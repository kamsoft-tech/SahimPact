import React, { useState } from 'react';
import { 
    UploadCloud, 
    FileSpreadsheet, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    X,
    Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const CSVUpload = ({ token, onUploadSuccess, className }) => {
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setMessage(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsLoading(true);
        setMessage(null);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/ingest/bank-statement', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Failed to upload CSV');
            }

            const data = await res.json();
            setMessage(data.message || "File processed successfully. Transactions updated.");
            setFile(null);
            
            // Reset file input
            const fileInput = document.getElementById('csv-upload-input-modern');
            if(fileInput) fileInput.value = '';

            if (onUploadSuccess) {
                onUploadSuccess();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        const fileInput = document.getElementById('csv-upload-input-modern');
        if(fileInput) fileInput.value = '';
    };

    return (
        <Card className={cn("bg-bg-surface border-primary/20 shadow-xl shadow-primary/5 overflow-hidden", className)}>
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-xl text-primary">
                        <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-black text-text-main font-brand uppercase tracking-tighter">Bank Ingestion Engine</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1">AI-Powered Transaction Mapping</CardDescription>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="pt-8 space-y-6">
                {!file ? (
                    <div 
                        className="border-2 border-dashed border-border-muted/30 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/[0.02] transition-all cursor-pointer group relative"
                        onClick={() => document.getElementById('csv-upload-input-modern').click()}
                    >
                        <div className="w-16 h-16 rounded-2xl bg-bg-base flex items-center justify-center text-text-muted group-hover:text-primary group-hover:scale-110 transition-all duration-500">
                            <FileSpreadsheet className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-sm font-black text-text-main uppercase tracking-tight">Drop bank statement here</p>
                            <p className="text-[10px] text-text-muted font-bold">Supported: CSV, Mettle, Tide, Wise</p>
                        </div>
                        <Input 
                            id="csv-upload-input-modern"
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                ) : (
                    <div className="bg-bg-base border border-border-muted/20 rounded-2xl p-6 flex items-center justify-between animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                                <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-text-main truncate max-w-[200px]">{file.name}</p>
                                <p className="text-[10px] text-text-muted font-bold">{(file.size / 1024).toFixed(2)} KB • Ready to import</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearFile} className="hover:bg-destructive/10 hover:text-destructive">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-2xl bg-bg-base/50 border border-border-muted/10">
                    <Info className="w-4 h-4 text-primary mt-0.5" />
                    <p className="text-[10px] text-text-muted font-bold leading-relaxed italic">
                        By uploading, you authorize the system to automatically categorize transactions. Incoming payments are mapped to Revenue; outgoing to Operating Expenses.
                    </p>
                </div>

                {message && (
                    <Alert className="bg-primary/10 border-primary/20 text-primary rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Success</AlertTitle>
                        <AlertDescription className="text-xs font-bold">{message}</AlertDescription>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Import Error</AlertTitle>
                        <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>

            <CardFooter className="bg-bg-base/30 border-t border-border-muted/10 p-6">
                <Button 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-on-primary font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 group"
                    disabled={!file || isLoading}
                    onClick={handleUpload}
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Upload & Import <UploadCloud className="w-4 h-4 ml-2 group-hover:-translate-y-1 transition-transform" />
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default CSVUpload;
