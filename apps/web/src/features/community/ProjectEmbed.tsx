/** A project linked on its own line in a post or resource, shown as a small card. */
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge, Skeleton } from "@forkvlift/ui";
import { api } from "../../lib/api";

export function ProjectEmbed({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ["project", slug], queryFn: () => api.call("getProject", { params: { slug } }), retry: false, staleTime: 60_000 });
  if (q.isPending) return <Skeleton className="h-16 w-full max-w-md" />;
  if (q.isError) return <Link to={`/p/${slug}`} className="text-accent underline">/p/{slug}</Link>;
  const p = q.data;
  return (
    <Link to={`/p/${slug}`} className="flex max-w-md items-center gap-3 rounded-card border border-border bg-surface p-3 hover:bg-surface-2">
      {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-pixel object-cover" loading="lazy" /> : <span aria-hidden className="size-12 shrink-0 rounded-pixel bg-surface-2" />}
      <span className="min-w-0">
        <span className="block truncate font-semibold">{p.name}</span>
        <span className="block truncate text-sm text-muted">{p.tagline}</span>
      </span>
      {p.stage !== "finished" ? <Badge tone="warning" className="ml-auto shrink-0">{p.stage === "wip" ? "WIP" : "Adopt me"}</Badge> : null}
    </Link>
  );
}
