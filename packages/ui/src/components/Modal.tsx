import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../cn";

export interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name. Rendered as the heading unless hideTitle is set. */
  title: string;
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
  /** Close when the backdrop is clicked (default true). */
  dismissOnBackdrop?: boolean;
}

/**
 * Shared native <dialog> behavior: focus trap, Escape, backdrop click, focus
 * restore. The backdrop blurs everything behind it (the focus-panel look).
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const previouslyFocused = document.activeElement as HTMLElement | null;
      dialog.showModal();
      return () => {
        if (dialog.open) dialog.close();
        previouslyFocused?.focus?.();
      };
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);
  return ref;
}

const backdrop = "backdrop:bg-overlay backdrop:backdrop-blur-sm";

export function Modal({ open, onClose, title, hideTitle, children, className, dismissOnBackdrop = true }: DialogShellProps) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,56rem)] overflow-auto rounded-card border border-border bg-surface p-0 text-fg shadow-panel",
        "open:animate-slide-up",
        backdrop,
        className,
      )}
    >
      {open ? (
        <div className="relative p-4 sm:p-6">
          <h2 id={titleId} className={cn("pr-10 font-display text-lg", hideTitle && "sr-only")}>
            {title}
          </h2>
          <CloseButton onClick={onClose} />
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export type DrawerSide = "left" | "right" | "bottom";

const sides: Record<DrawerSide, string> = {
  left: "mr-auto ml-0 h-dvh max-h-dvh w-[min(100%,24rem)] rounded-r-card",
  right: "ml-auto mr-0 h-dvh max-h-dvh w-[min(100%,24rem)] rounded-l-card",
  bottom: "mb-0 mt-auto max-h-[85dvh] w-full max-w-full rounded-t-card",
};

export function Drawer({ open, onClose, title, hideTitle, children, className, side = "right", dismissOnBackdrop = true }: DialogShellProps & { side?: DrawerSide }) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className={cn("overflow-auto border border-border bg-surface p-0 text-fg shadow-panel open:animate-fade-in", sides[side], backdrop, className)}
    >
      {open ? (
        <div className="relative p-4">
          <h2 id={titleId} className={cn("pr-10 font-display text-base", hideTitle && "sr-only")}>
            {title}
          </h2>
          <CloseButton onClick={onClose} />
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-pixel text-muted hover:bg-surface-2 hover:text-fg"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4" shapeRendering="crispEdges">
        <path d="M3 3h2v2H3zM5 5h2v2H5zM7 7h2v2H7zM9 9h2v2H9zM11 11h2v2h-2zM11 3h2v2h-2zM9 5h2v2H9zM5 9h2v2H5zM3 11h2v2H3z" fill="currentColor" />
      </svg>
    </button>
  );
}
