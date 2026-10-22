import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button, Spinner, StateMessage } from "@forkvlift/ui";
import { api } from "../../lib/api";
import { ShowcaseCard } from "./ShowcaseCard";

export function ShowcaseStrip({ source = "home", value = "", title = "Showcases", hideEmpty = false }: { source?: "home" | "week" | "user" | "project" | "resource"; value?: string; title?: string; hideEmpty?: boolean }) {
  const result = useInfiniteQuery({ queryKey: ["showcase-strip", source, value], initialPageParam: undefined as string | undefined, retry: false,
    queryFn: async ({ pageParam, signal }) => { const query = { limit: source === "week" ? 1 : 6, cursor: pageParam }; const options = { signal };
      if (source === "user") return api.call("userShowcases", { params: { username: value }, query }, options);
      if (source === "project") return api.call("projectShowcases", { params: { slug: value }, query }, options);
      if (source === "resource") return api.call("resourceShowcases", { params: { slug: value }, query }, options);
      return api.call("listShowcases", { query: { ...query, ...(source === "week" ? { staffPicks: true, sort: "new" as const } : {}) } }, options);
    }, getNextPageParam: p => source === "week" ? undefined : p.nextCursor ?? undefined });
  const items = [...new Map((result.data?.pages.flatMap(p => p.items) ?? []).map(s => [s.id, s])).values()].filter(s => source !== "week" || s.staffPick).slice(0, source === "week" ? 1 : undefined);
  if (hideEmpty && result.isSuccess && !items.length) return null;
  return <section aria-label={title} className="my-6 min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg">{title}</h2>{source === "home" || source === "week" ? <Link className="text-sm text-accent underline" to="/showcase">Browse showcases</Link> : null}</div>{result.isPending ? <Spinner label={`Loading ${title.toLowerCase()}`} /> : result.isError && !result.data ? <StateMessage title={`Couldn't load ${title.toLowerCase()}`} tone="danger" action={<Button onClick={() => void result.refetch()}>Retry showcases</Button>} /> : !items.length ? <StateMessage title={source === "week" ? "No weekly showcase selected" : "No showcases yet"} /> : <div className={`grid gap-4 ${source === "week" ? "max-w-lg" : "sm:grid-cols-2 lg:grid-cols-3"}`}>{items.map(s => <ShowcaseCard key={s.id} showcase={s} />)}</div>}{result.hasNextPage ? <div>{result.isFetchNextPageError ? <p role="alert" className="text-danger">Couldn't load more showcases.</p> : null}<Button loading={result.isFetchingNextPage} onClick={() => void result.fetchNextPage()}>More showcases</Button></div> : null}</section>;
}
