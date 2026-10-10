import type { MiddlewareHandler } from "hono";
import type { RouteDef } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { HttpError } from "./errors";

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "local";
}

/** Rate-limit every non-GET route: auth routes on RL_AUTH, the rest on RL_WRITE. */
export function rateLimitWrites(def: RouteDef): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (def.method === "GET") return next();
    const limiter = def.area === "auth" ? c.env.RL_AUTH : c.env.RL_WRITE;
    if (limiter) {
      const who = c.get("user")?.id ?? clientIp(c.req.raw);
      const { success } = await limiter.limit({ key: `${def.area}:${who}` });
      if (!success) throw new HttpError("rate_limited", "Slow down a little and try again.");
    }
    return next();
  };
}

/** Verify a Cloudflare Turnstile token. Local dev without a secret passes. */
export async function verifyTurnstile(env: Env, token: string, ip: string): Promise<void> {
  if (!env.TURNSTILE_SECRET) {
    if (env.ENVIRONMENT === "local") return;
    throw new HttpError("unavailable", "Bot protection is not configured");
  }
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  if (ip !== "local") form.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = (await res.json()) as { success?: boolean };
  if (!data.success) throw new HttpError("turnstile_failed", "Bot check failed. Please try again.");
}

/** Only allow same-site relative redirects ("/x", never "//x" or "https://…"). */
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
