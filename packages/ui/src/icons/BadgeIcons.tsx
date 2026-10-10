/**
 * Badge icons (task 3.12): 16×16 pixel art, keyed by the `iconKey` stored with
 * each badge (`badge-<key>`). Unknown keys get a plain star.
 */
import type { ReactNode } from "react";
import type { PixelIconProps } from "./PixelIcons";

type Px = readonly [x: number, y: number, w: number, h: number, color: string];

const p = (n: number | string) => `var(--color-pixel-${n})`;

const ART: Record<string, Px[]> = {
  // A fork in the road: one stem splitting in two with bright node highlights.
  "badge-first-fork": [
    [7, 8, 2, 7, p(13)],
    [7, 10, 1, 5, p(12)],
    [5, 6, 6, 2, p(13)],
    [3, 3, 3, 3, p(10)],
    [10, 3, 3, 3, p(10)],
    [4, 2, 2, 2, p(11)],
    [11, 2, 2, 2, p(11)],
    [6, 14, 4, 1, p(14)],
  ],
  // A family tree with gold leaves and trunk.
  "badge-most-forked": [
    [7, 8, 2, 7, p(1)],
    [4, 6, 8, 2, p(1)],
    [2, 4, 3, 2, p(1)],
    [11, 4, 3, 2, p(1)],
    [1, 1, 4, 3, p(4)],
    [6, 1, 4, 4, p(4)],
    [11, 1, 4, 3, p(4)],
    [2, 2, 2, 1, p(12)],
    [7, 1, 2, 1, p(12)],
    [12, 2, 2, 1, p(12)],
    [5, 14, 6, 1, p(15)],
  ],
  // A ladybug / bug with distinct legs, shell spots, and antennae.
  "badge-bug-squasher": [
    [5, 5, 6, 7, p(2)],
    [6, 3, 4, 2, p(0)],
    [6, 3, 1, 1, p(12)],
    [9, 3, 1, 1, p(12)],
    [5, 1, 1, 2, p(0)],
    [10, 1, 1, 2, p(0)],
    [7, 5, 2, 7, p(0)],
    [5, 7, 1, 2, p(0)],
    [10, 7, 1, 2, p(0)],
    [3, 4, 2, 1, p(0)],
    [11, 4, 2, 1, p(0)],
    [2, 7, 3, 1, p(0)],
    [11, 7, 3, 1, p(0)],
    [3, 10, 2, 2, p(0)],
    [11, 10, 2, 2, p(0)],
  ],
  // A speech bubble with emerald fill and white check mark.
  "badge-helper": [
    [2, 1, 12, 10, p(7)],
    [3, 2, 10, 8, p(6)],
    [3, 11, 3, 2, p(7)],
    [3, 13, 2, 1, p(7)],
    [4, 11, 2, 1, p(6)],
    [4, 6, 2, 2, p(12)],
    [6, 7, 2, 2, p(12)],
    [8, 5, 2, 2, p(12)],
    [10, 3, 2, 2, p(12)],
    [6, 6, 2, 1, p(12)],
  ],
  // Two builders side by side joining hands.
  "badge-collab-champion": [
    [2, 3, 4, 4, p(3)],
    [1, 7, 5, 7, p(2)],
    [10, 3, 4, 4, p(10)],
    [10, 7, 5, 7, p(9)],
    [5, 9, 6, 2, p(4)],
    [7, 1, 2, 2, p(4)],
    [6, 2, 4, 1, p(12)],
  ],
  // A flame with a gold center and a clear 7.
  "badge-streak-7": [
    [6, 1, 3, 2, p(3)],
    [4, 3, 8, 3, p(3)],
    [3, 5, 10, 8, p(3)],
    [4, 13, 8, 2, p(2)],
    [10, 3, 2, 3, p(3)],
    [5, 5, 6, 7, p(4)],
    [6, 3, 3, 2, p(4)],
    [5, 6, 6, 1, p(0)],
    [9, 7, 2, 2, p(0)],
    [7, 9, 2, 3, p(0)],
  ],
};

const STAR: Px[] = [
  [7, 1, 2, 3, p(4)],
  [1, 4, 14, 3, p(4)],
  [3, 7, 10, 3, p(4)],
  [3, 10, 3, 3, p(4)],
  [10, 10, 3, 3, p(4)],
  [6, 4, 4, 4, p(12)],
];

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
