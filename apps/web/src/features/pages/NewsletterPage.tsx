import { useSearchParams, Link } from "react-router";
import { Badge, buttonClasses, Card } from "@forkvlift/ui";
import { SITE_NAME } from "@forkvlift/shared";
import { NewsletterBox } from "./NewsletterBox";
import { NewsletterConfirmPage } from "./NewsletterConfirmPage";
import { NewsletterUnsubscribePage } from "./NewsletterUnsubscribePage";

export function NewsletterPage() {
  const [searchParams] = useSearchParams();
  const confirmToken = searchParams.get("confirm");
  const unsubscribeToken = searchParams.get("unsubscribe");

  if (confirmToken) {
    return <NewsletterConfirmPage token={confirmToken} />;
  }

  if (unsubscribeToken) {
    return <NewsletterUnsubscribePage token={unsubscribeToken} />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top breadcrumbs */}
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4 text-xs text-muted">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-mono text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
        >
          ← Back to catalog
        </Link>
        <span className="font-mono text-muted">Weekly Dispatch</span>
      </div>

      {/* Header */}
      <header className="mb-10 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">The Fork Report</Badge>
          <span className="font-mono text-xs text-muted">Delivered every Friday</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
          The Weekly Vibe-Coding Newsletter
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Stay on top of the freshest vibe-coded apps, discover high-potential repos to fork and
          prompt, and replace expensive SaaS subscriptions with free, open alternatives.
        </p>
      </header>

      {/* Signup box prominent */}
      <div className="mb-12">
        <NewsletterBox variant="section" />
      </div>

      {/* Content Pillars */}
      <section className="mb-12 space-y-6">
        <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
          What you'll find in every issue
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="space-y-2">
            <div className="font-mono text-sm text-accent">01. Fresh Releases</div>
            <h3 className="font-display text-base font-semibold text-fg">Verified Projects</h3>
            <p className="text-sm text-muted">
              Hand-tested projects built with AI coding assistants. Complete with working demos,
              license badges, and starter prompts ready for your agent.
            </p>
          </Card>

          <Card className="space-y-2">
            <div className="font-mono text-sm text-accent">02. Fork Lineage</div>
            <h3 className="font-display text-base font-semibold text-fg">Trending Evolutions</h3>
            <p className="text-sm text-muted">
              Discover how fellow developers fork, improve, and extend existing projects. See real
              lineage trees and pick up where others left off.
            </p>
          </Card>

          <Card className="space-y-2">
            <div className="font-mono text-sm text-accent">03. Open Replacements</div>
            <h3 className="font-display text-base font-semibold text-fg">Subscription Slayers</h3>
            <p className="text-sm text-muted">
              Free, self-hostable open source alternatives to subscription software, calculating
              the total dollars saved across the community.
            </p>
          </Card>
        </div>
      </section>

      {/* Ethics & Promise */}
      <section className="rounded-card border border-border bg-surface-2 p-6 sm:p-8 space-y-3">
        <h3 className="font-display text-lg font-semibold text-fg">
          Our promise to subscribers
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li><strong>Zero spam:</strong> Strictly one high-value email per week. No promotional partner blasts.</li>
          <li><strong>Double opt-in:</strong> We only send issues to confirmed email addresses.</li>
          <li><strong>One-click unsubscribe:</strong> Every email includes a direct unsubscribe link. No dark patterns.</li>
          <li><strong>Privacy first:</strong> We never sell, rent, or monetize subscriber emails.</li>
        </ul>
        <div className="pt-2">
          <Link to="/about" className={buttonClasses("secondary", "sm")}>
            Learn more about {SITE_NAME}
          </Link>
        </div>
      </section>
    </div>
  );
}
