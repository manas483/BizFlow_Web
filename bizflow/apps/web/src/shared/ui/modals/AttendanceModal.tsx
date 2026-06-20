"use client";
import toast from "react-hot-toast";

import { useState, useEffect } from "react";
import Modal, { ModalFooter, FormField, ModalInput, ModalSelect, ModalTextarea } from "@/shared/ui/ui/Modal";
import { useEmployeeAttendance, useMarkAttendance } from "@/shared/hooks/useEmployees";
import { Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDate } from "@/shared/lib/utils";

interface AttendanceModalProps {
  employee: any;
  onClose: () => void;
}

export default function AttendanceModal({ employee, onClose }: AttendanceModalProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState("present");
  const [note, setNote] = useState("");

  const { data: records = [], isLoading } = useEmployeeAttendance(employee?.id);
  const markAttendance = useMarkAttendance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    try {
      await markAttendance.mutateAsync({
        employeeId: employee.id,
        date,
        status,
        note
      });
      toast.success(`Attendance marked as ${status}!`);
      setNote("");
    } catch (error: any) {
      toast.error(`Failed to mark attendance: ${error.message || "Unknown error"}`);
    }
  };

  const getStatusIcon = (st: string) => {
    if (st === "present") return <CheckCircle2 size={14} className="text-emerald-400" />;
    if (st === "absent") return <XCircle size={14} className="text-rose-400" />;
    return <Clock size={14} className="text-amber-400" />;
  };

  const handleEditRecord = (record: any) => {
    setDate(record.date);
    setStatus(record.status);
    setNote(record.note || "");
  };

  return (
    <Modal
      open={!!employee}
      onClose={onClose}
      title={`Attendance: ${employee?.name}`}
      subtitle="Mark and view recent attendance"
      icon={<Calendar size={20} />}
      iconColor="bg-blue-500/20 text-blue-400"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Date" required>
            <ModalInput
              type="date"
              value={date}
              min={employee?.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : undefined}
              max={new Date().toISOString().split('T')[0]} // Optionally also prevent future dates!
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormField>
          
          <FormField label="Status" required>
            <ModalSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="present">Present</option>
              <option value="half-day">Half Day</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
            </ModalSelect>
          </FormField>
        </div>

        <FormField label="Note (Optional)">
          <ModalTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for absence/half-day..."
            rows={2}
          />
        </FormField>

        <ModalFooter
          onClose={onClose}
          submitLabel="Save Record"
          loading={markAttendance.isPending}
        />
      </form>

      <div className="mt-6 pt-6 border-t border-primary/10">
        <h4 className="text-sm font-medium text-primary mb-4">Recent Records</h4>
        {isLoading ? (
          <p className="text-xs text-primary/40 text-center py-4">Loading records...</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-primary/40 text-center py-4">No recent attendance records.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {records.map((record: any) => (
              <div 
                key={record.id} 
                className="flex items-center justify-between p-3 rounded-xl bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => handleEditRecord(record)}
                title="Click to edit"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {getStatusIcon(record.status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {new Date(record.date).toLocaleDateString()}
                    </p>
                    {record.note && <p className="text-xs text-primary/40">{record.note}</p>}
                  </div>
                </div>
                <div className="text-xs font-medium uppercase capitalize tracking-wide" 
                  style={{
                    color: record.status === 'present' ? 'rgb(52, 211, 153)' : 
                           record.status === 'absent' ? 'rgb(251, 113, 133)' : 
                           'rgb(251, 191, 36)'
                  }}
                >
                  {record.status.replace('-', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
