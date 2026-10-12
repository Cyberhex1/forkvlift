/** Task 4.1: "Has this been built?" Shows close matches while someone describes a new idea. */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge, Spinner } from "@forkvlift/ui";
import { ShowcaseCard } from "../showcases/ShowcaseCard";
import { api } from "../../lib/api";

export function AlreadyBuilt({ text, minLength = 12 }: { text: string; minLength?: number }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim().replace(/\s+/g, " ").slice(0, 300)), 600);
    return () => window.clearTimeout(t);
  }, [text]);
  const enabled = q.length >= minLength;
  const similar = useQuery({ queryKey: ["similar", q], queryFn: () => api.call("similarProjects", { query: { q, limit: 4 } }), enabled, staleTime: 60_000 });

  if (!enabled) return null;
  return (
    <section aria-live="polite" aria-label="Has this been built?" className="rounded-card border border-border bg-surface-2 p-3 text-sm">
      <p className="mb-2 font-semibold">Has this been built?</p>
      {similar.isPending ? (
        <Spinner label="Looking for similar projects" />
      ) : similar.isError ? (
        <p className="text-muted">Couldn't check right now.</p>
      ) : !similar.data.items.length && !similar.data.showcases.length ? (
        <p className="text-muted">Nothing close yet. Looks like a fresh idea.</p>
      ) : (
        <>
          {similar.data.items.length ? <p className="mb-2 text-muted">These look close. Forking one might save you a rebuild:</p> : null}
          <ul className="space-y-1.5">
            {similar.data.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <Link to={`/p/${p.slug}`} target="_blank" className="font-semibold text-accent underline">{p.name}</Link>
                <span className="min-w-0 flex-1 truncate text-muted">{p.tagline}</span>
                {p.stage !== "finished" ? <Badge tone={`stage-${p.stage}`}>{p.stage === "wip" ? "WIP" : "Up for adoption"}</Badge> : null}
              </li>
            ))}
          </ul>
          {similar.data.showcases.length ? <section aria-label="Similar showcases" className="mt-4 space-y-3"><h3 className="font-semibold">Showcases</h3><div className="grid gap-3 sm:grid-cols-2">{similar.data.showcases.map(s => <ShowcaseCard key={s.id} showcase={s} />)}</div></section> : null}
        </>
      )}
    </section>
  );
}
