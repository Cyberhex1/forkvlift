# ForkLift public API (task 4.3)

A read-only JSON API at `https://forklift.stream/api/v1`. It's free, and CORS is open, so you can call it from a browser.

## Keys and limits

- **Without a key:** 60 requests a minute per IP.
- **With a key:** 600 requests a minute per key. Create keys in **Settings → API keys** (up to 5). The secret is shown once; only a hash is stored.
- **Sending a key:** `Authorization: Bearer fl_…`. A wrong or revoked key gets `401` rather than falling back to anonymous.
- **Going over the limit:** you get `429` with `{ "error": { "code": "rate_limited", … } }`.

## Endpoints

| Method and path | Query | Returns |
| --- | --- | --- |
| `GET /api/v1/projects` | `q`, `category`, `stage` (`finished`/`wip`/`adoption`), `sort`, `limit` (≤100), `cursor`, `include_unlicensed` | `{ data: Project[], next_cursor }` |
| `GET /api/v1/projects/:slug` | | `{ data: ProjectDetail }`: clone command (licensed only), stack, lineage, what works / what's missing, health score, safety flags, starter prompt |
| `GET /api/v1/search` | `q` (3–300 chars), `limit` (≤20) | `{ data: Project[] }`, matched by meaning (semantic search) |
| `GET /api/v1/categories` | | `{ data: Category[] }` |

Projects without a license are left out of lists and search unless you pass `include_unlicensed=true`. Their detail never includes a clone command. Respect licenses and credit authors when you build on a project.

Coding agents can use the MCP endpoint instead: see [mcp.md](mcp.md).

## Example

```
curl -H "Authorization: Bearer $FORKLIFT_KEY" "https://forklift.stream/api/v1/search?q=habit%20tracker"
```
