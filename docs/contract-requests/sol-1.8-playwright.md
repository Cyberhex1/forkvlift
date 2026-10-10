# Contract request: Playwright test runner and CI wiring

- **From:** sol
- **For task:** 1.8 / C.2
- **Status:** open

## What I need

Add the official `playwright` development dependency at the root, a `test:e2e` script invoking `playwright test -c e2e/playwright.config.ts`, and CI browser installation/test execution. The bundled local runtime provides playwright 1.62.1; use the approved compatible version on main.

## Why

The Sol briefing requires end-to-end coverage for each flow, but the skeleton has only e2e/README.md and no test runner dependency or CI command. Dependency and root configuration ownership belongs to Opus.

## Proposed shape

```json
{ "scripts": { "test:e2e": "playwright test -c e2e/playwright.config.ts" } }
```

## Workaround until then

Tests and config live under Sol-owned e2e/. Run them locally using the existing Codex bundled Playwright package through an ignored e2e/node_modules/playwright junction; no npm dependency or root config is edited by Sol.


