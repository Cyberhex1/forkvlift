# ForkLift MCP server (task 4.2)

Coding agents can search the catalog, ask "has this been built?", and pull a project's license, lineage and a starter prompt.

- **Endpoint:** `https://forklift.stream/api/mcp` (preview: `https://forkvlift-preview.kdlindsey25.workers.dev/api/mcp`)
- **Transport:** Streamable HTTP, stateless, JSON responses. Send one JSON-RPC 2.0 message per POST.
- **Auth:** none; it's read-only and free. Limited to 60 requests a minute per IP.

## Connect

Claude Code:

```
claude mcp add --transport http forklift https://forklift.stream/api/mcp
```

Other clients: add a remote/HTTP MCP server with the URL above.

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `search_projects` | `query`, optional `limit` (1–20) | Matching projects: slug, link, repo, license, stage, stars |
| `has_this_been_built` | `idea` | A verdict plus up to 5 close projects to fork instead |
| `get_project` | `slug` (or a `/p/<slug>` URL) | License and what it allows, clone command, lineage, what works / what's missing, safety flags, starter prompt |

Search uses semantic matching (Workers AI + Vectorize) with keyword fallback. Unlicensed projects never appear in search. If you ask for one by slug, you get a no-license warning and no clone command.
