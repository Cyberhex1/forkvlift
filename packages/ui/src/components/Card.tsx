import type { ElementType, HTMLAttributes } from "react";
import { cn } from "../cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Adds hover lift; use for clickable cards. */
  interactive?: boolean;
  padded?: boolean;
}

/** Surface shell for project cards, panels and list items. */
export function Card({ as: Tag = "div", interactive, padded = true, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-border bg-surface text-fg",
        padded && "p-4",
        interactive && "transition hover:-translate-y-0.5 hover:shadow-pixel focus-within:shadow-pixel",
        className,
      )}
      {...rest}
    />
  );
}
