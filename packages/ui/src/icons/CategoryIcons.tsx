import type { ComponentType, SVGProps } from "react";

export interface PixelIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/** 1. Games: Retro Gamepad Controller */
export function CatGamesIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      <path d="M3 5h10v7H3z" fill="var(--color-pixel-14)" />
      <path d="M2 6h12v5H2z" fill="var(--color-pixel-14)" />
      <path d="M6 11h4v1H6z" fill="var(--color-pixel-0)" />
      {/* D-Pad */}
      <path d="M4 7h1v3H4zM3 8h3v1H3z" fill="var(--color-pixel-0)" />
      {/* Action buttons */}
      <path d="M11 7h1v1h-1z" fill="var(--color-pixel-2)" />
      <path d="M12 8h1v1h-1z" fill="var(--color-pixel-4)" />
      <path d="M10 8h1v1h-1z" fill="var(--color-pixel-6)" />
      <path d="M11 9h1v1h-1z" fill="var(--color-pixel-10)" />
    </svg>
  );
}

/** 2. Production: Audio Faders / Mixer */
export function CatProductionIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Vertical Slider Tracks */}
      <path d="M3 2h1v12H3zM7 2h1v12H7zM11 2h1v12h-1z" fill="var(--color-pixel-15)" />
      {/* Fader Knobs */}
      <path d="M2 5h3v3H2z" fill="var(--color-pixel-3)" />
      <path d="M6 9h3v3H6z" fill="var(--color-pixel-4)" />
      <path d="M10 4h3v3h-3z" fill="var(--color-pixel-5)" />
      {/* Indicator notches */}
      <path d="M3 6h1v1H3zM7 10h1v1H7zM11 5h1v1h-1z" fill="var(--color-pixel-12)" />
    </svg>
  );
}

/** 3. Tools and Utilities: Crossed Wrench & Screwdriver */
export function CatToolsAndUtilitiesIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Wrench Jaw */}
      <path d="M2 3h4v1H2zM2 4h1v3H2zM5 4h1v3H5zM3 6h2v1H3z" fill="var(--color-pixel-13)" />
      {/* Wrench Shaft */}
      <path d="M5 7h2v2H5zM7 9h2v2H7zM9 11h2v2H9z" fill="var(--color-pixel-14)" />
      {/* Wrench Loop Handle */}
      <path d="M11 11h3v1h-3zM11 14h3v1h-3zM11 12h1v2h-1zM13 12h1v2h-1z" fill="var(--color-pixel-13)" />
      {/* Cross accent */}
      <path d="M11 3h2v2h-2zM4 11h2v2H4z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 4. Suites: 2x2 Modular Suite Bundle */
export function CatSuitesIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      <path d="M2 2h5v5H2z" fill="var(--color-pixel-9)" />
      <path d="M3 3h3v3H3z" fill="var(--color-pixel-10)" />
      <path d="M9 2h5v5H9z" fill="var(--color-pixel-6)" />
      <path d="M10 3h3v3h-3z" fill="var(--color-pixel-5)" />
      <path d="M2 9h5v5H2z" fill="var(--color-pixel-3)" />
      <path d="M3 10h3v3H3z" fill="var(--color-pixel-4)" />
      <path d="M9 9h5v5H9z" fill="var(--color-pixel-1)" />
      <path d="M10 10h3v3h-3z" fill="var(--color-pixel-2)" />
    </svg>
  );
}

/** 5. Productivity: Clipboard with Checkmark */
export function CatProductivityIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Top Clip */}
      <path d="M6 1h4v2H6z" fill="var(--color-pixel-14)" />
      {/* Board */}
      <path d="M3 3h10v12H3z" fill="var(--color-pixel-4)" />
      {/* Paper Sheet */}
      <path d="M4 4h8v10H4z" fill="var(--color-pixel-12)" />
      {/* Checkmark 1 */}
      <path d="M5 6h1v2H5zM6 7h1v1H6zM7 5h1v2H7z" fill="var(--color-pixel-6)" />
      <path d="M9 6h2v1H9z" fill="var(--color-pixel-15)" />
      {/* Checkmark 2 */}
      <path d="M5 10h1v2H5zM6 11h1v1H6zM7 9h1v2H7z" fill="var(--color-pixel-6)" />
      <path d="M9 10h2v1H9z" fill="var(--color-pixel-15)" />
    </svg>
  );
}

/** 6. Developer Tools: Code Brackets & Slash */
export function CatDeveloperToolsIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Left Bracket < */}
      <path d="M4 4h2v1H4zM3 5h2v1H3zM2 6h2v4H2zM3 10h2v1H3zM4 11h2v1H4z" fill="var(--color-pixel-10)" />
      {/* Slash / */}
      <path d="M8 4h1v2H8zM7 6h1v2H7zM6 8h1v2H6zM5 10h1v2H5z" fill="var(--color-pixel-14)" />
      {/* Right Bracket > */}
      <path d="M10 4h2v1h-2zM11 5h2v1h-2zM12 6h2v4h-2zM11 10h2v1h-2zM10 11h2v1h-2z" fill="var(--color-pixel-10)" />
    </svg>
  );
}

/** 7. AI and Agents: Robot Head with Antenna */
export function CatAiAndAgentsIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Antenna */}
      <path d="M7 1h2v2H7z" fill="var(--color-pixel-2)" />
      <path d="M7 3h2v1H7z" fill="var(--color-pixel-14)" />
      {/* Ears */}
      <path d="M1 7h1v4H1zM14 7h1v4h-1z" fill="var(--color-pixel-14)" />
      {/* Head */}
      <path d="M2 4h12v10H2z" fill="var(--color-pixel-13)" />
      {/* Visor */}
      <path d="M4 6h8v4H4z" fill="var(--color-pixel-0)" />
      {/* Glowing Eyes */}
      <path d="M5 7h2v2H5zM9 7h2v2H9z" fill="var(--color-pixel-11)" />
      {/* Mouth */}
      <path d="M5 12h6v1H5z" fill="var(--color-pixel-15)" />
    </svg>
  );
}

/** 8. Creative and Design: Artist's Palette */
export function CatCreativeAndDesignIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Palette Body */}
      <path d="M4 3h8v2H4zM2 5h12v6H2zM3 11h9v2H3zM5 13h5v1H5z" fill="var(--color-pixel-4)" />
      {/* Thumb hole */}
      <path d="M10 8h2v2h-2z" fill="var(--color-pixel-0)" />
      {/* Paint spots */}
      <path d="M4 6h2v2H4z" fill="var(--color-pixel-2)" />
      <path d="M8 4h2v2H8z" fill="var(--color-pixel-10)" />
      <path d="M4 9h2v2H4z" fill="var(--color-pixel-6)" />
      <path d="M7 9h2v2H7z" fill="var(--color-pixel-1)" />
    </svg>
  );
}

/** 9. Finance and Money: Gold Coin */
export function CatFinanceAndMoneyIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Coin Outer Edge */}
      <path d="M4 1h8v14H4zM2 3h12v10H2zM1 4h14v8H1z" fill="var(--color-pixel-3)" />
      {/* Coin Inner Face */}
      <path d="M4 2h8v12H4zM3 4h10v8H3z" fill="var(--color-pixel-4)" />
      {/* Dollar Currency Glyph */}
      <path d="M7 3h2v10H7z" fill="var(--color-pixel-3)" />
      <path d="M6 5h4v1H6zM6 7h4v2H6zM6 10h4v1H6z" fill="var(--color-pixel-3)" />
    </svg>
  );
}

/** 10. Health and Fitness: Heart with ECG Pulse */
export function CatHealthAndFitnessIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Heart Silhouette */}
      <path d="M2 3h4v3H2zM10 3h4v3h-4zM1 5h14v4H1zM2 9h12v2H2zM4 11h8v2H4zM6 13h4v1H6zM7 14h2v1H7z" fill="var(--color-pixel-2)" />
      {/* ECG Pulse Line */}
      <path d="M1 7h4v1H1z" fill="var(--color-pixel-12)" />
      <path d="M5 6h1v2H5zM6 4h1v4H6zM7 8h1v3H7zM8 5h1v4H8z" fill="var(--color-pixel-12)" />
      <path d="M9 7h6v1H9z" fill="var(--color-pixel-12)" />
    </svg>
  );
}

/** 11. Education and Learning: Graduation Cap / Mortarboard */
export function CatEducationAndLearningIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Diamond Cap Top */}
      <path d="M7 2h2v1H7zM5 3h6v1H5zM3 4h10v1H3zM1 5h14v1H1zM3 6h10v1H3zM5 7h6v1H5zM7 8h2v1H7z" fill="var(--color-pixel-8)" />
      {/* Skull Cap Base */}
      <path d="M4 8h8v4H4z" fill="var(--color-pixel-9)" />
      {/* Tassel Button & Cord */}
      <path d="M7 4h2v2H7z" fill="var(--color-pixel-4)" />
      <path d="M9 5h3v1H9zM12 6h1v4h-1z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 12. Home and Life: House with Chimney */
export function CatHomeAndLifeIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Chimney */}
      <path d="M11 2h2v3h-2z" fill="var(--color-pixel-3)" />
      {/* Roof */}
      <path d="M7 2h2v1H7zM5 3h6v1H5zM3 4h10v1H3zM1 5h14v1H1z" fill="var(--color-pixel-2)" />
      {/* House Body */}
      <path d="M2 6h12v9H2z" fill="var(--color-pixel-4)" />
      {/* Window */}
      <path d="M4 8h2v2H4z" fill="var(--color-pixel-11)" />
      {/* Door */}
      <path d="M8 9h3v6H8z" fill="var(--color-pixel-0)" />
      <path d="M8 12h1v1H8z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 13. Social and Community: Two Chat Bubbles */
export function CatSocialAndCommunityIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Main Left Bubble */}
      <path d="M1 2h9v7H1zM1 9h2v2H1z" fill="var(--color-pixel-9)" />
      <path d="M3 5h1v1H3zM5 5h1v1H5zM7 5h1v1H7z" fill="var(--color-pixel-12)" />
      {/* Secondary Right Bubble */}
      <path d="M6 6h9v7H6zM13 13h2v2h-2z" fill="var(--color-pixel-6)" />
      <path d="M8 9h1v1H8zM10 9h1v1h-1zM12 9h1v1h-1z" fill="var(--color-pixel-12)" />
    </svg>
  );
}

/** 14. Business and Ops: Classic Briefcase */
export function CatBusinessAndOpsIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Handle */}
      <path d="M6 2h4v1H6zM6 3h1v1H6zM9 3h1v1H9z" fill="var(--color-pixel-15)" />
      {/* Briefcase Body */}
      <path d="M2 4h12v10H2z" fill="var(--color-pixel-3)" />
      {/* Mid Seam Line */}
      <path d="M2 8h12v1H2z" fill="var(--color-pixel-15)" />
      {/* Locks */}
      <path d="M4 7h2v3H4zM10 7h2v3h-2z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 15. Data and Analytics: Ascending Bar Chart */
export function CatDataAndAnalyticsIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Axes */}
      <path d="M1 1h1v13H1zM1 14h14v1H1z" fill="var(--color-pixel-14)" />
      {/* Bars */}
      <path d="M3 10h2v4H3z" fill="var(--color-pixel-10)" />
      <path d="M6 7h2v7H6z" fill="var(--color-pixel-9)" />
      <path d="M9 4h2v10H9z" fill="var(--color-pixel-5)" />
      <path d="M12 2h2v12h-2z" fill="var(--color-pixel-6)" />
      {/* Trend dots */}
      <path d="M4 8h1v1H4zM7 5h1v1H7zM10 3h1v1h-1zM13 1h1v1h-1z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 16. Media and Entertainment: Media Player / Screen */
export function CatMediaAndEntertainmentIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Screen Frame */}
      <path d="M1 2h14v12H1z" fill="var(--color-pixel-15)" />
      {/* Screen Inner Display */}
      <path d="M2 3h12v10H2z" fill="var(--color-pixel-0)" />
      {/* Play Triangle */}
      <path d="M6 5h2v6H6zM8 6h2v4H8zM10 7h2v2h-2z" fill="var(--color-pixel-3)" />
      <path d="M2 3h1v1H2zM13 3h1v1h-1z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 17. Hardware and IoT: Microchip with Circuit Pins */
export function CatHardwareAndIotIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Pins top/bottom */}
      <path d="M4 1h1v2H4zM7 1h1v2H7zM10 1h1v2h-1zM4 13h1v2H4zM7 13h1v2H7zM10 13h1v2h-1z" fill="var(--color-pixel-4)" />
      {/* Pins left/right */}
      <path d="M1 4h2v1H1zM1 7h2v1H1zM1 10h2v1H1zM13 4h2v1h-2zM13 7h2v1h-2zM13 10h2v1h-2z" fill="var(--color-pixel-4)" />
      {/* Chip Body */}
      <path d="M3 3h10v10H3z" fill="var(--color-pixel-15)" />
      {/* Silicon Die */}
      <path d="M5 5h6v6H5z" fill="var(--color-pixel-14)" />
      <path d="M4 4h1v1H4z" fill="var(--color-pixel-12)" />
    </svg>
  );
}

/** 18. Privacy and Security: Padlock */
export function CatPrivacyAndSecurityIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Shackle */}
      <path d="M5 2h6v2H5zM4 4h2v4H4zM10 4h2v4h-2z" fill="var(--color-pixel-13)" />
      {/* Lock Body */}
      <path d="M2 7h12v8H2z" fill="var(--color-pixel-4)" />
      <path d="M2 13h12v2H2zM12 7h2v8h-2z" fill="var(--color-pixel-3)" />
      {/* Keyhole */}
      <path d="M7 9h2v2H7zM7 11h2v2H7z" fill="var(--color-pixel-0)" />
    </svg>
  );
}

/** 19. Self-Hosted and Homelab: Server Rack Blades */
export function CatSelfHostedAndHomelabIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Rack Frame */}
      <path d="M1 2h14v12H1z" fill="var(--color-pixel-15)" />
      {/* Blade 1 */}
      <path d="M2 3h12v3H2z" fill="var(--color-pixel-14)" />
      <path d="M3 4h4v1H3z" fill="var(--color-pixel-0)" />
      <path d="M11 4h2v1h-2z" fill="var(--color-pixel-5)" />
      {/* Blade 2 */}
      <path d="M2 7h12v3H2z" fill="var(--color-pixel-14)" />
      <path d="M3 8h4v1H3z" fill="var(--color-pixel-0)" />
      <path d="M11 8h2v1h-2z" fill="var(--color-pixel-10)" />
      {/* Blade 3 */}
      <path d="M2 11h12v3H2z" fill="var(--color-pixel-14)" />
      <path d="M3 12h4v1H3z" fill="var(--color-pixel-0)" />
      <path d="M11 12h2v1h-2z" fill="var(--color-pixel-4)" />
    </svg>
  );
}

/** 20. Web Templates and Starters: Browser Window */
export function CatWebTemplatesAndStartersIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Browser Shell */}
      <path d="M1 2h14v12H1z" fill="var(--color-pixel-14)" />
      {/* Title Bar */}
      <path d="M1 2h14v3H1z" fill="var(--color-pixel-15)" />
      {/* Dots */}
      <path d="M2 3h1v1H2z" fill="var(--color-pixel-2)" />
      <path d="M4 3h1v1H4z" fill="var(--color-pixel-4)" />
      <path d="M6 3h1v1H6z" fill="var(--color-pixel-6)" />
      {/* Viewport */}
      <path d="M2 5h12v8H2z" fill="var(--color-pixel-12)" />
      {/* Web Blocks */}
      <path d="M3 6h10v3H3z" fill="var(--color-pixel-10)" />
      <path d="M3 10h4v2H3z" fill="var(--color-pixel-9)" />
      <path d="M8 10h5v2H8z" fill="var(--color-pixel-9)" />
    </svg>
  );
}

/** 21. Mobile Apps: Smartphone */
export function CatMobileAppsIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Phone Case */}
      <path d="M4 1h8v14H4z" fill="var(--color-pixel-15)" />
      {/* Speaker */}
      <path d="M7 2h2v1H7z" fill="var(--color-pixel-0)" />
      {/* Screen */}
      <path d="M5 4h6v9H5z" fill="var(--color-pixel-10)" />
      {/* App Grid */}
      <path d="M6 5h1v1H6z" fill="var(--color-pixel-2)" />
      <path d="M9 5h1v1H9z" fill="var(--color-pixel-4)" />
      <path d="M6 7h1v1H6z" fill="var(--color-pixel-6)" />
      <path d="M9 7h1v1H9z" fill="var(--color-pixel-5)" />
      <path d="M7 10h2v1H7z" fill="var(--color-pixel-12)" />
      {/* Home Indicator */}
      <path d="M7 14h2v1H7z" fill="var(--color-pixel-13)" />
    </svg>
  );
}

/** 22. Accessibility: Universal Human Figure */
export function CatAccessibilityIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Corner Ring Markers */}
      <path d="M1 1h2v1H1zM13 1h2v1h-2zM1 14h2v1H1zM13 14h2v1h-2z" fill="var(--color-pixel-11)" />
      {/* Head */}
      <path d="M7 2h2v2H7z" fill="var(--color-pixel-10)" />
      {/* Outstretched Arms */}
      <path d="M2 5h12v2H2z" fill="var(--color-pixel-10)" />
      {/* Torso */}
      <path d="M7 6h2v4H7z" fill="var(--color-pixel-10)" />
      {/* Legs */}
      <path d="M5 10h2v4H5zM9 10h2v4H9z" fill="var(--color-pixel-10)" />
    </svg>
  );
}

/** 23. Fun and Experiments: Science Flask / Potion */
export function CatFunAndExperimentsIcon({ size = 16, className, ...rest }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className} {...rest}>
      {/* Flask Lip & Neck */}
      <path d="M6 1h4v1H6z" fill="var(--color-pixel-14)" />
      <path d="M7 2h2v4H7z" fill="var(--color-pixel-14)" />
      {/* Flask Glass Outline */}
      <path d="M5 6h2v1H5zM9 6h2v1H9zM3 7h2v2H3zM11 7h2v2h-2zM2 9h12v5H2zM3 14h10v1H3z" fill="var(--color-pixel-13)" />
      {/* Glowing Potion Liquid */}
      <path d="M3 10h10v4H3z" fill="var(--color-pixel-5)" />
      <path d="M3 9h4v1H3zM8 10h4v1H8z" fill="var(--color-pixel-6)" />
      {/* Bubbles */}
      <path d="M7 4h1v1H7zM8 2h1v1H8z" fill="var(--color-pixel-11)" />
      <path d="M5 8h1v1H5z" fill="var(--color-pixel-12)" />
    </svg>
  );
}

/**
 * Map of category icon keys (`cat-<slug>`) to their React components.
 */
export const CATEGORY_ICONS: Record<string, ComponentType<PixelIconProps>> = {
  "cat-games": CatGamesIcon,
  "cat-production": CatProductionIcon,
  "cat-tools-and-utilities": CatToolsAndUtilitiesIcon,
  "cat-suites": CatSuitesIcon,
  "cat-productivity": CatProductivityIcon,
  "cat-developer-tools": CatDeveloperToolsIcon,
  "cat-ai-and-agents": CatAiAndAgentsIcon,
  "cat-creative-and-design": CatCreativeAndDesignIcon,
  "cat-finance-and-money": CatFinanceAndMoneyIcon,
  "cat-health-and-fitness": CatHealthAndFitnessIcon,
  "cat-education-and-learning": CatEducationAndLearningIcon,
  "cat-home-and-life": CatHomeAndLifeIcon,
  "cat-social-and-community": CatSocialAndCommunityIcon,
  "cat-business-and-ops": CatBusinessAndOpsIcon,
  "cat-data-and-analytics": CatDataAndAnalyticsIcon,
  "cat-media-and-entertainment": CatMediaAndEntertainmentIcon,
  "cat-hardware-and-iot": CatHardwareAndIotIcon,
  "cat-privacy-and-security": CatPrivacyAndSecurityIcon,
  "cat-self-hosted-and-homelab": CatSelfHostedAndHomelabIcon,
  "cat-web-templates-and-starters": CatWebTemplatesAndStartersIcon,
  "cat-mobile-apps": CatMobileAppsIcon,
  "cat-accessibility": CatAccessibilityIcon,
  "cat-fun-and-experiments": CatFunAndExperimentsIcon,

  // Also support bare slugs for convenience
  "games": CatGamesIcon,
  "production": CatProductionIcon,
  "tools-and-utilities": CatToolsAndUtilitiesIcon,
  "suites": CatSuitesIcon,
  "productivity": CatProductivityIcon,
  "developer-tools": CatDeveloperToolsIcon,
  "ai-and-agents": CatAiAndAgentsIcon,
  "creative-and-design": CatCreativeAndDesignIcon,
  "finance-and-money": CatFinanceAndMoneyIcon,
  "health-and-fitness": CatHealthAndFitnessIcon,
  "education-and-learning": CatEducationAndLearningIcon,
  "home-and-life": CatHomeAndLifeIcon,
  "social-and-community": CatSocialAndCommunityIcon,
  "business-and-ops": CatBusinessAndOpsIcon,
  "data-and-analytics": CatDataAndAnalyticsIcon,
  "media-and-entertainment": CatMediaAndEntertainmentIcon,
  "hardware-and-iot": CatHardwareAndIotIcon,
  "privacy-and-security": CatPrivacyAndSecurityIcon,
  "self-hosted-and-homelab": CatSelfHostedAndHomelabIcon,
  "web-templates-and-starters": CatWebTemplatesAndStartersIcon,
  "mobile-apps": CatMobileAppsIcon,
  "accessibility": CatAccessibilityIcon,
  "fun-and-experiments": CatFunAndExperimentsIcon,
};

export interface CategoryIconProps extends PixelIconProps {
  iconKey?: string | null;
}

/**
 * Universal dynamic category icon renderer.
 * Looks up the icon by `cat-<slug>` or bare slug; falls back silently if unknown.
 */
export function CategoryIcon({ iconKey, ...rest }: CategoryIconProps) {
  if (!iconKey) return null;
  const Component = CATEGORY_ICONS[iconKey];
  if (!Component) return null;
  return <Component {...rest} />;
}
