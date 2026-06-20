"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/components/ui/dialog";
import { Button } from "@/shared/ui/components/ui/button";
import { Input } from "@/shared/ui/components/ui/input";
import { Label } from "@/shared/ui/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";

interface ReAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reAuthToken: string) => void;
  actionName?: string;
}

export function ReAuthModal({ isOpen, onClose, onSuccess, actionName = "this action" }: ReAuthModalProps) {
  const [password, setPassword] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, otpToken: otpToken || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requires2FA) {
          setRequires2FA(true);
        } else {
          setError(data.error || "Authentication failed");
        }
      } else {
        // Success
        setPassword("");
        setOtpToken("");
        setRequires2FA(false);
        onSuccess(data.reAuthToken);
      }
    } catch (err: any) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Security Verification
          </DialogTitle>
          <DialogDescription>
            Please re-authenticate to confirm {actionName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {!requires2FA ? (
            <div className="space-y-2">
              <Label htmlFor="password">Confirm your password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="otpToken">Two-Factor Authentication Code</Label>
              <Input
                id="otpToken"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                placeholder="6-digit code or backup code"
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter the code from your authenticator app.
              </p>
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
