import { cn } from "@/shared/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  trend?: "up" | "down";
  icon: React.ReactNode;
  color: "violet" | "emerald" | "blue" | "rose" | "amber";
  subtitle?: string;
  className?: string;
}

const colorMap = {
  violet: {
    icon: "bg-violet-500/15 text-violet-400",
    glow: "shadow-violet-500/10",
    border: "border-violet-500/10",
    trend: "text-violet-400",
  },
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-400",
    glow: "shadow-emerald-500/10",
    border: "border-emerald-500/10",
    trend: "text-emerald-400",
  },
  blue: {
    icon: "bg-blue-500/15 text-blue-400",
    glow: "shadow-blue-500/10",
    border: "border-blue-500/10",
    trend: "text-blue-400",
  },
  rose: {
    icon: "bg-rose-500/15 text-rose-400",
    glow: "shadow-rose-500/10",
    border: "border-rose-500/10",
    trend: "text-rose-400",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-400",
    glow: "shadow-amber-500/10",
    border: "border-amber-500/10",
    trend: "text-amber-400",
  },
};

export function StatCard({ label, value, change, trend, icon, color, subtitle, className }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn(
      "bg-surface border border-primary/10 rounded-2xl p-3.5 sm:p-5 hover:border-opacity-40 transition-all duration-300",
      "shadow-lg hover:shadow-xl group hover:-translate-y-0.5",
      c.border, c.glow,
      className
    )}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center", c.icon)}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg",
            trend === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
          )}>
            <span>{trend === "up" ? "↑" : "↓"}</span>
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-lg sm:text-2xl font-bold text-primary tracking-tight truncate">{value}</p>
        <p className="text-primary/40 text-[10px] sm:text-xs mt-1 truncate">{label}</p>
        {subtitle && <p className="text-primary/40 text-[10px] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
