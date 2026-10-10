/**
 * Task 2.3: notification email fan-out and the weekly digest.
 *
 * Notifications are written in-app immediately (core/notify.ts). A cron job
 * every 15 minutes sweeps the ones not yet emailed and sends those the user
 * wants by email, skipping any already read in the app. A Monday cron sends
 * the weekly digest to users who opted in.
 */
import type { NotificationType, UserSettings } from "@forkvlift/shared";
import { parseJson } from "../core/projects/rows";
import { renderDigest, renderNotification } from "./render";
import { emailConfigured, sendEmail } from "./send";

/** Email defaults when the user hasn't chosen: only direct, personal things. */
export const DEFAULT_EMAIL: Record<NotificationType, boolean> = {
  message: true,
  collab_request: true,
  fork: false,
  comment: false,
  mention: false,
  follow_post: false,
  stage_change: false,
  system: true,
};

const BATCH = 200;
const DAY_MS = 86_400_000;

export function wantsEmail(settings: Partial<UserSettings> | null, type: NotificationType): boolean {
  return settings?.notifications?.[type]?.email ?? DEFAULT_EMAIL[type] ?? false;
}

function origin(env: Env): string {
  return (env.SITE_ORIGIN || "http://127.0.0.1:8787").replace(/\/$/, "");
}

interface PendingRow {
  id: string;
  type: NotificationType;
  title: string;
  href: string;
  read_at: number | null;
  email: string | null;
  settings: string | null;
}

export async function flushNotificationEmails(env: Env): Promise<{ sent: number; skipped: number }> {
  const db = env.DB;
  const { results } = await db
    .prepare(
      `SELECT n.id, n.type, n.title, n.href, n.read_at, u.email, pr.settings
       FROM notifications n JOIN users u ON u.id = n.user_id LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE n.emailed_at IS NULL AND u.deleted_at IS NULL AND u.banned_at IS NULL
       ORDER BY n.created_at LIMIT ?`,
    )
    .bind(BATCH)
    .all<PendingRow>();

  const configured = emailConfigured(env);
  const base = origin(env);
  let sent = 0;
  let skipped = 0;
  for (const n of results) {
    const settings = parseJson<Partial<UserSettings> | null>(n.settings, null);
    const deliver = configured && n.email && n.read_at === null && wantsEmail(settings, n.type);
    if (deliver) {
      try {
        const href = n.href.startsWith("http") ? n.href : `${base}${n.href}`;
        await sendEmail(env, { to: n.email!, ...renderNotification({ type: n.type, title: n.title, url: href, settingsUrl: `${base}/settings` }) });
        sent++;
      } catch (err) {
        // Leave it pending; the next sweep retries.
        console.error("[email] send failed", err);
        continue;
      }
    } else {
      skipped++;
    }
    await db.prepare(`UPDATE notifications SET emailed_at = ? WHERE id = ?`).bind(Date.now(), n.id).run();
  }
  return { sent, skipped };
}

export async function sendWeeklyDigests(env: Env, now = Date.now()): Promise<number> {
  if (!emailConfigured(env)) return 0;
  const db = env.DB;
  const base = origin(env);
  const { results: users } = await db
    .prepare(
      `SELECT u.id, u.email, pr.settings FROM users u JOIN profiles pr ON pr.user_id = u.id
       WHERE u.email IS NOT NULL AND u.deleted_at IS NULL AND u.banned_at IS NULL
         AND json_extract(pr.settings, '$.weeklyDigest') = 1
         AND (u.digest_sent_at IS NULL OR u.digest_sent_at < ?)
       LIMIT 500`,
    )
    .bind(now - 6 * DAY_MS)
    .all<{ id: string; email: string; settings: string }>();

  let sent = 0;
  for (const u of users) {
    const { results: items } = await db
      .prepare(`SELECT title, href FROM notifications WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 20`)
      .bind(u.id, now - 7 * DAY_MS)
      .all<{ title: string; href: string }>();
    // No news, no email.
    if (items.length) {
      await sendEmail(env, {
        to: u.email,
        ...renderDigest(items.map((i) => ({ title: i.title, url: i.href.startsWith("http") ? i.href : `${base}${i.href}` })), `${base}/settings`),
      });
      sent++;
    }
    await db.prepare(`UPDATE users SET digest_sent_at = ? WHERE id = ?`).bind(now, u.id).run();
  }
  return sent;
}
