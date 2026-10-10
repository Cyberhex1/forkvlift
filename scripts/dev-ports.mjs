// Dev server ports per worktree so the three agents never collide.
//   main / opus → 8787 (admin 8790)
//   sol         → 8788 (admin 8791)
//   flash       → 8789 (admin 8792)
// Override with PORT=xxxx.
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFFSETS = { opus: 0, sol: 1, flash: 2 };

export function devPorts() {
  const offset = OFFSETS[path.basename(repoRoot).toLowerCase()] ?? 0;
  const web = Number(process.env.PORT) || 8787 + offset;
  return { web, admin: web + 3 };
}
