import { useState } from "react";
import { cn } from "../cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<AvatarSize, string> = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-14 text-lg",
  xl: "size-24 text-2xl",
};

export interface AvatarProps {
  src: string | null | undefined;
  /** Display name; used for alt text and the initials fallback. */
  name: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-display text-muted", sizes[size], className)}>
      {src && !failed ? (
        <img src={src} alt={name} className="size-full object-cover" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span role="img" aria-label={name}>
          {initials || "?"}
        </span>
      )}
    </span>
  );
}
