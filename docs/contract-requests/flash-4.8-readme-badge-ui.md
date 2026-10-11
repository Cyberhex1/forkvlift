# Contract request: README badge copy box on Project Panel

- **From:** flash
- **For task:** 4.8
- **Status:** done (Opus). The copy box is in the panel's Fork lineage section, shown to the project's author for licensed projects (`catalog/ReadmeBadge.tsx`).

## What I need

A "Badge for your README" copy box on the project focus panel (`apps/web/src/features/catalog/ProjectPanel.tsx`, owned by Sol).

## Why

Task 4.8 adds live SVG badges for repositories (`/api/badge/:slug`). Authors should easily copy the markdown snippet directly from their project panel.

## Proposed shape

Markdown snippet to copy:
```markdown
[![ForkLift](https://forkvlift.com/api/badge/${project.slug})](https://forkvlift.com/p/${project.slug})
```

Rendered as a small copyable snippet box or action button in the project panel header/lineage section.

## Workaround until then

The `/api/badge/:slug` backend route and SVG renderer are fully working and tested in `apps/worker/src/routes/feeds.ts`.
