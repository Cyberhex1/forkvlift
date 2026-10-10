# ForkLift Project Submission Format

Every project in the open catalog data mirror is stored as an individual JSON file: `projects/<slug>.json`.

## Schema Specification

The full JSON schema is defined in [`project.schema.json`](./project.schema.json).

### Required Fields

| Field | Type | Description |
| --- | --- | --- |
| `slug` | `string` | Unique URL-friendly slug (`a-z0-9-`, 2–60 chars). |
| `name` | `string` | Human-readable project title (1–80 chars). |
| `tagline` | `string` | One-sentence summary (1–140 chars). |
| `description` | `string` | Full markdown description (1–5000 chars). |
| `repoUrl` | `string` | Public GitHub repository URL (`https://github.com/owner/repo`). |
| `categorySlug` | `string` | Valid category slug matching `categories.json`. |
| `stage` | `enum` | `"finished"`, `"wip"`, or `"adoption"`. |

### Optional Fields

| Field | Type | Description |
| --- | --- | --- |
| `licenseSpdx` | `string \| null` | SPDX identifier (e.g. `"MIT"`, `"Apache-2.0"`) or `null` if unlicensed. |
| `liveUrl` | `string \| null` | Live deployment or preview URL. |
| `releaseUrl` | `string \| null` | Packaged binaries, releases, or app store links. |
| `tags` | `string[]` | Up to 10 keyword tags for search indexing. |
| `stack` | `string[]` | Technologies used (e.g. `["React", "Cloudflare Workers"]`). |
| `platforms` | `string[]` | Supported platforms (`["web", "cli", "mobile", "desktop"]`). |
| `difficulty` | `enum \| null` | `"beginner"`, `"intermediate"`, `"advanced"`, or `null`. |
| `aiTools` | `string[]` | AI assistants used (`["Claude Code", "Cursor", "Antigravity"]`). |
| `buildTime` | `string \| null` | Duration to build (`"4 hours"`, `"2 days"`). |
| `aiInvolvement` | `enum \| null` | `"high"`, `"medium"`, `"low"`, or `null`. |
| `isTemplate` | `boolean` | `true` if intended as a reusable template. |
| `replaces` | `string[]` | Paid tools replaced (e.g. `["Notion", "Trello"]`). |
| `whatWorks` | `string \| null` | For WIP projects: functional components. |
| `whatsMissing` | `string \| null` | For WIP projects: missing features / bugs. |
| `lookingForHelp` | `string \| null` | Specific collaboration requests. |

## Example `projects/linkhub.json`

```json
{
  "slug": "personal-linkhub-11ty",
  "name": "Personal LinkHub 11ty",
  "tagline": "Vibe-coded personal link hub with clean Tailwind aesthetic",
  "description": "A minimal link-in-bio style portfolio website built with Eleventy and Tailwind CSS. Fully responsive with dark mode.",
  "repoUrl": "https://github.com/KaramelBytes/personal-linkhub-11ty",
  "categorySlug": "tools-and-utilities",
  "stage": "finished",
  "licenseSpdx": "MIT",
  "liveUrl": "https://linkhub.example.com",
  "releaseUrl": null,
  "tags": ["link-in-bio", "eleventy", "tailwind", "portfolio"],
  "stack": ["11ty", "TailwindCSS"],
  "platforms": ["web"],
  "difficulty": "beginner",
  "aiTools": ["Cursor", "v0"],
  "buildTime": "2 hours",
  "aiInvolvement": "high",
  "isTemplate": true,
  "replaces": ["Linktree"],
  "whatWorks": null,
  "whatsMissing": null,
  "lookingForHelp": null
}
```
