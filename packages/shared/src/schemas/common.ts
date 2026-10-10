import { z } from "zod";
import { LIMITS } from "../constants";

/** ISO-8601 timestamp string, always UTC. */
export const IsoDate = z.string().describe("ISO-8601 timestamp (UTC)");
export const Id = z.string().min(1).max(64);
export const Slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers and dashes");
export const Username = z
  .string()
  .min(LIMITS.usernameMin)
  .max(LIMITS.usernameMax)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, "letters, numbers and dashes");
export const Url = z.url({ protocol: /^https?$/ });
export const Markdown = z.string().max(50_000);

export const Cursor = z.string().max(200).nullable();

export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

/** Paginated list envelope. */
export function page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: Cursor });
}

/** Query-string helpers: lists are comma-separated, booleans are "true"/"false". */
export function csv<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v),
    z.array(item),
  );
}
export const QueryBool = z.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, z.boolean());
export const QueryLimit = z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(LIMITS.pageSizeDefault);

export const PageQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: QueryLimit.optional(),
});
