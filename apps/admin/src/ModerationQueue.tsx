/** Task 3.10: the moderation queue (reports), bans, and chat room controls. */
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, type Report, type RouteInput, type Routes } from "@forkvlift/shared";
import { Badge, Button, Card, Modal, Spinner, StateMessage, cn } from "@forkvlift/ui";
import { api } from "./api";

const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2 text-sm";
const STATUSES = ["open", "resolved", "dismissed"] as const;
type Status = (typeof STATUSES)[number];
const REASONS: Record<Report["reason"], string> = { spam: "Spam", malware: "Malware / risky script", harassment: "Harassment", stolen_code: "Stolen code", other: "Other" };
const CHANNELS = ["general", "help", "showcase", "gamedev", "ai-and-agents", "developer-tools", "productivity", "creative-and-design"];

export function ModerationQueue() {
  const [params, setParams] = useSearchParams();
  const status: Status = (STATUSES as readonly string[]).includes(params.get("status") ?? "") ? (params.get("status") as Status) : "open";
  const config = useQuery({ queryKey: ["siteConfig"], queryFn: () => api.call("siteConfig"), staleTime: Infinity });
  const queue = useInfiniteQuery({
    queryKey: ["reports", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.call("listReports", { query: { status, cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    retry: false,
  });
  const [active, setActive] = useState<Report | null>(null);
  const items = queue.data?.pages.flatMap((p) => p.items) ?? [];
  const noAccess = queue.error instanceof ApiError && (queue.error.status === 401 || queue.error.status === 403);
  const origin = config.data?.siteOrigin ?? "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl">Moderation</h1>
        <div className="flex gap-1" role="group" aria-label="Report status">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={s === status ? "primary" : "secondary"} onClick={() => setParams(s === "open" ? {} : { status: s })}>
              {s[0]!.toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </header>

      {queue.isPending ? (
        <Spinner label="Loading reports" />
      ) : noAccess ? (
        <StateMessage title="Admins only" tone="danger">Sign in through Cloudflare Access with an admin account.</StateMessage>
      ) : queue.isError ? (
        <StateMessage title="Couldn't load reports" tone="danger" action={<Button onClick={() => void queue.refetch()}>Try again</Button>} />
      ) : !items.length ? (
        <StateMessage title={status === "open" ? "Queue is clear" : `No ${status} reports`}>{status === "open" ? "Nothing waiting for review." : null}</StateMessage>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.reason === "malware" || r.reason === "harassment" ? "danger" : "warning"}>{REASONS[r.reason]}</Badge>
                    <Badge>{r.targetType.replace("_", " ")}</Badge>
                    {r.targetHref ? (
                      <a className="font-semibold break-words text-accent underline" href={`${origin}${r.targetHref}`} target="_blank" rel="noopener noreferrer">{r.targetLabel ?? r.targetId}</a>
                    ) : (
                      <span className="font-semibold text-muted">{r.targetLabel ?? "Already removed"}</span>
                    )}
                  </p>
                  {r.note ? <p className="text-sm break-words whitespace-pre-wrap">“{r.note}”</p> : null}
                  <p className="text-xs text-muted">
                    {r.reporter ? `by @${r.reporter.username}` : "by a deleted account"} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                {status === "open" ? <Button size="sm" onClick={() => setActive(r)}>Review</Button> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {queue.hasNextPage ? <Button variant="secondary" loading={queue.isFetchingNextPage} onClick={() => void queue.fetchNextPage()}>Load more</Button> : null}

      {active ? <ResolveDialog report={active} onClose={() => setActive(null)} onDone={() => { setActive(null); void queue.refetch(); }} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <BanPanel />
        <ChatPanel />
      </section>
    </div>
  );
}

function ResolveDialog({ report, onClose, onDone }: { report: Report; onClose: () => void; onDone: () => void }) {
  type Body = RouteInput<Routes["resolveReport"]>["body"];
  const [action, setAction] = useState<Body["action"]>("none");
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: (outcome: Body["outcome"]) => api.call("resolveReport", { params: { id: report.id }, body: { outcome, action: outcome === "dismissed" ? "none" : action, note } }),
    onSuccess: onDone,
  });
  const actions: { id: Body["action"]; label: string; hint: string }[] = [
    { id: "none", label: "No action", hint: "Close the report without changing anything." },
    { id: "hide", label: "Hide it", hint: report.targetType === "user" ? "Not available for users." : "Takes it off the site; can be restored from the database." },
    { id: "delete", label: "Delete it", hint: report.targetType === "user" ? "Not available for users." : "Removes it for good." },
    { id: "ban_user", label: "Ban the author", hint: "Signs them out everywhere and removes them from chat." },
  ];
  return (
    <Modal open onClose={onClose} title="Resolve report">
      <div className="space-y-4">
        <p className="text-sm">
          <strong>{REASONS[report.reason]}</strong> · {report.targetLabel ?? report.targetId}
        </p>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">Action</legend>
          {actions.map((a) => {
            const disabled = report.targetType === "user" && (a.id === "hide" || a.id === "delete");
            return (
              <label key={a.id} className={cn("flex items-start gap-2 text-sm", disabled && "opacity-50")}>
                <input type="radio" name="action" disabled={disabled} checked={action === a.id} onChange={() => setAction(a.id)} className="mt-1" />
                <span>
                  {a.label}
                  <span className="block text-xs text-muted">{a.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <label className="block text-sm">
          Note for the audit log
          <textarea className={field} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {resolve.isError ? <p role="alert" className="text-sm text-danger">{resolve.error.message}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" loading={resolve.isPending && resolve.variables === "dismissed"} onClick={() => resolve.mutate("dismissed")}>Dismiss</Button>
          <Button variant={action === "ban_user" || action === "delete" ? "danger" : "primary"} loading={resolve.isPending && resolve.variables === "resolved"} onClick={() => resolve.mutate("resolved")}>Resolve</Button>
        </div>
      </div>
    </Modal>
  );
}

function BanPanel() {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const ban = useMutation({
    mutationFn: (banned: boolean) => api.call("banUser", { params: { username: username.trim().replace(/^@/, "") }, body: { banned, reason } }),
    onSuccess: (_, banned) => setMsg(`${banned ? "Banned" : "Unbanned"} @${username.trim().replace(/^@/, "")}.`),
    onError: (e) => setMsg(e.message),
  });
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-display">Ban or unban</h2>
      <label className="block text-sm">
        Username
        <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@someone" />
      </label>
      <label className="block text-sm">
        Reason
        <input className={field} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button variant="danger" size="sm" disabled={!username.trim()} loading={ban.isPending && ban.variables} onClick={() => ban.mutate(true)}>Ban</Button>
        <Button variant="secondary" size="sm" disabled={!username.trim()} loading={ban.isPending && !ban.variables} onClick={() => ban.mutate(false)}>Unban</Button>
      </div>
      <p role="status" className="text-sm">{msg}</p>
    </Card>
  );
}

function ChatPanel() {
  type Body = RouteInput<Routes["moderateChat"]>["body"];
  const [channel, setChannel] = useState("general");
  const [seconds, setSeconds] = useState(10);
  const [userId, setUserId] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [msg, setMsg] = useState("");
  const run = useMutation({
    mutationFn: (body: Body) => api.call("moderateChat", { params: { slug: channel }, body }),
    onSuccess: (r, body) => setMsg(`#${channel}: ${body.action} done. Slow mode is ${r.slowModeSeconds ? `${r.slowModeSeconds}s` : "off"}.`),
    onError: (e) => setMsg(e.message),
  });
  const id = userId.trim();
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-display">Chat rooms</h2>
      <label className="block text-sm">
        Room
        <select className={field} value={channel} onChange={(e) => setChannel(e.target.value)}>
          {CHANNELS.map((c) => <option key={c} value={c}>#{c}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Slow mode (seconds)
          <input className={field} type="number" min={0} max={3600} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
        </label>
        <Button size="sm" onClick={() => run.mutate({ action: "slow", seconds })}>Set</Button>
        <Button size="sm" variant="secondary" onClick={() => run.mutate({ action: "slow", seconds: 0 })}>Off</Button>
      </div>
      <label className="block text-sm">
        User ID (from a report or profile)
        <input className={field} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="usr_…" />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Mute for (minutes)
          <input className={field} type="number" min={1} max={10080} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <Button size="sm" disabled={!id} onClick={() => run.mutate({ action: "mute", userId: id, minutes })}>Mute</Button>
        <Button size="sm" variant="secondary" disabled={!id} onClick={() => run.mutate({ action: "unmute", userId: id })}>Unmute</Button>
        <Button size="sm" variant="secondary" disabled={!id} onClick={() => run.mutate({ action: "kick", userId: id })}>Kick</Button>
        <Button size="sm" variant="danger" disabled={!id} onClick={() => run.mutate({ action: "deleteByUser", userId: id })}>Delete their messages</Button>
      </div>
      <p role="status" className="text-sm">{msg}</p>
    </Card>
  );
}
