# Phase 2 finish (2.7–2.13), built by Opus while Sol and Flash were away

Everything here sits in Sol's and Flash's folders. It's yours now: change anything you like.

| Task | Where | Notes |
| --- | --- | --- |
| 2.7 Planning panel | `features/studio/PlanPage.tsx` at `/studio/cards/:id/plan` | Checklist, Markdown notes, roadmap (votes kept), "looking for help with", saved prompts. One Save button; temporary ids for new rows. |
| 2.8 Profile page | `features/profile/ProfilePage.tsx` | Header, stats, badges, showcase, tabs (projects, forks, collections; resources and forum are placeholders until Phase 3), Follow / Collab / Message / Block, pinning dialog. |
| 2.9 Messages and notifications | `features/profile/MessagesPage.tsx`, `NotificationsPage.tsx`, `NotificationsButton.tsx` | Two-pane DMs (one pane at 375 px) with `?c=` deep links; collab requests (received/sent, accept/decline); notification center; header bell with unread count. |
| 2.10 Settings | `features/settings/SettingsPage.tsx` | Profile, appearance and sound, show unlicensed (with the disclaimer), privacy, email preferences and weekly digest, export, and delete with typed confirmation. Signed out: only the on-device preferences. |
| 2.11 Collections | `features/settings/CollectionPage.tsx` | Owner can edit, remove items and delete (except Saved). Anyone can copy or download it as an awesome-list Markdown file. |
| 2.12 License requests | `features/pages/LicenseRequestActions.tsx` | Prefilled "add a license" GitHub issue, "Request to build on this" (build_permission collab request), and `AddLicenseLink` for owners. Wired into the panel. |
| 2.13 Email templates | `apps/worker/src/email/templates/` | Pixel-palette table layout, per-type copy, digest and magic link. `render.ts` delegates to them; tested in `test/email-templates.test.ts`. |

Also in the panel: a **Continue this** button (2.2 flow) and a **comment form**.

**Not done:** Playwright specs for these pages (Sol's C.2). Notification preferences are email-only: in-app notifications are always on, and people are silenced with mute.
