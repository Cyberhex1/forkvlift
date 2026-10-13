import type { SVGProps } from "react";

export interface PixelIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * 16x16 Pixel Art Crate / Box for empty states.
 * Colors: pixel-3 (#ef7d57), pixel-4 (#ffcd75), pixel-0 (#1a1c2c).
 */
export function EmptyCrateIcon({ size = 24, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Outer border */}
      <path d="M2 2h12v1H2zM2 13h12v1H2zM2 3h1v10H2zM13 3h1v10h-1z" fill="var(--color-pixel-0, #1a1c2c)" />
      {/* Crate wood body */}
      <path d="M3 3h10v10H3z" fill="var(--color-pixel-4, #ffcd75)" />
      {/* Wood slats shading */}
      <path d="M3 7h10v1H3zM3 9h10v1H3z" fill="var(--color-pixel-3, #ef7d57)" />
      {/* Diagonal brace */}
      <path d="M4 4h2v1H4zM6 5h2v1H6zM8 6h2v1H8zM10 11h2v1h-2zM8 10h2v1H8z" fill="var(--color-pixel-3, #ef7d57)" />
      {/* Corner rivets */}
      <path d="M3 3h1v1H3zM12 3h1v1h-1zM3 12h1v1H3zM12 12h1v1h-1z" fill="var(--color-pixel-0, #1a1c2c)" />
    </svg>
  );
}

/**
 * 32x32 Pixel Art Broken Forklift for 404 and Error states.
 */
export function BrokenForkliftIcon({ size = 48, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Mast / Rails */}
      <path d="M6 6h2v18H6zM10 6h1v18h-1z" fill="var(--color-pixel-14, #566c86)" />
      {/* Forks */}
      <path d="M2 22h7v2H2zM2 21h2v1H2z" fill="var(--color-pixel-15, #333c57)" />
      {/* Question mark / spark above forks */}
      <path d="M5 8h4v1H5zM8 9h2v2H8zM6 11h2v2H6zM6 14h2v2H6z" fill="var(--color-pixel-3, #ef7d57)" />
      {/* Forklift Body */}
      <path d="M11 14h10v10H11z" fill="var(--color-pixel-4, #ffcd75)" />
      {/* Cabin cage */}
      <path d="M12 10h8v4h-8z" fill="none" stroke="var(--color-pixel-0, #1a1c2c)" strokeWidth="1" />
      <path d="M13 10h1v4h-1zM19 10h1v4h-1zM13 10h7v1h-7z" fill="var(--color-pixel-0, #1a1c2c)" />
      {/* Seat */}
      <path d="M15 12h2v2h-2z" fill="var(--color-pixel-2, #b13e53)" />
      {/* Wheels */}
      <path d="M8 22h4v4H8zM20 22h4v4h-4z" fill="var(--color-pixel-0, #1a1c2c)" />
      <path d="M9 23h2v2H9zM21 23h2v2h-2z" fill="var(--color-pixel-13, #94b0c2)" />
      {/* Warning hazard stripe */}
      <path d="M13 20h2v2h-2zM17 20h2v2h-2z" fill="var(--color-pixel-0, #1a1c2c)" />
      {/* Exhaust puff / dizzy swirls */}
      <path d="M22 12h2v1h-2zM24 10h2v2h-2zM26 8h2v2h-2z" fill="var(--color-pixel-13, #94b0c2)" />
    </svg>
  );
}

/**
 * 16x16 Pixel Search Empty Icon.
 */
export function SearchEmptyIcon({ size = 24, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Lens circle */}
      <path d="M4 2h4v1H4zM2 4h1v4H2zM8 4h1v4H8zM4 8h4v1H4z" fill="currentColor" />
      <path d="M3 3h1v1H3zM7 3h1v1H7zM3 7h1v1H3zM7 7h1v1H7z" fill="currentColor" />
      {/* Handle */}
      <path d="M8 8h2v2H8zM10 10h2v2h-2zM12 12h2v2h-2z" fill="var(--color-pixel-3, #ef7d57)" />
      {/* Empty dot */}
      <path d="M5 5h1v1H5z" fill="var(--color-pixel-13, #94b0c2)" />
    </svg>
  );
}

/**
 * 16x16 Pixel Warning Shield Icon.
 */
export function WarningShieldIcon({ size = 20, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d="M2 2h12v1H2zM2 3h12v4H2zM3 7h10v3H3zM4 10h8v2H4zM6 12h4v2H6zM7 14h2v1H7z" fill="var(--color-pixel-2, #b13e53)" />
      <path d="M7 4h2v4H7zM7 9h2v2H7z" fill="var(--color-pixel-12, #f4f4f4)" />
    </svg>
  );
}

/**
 * 16x16 Pixel Art Showcase Badge Icon (Task 5.7).
 * A brilliant cyan gem with gold sparkle on an exhibition pedestal.
 */
export function ShowcaseBadgeIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Sparkle top */}
      <path d="M6 1h4v2H6z" fill="var(--color-pixel-4, #ffcd75)" />
      {/* Gem body */}
      <path d="M5 3h6v3H5z" fill="var(--color-pixel-10, #73eff7)" />
      <path d="M6 3h4v2H6z" fill="var(--color-pixel-12, #f4f4f4)" />
      <path d="M4 6h8v2H4z" fill="var(--color-pixel-11, #257179)" />
      {/* Pedestal stand */}
      <path d="M5 8h6v2H5z" fill="var(--color-pixel-13, #94b0c2)" />
      <path d="M3 10h10v2H3z" fill="var(--color-pixel-14, #566c86)" />
      <path d="M2 12h12v3H2z" fill="var(--color-pixel-15, #333c57)" />
      <path d="M4 13h8v1H4z" fill="var(--color-pixel-13, #94b0c2)" />
    </svg>
  );
}

/**
 * 16x16 Pixel Art Closed Source Badge Icon (Task 5.7).
 * A ruby/coral lock ("Closed source: look, don't take").
 */
export function ClosedSourceBadgeIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Shackle */}
      <path d="M5 2h6v2H5zM4 4h2v4H4zM10 4h2v4h-2z" fill="var(--color-pixel-14, #566c86)" />
      {/* Inner shackle hole */}
      <path d="M6 4h4v4H6z" fill="none" />
      {/* Lock body */}
      <path d="M3 7h10v8H3z" fill="var(--color-pixel-2, #b13e53)" />
      <path d="M4 8h8v6H4z" fill="var(--color-pixel-3, #ef7d57)" />
      {/* Keyhole */}
      <path d="M7 9h2v2H7zM7 11h2v2H7z" fill="var(--color-pixel-0, #1a1c2c)" />
      {/* Edge shadow */}
      <path d="M12 8h1v6h-1z" fill="var(--color-pixel-15, #333c57)" />
    </svg>
  );
}

/**
 * 32x32 Pixel Art Showcase Empty Icon (Task 5.7).
 * An exhibition pedestal and spotlight vitrine ready for creations.
 */
export function ShowcaseEmptyIcon({ size = 32, className, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Overhead spotlight cone */}
      <path d="M14 2h4v2h-4z" fill="var(--color-pixel-13, #94b0c2)" />
      <path d="M12 4h8v1h-8z" fill="var(--color-pixel-14, #566c86)" />
      <path d="M10 5h12v1H10zM8 6h16v1H8z" fill="var(--color-pixel-10, #73eff7)" opacity="0.3" />
      <path d="M6 7h20v2H6z" fill="var(--color-pixel-10, #73eff7)" opacity="0.2" />
      <path d="M4 9h24v6H4z" fill="var(--color-pixel-10, #73eff7)" opacity="0.1" />

      {/* Floating sparkles in the light */}
      <path d="M15 8h2v2h-2zM14 9h4v1h-4z" fill="var(--color-pixel-4, #ffcd75)" />
      <path d="M9 11h2v2H9z" fill="var(--color-pixel-12, #f4f4f4)" />
      <path d="M21 10h2v2h-2z" fill="var(--color-pixel-12, #f4f4f4)" />

      {/* Exhibition velvet cushion */}
      <path d="M10 16h12v2H10z" fill="var(--color-pixel-2, #b13e53)" />
      <path d="M11 16h10v1H11z" fill="var(--color-pixel-3, #ef7d57)" />

      {/* Pedestal stand */}
      <path d="M11 18h10v6H11z" fill="var(--color-pixel-14, #566c86)" />
      <path d="M12 18h8v6h-8z" fill="var(--color-pixel-13, #94b0c2)" />
      <path d="M14 19h4v4h-4z" fill="var(--color-pixel-12, #f4f4f4)" opacity="0.5" />

      {/* Heavy base */}
      <path d="M8 24h16v3H8z" fill="var(--color-pixel-15, #333c57)" />
      <path d="M6 27h20v3H6z" fill="var(--color-pixel-0, #1a1c2c)" />
      <path d="M7 28h18v1H7z" fill="var(--color-pixel-15, #333c57)" />
    </svg>
  );
}

