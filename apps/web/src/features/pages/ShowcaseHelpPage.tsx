import { Link } from "react-router";
import { SITE_NAME } from "@forkvlift/shared";
import { Badge, buttonClasses, Card } from "@forkvlift/ui";
import {
  SHOWCASE_RULES,
  SHOW_OFF_SATURDAY,
  DOWNLOAD_SAFETY_NOTICE,
} from "./showcaseCopy";
import { NoLicenseBanner } from "./NoLicenseDisclaimer";

/**
 * Showcase Help & FAQ page (/help/showcases) — Task 5.8.
 * Concise, plain English guide to showcasing AI builds on ForkLift.
 */
export function ShowcaseHelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            Showcase Guide
          </Badge>
          <Badge tone="neutral">
            Look, don&apos;t take
          </Badge>
        </div>
        <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">
          Everything You Need to Know About Showcases
        </h1>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          {SITE_NAME} has two sides: the <strong>Catalog</strong> for reusable open-source code you can fork,
          and <strong>Showcases</strong> for celebrating what people built with AI — whether or not the code is public.
        </p>
      </div>

      {/* Comparison: Catalog vs Showcase */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          Showcases vs. Catalog Projects
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="space-y-3 border-t-4 border-t-muted p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                Catalog Project
              </span>
              <span className="rounded-pixel bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted">
                Forkable
              </span>
            </div>
            <ul className="space-y-2 text-xs text-muted leading-relaxed">
              <li>• Public GitHub repository required</li>
              <li>• Open-source license recommended (unlicensed projects are permitted, but hidden by default behind &ldquo;Show unlicensed projects&rdquo;)</li>
              <li>• Fork tree, clone box, and agent handoffs</li>
              <li>• Core purpose: Reusable code so nobody builds the same app twice</li>
            </ul>
          </Card>

          <Card className="space-y-3 border-t-4 border-t-accent p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                Showcase
              </span>
              <span className="rounded-pixel bg-accent/15 px-2 py-0.5 font-mono text-xs text-accent">
                Look, don&apos;t take
              </span>
            </div>
            <ul className="space-y-2 text-xs text-muted leading-relaxed">
              <li>• Public code is completely optional</li>
              <li>• Closed-source apps, games, SaaS &amp; media welcome</li>
              <li>• Zero fork or clone buttons (look, don&apos;t take)</li>
              <li>• Core purpose: Share your build story, tools used, and inspiration</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* What is allowed */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          What Can You Showcase?
        </h2>
        <Card className="p-5 space-y-3">
          <p className="text-sm text-fg leading-relaxed">
            {SHOWCASE_RULES.whatsAllowed.summary}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              "Games (itch.io, Steam)",
              "Mobile apps (iOS, Android)",
              "Web apps & SaaS",
              "Internal company tools",
              "Short films & video",
              "Generative art",
            ].map((kind) => (
              <span
                key={kind}
                className="rounded-pixel bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted"
              >
                {kind}
              </span>
            ))}
          </div>
        </Card>
      </section>

      {/* Honest AI use */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          Honest AI Attribution
        </h2>
        <Card className="p-5 space-y-3">
          <p className="text-sm text-fg leading-relaxed">
            {SHOWCASE_RULES.honestAiUse.summary}
          </p>
          <div className="rounded-pixel bg-surface-2 p-3 text-xs text-muted space-y-1">
            <p className="font-semibold text-fg">What to share in your build story:</p>
            <p>1. The AI tools and foundation models you used (e.g. Claude, Cursor, Gemini, v0).</p>
            <p>2. The prompts, architectures, or workflow setups that made the biggest difference.</p>
            <p>3. Where the model failed or required manual correction.</p>
          </div>
        </Card>
      </section>

      {/* Links & downloads safety */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          Links &amp; Downloads Safety
        </h2>
        <Card className="p-5 space-y-3">
          <p className="text-sm text-fg leading-relaxed">
            {SHOWCASE_RULES.linksAndSafety.summary}
          </p>
          <div className="rounded-card border border-warning/40 bg-surface-2 p-4 text-xs text-muted space-y-2">
            <div className="flex items-center gap-2 font-display text-sm font-semibold text-warning">
              <span>⚠️</span>
              <span>{DOWNLOAD_SAFETY_NOTICE.title}</span>
            </div>
            <p className="leading-relaxed">
              {DOWNLOAD_SAFETY_NOTICE.message}
            </p>
          </div>
        </Card>
      </section>

      {/* Show-off Saturday */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-fg">
            {SHOW_OFF_SATURDAY.name}
          </h2>
          <span className="font-mono text-xs text-accent">Weekly community event</span>
        </div>
        <Card className="p-5 space-y-4">
          <p className="text-sm text-fg leading-relaxed">
            {SHOW_OFF_SATURDAY.description}
          </p>
          <div className="space-y-2 border-t border-border pt-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              Event Rules
            </h3>
            <ul className="space-y-1.5 text-xs text-muted">
              {SHOW_OFF_SATURDAY.rules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-accent">›</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      {/* Open Source Conversion & Licensing */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-fg">
          Can I Open-Source My Showcase Later?
        </h2>
        <Card className="p-5 space-y-3">
          <p className="text-sm text-fg leading-relaxed">
            Yes! If you decide to release your code publicly under an open-source license, you can list
            your showcase in the {SITE_NAME} catalog with a single click. Your project will retain all of its
            community upvotes and comments, and gain full catalog features (the clone box, fork tree, and agent tools).
          </p>
          <p className="text-xs text-muted">
            Remember: Authors may list unlicensed projects in the catalog, but they are hidden by default behind &ldquo;Show unlicensed projects&rdquo;. Unlicensed code cannot be forked legally without permission:
          </p>
          <div className="pt-2">
            <NoLicenseBanner />
          </div>
        </Card>
      </section>

      {/* Call to action */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
        <Link to="/studio" className={buttonClasses("primary", "md")}>
          Submit a showcase
        </Link>
        <Link to="/rules" className={buttonClasses("secondary", "md")}>
          Read Community Rules
        </Link>
        <Link to="/licensing" className={buttonClasses("secondary", "md")}>
          Licensing 101
        </Link>
      </div>
    </div>
  );
}
