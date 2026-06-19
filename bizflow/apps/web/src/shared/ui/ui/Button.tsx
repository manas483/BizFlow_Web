import { cn } from "@/shared/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-violet-600 to-purple-700 text-white hover:from-violet-500 hover:to-purple-600 shadow-lg shadow-violet-500/20",
  secondary: "bg-primary/5 text-primary/80 border border-primary/10 hover:bg-primary/10 hover:text-primary",
  ghost: "text-primary/60 hover:text-primary hover:bg-primary/5",
  danger: "bg-rose-600/20 text-rose-400 border border-rose-500/20 hover:bg-rose-600/30",
  success: "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-6 py-2.5 text-sm rounded-xl",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Button({ variant = "primary", size = "md", icon, children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 font-medium transition-all duration-200 cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
      suppressHydrationWarning
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
