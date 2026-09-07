import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from '../context/AuthContext';

const configSchema = z.object({
    provider: z.enum(['MANUAL', 'DOCUMENSO', 'DOCUSIGN']),
    account_id: z.string().optional(),
    integration_key: z.string().optional(),
    documenso_api_key: z.string().optional()
});

export const SigningConfigCard = () => {
    const { showNotification } = useNotification();
    const { role } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [hasCredentials, setHasCredentials] = useState(false);

    const form = useForm({
        resolver: zodResolver(configSchema),
        defaultValues: {
            provider: 'MANUAL',
            account_id: '',
            integration_key: '',
            documenso_api_key: ''
        }
    });

    const provider = form.watch('provider');

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await axios.get('/api/signatures/config');
            form.setValue('provider', res.data.provider);
            setHasCredentials(res.data.has_credentials);
        } catch (error) {
            console.error("Failed to fetch signature config", error);
        }
    };

    const onSubmit = async (values) => {
        setIsLoading(true);
        try {
            let credentials = {};
            if (values.provider === 'DOCUSIGN') {
                credentials = {
                    account_id: values.account_id,
                    integration_key: values.integration_key
                };
            } else if (values.provider === 'DOCUMENSO') {
                credentials = {
                    api_key: values.documenso_api_key
                };
            }
            
            await axios.put('/api/signatures/config', {
                provider: values.provider,
                credentials: Object.keys(credentials).length > 0 ? credentials : {}
            });
            
            showNotification("Signature configuration updated successfully.", "success");
            fetchConfig();
            
            // Clear secret fields
            form.setValue('account_id', '');
            form.setValue('integration_key', '');
            form.setValue('documenso_api_key', '');
            
        } catch (error) {
            showNotification("Failed to update signature configuration.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
        return null;
    }

    return (
        <Card className="bg-bg-surface border-border-muted/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-bg-base/30 border-b border-border-muted/10">
                <CardTitle className="flex items-center gap-3 text-xl font-black text-text-main font-brand uppercase tracking-tighter">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    E-Signature Provider
                </CardTitle>
                <CardDescription className="text-text-muted font-medium">Configure how partnership agreements are legally signed.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="provider"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Provider</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select provider" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="MANUAL">Manual (Download/Upload PDF)</SelectItem>
                                            <SelectItem value="DOCUMENSO">Documenso (Open Source)</SelectItem>
                                            <SelectItem value="DOCUSIGN">DocuSign</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Select the platform used for finalizing agreements.
                                        {hasCredentials && provider !== 'MANUAL' && " (Credentials are currently saved)"}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {provider === 'DOCUMENSO' && (
                            <div className="space-y-4 pt-2 border-t border-border-muted/20">
                                <FormField
                                    control={form.control}
                                    name="documenso_api_key"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>API Key</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder={hasCredentials ? "Leave blank to keep existing" : "Enter API Key"} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {provider === 'DOCUSIGN' && (
                            <div className="space-y-4 pt-2 border-t border-border-muted/20">
                                <FormField
                                    control={form.control}
                                    name="account_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Account ID</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder={hasCredentials ? "Leave blank to keep existing" : "Enter Account ID"} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="integration_key"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Integration Key (Client ID)</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder={hasCredentials ? "Leave blank to keep existing" : "Enter Integration Key"} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button 
                                type="submit"
                                disabled={isLoading}
                                className="bg-primary text-on-primary"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Signature Config
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
