"use client";

import React, { useState } from "react";
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { ShieldAlert } from "lucide-react";

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
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Security Verification"
      subtitle={`Please re-authenticate to confirm ${actionName}.`}
      icon={<ShieldAlert size={18} />}
      iconColor="bg-amber-500/20 text-amber-500"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!requires2FA ? (
          <FormField label="Confirm your password" required>
            <ModalInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </FormField>
        ) : (
          <FormField label="Two-Factor Authentication Code" required hint="Enter the code from your authenticator app.">
            <ModalInput
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={otpToken}
              onChange={(e) => setOtpToken(e.target.value)}
              placeholder="6-digit code or backup code"
              required
            />
          </FormField>
        )}

        {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

        <ModalFooter
          onClose={onClose}
          loading={loading}
          submitLabel="Verify"
        />
      </form>
    </Modal>
  );
}
