/**
 * Task 4.3: the public, read-only API at /api/v1. Works without a key (60
 * requests a minute per IP); a key from Settings → API keys raises that to
 * 600 a minute. Unlicensed projects are excluded unless asked for.
 */
import type { Context, Hono } from "hono";
import { z } from "zod";
import { buildStarterPrompt, ProjectSort, ProjectStage, type ProjectCard, type ProjectDetail } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { keyFromRequest } from "../core/apikeys";
import { errorResponse } from "../core/http";
import { HttpError } from "../core/errors";
import { getProjectDetail } from "../core/projects/detail";
import { listProjects } from "../core/projects/list";
import { findSimilar } from "../core/projects/semantic";
import { clientIp } from "../core/security";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization", "access-control-allow-methods": "GET, OPTIONS" };

type C = Context<AppEnv>;

async function gate(c: C): Promise<void> {
  const key = await keyFromRequest(c.env.DB, c.req.raw);
  if (c.env.DISABLE_RATE_LIMITS === "true") return;
  const limiter = key ? c.env.RL_API_KEY : c.env.RL_API;
  if (!limiter) return;
  const { success } = await limiter.limit({ key: key ? `key:${key.id}` : `ip:${clientIp(c.req.raw)}` });
  c.header("x-ratelimit-limit", key ? "600" : "60");
  if (!success) throw new HttpError("rate_limited", key ? "Rate limit reached (600 requests a minute)." : "Rate limit reached (60 requests a minute). Add an API key for more.");
}

const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const ListQuery = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(60).optional(),
  stage: ProjectStage.optional(),
  sort: ProjectSort.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(200).optional(),
  include_unlicensed: bool.optional(),
});

export const publicCard = (p: ProjectCard, origin: string) => ({
  slug: p.slug,
  name: p.name,
  tagline: p.tagline,
  description: p.description,
  url: `${origin}/p/${p.slug}`,
  repo_url: p.repoUrl,
  live_url: p.liveUrl,
  license: p.license ? { spdx: p.license.spdx, name: p.license.name, summary: p.license.summary } : null,
  stage: p.stage,
  category: p.category.slug,
  tags: p.tags,
  replaces: p.replaces,
  stars: p.stars,
  forks: p.forks,
  upvotes: p.upvotes,
  author: p.author ? p.author.username : null,
  thumbnail_url: p.thumbnailUrl,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const publicDetail = (p: ProjectDetail, origin: string) => ({
  ...publicCard(p, origin),
  clone_command: p.license ? p.cloneCommand : null,
  stack: p.stack,
  platforms: p.platforms,
  forked_from: p.forkedFrom ? p.forkedFrom.slug : null,
  notable_forks: p.notableForks.map((f) => f.slug),
  what_works: p.wipStatus?.whatWorks || null,
  whats_missing: p.wipStatus?.whatsMissing || null,
  looking_for_help: p.lookingForHelp,
  health_score: p.health.score,
  safety_flags: p.safety.flags,
  starter_prompt: buildStarterPrompt(p, origin),
});

function handle(fn: (c: C) => Promise<unknown>) {
  return async (c: C) => {
    try {
      await gate(c);
      const data = await fn(c);
      return c.json(data, 200, { ...CORS, "cache-control": "public, max-age=60" });
    } catch (err) {
      const res = err instanceof HttpError ? errorResponse(c, err.code, err.message, err.details) : (console.error(err), errorResponse(c, "internal", "Something went wrong"));
      for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
      return res;
    }
  };
}

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError("invalid_request", r.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join("; "));
  return r.data;
}

export function registerV1(app: Hono<AppEnv>) {
  app.options("/api/v1/*", () => new Response(null, { status: 204, headers: CORS }));

  app.get(
    "/api/v1/projects",
    handle(async (c) => {
      const q = parse(ListQuery, c.req.query());
      const page = await listProjects(
        c.env.DB,
        { q: q.q, category: q.category ? [q.category] : undefined, stage: q.stage ? [q.stage] : undefined, sort: q.sort, limit: q.limit ?? 30, cursor: q.cursor, showUnlicensed: q.include_unlicensed ?? false },
        null,
      );
      return { data: page.items.map((p) => publicCard(p, c.env.SITE_ORIGIN)), next_cursor: page.nextCursor };
    }),
  );

  app.get(
    "/api/v1/projects/:slug",
    handle(async (c) => ({ data: publicDetail(await getProjectDetail(c.env.DB, c.req.param("slug") ?? "", null), c.env.SITE_ORIGIN) })),
  );

  app.get(
    "/api/v1/search",
    handle(async (c) => {
      const q = parse(z.object({ q: z.string().trim().min(3).max(300), limit: z.coerce.number().int().min(1).max(20).optional() }), c.req.query());
      const items = await findSimilar(c.env, q.q, q.limit ?? 10, null);
      return { data: items.map((p) => publicCard(p, c.env.SITE_ORIGIN)) };
    }),
  );

  app.get(
    "/api/v1/categories",
    handle(async (c) => {
      const { results } = await c.env.DB.prepare(`SELECT slug, name, parent_slug, description FROM categories WHERE status = 'active' ORDER BY position`).all();
      return { data: results };
    }),
  );
}
