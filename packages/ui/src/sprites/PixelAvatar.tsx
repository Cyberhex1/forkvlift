/**
 * 16-bit avatar (task 3.11). Drawn as layered 16×16 SVG rects so every color
 * comes from tokens and the art stays crisp at any size. Layers, bottom to top:
 * outfit → skin (neck, head) → face → hair → accessory.
 *
 * Config keys (AvatarConfig in packages/shared):
 *   hair      "<style>" or "<style>-<tone>"   e.g. "bob", "spiky-red"
 *   outfit    one of AVATAR_PARTS.outfit
 *   color     outfit color, a pixel-N token name
 *   accessory one of AVATAR_PARTS.accessory, or null
 *   skin      skin-1 … skin-5 (optional; older saves default to skin-2)
 */
import type { SVGProps } from "react";
import { cn } from "../cn";

export interface AvatarLook {
  hair: string;
  outfit: string;
  color: string;
  accessory: string | null;
  skin?: string;
}

type Rect = readonly [x: number, y: number, w: number, h: number];

const HAIR_STYLES: Record<string, Rect[]> = {
  short: [[5, 1, 6, 1], [5, 2, 6, 2], [4, 3, 1, 3], [11, 3, 1, 3]],
  bob: [[5, 1, 6, 1], [4, 2, 8, 2], [4, 4, 1, 5], [11, 4, 1, 5]],
  spiky: [[6, 0, 1, 1], [8, 0, 1, 1], [5, 1, 1, 1], [7, 1, 1, 1], [9, 1, 1, 1], [5, 2, 6, 2], [4, 3, 1, 2], [11, 3, 1, 2]],
  long: [[5, 1, 6, 1], [4, 2, 8, 2], [4, 4, 1, 8], [11, 4, 1, 8], [3, 7, 1, 5], [12, 7, 1, 5]],
  bun: [[6, 1, 4, 1], [5, 2, 6, 2], [7, 0, 2, 2], [4, 3, 1, 2], [11, 3, 1, 2]],
  curly: [[5, 0, 6, 1], [4, 1, 8, 3], [3, 2, 1, 5], [12, 2, 1, 5], [4, 4, 1, 3], [11, 4, 1, 3]],
  ponytail: [[5, 1, 6, 1], [5, 2, 6, 2], [4, 3, 1, 3], [11, 3, 1, 2], [12, 2, 2, 3], [13, 5, 2, 4]],
  afro: [[3, 0, 10, 4], [2, 1, 12, 5], [2, 6, 2, 2], [12, 6, 2, 2], [4, 4, 1, 2], [11, 4, 1, 2]],
  mohawk: [[7, 0, 2, 5], [6, 1, 1, 3], [9, 1, 1, 3], [4, 4, 1, 2], [11, 4, 1, 2]],
  undercut: [[4, 1, 8, 3], [3, 2, 2, 4], [11, 3, 1, 1], [5, 4, 2, 1]],
  dreads: [[4, 1, 8, 3], [3, 3, 2, 7], [11, 3, 2, 7], [2, 5, 1, 5], [13, 5, 1, 5]],
  bangs: [[4, 1, 8, 3], [4, 4, 8, 1], [4, 5, 1, 4], [11, 5, 1, 4]],
  bald: [],
};
const HAIR_TONES = ["dark", "brown", "blond", "red", "gray"] as const;

const OUTFITS: Record<string, (c: string) => [Rect, string][]> = {
  tee: (c) => [[[3, 11, 10, 5], c], [[6, 11, 4, 1], "pixel-12"]],
  hoodie: (c) => [
    [[3, 11, 10, 5], c],
    [[4, 10, 2, 1], c],
    [[10, 10, 2, 1], c],
    [[7, 12, 1, 2], "pixel-12"],
    [[8, 12, 1, 2], "pixel-12"],
    [[6, 13, 4, 2], "pixel-15"],
  ],
  jacket: (c) => [
    [[3, 11, 10, 5], c],
    [[7, 11, 2, 5], "pixel-12"],
    [[6, 11, 1, 4], "pixel-15"],
    [[9, 11, 1, 4], "pixel-15"],
  ],
  overalls: (c) => [
    [[3, 11, 10, 5], "pixel-12"],
    [[5, 11, 1, 3], c],
    [[10, 11, 1, 3], c],
    [[5, 13, 6, 3], c],
    [[7, 14, 2, 2], "pixel-14"],
  ],
  robe: (c) => [[[2, 11, 12, 5], c], [[7, 11, 2, 5], "pixel-4"], [[6, 13, 4, 1], "pixel-4"]],
  suit: (c) => [
    [[3, 11, 10, 5], c],
    [[7, 11, 2, 3], "pixel-12"],
    [[7, 12, 2, 2], "pixel-2"],
    [[6, 11, 1, 3], "pixel-0"],
    [[9, 11, 1, 3], "pixel-0"],
  ],
  sweater: (c) => [
    [[3, 11, 10, 5], c],
    [[3, 12, 10, 1], "pixel-12"],
    [[3, 14, 10, 1], "pixel-12"],
  ],
  cyberpunk: (c) => [
    [[3, 11, 10, 5], "pixel-15"],
    [[4, 10, 2, 1], c],
    [[10, 10, 2, 1], c],
    [[7, 11, 2, 5], c],
    [[4, 13, 8, 1], c],
  ],
  tank: (c) => [[[5, 11, 6, 5], c], [[3, 13, 2, 3], c], [[11, 13, 2, 3], c]],
};

const ACCESSORIES: Record<string, [Rect, string][]> = {
  glasses: [[[5, 6, 6, 1], "pixel-0"], [[6, 6, 1, 1], "pixel-11"], [[9, 6, 1, 1], "pixel-11"]],
  sunglasses: [
    [[5, 6, 6, 1], "pixel-0"],
    [[5, 6, 3, 2], "pixel-0"],
    [[8, 6, 3, 2], "pixel-0"],
    [[6, 6, 1, 1], "pixel-14"],
    [[9, 6, 1, 1], "pixel-14"],
  ],
  cap: [[[5, 0, 6, 1], "pixel-2"], [[4, 1, 8, 2], "pixel-2"], [[10, 3, 3, 1], "pixel-2"]],
  beanie: [[[4, 0, 8, 3], "pixel-3"], [[3, 3, 10, 1], "pixel-2"]],
  headphones: [
    [[4, 1, 8, 1], "pixel-15"],
    [[3, 5, 2, 3], "pixel-2"],
    [[11, 5, 2, 3], "pixel-2"],
    [[3, 6, 1, 1], "pixel-12"],
    [[12, 6, 1, 1], "pixel-12"],
  ],
  scarf: [[[4, 10, 8, 2], "pixel-2"], [[8, 10, 2, 2], "pixel-3"], [[9, 12, 2, 2], "pixel-2"]],
  flower: [[[10, 2, 2, 2], "pixel-3"], [[10, 2, 1, 1], "pixel-4"], [[11, 3, 1, 1], "pixel-5"]],
  crown: [[[5, 0, 6, 2], "pixel-4"], [[5, 0, 1, 1], "pixel-3"], [[7, 0, 2, 1], "pixel-3"], [[10, 0, 1, 1], "pixel-3"]],
  eyepatch: [[[5, 5, 3, 3], "pixel-0"], [[4, 4, 8, 1], "pixel-0"]],
  "cat-ears": [[[4, 0, 2, 2], "pixel-15"], [[10, 0, 2, 2], "pixel-15"], [[4, 1, 1, 1], "pixel-3"], [[11, 1, 1, 1], "pixel-3"]],
  halo: [[[5, 0, 6, 1], "pixel-4"], [[4, 0, 1, 1], "pixel-12"], [[11, 0, 1, 1], "pixel-12"]],
};

const OUTFIT_COLORS = ["pixel-9", "pixel-2", "pixel-6", "pixel-3", "pixel-1", "pixel-7", "pixel-10", "pixel-14", "pixel-15", "pixel-5"] as const;
const SKINS = ["skin-1", "skin-2", "skin-3", "skin-4", "skin-5"] as const;

/** Every choice the avatar builder offers. */
export const AVATAR_PARTS = {
  hairStyles: Object.keys(HAIR_STYLES),
  hairTones: [...HAIR_TONES],
  outfit: Object.keys(OUTFITS),
  color: [...OUTFIT_COLORS],
  accessory: [null, ...Object.keys(ACCESSORIES)] as (string | null)[],
  skin: [...SKINS],
};

export const DEFAULT_AVATAR: AvatarLook = { hair: "short", outfit: "hoodie", color: "pixel-9", accessory: null, skin: "skin-2" };

/** Split "bob-red" into style and tone, falling back to known values. */
export function parseHair(hair: string): { style: string; tone: (typeof HAIR_TONES)[number] } {
  const [style = "short", tone = "dark"] = hair.split("-");
  return {
    style: style in HAIR_STYLES ? style : "short",
    tone: (HAIR_TONES as readonly string[]).includes(tone) ? (tone as (typeof HAIR_TONES)[number]) : "dark",
  };
}

/** A stable look for people who haven't built one yet. */
export function fallbackLook(seed: string): AvatarLook {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = <T,>(list: readonly T[], shift: number) => list[(h >>> shift) % list.length]!;
  return {
    hair: `${pick(AVATAR_PARTS.hairStyles.filter((s) => s !== "bald"), 0)}-${pick(HAIR_TONES, 3)}`,
    outfit: pick(AVATAR_PARTS.outfit, 6),
    color: pick(OUTFIT_COLORS, 9),
    accessory: null,
    skin: pick(SKINS, 12),
  };
}

const fill = (token: string) => `var(--color-${token})`;

export interface PixelAvatarProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  look: AvatarLook | null | undefined;
  /** Used for the fallback look and the accessible name. */
  name: string;
  size?: number | string;
  /** Show only the head (for the mobile Plaza strip and small chips). */
  headOnly?: boolean;
  decorative?: boolean;
}

export function PixelAvatar({ look, name, size = 48, headOnly, decorative, className, ...rest }: PixelAvatarProps) {
  const l = look ?? fallbackLook(name);
  const hair = parseHair(l.hair);
  const skin = fill((SKINS as readonly string[]).includes(l.skin ?? "") ? l.skin! : "skin-2");
  const color = (OUTFIT_COLORS as readonly string[]).includes(l.color) ? l.color : "pixel-9";
  const outfit = (OUTFITS[l.outfit] ?? OUTFITS.hoodie!)(color);
  const accessory = l.accessory ? (ACCESSORIES[l.accessory] ?? []) : [];
  const r = (rect: Rect, f: string, key: string) => <rect key={key} x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} fill={f} />;

  return (
    <svg
      viewBox={headOnly ? "2 0 12 12" : "0 0 16 16"}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : name}
      {...rest}
    >
      {outfit.map(([rect, c], i) => r(rect, fill(c), `o${i}`))}
      {r([7, 10, 2, 1], skin, "neck")}
      {r([5, 3, 6, 7], skin, "head")}
      {r([4, 5, 1, 2], skin, "earL")}
      {r([11, 5, 1, 2], skin, "earR")}
      {r([6, 6, 1, 1], fill("pixel-0"), "eyeL")}
      {r([9, 6, 1, 1], fill("pixel-0"), "eyeR")}
      {r([7, 8, 2, 1], fill("pixel-2"), "mouth")}
      {HAIR_STYLES[hair.style]!.map((rect, i) => r(rect, fill(`hair-${hair.tone}`), `h${i}`))}
      {accessory.map(([rect, c], i) => r(rect, fill(c), `a${i}`))}
    </svg>
  );
}
