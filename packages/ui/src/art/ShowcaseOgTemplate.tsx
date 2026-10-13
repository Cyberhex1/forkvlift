import type { HTMLAttributes } from "react";

export interface ShowcaseOgOptions {
  title: string;
  tagline?: string;
  maker: {
    username: string;
    displayName?: string | null;
  };
  category?: string;
  aiTools?: string[];
  isClosedSource?: boolean;
  upvotes?: number;
  stage?: "finished" | "wip";
  siteName?: string;
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an SVG string (1200x630) for a showcase OG share image (Task 5.7).
 * Follows the strict rule: Showcases never get clone or fork wording.
 */
export function renderShowcaseOgSvg(opts: ShowcaseOgOptions): string {
  const site = escapeXml(opts.siteName || "ForkLift");
  const title = escapeXml(opts.title);
  const tagline = escapeXml(opts.tagline || "");
  const makerName = escapeXml(opts.maker.displayName || opts.maker.username);
  const username = escapeXml(opts.maker.username);
  const rawCategory = (opts.category || "Showcase").toUpperCase();
  const category = escapeXml(rawCategory);
  const upvotes = Math.max(0, opts.upvotes || 0);
  const isClosed = opts.isClosedSource ?? false;
  const rawStage = (opts.stage === "wip" ? "Work in progress" : "Finished").toUpperCase();
  const stage = escapeXml(rawStage);
  const tools = (opts.aiTools || []).slice(0, 3).map(escapeXml);

  const licenseLabel = isClosed ? "Closed source: look, don't take" : "Showcase";
  const licenseColor = isClosed ? "#ef7d57" : "#73eff7";

  const toolsChips = tools
    .map(
      (t, i) => `
    <g transform="translate(${500 + i * 140}, 530)">
      <rect width="130" height="34" rx="4" fill="#333c57" />
      <text x="65" y="22" font-family="Courier New, monospace" font-size="14" fill="#f4f4f4" text-anchor="middle" font-weight="bold">${t}</text>
    </g>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <style>
      .display { font-family: 'Courier New', monospace; font-weight: bold; }
      .body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1c2c" />
      <stop offset="100%" stop-color="#11131f" />
    </linearGradient>
    <linearGradient id="pedestal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#73eff7" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#257179" stop-opacity="0.05" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- 16-bit pixel accent stripe at top -->
  <g id="pixel-stripe">
    <rect x="0" y="0" width="150" height="8" fill="#b13e53" />
    <rect x="150" y="0" width="150" height="8" fill="#ef7d57" />
    <rect x="300" y="0" width="150" height="8" fill="#ffcd75" />
    <rect x="450" y="0" width="150" height="8" fill="#a7f070" />
    <rect x="600" y="0" width="150" height="8" fill="#38b764" />
    <rect x="750" y="0" width="150" height="8" fill="#257179" />
    <rect x="900" y="0" width="150" height="8" fill="#29366f" />
    <rect x="1050" y="0" width="150" height="8" fill="#3b5dc9" />
  </g>

  <!-- Left Header: Brand & Label -->
  <g transform="translate(60, 60)">
    <rect width="110" height="32" rx="4" fill="#3b5dc9" />
    <text x="55" y="21" class="display" font-size="14" fill="#ffffff" text-anchor="middle">SHOWCASE</text>
    <text x="130" y="22" class="display" font-size="20" fill="#f4f4f4">${site}</text>
  </g>

  <!-- Right Header: Badges -->
  <g transform="translate(850, 60)">
    <!-- Closed source / Showcase pill -->
    <rect width="290" height="32" rx="4" fill="#333c57" />
    <circle cx="20" cy="16" r="6" fill="${licenseColor}" />
    <text x="36" y="21" class="display" font-size="13" fill="#f4f4f4">${licenseLabel}</text>
  </g>

  <!-- Showcase Content Area -->
  <g transform="translate(60, 160)">
    <!-- Category & Stage -->
    <text x="0" y="0" class="display" font-size="15" fill="#ffcd75">★ ${category} · ${stage}</text>

    <!-- Title (Large & Prominent) -->
    <text x="0" y="70" class="display" font-size="48" fill="#ffffff">${title}</text>

    <!-- Tagline / Build Story -->
    <text x="0" y="140" class="body" font-size="24" fill="#94b0c2" width="700">
      ${tagline}
    </text>

    <!-- Maker Info -->
    <g transform="translate(0, 260)">
      <rect width="48" height="48" rx="6" fill="#333c57" />
      <text x="24" y="30" class="display" font-size="20" fill="#ffcd75" text-anchor="middle">@</text>
      <text x="64" y="22" class="display" font-size="20" fill="#f4f4f4">Built by ${makerName}</text>
      <text x="64" y="44" class="display" font-size="15" fill="#94b0c2">@${username}</text>
    </g>

    <!-- Upvotes stat pill (Strictly no forks/clones) -->
    <g transform="translate(0, 370)">
      <rect width="160" height="34" rx="4" fill="#257179" />
      <text x="80" y="23" class="display" font-size="15" fill="#ffffff" text-anchor="middle">▲ ${upvotes} upvotes</text>
    </g>
  </g>

  <!-- AI Tools chips on bottom right -->
  ${toolsChips}

  <!-- Right Visual: Exhibition Spotlight Vitrine Illustration -->
  <g transform="translate(860, 200)">
    <!-- Light cone -->
    <polygon points="120,0 40,280 200,280" fill="url(#pedestal)" />
    
    <!-- Sparkles -->
    <polygon points="120,40 126,56 142,60 126,64 120,80 114,64 98,60 114,56" fill="#ffcd75" />
    <polygon points="70,120 73,130 83,133 73,136 70,146 67,136 57,133 67,130" fill="#73eff7" />
    <polygon points="170,140 173,150 183,153 173,156 170,166 167,156 157,153 167,150" fill="#f4f4f4" />

    <!-- Gem -->
    <polygon points="120,90 145,115 135,145 105,145 95,115" fill="#73eff7" />
    <polygon points="120,90 135,115 120,135 105,115" fill="#f4f4f4" opacity="0.8" />

    <!-- Velvet cushion -->
    <rect x="70" y="190" width="100" height="12" rx="3" fill="#b13e53" />
    <rect x="75" y="190" width="90" height="4" fill="#ef7d57" />

    <!-- Pedestal column -->
    <rect x="85" y="202" width="70" height="50" fill="#566c86" />
    <rect x="90" y="202" width="60" height="50" fill="#94b0c2" opacity="0.4" />

    <!-- Pedestal base -->
    <rect x="55" y="252" width="130" height="18" rx="2" fill="#333c57" />
    <rect x="40" y="270" width="160" height="16" rx="2" fill="#1a1c2c" stroke="#566c86" stroke-width="2" />
  </g>
</svg>`;
}

export interface ShowcaseOgCardProps extends HTMLAttributes<HTMLDivElement> {
  options: ShowcaseOgOptions;
}

/**
 * React SVG Component for Showcase OG Share Card (Task 5.7).
 */
export function ShowcaseOgCard({ options, className, ...rest }: ShowcaseOgCardProps) {
  const svg = renderShowcaseOgSvg(options);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
      {...rest}
    />
  );
}
