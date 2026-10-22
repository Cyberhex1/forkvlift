import type { HTMLAttributes, ReactNode } from "react";
import { Badge, type BadgeProps } from "../components/Badge";
import { Card } from "../components/Card";
import { ShowcaseBadgeIcon, ClosedSourceBadgeIcon, ShowcaseEmptyIcon } from "../icons/PixelIcons";

export interface ShowcaseBadgeProps extends Omit<BadgeProps, "tone" | "icon"> {
  className?: string;
}

/**
 * 16x16 pixel badge for Showcases (Task 5.7).
 * Carried by every showcase on ForkLift.
 */
export function ShowcaseBadge({ className = "", children = "Showcase", ...rest }: ShowcaseBadgeProps) {
  return (
    <Badge
      tone="accent"
      icon={<ShowcaseBadgeIcon size={14} />}
      className={`font-mono text-xs ${className}`}
      {...rest}
    >
      {children}
    </Badge>
  );
}

export interface ClosedSourceBadgeProps extends Omit<BadgeProps, "tone" | "icon"> {
  compact?: boolean;
  className?: string;
}

/**
 * 16x16 pixel badge for Closed-source Showcases (Task 5.7).
 * Plainly states "Closed source: look, don't take" so visitors know no code is offered.
 */
export function ClosedSourceBadge({
  compact = false,
  className = "",
  children,
  ...rest
}: ClosedSourceBadgeProps) {
  const label = children ?? (compact ? "Closed source" : "Closed source: look, don't take");
  return (
    <Badge
      tone="neutral"
      icon={<ClosedSourceBadgeIcon size={14} />}
      className={`font-mono text-xs ${className}`}
      {...rest}
    >
      {label}
    </Badge>
  );
}

/**
 * Large decorative empty-state illustration for Showcases (Task 5.7).
 * 128x128 pixel-styled exhibition vitrine with spotlights and floating sparkles.
 */
export function ShowcaseEmptyArt({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`} aria-hidden="true">
      <ShowcaseEmptyIcon size={size} />
    </div>
  );
}

export interface ShowcaseEmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  variant?: "page" | "card" | "inline";
  className?: string;
}

/**
 * Empty state component tailored for Showcases (Task 5.7).
 * Explicitly avoids any clone or fork wording.
 */
export function ShowcaseEmptyState({
  title = "No showcases yet",
  description = "No showcases match this view. Built something cool with AI? Share your creation with the community!",
  action,
  secondaryAction,
  variant = "page",
  className = "",
  ...rest
}: ShowcaseEmptyStateProps) {
  const content = (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center ${
        variant === "inline"
          ? "py-6 px-3"
          : variant === "card"
            ? "py-8 px-4"
            : "py-16 px-4 sm:py-24"
      } ${className}`}
      {...rest}
    >
      <div className="mb-4 inline-flex items-center justify-center rounded-pixel bg-surface-2 p-4 text-muted">
        <ShowcaseEmptyIcon size={variant === "inline" ? 32 : 48} />
      </div>

      <h3 className="font-display text-base font-semibold text-fg sm:text-lg">
        {title}
      </h3>

      {description ? (
        <div className="mt-2 max-w-sm text-sm leading-relaxed text-muted sm:text-base">
          {description}
        </div>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );

  if (variant === "card") {
    return <Card className="w-full">{content}</Card>;
  }

  return content;
}
