import { Link } from "react-router";
import { SITE_NAME, SITE_TAGLINE } from "@forkvlift/shared";
import { NewsletterBox } from "./NewsletterBox";

/**
 * Footer component — Task 1.17 final design with Task 4.10 newsletter signup.
 * Features retro pixel accent stripe, structured link columns,
 * accessibility labels, and mobile-friendly responsive grid.
 */
export function Footer() {
  const exploreLinks = [
    { to: "/", label: "Catalog feed" },
    { to: "/submit", label: "Submit a project" },
    { to: "/resources", label: "Resources library" },
    { to: "/requests", label: "Project requests" },
    { to: "/newsletter", label: "The Fork Report" },
  ] as const;

  const communityLinks = [
    { to: "/forum", label: "Forum" },
    { to: "/plaza", label: "The Plaza" },
    { to: "/studio", label: "Studio kanban" },
    { to: "/settings", label: "Settings" },
  ] as const;

  const legalLinks = [
    { to: "/about", label: "About" },
    { to: "/licensing", label: "Licensing 101" },
    { to: "/rules", label: "Community rules" },
    { to: "/privacy", label: "Privacy policy" },
    { to: "/terms", label: "Terms of service" },
    { to: "/dmca", label: "DMCA takedowns" },
  ] as const;

  return (
    <footer className="mt-auto border-t border-border bg-surface text-fg" role="contentinfo">
      {/* 16-bit decorative pixel accent bar */}
      <div
        className="flex h-1 w-full overflow-hidden"
        aria-hidden="true"
      >
        <span className="flex-1 bg-pixel-2" />
        <span className="flex-1 bg-pixel-3" />
        <span className="flex-1 bg-pixel-4" />
        <span className="flex-1 bg-pixel-5" />
        <span className="flex-1 bg-pixel-6" />
        <span className="flex-1 bg-pixel-9" />
        <span className="flex-1 bg-pixel-10" />
        <span className="flex-1 bg-pixel-11" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Newsletter signup banner */}
        <div className="mb-10 rounded-card border border-border bg-surface-2 p-5 sm:p-6">
          <NewsletterBox variant="footer" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand and Mission */}
          <div className="space-y-3 md:col-span-1">
            <Link
              to="/"
              className="inline-block font-display text-lg font-bold tracking-tight text-fg hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus"
            >
              {SITE_NAME}
            </Link>
            <p className="text-sm leading-relaxed text-muted">
              {SITE_TAGLINE} A free, social catalog of vibe-coded projects with public code you can
              fork and point your agents at.
            </p>
            <p className="font-mono text-xs text-muted">
              No paywalls · No data sales · 100% public code
            </p>
          </div>

          {/* Explore Links */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-fg">
              Explore
            </h4>
            <ul className="space-y-2 text-sm">
              {exploreLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-fg">
              Community
            </h4>
            <ul className="space-y-2 text-sm">
              {communityLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Docs & Legal */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-fg">
              Guides & Legal
            </h4>
            <ul className="space-y-2 text-sm">
              {legalLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom meta bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. All catalog code remains the property of its
            respective authors.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/licensing"
              className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
            >
              Licensing rules
            </Link>
            <span aria-hidden className="text-border">·</span>
            <Link
              to="/rules"
              className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
            >
              Rules
            </Link>
            <span aria-hidden className="text-border">·</span>
            <Link
              to="/privacy"
              className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
            >
              Privacy
            </Link>
            <span aria-hidden className="text-border">·</span>
            <Link
              to="/terms"
              className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
