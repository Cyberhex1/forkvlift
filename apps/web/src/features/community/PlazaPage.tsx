/**
 * Task 3.7: the Plaza. Each chat channel is also a room where everyone's
 * 16-bit avatar stands; click or use the arrow keys to walk, and what you say
 * pops up over your head. Idle people fade, away people sit on the bench.
 * Phones get a strip of heads above the chat log instead of the room.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { urlFor, type ChatMessage, type ChatServerEvent, type PlazaPresence, type UserSummary } from "@forkvlift/shared";
import { Button, PixelAvatar, Spinner, StateMessage, buttonClasses, cn } from "@forkvlift/ui";
import { ReportButton } from "../../app/ReportButton";
import { signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";
import { safeHref } from "../../lib/markdown";
import { useSocket } from "../../lib/socket";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];
const BUBBLE_MS = 8000;
const STEP = 0.04;

export function PlazaPage() {
  const [params, setParams] = useSearchParams();
  const channels = useQuery({ queryKey: ["chat-channels"], queryFn: () => api.call("listChannels"), refetchInterval: 60_000 });
  const slug = params.get("channel") ?? "general";
  const current = channels.data?.items.find((c) => c.slug === slug);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <h1 className="mb-2 font-display text-xl">The Plaza</h1>
        {channels.isError ? (
          <StateMessage title="Couldn't load rooms" tone="danger" action={<Button size="sm" onClick={() => void channels.refetch()}>Retry</Button>} />
        ) : (
          <>
            <label className="md:hidden">
              <span className="sr-only">Room</span>
              <select className="w-full rounded-pixel border border-border bg-surface p-2" value={slug} onChange={(e) => setParams({ channel: e.target.value })}>
                {(channels.data?.items ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.onlineCount})</option>)}
              </select>
            </label>
            <nav aria-label="Rooms" className="hidden md:block">
              <ul className="space-y-1">
                {(channels.data?.items ?? []).map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      onClick={() => setParams({ channel: c.slug })}
                      aria-current={c.slug === slug ? "page" : undefined}
                      className={cn("flex w-full items-center justify-between rounded-pixel px-2 py-1.5 text-left text-sm", c.slug === slug ? "bg-surface-2 font-semibold" : "text-muted hover:text-fg")}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-xs" aria-label={`${c.onlineCount} online`}>{c.onlineCount || ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
        <p className="mt-4 hidden text-xs text-muted md:block">
          Be kind. <Link to="/rules" className="underline">Community rules</Link> apply here too.
        </p>
      </aside>
      <Room key={slug} slug={slug} description={current?.description} />
    </div>
  );
}

interface Bubble {
  text: string;
  at: number;
}

function Room({ slug, description }: { slug: string; description?: string }) {
  const { user } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<Map<string, PlazaPresence>>(new Map());
  const [bubbles, setBubbles] = useState<Map<string, Bubble>>(new Map());
  const [typing, setTyping] = useState<Map<string, number>>(new Map());
  const [ready, setReady] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [error, setError] = useState("");
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [, tick] = useState(0);
  const seen = useRef(new Set<string>());

  const onEvent = useCallback((e: ChatServerEvent) => {
    switch (e.type) {
      case "hello":
        seen.current = new Set(e.history.map((m) => m.id));
        setMessages(e.history);
        setHasOlder(e.history.length >= 50);
        setPresence(new Map(e.presence.map((p) => [p.user.id, p])));
        setSlowMode(e.slowModeSeconds);
        setReady(true);
        break;
      case "message": {
        const m = e.message;
        if (seen.current.has(m.id)) {
          setMessages((all) => all.map((x) => (x.id === m.id ? m : x))); // reaction update
          break;
        }
        seen.current.add(m.id);
        setMessages((all) => [...all, m].slice(-300));
        setBubbles((b) => new Map(b).set(m.author.id, { text: m.body, at: Date.now() }));
        setTyping((t) => {
          const n = new Map(t);
          n.delete(m.author.id);
          return n;
        });
        break;
      }
      case "presence":
        setPresence((p) => new Map(p).set(e.presence.user.id, e.presence));
        break;
      case "leave":
        setPresence((p) => {
          const n = new Map(p);
          n.delete(e.userId);
          return n;
        });
        break;
      case "typing":
        setTyping((t) => new Map(t).set(e.userId, Date.now()));
        break;
      case "deleted":
        setMessages((all) => all.filter((m) => m.id !== e.messageId));
        break;
      case "error":
        setError(e.message);
        break;
      case "pong":
        break;
    }
  }, []);
  const socket = useSocket<ChatServerEvent>(urlFor("channelSocket", { params: { slug } }), onEvent);

  // Expire bubbles and typing notes.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const me = user ? presence.get(user.id) : undefined;
  const move = useCallback(
    (x: number, y: number) => {
      if (!user) return;
      const cx = Math.min(0.97, Math.max(0.03, x));
      const cy = Math.min(0.85, Math.max(0.15, y));
      const mine = presence.get(user.id);
      if (mine) setPresence((p) => new Map(p).set(user.id, { ...mine, x: cx, y: cy, state: "active" }));
      socket.send({ type: "move", x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 });
    },
    [presence, socket, user],
  );

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await api.call("channelHistory", { params: { slug }, query: { cursor: String(Date.parse(oldest.createdAt)), limit: 50 } });
      const older = page.items.filter((m) => !seen.current.has(m.id));
      for (const m of older) seen.current.add(m.id);
      setMessages((all) => [...older, ...all]);
      setHasOlder(Boolean(page.nextCursor));
    } finally {
      setLoadingOlder(false);
    }
  };

  const now = Date.now();
  const people = [...presence.values()];
  const typingNames = [...typing.entries()].filter(([id, at]) => now - at < 4000 && id !== user?.id).map(([id]) => presence.get(id)?.user.displayName ?? "Someone");

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label={`Room ${slug}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">#{slug}</h2>
        <p className="text-sm text-muted">
          {description ? `${description} · ` : ""}
          {people.length} here{slowMode ? ` · slow mode ${slowMode}s` : ""}
        </p>
      </header>

      {!ready ? (
        <Spinner label={socket.status === "closed" ? "Reconnecting" : "Joining the room"} className="m-8" />
      ) : (
        <>
          <RoomView people={people} bubbles={bubbles} now={now} me={me} canWalk={Boolean(user)} onMove={move} onSelect={setSelected} />
          <HeadStrip people={people} onSelect={setSelected} />
          {selected ? <MiniProfile user={selected} onClose={() => setSelected(null)} /> : null}
          <ChatLog slug={slug} messages={messages} hasOlder={hasOlder} loadingOlder={loadingOlder} onLoadOlder={() => void loadOlder()} onReact={(messageId, emoji) => socket.send({ type: "react", messageId, emoji })} canReact={Boolean(user)} onSelect={setSelected} />
          <p aria-live="polite" className="min-h-5 text-xs text-muted">
            {typingNames.length ? `${typingNames.slice(0, 3).join(", ")}${typingNames.length > 3 ? " and others" : ""} ${typingNames.length === 1 ? "is" : "are"} typing…` : null}
          </p>
          {user ? (
            <Composer
              onSay={(body) => {
                setError("");
                return socket.send({ type: "say", body });
              }}
              onTyping={() => socket.send({ type: "typing" })}
              error={error}
              connected={socket.status === "open"}
            />
          ) : (
            <StateMessage title="Say hi" action={<a href={signInUrl()} className={buttonClasses()}>Sign in to chat</a>}>Anyone can watch; sign in to talk and walk around.</StateMessage>
          )}
        </>
      )}
    </section>
  );
}

function RoomView({ people, bubbles, now, me, canWalk, onMove, onSelect }: { people: PlazaPresence[]; bubbles: Map<string, Bubble>; now: number; me?: PlazaPresence; canWalk: boolean; onMove: (x: number, y: number) => void; onSelect: (u: UserSummary) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const standing = people.filter((p) => p.state !== "away");
  const bench = people.filter((p) => p.state === "away");

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!canWalk || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    onMove((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!me) return;
    const d: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    onMove(me.x + step[0], me.y + step[1]);
  };

  return (
    <div
      ref={ref}
      role="application"
      aria-label={canWalk ? "Plaza room. Click a spot or use the arrow keys to walk." : "Plaza room"}
      tabIndex={canWalk ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKey}
      className={cn(
        "relative hidden aspect-[16/7] w-full overflow-hidden rounded-card border border-border bg-surface-2 select-none md:block",
        "bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] bg-[size:32px_32px]",
        canWalk && "cursor-pointer",
      )}
    >
      {/* Bench for people who are away */}
      <div aria-hidden className="pointer-events-none absolute bottom-2 left-2 h-3 w-40 rounded-pixel bg-pixel-14" />
      {bench.map((p, i) => (
        <Person key={p.user.id} p={p} left={`${2 + i * 3}%`} top="80%" bubble={null} isMe={p.user.id === me?.user.id} onSelect={onSelect} />
      ))}
      {standing.map((p) => {
        const b = bubbles.get(p.user.id);
        return <Person key={p.user.id} p={p} left={`${p.x * 100}%`} top={`${p.y * 100}%`} bubble={b && now - b.at < BUBBLE_MS ? b.text : null} isMe={p.user.id === me?.user.id} onSelect={onSelect} />;
      })}
      {!people.length ? <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Nobody's here yet.</p> : null}
    </div>
  );
}

function Person({ p, left, top, bubble, isMe, onSelect }: { p: PlazaPresence; left: string; top: string; bubble: string | null; isMe: boolean; onSelect: (u: UserSummary) => void }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full motion-safe:transition-[left,top] motion-safe:duration-500" style={{ left, top }}>
      {bubble ? (
        <div className="absolute bottom-full left-1/2 mb-1 w-max max-w-48 -translate-x-1/2 rounded-card border border-border bg-surface px-2 py-1 text-xs break-words shadow-pixel">
          {bubble.length > 120 ? `${bubble.slice(0, 117)}…` : bubble}
        </div>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(p.user);
        }}
        className={cn("flex flex-col items-center", p.state === "idle" && "opacity-60", p.state === "away" && "opacity-40")}
        aria-label={`${p.user.displayName}${isMe ? " (you)" : ""}, ${p.state}`}
      >
        <PixelAvatar look={p.user.avatar} name={p.user.displayName} size={44} decorative />
        <span className={cn("max-w-24 truncate rounded-pixel px-1 text-[10px]", isMe ? "bg-accent text-accent-fg" : "bg-surface/80")}>{p.user.username}</span>
      </button>
    </div>
  );
}

function HeadStrip({ people, onSelect }: { people: PlazaPresence[]; onSelect: (u: UserSummary) => void }) {
  if (!people.length) return <p className="text-sm text-muted md:hidden">Nobody's here yet.</p>;
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="People here">
      {people.map((p) => (
        <li key={p.user.id} className="shrink-0">
          <button type="button" onClick={() => onSelect(p.user)} className={cn("rounded-full border border-border bg-surface-2 p-0.5", p.state !== "active" && "opacity-50")} aria-label={`${p.user.displayName}, ${p.state}`}>
            <PixelAvatar look={p.user.avatar} name={p.user.displayName} size={32} headOnly decorative />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MiniProfile({ user, onClose }: { user: UserSummary; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={`${user.displayName}'s card`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-pixel">
      <PixelAvatar look={user.avatar} name={user.displayName} size={48} decorative />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.displayName}</p>
        <p className="truncate text-sm text-muted">@{user.username}</p>
      </div>
      <Link to={`/u/${user.username}`} className={buttonClasses("secondary", "sm")}>Profile</Link>
      <ReportButton targetType="user" targetId={user.id} />
      <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">✕</Button>
    </div>
  );
}

function ChatLog({ slug, messages, hasOlder, loadingOlder, onLoadOlder, onReact, canReact, onSelect }: { slug: string; messages: ChatMessage[]; hasOlder: boolean; loadingOlder: boolean; onLoadOlder: () => void; onReact: (id: string, emoji: string) => void; canReact: boolean; onSelect: (u: UserSummary) => void }) {
  const box = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <ol
      ref={box}
      aria-label="Messages"
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="h-[45dvh] space-y-1 overflow-y-auto rounded-card border border-border bg-surface p-2 md:h-72"
    >
      {hasOlder && messages.length ? (
        <li className="text-center">
          <Button size="sm" variant="ghost" loading={loadingOlder} onClick={onLoadOlder}>Load older</Button>
        </li>
      ) : null}
      {!messages.length ? <li className="p-4 text-center text-sm text-muted">No messages yet. Start things off.</li> : null}
      {messages.map((m) => (
        <li key={m.id} className="group rounded-pixel px-1 py-0.5 hover:bg-surface-2">
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => onSelect(m.author)} className="shrink-0" aria-label={`${m.author.displayName}'s card`}>
              <PixelAvatar look={m.author.avatar} name={m.author.displayName} size={24} headOnly decorative />
            </button>
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{m.author.username}</span>{" "}
              <time className="text-xs text-muted" dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
              <p className="break-words whitespace-pre-wrap">{linkify(m.body)}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {m.reactions.map((r) => (
                  <button key={r.emoji} type="button" disabled={!canReact} onClick={() => onReact(m.id, r.emoji)} aria-pressed={r.viewerReacted} className={cn("rounded-full border px-1.5 text-xs", r.viewerReacted ? "border-accent bg-surface-2" : "border-border")}>
                    {r.emoji} {r.count}
                  </button>
                ))}
                {canReact ? (
                  <span className="flex gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                    {REACTIONS.filter((e) => !m.reactions.some((r) => r.emoji === e)).map((e) => (
                      <button key={e} type="button" className="rounded px-0.5 text-xs hover:bg-surface" onClick={() => onReact(m.id, e)} aria-label={`React ${e}`}>{e}</button>
                    ))}
                  </span>
                ) : null}
                <ReportButton targetType="chat_message" targetId={`${slug}:${m.id}`} className="ml-auto opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const href = safeHref(part);
    return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-accent underline break-all">{part}</a> : part;
  });
}

function Composer({ onSay, onTyping, error, connected }: { onSay: (body: string) => boolean; onTyping: () => void; error: string; connected: boolean }) {
  const [body, setBody] = useState("");
  const last = useRef(0);
  const disabled = useMemo(() => !connected, [connected]);
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const text = body.trim();
        if (text && onSay(text)) setBody("");
      }}
    >
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message</span>
          <input
            className="w-full rounded-pixel border border-border bg-surface p-2"
            placeholder={connected ? "Say something…" : "Reconnecting…"}
            maxLength={2000}
            value={body}
            disabled={disabled}
            onChange={(e) => {
              setBody(e.target.value);
              if (Date.now() - last.current > 3000) {
                last.current = Date.now();
                onTyping();
              }
            }}
          />
        </label>
        <Button type="submit" disabled={disabled || !body.trim()}>Send</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
