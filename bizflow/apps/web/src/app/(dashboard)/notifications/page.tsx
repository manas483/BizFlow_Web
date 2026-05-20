"use client";

import React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useNotifications, useMarkAllNotificationsRead } from "@/hooks/useNotifications";
import { Bell, AlertTriangle, ShoppingCart, CreditCard, Info, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

const iconMap: Record<string, React.ReactNode> = {
  alert: <AlertTriangle size={16} className="text-rose-400" />,
  sale: <ShoppingCart size={16} className="text-violet-400" />,
  payment: <CreditCard size={16} className="text-emerald-400" />,
  system: <Info size={16} className="text-blue-400" />,
};

const bgMap: Record<string, string> = {
  alert: "bg-rose-500/15",
  sale: "bg-violet-500/15",
  payment: "bg-emerald-500/15",
  system: "bg-blue-500/15",
};

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = notifications.filter((n: any) => !n.read).length;

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined);
  };

  return (
    <DashboardLayout title="Notifications">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Notifications</h2>
          <p className="text-primary/40 text-sm mt-0.5">Stay updated with alerts and activity</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<CheckCheck size={14} />}
          onClick={handleMarkAllRead}
          disabled={unread === 0 || markAllRead.isPending}
        >
          {markAllRead.isPending ? "Marking..." : "Mark All Read"}
        </Button>
      </div>

      {unread > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Bell size={14} className="text-violet-400" />
          <span className="text-violet-300 text-sm">{unread} unread notification{unread > 1 ? "s" : ""}</span>
        </div>
      )}

      <Card>
        <div className="divide-y divide-primary/10">
          {isLoading ? (
            <div className="text-center py-12 text-primary/40 text-sm">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-primary/40 text-sm">No notifications yet</div>
          ) : notifications.map((notif: any) => (
            <div
              key={notif.id}
              className={cn(
                "flex items-start gap-4 px-5 py-4 hover:bg-primary/5 transition-colors",
                !notif.read && "bg-primary/[0.02]"
              )}
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", bgMap[notif.type] || "bg-primary/5")}>
                {iconMap[notif.type] || <Info size={16} className="text-primary/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-primary text-sm font-medium">{notif.title}</p>
                  {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
                </div>
                <p className="text-primary/40 text-xs mt-0.5 leading-relaxed">{notif.message}</p>
                <p className="text-primary/40 text-[10px] mt-1">{formatDate(notif.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
