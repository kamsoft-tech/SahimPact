import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const ConfirmDialog = ({
    isOpen,
    onOpenChange,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    variant = "default",
    requireText,
    requireTextPlaceholder = "Type here to confirm",
}) => {
    const [inputValue, setInputValue] = useState("");
    const isDestructive = variant === "destructive";

    const handleConfirm = () => {
        if (requireText && inputValue !== requireText) return;
        onConfirm();
        onOpenChange(false);
        setInputValue("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) setInputValue("");
        }}>
            <DialogContent className="max-w-[95vw] sm:max-w-md bg-bg-surface border-border-muted/50 shadow-2xl">
                <DialogHeader>
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                        isDestructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    )}>
                        {isDestructive ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    </div>
                    <DialogTitle className={cn(
                        "text-2xl font-black font-brand uppercase tracking-tighter",
                        isDestructive ? "text-destructive" : "text-text-main"
                    )}>
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-text-muted font-medium pt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {requireText && (
                    <div className="py-4 space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                            Type <span className="text-text-main font-black">'{requireText}'</span> to proceed
                        </label>
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={requireTextPlaceholder}
                            className="bg-bg-base border-border-muted font-black h-11"
                        />
                    </div>
                )}

                <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="font-black rounded-xl order-2 sm:order-1"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={isDestructive ? "destructive" : "default"}
                        onClick={handleConfirm}
                        disabled={requireText && inputValue !== requireText}
                        className={cn(
                            "font-black rounded-xl flex-1 h-11 order-1 sm:order-2",
                            !isDestructive && "bg-primary hover:bg-primary/90 text-on-primary shadow-lg shadow-primary/20"
                        )}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmDialog;
