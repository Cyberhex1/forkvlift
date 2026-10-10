/** Small page-level helpers shared by every feature. */
import type { ReactNode } from "react";
import { cn, StateMessage } from "@forkvlift/ui";

export function PageShell({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6", className)}>
      {title ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-xl sm:text-2xl">{title}</h1>
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Placeholder for a page whose feature task hasn't landed yet. */
export function ComingSoon({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <PageShell title={title}>
      <StateMessage title="Coming soon">{children ?? "This part of the site is still being built."}</StateMessage>
    </PageShell>
  );
}
