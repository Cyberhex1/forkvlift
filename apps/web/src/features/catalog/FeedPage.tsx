import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router";
import { SITE_TAGLINE } from "@forkvlift/shared";
import { Button, StateMessage } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { usePreferences } from "../../app/preferences";
import { api } from "../../lib/api";
import { ProjectCard, ProjectCardSkeleton } from "./ProjectCard";

/** Minimal API-backed card host; sorting/filtering/pagination belong to 1.10. */
export function FeedPage() {
  const { showUnlicensed } = usePreferences();
  const projects = useQuery({ queryKey: ["projects", { showUnlicensed }], queryFn: ({ signal }) => api.call("listProjects", { query: { showUnlicensed } }, { signal }), retry: false });
  const visible = projects.data?.items.filter((project) => project.license || showUnlicensed) ?? [];
  return (
    <PageShell title={SITE_TAGLINE}>
      <p className="mb-6 max-w-2xl text-sm text-muted">Public code, a clear license, and a head start for your next build.</p>
      {projects.isPending ? <div role="status"><span className="sr-only">Loading projects</span><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProjectCardSkeleton key={i} />)}</div></div>
        : projects.isError ? <StateMessage title="Couldn't load projects" tone="danger" action={<Button onClick={() => void projects.refetch()}>Try again</Button>}>Please try again in a moment.</StateMessage>
        : !visible.length ? <StateMessage title="No projects to show">There are no matching licensed projects yet.</StateMessage>
        : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
      <Outlet />
    </PageShell>
  );
}
