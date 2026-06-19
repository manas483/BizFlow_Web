"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { Settings, Shield, Bell, Database, Users, Save, CheckCircle, User, Lock, Eye, EyeOff, AlertCircle, Clock, Trash2, Download, X, Zap } from "lucide-react";

import { useBusiness, useUpdateBusiness } from "@/shared/hooks/useBusiness";
import { exportToCSV } from "@/shared/lib/utils";
import { useSession } from "next-auth/react";
import { useProfile, useUpdateProfile, useChangePassword } from "@/shared/hooks/useProfile";
import { useSetup2FA, useVerify2FA, useDisable2FA } from "@/shared/hooks/useTwoFactor";
import { useBackupHistory, useExportBackup, useDeleteBackup } from "@/shared/hooks/useBackup";
import TwoFactorSetupModal from "@/shared/ui/modals/TwoFactorSetupModal";
import { useAutomationSettings, useUpdateAutomationSettings } from "@/shared/hooks/useAutomationSettings";

function EmployeeSettingsView() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { update } = useSession();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({ name: profile.name || "", phone: profile.phone || "" });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await updateProfile.mutateAsync(form);
      await update({ name: form.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User size={18} /> My Profile</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-primary/40 text-sm py-4">Loading profile...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-primary/40 text-xs mb-1.5 block">Email (Cannot be changed)</label>
                  <input
                    value={profile?.email || ""}
                    disabled
                    className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                      text-primary/50 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-primary/40 text-xs mb-1.5 block">Full Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                      text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-primary/40 text-xs mb-1.5 block">Mobile Number</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                      text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="md"
                  icon={saved ? <CheckCircle size={14} /> : <Save size={14} />}
                  disabled={updateProfile.isPending || !form.name.trim()}
                >
                  {updateProfile.isPending ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                </Button>
                {saved && (
                  <p className="text-emerald-400 text-xs">Profile updated successfully</p>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} /> Role & Department</CardTitle></CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-primary/40 text-xs mb-1 block">Role</p>
                <p className="text-sm font-medium text-primary">{(profile?.role || "").replace("_", " ")}</p>
              </div>
              {profile?.department && (
                <div>
                  <p className="text-primary/40 text-xs mb-1 block">Department</p>
                  <p className="text-sm font-medium text-primary">{profile.department}</p>
                </div>
              )}
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationSettingsTab() {
  const { data: settings, isLoading } = useAutomationSettings();
  const updateSettings = useUpdateAutomationSettings();

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast.success(`${value ? 'Enabled' : 'Disabled'} successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update setting');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <p className="text-primary/40 text-sm py-8 text-center">Loading automation settings...</p>
        </CardContent>
      </Card>
    );
  }

  const automationGroups = [
    {
      title: "Transaction Automation",
      description: "Automate calculations and entries when transactions are created",
      items: [
        {
          key: "autoGst",
          label: "Auto GST Calculation",
          desc: "Automatically calculate CGST/SGST/IGST based on place of supply",
          icon: "🧾",
          enabled: settings?.autoGst ?? true,
        },
        {
          key: "autoJournal",
          label: "Auto Journal Posting",
          desc: "Automatically create double-entry journal entries for sales and payments",
          icon: "📒",
          enabled: settings?.autoJournal ?? true,
        },
        {
          key: "autoStockUpdate",
          label: "Auto Stock Update",
          desc: "Automatically deduct/add stock when sales or returns are processed",
          icon: "📦",
          enabled: settings?.autoStockUpdate ?? true,
        },
        {
          key: "autoReorderAlert",
          label: "Auto Reorder Alerts",
          desc: "Generate notifications when product stock falls below reorder level",
          icon: "🔔",
          enabled: settings?.autoReorderAlert ?? true,
        },
      ],
    },
    {
      title: "AI-Powered Features",
      description: "Requires a Gemini API key in your environment configuration",
      items: [
        {
          key: "aiForecast",
          label: "AI Demand & Sales Forecasting",
          desc: "Use Google Gemini to predict product demand and future sales trends",
          icon: "📈",
          enabled: settings?.aiForecast ?? false,
        },
        {
          key: "aiInsights",
          label: "AI Business Insights",
          desc: "Get AI-generated actionable insights based on your business data",
          icon: "💡",
          enabled: settings?.aiInsights ?? false,
        },
      ],
    },
    {
      title: "Communication",
      description: "Control how the system communicates with you and your customers",
      items: [
        {
          key: "emailNotifications",
          label: "Email Notifications",
          desc: "Send email alerts for urgent notifications (low stock, overdue payments)",
          icon: "📧",
          enabled: settings?.emailNotifications ?? true,
        },
        {
          key: "whatsappButton",
          label: "WhatsApp Quick Share",
          desc: "Show 'Send via WhatsApp' button on invoices and quotations",
          icon: "💬",
          enabled: settings?.whatsappButton ?? true,
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-600/5 border border-violet-500/20">
        <Zap size={13} className="text-violet-400 shrink-0" />
        <p className="text-violet-400 text-xs">
          <strong>Automation Engine Active.</strong> Toggle features below to control what runs automatically when you create sales, payments, and other transactions.
        </p>
      </div>

      {automationGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-sm">{group.title}</CardTitle>
            <p className="text-primary/40 text-xs mt-0.5">{group.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-primary text-sm font-medium">{item.label}</p>
                    <p className="text-primary/40 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <Toggle
                  checked={item.enabled}
                  onChange={(v) => handleToggle(item.key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const tabs = [
  { id: "general", label: "General", icon: Settings },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "roles", label: "User Roles", icon: Users },
  { id: "backup", label: "Backup", icon: Database },
];

function Toggle({ checked, onChange, defaultChecked = true }: { checked?: boolean, onChange?: (v: boolean) => void, defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  const isChecked = checked !== undefined ? checked : on;

  const handleClick = () => {
    if (onChange) onChange(!isChecked);
    else setOn(!isChecked);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative w-10 h-5 rounded-full transition-all duration-200 ${isChecked ? "bg-violet-600" : "bg-primary/5"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${isChecked ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
    </button>
  );
}

const defaultRoles = [
  { name: "Super Admin", permissions: ["All access"], color: "violet" as const },
  { name: "Admin", permissions: ["View Dashboard", "Manage Employees", "Manage Inventory", "Manage Sales & Billing", "View Reports", "View Audit Trail", "Manage Backups"], color: "info" as const },
  { name: "Accountant", permissions: ["Dashboard", "Sales", "Expenses", "Reports", "Accounting", "Loans"], color: "success" as const },
  { name: "Sales Executive", permissions: ["Dashboard", "Sales", "Customers", "Process Payments"], color: "warning" as const },
  { name: "Store Manager", permissions: ["Dashboard", "Employees", "Inventory", "Sales", "Customers", "Reports", "Loans"], color: "info" as const },
  { name: "Employee", permissions: ["Dashboard", "Inventory view", "Sales"], color: "warning" as const },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const { data: profile, refetch: refetchProfile } = useProfile();
  const [activeTab, setActiveTab] = useState("general");
  const [saved, setSaved] = useState(false);

  // Security tab state
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passSaved, setPassSaved] = useState(false);
  const [passError, setPassError] = useState("");
  const changePassword = useChangePassword();

  // 2FA state
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [disableBackupCode, setDisableBackupCode] = useState("");
  const [disableMethod, setDisableMethod] = useState<"totp" | "backup">("totp");
  const [disableError, setDisableError] = useState("");
  const disable2FA = useDisable2FA();

  // Backup state
  const [backupPage, setBackupPage] = useState(1);
  const { data: backupHistory, isLoading: loadingHistory } = useBackupHistory(backupPage);
  const exportBackup = useExportBackup();
  const deleteBackup = useDeleteBackup();

  const handleUpdatePassword = async () => {
    setPassError("");
    if (!passForm.current || !passForm.new || !passForm.confirm) {
      setPassError("Please fill in all password fields."); return;
    }
    if (passForm.new !== passForm.confirm) {
      setPassError("New passwords do not match."); return;
    }
    if (passForm.new.length < 8) {
      setPassError("New password must be at least 8 characters."); return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: passForm.current, newPassword: passForm.new });
      setPassSaved(true);
      setPassForm({ current: "", new: "", confirm: "" });
      setTimeout(() => setPassSaved(false), 4000);
    } catch (err: any) {
      setPassError(err.message || "Failed to update password.");
    }
  };

  // Business info form state
  const { data: business, isLoading: bizLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const [bizForm, setBizForm] = useState({
    name: "", gstNumber: "", ownerName: "", phone: "", address: "",
    bankName: "", accountNumber: "", ifscCode: "", branch: "", gstInclusive: false,
  });

  // Populate form when business data loads
  useEffect(() => {
    if (business) {
      setBizForm({
        name: business.name ?? "",
        gstNumber: business.gstNumber ?? "",
        ownerName: business.ownerName ?? "",
        phone: business.phone ?? "",
        address: business.address ?? "",
        bankName: business.bankName ?? "",
        accountNumber: business.accountNumber ?? "",
        ifscCode: business.ifscCode ?? "",
        branch: business.branch ?? "",
        gstInclusive: business.gstInclusive ?? false,
      });
    }
  }, [business]);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateBusiness.mutateAsync(bizForm as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save business info");
    }
  };

  const handleExportData = (type: string) => {
    if (type === 'csv' || type === 'excel') {
      const data = [{
        "Business Name": business?.name || "",
        "GST Number": business?.gstNumber || "",
        "Owner": business?.ownerName || "",
        "Phone": business?.phone || "",
        "Address": business?.address || "",
        "Bank Name": business?.bankName || "",
        "Account Number": business?.accountNumber || "",
        "IFSC Code": business?.ifscCode || ""
      }];
      exportToCSV(data, `business_data_${type}`);
    } else {
      toast("This export format is coming soon!", { icon: "🚧" });
    }
  };

  return (
    <DashboardLayout title="Settings">
      {session && !isSuperAdmin ? (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-primary">My Settings</h2>
            <p className="text-primary/40 text-sm mt-0.5">Manage your personal profile</p>
          </div>
          <EmployeeSettingsView />
        </>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-primary">Settings & Configuration</h2>
            <p className="text-primary/40 text-sm mt-0.5">Manage your app preferences, security, and roles</p>
          </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Tabs — horizontal scroll on mobile, vertical card on desktop */}
        <div className="lg:hidden overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 p-1 rounded-xl min-w-max" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === id
                    ? "bg-violet-600/20 text-violet-400"
                    : "text-primary/40 hover:text-primary"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* Vertical sidebar on desktop */}
        <Card className="hidden lg:block lg:w-52 flex-shrink-0 p-2 h-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-violet-600/20 text-violet-400"
                  : "text-primary/40 hover:text-primary hover:bg-primary/5"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </Card>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {activeTab === "general" && (
            <>
              <Card>
                <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
                <CardContent>
                  {bizLoading ? (
                    <p className="text-primary/40 text-sm py-4">Loading business info...</p>
                  ) : (
                    <form onSubmit={handleSaveBusiness} className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-primary/70 border-b border-primary/10 pb-2">Basic Details</h3>
                        {[
                          { label: "Business Name", key: "name", placeholder: "My Kirana Store" },
                          { label: "GST Number", key: "gstNumber", placeholder: "27XXXXX0000X1ZX" },
                          { label: "Owner Name", key: "ownerName", placeholder: "Your name" },
                          { label: "Phone", key: "phone", placeholder: "+91 XXXXX XXXXX" },
                          { label: "Address", key: "address", placeholder: "Shop address" },
                        ].map((f) => (
                          <div key={f.key}>
                            <label className="text-primary/40 text-xs mb-1.5 block">{f.label}</label>
                            <input
                              value={(bizForm as any)[f.key]}
                              onChange={(e) => setBizForm({ ...bizForm, [f.key]: e.target.value })}
                              placeholder={f.placeholder}
                              className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                                text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-primary/70 border-b border-primary/10 pb-2">Bank Details</h3>
                        {[
                          { label: "Account Holder Name", key: "bankName", placeholder: "e.g. My Business Pvt Ltd" },
                          { label: "Account Number", key: "accountNumber", placeholder: "e.g. 123456789012" },
                          { label: "IFSC Code", key: "ifscCode", placeholder: "e.g. SBIN0000001" },
                          { label: "Bank & Branch Name", key: "branch", placeholder: "e.g. State Bank of India, Main Branch" },
                        ].map((f) => (
                          <div key={f.key}>
                            <label className="text-primary/40 text-xs mb-1.5 block">{f.label}</label>
                            <input
                              value={(bizForm as any)[f.key]}
                              onChange={(e) => setBizForm({ ...bizForm, [f.key]: e.target.value })}
                              placeholder={f.placeholder}
                              className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                                text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <Button
                          size="md"
                          icon={saved ? <CheckCircle size={14} /> : <Save size={14} />}
                          disabled={updateBusiness.isPending}
                        >
                          {updateBusiness.isPending ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                        </Button>
                        {saved && (
                          <p className="text-emerald-400 text-xs">Business info updated successfully</p>
                        )}
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: "gst", label: "GST Inclusive Pricing", desc: "Show GST included in product prices", on: bizForm.gstInclusive },
                    { id: "alerts", label: "Low Stock Alerts", desc: "Get notified when stock falls below minimum", on: true },
                    { id: "invoice", label: "Auto Invoice Number", desc: "Auto-generate invoice numbers", on: true },
                  ].map((pref) => (
                    <div key={pref.label} className="flex items-center justify-between">
                      <div>
                        <p className="text-primary text-sm font-medium">{pref.label}</p>
                        <p className="text-primary/40 text-xs mt-0.5">{pref.desc}</p>
                      </div>
                      <Toggle
                        checked={pref.id === "gst" ? bizForm.gstInclusive : undefined}
                        onChange={
                          pref.id === "gst"
                            ? async (v) => {
                                setBizForm(prev => ({ ...prev, gstInclusive: v }));
                                await updateBusiness.mutateAsync({ gstInclusive: v } as any);
                              }
                            : undefined
                        }
                        defaultChecked={pref.on}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "automation" && (
            <AutomationSettingsTab />
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Lock size={18} /> Change Password</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {/* Error / success banners */}
                  {passError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                      <AlertCircle size={13} />{passError}
                    </div>
                  )}
                  {passSaved && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                      <CheckCircle size={13} />Password updated successfully!
                    </div>
                  )}
                  {/* hidden username for autofill hygiene */}
                  <input type="text" name="fakeusernameremembered" autoComplete="username" style={{ display: "none" }} />
                  <div>
                    <label className="text-primary/40 text-xs mb-1.5 block">Current Password</label>
                    <div className="relative">
                      <input type={showCurrent ? "text" : "password"} value={passForm.current}
                        onChange={(e) => { setPassError(""); setPassForm({ ...passForm, current: e.target.value }); }}
                        autoComplete="current-password" placeholder="Enter current password"
                        className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-primary focus:outline-none focus:border-violet-500/50" />
                      <button type="button" onClick={() => setShowCurrent(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors">
                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-primary/40 text-xs mb-1.5 block">New Password</label>
                    <div className="relative">
                      <input type={showNew ? "text" : "password"} value={passForm.new}
                        onChange={(e) => { setPassError(""); setPassForm({ ...passForm, new: e.target.value }); }}
                        autoComplete="new-password" placeholder="Min 8 chars, A-Z, 0-9, special"
                        className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-primary focus:outline-none focus:border-violet-500/50" />
                      <button type="button" onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors">
                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-primary/40 text-xs mb-1.5 block">Confirm New Password</label>
                    <input type="password" value={passForm.confirm}
                      onChange={(e) => { setPassError(""); setPassForm({ ...passForm, confirm: e.target.value }); }}
                      autoComplete="new-password" placeholder="Re-enter new password"
                      className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button size="md" onClick={handleUpdatePassword}
                      disabled={changePassword.isPending || !passForm.current || !passForm.new || !passForm.confirm}
                      icon={passSaved ? <CheckCircle size={14} /> : <Lock size={14} />}>
                      {changePassword.isPending ? "Updating..." : passSaved ? "Updated!" : "Update Password"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield size={18} /> Two-Factor Authentication (2FA)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile?.twoFactorEnabled ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                        <CheckCircle size={16} />
                        <span>Two-factor authentication is active on your account.</span>
                      </div>
                      <p className="text-primary/60 text-xs leading-relaxed">
                        Every time you log in, you will be prompted for a 6-digit verification code from your authenticator app (e.g., Google Authenticator, Authy).
                      </p>
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Lock size={14} />}
                        onClick={() => {
                          setDisableError("");
                          setDisablePassword("");
                          setDisableToken("");
                          setDisableBackupCode("");
                          setShow2FADisable(true);
                        }}
                      >
                        Disable 2FA
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-primary/60 text-sm">
                        Protect your account with an extra layer of security.
                      </div>
                      <p className="text-primary/60 text-xs leading-relaxed">
                        Scan a QR code using an authenticator app to set up temporary verification codes.
                      </p>
                      <Button
                        size="md"
                        icon={<Shield size={14} />}
                        onClick={() => setShow2FASetup(true)}
                      >
                        Enable 2FA
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "roles" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={18} /> User Roles & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-600/5 border border-violet-500/20">
                  <Shield size={13} className="text-violet-400 shrink-0" />
                  <p className="text-violet-400 text-xs">
                    <strong>Business RBAC is active.</strong> Below are the default system-defined roles. Assign roles to employees or edit custom roles from the Roles page.
                  </p>
                </div>
                {defaultRoles.map((role) => (
                  <div key={role.name} className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={role.color}>{role.name}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.map((perm) => (
                        <span key={perm} className="px-2 py-0.5 bg-primary/5 rounded-md text-primary/50 text-xs">{perm}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell size={18} /> Notification Preferences
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 ml-1">
                    <Clock size={9} /> Coming Soon
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <Clock size={13} className="text-amber-400 shrink-0" />
                  <p className="text-amber-400 text-xs">Granular notification preferences are coming in a future update. Your system already sends critical alerts (low stock, new sales) automatically.</p>
                </div>
                {[
                  { label: "Low Stock Alerts", desc: "Alert when stock falls below minimum" },
                  { label: "New Sale Notifications", desc: "Notify on each new invoice" },
                  { label: "Payment Due Reminders", desc: "Daily reminders for unpaid dues" },
                  { label: "Monthly Report Email", desc: "Email monthly P&L report" },
                  { label: "Employee Attendance Alert", desc: "Alert on absences" },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between opacity-50">
                    <div>
                      <p className="text-primary text-sm font-medium">{n.label}</p>
                      <p className="text-primary/40 text-xs">{n.desc}</p>
                    </div>
                    <Toggle checked={false} onChange={() => {}} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "backup" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={18} /> Data Backup & Export
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <p className="text-emerald-400 text-sm font-medium">✓ Neon Serverless Postgres</p>
                  <p className="text-primary/40 text-xs mt-0.5">
                    Your database is automatically backed up daily by Neon's built-in point-in-time recovery. No manual action required.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-primary text-sm font-medium">Manual Backup Export</p>
                      <p className="text-primary/40 text-xs">Generate and download a complete export of all business data.</p>
                    </div>
                    <Button
                      disabled={exportBackup.isPending}
                      icon={<Database size={14} />}
                      onClick={async () => {
                        try {
                          await exportBackup.mutateAsync();
                          toast.success("Backup downloaded successfully!");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to generate backup");
                        }
                      }}
                    >
                      {exportBackup.isPending ? "Generating..." : "Export Now"}
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t border-primary/10">
                  <h3 className="text-sm font-semibold text-primary/70 mb-3">Backup History</h3>
                  {loadingHistory ? (
                    <p className="text-primary/40 text-xs py-4">Loading history...</p>
                  ) : !backupHistory?.data?.length ? (
                    <p className="text-primary/40 text-xs py-4">No backups found</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs text-primary/70">
                          <thead>
                            <tr className="border-b border-primary/10 text-primary/40">
                              <th className="py-2 font-medium">Date & Time</th>
                              <th className="py-2 font-medium">Type</th>
                              <th className="py-2 font-medium">Status</th>
                              <th className="py-2 font-medium">File Size</th>
                              <th className="py-2 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backupHistory.data.map((b) => (
                              <tr key={b.id} className="border-b border-primary/5 hover:bg-primary/3">
                                <td className="py-2.5 font-mono">{new Date(b.createdAt).toLocaleString()}</td>
                                <td className="py-2.5">
                                  <Badge variant={b.type === "MANUAL" ? "violet" : "info"}>{b.type}</Badge>
                                </td>
                                <td className="py-2.5">
                                  <Badge variant={b.status === "COMPLETED" ? "success" : b.status === "FAILED" ? "danger" : "warning"}>
                                    {b.status}
                                  </Badge>
                                </td>
                                <td className="py-2.5 text-primary/50 font-mono">
                                  {b.fileSize ? `${(b.fileSize / 1024).toFixed(2)} KB` : "—"}
                                </td>
                                <td className="py-2.5 text-right font-mono">
                                  <button
                                    disabled={deleteBackup.isPending}
                                    onClick={async () => {
                                      if (confirm("Delete this backup record?")) {
                                        try {
                                          await deleteBackup.mutateAsync(b.id);
                                          toast.success("Backup record deleted");
                                        } catch (err: any) {
                                          toast.error(err.message);
                                        }
                                      }
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/40 hover:text-rose-400 transition-all"
                                    title="Delete Record"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination */}
                      {backupHistory.pagination && backupHistory.pagination.totalPages > 1 && (
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={backupPage === 1}
                            onClick={() => setBackupPage(p => p - 1)}
                          >
                            Previous
                          </Button>
                          <span className="text-xs text-primary/40 self-center">
                            Page {backupPage} of {backupHistory.pagination.totalPages}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={backupPage === backupHistory.pagination.totalPages}
                            onClick={() => setBackupPage(p => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <TwoFactorSetupModal
        open={show2FASetup}
        onClose={() => setShow2FASetup(false)}
        onSuccess={() => {
          refetchProfile();
          toast.success("2FA Setup completed successfully");
        }}
      />

      {show2FADisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-primary/10 p-6 max-h-[85vh] overflow-y-auto"
            style={{ background: "var(--bg-surface)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <Shield size={18} className="text-rose-400" />
                Disable Two-Factor Auth
              </h3>
              <button onClick={() => setShow2FADisable(false)} className="p-1 rounded-lg hover:bg-primary/10 text-primary/40">
                <X size={18} />
              </button>
            </div>

            {disableError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-4">
                <AlertCircle size={13} />{disableError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-primary/40 text-xs mb-1.5 block">Confirm Password</label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={e => setDisablePassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                    text-primary focus:outline-none focus:border-violet-500/50"
                />
              </div>

              <div className="flex border-b border-primary/10 mb-2">
                <button
                  type="button"
                  onClick={() => setDisableMethod("totp")}
                  className={`flex-1 pb-2 text-center text-xs font-semibold border-b-2 transition-all ${
                    disableMethod === "totp" ? "border-violet-500 text-violet-400" : "border-transparent text-primary/40"
                  }`}
                >
                  TOTP Code
                </button>
                <button
                  type="button"
                  onClick={() => setDisableMethod("backup")}
                  className={`flex-1 pb-2 text-center text-xs font-semibold border-b-2 transition-all ${
                    disableMethod === "backup" ? "border-violet-500 text-violet-400" : "border-transparent text-primary/40"
                  }`}
                >
                  Backup Code
                </button>
              </div>

              {disableMethod === "totp" ? (
                <div>
                  <label className="text-primary/40 text-xs mb-1.5 block">6-Digit Authenticator Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={disableToken}
                    onChange={e => setDisableToken(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-center font-mono tracking-widest text-primary focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-primary/40 text-xs mb-1.5 block">8-Character Backup Code</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={disableBackupCode}
                    onChange={e => setDisableBackupCode(e.target.value.toUpperCase().trim())}
                    placeholder="ABC123XYZ"
                    className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-center font-mono tracking-widest text-primary focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="danger"
                  disabled={disable2FA.isPending || !disablePassword || (disableMethod === "totp" ? disableToken.length !== 6 : !disableBackupCode)}
                  onClick={async () => {
                    setDisableError("");
                    try {
                      await disable2FA.mutateAsync({
                        password: disablePassword,
                        token: disableMethod === "totp" ? disableToken : undefined,
                        backupCode: disableMethod === "backup" ? disableBackupCode : undefined,
                      });
                      toast.success("Two-factor authentication disabled");
                      setShow2FADisable(false);
                      refetchProfile();
                    } catch (err: any) {
                      setDisableError(err.message);
                    }
                  }}
                >
                  {disable2FA.isPending ? "Disabling..." : "Disable 2FA"}
                </Button>
                <Button variant="secondary" onClick={() => setShow2FADisable(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </DashboardLayout>
  );
}
