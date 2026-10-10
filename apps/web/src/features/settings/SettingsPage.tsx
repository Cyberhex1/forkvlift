/** Task 2.10: account settings. Signed out, only the on-device preferences show. */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationType, type Profile, type ProfileLinks, type SessionUser, type Theme, type UserSettings } from "@forkvlift/shared";
import { Button, Card, Modal, Spinner, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { usePreferences } from "../../app/preferences";
import { sessionKey, signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";
import { NoLicenseDisclaimerModal } from "../pages/NoLicenseDisclaimer";

const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2";
const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  message: "Direct messages",
  collab_request: "Collab requests",
  comment: "Comments on your projects",
  mention: "Mentions",
  fork: "Forks of your work",
  follow_post: "Posts from people you follow",
  stage_change: "Stage changes on projects you follow",
  system: "Account and safety notices",
};
const EMAIL_DEFAULT: Partial<Record<NotificationType, boolean>> = { message: true, collab_request: true, system: true };

export function SettingsPage() {
  const { user, isLoading } = useSession();
  if (isLoading) return <Spinner label="Loading settings" className="m-8" />;
  return (
    <PageShell title="Settings">
      <div className="mx-auto max-w-3xl space-y-6">
        {!user ? (
          <Card className="space-y-2">
            <p>Sign in to edit your profile, privacy and notifications. These display preferences are saved on this device.</p>
            <a href={signInUrl()} className={buttonClasses("primary", "sm")}>Sign in with GitHub</a>
          </Card>
        ) : (
          <ProfileSection user={user} />
        )}
        <AppearanceSection user={user} />
        <ContentSection />
        {user ? (
          <>
            <PrivacySection user={user} />
            <NotificationsSection user={user} />
            <DataSection user={user} />
          </>
        ) : null}
      </div>
    </PageShell>
  );
}

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UserSettings>) => api.call("updateSettings", { body }),
    onSuccess: (settings) => qc.setQueryData<{ user: SessionUser | null }>(sessionKey, (s) => (s?.user ? { user: { ...s.user, settings } } : s)),
  });
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="space-y-4" aria-labelledby={`${id}-h`} id={id}>
      <h2 id={`${id}-h`} className="font-display text-base">{title}</h2>
      {children}
    </Card>
  );
}

function ProfileSection({ user }: { user: SessionUser }) {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", user.username.toLowerCase()], queryFn: () => api.call("getProfile", { params: { username: user.username } }) });
  const [form, setForm] = useState({ username: user.username, displayName: user.displayName, bio: "", location: "", github: "", website: "", donation: "", socials: "" });
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setForm({
      username: p.user.username,
      displayName: p.user.displayName,
      bio: p.bio,
      location: p.location ?? "",
      github: p.links.github ?? "",
      website: p.links.website ?? "",
      donation: p.links.donation ?? "",
      socials: p.links.socials.join("\n"),
    });
  }, [profile.data]);
  const save = useMutation({
    mutationFn: () => {
      const links: ProfileLinks = {
        github: form.github || null,
        website: form.website || null,
        donation: form.donation || null,
        socials: form.socials.split(/\s+/).filter(Boolean).slice(0, 6),
      };
      return api.call("updateMe", { body: { username: form.username, displayName: form.displayName, bio: form.bio, location: form.location || null, links } });
    },
    onSuccess: (p: Profile) => {
      qc.setQueryData(["profile", p.user.username.toLowerCase()], p);
      void qc.invalidateQueries({ queryKey: sessionKey });
    },
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Section id="profile" title="Profile">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className="text-sm">Username<input className={field} required minLength={2} maxLength={39} pattern="[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?" value={form.username} onChange={set("username")} /></label>
        <label className="text-sm">Display name<input className={field} required maxLength={80} value={form.displayName} onChange={set("displayName")} /></label>
        <label className="text-sm sm:col-span-2">About me<textarea className={field} rows={4} maxLength={2000} value={form.bio} onChange={set("bio")} /></label>
        <label className="text-sm">Location (optional)<input className={field} maxLength={80} value={form.location} onChange={set("location")} /></label>
        <label className="text-sm">GitHub<input className={field} type="url" value={form.github} onChange={set("github")} /></label>
        <label className="text-sm">Website<input className={field} type="url" value={form.website} onChange={set("website")} /></label>
        <label className="text-sm">Donation link (Ko-fi, Sponsors…)<input className={field} type="url" value={form.donation} onChange={set("donation")} /></label>
        <label className="text-sm sm:col-span-2">Other links (one per line, up to 6)<textarea className={field} rows={2} value={form.socials} onChange={set("socials")} /></label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={save.isPending}>Save profile</Button>
          <p role="status" className="text-sm">{save.isError ? <span className="text-danger">{save.error.message}</span> : save.isSuccess ? "Saved." : ""}</p>
        </div>
      </form>
    </Section>
  );
}

function AppearanceSection({ user }: { user: SessionUser | null }) {
  const prefs = usePreferences();
  const save = useSaveSettings();
  return (
    <Section id="appearance" title="Appearance and sound">
      <fieldset className="space-y-2">
        <legend className="text-sm">Theme</legend>
        <div className="flex flex-wrap gap-3">
          {(["system", "light", "dark", "retro"] as Theme[]).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm capitalize">
              <input type="radio" name="theme" checked={prefs.theme === t} onChange={() => prefs.setTheme(t)} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm">Reduced motion</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["system", "Follow my device"],
              ["on", "Always reduce"],
              ["off", "Full motion"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="motion" checked={prefs.reducedMotion === v} onChange={() => prefs.setReducedMotion(v)} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      {user ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={user.settings.musicDefault === "on"} onChange={(e) => save.mutate({ musicDefault: e.target.checked ? "on" : "off" })} />
          Start elevator music on my first click (it never plays with sound before you interact)
        </label>
      ) : null}
    </Section>
  );
}

function ContentSection() {
  const prefs = usePreferences();
  const [ask, setAsk] = useState(false);
  return (
    <Section id="content" title="Content">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={prefs.showUnlicensed}
          onChange={(e) => {
            if (!e.target.checked) void prefs.setShowUnlicensed(false);
            else if (prefs.disclaimerAccepted) void prefs.setShowUnlicensed(true);
            else setAsk(true);
          }}
        />
        <span>
          Show unlicensed projects
          <span className="block text-muted">Off by default. Their code is public, but you may not reuse it without the author's permission.</span>
        </span>
      </label>
      <NoLicenseDisclaimerModal open={ask} onClose={() => setAsk(false)} onConfirm={() => void prefs.setShowUnlicensed(true, { acceptDisclaimer: true })} />
    </Section>
  );
}

function PrivacySection({ user }: { user: SessionUser }) {
  const save = useSaveSettings();
  return (
    <Section id="privacy" title="Privacy">
      <label className="block text-sm">
        Who can message me
        <select className={field} value={user.settings.dmPolicy} onChange={(e) => save.mutate({ dmPolicy: e.target.value as UserSettings["dmPolicy"] })}>
          <option value="everyone">Everyone</option>
          <option value="followers">Only people I follow</option>
          <option value="nobody">Nobody</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={user.settings.hideOnlineStatus} onChange={(e) => save.mutate({ hideOnlineStatus: e.target.checked })} />
        Hide my online status in the Plaza
      </label>
      <p className="text-sm text-muted">Blocked and muted people are managed from their profile pages.</p>
      {save.isError ? <p role="alert" className="text-sm text-danger">{save.error.message}</p> : null}
    </Section>
  );
}

function NotificationsSection({ user }: { user: SessionUser }) {
  const save = useSaveSettings();
  const prefs = user.settings.notifications;
  const setEmail = (type: NotificationType, on: boolean) => {
    const current = prefs[type] ?? { email: EMAIL_DEFAULT[type] ?? false, push: true };
    save.mutate({ notifications: { ...prefs, [type]: { ...current, email: on } } });
  };
  return (
    <Section id="notifications" title="Notifications">
      <p className="text-sm text-muted">Everything shows up in your notification center. Choose what also comes by email. To silence a person, mute them from their profile.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1 font-normal">Type</th>
            <th className="py-1 font-normal">Email</th>
          </tr>
        </thead>
        <tbody>
          {NotificationType.options.map((type) => {
            const p = prefs[type] ?? { email: EMAIL_DEFAULT[type] ?? false, push: true };
            return (
              <tr key={type} className="border-t border-border">
                <td className="py-2 pr-2">{NOTIFICATION_LABELS[type]}</td>
                <td><input type="checkbox" aria-label={`Email: ${NOTIFICATION_LABELS[type]}`} checked={p.email} onChange={(e) => setEmail(type, e.target.checked)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={user.settings.weeklyDigest} onChange={(e) => save.mutate({ weeklyDigest: e.target.checked })} />
        Weekly digest email
      </label>
      {!user.email ? <p className="text-sm text-muted">There's no email on your account, so only in-app notifications apply.</p> : null}
    </Section>
  );
}

function DataSection({ user }: { user: SessionUser }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.call("deleteAccount", { body: { confirmUsername: typed } }),
    onSuccess: () => {
      qc.setQueryData(sessionKey, { user: null });
      window.location.assign("/");
    },
  });
  return (
    <Section id="data" title="Your data">
      <div className="flex flex-wrap gap-2">
        <a href="/api/me/export" className={buttonClasses("secondary", "sm")} download>Export my data (JSON)</a>
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>Delete account</Button>
      </div>
      <p className="text-sm text-muted">The export includes your profile, projects, Studio, collections, comments, posts and messages you sent.</p>
      <Modal open={confirming} onClose={() => setConfirming(false)} title="Delete your account?">
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); remove.mutate(); }}>
          <p className="text-sm">This removes your profile, projects, Studio, collections, comments and posts, and signs you out everywhere. It can't be undone.</p>
          <label className="block text-sm">Type <strong>{user.username}</strong> to confirm<input className={field} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
          {remove.isError ? <p role="alert" className="text-sm text-danger">{remove.error.message}</p> : null}
          <Button type="submit" variant="danger" loading={remove.isPending} disabled={typed.toLowerCase() !== user.username.toLowerCase()}>Delete forever</Button>
        </form>
      </Modal>
    </Section>
  );
}
