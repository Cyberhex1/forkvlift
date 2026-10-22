import { Link } from "react-router";
import { Card } from "@forkvlift/ui";
import {
  ShowcaseBadge,
  ClosedSourceBadge,
  ShowcaseEmptyArt,
  ShowcaseEmptyState,
  ShowcaseOgCard,
  ShowcaseBadgeIcon,
  ClosedSourceBadgeIcon,
} from "@forkvlift/ui/icons";

export function ShowcaseArtPreview() {
  const sampleOg = {
    title: "Pixel Dungeons 2026",
    tagline: "A procedurally generated pixel art dungeon crawler created in 48 hours using Gemini.",
    maker: {
      username: "retro_maker",
      displayName: "Retro Craftsman",
    },
    category: "Games",
    aiTools: ["Gemini 1.5", "v0", "Claude"],
    isClosedSource: true,
    upvotes: 42,
    stage: "finished" as const,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <ShowcaseBadge />
          <ClosedSourceBadge compact />
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold text-fg sm:text-3xl">
          Showcase Art &amp; RSS Asset Kit
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Task 5.7: 16x16 pixel badges, showcase empty-state art, and OG share card template.
          Strict ForkLift invariant: Showcases never get clone or fork wording.
        </p>
      </div>

      {/* 1. 16x16 Pixel Badges */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          1. 16x16 Pixel Badges
        </h2>
        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              Showcase Badge (Task 5.7)
            </h3>
            <p className="text-sm text-muted">
              Identifies community showcase projects across catalog feeds, search, and detail views.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ShowcaseBadge />
              <div className="flex items-center gap-1.5 rounded-pixel bg-surface-2 px-2.5 py-1 text-xs text-muted">
                <ShowcaseBadgeIcon size={16} />
                <span>16x16 icon: Crystal on Pedestal</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              Closed Source Badge (Task 5.7)
            </h3>
            <p className="text-sm text-muted">
              Explicitly signals closed source status (&quot;Closed source: look, don&apos;t take&quot;) so viewers know code is not offered.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ClosedSourceBadge />
              <ClosedSourceBadge compact />
              <div className="flex items-center gap-1.5 rounded-pixel bg-surface-2 px-2.5 py-1 text-xs text-muted">
                <ClosedSourceBadgeIcon size={16} />
                <span>16x16 icon: Closed Coral Padlock</span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 2. Showcase Empty States */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          2. Showcase Empty-State Art (32x32 Pixel Vitrine)
        </h2>
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="rounded-pixel bg-surface-2 p-3">
              <ShowcaseEmptyArt size={48} />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-fg">
                Exhibition Vitrine &amp; Spotlight Illustration
              </h3>
              <p className="text-xs text-muted">
                Pixel-drawn gemstone pedestal bathed in gallery spotlight with sparkles.
              </p>
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface-1 p-6">
            <ShowcaseEmptyState
              title="No showcases match your filter"
              description="No showcases found in this view. Have you built something awesome with AI? Share your creation with the ForkLift community!"
              action={
                <Link
                  to="/submit"
                  className="rounded-pixel bg-accent px-4 py-2 font-mono text-xs font-semibold text-accent-contrast shadow-sm hover:opacity-90 transition-opacity"
                >
                  Submit a showcase
                </Link>
              }
              variant="card"
            />
          </div>
        </Card>
      </section>

      {/* 3. OG Share Image Card */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          3. Showcase OG Share Image Template (1200x630)
        </h2>
        <Card className="p-6 space-y-4">
          <p className="text-sm text-muted">
            Vector SVG share card featuring showcase crystal pedestal, maker attribution, category &amp; stage, AI tools used, and upvote counters. Completely free of clone or fork wording.
          </p>
          <div className="overflow-hidden rounded-card border border-border shadow-md">
            <ShowcaseOgCard options={sampleOg} className="w-full" />
          </div>
        </Card>
      </section>

      {/* 4. Showcase RSS Feed */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          4. Showcase RSS Feed (Task 5.7)
        </h2>
        <Card className="p-6 space-y-3">
          <p className="text-sm text-muted">
            Live RSS 2.0 feed with category and user filtering. Items feature honest attribution, AI tools, and upvotes without fork/clone actions.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/feeds/showcases.rss"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-pixel border border-accent bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/20 transition-colors"
            >
              <span>📡 Open Showcase RSS Feed</span>
            </a>
            <code className="rounded-pixel bg-surface-2 px-2 py-1 font-mono text-xs text-muted">
              GET /api/feeds/showcases.rss?category=games
            </code>
          </div>
        </Card>
      </section>
    </div>
  );
}
