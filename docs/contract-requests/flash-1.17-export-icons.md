# Contract request: Export pixel icons from @forkvlift/ui

- **From:** flash
- **For task:** 1.17
- **Status:** done

## What I need

Export pixel icons from `@forkvlift/ui` in `packages/ui/src/index.ts` (or add `./icons` to `packages/ui/package.json` exports).

## Why

Flash created pixel art glyphs and icons (`EmptyCrateIcon`, `BrokenForkliftIcon`, `SearchEmptyIcon`, `WarningShieldIcon`) in `packages/ui/src/icons/` as assigned in OWNERS.json. Consumers in `apps/web` need to import them from `@forkvlift/ui`.

## Proposed shape

In `packages/ui/src/index.ts`:
```ts
export * from "./icons";
```
Or in `packages/ui/package.json`:
```json
"exports": {
  ".": "./src/index.ts",
  "./icons": "./src/icons/index.ts",
  "./tokens.css": "./src/tokens.css"
}
```

## Workaround until then

`apps/web/src/features/pages/States.tsx` includes inline SVG wrappers or fallback pixel SVG components matching the exact pixel art tokens so nothing is blocked.
