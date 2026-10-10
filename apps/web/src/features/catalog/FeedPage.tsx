import { Outlet } from "react-router";
import { SITE_TAGLINE } from "@forkvlift/shared";
import { StateMessage } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";

/** Feed grid + toolbar (task 1.10). The focus panel renders into <Outlet /> over the blurred feed. */
export function FeedPage() {
  return (
    <PageShell title={SITE_TAGLINE}>
      <StateMessage title="The catalog is being stocked">Real, verified projects are on their way. Check back soon.</StateMessage>
      <Outlet />
    </PageShell>
  );
}
