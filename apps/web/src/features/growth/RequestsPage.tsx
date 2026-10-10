import { useCallback, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, routes, type BuildRequest, type RouteInput, type Routes } from "@forkvlift/shared";
import { Avatar, Badge, Button, Card, Modal, Spinner, StateMessage, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { SubmitVerification } from "../catalog/SubmitVerification";
import { relative } from "../community/format";

const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2 text-sm";

export function RequestsPage() {
  const { id } = useParams();
  return id ? <RequestDetail key={id} id={id} /> : <Board />;
}

function Board() {
  const [params, setParams] = useSearchParams();
  const parsed = routes.listRequests.query.safeParse({ status: params.get("status") || undefined });
  const { user } = useSession();
  const [creating, setCreating] = useState(false);
  const requests = useInfiniteQuery({ queryKey: ["requests", params.get("status")], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.call("listRequests", { query: { ...(parsed.success ? parsed.data : {}), cursor: pageParam } }, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined, enabled: parsed.success, retry: false });
  const items = requests.data?.pages.flatMap(p => p.items).filter(r => !parsed.success || !parsed.data.status || r.status === parsed.data.status) ?? [];
  return <PageShell title="Project requests" actions={user ? <Button onClick={() => setCreating(true)}>Post a request</Button> : <a href={signInUrl()} className={buttonClasses()}>Sign in to post</a>}>
    <p className="mb-5 max-w-2xl text-muted">Wish there were a free alternative? Describe it so another builder can pick it up. Bounties are text promises between people; ForkLift doesn't collect or pay them. No paid placement.</p>
    <label className="mb-5 block max-w-xs text-sm">Request status<select className={field} value={params.get("status") ?? ""} onChange={e => setParams(e.target.value ? { status: e.target.value } : {})}><option value="">All requests</option><option value="open">Open</option><option value="claimed">Claimed</option><option value="built">Built</option></select></label>
    {!parsed.success ? <StateMessage title="Invalid request filter" tone="danger" action={<Button onClick={() => setParams({})}>Clear filter</Button>} />
      : requests.isPending ? <Spinner label="Loading requests" />
      : requests.isError && !requests.data ? <StateMessage title="Couldn't load requests" tone="danger" action={<Button onClick={() => void requests.refetch()}>Try again</Button>} />
      : !items.length ? <StateMessage title="No requests to show">Try another status, or post an idea for a free tool.</StateMessage>
      : <ul className="grid gap-4 md:grid-cols-2">{items.map(r => <li key={r.id}><Card className="h-full space-y-3"><div className="flex flex-wrap gap-2"><Badge tone={r.status === "built" ? "success" : r.status === "claimed" ? "info" : "accent"}>{r.status}</Badge>{r.replaces ? <Badge>Replaces {r.replaces}</Badge> : null}</div><h2 className="break-words font-display text-base"><Link className="text-accent underline" to={`/requests/${encodeURIComponent(r.id)}`}>{r.title}</Link></h2><p className="text-sm text-muted">by @{r.author.username} · {relative(r.createdAt)}{r.claimedBy ? ` · claimed by @${r.claimedBy.username}` : ""}</p>{r.builtProject ? <Link className="text-sm text-accent underline" to={`/p/${r.builtProject.slug}`}>See {r.builtProject.name}</Link> : null}</Card></li>)}</ul>}
    {requests.hasNextPage ? <div className="mt-5 space-y-2">{requests.isFetchNextPageError ? <p role="alert" className="text-sm text-danger">Couldn't load more requests. Your current results are still here.</p> : null}<Button variant="secondary" loading={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>{requests.isFetchNextPageError ? "Retry loading more" : "Load more requests"}</Button></div> : null}
    {creating ? <CreateRequest onClose={() => setCreating(false)} /> : null}
  </PageShell>;
}

function RequestDetail({ id }: { id: string }) {
  const result = useQuery({ queryKey: ["request", id], queryFn: ({ signal }) => api.call("getRequest", { params: { id } }, { signal }), retry: false });
  return <PageShell title="Project request"><nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link className="text-accent underline" to="/requests">All requests</Link></nav>
    {result.isPending ? <Spinner label="Loading request" /> : result.isError ? <StateMessage title={result.error instanceof ApiError && result.error.status === 404 ? "Request not found" : "Couldn't load this request"} tone="danger" action={<Button onClick={() => void result.refetch()}>Try again</Button>} /> : <RequestContents request={result.data} />}
  </PageShell>;
}

function RequestContents({ request }: { request: BuildRequest }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const claim = useMutation({ mutationFn: () => api.call("claimRequest", { params: { id: request.id } }), onSuccess: result => { qc.setQueryData(["request", request.id], result); void qc.invalidateQueries({ queryKey: ["requests"] }); } });
  return <Card className="space-y-5">
    <h2 className="break-words font-display text-xl">{request.title}</h2>
    <div className="flex flex-wrap items-center gap-2 text-sm"><Badge>{request.status}</Badge>{request.replaces ? <Badge>Replaces {request.replaces}</Badge> : null}<Avatar name={request.author.displayName} src={request.author.avatarUrl} size="xs" /><Link className="text-accent underline" to={`/u/${request.author.username}`}>@{request.author.username}</Link><span className="text-muted">{relative(request.createdAt)}</span></div>
    {request.bodyMd ? <Markdown source={request.bodyMd} /> : <p className="text-sm text-muted">No details provided yet.</p>}
    {request.status === "open" ? user ? user.id === request.author.id ? <p className="text-sm text-muted">Another builder can claim your request.</p> : <Button loading={claim.isPending} onClick={() => claim.mutate()}>Claim this request</Button> : <a className={buttonClasses()} href={signInUrl()}>Sign in to claim</a>
      : request.claimedBy ? <p className="text-sm">{user?.id === request.claimedBy.id ? "You're building this." : "Claimed by "}{user?.id !== request.claimedBy.id ? <Link className="text-accent underline" to={`/u/${request.claimedBy.username}`}>@{request.claimedBy.username}</Link> : null}</p> : <p className="text-sm text-muted">This request is {request.status}.</p>}
    {request.builtProject ? <Link className={`${buttonClasses("secondary")} max-w-full`} to={`/p/${request.builtProject.slug}`}><span className="min-w-0 whitespace-normal break-words text-left">See the finished project: {request.builtProject.name}</span></Link> : null}
    {claim.isError ? <div role="alert" className="space-y-2 text-sm text-danger"><p>{claim.error.message}</p>{claim.error instanceof ApiError && claim.error.status === 409 ? <Button variant="secondary" size="sm" onClick={() => void qc.invalidateQueries({ queryKey: ["request", request.id] })}>Refresh request</Button> : null}</div> : null}
    <p className="text-xs text-muted">Bounties are described by the requester. Confirm terms with them directly; ForkLift processes no payments.</p>
  </Card>;
}

function CreateRequest({ onClose }: { onClose: () => void }) {
  const config = useSiteConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [error, setError] = useState("");
  const onToken = useCallback((value: string) => setToken(value), []);
  const create = useMutation({ mutationFn: (body: RouteInput<Routes["createRequest"]>["body"]) => api.call("createRequest", { body }),
    onSuccess: result => { qc.setQueryData(["request", result.id], result); void qc.invalidateQueries({ queryKey: ["requests"] }); navigate(`/requests/${result.id}`); onClose(); },
    onSettled: () => { setToken(""); setReset(value => value + 1); } });
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  return <Modal open onClose={() => { if (!create.isPending) onClose(); }} title="Post a request"><form className="mt-4 space-y-4" onSubmit={event => {
    event.preventDefault(); if (create.isPending || !config.data || (needsToken && !token)) return;
    const data = new FormData(event.currentTarget); const bounty = String(data.get("bounty") ?? "").trim();
    const body = { title: String(data.get("title") ?? "").trim(), bodyMd: `${String(data.get("bodyMd") ?? "").trim()}${bounty ? `\n\n## Bounty (off-site)\n\n${bounty}` : ""}`, replaces: String(data.get("replaces") ?? "").trim() || null, turnstileToken: token };
    const parsed = routes.createRequest.body.safeParse(body); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your request."); return; }
    setError(""); create.mutate(parsed.data);
  }}>
    <fieldset disabled={create.isPending} className="space-y-4"><label className="block text-sm">Title<input name="title" required minLength={3} maxLength={140} className={field} /></label><label className="block text-sm">What should it do?<textarea name="bodyMd" rows={6} maxLength={48000} className={field} /></label><label className="block text-sm">Replaces (optional)<input name="replaces" maxLength={60} className={field} /></label><label className="block text-sm">Bounty (optional, text only)<textarea name="bounty" rows={2} maxLength={1000} className={field} /></label><p className="text-xs text-muted">No paid placement. Any bounty is arranged directly between people.</p></fieldset>
    {config.isPending ? <Spinner label="Loading verification" /> : config.isError ? <StateMessage title="Couldn't load verification" tone="danger" action={<Button variant="secondary" onClick={() => void config.refetch()}>Retry verification setup</Button>} /> : needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={onToken} reset={reset} /> : null}
    {error || create.isError ? <p role="alert" className="text-sm text-danger">{error || create.error?.message}</p> : null}
    <div className="flex flex-wrap gap-2"><Button type="submit" loading={create.isPending} disabled={!config.data || (needsToken && !token)}>Post request</Button><Button type="button" variant="secondary" disabled={create.isPending} onClick={onClose}>Cancel</Button></div>
  </form></Modal>;
}
