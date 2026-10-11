import type { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** public = anyone; user = signed in; admin = Cloudflare Access + admin role. */
export type AuthLevel = "public" | "user" | "admin";

/**
 * json      — JSON body validated by `response`
 * redirect  — 302 to somewhere else (OAuth hops)
 * websocket — upgrade; events are typed separately (ChatServerEvent etc.)
 * text      — non-JSON body (RSS, SVG badge)
 */
export type RouteKind = "json" | "redirect" | "websocket" | "text";

/**
 * Which worker route file implements the endpoint. Ownership of those files
 * follows the task board (see OWNERS.json), not this field.
 */
export type RouteArea =
  | "meta"
  | "auth"
  | "categories"
  | "projects"
  | "uploads"
  | "users"
  | "me"
  | "social"
  | "studio"
  | "messages"
  | "notifications"
  | "forum"
  | "chat"
  | "resources"
  | "reports"
  | "requests"
  | "growth"
  | "showcases"
  | "feeds"
  | "admin";

export interface RouteDef {
  method: HttpMethod;
  /** Hono-style path, e.g. /api/projects/:slug */
  path: string;
  auth: AuthLevel;
  kind: RouteKind;
  area: RouteArea;
  summary: string;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  response?: z.ZodType;
}

export function route<const D extends RouteDef>(def: D): D {
  return def;
}

type ParamsOf<R> = R extends { params: infer P extends z.ZodType } ? { params: z.output<P> } : { params?: undefined };
type QueryOf<R> = R extends { query: infer Q extends z.ZodType } ? { query?: Partial<z.output<Q>> } : { query?: undefined };
type BodyOf<R> = R extends { body: infer B extends z.ZodType } ? { body: z.input<B> } : { body?: undefined };

/** What a caller passes for a route. */
export type RouteInput<R> = ParamsOf<R> & QueryOf<R> & BodyOf<R>;

/** What a route returns (parsed JSON). */
export type RouteOutput<R> = R extends { response: infer S extends z.ZodType } ? z.output<S> : unknown;

/** Validated input as the worker handler sees it. */
export interface ParsedInput<R> {
  params: R extends { params: infer P extends z.ZodType } ? z.output<P> : Record<string, never>;
  query: R extends { query: infer Q extends z.ZodType } ? z.output<Q> : Record<string, never>;
  body: R extends { body: infer B extends z.ZodType } ? z.output<B> : undefined;
}

/** Fill :params into a path. */
export function buildPath(path: string, params: Record<string, string | number> | undefined): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined) throw new Error(`Missing path param "${key}" for ${path}`);
    return encodeURIComponent(String(value));
  });
}

/** Serialize a query object: arrays → comma lists, booleans → "true"/"false", nullish dropped. */
export function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
