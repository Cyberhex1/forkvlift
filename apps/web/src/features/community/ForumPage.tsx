/** Task 3.8: forum boards and thread lists. */
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type { Thread } from "@forkvlift/shared";
import { Avatar, Badge, Button, Card, Chip, Skeleton, StateMessage, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { SubmitVerification } from "../catalog/SubmitVerification";
import { parseTags, relative } from "./format";

export function ForumPage() {
  const { board } = useParams();
  return board ? <BoardView slug={board} /> : <BoardList />;
}

function BoardList() {
  const boards = useQuery({ queryKey: ["forum-boards"], queryFn: () => api.call("listForumBoards") });
  return (
    <PageShell title="Forum" actions={<Link to="/rules" className={buttonClasses("ghost", "sm")}>Community rules</Link>}>
      <p className="mb-6 max-w-2xl text-muted">Ask for help, show what you made, find people to build with. Be kind; everyone here started somewhere.</p>
      {boards.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : boards.isError ? (
        <StateMessage title="Couldn't load the forum" tone="danger" action={<Button onClick={() => void boards.refetch()}>Try again</Button>} />
      ) : !boards.data.items.length ? (
        <StateMessage title="No boards yet">Boards appear here once they're set up.</StateMessage>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.data.items.map((b) => (
            <li key={b.slug}>
              <Link to={`/forum/${b.slug}`} className="block h-full rounded-card border border-border bg-surface p-4 hover:bg-surface-2">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display">{b.name}</span>
                  <span className="text-xs text-muted">{b.threadCount} {b.threadCount === 1 ? "thread" : "threads"}</span>
                </span>
                <span className="mt-1 block text-sm text-muted">{b.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

const SORTS = [
  { id: "active", label: "Active" },
  { id: "new", label: "New" },
  { id: "top", label: "Top" },
  { id: "unsolved", label: "Unsolved" },
] as const;
type Sort = (typeof SORTS)[number]["id"];

function BoardView({ slug }: { slug: string }) {
  const [params, setParams] = useSearchParams();
  const sort: Sort = SORTS.find((s) => s.id === params.get("sort"))?.id ?? "active";
  const tag = params.get("tag") ?? undefined;
  const [composing, setComposing] = useState(false);
  const { user } = useSession();
  const boards = useQuery({ queryKey: ["forum-boards"], queryFn: () => api.call("listForumBoards") });
  const info = boards.data?.items.find((b) => b.slug === slug);
  const threads = useInfiniteQuery({
    queryKey: ["forum-threads", slug, sort, tag],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.call("listThreads", { params: { slug }, query: { sort, tag, cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = threads.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (k: string, v: string | null) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });

  if (boards.isSuccess && !info) {
    return (
      <PageShell>
        <StateMessage title="Board not found" action={<Link className={buttonClasses()} to="/forum">All boards</Link>} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={info?.name ?? "Forum"}
      actions={
        user ? (
          <Button onClick={() => setComposing((v) => !v)} variant={composing ? "secondary" : "primary"}>{composing ? "Cancel" : "New thread"}</Button>
        ) : (
          <a href={signInUrl()} className={buttonClasses()}>Sign in to post</a>
        )
      }
    >
      <nav aria-label="Breadcrumb" className="-mt-4 mb-4 text-sm text-muted">
        <Link to="/forum" className="hover:underline">Forum</Link> / {info?.name ?? slug}
      </nav>
      {info ? <p className="mb-4 text-muted">{info.description}</p> : null}
      {composing ? <NewThreadForm board={slug} /> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Sort threads">
        {SORTS.map((s) => (
          <Chip key={s.id} selected={sort === s.id} onClick={() => set("sort", s.id === "active" ? null : s.id)}>{s.label}</Chip>
        ))}
        {tag ? (
          <Chip selected onClick={() => set("tag", null)} aria-label={`Remove tag filter ${tag}`}>#{tag} ×</Chip>
        ) : null}
      </div>

      {threads.isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : threads.isError ? (
        <StateMessage title="Couldn't load threads" tone="danger" action={<Button onClick={() => void threads.refetch()}>Try again</Button>} />
      ) : !items.length ? (
        <StateMessage title={sort === "unsolved" ? "Nothing unsolved" : "No threads yet"}>{sort === "unsolved" ? "Every question here has an answer. Nice." : "Start the first one."}</StateMessage>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {items.map((t) => <ThreadRow key={t.id} thread={t} onTag={(x) => set("tag", x)} />)}
        </ul>
      )}
      {threads.hasNextPage ? <Button className="mt-4" variant="secondary" loading={threads.isFetchingNextPage} onClick={() => void threads.fetchNextPage()}>Load more</Button> : null}
    </PageShell>
  );
}

function ThreadRow({ thread: t, onTag }: { thread: Thread; onTag: (tag: string) => void }) {
  return (
    <li className="flex items-start gap-3 p-3">
      <Avatar src={t.author.avatarUrl} name={t.author.displayName} size="sm" />
      <div className="min-w-0 flex-1">
        <Link to={`/forum/t/${t.id}`} className="block font-semibold break-words hover:underline">
          {t.pinned ? <span className="mr-1" aria-label="Pinned">📌</span> : null}
          {t.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>@{t.author.username}</span>
          <time dateTime={t.lastActivityAt}>active {relative(t.lastActivityAt)}</time>
          {t.tags.map((tag) => (
            <button key={tag} type="button" className="hover:text-fg hover:underline" onClick={() => onTag(tag)}>#{tag}</button>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
        {t.solved ? <Badge tone="success">Solved</Badge> : null}
        <span>{t.replyCount} {t.replyCount === 1 ? "reply" : "replies"} · ▲ {t.upvotes}</span>
      </div>
    </li>
  );
}

function NewThreadForm({ board }: { board: string }) {
  const navigate = useNavigate();
  const config = useSiteConfig();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const onToken = useCallback((t: string) => setToken(t), []);
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  const create = useMutation({
    mutationFn: () => api.call("createThread", { params: { slug: board }, body: { title: title.trim(), bodyMd: body, tags: parseTags(tags), turnstileToken: token } }),
    onSuccess: (d) => navigate(`/forum/t/${d.thread.id}`),
    onSettled: () => setReset((n) => n + 1),
  });
  return (
    <Card className="mb-6 p-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Title</span>
          <input className="w-full rounded-pixel border border-border bg-surface p-2" required minLength={3} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Post</span>
          <textarea className="w-full rounded-pixel border border-border bg-surface p-2 font-mono text-sm" required rows={8} maxLength={50000} value={body} onChange={(e) => setBody(e.target.value)} />
          <span className="text-xs text-muted">Markdown works. Put a project link (/p/its-name) on its own line to embed it.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Tags (optional, up to 5, comma separated)</span>
          <input className="w-full rounded-pixel border border-border bg-surface p-2" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vite, react" />
        </label>
        {needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={onToken} reset={reset} /> : null}
        {create.isError ? <p role="alert" className="text-sm text-danger">{create.error.message}</p> : null}
        <Button type="submit" loading={create.isPending} disabled={title.trim().length < 3 || !body.trim() || (needsToken && !token)}>Post thread</Button>
      </form>
    </Card>
  );
}
