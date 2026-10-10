/**
 * Admin console (curation queue, moderation). In dev, /api is proxied to this
 * worktree's main dev server, so run `pnpm dev` first.
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { devPorts } from "../../scripts/dev-ports.mjs";

const ports = devPorts();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: ports.admin,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${ports.web}` },
  },
});
