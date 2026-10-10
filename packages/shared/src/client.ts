/**
 * Typed fetch client for the contract in api/routes.ts. Framework-free so the web
 * app, the admin console and scripts can all use it.
 *
 *   const project = await api.call("getProject", { params: { slug } });
 */
import { ApiErrorBody, type ErrorCode } from "./api/errors";
import { buildPath, buildQuery, type RouteInput, type RouteOutput } from "./api/define";
import { ROUTE_DEFS, type RouteId, type Routes } from "./api/routes";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClientOptions {
  /** Origin to prefix (empty = same origin). */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Validate responses against the contract (on by default in dev builds). */
  validateResponses?: boolean;
}

export function urlFor<K extends RouteId>(id: K, input?: RouteInput<Routes[K]>, baseUrl = ""): string {
  const def = ROUTE_DEFS[id]!;
  const i: { params?: Record<string, string>; query?: Record<string, unknown> } = (input as unknown as object | undefined) ?? {};
  return baseUrl + buildPath(def.path, i.params) + buildQuery(i.query);
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "";
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function call<K extends RouteId>(
    id: K,
    ...args: object extends RouteInput<Routes[K]> ? [input?: RouteInput<Routes[K]>, init?: RequestInit] : [input: RouteInput<Routes[K]>, init?: RequestInit]
  ): Promise<RouteOutput<Routes[K]>> {
    const [input, init] = args;
    const def = ROUTE_DEFS[id]!;
    const body = (input as unknown as { body?: unknown } | undefined)?.body;
    const res = await doFetch(urlFor(id, input, baseUrl), {
      method: def.method,
      headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });

    const text = await res.text();
    const json: unknown = text ? safeJson(text) : null;

    if (!res.ok) {
      const parsed = ApiErrorBody.safeParse(json);
      if (parsed.success) {
        throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
      }
      throw new ApiError(res.status, res.status >= 500 ? "internal" : "bad_request", res.statusText || "Request failed");
    }

    if (options.validateResponses && def.response) {
      const parsed = def.response.safeParse(json);
      if (!parsed.success) {
        console.warn(`[api] ${id} response does not match the contract`, parsed.error.issues);
      }
    }
    return json as RouteOutput<Routes[K]>;
  }

  return { call, url: <K extends RouteId>(id: K, input?: RouteInput<Routes[K]>) => urlFor(id, input, baseUrl) };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
