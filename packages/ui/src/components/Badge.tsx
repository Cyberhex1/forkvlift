import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "stage-finished"
  | "stage-wip"
  | "stage-adoption"
  | "license-open"
  | "license-none";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg border-border",
  accent: "bg-accent text-accent-fg border-transparent",
  success: "bg-success text-success-fg border-transparent",
  warning: "bg-warning text-warning-fg border-transparent",
  danger: "bg-danger text-danger-fg border-transparent",
  info: "bg-info text-info-fg border-transparent",
  "stage-finished": "bg-stage-finished text-success-fg border-transparent",
  "stage-wip": "bg-stage-wip text-warning-fg border-transparent",
  "stage-adoption": "bg-stage-adoption text-info-fg border-transparent",
  "license-open": "bg-license-open text-success-fg border-transparent",
  "license-none": "bg-transparent text-license-none border-license-none",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

export function Badge({ tone = "neutral", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-pixel border px-1.5 py-0.5 text-xs font-medium leading-none whitespace-nowrap", tones[tone], className)}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
