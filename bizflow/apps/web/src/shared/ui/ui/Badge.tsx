import { cn } from "@/shared/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "violet";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/10 text-white/60",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  danger: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  violet: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border border-transparent",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
