/** Task 2.9: DMs and collab requests at /messages (?c=<conversation> opens one; ?tab=requests). */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CollabRequest, Conversation } from "@forkvlift/shared";
import { Avatar, Badge, Button, Spinner, StateMessage, Tabs, buttonClasses, cn } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";

const KIND_LABEL: Record<CollabRequest["kind"], string> = { collab: "Collab", build_permission: "Permission to build", adoption: "Adoption" };

export function MessagesPage() {
  const { user, isLoading } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "requests" ? "requests" : "messages";
  if (isLoading) return <Spinner label="Loading" className="m-8" />;
  if (!user) return <StateMessage title="Sign in to see your messages" action={<a className={buttonClasses()} href={signInUrl()}>Sign in with GitHub</a>} />;
  return (
    <PageShell title="Messages">
      <Tabs
        label="Inbox"
        value={tab}
        onValueChange={(t) => setParams(t === "requests" ? { tab: "requests" } : {})}
        items={[
          { id: "messages", label: "Direct messages", content: <Conversations selected={params.get("c")} onSelect={(c) => setParams({ c })} viewerId={user.id} /> },
          { id: "requests", label: "Collab requests", content: <Requests /> },
        ]}
      />
    </PageShell>
  );
}

function Conversations({ selected, onSelect, viewerId }: { selected: string | null; onSelect: (id: string) => void; viewerId: string }) {
  const list = useQuery({ queryKey: ["conversations"], queryFn: () => api.call("listConversations", { query: { limit: 50 } }), refetchInterval: 30_000 });
  if (list.isPending) return <Spinner label="Loading conversations" />;
  if (list.isError) return <StateMessage title="Couldn't load messages" tone="danger" action={<Button onClick={() => void list.refetch()}>Try again</Button>} />;
  const items = list.data.items;
  if (!items.length) return <StateMessage title="No messages yet">Start a conversation from someone's profile with the Message button.</StateMessage>;
  const current = items.find((c) => c.id === selected) ?? null;
  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <ul className={cn("space-y-1", current && "hidden md:block")} aria-label="Conversations">
        {items.map((c) => {
          const other = c.participants.find((p) => p.id !== viewerId) ?? c.participants[0];
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === selected}
                className={cn("flex w-full items-center gap-3 rounded-pixel p-2 text-left", c.id === selected ? "bg-surface-2" : "hover:bg-surface-2")}
              >
                <Avatar src={other?.avatarUrl} name={other?.displayName ?? "?"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{other?.displayName}</span>
                  <span className="block truncate text-xs text-muted">{c.lastMessagePreview ?? "No messages yet"}</span>
                </span>
                {c.unreadCount ? <Badge tone="accent">{c.unreadCount}</Badge> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {current ? <Thread conversation={current} viewerId={viewerId} /> : <p className="hidden text-muted md:block">Pick a conversation.</p>}
    </div>
  );
}

function Thread({ conversation, viewerId }: { conversation: Conversation; viewerId: string }) {
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const other = conversation.participants.find((p) => p.id !== viewerId);
  const messages = useInfiniteQuery({
    queryKey: ["messages", conversation.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.call("listMessages", { params: { id: conversation.id }, query: { cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    refetchInterval: 15_000,
  });
  useEffect(() => {
    // Opening a thread marks it read on the server; refresh the inbox badge.
    if (messages.isSuccess) void qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [messages.isSuccess, messages.dataUpdatedAt, qc]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.dataUpdatedAt]);
  const send = useMutation({
    mutationFn: () => api.call("sendMessage", { params: { id: conversation.id }, body: { body } }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["messages", conversation.id] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const items = (messages.data?.pages.flatMap((p) => p.items) ?? []).slice().reverse();
  return (
    <section className="flex min-h-[60dvh] flex-col rounded-card border border-border bg-surface" aria-label={`Conversation with ${other?.displayName ?? "someone"}`}>
      <header className="flex items-center gap-2 border-b border-border p-3">
        <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setParams({})} aria-label="Back to conversations">←</Button>
        {other ? <Link to={`/u/${other.username}`} className="font-display hover:text-accent">{other.displayName}</Link> : null}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {messages.hasNextPage ? <Button size="sm" variant="ghost" onClick={() => void messages.fetchNextPage()}>Load older</Button> : null}
        {messages.isPending ? <Spinner label="Loading messages" /> : null}
        {messages.isError ? <p role="alert" className="text-danger">{messages.error.message}</p> : null}
        {items.map((m) => {
          const mine = m.sender.id === viewerId;
          return (
            <div key={m.id} className={cn("max-w-[80%] rounded-card px-3 py-2", mine ? "ml-auto bg-accent text-accent-fg" : "bg-surface-2")}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[10px]", mine ? "opacity-80" : "text-muted")}>{new Date(m.createdAt).toLocaleString()}</p>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}>
        <label className="sr-only" htmlFor="dm-body">Message</label>
        <textarea id="dm-body" rows={2} maxLength={4000} className="min-w-0 flex-1 rounded-pixel border border-border bg-surface p-2" value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (body.trim()) send.mutate(); } }} />
        <Button type="submit" loading={send.isPending} disabled={!body.trim()}>Send</Button>
      </form>
      {send.isError ? <p role="alert" className="px-3 pb-3 text-sm text-danger">{send.error.message}</p> : null}
    </section>
  );
}

function Requests() {
  const [box, setBox] = useState<"inbox" | "sent">("inbox");
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["collab", box], queryFn: () => api.call("listCollabRequests", { query: { box, limit: 50 } }) });
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api.call("respondCollabRequest", { params: { id }, body: { accept } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["collab"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="Requests box">
        <Button size="sm" variant={box === "inbox" ? "primary" : "secondary"} aria-pressed={box === "inbox"} onClick={() => setBox("inbox")}>Received</Button>
        <Button size="sm" variant={box === "sent" ? "primary" : "secondary"} aria-pressed={box === "sent"} onClick={() => setBox("sent")}>Sent</Button>
      </div>
      {list.isPending ? <Spinner label="Loading requests" /> : null}
      {list.isError ? <StateMessage title="Couldn't load requests" tone="danger" /> : null}
      {list.data && !list.data.items.length ? <p className="text-muted">{box === "inbox" ? "No requests yet." : "You haven't sent any requests."}</p> : null}
      <ul className="space-y-3">
        {list.data?.items.map((r) => {
          const person = box === "inbox" ? r.from : r.to;
          return (
            <li key={r.id} className="space-y-2 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{KIND_LABEL[r.kind]}</Badge>
                <Link to={`/u/${person.username}`} className="font-medium hover:text-accent">{box === "inbox" ? "From" : "To"} @{person.username}</Link>
                {r.project ? <Link to={`/p/${r.project.slug}`} className="text-sm text-accent underline">{r.project.name}</Link> : null}
                <Badge tone={r.status === "accepted" ? "success" : r.status === "declined" ? "danger" : "neutral"}>{r.status}</Badge>
              </div>
              {r.role ? <p className="text-sm"><span className="text-muted">Role:</span> {r.role}{r.availability ? ` · ${r.availability}` : ""}</p> : null}
              {r.message ? <p className="whitespace-pre-wrap break-words text-sm">{r.message}</p> : null}
              {box === "inbox" && r.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" loading={respond.isPending} onClick={() => respond.mutate({ id: r.id, accept: true })}>Accept</Button>
                  <Button size="sm" variant="secondary" loading={respond.isPending} onClick={() => respond.mutate({ id: r.id, accept: false })}>Decline</Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {respond.isError ? <p role="alert" className="text-sm text-danger">{respond.error.message}</p> : null}
    </div>
  );
}
