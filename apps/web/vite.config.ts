/**
 * One Vite config builds the web app AND the Worker (Cloudflare Vite plugin).
 *
 *   pnpm dev                 → local, fixtures ON, port by worktree (8787/8788/8789)
 *   vite build --mode preview|production → that wrangler env, fixtures compiled out
 */
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { SITE_NAME } from "../../packages/shared/src/constants.ts";
import { devPorts } from "../../scripts/dev-ports.mjs";

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    if (mode !== "preview" && mode !== "production") throw new Error(`Unknown build mode "${mode}" (use preview or production)`);
  }
  const port = devPorts().web;

  return {
    plugins: [react(), tailwindcss(), cloudflare({ configPath: "../worker/wrangler.jsonc" }), siteName()],
    define: {
      // Fixtures exist only in the dev server. Every build drops them.
      __FIXTURES__: JSON.stringify(command === "serve"),
    },
    server: { host: "127.0.0.1", port, strictPort: true },
    preview: { host: "127.0.0.1", port, strictPort: true },
  };
});

function siteName(): Plugin {
  return {
    name: "forkvlift-site-name",
    transformIndexHtml: (html) => html.replaceAll("%SITE_NAME%", SITE_NAME),
  };
}
