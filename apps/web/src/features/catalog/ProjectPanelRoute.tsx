import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ApiError, NO_LICENSE_DISCLAIMER, PROJECT_STAGE_LABELS, ReportReason, type ProjectDetail, type ProjectMedia } from "@forkvlift/shared";
import { Avatar, Badge, Button, Card, Modal, Spinner, StateMessage, buttonClasses } from "@forkvlift/ui";
import { usePreferences } from "../../app/preferences";
import { signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";
import { CopyText } from "./CopyText";
import { AgentPrompt } from "./AgentPrompt";
import { ForkTreeButton } from "./ForkTree";
import { CommentForm, ContinueThis } from "./ProjectEngagement";
import { LicenseRequestActions } from "../pages/LicenseRequestActions";
import "./project-panel.css";

export function ProjectPanelRoute() {
  const { slug = "" } = useParams();
  return <Panel key={slug} slug={slug} />;
}

function Panel({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const project = useQuery({ queryKey: ["project", slug], queryFn: ({ signal }) => api.call("getProject", { params: { slug } }, { signal }), retry: false });
  function close() {
    if (location.state?.fromCatalog) navigate(-1);
    else navigate(`/${location.search}`, { replace: true });
  }
  return <Modal open onClose={close} title={project.data?.name ?? "Project details"} className="project-panel">
    {project.isPending ? <div className="py-16"><Spinner label="Loading project" /></div>
      : project.isError ? <StateMessage tone="danger" title={project.error instanceof ApiError && project.error.status === 404 ? "Project not found" : "Couldn't load this project"} action={<Button onClick={() => void project.refetch()}>Try again</Button>}>It may be unavailable or private. You can close this panel to return to the catalog.</StateMessage>
      : <ProjectContents project={project.data} />}
  </Modal>;
}

function Gallery({ media, thumbnail, name }: { media: ProjectMedia[]; thumbnail: string | null; name: string }) {
  const { motionReduced } = usePreferences();
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(false);
  const current = media[selected];
  const src = current?.url ?? thumbnail;
  return <section aria-label="Project gallery" className="space-y-3">
    <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-card border border-border bg-surface-2">
      {failed || !src ? <p className="p-8 text-sm text-muted">No preview available</p>
        : current?.kind === "video" ? <video key={src} src={src} controls muted playsInline preload="metadata" className="max-h-80 w-full" onError={() => setFailed(true)} />
        : current?.kind === "gif" && motionReduced ? <a className="p-8 text-sm text-accent underline" href={src} target="_blank" rel="noopener noreferrer">View animated image: {current.alt || name}</a>
        : <img src={src} alt={current?.alt || `${name} preview`} className="max-h-80 w-full object-contain" onError={() => setFailed(true)} />}
    </div>
    {media.length > 1 ? <div className="flex flex-wrap gap-2" aria-label="Choose gallery item">{media.map((item, i) => <Button key={item.id} size="sm" variant={selected === i ? "primary" : "secondary"} aria-pressed={selected === i} onClick={() => { setSelected(i); setFailed(false); }}>{i + 1} · {item.kind}</Button>)}</div> : null}
  </section>;
}

function ProjectContents({ project }: { project: ProjectDetail }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState<(typeof ReportReason.options)[number]>("other");
  const [note, setNote] = useState("");
  const vote = useMutation({
    mutationFn: () => api.call("voteProject", { params: { slug: project.slug }, body: { value: project.viewer?.upvoted ? 0 : 1 } }),
    onSuccess: (result) => { qc.setQueryData(["project", project.slug], { ...project, upvotes: result.upvotes, viewer: { upvoted: result.viewerUpvoted, saved: project.viewer?.saved ?? false } }); void qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
  const collections = useQuery({ queryKey: ["collections", user?.username], queryFn: () => api.call("listUserCollections", { params: { username: user!.username } }), enabled: collectionOpen && Boolean(user), retry: false });
  const save = useMutation({ mutationFn: (id: string) => api.call("addCollectionItem", { params: { id }, body: { projectId: project.id } }), onSuccess: () => { setFeedback("Saved to collection."); setCollectionOpen(false); } });
  const report = useMutation({ mutationFn: () => api.call("createReport", { body: { targetType: "project", targetId: project.id, reason, note } }), onSuccess: () => { setFeedback("Report sent for review."); setReportOpen(false); } });
  const repoPath = new URL(project.repoUrl).hostname === "github.com" ? new URL(project.repoUrl).pathname.replace(/\.git$/, "").replace(/\/$/, "") : null;
  return <div className="mt-4 space-y-6 text-sm">
    {!project.license ? <Card className="space-y-2 border-license-none" role="note"><p className="font-semibold text-license-none">{NO_LICENSE_DISCLAIMER.title}</p><p className="leading-relaxed">{NO_LICENSE_DISCLAIMER.body}</p></Card> : null}
    <div className="flex flex-wrap gap-2"><Badge>{project.category.name}</Badge><Badge tone={`stage-${project.stage}`}>{PROJECT_STAGE_LABELS[project.stage]}</Badge>{project.studioColumnTitle && project.stage === "wip" ? <Badge>{project.studioColumnTitle}</Badge> : null}<Badge tone={project.license ? "license-open" : "license-none"}>{project.license?.spdx ?? "No license"}{project.license?.copyleft ? " · copyleft" : ""}</Badge>{project.staffPick ? <Badge tone="accent">Staff pick</Badge> : null}</div>
    <p className="break-words text-muted">{project.description || project.tagline || "No description provided."}</p>
    <Gallery media={project.media} thumbnail={project.thumbnailUrl} name={project.name} />
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3"><h3 className="font-display text-base">Built with</h3><div className="flex flex-wrap gap-2">{[...project.stack, ...project.buildFacts.aiTools].map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>{!project.stack.length && !project.buildFacts.aiTools.length ? <p className="text-muted">No build details provided.</p> : null}<p className="text-xs text-muted">Build facts are self-reported{project.buildFacts.buildTime ? ` · ${project.buildFacts.buildTime}` : ""}.</p>{project.replaces.length ? <p>Free alternative to {project.replaces.join(", ")}</p> : null}</section>
      <section className="space-y-3"><h3 className="font-display text-base">Repository stats</h3><dl className="grid grid-cols-2 gap-2"><div><dt className="text-muted">Stars</dt><dd>{project.repoStats.stars.toLocaleString()}</dd></div><div><dt className="text-muted">Forks</dt><dd>{project.repoStats.forks.toLocaleString()}</dd></div><div><dt className="text-muted">Open issues</dt><dd>{project.repoStats.openIssues}</dd></div><div><dt className="text-muted">Last commit</dt><dd>{project.repoStats.lastCommitAt ? new Date(project.repoStats.lastCommitAt).toLocaleDateString() : "Unknown"}</dd></div></dl><details><summary className="cursor-pointer">Health score: {project.health.score}/100 · breakdown</summary><dl className="mt-2 space-y-1">{Object.entries(project.health.breakdown).map(([key, part]) => <div key={key} className="flex justify-between gap-2"><dt>{key}</dt><dd>{part.value} · {part.points} points</dd></div>)}</dl></details></section>
    </div>
    {project.stage !== "finished" ? <Card className="space-y-3"><h3 className="font-display text-base">What works / What's missing</h3><div><h4 className="font-semibold">What works</h4><p className="whitespace-pre-wrap break-words text-muted">{project.wipStatus?.whatWorks || "The author hasn't added this yet."}</p></div><div><h4 className="font-semibold">What's missing</h4><p className="whitespace-pre-wrap break-words text-muted">{project.wipStatus?.whatsMissing || "The author hasn't added this yet."}</p></div>{project.lookingForHelp ? <p>Looking for help with: {project.lookingForHelp}</p> : null}</Card> : null}
    <Card className="space-y-3"><h3 className="font-display text-base">{project.license ? "Fork this" : "Ask before building on this"}</h3>
      <div className="flex flex-wrap gap-2"><a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>GitHub ↗</a>{project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>Live site ↗</a> : null}{project.releaseUrl ? <a href={project.releaseUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>Release ↗</a> : null}</div>
      {project.license ? <><p className="text-muted">{project.license.summary}</p><CopyText text={project.cloneCommand} label="Copy clone command" />{repoPath ? <div className="flex flex-wrap gap-2"><a href={`https://codespaces.new${repoPath}`} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>Open in Codespaces ↗</a>{project.stack.some((stack) => /^(javascript|typescript|react|vue|svelte|angular|vite|node(\.js)?)$/i.test(stack)) ? <a href={`https://stackblitz.com/github${repoPath}`} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>Open in StackBlitz ↗</a> : null}</div> : null}</>
        : <><p>Ask the author to add a license before building on it.</p><LicenseRequestActions project={project} /></>}
      {project.license ? <ContinueThis project={project} /> : null}<p className="text-xs text-muted">Review code before running it.</p>{project.safety.flags.map((flag) => <p key={flag} className="text-warning">{flag}</p>)}
    </Card>
    <AgentPrompt project={project} />
    <section className="space-y-2"><h3 className="font-display text-base">Fork lineage</h3>{project.forkedFrom ? <p>Forked from <Link to={`/p/${project.forkedFrom.slug}`} replace className="text-accent underline">{project.forkedFrom.name}</Link></p> : <p className="text-muted">No parent project listed.</p>}{project.notableForks.length ? <ul className="list-inside list-disc">{project.notableForks.map((fork) => <li key={fork.id}><Link to={`/p/${fork.slug}`} replace className="text-accent underline">{fork.name}</Link></li>)}</ul> : <p className="text-muted">No notable forks listed yet.</p>}<ForkTreeButton slug={project.slug} /></section>
    <section className="space-y-3"><h3 className="font-display text-base">Author</h3>{project.author ? <div className="flex items-center gap-3"><Avatar src={project.author.avatarUrl} name={project.author.displayName} /><div><Link to={`/u/${project.author.username}`} className="text-accent underline">{project.author.displayName} · @{project.author.username}</Link>{project.verifiedAuthor ? <p className="text-xs text-muted">Verified repository author</p> : null}</div></div> : <p className="text-muted">Curated · unclaimed. The repository owner can claim this project.</p>}</section>
    <div className="flex flex-wrap gap-2">{user ? <><Button size="sm" variant="secondary" loading={vote.isPending} aria-pressed={project.viewer?.upvoted ?? false} onClick={() => vote.mutate()}>Upvote · {project.upvotes}</Button><Button size="sm" variant="secondary" onClick={() => setCollectionOpen(true)}>Save to collection</Button><Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>Report project</Button></> : <a href={signInUrl()} className={buttonClasses("secondary", "sm")}>Sign in to upvote, save, or report</a>}</div>{vote.isError ? <p role="alert" className="text-danger">{vote.error.message}</p> : null}<p role="status" className="text-muted">{feedback}</p>
    <section className="space-y-3"><h3 className="font-display text-base">README</h3>{project.readmeHtml ? <div className="project-readme" dangerouslySetInnerHTML={{ __html: project.readmeHtml }} /> : <p className="text-muted">No README available. Check the GitHub repository for setup details.</p>}</section>
    <Comments slug={project.slug} />
    <CommentForm slug={project.slug} />
    <Modal open={collectionOpen} onClose={() => setCollectionOpen(false)} title="Save to collection">
      {collections.isPending ? <Spinner label="Loading collections" /> : collections.isError ? <StateMessage title="Couldn't load collections" tone="danger" action={<Button onClick={() => void collections.refetch()}>Try again</Button>} /> : !collections.data?.items.length ? <p className="mt-4 text-muted">You have no collections yet.</p> : <div className="mt-4 flex flex-wrap gap-2">{collections.data.items.map((collection) => <Button key={collection.id} variant="secondary" disabled={save.isPending} onClick={() => save.mutate(collection.id)}>{collection.name}</Button>)}</div>}{save.isError ? <p role="alert" className="text-danger">{save.error.message}</p> : null}
    </Modal>
    <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report project"><form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); report.mutate(); }}><label className="block">Reason<select className="mt-1 block w-full rounded-pixel border border-border bg-surface p-2" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>{ReportReason.options.map((value) => <option key={value}>{value}</option>)}</select></label><label className="block">Details<textarea maxLength={1000} className="mt-1 block w-full rounded-pixel border border-border bg-surface p-2" value={note} onChange={(event) => setNote(event.target.value)} /></label>{report.isError ? <p role="alert" className="text-danger">{report.error.message}</p> : null}<Button type="submit" loading={report.isPending}>Send report</Button></form></Modal>
  </div>;
}

function Comments({ slug }: { slug: string }) {
  const comments = useInfiniteQuery({ queryKey: ["comments", slug], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam, signal }) => api.call("listComments", { params: { slug }, query: { cursor: pageParam } }, { signal }), getNextPageParam: (page) => page.nextCursor ?? undefined, retry: false });
  return <section className="space-y-3"><h3 className="font-display text-base">Comments</h3>{comments.isPending ? <Spinner label="Loading comments" /> : comments.isError ? <StateMessage title="Couldn't load comments" tone="danger" action={<Button onClick={() => void comments.refetch()}>Try again</Button>} /> : !comments.data.pages.some((page) => page.items.length) ? <p className="text-muted">No comments yet.</p> : comments.data.pages.flatMap((page) => page.items).map((comment) => <Card key={comment.id}><Link to={`/u/${comment.author.username}`} className="text-accent underline">@{comment.author.username}</Link><p className="mt-2 whitespace-pre-wrap break-words">{comment.body}</p></Card>)}{comments.hasNextPage ? <Button variant="secondary" loading={comments.isFetchingNextPage} onClick={() => void comments.fetchNextPage()}>Load more comments</Button> : null}</section>;
}
