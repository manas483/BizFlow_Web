"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import {
  CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle,
  Plus, Loader2, ChevronLeft, ChevronRight, Trash2, X, Flag,
} from "lucide-react";

const LEAVE_TYPES = [
  { value: "sick",   label: "Sick Leave",   color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "casual", label: "Casual Leave", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "annual", label: "Annual Leave", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { value: "unpaid", label: "Unpaid Leave", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "other",  label: "Other",        color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
];

const STATUS_COLORS: Record<string, { dot: string; bg: string }> = {
  present:  { dot: "bg-emerald-500", bg: "bg-emerald-500/15" },
  absent:   { dot: "bg-rose-500",    bg: "bg-rose-500/15"    },
  leave:    { dot: "bg-violet-500",  bg: "bg-violet-500/15"  },
  half_day: { dot: "bg-amber-500",   bg: "bg-amber-500/15"   },
};

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

export default function MyAttendancePage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [leaves,       setLeaves]       = useState<any[]>([]);
  const [loadingAtt,   setLoadingAtt]   = useState(true);
  const [loadingLeaves,setLoadingLeaves]= useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [activeTab,    setActiveTab]    = useState<"attendance" | "leaves" | "disputes">("attendance");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // L-6: Dispute state
  const [disputeDay,      setDisputeDay]      = useState<string | null>(null);
  const [disputeForm,     setDisputeForm]     = useState({ expectedStatus: "present", issue: "" });
  const [submittingDisp,  setSubmittingDisp]  = useState(false);
  const [dispError,       setDispError]       = useState("");
  const [dispSuccess,     setDispSuccess]     = useState("");
  const [tickets,         setTickets]         = useState<any[]>([]);
  const [loadingTickets,  setLoadingTickets]  = useState(true);
  const [leaveForm,    setLeaveForm]    = useState({ 
    type: "casual", 
    startDate: new Date().toISOString().split("T")[0], 
    endDate: new Date().toISOString().split("T")[0], 
    reason: "" 
  });

  const joinDate = attendanceData?.employee?.joinDate
    ? new Date(attendanceData.employee.joinDate)
    : null;
  const joinDay   = joinDate ? new Date(joinDate.getFullYear(), joinDate.getMonth(), joinDate.getDate()) : null;
  const joinMonth = joinDate?.getMonth()  ?? 0;
  const joinYear  = joinDate?.getFullYear() ?? currentYear;

  // On first data load, ensure calendar is not showing a month before join date
  useEffect(() => {
    if (!joinDate) return;
    const isBeforeJoin = currentYear < joinYear || (currentYear === joinYear && currentMonth < joinMonth);
    if (isBeforeJoin) {
      setCurrentMonth(joinMonth);
      setCurrentYear(joinYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinYear, joinMonth]);

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  useEffect(() => {
    setLoadingAtt(true);
    fetch(`/api/attendance/my?month=${monthKey}`)
      .then(r => r.json()).then(d => setAttendanceData(d))
      .finally(() => setLoadingAtt(false));
  }, [monthKey]);

  useEffect(() => {
    setLoadingLeaves(true);
    fetch("/api/leaves").then(r => r.json())
      .then(d => setLeaves(Array.isArray(d) ? d : []))
      .finally(() => setLoadingLeaves(false));
  }, []);

  // L-6: Fetch dispute tickets
  useEffect(() => {
    setLoadingTickets(true);
    fetch("/api/attendance/tickets").then(r => r.json())
      .then(d => setTickets(Array.isArray(d) ? d : []))
      .finally(() => setLoadingTickets(false));
  }, []);

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDay) return;
    setDispError(""); setDispSuccess(""); setSubmittingDisp(true);
    try {
      const res = await fetch("/api/attendance/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: disputeDay, expectedStatus: disputeForm.expectedStatus, issue: disputeForm.issue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to raise dispute");
      setTickets(p => [data, ...p]);
      setDispSuccess(`Dispute for ${disputeDay} submitted. Admin will review it.`);
      setDisputeDay(null);
      setDisputeForm({ expectedStatus: "present", issue: "" });
    } catch (err: any) { setDispError(err.message); }
    finally { setSubmittingDisp(false); }
  };

  const prevMonth = () => {
    // Never go before the join month
    const atJoinMonth = currentYear === joinYear && currentMonth === joinMonth;
    if (atJoinMonth) return;
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y-1); } else setCurrentMonth(m => m-1);
  };
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y+1); } else setCurrentMonth(m => m+1); };

  // Is the prev button disabled?
  const isPrevDisabled = joinDate
    ? (currentYear === joinYear && currentMonth === joinMonth)
    : false;

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess(""); setSubmitting(true);
    try {
      const res = await fetch("/api/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leaveForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLeaves(p => [data, ...p]);
      setSuccess("Leave request submitted!");
      setShowForm(false);
      const today = new Date().toISOString().split("T")[0];
      setLeaveForm({ type: "casual", startDate: today, endDate: today, reason: "" });
      setActiveTab("leaves");
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleCancelRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    try {
      const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLeaves(p => p.filter(l => l.id !== id));
        setSuccess("Leave request cancelled successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to cancel leave request");
      }
    } catch (e: any) {
      setError("Network error: " + e.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const attendanceMap: Record<string, string> = {};
  (attendanceData?.records || []).forEach((r: any) => { attendanceMap[r.date] = r.status; });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay    = getFirstDay(currentYear, currentMonth);
  const summary     = attendanceData?.summary || { present: 0, absent: 0, leave: 0, halfDay: 0 };
  const monthName   = new Date(currentYear, currentMonth).toLocaleString("default", { month: "long", year: "numeric" });
  const isFutureMonth = currentYear > today.getFullYear() || (currentYear === today.getFullYear() && currentMonth >= today.getMonth());

  return (
    <DashboardLayout title="My Attendance">
      {/* ── Full-height page shell ── */}
      <div className="flex flex-col gap-2 h-full min-h-0">

        {/* ── Row 1: Header + Action ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-primary leading-tight tracking-tight">My Attendance &amp; Leaves</h2>
            <p className="text-primary/40 text-[11px] mt-1 font-medium">Track attendance and manage leave requests</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition-all active:scale-95 shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]">
            <Plus size={14} className="stroke-[3]" /> Apply for Leave
          </button>
        </div>

        {/* Toasts */}
        {success && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"><CheckCircle2 size={13}/>{success}</div>}
        {error   && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs"><AlertCircle size={13}/>{error}</div>}

        {/* ── Row 2: Stat pills (single compact row) ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Present",  value: summary.present,  icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", borderHover: "hover:border-emerald-500/30", glow: "group-hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]" },
            { label: "Absent",   value: summary.absent,   icon: XCircle,      color: "text-rose-400",    bg: "bg-rose-500/10",    borderHover: "hover:border-rose-500/30",    glow: "group-hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]" },
            { label: "On Leave", value: summary.leave,    icon: CalendarDays, color: "text-violet-400",  bg: "bg-violet-500/10",  borderHover: "hover:border-violet-500/30",  glow: "group-hover:shadow-[0_0_15px_-3px_rgba(139,92,246,0.15)]" },
            { label: "Half Day", value: summary.halfDay,  icon: Clock,        color: "text-amber-400",   bg: "bg-amber-500/10",   borderHover: "hover:border-amber-500/30",   glow: "group-hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]" },
          ].map(({ label, value, icon: Icon, color, bg, borderHover, glow }) => (
            <div key={label} className={`group relative overflow-hidden rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all duration-300 ${borderHover} ${glow}`}
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
              {/* Subtle background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                <Icon size={16} className={color} />
              </div>
              <div>
                <p className="text-xl font-black text-primary leading-none tracking-tight">{value}</p>
                <p className="text-[11px] font-semibold text-primary/40 mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 3: Tabs ── */}
        <div className="flex gap-1.5 p-1 rounded-xl border w-fit shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          {(["attendance", "leaves", "disputes"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeTab === tab
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]"
                  : "text-primary/50 hover:text-primary hover:bg-primary/5"
              }`}>
              {tab === "attendance" ? "Attendance Calendar"
                : tab === "leaves" ? `My Leaves (${leaves.length})`
                : `Disputes (${tickets.length})`}
            </button>
          ))}
        </div>

        {/* ── Row 4: Calendar ── fills all remaining space ── */}
        {activeTab === "attendance" && (
          <div className="rounded-2xl border flex flex-col p-3 flex-1 min-h-0"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>

            {/* Month navigator */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} disabled={isPrevDisabled}
                className="p-1.5 rounded-lg hover:bg-primary/5 text-primary/50 hover:text-primary transition-colors disabled:opacity-20 disabled:pointer-events-none">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold text-primary">{monthName}</span>
              <button onClick={nextMonth} disabled={isFutureMonth}
                className="p-1.5 rounded-lg hover:bg-primary/5 text-primary/50 hover:text-primary transition-colors disabled:opacity-30">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-primary/25 py-0.5">{d}</div>
              ))}
            </div>

            {/* Calendar grid — rows stretch to fill remaining space */}
            {loadingAtt ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-violet-400" size={20} />
              </div>
            ) : (
              <div
                className="grid grid-cols-7 gap-0.5 flex-1 min-h-0"
                style={{ gridAutoRows: "minmax(0, 1fr)" }}
              >
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day      = i + 1;
                  const dateStr  = `${currentYear}-${String(currentMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const thisDay  = new Date(currentYear, currentMonth, day);
                  const status   = attendanceMap[dateStr];
                  const isToday  = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                  const isWkEnd  = thisDay.getDay() % 6 === 0;
                  const isFuture = thisDay > today;
                  // Days before join date are completely muted
                  const isPreJoin = joinDay ? thisDay < joinDay : false;
                  const sc       = (status && !isPreJoin) ? STATUS_COLORS[status] : null;

                  const isJoinDay = joinDay
                    ? thisDay.getTime() === joinDay.getTime()
                    : false;

                  const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isDisputable = !isWkEnd && !isPreJoin && !isFuture && !isJoinDay;
                  const hasTicket = tickets.some(t => t.date === dayStr);
                  return (
                    <div key={day}
                      title={isJoinDay ? "📅 Joined" : isDisputable ? "Click to raise dispute" : undefined}
                      onClick={isDisputable ? () => { setDisputeDay(disputeDay === dayStr ? null : dayStr); setDisputeForm({ expectedStatus: "present", issue: "" }); setDispError(""); } : undefined}
                      className={`relative flex flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-all
                        ${isDisputable ? "cursor-pointer hover:ring-1 hover:ring-amber-400/40" : ""}
                        ${disputeDay === dayStr ? "ring-2 ring-amber-400" : ""}
                        ${isToday && !isPreJoin ? "ring-1 ring-violet-500" : ""}
                        ${isJoinDay            ? "ring-1 ring-emerald-500/60" : ""}
                        ${isWkEnd || isPreJoin  ? "opacity-20" : ""}
                        ${sc && !isWkEnd && !isPreJoin ? sc.bg : ""}
                      `}
                      style={!sc || isWkEnd || isPreJoin ? { background: "var(--bg-surface-2)" } : {}}>
                      <span className={`text-[11px] sm:text-xs ${
                        isPreJoin  ? "text-primary/30" :
                        isToday    ? "text-violet-400 font-bold" :
                        isJoinDay  ? "text-emerald-400 font-semibold" :
                        isFuture   ? "text-primary/20" :
                                     "text-primary/70"
                      }`}>
                        {day}
                      </span>
                      {isJoinDay && !isPreJoin && (
                        <div className="w-1 h-1 rounded-full mt-0.5 bg-emerald-500" />
                      )}
                      {sc && !isJoinDay && !isWkEnd && !isPreJoin && (
                        <div className={`w-1 h-1 rounded-full mt-0.5 ${sc.dot}`} />
                      )}
                      {hasTicket && !isWkEnd && !isPreJoin && (
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" title="Dispute raised" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex gap-3 pt-1 flex-wrap">
              {Object.entries(STATUS_COLORS).map(([status, { dot }]) => (
                <div key={status} className="flex items-center gap-1 text-[10px] text-primary/40">
                  <div className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className="capitalize">{status.replace("_", " ")}</span>
                </div>
              ))}
              {joinDay && (
                <div className="flex items-center gap-1 text-[10px] text-primary/40">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-emerald-500/60" />
                  <span>Joined</span>
                </div>
              )}
            </div>

            {/* L-6: Dispute inline form */}
            {disputeDay && (
              <form onSubmit={handleSubmitDispute} className="mt-3 p-3 rounded-xl border border-amber-400/20 bg-amber-500/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5"><Flag size={12} />Raise Dispute for <span className="font-mono">{disputeDay}</span></p>
                  <button type="button" onClick={() => setDisputeDay(null)} className="text-primary/30 hover:text-primary/60 transition-colors"><X size={13} /></button>
                </div>
                {dispError && <p className="text-[11px] text-rose-400">{dispError}</p>}
                {dispSuccess && <p className="text-[11px] text-emerald-400">{dispSuccess}</p>}
                <div>
                  <label className="text-[10px] text-primary/40 block mb-1">What should the status have been?</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["present","half_day","leave","absent"] as const).map(s => (
                      <button key={s} type="button"
                        onClick={() => setDisputeForm(f => ({ ...f, expectedStatus: s }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border capitalize transition-all ${
                          disputeForm.expectedStatus === s
                            ? "bg-amber-500/20 border-amber-400/40 text-amber-400"
                            : "border-primary/10 text-primary/40 hover:border-primary/20"
                        }`}>{s.replace("_"," ")}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-primary/40 block mb-1">Describe the issue (min. 10 chars)</label>
                  <textarea
                    value={disputeForm.issue}
                    onChange={e => setDisputeForm(f => ({ ...f, issue: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-primary/5 border border-primary/10 text-primary placeholder:text-primary/30 focus:outline-none focus:border-amber-400/40 resize-none"
                    placeholder="e.g. I was present but marked absent on this date"
                    required minLength={10}
                  />
                </div>
                <button type="submit" disabled={submittingDisp || disputeForm.issue.length < 10}
                  className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-400/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                  {submittingDisp ? <Loader2 size={11} className="animate-spin" /> : <Flag size={11} />}
                  Submit Dispute
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Leaves tab ── */}
        {activeTab === "leaves" && (
          <div className="space-y-2 overflow-y-auto flex-1">
            {loadingLeaves ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-400" size={22} /></div>
            ) : leaves.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
                <CalendarDays className="mx-auto text-primary/20 mb-2" size={34} />
                <p className="text-primary/40 text-sm">No leave requests yet</p>
                <button onClick={() => setShowForm(true)} className="mt-2 text-violet-400 text-xs hover:text-violet-300 transition-colors">Apply for leave →</button>
              </div>
            ) : leaves.map((leave) => {
              const lt    = LEAVE_TYPES.find(t => t.value === leave.type);
              const start = new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              const end   = new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
              const days  = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / 86400000) + 1;
              let isOverridden = false;
              if (leave.status === "APPROVED") {
                const cur = new Date(leave.startDate);
                const endDt = new Date(leave.endDate);
                while (cur <= endDt) {
                  const dateStr = cur.toISOString().split('T')[0];
                  if (attendanceMap[dateStr] === "present" || attendanceMap[dateStr] === "half-day") {
                    isOverridden = true;
                    break;
                  }
                  cur.setDate(cur.getDate() + 1);
                }
              }

              return (
                <div key={leave.id} className="rounded-xl border px-4 py-3 flex items-start justify-between gap-3"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${lt?.color}`}>{lt?.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        leave.status === "APPROVED" && !isOverridden ? "bg-emerald-500/20 text-emerald-400" :
                        leave.status === "APPROVED" && isOverridden ? "bg-blue-500/20 text-blue-400" :
                        leave.status === "REJECTED" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {leave.status === "APPROVED" && isOverridden ? "OVERRIDDEN (PRESENT)" : leave.status}
                      </span>
                      <span className="text-[10px] text-primary/30">{days}d</span>
                    </div>
                    <p className="text-xs font-medium text-primary">{start} → {end}</p>
                    <p className="text-[10px] text-primary/50 mt-0.5 truncate">{leave.reason}</p>
                    {leave.adminNote && <p className="text-[10px] text-primary/40 italic mt-0.5">Note: {leave.adminNote}</p>}
                  </div>
                  {leave.status === "PENDING" && (
                    <button onClick={() => handleCancelRequest(leave.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/30 hover:text-rose-400 transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Leave Form Modal ── */}
      {showForm && (() => {
        // Calculate dynamic days
        const start = new Date(leaveForm.startDate);
        const end = new Date(leaveForm.endDate);
        const days = start && end && start <= end ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md rounded-2xl border p-6 shadow-[0_0_40px_-10px_rgba(139,92,246,0.2)] animate-in zoom-in-95 duration-300" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                  <CalendarDays size={18} />
                </div>
                <h3 className="text-lg font-bold text-primary">Apply for Leave</h3>
              </div>
              <p className="text-xs text-primary/40 mb-5 ml-9">Submit your request for Super Admin approval</p>
            {error && <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex gap-2"><AlertCircle size={13}/>{error}</div>}
            <form onSubmit={handleApplyLeave} className="space-y-3">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-primary/70 mb-2">Leave Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEAVE_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setLeaveForm(f => ({ ...f, type: t.value }))}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                        leaveForm.type === t.value 
                          ? t.color + " border-current shadow-[0_0_15px_-3px_currentColor]" 
                          : "border-primary/10 text-primary/50 hover:border-primary/30 hover:bg-primary/5"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Dates */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-primary/70">Duration</label>
                  {days > 0 && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-in fade-in slide-in-from-right-2">
                      {days} {days === 1 ? 'day' : 'days'} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-primary/50 mb-1">Start Date</label>
                    <input type="date" required min={today.toISOString().split("T")[0]} value={leaveForm.startDate}
                      style={{ colorScheme: "dark" }}
                      onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
                      className="w-full bg-primary/5 border border-primary/10 rounded-xl px-3 py-2.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all cursor-pointer"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-primary/50 mb-1">End Date</label>
                    <input type="date" required min={leaveForm.startDate || today.toISOString().split("T")[0]} value={leaveForm.endDate}
                      style={{ colorScheme: "dark" }}
                      onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                      className="w-full bg-primary/5 border border-primary/10 rounded-xl px-3 py-2.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all cursor-pointer"/>
                  </div>
                </div>
              </div>
              {/* Reason */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-primary/70">Reason</label>
                  <span className={`text-[10px] font-medium transition-colors ${leaveForm.reason.length < 3 ? "text-rose-400" : "text-emerald-400"}`}>
                    {leaveForm.reason.length}/3 min
                  </span>
                </div>
                <textarea required minLength={3} rows={3} value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Sick, family emergency, personal..."
                  className="w-full bg-primary/5 border border-primary/10 rounded-xl px-3 py-2.5 text-xs text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none transition-all"/>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowForm(false); setError(""); }}
                  className="flex-1 py-3 rounded-xl border border-primary/20 text-primary/70 text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all active:scale-95">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]">
                  {submitting && <Loader2 size={14} className="animate-spin"/>}
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
          </div>
        );
      })()}

      {/* ── Custom Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-2xl border p-6 shadow-xl animate-in zoom-in-95 duration-300" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary">Cancel Leave Request</h3>
                <p className="text-xs text-primary/50 mt-0.5">Are you sure you want to cancel this leave request? This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-primary/60 hover:bg-primary/5 transition-colors">
                Keep Request
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]">
                Yes, Cancel It
              </button>
            </div>
          </div>
        </div>
      )}
      {/* L-6: Disputes tab */}
      {activeTab === "disputes" && (
        <div className="space-y-2 overflow-y-auto flex-1">
          {dispSuccess && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"><CheckCircle2 size={13}/>{dispSuccess}</div>}
          {loadingTickets ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-400" size={22} /></div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <Flag className="mx-auto text-primary/20 mb-2" size={34} />
              <p className="text-primary/40 text-sm">No disputes raised yet</p>
              <p className="text-primary/30 text-xs mt-1">Click any past date on the Attendance Calendar to raise a dispute</p>
            </div>
          ) : tickets.map((t: any) => (
            <div key={t.id} className="rounded-2xl border p-4 space-y-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-primary font-mono">{t.date}</p>
                  <p className="text-xs text-primary/40 mt-0.5">{t.issue}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  t.status === "OPEN"       ? "bg-amber-500/15 text-amber-400" :
                  t.status === "IN_REVIEW"  ? "bg-blue-500/15 text-blue-400"   :
                  t.status === "RESOLVED"   ? "bg-emerald-500/15 text-emerald-400" :
                  t.status === "REJECTED"   ? "bg-rose-500/15 text-rose-400"   : "bg-primary/10 text-primary/50"
                }`}>{t.status?.replace("_"," ")}</span>
              </div>
              <div className="flex gap-3 text-[10px] text-primary/40">
                <span>Recorded: <span className="text-primary/60 capitalize">{t.recordedStatus ?? "none"}</span></span>
                <span>Expected: <span className="text-amber-400 capitalize">{t.expectedStatus?.replace("_"," ")}</span></span>
              </div>
              {t.adminNote && (
                <p className="text-[11px] text-primary/50 bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/10">Admin note: {t.adminNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
