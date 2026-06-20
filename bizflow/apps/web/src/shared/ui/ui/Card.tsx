import { cn } from "@/shared/lib/utils";
import { CSSProperties } from "react";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  hover?: boolean;
  style?: CSSProperties;
}

export function Card({ className, children, onClick, hover, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border transition-all duration-200",
        hover && "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl",
        className
      )}
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("flex items-center justify-between flex-wrap gap-3 p-3 sm:p-5", className)}
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("font-semibold text-sm", className)} style={{ color: "var(--text-primary)" }}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
