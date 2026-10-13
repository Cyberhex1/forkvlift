/** Task 2.8: profile page with showcase, tabs, stats, follow, Collab and Message. */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@forkvlift/shared";
import { Avatar, Badge, Button, Modal, PixelAvatar, Spinner, StateMessage, Tabs, buttonClasses } from "@forkvlift/ui";
import { BadgeIcon } from "@forkvlift/ui/icons";
import { PageShell } from "../../app/kit";
import { usePreferences } from "../../app/preferences";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { ShowcaseStrip } from "../showcases/ShowcaseStrip";
import { ProjectCard } from "../catalog/ProjectCard";
import { SubmitVerification } from "../catalog/SubmitVerification";

const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2";

export function ProfilePage() {
  const { name = "" } = useParams();
  const profile = useQuery({ queryKey: ["profile", name.toLowerCase()], queryFn: () => api.call("getProfile", { params: { username: name } }), retry: false });
  if (profile.isPending) return <Spinner label="Loading profile" className="m-8" />;
  if (profile.isError) {
    return (
      <StateMessage title={profile.error.message === "User not found" ? "No one here by that name" : "Couldn't load this profile"} tone="danger" action={<Link to="/" className={buttonClasses("secondary")}>Back to the feed</Link>}>
        {profile.error.message}
      </StateMessage>
    );
  }
  return <ProfileView profile={profile.data} />;
}

function ProfileView({ profile }: { profile: Profile }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const isSelf = profile.viewer?.isSelf ?? false;
  const [tab, setTab] = useState("projects");
  const [dialog, setDialog] = useState<null | "message" | "collab" | "showcase" | "block">(null);
  const key = ["profile", profile.user.username.toLowerCase()];
  const follow = useMutation({
    mutationFn: () =>
      profile.viewer?.following
        ? api.call("unfollow", { body: { targetType: "user", targetId: profile.user.id } })
        : api.call("follow", { body: { targetType: "user", targetId: profile.user.id } }),
    onSuccess: () => qc.setQueryData<Profile>(key, (p) => (p && p.viewer ? { ...p, viewer: { ...p.viewer, following: !p.viewer.following } } : p)),
  });
  const links = [
    profile.links.github ? { href: profile.links.github, label: "GitHub" } : null,
    profile.links.website ? { href: profile.links.website, label: "Website" } : null,
    ...profile.links.socials.map((href) => ({ href, label: new URL(href).hostname.replace(/^www\./, "") })),
    profile.links.donation ? { href: profile.links.donation, label: "Support" } : null,
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <PageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <Avatar src={profile.user.avatarUrl} name={profile.user.displayName} size="xl" />
          {profile.user.avatar ? <PixelAvatar look={profile.user.avatar} name={`${profile.user.displayName}'s Plaza avatar`} size={40} className="absolute -right-2 -bottom-2 rounded-pixel border border-border bg-surface" /> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="break-words font-display text-2xl">{profile.user.displayName}</h1>
          <p className="text-muted">
            @{profile.user.username}
            {profile.location ? ` · ${profile.location}` : ""} · joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          {profile.bio ? <p className="max-w-2xl whitespace-pre-wrap break-words">{profile.bio}</p> : null}
          {links.length ? (
            <p className="flex flex-wrap gap-3 text-sm">
              {links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer me" className="text-accent underline">{l.label} ↗</a>
              ))}
            </p>
          ) : null}
          <dl className="flex flex-wrap gap-4 text-sm">
            <div><dt className="text-muted">Projects</dt><dd className="font-display">{profile.stats.projects}</dd></div>
            <div><dt className="text-muted">Forks of their work</dt><dd className="font-display">{profile.stats.forksOfWork}</dd></div>
            <div><dt className="text-muted">Built on by</dt><dd className="font-display">{profile.stats.forkedBy} people</dd></div>
          </dl>
          {profile.badges.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Badges">
              {profile.badges.map((b) => (
                <li key={b.badge.key} className="flex items-center gap-1.5 rounded-pixel border border-border bg-surface-2 px-2 py-1 text-xs" title={`${b.badge.description} Earned ${new Date(b.awardedAt).toLocaleDateString()}.`}>
                  <BadgeIcon iconKey={b.badge.iconKey} size={20} />
                  {b.badge.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {isSelf ? (
            <>
              <Link to="/settings" className={buttonClasses("secondary", "sm")}>Edit profile</Link>
              <Button size="sm" variant="secondary" onClick={() => setDialog("showcase")}>Pin projects</Button>
            </>
          ) : user ? (
            <>
              <Button size="sm" variant={profile.viewer?.following ? "secondary" : "primary"} loading={follow.isPending} aria-pressed={profile.viewer?.following} onClick={() => follow.mutate()}>
                {profile.viewer?.following ? "Following" : "Follow"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog("collab")}>Collab</Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog("message")}>Message</Button>
              <Button size="sm" variant="ghost" onClick={() => setDialog("block")}>{profile.viewer?.blocked ? "Blocked" : "Block"}</Button>
            </>
          ) : (
            <a href={signInUrl()} className={buttonClasses("secondary", "sm")}>Sign in to follow or message</a>
          )}
        </div>
      </header>
      {follow.isError ? <p role="alert" className="mt-2 text-sm text-danger">{follow.error.message}</p> : null}

      <section className="mt-8 space-y-3" aria-labelledby="showcase-h">
        <h2 id="showcase-h" className="font-display text-lg">Showcase</h2>
        {profile.showcase.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{profile.showcase.map((p) => <ProjectCard key={p.id} project={p} includeUnlicensed={isSelf} />)}</div>
        ) : (
          <p className="text-muted">{isSelf ? "Pin up to 6 of your public projects here." : "Nothing pinned yet."}</p>
        )}
      </section>

      <Tabs
        className="mt-8"
        label="Profile sections"
        value={tab}
        onValueChange={setTab}
        items={[
          { id: "projects", label: "Projects", content: <ProjectsTab username={profile.user.username} tab="projects" isSelf={isSelf} /> },
          { id: "showcases", label: "Showcases", content: <ShowcaseStrip source="user" value={profile.user.username} title="Published showcases" /> },
          { id: "forks", label: "Forks they made", content: <ProjectsTab username={profile.user.username} tab="forks" isSelf={isSelf} /> },
          { id: "collections", label: "Collections", content: <CollectionsTab username={profile.user.username} /> },
          { id: "resources", label: "Resources shared", content: <p className="text-muted">Resources arrive with the Resources library.</p> },
          { id: "forum", label: "Forum activity", content: <p className="text-muted">Forum activity arrives with the forum.</p> },
        ]}
      />

      <MessageDialog open={dialog === "message"} onClose={() => setDialog(null)} profile={profile} />
      <CollabDialog open={dialog === "collab"} onClose={() => setDialog(null)} profile={profile} />
      <BlockDialog open={dialog === "block"} onClose={() => setDialog(null)} profile={profile} queryKey={key} />
      {isSelf ? <ShowcaseDialog open={dialog === "showcase"} onClose={() => setDialog(null)} profile={profile} queryKey={key} /> : null}
    </PageShell>
  );
}

function ProjectsTab({ username, tab, isSelf }: { username: string; tab: "projects" | "forks"; isSelf: boolean }) {
  const { showUnlicensed } = usePreferences();
  const list = useInfiniteQuery({
    queryKey: ["user-projects", username, tab, showUnlicensed],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.call("listUserProjects", { params: { username }, query: { tab, cursor: pageParam, showUnlicensed } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  if (list.isPending) return <Spinner label="Loading projects" />;
  if (list.isError) return <StateMessage title="Couldn't load projects" tone="danger" action={<Button onClick={() => void list.refetch()}>Try again</Button>} />;
  const items = list.data.pages.flatMap((p) => p.items);
  const hidden = list.data.pages[0]?.hiddenUnlicensedCount ?? 0;
  return (
    <div className="space-y-4">
      {items.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <ProjectCard key={p.id} project={p} includeUnlicensed={isSelf || showUnlicensed} />)}</div>
      ) : (
        <p className="text-muted">{tab === "forks" ? "No forks listed yet." : "No public projects yet."}</p>
      )}
      {hidden > 0 ? <p className="text-sm text-muted">{hidden} unlicensed project{hidden === 1 ? "" : "s"} hidden.</p> : null}
      {list.hasNextPage ? <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Load more</Button> : null}
    </div>
  );
}

function CollectionsTab({ username }: { username: string }) {
  const list = useQuery({ queryKey: ["collections", username], queryFn: () => api.call("listUserCollections", { params: { username } }) });
  if (list.isPending) return <Spinner label="Loading collections" />;
  if (list.isError) return <StateMessage title="Couldn't load collections" tone="danger" />;
  if (!list.data.items.length) return <p className="text-muted">No public collections yet.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.data.items.map((c) => (
        <li key={c.id}>
          <Link to={`/collections/${c.id}`} className="block rounded-card border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-pixel">
            <p className="font-display">{c.name}</p>
            <p className="text-sm text-muted">{c.itemCount} project{c.itemCount === 1 ? "" : "s"}{c.isPublic ? "" : " · private"}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MessageDialog({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () => api.call("startConversation", { body: { username: profile.user.username, body } }),
    onSuccess: (c) => {
      onClose();
      void navigate(`/messages?c=${c.id}`);
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Message @${profile.user.username}`}>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
        <label className="block text-sm">Message<textarea className={field} rows={4} required maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        {send.isError ? <p role="alert" className="text-sm text-danger">{send.error.message}</p> : null}
        <Button type="submit" loading={send.isPending} disabled={!body.trim()}>Send</Button>
      </form>
    </Modal>
  );
}

function CollabDialog({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  const config = useSiteConfig();
  const [role, setRole] = useState("");
  const [availability, setAvailability] = useState("");
  const [message, setMessage] = useState("");
  const [projectId, setProjectId] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const projects = useQuery({ queryKey: ["user-projects-lite", profile.user.username], queryFn: () => api.call("listUserProjects", { params: { username: profile.user.username }, query: { limit: 60 } }), enabled: open });
  const send = useMutation({
    mutationFn: () => api.call("createCollabRequest", { body: { toUsername: profile.user.username, projectId: projectId || null, kind: "collab", role, availability, message, turnstileToken: token } }),
    onError: () => setReset((n) => n + 1),
  });
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  return (
    <Modal open={open} onClose={onClose} title={`Collab with @${profile.user.username}`}>
      {send.isSuccess ? (
        <p role="status" className="mt-4">Request sent. You'll get a notification when they answer.</p>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <label className="block text-sm">
            Project (optional)
            <select className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not about a specific project</option>
              {projects.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">Your role<input className={field} required maxLength={80} placeholder="e.g. pixel art, backend, testing" value={role} onChange={(e) => setRole(e.target.value)} /></label>
          <label className="block text-sm">Availability<input className={field} maxLength={120} placeholder="e.g. weekends" value={availability} onChange={(e) => setAvailability(e.target.value)} /></label>
          <label className="block text-sm">Message<textarea className={field} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          {needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={setToken} reset={reset} /> : null}
          {send.isError ? <p role="alert" className="text-sm text-danger">{send.error.message}</p> : null}
          <Button type="submit" loading={send.isPending} disabled={!role.trim() || (needsToken && !token)}>Send request</Button>
        </form>
      )}
    </Modal>
  );
}

function BlockDialog({ open, onClose, profile, queryKey }: { open: boolean; onClose: () => void; profile: Profile; queryKey: string[] }) {
  const qc = useQueryClient();
  const blocked = profile.viewer?.blocked ?? false;
  const act = useMutation({
    mutationFn: (kind: "block" | "mute" | "unblock") =>
      kind === "unblock" ? api.call("unblockUser", { params: { username: profile.user.username } }) : api.call("blockUser", { body: { username: profile.user.username, kind } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={blocked ? `Unblock @${profile.user.username}?` : `Block or mute @${profile.user.username}`}>
      <div className="mt-4 space-y-3 text-sm">
        {blocked ? (
          <Button onClick={() => act.mutate("unblock")} loading={act.isPending}>Unblock</Button>
        ) : (
          <>
            <p><strong>Mute</strong> hides their notifications. <strong>Block</strong> also stops messages and collab requests in both directions, and removes follows.</p>
            <div className="flex gap-2">
              <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate("mute")}>Mute</Button>
              <Button variant="danger" loading={act.isPending} onClick={() => act.mutate("block")}>Block</Button>
            </div>
          </>
        )}
        {act.isError ? <p role="alert" className="text-danger">{act.error.message}</p> : null}
      </div>
    </Modal>
  );
}

function ShowcaseDialog({ open, onClose, profile, queryKey }: { open: boolean; onClose: () => void; profile: Profile; queryKey: string[] }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>(profile.showcase.map((p) => p.id));
  const projects = useQuery({ queryKey: ["user-projects-pin", profile.user.username], queryFn: () => api.call("listUserProjects", { params: { username: profile.user.username }, query: { limit: 60 } }), enabled: open });
  const save = useMutation({
    mutationFn: () => api.call("setShowcase", { body: { projectIds: selected } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      onClose();
    },
  });
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 6 ? s : [...s, id]));
  return (
    <Modal open={open} onClose={onClose} title="Pin up to 6 projects">
      <div className="mt-4 space-y-3">
        {projects.isPending ? <Spinner label="Loading your projects" /> : null}
        {projects.data && !projects.data.items.length ? <p className="text-muted">Publish a project first, then pin it here.</p> : null}
        <ul className="space-y-2">
          {projects.data?.items.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id) && selected.length >= 6} onChange={() => toggle(p.id)} />
                {p.name}
                {selected.includes(p.id) ? <Badge>#{selected.indexOf(p.id) + 1}</Badge> : null}
              </label>
            </li>
          ))}
        </ul>
        {save.isError ? <p role="alert" className="text-sm text-danger">{save.error.message}</p> : null}
        <Button loading={save.isPending} onClick={() => save.mutate()}>Save showcase</Button>
      </div>
    </Modal>
  );
}
