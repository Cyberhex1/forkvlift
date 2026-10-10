#!/usr/bin/env node
// Fails if any build output contains dev fixtures. Run after `pnpm build`.
import fs from "node:fs";
import path from "node:path";

const MARKERS = ["__FORKVLIFT_DEV_FIXTURE__", "fx_user_ada", "/api/dev/login"];
const DIRS = ["apps/web/dist", "apps/admin/dist"];

let scanned = 0;
const hits = [];
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!/\.(m?js|cjs|html|json|map|css)$/.test(file)) continue;
    scanned++;
    const text = fs.readFileSync(file, "utf8");
    for (const m of MARKERS) if (text.includes(m)) hits.push(`${file}: contains "${m}"`);
  }
}

if (!scanned) {
  console.error("check-no-fixtures: no build output found. Run `pnpm build` first.");
  process.exit(1);
}
if (hits.length) {
  console.error("Dev fixtures leaked into a build:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`check-no-fixtures: ${scanned} files clean.`);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}
