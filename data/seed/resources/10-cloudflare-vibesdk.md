---
type: starter_repo
title: Cloudflare VibeSDK
summary: Cloudflare's open source platform for running your own "describe an app and an agent builds it" service on Workers.
license: MIT
testedWith: []
---
[cloudflare/vibesdk](https://github.com/cloudflare/vibesdk) (MIT) is the code behind Cloudflare's own AI app builder. You describe an app, an agent plans it, writes the files, deploys a preview and iterates with you.

## When it's useful

- You want to run a vibe-coding builder for your team or community instead of using a hosted one.
- You want to see how a real agentic builder handles planning, previews and error fixing.

## Getting started

The README has a one-click "Deploy to Cloudflare Workers" button and a full setup guide. Production previews need a Workers Paid plan with Workers for Platforms, plus a Cloudflare API token, credentials for at least one model provider and a custom domain. You can try the hosted version at [build.cloudflare.dev](https://build.cloudflare.dev) before deciding to run your own.
