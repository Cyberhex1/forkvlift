/** Task 3.8: a thread, its replies, votes, the solved answer, and live updates. */
import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { urlFor, type Post, type ThreadDetail, type ThreadLiveEvent } from "@forkvlift/shared";
import { Avatar, Badge, Button, Card, Skeleton, StateMessage, buttonClasses, cn } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { ReportButton } from "../../app/ReportButton";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { useSocket } from "../../lib/socket";
import { SubmitVerification } from "../catalog/SubmitVerification";
import { relative } from "./format";
import { ProjectEmbed } from "./ProjectEmbed";

const renderProject = (slug: string) => <ProjectEmbed slug={slug} />;

export function ThreadPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { user } = useSession();
  const key = ["forum-thread", id];
  const thread = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.call("getThread", { params: { id }, query: { cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const [typing, setTyping] = useState(0);
  const [newPosts, setNewPosts] = useState(0);

  const live = useSocket<ThreadLiveEvent>(id ? urlFor("threadLive", { params: { id } }) : null, (e) => {
    if (e.type === "typing") setTyping(e.count);
    if (e.type === "post") {
      let added = false;
      qc.setQueryData<InfiniteData<ThreadDetail>>(key, (d) => {
        if (!d || d.pages.some((p) => p.posts.some((x) => x.id === e.post.id))) return d;
        const last = d.pages[d.pages.length - 1]!;
        // Only append when the last page is loaded; otherwise "Load more" will bring it.
        if (last.nextCursor) return d;
        added = true;
        const pages = [...d.pages.slice(0, -1), { ...last, posts: [...last.posts, e.post] }];
        pages[0] = { ...pages[0]!, thread: { ...pages[0]!.thread, replyCount: pages[0]!.thread.replyCount + 1, lastActivityAt: e.post.createdAt } };
        return { ...d, pages };
      });
      if (added && e.post.author.id !== user?.id) setNewPosts((n) => n + 1);
    }
  });

  if (thread.isPending) {
    return (
      <PageShell>
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="h-40" />
      </PageShell>
    );
  }
  if (thread.isError) {
    const gone = (thread.error as { status?: number }).status === 404;
    return (
      <PageShell>
        <StateMessage title={gone ? "Thread not found" : "Couldn't load this thread"} tone={gone ? "neutral" : "danger"} action={gone ? <Link className={buttonClasses()} to="/forum">Back to the forum</Link> : <Button onClick={() => void thread.refetch()}>Try again</Button>} />
      </PageShell>
    );
  }

  const t = thread.data.pages[0]!.thread;
  const posts = thread.data.pages.flatMap((p) => p.posts);
  const canMarkSolved = Boolean(user && (user.id === t.author.id || user.role === "admin"));

  return (
    <PageShell>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted">
        <Link to="/forum" className="hover:underline">Forum</Link> / <Link to={`/forum/${t.boardSlug}`} className="hover:underline">{t.boardSlug}</Link>
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-xl break-words sm:text-2xl">{t.title}</h1>
        <div className="flex items-center gap-2">
          {t.solved ? <Badge tone="success">Solved</Badge> : null}
          <ReportButton targetType="thread" targetId={t.id} />
        </div>
      </div>
      {t.tags.length ? (
        <p className="-mt-4 mb-6 flex flex-wrap gap-2 text-xs text-muted">
          {t.tags.map((tag) => <Link key={tag} to={`/forum/${t.boardSlug}?tag=${encodeURIComponent(tag)}`} className="hover:underline">#{tag}</Link>)}
        </p>
      ) : null}

      <ol className="space-y-4">
        {posts.map((p, i) => (
          <PostItem key={p.id} post={p} isOpening={i === 0} threadId={t.id} canMarkSolved={canMarkSolved && i !== 0} />
        ))}
      </ol>
      {thread.hasNextPage ? <Button className="mt-4" variant="secondary" loading={thread.isFetchingNextPage} onClick={() => void thread.fetchNextPage()}>Load more replies</Button> : null}

      <div aria-live="polite" className="mt-4 min-h-5 text-sm text-muted">
        {typing > 0 ? `${typing === 1 ? "Someone is" : `${typing} people are`} typing…` : null}
        {newPosts > 0 ? (
          <button type="button" className="ml-2 text-accent underline" onClick={() => { setNewPosts(0); document.getElementById("reply")?.scrollIntoView({ behavior: "smooth" }); }}>
            {newPosts} new {newPosts === 1 ? "reply" : "replies"}
          </button>
        ) : null}
      </div>

      {user ? (
        <ReplyForm threadId={t.id} onTyping={() => live.send({ type: "typing" })} />
      ) : (
        <StateMessage className="mt-6" title="Join the conversation" action={<a className={buttonClasses()} href={signInUrl()}>Sign in to reply</a>} />
      )}
      {live.status === "closed" ? <p className="mt-2 text-xs text-muted">Live updates paused. Reconnecting…</p> : null}
    </PageShell>
  );
}

function PostItem({ post, isOpening, threadId, canMarkSolved }: { post: Post; isOpening: boolean; threadId: string; canMarkSolved: boolean }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [voted, setVoted] = useState(false);
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const vote = useMutation({
    mutationFn: (value: 0 | 1) => api.call("votePost", { params: { id: post.id }, body: { value } }),
    onMutate: (value) => {
      setVoted(value === 1);
      setUpvotes((n) => n + (value === 1 ? 1 : -1));
    },
    onSuccess: (r) => setUpvotes(r.upvotes),
    onError: (_, value) => {
      setVoted(value !== 1);
      setUpvotes(post.upvotes);
    },
  });
  const solve = useMutation({
    mutationFn: (postId: string | null) => api.call("markSolved", { params: { id: threadId }, body: { postId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["forum-thread", threadId] }),
  });

  return (
    <li id={`post-${post.id}`}>
      <Card className={cn("p-4", post.isSolution && "border-success ring-2 ring-success")}>
        <header className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Avatar src={post.author.avatarUrl} name={post.author.displayName} size="sm" />
          <Link to={`/u/${post.author.username}`} className="font-semibold hover:underline">{post.author.displayName}</Link>
          <span className="text-muted">@{post.author.username}</span>
          <time className="text-xs text-muted" dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>{relative(post.createdAt)}</time>
          {post.isSolution ? <Badge tone="success" className="ml-auto">Answer</Badge> : null}
        </header>
        <Markdown source={post.bodyMd} renderProject={renderProject} />
        <footer className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Button
            size="sm"
            variant={voted ? "primary" : "secondary"}
            aria-pressed={voted}
            disabled={!user || user.id === post.author.id}
            onClick={() => vote.mutate(voted ? 0 : 1)}
            aria-label={`Upvote (${upvotes})`}
          >
            ▲ {upvotes}
          </Button>
          {canMarkSolved ? (
            <Button size="sm" variant="ghost" loading={solve.isPending} onClick={() => solve.mutate(post.isSolution ? null : post.id)}>
              {post.isSolution ? "Unmark answer" : "Mark as answer"}
            </Button>
          ) : null}
          {!isOpening ? <a href={`#post-${post.id}`} className="text-xs text-muted hover:underline">Link</a> : null}
          <ReportButton targetType="post" targetId={post.id} className="ml-auto" />
        </footer>
      </Card>
    </li>
  );
}

function ReplyForm({ threadId, onTyping }: { threadId: string; onTyping: () => void }) {
  const qc = useQueryClient();
  const config = useSiteConfig();
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const lastTyping = useRef(0);
  const onToken = useCallback((t: string) => setToken(t), []);
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  const reply = useMutation({
    mutationFn: () => api.call("createPost", { params: { id: threadId }, body: { bodyMd: body, turnstileToken: token } }),
    onSuccess: (post) => {
      setBody("");
      qc.setQueryData<InfiniteData<ThreadDetail>>(["forum-thread", threadId], (d) => {
        if (!d || d.pages.some((p) => p.posts.some((x) => x.id === post.id))) return d;
        const last = d.pages[d.pages.length - 1]!;
        return { ...d, pages: [...d.pages.slice(0, -1), { ...last, posts: [...last.posts, post] }] };
      });
    },
    onSettled: () => setReset((n) => n + 1),
  });
  return (
    <form
      id="reply"
      className="mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        reply.mutate();
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Reply</span>
        <textarea
          className="w-full rounded-pixel border border-border bg-surface p-2 font-mono text-sm"
          rows={5}
          maxLength={50000}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            const now = Date.now();
            if (now - lastTyping.current > 2500) {
              lastTyping.current = now;
              onTyping();
            }
          }}
        />
        <span className="text-xs text-muted">Markdown works. A project link alone on a line becomes a card.</span>
      </label>
      {needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={onToken} reset={reset} /> : null}
      {reply.isError ? <p role="alert" className="text-sm text-danger">{reply.error.message}</p> : null}
      <Button type="submit" loading={reply.isPending} disabled={!body.trim() || (needsToken && !token)}>Post reply</Button>
    </form>
  );
}
