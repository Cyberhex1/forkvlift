/**
 * Email rendering. Plain built-in templates until Flash's designed ones
 * (apps/worker/src/email/templates, task 2.13) land; this file then delegates.
 */
import { SITE_NAME, type NotificationType } from "@forkvlift/shared";
import type { OutgoingEmail } from "./send";

export interface NotificationEmailData {
  type: NotificationType;
  title: string;
  /** Absolute URL to the thing the notification is about. */
  url: string;
  settingsUrl: string;
}

export interface DigestItem {
  title: string;
  url: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout(heading: string, bodyHtml: string, settingsUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f4ee;font-family:Arial,sans-serif;color:#1c1b24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d6d2c4;border-radius:10px">
<tr><td style="padding:20px 24px"><p style="margin:0 0 4px;font-family:monospace;color:#3348c6">${esc(SITE_NAME)}</p>
<h1 style="margin:0 0 16px;font-size:18px">${esc(heading)}</h1>${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#5a5768">You're getting this because of your notification settings. <a href="${esc(settingsUrl)}" style="color:#3348c6">Change them</a>.</p>
</td></tr></table></body></html>`;
}

export function renderNotification(d: NotificationEmailData): Omit<OutgoingEmail, "to"> {
  return {
    subject: d.title,
    html: layout(d.title, `<p style="margin:0"><a href="${esc(d.url)}" style="display:inline-block;padding:10px 16px;background:#3348c6;color:#ffffff;text-decoration:none;border-radius:2px">Open ${esc(SITE_NAME)}</a></p>`, d.settingsUrl),
    text: `${d.title}\n\n${d.url}\n\nChange your notification settings: ${d.settingsUrl}`,
  };
}

export function renderDigest(items: DigestItem[], settingsUrl: string): Omit<OutgoingEmail, "to"> {
  const subject = `Your week on ${SITE_NAME}: ${items.length} update${items.length === 1 ? "" : "s"}`;
  const list = items.map((i) => `<li style="margin:0 0 8px"><a href="${esc(i.url)}" style="color:#3348c6">${esc(i.title)}</a></li>`).join("");
  return {
    subject,
    html: layout(subject, `<ul style="padding-left:18px;margin:0">${list}</ul>`, settingsUrl),
    text: `${subject}\n\n${items.map((i) => `- ${i.title}: ${i.url}`).join("\n")}\n\nChange your notification settings: ${settingsUrl}`,
  };
}

export function renderMagicLink(url: string): Omit<OutgoingEmail, "to"> {
  const subject = `Sign in to ${SITE_NAME}`;
  return {
    subject,
    html: layout(subject, `<p>This link signs you in and works once, for 15 minutes.</p><p><a href="${esc(url)}" style="color:#3348c6">Sign in</a></p><p style="font-size:12px;color:#5a5768">Didn't ask for this? Ignore this email.</p>`, url.replace(/\/api\/.*$/, "/settings")),
    text: `${subject}\n\nThis link signs you in and works once, for 15 minutes:\n${url}\n\nDidn't ask for this? Ignore this email.`,
  };
}
