import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** When set, the chip is a toggle (aria-pressed). */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  icon?: ReactNode;
}

/** Filter/tag chip. Toggle when `selected` is given, plain button otherwise. */
export function Chip({ selected, onSelectedChange, icon, className, children, onClick, type = "button", ...rest }: ChipProps) {
  const isToggle = selected !== undefined;
  return (
    <button
      type={type}
      aria-pressed={isToggle ? selected : undefined}
      onClick={(e) => {
        onClick?.(e);
        if (isToggle && !e.defaultPrevented) onSelectedChange?.(!selected);
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition",
        selected ? "bg-accent text-accent-fg border-accent" : "bg-surface text-fg border-border hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
