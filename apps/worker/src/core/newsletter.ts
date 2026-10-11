/**
 * Task 4.10: The Fork Report newsletter, double opt-in. A signup is stored as
 * pending; the emailed link confirms it. The same token unsubscribes. Without
 * an email provider, signups wait as pending and confirmation can be re-sent
 * later (subscribing again re-sends, at most once an hour).
 */
import { SITE_NAME } from "@forkvlift/shared";
import { sendEmail } from "../email/send";
import { newsletterConfirmationEmail } from "../email/templates";
import { HttpError } from "./errors";
import { newId, randomToken } from "./ids";

const RESEND_AFTER_MS = 60 * 60_000;

interface SubscriberRow {
  id: string;
  email: string;
  token: string;
  status: "pending" | "confirmed" | "unsubscribed";
  last_sent_at: number | null;
}

const links = (origin: string, token: string) => ({
  confirmUrl: `${origin}/newsletter?confirm=${token}`,
  unsubscribeUrl: `${origin}/newsletter?unsubscribe=${token}`,
});

export async function subscribe(env: Env, email: string): Promise<{ ok: true; status: "pending" | "confirmed" }> {
  const db = env.DB;
  const now = Date.now();
  let row = await db.prepare(`SELECT * FROM subscribers WHERE email = ?`).bind(email).first<SubscriberRow>();
  if (row?.status === "confirmed") return { ok: true, status: "confirmed" };
  if (!row) {
    row = { id: newId("sub"), email, token: randomToken(24), status: "pending", last_sent_at: null };
    await db.prepare(`INSERT INTO subscribers (id, email, token, status, created_at) VALUES (?, ?, ?, 'pending', ?)`).bind(row.id, email, row.token, now).run();
  } else if (row.status === "unsubscribed") {
    // Coming back: new token, back to pending until they confirm again.
    row = { ...row, token: randomToken(24), status: "pending", last_sent_at: null };
    await db.prepare(`UPDATE subscribers SET status = 'pending', token = ?, unsubscribed_at = NULL, last_sent_at = NULL WHERE id = ?`).bind(row.token, row.id).run();
  }
  if (!row.last_sent_at || now - row.last_sent_at > RESEND_AFTER_MS) {
    const mail = newsletterConfirmationEmail(links(env.SITE_ORIGIN, row.token));
    const result = await sendEmail(env, { to: email, ...mail });
    if (result === "sent") await db.prepare(`UPDATE subscribers SET last_sent_at = ? WHERE id = ?`).bind(now, row.id).run();
  }
  return { ok: true, status: "pending" };
}

export async function confirm(db: D1Database, token: string): Promise<void> {
  const res = await db
    .prepare(`UPDATE subscribers SET status = 'confirmed', confirmed_at = coalesce(confirmed_at, ?) WHERE token = ? AND status IN ('pending', 'confirmed')`)
    .bind(Date.now(), token)
    .run();
  if (!res.meta.changes) throw new HttpError("not_found", `That ${SITE_NAME} newsletter link has expired. Subscribe again to get a new one.`);
}

/** Always succeeds for a well-formed token, so the response can't be used to probe emails. */
export async function unsubscribe(db: D1Database, token: string): Promise<void> {
  await db.prepare(`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE token = ? AND status != 'unsubscribed'`).bind(Date.now(), token).run();
}
