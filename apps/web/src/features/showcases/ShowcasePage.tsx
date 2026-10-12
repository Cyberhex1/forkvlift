import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ApiError, type ShowcaseComment, type ShowcaseDetail } from "@forkvlift/shared";
import { Button, Card, Spinner, StateMessage, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";
import { Markdown, safeHref } from "../../lib/markdown";
import { ShowcaseLabels } from "./ShowcaseCard";
import { field } from "./ShowcaseFeed";
import { useVerification } from "./Verification";

export function ShowcasePage() {
  const { slug = "" } = useParams();
  const result = useQuery({ queryKey: ["showcase", slug], queryFn: ({ signal }) => api.call("getShowcase", { params: { slug } }, { signal }), retry: false });
  return <PageShell title="Showcase"><Link className="mb-5 inline-block text-accent underline" to="/showcase">All showcases</Link>{result.isPending ? <Spinner label="Loading showcase" /> : result.isError ? <StateMessage title={result.error instanceof ApiError && result.error.status === 404 ? "Showcase not found" : "Couldn't load showcase"} tone="danger" action={<Button onClick={() => void result.refetch()}>Try again</Button>} /> : <ShowcaseContents key={slug} showcase={result.data} />}</PageShell>;
}

export function ShowcaseContents({ showcase, preview = false }: { showcase: ShowcaseDetail; preview?: boolean }) {
  return <div className="min-w-0 space-y-6"><ShowcaseLabels showcase={showcase} /><h2 className="break-words font-display text-2xl">{showcase.title}</h2><p className="break-words text-muted">{showcase.tagline}</p><p className="text-sm"><Link className="text-accent underline" to={`/u/${showcase.maker.username}`}>@{showcase.maker.username}</Link> · {showcase.category.name} · {showcase.kind}</p>{!showcase.hasPublicCode ? <p className="text-sm text-muted">Closed source: look, don't take.</p> : null}
    {showcase.coverUrl ? <img className="max-h-[32rem] w-full rounded-card object-contain bg-surface-2" src={showcase.coverUrl} alt={showcase.title} /> : null}
    <section aria-label="Gallery" className="grid gap-4 md:grid-cols-2">{showcase.media.map(m => <figure key={m.id} className="min-w-0">{m.kind === "embed" ? (() => { let valid = false; try { const u = new URL(m.url); valid = u.protocol === "https:" && ["www.youtube-nocookie.com", "youtube-nocookie.com", "player.vimeo.com"].includes(u.hostname); } catch { /* Invalid embeds are omitted. */ } return valid ? <iframe className="aspect-video w-full rounded-card border border-border" src={m.url} title={m.alt || "Showcase video"} loading="lazy" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" /> : null; })() : m.kind === "video" ? <video controls preload="metadata" className="max-h-96 w-full" aria-label={m.alt || "Showcase video"} src={m.url} /> : <img src={m.url} alt={m.alt} className="max-h-96 w-full rounded-card object-contain" loading="lazy" />}<figcaption className="mt-1 break-words text-xs text-muted">{m.alt}</figcaption></figure>)}</section>
    <div className="flex flex-wrap gap-3">{showcase.links.map((l, i) => safeHref(l.url) ? <div key={i} className="min-w-0"><a className="break-words text-accent underline" href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc">{l.label || l.kind} ↗</a>{l.kind === "download" ? <p className="text-xs text-muted">Review before running.</p> : null}</div> : null)}{showcase.catalogProject ? <Link className="text-accent underline" to={`/p/${showcase.catalogProject.slug}`}>See the code</Link> : null}</div>
    {!preview ? <ShowcaseActions showcase={showcase} /> : null}
    <Card><Markdown source={showcase.bodyMd || "No description yet."} /></Card><Card className="space-y-3"><h3 className="font-display">How I built it</h3><p className="break-words text-sm text-muted">{showcase.aiTools.join(" · ")}{showcase.buildTime ? ` · ${showcase.buildTime}` : ""}</p><Markdown source={showcase.buildStoryMd || "The maker hasn't added a build story yet."} /><p className="break-words text-xs text-muted">{showcase.tags.map(t => `#${t}`).join(" ")}</p></Card>
    <Card className="space-y-3"><h3 className="font-display">Built with</h3>{showcase.builtWith.projects.length || showcase.builtWith.resources.length ? <ul className="space-y-2">{showcase.builtWith.projects.map(p => <li key={p.id}><Link className="break-words text-accent underline" to={`/p/${p.slug}`}>{p.name}</Link> · Project</li>)}{showcase.builtWith.resources.map(r => <li key={r.id}><Link className="break-words text-accent underline" to={`/resources/${r.slug}`}>{r.title}</Link> · Resource</li>)}</ul> : <p className="text-sm text-muted">No credits added yet.</p>}</Card>
    {!preview ? <ShowcaseComments showcase={showcase} /> : null}
  </div>;
}

function ShowcaseActions({ showcase }: { showcase: ShowcaseDetail }) {
  const { user } = useSession(); const qc = useQueryClient(); const v = useVerification();
  const [upvoted, setUpvoted] = useState(showcase.viewer?.upvoted ?? false); const [saved, setSaved] = useState(showcase.viewer?.saved ?? false); const [votes, setVotes] = useState(showcase.upvotes);
  const eligibility = useQuery({ queryKey: ["showcase-catalog-eligibility", showcase.slug, showcase.repoUrl, user?.id], queryFn: ({ signal }) => api.call("previewSubmission", { body: { repoUrl: showcase.repoUrl! } }, { signal }), enabled: Boolean(user?.id === showcase.maker.id && showcase.status === "published" && showcase.hasPublicCode && showcase.repoUrl && !showcase.catalogProject), retry: false });
  const vote = useMutation({ mutationFn: () => api.call("voteShowcase", { params: { slug: showcase.slug }, body: { value: upvoted ? 0 : 1 } }), onSuccess: r => { setUpvoted(r.upvoted); setVotes(r.upvotes); void qc.invalidateQueries({ queryKey: ["showcases"] }); } });
  const save = useMutation({ mutationFn: () => api.call("saveShowcase", { params: { slug: showcase.slug }, body: { saved: !saved } }), onSuccess: r => setSaved(r.saved) });
  const catalog = useMutation({ mutationFn: () => api.call("listShowcaseInCatalog", { params: { slug: showcase.slug }, body: { repoUrl: showcase.repoUrl, turnstileToken: v.token } }), onSuccess: r => qc.setQueryData(["showcase", showcase.slug], { ...r.showcase, catalogProject: r.project }), onSettled: v.clear });
  if (!user) return <a className={buttonClasses("secondary")} href={signInUrl()}>Sign in to upvote or save</a>;
  const maker = showcase.maker.id === user.id;
  return <div className="space-y-3"><div className="flex flex-wrap gap-3"><Button variant="secondary" aria-pressed={upvoted} disabled={maker} loading={vote.isPending} onClick={() => vote.mutate()}>{upvoted ? "Upvoted" : "Upvote"} · {votes}</Button><Button variant="secondary" aria-pressed={saved} loading={save.isPending} onClick={() => save.mutate()}>{saved ? "Saved" : "Save showcase"}</Button></div>{maker ? <p className="text-sm text-muted">This is your showcase. You can't upvote your own build.</p> : null}
    {maker && showcase.status === "published" && showcase.hasPublicCode && showcase.repoUrl && !showcase.catalogProject ? <div className="space-y-2">{eligibility.isPending ? <Spinner label="Checking repository eligibility" /> : eligibility.isError ? <StateMessage title="Couldn't verify repository eligibility" tone="danger" action={<Button onClick={() => void eligibility.refetch()}>Retry repository check</Button>} /> : eligibility.data?.alreadyListed ? <Link className="text-accent underline" to={`/p/${eligibility.data.alreadyListed.slug}`}>See existing catalog listing</Link> : !eligibility.data?.ownedByViewer ? <p className="text-sm text-muted">Only the repository owner can list this code.</p> : !eligibility.data.license ? <p className="text-sm text-muted">Add an open-source license to this repository before listing it in the catalog.</p> : <><p className="text-sm text-muted">Your public repository has a {eligibility.data.license.spdx} license. The server checks ownership and licensing again when listing.</p>{v.element}<Button disabled={!v.ready} loading={catalog.isPending} onClick={() => catalog.mutate()}>List in catalog</Button></>}</div> : null}
    {[vote.error, save.error, catalog.error].filter(Boolean).map((error, i) => <p key={i} role="alert" className="text-sm text-danger">{error!.message}</p>)}
  </div>;
}

function ShowcaseComments({ showcase }: { showcase: ShowcaseDetail }) {
  const { user } = useSession(); const qc = useQueryClient(); const v = useVerification();
  const [body, setBody] = useState(""); const [parentId, setParentId] = useState<string | null>(null);
  const comments = useInfiniteQuery({ queryKey: ["showcase-comments", showcase.slug], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam, signal }) => api.call("listShowcaseComments", { params: { slug: showcase.slug }, query: { cursor: pageParam } }, { signal }), getNextPageParam: p => p.nextCursor ?? undefined, retry: false });
  const [added, setAdded] = useState<ShowcaseComment[]>([]); const [removed, setRemoved] = useState<string[]>([]);
  const post = useMutation({ mutationFn: () => api.call("createShowcaseComment", { params: { slug: showcase.slug }, body: { body, parentId, turnstileToken: v.token } }), onSuccess: r => { setAdded(a => [...a, r]); setBody(""); setParentId(null); void qc.invalidateQueries({ queryKey: ["showcase", showcase.slug] }); }, onSettled: v.clear });
  const del = useMutation({ mutationFn: (id: string) => api.call("deleteShowcaseComment", { params: { slug: showcase.slug, id } }), onSuccess: (_, id) => setRemoved(a => [...a, id]) });
  const items = [...new Map([...(comments.data?.pages.flatMap(p => p.items) ?? []), ...added].map(c => [c.id, c])).values()].filter(c => !removed.includes(c.id));
  return <Card className="space-y-4"><h3 className="font-display">Comments</h3>{comments.isPending ? <Spinner label="Loading comments" /> : comments.isError && !comments.data ? <StateMessage title="Couldn't load comments" tone="danger" action={<Button onClick={() => void comments.refetch()}>Retry comments</Button>} /> : !items.length ? <p className="text-sm text-muted">No comments yet.</p> : <ul className="space-y-4">{items.map(c => <li key={c.id} className={`min-w-0 space-y-2 border-b border-border pb-3 ${c.parentId ? "ml-4 border-l pl-3" : ""}`}><Link className="text-sm text-accent underline" to={`/u/${c.author.username}`}>@{c.author.username}</Link>{c.parentId ? <p className="text-xs text-muted">Reply to @{items.find(p => p.id === c.parentId)?.author.username ?? "a comment"}</p> : null}<Markdown source={c.body} />{user ? <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setParentId(c.id)}>Reply to @{c.author.username}</Button>{user.id === c.author.id || user.id === showcase.maker.id || user.role === "admin" ? <Button size="sm" variant="ghost" loading={del.isPending} onClick={() => del.mutate(c.id)}>Delete comment</Button> : null}</div> : null}</li>)}</ul>}
    {comments.hasNextPage ? <div>{comments.isFetchNextPageError ? <p role="alert" className="text-danger">Couldn't load more comments.</p> : null}<Button loading={comments.isFetchingNextPage} onClick={() => void comments.fetchNextPage()}>More comments</Button></div> : null}
    {user ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (v.ready && body.trim() && !post.isPending) post.mutate(); }}>{parentId ? <p>Replying <Button size="sm" variant="ghost" onClick={() => setParentId(null)}>Cancel reply</Button></p> : null}<label className="block">{parentId ? "Reply" : "Add a comment"}<textarea className={field} rows={3} required maxLength={5000} value={body} onChange={e => setBody(e.target.value)} /></label>{v.element}<Button type="submit" disabled={!v.ready || !body.trim()} loading={post.isPending}>{parentId ? "Post reply" : "Post comment"}</Button></form> : <a className="text-accent underline" href={signInUrl()}>Sign in to comment</a>}
    {[post.error, del.error].filter(Boolean).map((e, i) => <p role="alert" key={i} className="text-danger">{e!.message}</p>)}
  </Card>;
}



