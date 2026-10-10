/**
 * Task 2.13: email templates. Pure functions → { subject, html, text }.
 * Table-based HTML with inline styles (email clients ignore CSS variables), using
 * the pixel palette values from packages/ui/src/tokens.css.
 */
import { SITE_NAME, type NotificationType } from "@forkvlift/shared";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  bg: "#1a1c2c", // pixel-0
  card: "#ffffff",
  ink: "#1a1c2c",
  muted: "#566c86", // pixel-14
  accent: "#3b5dc9", // pixel-9
  accentInk: "#f4f4f4", // pixel-12
  gold: "#ffcd75", // pixel-4
  line: "#94b0c2", // pixel-13
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function layout(o: { preheader: string; heading: string; bodyHtml: string; settingsUrl: string }): string {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(o.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 12px;font-family:'Courier New',monospace;font-size:16px;font-weight:bold;color:${C.gold}">${e(SITE_NAME)}</td></tr>
<tr><td style="background:${C.card};border:3px solid ${C.ink};padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${C.ink}">
<h1 style="margin:0 0 12px;font-family:'Courier New',monospace;font-size:19px;line-height:1.3">${e(o.heading)}</h1>
${o.bodyHtml}
</td></tr>
<tr><td style="padding:12px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${C.line}">
You're getting this because of your notification settings. <a href="${e(o.settingsUrl)}" style="color:${C.gold}">Change or turn off these emails</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr><td style="background:${C.accent};border:2px solid ${C.ink}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;font-family:'Courier New',monospace;font-weight:bold;color:${C.accentInk};text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

const COPY: Record<NotificationType, { intro: string; cta: string }> = {
  fork: { intro: "Someone is building on your work. That's the whole point. Go take a look at their fork.", cta: "See the project" },
  comment: { intro: "There's a new comment waiting for you.", cta: "Read the comment" },
  collab_request: { intro: "You have a new request. You can accept or decline it from your inbox.", cta: "Open requests" },
  message: { intro: "You have a new direct message.", cta: "Read the message" },
  mention: { intro: "Someone mentioned you.", cta: "See where" },
  follow_post: { intro: "Someone you follow posted something new.", cta: "Take a look" },
  stage_change: { intro: "A project you follow moved to a new stage.", cta: "See the project" },
  system: { intro: "An update about your account.", cta: `Open ${SITE_NAME}` },
};

export interface NotificationEmailInput {
  type: NotificationType;
  /** The notification's own one-line title, e.g. "ada forked Pixel Planner". User text: escaped here. */
  title: string;
  url: string;
  settingsUrl: string;
}

export function notificationEmail(d: NotificationEmailInput): RenderedEmail {
  const copy = COPY[d.type];
  return {
    subject: d.title,
    html: layout({
      preheader: copy.intro,
      heading: d.title,
      bodyHtml: `<p style="margin:0;color:${C.muted}">${escapeHtml(copy.intro)}</p>${button(d.url, copy.cta)}`,
      settingsUrl: d.settingsUrl,
    }),
    text: `${d.title}\n\n${copy.intro}\n\n${copy.cta}: ${d.url}\n\n--\nChange or turn off these emails: ${d.settingsUrl}\n`,
  };
}

export interface DigestEntry {
  title: string;
  url: string;
}

export function weeklyDigest(items: DigestEntry[], settingsUrl: string): RenderedEmail {
  const subject = `Your week on ${SITE_NAME}: ${items.length} update${items.length === 1 ? "" : "s"}`;
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-top:1px solid ${C.line}"><a href="${escapeHtml(i.url)}" style="color:${C.accent};text-decoration:none">${escapeHtml(i.title)}</a></td></tr>`,
    )
    .join("");
  return {
    subject,
    html: layout({
      preheader: `${items.length} things happened while you were away.`,
      heading: subject,
      bodyHtml: `<p style="margin:0 0 8px;color:${C.muted}">Here's what happened around your projects this week.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
      settingsUrl,
    }),
    text: `${subject}\n\n${items.map((i) => `- ${i.title}\n  ${i.url}`).join("\n")}\n\n--\nChange or turn off these emails: ${settingsUrl}\n`,
  };
}

export function magicLinkEmail(url: string, settingsUrl: string): RenderedEmail {
  const subject = `Sign in to ${SITE_NAME}`;
  return {
    subject,
    html: layout({
      preheader: "Your sign-in link (works once, for 15 minutes).",
      heading: subject,
      bodyHtml: `<p style="margin:0">This link signs you in. It works once and expires in 15 minutes.</p>${button(url, "Sign in")}<p style="margin:16px 0 0;font-size:13px;color:${C.muted}">Didn't ask for this? You can ignore this email; nothing changes.</p>`,
      settingsUrl,
    }),
    text: `${subject}\n\nThis link signs you in. It works once and expires in 15 minutes:\n${url}\n\nDidn't ask for this? Ignore this email.\n`,
  };
}
