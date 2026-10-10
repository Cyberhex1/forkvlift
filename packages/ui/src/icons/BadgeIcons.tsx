/**
 * Badge icons (task 3.12): 16×16 pixel art, keyed by the `iconKey` stored with
 * each badge (`badge-<key>`). Unknown keys get a plain star.
 */
import type { ReactNode } from "react";
import type { PixelIconProps } from "./PixelIcons";

type Px = readonly [x: number, y: number, w: number, h: number, color: string];

const p = (n: number | string) => `var(--color-pixel-${n})`;

const ART: Record<string, Px[]> = {
  // A fork in the road: one stem splitting in two.
  "badge-first-fork": [
    [7, 9, 2, 6, p(9)], [5, 7, 2, 2, p(9)], [9, 7, 2, 2, p(9)], [3, 5, 2, 2, p(9)], [11, 5, 2, 2, p(9)],
    [2, 2, 4, 3, p(10)], [10, 2, 4, 3, p(10)], [6, 13, 4, 2, p(8)],
  ],
  // A family tree with gold leaves.
  "badge-most-forked": [
    [7, 8, 2, 7, p(8)], [4, 6, 8, 2, p(8)], [3, 4, 2, 2, p(8)], [11, 4, 2, 2, p(8)], [7, 4, 2, 4, p(8)],
    [2, 1, 4, 3, p(4)], [10, 1, 4, 3, p(4)], [6, 1, 4, 3, p(4)], [5, 14, 6, 1, p(8)],
  ],
  // A squashed bug under a hammer mark.
  "badge-bug-squasher": [
    [5, 6, 6, 6, p(6)], [6, 4, 4, 2, p(0)], [7, 6, 2, 6, p(0)], [3, 7, 2, 1, p(0)], [11, 7, 2, 1, p(0)],
    [3, 10, 2, 1, p(0)], [11, 10, 2, 1, p(0)], [2, 2, 2, 2, p(3)], [12, 2, 2, 2, p(3)], [2, 13, 12, 1, p(14)],
  ],
  // A speech bubble with a check mark.
  "badge-helper": [
    [2, 2, 12, 9, p(10)], [4, 11, 3, 2, p(10)], [4, 13, 1, 1, p(10)],
    [4, 6, 2, 2, p(12)], [6, 7, 2, 2, p(12)], [8, 5, 2, 2, p(12)], [10, 3, 2, 2, p(12)],
  ],
  // Two builders side by side.
  "badge-collab-champion": [
    [2, 3, 4, 4, p(3)], [1, 8, 6, 6, p(2)], [10, 3, 4, 4, p(10)], [9, 8, 6, 6, p(9)], [6, 9, 4, 2, p(4)],
  ],
  // A flame with a 7 in it.
  "badge-streak-7": [
    [6, 1, 2, 2, p(3)], [5, 3, 5, 2, p(3)], [4, 5, 8, 8, p(3)], [5, 13, 6, 2, p(3)], [10, 3, 1, 2, p(3)],
    [6, 7, 4, 1, p(4)], [8, 8, 2, 1, p(4)], [7, 9, 2, 3, p(4)],
  ],
};

const STAR: Px[] = [[7, 1, 2, 4, p(4)], [1, 5, 14, 3, p(4)], [3, 8, 10, 3, p(4)], [3, 11, 3, 3, p(4)], [10, 11, 3, 3, p(4)]];

export interface BadgeIconProps extends PixelIconProps {
  iconKey: string;
  /** Accessible name; omit when the badge name is printed next to the icon. */
  label?: string;
}

export function BadgeIcon({ iconKey, label, size = 24, className, ...rest }: BadgeIconProps): ReactNode {
  const art = ART[iconKey] ?? STAR;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {art.map(([x, y, w, h, color], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
      ))}
    </svg>
  );
}

export const BADGE_ICON_KEYS = Object.keys(ART);
