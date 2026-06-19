"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card } from "@/shared/ui/ui/Card";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { StatCard } from "@/shared/ui/ui/StatCard";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";
import {
  useEmployees, useDeleteEmployee, useResendInvitation, useSuspendEmployee,
} from "@/shared/hooks/useEmployees";
import { formatCurrency, formatDate, getInitials } from "@/shared/lib/utils";
import {
  UserCheck, Plus, Search, IndianRupee, Users, Star, Pencil, Trash2,
  CalendarCheck, Ban, RefreshCw, ShieldAlert, Clock, CheckCircle2, Mail,
  CalendarDays, ThumbsUp, ThumbsDown, Loader2, AlertCircle,
} from "lucide-react";
import AddEmployeeModal from "@/shared/ui/modals/AddEmployeeModal";
import EditEmployeeModal from "@/shared/ui/modals/EditEmployeeModal";
import AttendanceModal from "@/shared/ui/modals/AttendanceModal";

const roleColors: Record<string, "violet" | "info" | "success" | "warning" | "default"> = {
  SUPER_ADMIN: "violet",
  MANAGER: "info",
  ACCOUNTANT: "success",
  STAFF: "warning",
  CUSTOM_ROLE: "default",
};

const statusColors: Record<string, "info" | "warning" | "success" | "danger" | "default"> = {
  INVITATION_SENT: "info",
  PENDING_VERIFICATION: "warning",
  active: "success",
  suspended: "danger",
};

const statusLabels: Record<string, string> = {
  INVITATION_SENT: "Invitation Sent",
  PENDING_VERIFICATION: "Pending Verification",
  active: "Active",
  suspended: "Suspended",
};

const statusIcons: Record<string, React.ReactNode> = {
  INVITATION_SENT: <Mail size={10} />,
  PENDING_VERIFICATION: <Clock size={10} />,
  active: <CheckCircle2 size={10} />,
  suspended: <Ban size={10} />,
};

const STATUS_FILTERS = ["All", "active", "INVITATION_SENT", "PENDING_VERIFICATION", "suspended"];

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any>(null);
  const [attendanceEmployee, setAttendanceEmployee] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string; status: string } | null>(null);
  const [resendTarget, setResendTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [mainTab, setMainTab] = useState<"employees" | "leaves">("employees");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{ id: string; action: "APPROVED" | "REJECTED" } | null>(null);

  // Fetch leave requests once on mount
  useEffect(() => {
    setLoadingLeaves(true);
    fetch("/api/leaves")
      .then(r => r.json())
      .then(d => setLeaves(Array.isArray(d) ? d : []))
      .finally(() => setLoadingLeaves(false));
  }, []); // ← no mainTab dependency; leaves are refreshed after approve/reject actions


  const { data: paged, isLoading } = useEmployees(search);
  const employees = paged?.data ?? [];
  const deleteEmployee = useDeleteEmployee();
  const resendInvitation = useResendInvitation();
  const suspendEmployee = useSuspendEmployee();

  const filtered = statusFilter === "All"
    ? employees
    : employees.filter((e: any) => e.status === statusFilter);

  const totalSalary = employees.reduce((s: number, e: any) => s + e.salary, 0);
  const active = employees.filter((e: any) => e.status === "active").length;
  const pending = employees.filter((e: any) => e.status === "INVITATION_SENT" || e.status === "PENDING_VERIFICATION").length;
  const avgAttendance = employees.length
    ? Math.round(employees.reduce((s: number, e: any) => s + e.attendance, 0) / employees.length)
    : 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
      toast.error("Failed to delete employee");
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    try {
      await suspendEmployee.mutateAsync(suspendTarget.id);
      setSuspendTarget(null);
    } catch {
      setSuspendTarget(null);
      toast.error("Failed to update employee status");
    }
  };

  const handleResend = async () => {
    if (!resendTarget) return;
    try {
      await resendInvitation.mutateAsync(resendTarget.id);
      setResendTarget(null);
    } catch {
      setResendTarget(null);
      toast.error("Failed to resend invitation");
    }
  };

  const handleReviewLeave = async () => {
    if (!reviewTarget) return;
    setReviewingId(reviewTarget.id);
    try {
      const res = await fetch(`/api/leaves/${reviewTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewTarget.action, adminNote }),
      });
      if (res.ok) {
        setLeaves(prev => prev.map(l =>
          l.id === reviewTarget.id ? { ...l, status: reviewTarget.action, adminNote } : l
        ));
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to review leave:", errorData);
        toast.error(`Error: ${errorData.error || errorData.details || "Failed to update leave"}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Network error: " + e.message);
    } finally {
      setReviewingId(null);
      setReviewTarget(null);
      setAdminNote("");
    }
  };


  return (
    <DashboardLayout title="Employees">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-primary">Employee Management</h2>
            <p className="text-primary/40 text-sm mt-0.5">Manage staff, roles, and onboarding</p>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsAddOpen(true)}>
            Add Employee
          </Button>
        </div>

        {/* Main Tab Switcher */}
        <div className="flex gap-1 p-1 rounded-xl border w-fit" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          {([["employees", "Employees"], ["leaves", "Leave Requests"]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setMainTab(tab)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mainTab === tab ? "bg-violet-600 text-white shadow-sm" : "text-primary/50 hover:text-primary"
              }`}
            >
              {label}
              {tab === "leaves" && leaves.filter((l: any) => l.status === "PENDING").length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {leaves.filter((l: any) => l.status === "PENDING").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── LEAVE REQUESTS TAB ── */}
        {mainTab === "leaves" && (
          <div className="space-y-3">
            {loadingLeaves ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-violet-400" size={28} />
              </div>
            ) : leaves.length === 0 ? (
              <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
                <CalendarDays className="mx-auto text-primary/20 mb-3" size={40} />
                <p className="text-primary/40 text-sm">No leave requests yet</p>
              </div>
            ) : (
              leaves.map((leave: any) => {
                const start = new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                const end = new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                const days = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const applied = new Date(leave.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                const isPending = leave.status === "PENDING";
                const isReviewing = reviewingId === leave.id;
                const isTargeted = reviewTarget?.id === leave.id;

                return (
                  <div key={leave.id} className={`rounded-2xl border p-4 transition-all ${isPending ? "border-amber-500/20" : ""}`}
                    style={{ background: "var(--bg-surface)", borderColor: isPending ? undefined : "var(--border)" }}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Employee Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-primary text-sm">{leave.employee?.name}</span>
                          <span className="text-xs text-primary/40">{leave.employee?.department}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            leave.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-400" :
                            leave.status === "REJECTED" ? "bg-rose-500/20 text-rose-400" :
                            "bg-amber-500/20 text-amber-400"
                          }`}>
                            {leave.status}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 capitalize">{leave.type} leave</span>
                          <span className="text-xs text-primary/30">{days}d</span>
                        </div>
                        <p className="text-sm text-primary/80">{start} → {end}</p>
                        <p className="text-xs text-primary/50 mt-1">{leave.reason}</p>
                        {leave.adminNote && (
                          <p className="text-xs text-primary/40 mt-1 italic">Admin note: {leave.adminNote}</p>
                        )}
                        <p className="text-[10px] text-primary/25 mt-2">Applied: {applied} · {leave.employee?.email}</p>
                      </div>

                      {/* Admin Actions */}
                      {isPending && !isTargeted && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            disabled={isReviewing}
                            onClick={() => setReviewTarget({ id: leave.id, action: "APPROVED" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors"
                          >
                            <ThumbsUp size={13} /> Approve
                          </button>
                          <button
                            disabled={isReviewing}
                            onClick={() => setReviewTarget({ id: leave.id, action: "REJECTED" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-colors"
                          >
                            <ThumbsDown size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Confirm Action Panel */}
                    {isTargeted && reviewTarget && (
                      <div className={`mt-3 p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm ${
                        reviewTarget.action === "APPROVED" 
                          ? "border-emerald-500/20 bg-emerald-500/[0.03]" 
                          : "border-rose-500/20 bg-rose-500/[0.03]"
                      }`}>
                        <div className={`flex items-center gap-2 mb-3 ${
                          reviewTarget.action === "APPROVED" ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {reviewTarget.action === "APPROVED" ? <ThumbsUp size={15} /> : <ThumbsDown size={15} />}
                          <p className="text-sm font-bold tracking-tight">
                            {reviewTarget.action === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
                          </p>
                        </div>
                        <input
                          type="text"
                          placeholder="Add a note for the employee (optional)"
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          className={`w-full bg-primary/5 border rounded-xl px-4 py-3 text-xs text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 transition-all mb-4 ${
                            reviewTarget.action === "APPROVED"
                              ? "border-emerald-500/10 focus:ring-emerald-500/30"
                              : "border-rose-500/10 focus:ring-rose-500/30"
                          }`}
                        />
                        <div className="flex justify-end gap-3">
                          <button onClick={() => { setReviewTarget(null); setAdminNote(""); }}
                            className="px-6 py-2.5 rounded-xl border border-primary/20 text-primary/70 text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all active:scale-95">
                            Cancel
                          </button>
                          <button onClick={handleReviewLeave} disabled={!!reviewingId}
                            className={`px-8 py-2.5 rounded-xl text-white text-xs font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 ${
                              reviewTarget.action === "APPROVED" 
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]" 
                                : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]"
                            }`}>
                            {reviewingId ? <Loader2 size={14} className="animate-spin" /> : null}
                            {reviewTarget.action === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}


        {/* Search + Status Filters — employees tab only */}
        {mainTab === "employees" && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-3.5 h-3.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              suppressHydrationWarning
              className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-8 pr-3 py-2 text-xs
                text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-primary/5 border border-primary/10 rounded-lg p-1">
            {STATUS_FILTERS.map((status) => {
              const count = status === "All"
                ? employees.length
                : employees.filter((e: any) => e.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  suppressHydrationWarning
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === status
                      ? "bg-violet-500 text-white shadow-sm"
                      : "text-primary/50 hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  {status === "All" ? "All" : statusLabels[status]}
                  <span className={`text-[10px] ${statusFilter === status ? "text-white/70" : "text-primary/30"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {mainTab === "employees" && (<>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Employees" value={employees.length.toString()} icon={<Users size={18} />} color="blue" />
        <StatCard label="Active Staff" value={active.toString()} icon={<UserCheck size={18} />} color="emerald" />
        <StatCard label="Monthly Salary" value={totalSalary >= 1000 ? `₹${(totalSalary / 1000).toFixed(1)}K` : `₹${totalSalary}`} icon={<IndianRupee size={18} />} color="violet" />
        <StatCard label="Avg Attendance" value={`${avgAttendance}%`} icon={<Star size={18} />} color="amber" />
      </div>

      {/* Pending onboarding banner */}
      {pending > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-center gap-3">
          <ShieldAlert size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            <strong>{pending} employee{pending !== 1 ? 's' : ''}</strong> still need to complete their account setup. Use the resend button to send a fresh invitation.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-primary/40 text-sm">Loading employees...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-primary/40 text-sm">
            {statusFilter !== "All" ? `No ${statusLabels[statusFilter]?.toLowerCase() ?? statusFilter} employees` : "No employees found"}
          </div>
        ) : filtered.map((emp: any) => (
          <Card key={emp.id} hover className="p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0
                ${emp.status === 'suspended'
                  ? 'bg-rose-500/15 text-rose-400'
                  : 'bg-gradient-to-br from-violet-500/30 to-purple-700/30 text-violet-400'
                }`}>
                {getInitials(emp.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${emp.status === 'suspended' ? 'text-primary/40 line-through' : 'text-primary'}`}>
                      {emp.name}
                    </p>
                    <p className="text-primary/40 text-xs mt-0.5 truncate">{emp.email}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Attendance */}
                    {emp.status === 'active' && (
                      <button onClick={() => setAttendanceEmployee(emp)}
                        className="p-1 rounded-lg hover:bg-blue-500/10 text-primary/30 hover:text-blue-400 transition-colors"
                        title="Mark Attendance">
                        <CalendarCheck size={12} />
                      </button>
                    )}
                    {/* Resend Invite */}
                    {(emp.status === 'INVITATION_SENT' || emp.status === 'PENDING_VERIFICATION') && (
                      <button
                        onClick={() => setResendTarget({ id: emp.id, name: emp.name, email: emp.email })}
                        disabled={resendInvitation.isPending}
                        className="p-1 rounded-lg hover:bg-emerald-500/10 text-primary/30 hover:text-emerald-400 transition-colors"
                        title="Resend Invitation">
                        <RefreshCw size={12} className={resendInvitation.isPending ? "animate-spin" : ""} />
                      </button>
                    )}
                    {/* Suspend/Reactivate */}
                    {(emp.status === 'active' || emp.status === 'suspended') && (
                      <button
                        onClick={() => setSuspendTarget({ id: emp.id, name: emp.name, status: emp.status })}
                        className={`p-1 rounded-lg transition-colors ${
                          emp.status === 'suspended'
                            ? 'hover:bg-emerald-500/10 text-primary/30 hover:text-emerald-400'
                            : 'hover:bg-rose-500/10 text-primary/30 hover:text-rose-400'
                        }`}
                        title={emp.status === 'suspended' ? "Reactivate Employee" : "Suspend Employee"}>
                        <Ban size={12} />
                      </button>
                    )}
                    {/* Edit */}
                    <button onClick={() => setEditEmployee(emp)}
                      className="p-1 rounded-lg hover:bg-violet-500/10 text-primary/30 hover:text-violet-400 transition-colors"
                      title="Edit Employee">
                      <Pencil size={12} />
                    </button>
                    {/* Delete */}
                    <button onClick={() => setDeleteTarget({ id: emp.id, name: emp.name })}
                      className="p-1 rounded-lg hover:bg-rose-500/10 text-primary/30 hover:text-rose-400 transition-colors"
                      title="Remove Employee">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  {emp.designation && (
                    <p className="text-primary/60 text-[11px] font-medium uppercase tracking-wider">{emp.designation}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={roleColors[emp.role] || "default"}>
                      {emp.role.replace("_", " ")}
                    </Badge>
                    <span className="text-primary/40 text-xs">{emp.department}</span>
                    <Badge variant={statusColors[emp.status] || "default"} className="ml-auto">
                      <span className="flex items-center gap-1">
                        {statusIcons[emp.status]}
                        {statusLabels[emp.status] || emp.status}
                      </span>
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Stats */}
            {emp.status === 'active' ? (
              <>
                <div className="mt-4 pt-4 border-t border-primary/10 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-primary/40 text-[10px] uppercase tracking-wide">Salary</p>
                    <p className="text-primary font-semibold text-sm mt-0.5">{formatCurrency(emp.salary)}</p>
                  </div>
                  <div>
                    <p className="text-primary/40 text-[10px] uppercase tracking-wide">Attendance</p>
                    <p className={`font-semibold text-sm mt-0.5 ${emp.attendance >= 90 ? "text-emerald-400" : emp.attendance >= 80 ? "text-amber-400" : "text-rose-400"}`}>
                      {emp.attendance}%
                    </p>
                  </div>
                  <div>
                    <p className="text-primary/40 text-[10px] uppercase tracking-wide">Joined</p>
                    <p className="text-primary/40 text-xs mt-0.5">{formatDate(emp.joinDate)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-1 bg-primary/5 rounded-full">
                    <div
                      className={`h-1 rounded-full transition-all ${emp.attendance >= 90 ? "bg-emerald-500" : emp.attendance >= 80 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${emp.attendance}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 pt-4 border-t border-primary/10 flex items-center justify-between">
                <div>
                  <p className="text-primary/40 text-[10px] uppercase tracking-wide">Salary</p>
                  <p className="text-primary font-semibold text-sm mt-0.5">{formatCurrency(emp.salary)}</p>
                </div>
                <div className="text-right">
                  <p className="text-primary/40 text-[10px] uppercase tracking-wide">Joined</p>
                  <p className="text-primary/40 text-xs mt-0.5">{formatDate(emp.joinDate)}</p>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      </>)}

      {/* Modals */}
      <AddEmployeeModal open={isAddOpen} onClose={() => setIsAddOpen(false)} />
      {editEmployee && <EditEmployeeModal employee={editEmployee} onClose={() => setEditEmployee(null)} />}
      {attendanceEmployee && <AttendanceModal employee={attendanceEmployee} onClose={() => setAttendanceEmployee(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Employee"
        message={`Are you sure you want to permanently remove "${deleteTarget?.name}" from the system? This action cannot be undone.`}
        confirmLabel="Remove Employee"
        loading={deleteEmployee.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!suspendTarget}
        title={suspendTarget?.status === 'suspended' ? "Reactivate Employee" : "Suspend Employee"}
        message={
          suspendTarget?.status === 'suspended'
            ? `Reactivate "${suspendTarget?.name}"? They will regain access to the system.`
            : `Suspend "${suspendTarget?.name}"? Their account will be deactivated and they won't be able to log in.`
        }
        confirmLabel={suspendTarget?.status === 'suspended' ? "Reactivate" : "Suspend"}
        loading={suspendEmployee.isPending}
        onConfirm={handleSuspend}
        onCancel={() => setSuspendTarget(null)}
      />

      <ConfirmDialog
        open={!!resendTarget}
        title="Resend Invitation"
        message={`Resend the onboarding invitation to "${resendTarget?.name}" (${resendTarget?.email})? A fresh secure link will be emailed to them.`}
        confirmLabel="Resend Invitation"
        loading={resendInvitation.isPending}
        onConfirm={handleResend}
        onCancel={() => setResendTarget(null)}
      />
    </DashboardLayout>
  );
}
