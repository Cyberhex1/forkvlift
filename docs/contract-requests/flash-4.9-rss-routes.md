# Contract request: Per-category and per-user RSS routes

- **From:** flash
- **For task:** 4.9
- **Status:** done (Opus). Paths are `/api/feeds/category/:slug/projects.rss` and `/api/feeds/users/:username/projects.rss` (a `.rss` suffix glued to a route parameter does not route cleanly).

## What I need

Two dedicated RSS feed routes in `packages/shared/src/api/routes.ts`:
1. `categoryFeed`: `GET /api/feeds/category/:slug.rss` (kind: "text", area: "feeds")
2. `userFeed`: `GET /api/feeds/users/:username.rss` (kind: "text", area: "feeds")

## Why

Allows RSS readers to subscribe to clean, dedicated URLs for specific categories or creator portfolios, in addition to the main `projectsRss` feed (`/api/feeds/projects.rss?category=...&user=...`).

## Proposed shape

```ts
  categoryRss: route({
    method: "GET", path: "/api/feeds/category/:slug.rss", auth: "public", kind: "text", area: "feeds",
    summary: "RSS: new projects in category",
    params: SlugParams,
  }),
  userRss: route({
    method: "GET", path: "/api/feeds/users/:username.rss", auth: "public", kind: "text", area: "feeds",
    summary: "RSS: new projects by user",
    params: z.object({ username: Username }),
  }),
```

## Workaround until then

`projectsRss` in `apps/worker/src/routes/feeds.ts` handles `/api/feeds/projects.rss` with optional `?category=<slug>` and `?user=<username>` query filters, serving valid RSS 2.0.
