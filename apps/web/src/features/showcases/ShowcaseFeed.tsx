import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ShowcaseKind, routes } from "@forkvlift/shared";
import { Button, Spinner, StateMessage } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { api } from "../../lib/api";
import { ShowcaseCard } from "./ShowcaseCard";

export const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2 text-sm";
export function ShowcaseFeed() {
  const [params, setParams] = useSearchParams();
  const parsed = routes.listShowcases.query.safeParse(Object.fromEntries(params));
  const categories = useQuery({ queryKey: ["categories"], queryFn: ({ signal }) => api.call("listCategories", {}, { signal }), retry: false });
  const feed = useInfiniteQuery({ queryKey: ["showcases", params.toString()], initialPageParam: undefined as string | undefined, enabled: parsed.success, retry: false,
    queryFn: ({ pageParam, signal }) => api.call("listShowcases", { query: { ...(parsed.success ? parsed.data : {}), cursor: pageParam } }, { signal }), getNextPageParam: p => p.nextCursor ?? undefined });
  const items = [...new Map((feed.data?.pages.flatMap(p => p.items) ?? []).map(s => [s.id, s])).values()];
  function update(key: string, value: string) { const next = new URLSearchParams(window.location.search); next.delete("cursor"); if (value) next.set(key, value); else next.delete(key); setParams(next); }
  return <PageShell title="Showcases"><p className="mb-6 max-w-2xl text-muted">See what people built with AI. Public code is optional; every build has a story.</p>
    <form role="search" aria-label="Showcase search" className="mb-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); update("q", String(new FormData(e.currentTarget).get("q") ?? "").trim()); }}><label className="min-w-0 flex-1">Search by idea<input name="q" type="search" maxLength={200} key={params.get("q")} defaultValue={params.get("q") ?? ""} className={field} /></label><Button type="submit">Search</Button></form>
    <div className="mb-6 grid gap-3 sm:grid-cols-4"><label>Showcase sort<select className={field} value={params.get("sort") ?? "trending"} onChange={e => update("sort", e.target.value)}><option value="trending">{params.get("q") ? "Relevance" : "Trending"}</option><option value="new">New</option><option value="top">Top</option></select></label><label>Category<select aria-label="Category" className={field} value={params.get("category") ?? ""} onChange={e => update("category", e.target.value)}><option value="">All categories</option>{categories.data?.items.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label><label>Type<select aria-label="Type" className={field} value={params.get("kind") ?? ""} onChange={e => update("kind", e.target.value)}><option value="">All types</option>{ShowcaseKind.options.map(k => <option key={k}>{k}</option>)}</select></label><form onSubmit={e => { e.preventDefault(); update("tool", String(new FormData(e.currentTarget).get("tool") ?? "").trim()); }}><label>AI tool<input name="tool" maxLength={40} key={params.get("tool")} defaultValue={params.get("tool") ?? ""} className={field} /></label><Button type="submit" size="sm" variant="secondary" className="mt-2">Filter tool</Button></form></div>
    {categories.isError ? <p role="alert" className="text-danger">Categories unavailable. <Button onClick={() => void categories.refetch()}>Retry categories</Button></p> : null}
    <div className="mb-5 flex flex-wrap items-center gap-3"><label><input type="checkbox" checked={params.get("staffPicks") === "true"} onChange={e => update("staffPicks", e.target.checked ? "true" : "")} /> Staff picks</label><Button variant="ghost" onClick={() => setParams({})}>Clear filters</Button></div>
    {!parsed.success ? <StateMessage title="Invalid showcase filters" tone="danger" /> : feed.isPending ? <Spinner label="Loading showcases" /> : feed.isError && !feed.data ? <StateMessage title="Couldn't load showcases" tone="danger" action={<Button onClick={() => void feed.refetch()}>Try again</Button>} /> : !items.length ? <StateMessage title="No showcases yet">Try another idea or clear your filters.</StateMessage> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(s => <ShowcaseCard key={s.id} showcase={s} />)}</div>}
    {feed.hasNextPage ? <div className="mt-5">{feed.isFetchNextPageError ? <p role="alert" className="text-danger">Couldn't load more. Your current showcases are still here.</p> : null}<Button loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>Load more showcases</Button></div> : null}
  </PageShell>;
}

