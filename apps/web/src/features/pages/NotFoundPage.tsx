import { Link } from "react-router";
import { SITE_NAME } from "@forkvlift/shared";
import { buttonClasses } from "@forkvlift/ui";
import { BrokenForkliftIcon } from "@forkvlift/ui/icons";

/**
 * 404 Not Found Page — Task 1.17 final design.
 * Playful, clubhouse-themed 404 with pixel illustration, clear explanation,
 * and quick navigation actions.
 */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      {/* Retro Pixel Art Broken Forklift */}
      <div
        className="mb-6 inline-flex size-20 items-center justify-center rounded-pixel bg-surface-2 p-4 text-warning shadow-sm"
        aria-hidden="true"
      >
        <BrokenForkliftIcon size={56} />
      </div>

      {/* Main Heading */}
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
        404: Nothing to fork here
      </h1>

      {/* Explanation */}
      <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
        We searched high and low in the warehouse, but this project or page doesn&apos;t exist.
        It may have been moved, renamed, adopted by someone else, or never built in the first place.
      </p>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className={buttonClasses("primary", "md", "focus:outline-none focus:ring-2 focus:ring-focus")}
        >
          Back to the feed
        </Link>
        <Link
          to="/about"
          className={buttonClasses("secondary", "md", "focus:outline-none focus:ring-2 focus:ring-focus")}
        >
          About {SITE_NAME}
        </Link>
      </div>

      {/* Helpful Shortcuts */}
      <div className="mt-12 w-full border-t border-border pt-8">
        <p className="font-mono text-xs text-muted uppercase tracking-wider">
          Helpful shortcuts
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link
            to="/licensing"
            className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
          >
            Licensing 101
          </Link>
          <span aria-hidden className="text-border">·</span>
          <Link
            to="/rules"
            className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
          >
            Community rules
          </Link>
          <span aria-hidden className="text-border">·</span>
          <Link
            to="/privacy"
            className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
          >
            Privacy policy
          </Link>
          <span aria-hidden className="text-border">·</span>
          <Link
            to="/terms"
            className="hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
          >
            Terms of service
          </Link>
        </div>
      </div>
    </div>
  );
}
