import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Badge, Button, buttonClasses, Card } from "@forkvlift/ui";
import { api } from "../../lib/api";
import { NewsletterBox } from "./NewsletterBox";

export interface NewsletterUnsubscribePageProps {
  token?: string;
}

export function NewsletterUnsubscribePage({ token: propToken }: NewsletterUnsubscribePageProps) {
  const [searchParams] = useSearchParams();
  const token = (propToken || searchParams.get("token") || searchParams.get("unsubscribe") || "").trim();
  const [showResubscribe, setShowResubscribe] = useState(false);

  const unsubscribeMutation = useMutation({
    mutationFn: async (unsubscribeToken: string) => {
      return await api.call("unsubscribeNewsletter", {
        body: { token: unsubscribeToken },
      });
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Missing token state */}
      {!token ? (
        <Card className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Newsletter</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
            Unsubscribe from The Fork Report
          </h1>
          <p className="leading-relaxed text-muted">
            Unsubscribe links are generated individually for each subscriber and included at the
            bottom of every newsletter email. Please use the personalized unsubscribe link in any
            recent email you received from us.
          </p>
          <div className="pt-2">
            <Link to="/" className={buttonClasses("secondary", "sm")}>
              ← Return to catalog
            </Link>
          </div>
        </Card>
      ) : unsubscribeMutation.isSuccess ? (
        /* Success state */
        <Card className="space-y-6 p-6 sm:p-8" role="status">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Unsubscribed</Badge>
            <span className="font-mono text-xs text-muted">The Fork Report</span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              You've been unsubscribed
            </h1>
            <p className="leading-relaxed text-muted">
              You will no longer receive weekly emails from <em>The Fork Report</em>. Thank you for
              having spent time with our newsletter!
            </p>
          </div>

          {showResubscribe ? (
            <div className="pt-2">
              <NewsletterBox variant="standalone" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowResubscribe(true)}>
                Changed your mind? Resubscribe
              </Button>
              <Link to="/" className={buttonClasses("primary", "md")}>
                Return to catalog
              </Link>
            </div>
          )}
        </Card>
      ) : (
        /* Confirmation prompt */
        <Card className="space-y-6 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">The Fork Report</Badge>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              Unsubscribe from The Fork Report?
            </h1>
            <p className="leading-relaxed text-muted">
              Are you sure you want to opt out of <em>The Fork Report</em>? You'll stop getting weekly
              curated roundups of vibe-coded projects, open source forks, and subscription-slashing
              alternatives.
            </p>
          </div>

          {unsubscribeMutation.isError ? (
            <div role="alert" className="text-sm text-danger">
              {unsubscribeMutation.error.message ||
                "Failed to process unsubscription. Please try again."}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="danger"
              loading={unsubscribeMutation.isPending}
              onClick={() => unsubscribeMutation.mutate(token)}
            >
              Confirm unsubscription
            </Button>
            <Link to="/" className={buttonClasses("secondary", "md")}>
              Keep my subscription
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
