"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/shared/ui/ui/Button";
import { useSetup2FA, useVerify2FA } from "@/shared/hooks/useTwoFactor";
import { Shield, X, Copy, Download, Check, AlertTriangle } from "lucide-react";

interface TwoFactorSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "setup" | "verify" | "backup" | "done";

export default function TwoFactorSetupModal({ open, onClose, onSuccess }: TwoFactorSetupModalProps) {
  const setup2FA   = useSetup2FA();
  const verify2FA  = useVerify2FA();

  const [step, setStep] = useState<Step>("setup");
  const [qrCode, setQrCode] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const handleStartSetup = async () => {
    try {
      const data = await setup2FA.mutateAsync();
      setQrCode(data.qrCode);
      setManualKey(data.manualKey);
      setBackupCodes(data.backupCodes);
      setStep("verify");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return toast.error("Enter a 6-digit code");
    try {
      await verify2FA.mutateAsync(verifyCode);
      setStep("backup");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(manualKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyBackup = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadBackup = () => {
    const text = `BizFlow - 2FA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nEach code can only be used once.\nStore these codes in a safe place.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bizflow-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDone = () => {
    setStep("setup");
    setVerifyCode("");
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-primary/10 p-6 max-h-[calc(100vh-2rem)] overflow-y-auto"
        style={{ background: "var(--bg-surface)" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-600/20">
              <Shield size={18} className="text-violet-400" />
            </div>
            <h3 className="text-lg font-bold text-primary">
              {step === "setup" && "Enable Two-Factor Auth"}
              {step === "verify" && "Scan QR Code"}
              {step === "backup" && "Save Backup Codes"}
              {step === "done" && "2FA Enabled!"}
            </h3>
          </div>
          {step !== "backup" && step !== "done" && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-primary/10 text-primary/40">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step 1: Setup */}
        {step === "setup" && (
          <div className="space-y-4">
            <p className="text-primary/60 text-sm">
              Two-factor authentication adds an extra layer of security to your account.
              You&apos;ll need an authenticator app like <strong className="text-primary/80">Google Authenticator</strong> or <strong className="text-primary/80">Authy</strong>.
            </p>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-400 text-xs">
                  Make sure you have an authenticator app installed on your phone before continuing.
                </p>
              </div>
            </div>

            <Button onClick={handleStartSetup} disabled={setup2FA.isPending} icon={<Shield size={14} />} className="w-full">
              {setup2FA.isPending ? "Setting up..." : "Start Setup"}
            </Button>
          </div>
        )}

        {/* Step 2: QR Code + Verify */}
        {step === "verify" && (
          <div className="space-y-4">
            <p className="text-primary/60 text-sm">
              Scan the QR code with your authenticator app, then enter the 6-digit code it shows.
            </p>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-xl">
                <img src={qrCode} alt="2FA QR Code" width={200} height={200} />
              </div>
            </div>

            {/* Manual Key */}
            <div>
              <p className="text-primary/40 text-xs mb-1.5">Can&apos;t scan? Enter this key manually:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 text-xs text-primary/70 font-mono break-all">
                  {manualKey}
                </code>
                <button onClick={handleCopyKey}
                  className="p-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary/40 transition-colors">
                  {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Verification Input */}
            <div>
              <label className="text-primary/40 text-xs mb-1.5 block">Enter 6-digit code</label>
              <input
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 text-center text-xl
                  text-primary font-mono tracking-[0.5em] focus:outline-none focus:border-violet-500/50 transition-all"
                autoFocus
              />
            </div>

            <Button onClick={handleVerify} disabled={verify2FA.isPending || verifyCode.length !== 6}
              icon={<Check size={14} />} className="w-full">
              {verify2FA.isPending ? "Verifying..." : "Verify & Enable"}
            </Button>
          </div>
        )}

        {/* Step 3: Backup Codes */}
        {step === "backup" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                <Check size={14} /> Two-factor authentication is now enabled!
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-amber-400 text-xs font-medium">Save these backup codes</p>
                  <p className="text-amber-400/70 text-xs mt-0.5">
                    Each code can only be used once. If you lose your authenticator, you&apos;ll need these to access your account.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-center py-1.5 px-2 bg-primary/5 rounded-lg">
                  <code className="text-primary/70 text-sm font-mono">{code}</code>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={copiedBackup ? <Check size={13} /> : <Copy size={13} />}
                onClick={handleCopyBackup} className="flex-1">
                {copiedBackup ? "Copied!" : "Copy All"}
              </Button>
              <Button variant="secondary" size="sm" icon={<Download size={13} />}
                onClick={handleDownloadBackup} className="flex-1">
                Download
              </Button>
            </div>

            <Button onClick={handleDone} icon={<Check size={14} />} className="w-full">
              I&apos;ve Saved My Codes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
