# Contract request: Header notification slot

- **From:** sol
- **For task:** 2.9
- **Status:** done (Opus, contracts PR after #27)

## What I need
Mount an exported `NotificationsButton` from `apps/web/src/features/profile/NotificationsButton.tsx` in `apps/web/src/app/Header.tsx`, next to MusicButton and ProfileMenu. Preserve the 375 px layout and keyboard order. The component takes no props and uses the shell's session/query providers.

## Why
Task 2.9 requires a header unread badge, and Header is owned by Opus.

## Proposed shape
```tsx
import { NotificationsButton } from "../features/profile/NotificationsButton";
// Header's account controls:
<NotificationsButton />
```

## Workaround until then
Provide the component and a notification link/badge on profile-owned pages. Opus can mount it once the 2.9 branch is ready; it does not need new API fields.
