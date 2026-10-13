---
type: prompt_template
title: AGENTS.md starter for your repo
summary: A short AGENTS.md template that tells any coding agent how to install, run, test and change your project, following the open AGENTS.md convention.
license: CC0-1.0
testedWith: [{"tool":"Codex","model":null,"version":null},{"tool":"Cursor","model":null,"version":null}]
---
[AGENTS.md](https://agents.md) is an open convention: a plain Markdown file at the root of your repo that coding agents read before working, like a README written for them. Many agents pick it up automatically; for Claude Code, point your `CLAUDE.md` at it or copy it there.

Copy this into `AGENTS.md` and replace the brackets. Keep it short; agents follow short files better.

```markdown
# AGENTS.md

## Project
[One sentence on what this app does and who uses it.]

## Setup
- Install: `[pnpm install]`
- Run locally: `[pnpm dev]`, then open [http://localhost:5173]
- Tests: `[pnpm test]`; run them before saying a change is done.

## Layout
- `[src/routes/]` [what lives here]
- `[src/lib/]` [what lives here]

## Rules
- Make the smallest change that does the job; don't reformat unrelated files.
- Never commit secrets. Config comes from `[.env.example]`.
- Ask before adding a dependency.
- [Anything that has bitten you before, e.g. "dates are stored as UTC milliseconds".]
```

## Tip

Every time you correct an agent for the same mistake twice, add a line to Rules.
