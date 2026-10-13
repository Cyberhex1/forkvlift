import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@forkvlift/ui";
import { api } from "../../lib/api";
import { useSiteConfig } from "../../app/session";
import { SubmitVerification } from "../catalog/SubmitVerification";

export interface NewsletterBoxProps {
  /** "footer" compact layout, "section" card layout, or "standalone" */
  variant?: "footer" | "section" | "standalone";
  className?: string;
}

export function NewsletterBox({ variant = "section", className = "" }: NewsletterBoxProps) {
  const config = useSiteConfig();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      return await api.call("subscribeNewsletter", {
        body: {
          email: email.trim().toLowerCase(),
          turnstileToken: token,
        },
      });
    },
    onError: () => {
      setReset((r) => r + 1);
      setToken("");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    subscribeMutation.mutate();
  };

  const handleReset = () => {
    setEmail("");
    setToken("");
    setReset((r) => r + 1);
    subscribeMutation.reset();
  };

  const needsToken = Boolean(config.data?.turnstileSiteKey);
  // Load Turnstile only once someone starts typing: the footer box is on every page, and an idle widget there would run a challenge on every page view.
  const isSubmitDisabled =
    subscribeMutation.isPending ||
    !email.trim() ||
    (needsToken && !token);

  // Success state: verification email sent
  if (subscribeMutation.data?.status === "pending") {
    return (
      <div
        className={`rounded-card border border-accent/40 bg-surface-2 p-5 text-fg ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 font-display text-base font-semibold text-accent">
          <span aria-hidden="true" className="text-lg">✉️</span>
          Check your inbox!
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We sent a verification link to <strong className="text-fg">{email}</strong>. Click the
          link in the email to confirm your subscription to <em>The Fork Report</em>.
        </p>
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={handleReset}>
            Subscribe another address
          </Button>
        </div>
      </div>
    );
  }

  // Already-subscribed state: existing confirmed subscriber
  if (subscribeMutation.data?.status === "confirmed") {
    return (
      <div
        className={`rounded-card border border-border bg-surface-2 p-5 text-fg ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 font-display text-base font-semibold text-accent">
          <span aria-hidden="true" className="text-lg">✓</span>
          Already subscribed
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="text-fg">{email}</strong> is already confirmed on <em>The Fork Report</em> list.
          You're all set to receive our next weekly dispatch!
        </p>
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={handleReset}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h4 className="font-display text-sm font-semibold tracking-tight text-fg">
              The Fork Report
            </h4>
            <p className="text-xs text-muted">
              Weekly highlights of the freshest vibe-coded open projects, forks, and free alternatives.
            </p>
          </div>
          <span className="font-mono text-[11px] text-muted">Free · No spam · Weekly</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="footer-newsletter-email" className="sr-only">
              Email address for newsletter
            </label>
            <input
              id="footer-newsletter-email"
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-pixel border border-border bg-surface px-3 py-2 text-xs text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-focus sm:text-sm"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={subscribeMutation.isPending}
              disabled={isSubmitDisabled}
              className="sm:w-auto"
            >
              Subscribe
            </Button>
          </div>

          {needsToken && email.trim() ? (
            <div className="pt-1">
              <SubmitVerification
                siteKey={config.data!.turnstileSiteKey!}
                onToken={setToken}
                reset={reset}
              />
            </div>
          ) : null}

          {subscribeMutation.isError ? (
            <div role="alert" className="text-xs text-danger">
              {subscribeMutation.error.message || "Could not subscribe. Please try again."}
            </div>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <Card className={`space-y-4 ${className}`}>
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-fg sm:text-lg">
          The Fork Report
        </h3>
        <p className="text-sm leading-relaxed text-muted">
          Our weekly newsletter delivering verified vibe-coded releases, trending fork lineage, and
          free open source replacements for expensive subscriptions. Double opt-in, no spam.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="newsletter-box-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-box-email"
            type="email"
            required
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 rounded-pixel border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-focus"
          />
          <Button
            type="submit"
            variant="primary"
            loading={subscribeMutation.isPending}
            disabled={isSubmitDisabled}
          >
            Subscribe
          </Button>
        </div>

        {needsToken && email.trim() ? (
          <SubmitVerification
            siteKey={config.data!.turnstileSiteKey!}
            onToken={setToken}
            reset={reset}
          />
        ) : null}

        {subscribeMutation.isError ? (
          <div role="alert" className="text-sm text-danger">
            {subscribeMutation.error.message || "Subscription failed. Please check your email and try again."}
          </div>
        ) : null}
      </form>
    </Card>
  );
}
