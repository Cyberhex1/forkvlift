import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, cn } from "@forkvlift/ui";

/** Small popover behind a "⋯" button. Rendered in a portal so the board's scroll box can't clip it. */
export function StudioMenu({ label, disabled, width = 240, children }: { label: string; disabled?: boolean; width?: number; children: (close: () => void) => ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = (refocus = false) => {
    // Commit a half-typed field (the WIP limit saves on blur) before the panel unmounts.
    if (document.activeElement instanceof HTMLElement && panel.current?.contains(document.activeElement)) document.activeElement.blur();
    setAnchor(null);
    setPos(null);
    if (refocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!anchor || !panel.current) return;
    const height = panel.current.offsetHeight;
    const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
    const below = anchor.bottom + 4;
    const top = below + height > window.innerHeight - 8 && anchor.top - height - 4 > 8 ? anchor.top - height - 4 : below;
    setPos({ top, left });
  }, [anchor, width]);

  const open = !!anchor;
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("button:not(:disabled), input, select")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) => target instanceof Node && (panel.current?.contains(target) || button.current?.contains(target));
    const onPointer = (e: PointerEvent) => { if (!inside(e.target)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(true); };
    // Follow the button when the board or page scrolls (phones scroll it into view on tap).
    const onScroll = (e: Event) => { if (!inside(e.target) && button.current) setAnchor(button.current.getBoundingClientRect()); };
    const onResize = () => close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={button}
        size="sm"
        variant="ghost"
        className="h-7 w-7 px-0"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={() => (anchor ? close() : setAnchor(button.current!.getBoundingClientRect()))}
      >
        <span aria-hidden="true" className="text-base leading-none">⋯</span>
      </Button>
      {anchor
        ? createPortal(
            <div
              ref={panel}
              role="dialog"
              aria-label={label}
              style={{ top: pos?.top ?? anchor.bottom + 4, left: pos?.left ?? anchor.left, width, visibility: pos ? "visible" : "hidden" }}
              className="fixed z-50 rounded-card border border-border bg-surface p-1.5 text-sm text-fg shadow-panel"
            >
              {children(() => close(true))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function MenuItem({ danger, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-pixel px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2 disabled:pointer-events-none disabled:opacity-50",
        danger && "text-danger",
        className,
      )}
      {...rest}
    />
  );
}

export function MenuDivider() {
  return <hr className="my-1.5 border-border" />;
}

/** Six-dot grip shown on drag handles. */
export function Grip() {
  return <span aria-hidden="true" className="text-base leading-none text-muted">⠿</span>;
}
