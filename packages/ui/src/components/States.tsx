import type { ReactNode } from "react";
import { cn } from "../cn";

/** Building blocks for the empty / loading / error states every screen needs. */

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-pixel bg-surface-2", className)} />;
}

export interface StateMessageProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}

export function StateMessage({ title, children, action, tone = "neutral", className }: StateMessageProps) {
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center", className)}>
      <p className={cn("font-display text-base", tone === "danger" ? "text-danger" : "text-fg")}>{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
      {action}
    </div>
  );
}
