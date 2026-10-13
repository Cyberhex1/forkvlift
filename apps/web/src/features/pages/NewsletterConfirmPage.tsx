import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Badge, buttonClasses, Card, Spinner } from "@forkvlift/ui";
import { api } from "../../lib/api";
import { NewsletterBox } from "./NewsletterBox";

export interface NewsletterConfirmPageProps {
  token?: string;
}

export function NewsletterConfirmPage({ token: propToken }: NewsletterConfirmPageProps) {
  const [searchParams] = useSearchParams();
  const token = (propToken || searchParams.get("token") || searchParams.get("confirm") || "").trim();
  const hasTriggeredRef = useRef(false);

  const confirmMutation = useMutation({
    mutationFn: async (confirmationToken: string) => {
      return await api.call("confirmNewsletter", {
        body: { token: confirmationToken },
      });
    },
  });

  useEffect(() => {
    if (token && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      confirmMutation.mutate(token);
    }
  }, [token, confirmMutation]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Missing token state */}
      {!token ? (
        <Card className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Badge tone="warning">Missing Token</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
            Confirmation Link Incomplete
          </h1>
          <p className="leading-relaxed text-muted">
            We couldn't detect a valid verification token in this URL. Please verify you clicked the
            full link provided in your confirmation email, or enter your email below to request a new
            one.
          </p>
          <div className="pt-2">
            <NewsletterBox variant="standalone" />
          </div>
          <div className="pt-2">
            <Link to="/" className={buttonClasses("secondary", "sm")}>
              ← Return to catalog
            </Link>
          </div>
        </Card>
      ) : confirmMutation.isPending ? (
        /* Loading state */
        <Card className="flex flex-col items-center justify-center space-y-4 p-10 text-center">
          <Spinner label="Confirming newsletter subscription" />
          <h1 className="font-display text-xl font-semibold text-fg">
            Confirming your subscription…
          </h1>
          <p className="text-sm text-muted">
            Verifying your token for <em>The Fork Report</em>. Just a moment!
          </p>
        </Card>
      ) : confirmMutation.isSuccess ? (
        /* Success state */
        <Card className="space-y-6 p-6 sm:p-8" role="status">
          <div className="flex items-center gap-2">
            <Badge tone="success">Confirmed</Badge>
            <span className="font-mono text-xs text-muted">The Fork Report</span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              You're in! Subscription confirmed.
            </h1>
            <p className="leading-relaxed text-muted">
              Thanks for confirming your email. You're officially subscribed to <em>The Fork Report</em>.
              Every week, you'll receive the freshest vibe-coded projects, fork breakthroughs, and
              money-saving open source alternatives.
            </p>
          </div>

          <div className="rounded-pixel border border-border bg-surface-2 p-4 text-xs text-muted">
            <p>
              💡 <strong>Pro tip:</strong> Add our address to your contacts or mark it as important so
              weekly issues never get lost in spam. You can unsubscribe with one click at any time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/" className={buttonClasses("primary", "md")}>
              Explore the catalog
            </Link>
            <Link to="/about" className={buttonClasses("secondary", "md")}>
              About ForkLift
            </Link>
          </div>
        </Card>
      ) : (
        /* Error state */
        <Card className="space-y-6 p-6 sm:p-8" role="alert">
          <div className="flex items-center gap-2">
            <Badge tone="danger">Verification Failed</Badge>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
              Unable to confirm subscription
            </h1>
            <p className="leading-relaxed text-muted">
              {confirmMutation.error?.message ||
                "That ForkLift newsletter link has expired or has already been used. Subscribe again below to get a fresh link."}
            </p>
          </div>

          <div className="pt-2">
            <NewsletterBox variant="standalone" />
          </div>

          <div className="pt-2">
            <Link to="/" className={buttonClasses("secondary", "sm")}>
              ← Return to catalog
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
