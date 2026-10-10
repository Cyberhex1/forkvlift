import { z } from "zod";

export const ErrorCode = z.enum([
  "bad_request",
  "invalid_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "turnstile_failed",
  "not_implemented",
  "unavailable",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Every non-2xx JSON response has this shape. */
export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const ERROR_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  turnstile_failed: 403,
  not_implemented: 501,
  unavailable: 503,
  internal: 500,
};
