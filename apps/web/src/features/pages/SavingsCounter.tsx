/**
 * Subscription savings counter widget (task 4.11).
 * Displays honest community savings calculated from open alternatives replacing paid SaaS tools.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card, Spinner } from "@forkvlift/ui";
import { api } from "../../lib/api";

export interface SavingsCounterProps {
  className?: string;
  showBreakdown?: boolean;
}

export function SavingsCounter({ className, showBreakdown = true }: SavingsCounterProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["savingsStats"],
    queryFn: () => api.call("savingsStats", {}),
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center p-6">
          <Spinner label="Loading subscription savings statistics..." />
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return null;
  }

  const { estimatedMonthlySavingsUsd, forkCount, asOf } = data;
  const formattedUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(estimatedMonthlySavingsUsd);

  const formattedForks = new Intl.NumberFormat("en-US").format(forkCount);
  const formattedDate = new Date(asOf).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className={className}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              Estimated Community Impact
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold tracking-tight text-accent sm:text-4xl">
                {formattedUsd}
              </span>
              <span className="font-mono text-sm font-semibold text-muted">/ month</span>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="font-mono text-xs text-muted">Active Open Forks</span>
            <div className="font-display text-xl font-bold text-fg sm:text-2xl">
              {formattedForks}
            </div>
          </div>
        </div>

        {showBreakdown ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs leading-relaxed text-muted">
              Honest calculation: estimated by multiplying verified deployments and forks of open-source
              projects by the monthly subscription cost of the commercial software they replace. As of{" "}
              <time dateTime={asOf}>{formattedDate}</time>.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Link
                to="/alternatives"
                className="font-mono text-xs text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus"
              >
                Browse all free alternatives →
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
