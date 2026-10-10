import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonClasses, Card, Skeleton, Spinner } from "@forkvlift/ui";
import { BrokenForkliftIcon, EmptyCrateIcon } from "@forkvlift/ui/icons";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  variant?: "page" | "card" | "inline";
  className?: string;
}

/**
 * Reusable empty state component (Task 1.17).
 * Used across the feed, search results, studio kanban, profile collections, and forum.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  variant = "page",
  className = "",
}: EmptyStateProps) {
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
    >
      <div className="mb-4 inline-flex items-center justify-center rounded-pixel bg-surface-2 p-3 text-muted">
        {icon ?? <EmptyCrateIcon size={variant === "inline" ? 28 : 40} />}
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

export interface LoadingGridStateProps {
  /** Number of skeleton cards to render (default: 8). */
  count?: number;
  className?: string;
}

/**
 * Skeleton loading grid matching the project card layout (Task 1.17).
 * Works at mobile 375 px (1 col) up to desktop (4 cols).
 */
export function LoadingGridState({ count = 8, className = "" }: LoadingGridStateProps) {
  return (
    <div
      role="status"
      aria-label="Loading projects"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${className}`}
    >
      <span className="sr-only">Loading project catalog...</span>
      {Array.from({ length: count }).map((_, idx) => (
        <Card key={idx} className="flex flex-col overflow-hidden p-0">
          {/* Card thumbnail skeleton (~60% height) */}
          <Skeleton className="h-44 w-full rounded-b-none" />

          {/* Card content skeleton */}
          <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
            <div className="space-y-2">
              {/* Project title */}
              <Skeleton className="h-5 w-3/4" />
              {/* Tagline / description */}
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>

            {/* Badges / metadata row */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex gap-1.5">
                <Skeleton className="h-4 w-12 rounded-pixel" />
                <Skeleton className="h-4 w-16 rounded-pixel" />
              </div>
              {/* Author / stars */}
              <Skeleton className="h-4 w-10 rounded-pixel" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Full page or section loading spinner with screen-reader feedback (Task 1.17).
 */
export function LoadingScreen({
  label = "Loading...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center py-20 px-4 text-center ${className}`}
    >
      <Spinner label={label} className="scale-125" />
      <p className="mt-4 font-mono text-xs text-muted">{label}</p>
    </div>
  );
}

/**
 * Skeleton for the focus panel view (/p/:slug) — Task 1.17.
 */
export function LoadingPanelSkeleton({ className = "" }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading project details" className={`space-y-6 ${className}`}>
      <span className="sr-only">Loading project details...</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Gallery skeleton */}
      <Skeleton className="h-64 w-full rounded-card" />

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>

      {/* README skeleton blocks */}
      <div className="space-y-3 pt-4 border-t border-border">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

/**
 * Reusable error state with retry and navigation support (Task 1.17).
 */
export function ErrorState({
  title = "Something went off track",
  message = "We couldn't load this content. Please check your connection and try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center ${className}`}
    >
      <div className="mb-4 inline-flex items-center justify-center rounded-pixel bg-danger/10 p-3 text-danger">
        <BrokenForkliftIcon size={40} />
      </div>

      <h2 className="font-display text-lg font-semibold text-danger sm:text-xl">
        {title}
      </h2>

      <div className="mt-2 text-sm leading-relaxed text-muted">
        {message}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={buttonClasses("primary", "md")}
          >
            Try again
          </button>
        ) : null}
        <Link to="/" className={buttonClasses("secondary", "md")}>
          Back to catalog
        </Link>
      </div>
    </div>
  );
}

export interface UnlicensedHiddenNoticeProps {
  /** Count of unlicensed projects hidden from current view. */
  count: number;
  /** Callback fired when clicking 'Show them' */
  onShowThem?: () => void;
  className?: string;
}

/**
 * Notice banner: "N unlicensed projects hidden · Show them"
 * (Product plan: Unlicensed projects: hidden unless you opt in).
 */
export function UnlicensedHiddenNotice({
  count,
  onShowThem,
  className = "",
}: UnlicensedHiddenNoticeProps) {
  if (count <= 0) return null;

  return (
    <div
      role="note"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-pixel border border-border bg-surface-2 px-3 py-2 text-xs text-muted ${className}`}
    >
      <span>
        {count} unlicensed {count === 1 ? "project" : "projects"} hidden
      </span>
      {onShowThem ? (
        <button
          type="button"
          onClick={onShowThem}
          className="font-medium text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus"
        >
          Show them →
        </button>
      ) : (
        <Link
          to="/licensing"
          className="font-medium text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus"
        >
          Why? →
        </Link>
      )}
    </div>
  );
}
