/**
 * Outbound email (task 2.3). Provider order:
 *   1. Cloudflare Email Service  (`send_email` binding named EMAIL; Workers Paid plan)
 *   2. Resend                    (RESEND_API_KEY secret; free tier)
 *   3. none                      → logged and skipped; in-app notifications still work
 */
import { SITE_NAME } from "@forkvlift/shared";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = "sent" | "skipped";

interface EmailBinding {
  send(message: { to: string; from: string; subject: string; html: string; text: string }): Promise<unknown>;
}

export function emailConfigured(env: Env): boolean {
  return Boolean((env as { EMAIL?: EmailBinding }).EMAIL || env.RESEND_API_KEY);
}

function fromAddress(env: Env): string {
  return env.EMAIL_FROM || `${SITE_NAME} <notifications@forklift.stream>`;
}

export async function sendEmail(env: Env, email: OutgoingEmail): Promise<SendResult> {
  const binding = (env as { EMAIL?: EmailBinding }).EMAIL;
  if (binding) {
    await binding.send({ ...email, from: fromAddress(env) });
    return "sent";
  }
  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromAddress(env), to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    });
    if (!res.ok) throw new Error(`Resend returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return "sent";
  }
  console.log(`[email] no provider configured; skipped "${email.subject}"`);
  return "skipped";
}
