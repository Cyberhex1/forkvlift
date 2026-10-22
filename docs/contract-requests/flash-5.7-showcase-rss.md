# Contract request: Showcase RSS route and UI Art package export

- **From:** flash
- **For task:** 5.7
- **Status:** open

## What I need

1. In `packages/shared/src/api/routes.ts`:
   A typed route definition for `showcasesRss`:
   `GET /api/feeds/showcases.rss` (kind: "text", area: "feeds", auth: "public")
   Query parameters: `category` (Slug.optional()), `user` (Username.optional()), `kind` (ShowcaseKind.optional()), `tool` (z.string().max(40).optional()).

2. In `packages/ui/package.json`:
   Add `"./art": "./src/art/index.ts"` to `exports`.

## Why

Task 5.7 builds showcase art, OG templates, and an RSS feed for showcases.
- The RSS feed `/api/feeds/showcases.rss` is implemented in `apps/worker/src/routes/feeds.ts`. Adding `showcasesRss` to the shared route contract ensures typed client callers and the contract verification suite include it.
- `packages/ui/src/art/` contains the `ShowcaseBadge`, `ClosedSourceBadge`, `ShowcaseEmptyArt`, `ShowcaseEmptyState`, and `renderShowcaseOgSvg` OG template. Exporting `./art` allows Sol and Opus to cleanly import showcase art components as `@forkvlift/ui/art`.

## Proposed shape

```ts
  showcasesRss: route({
    method: "GET", path: "/api/feeds/showcases.rss", auth: "public", kind: "text", area: "feeds",
    summary: "RSS: new showcases (?category=, ?user=, ?kind=, ?tool= filters)",
    query: z.object({
      category: Slug.optional(),
      user: Username.optional(),
      kind: ShowcaseKind.optional(),
      tool: z.string().max(40).optional(),
    }),
  }),
```

## Workaround until then

- The worker routes `/api/feeds/showcases.rss` directly in `apps/worker/src/routes/feeds.ts`.
- Components in `packages/ui/src/icons` re-export the badge and empty icons (`ShowcaseBadgeIcon`, `ClosedSourceBadgeIcon`, `ShowcaseEmptyIcon`), and internal features can import from relative art paths or icons.
