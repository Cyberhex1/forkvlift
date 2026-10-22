---
type: workflow
title: Cloudflare's Pages-to-Workers migration prompt
summary: Cloudflare publishes a ready-made instruction file you hand to an AI coding agent to move a Cloudflare Pages project onto Workers. Here's how to use it.
license: See source
testedWith: []
---
Cloudflare publishes an official prompt for this migration at [developers.cloudflare.com/workers/prompts/pages-to-workers.txt](https://developers.cloudflare.com/workers/prompts/pages-to-workers.txt). It's a plain-text instruction file written for coding agents, so you don't have to explain the Pages and Workers differences yourself.

## How to use it

1. Commit or stash everything first, so the migration is one reviewable diff.
2. Give your agent the file: paste its contents, or ask it to fetch the URL above if it can browse.
3. Add one line about your project, for example "This is a Vite + React app on Pages with two Pages Functions."
4. Let it make the changes, then read the diff, especially the new Wrangler config.
5. Run the app locally with `wrangler dev` and deploy to a preview before touching production.

## Where to read more

The prompt sits alongside Cloudflare's written migration guide in the Workers docs. Read the guide if the agent's changes surprise you; the prompt follows it.

The prompt itself belongs to Cloudflare. This page only links to it and describes how to use it.
