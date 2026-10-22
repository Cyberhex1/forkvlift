#!/usr/bin/env node
// Turns data/seed/resources/*.md into SQL that adds the starter Resources library.
// Each resource is posted under an existing account (by username). Re-running is
// safe: resources whose slug already exists are skipped.
//
//   node scripts/seed/resources.mjs --author Cyberhex1 > resources.sql
//   cd apps/worker && npx wrangler d1 execute forkvlift-preview --remote --env preview --file ../../resources.sql
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TYPES = ["skill", "system_prompt", "prompt_template", "workflow", "mcp_config", "starter_repo"];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(repoRoot, "data/seed/resources");

const args = process.argv.slice(2);
const author = args[args.indexOf("--author") + 1];
if (!args.includes("--author") || !author) {
  console.error("Usage: node scripts/seed/resources.mjs --author <username>");
  process.exit(1);
}

// Same rules as apps/worker/src/core/ids.ts and resources.ts.
const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const executable = (md) => /```\s*(bash|sh|shell|zsh|powershell|ps1|pwsh|cmd|bat|python|py|js|javascript|ts|typescript|node)\b/i.test(md);
const newId = () => "res_" + [...crypto.randomBytes(16)].map((b) => "0123456789abcdefghijklmnopqrstuvwxyz"[b % 36]).join("");
const q = (v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

export function parse(file, text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = Object.fromEntries(
    m[1].split(/\r?\n/).map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  const r = { ...meta, testedWith: JSON.parse(meta.testedWith || "[]"), bodyMd: m[2].trim() + "\n" };
  const errors = [];
  if (!TYPES.includes(r.type)) errors.push(`type must be one of ${TYPES.join(", ")}`);
  if (!r.title || r.title.length < 3 || r.title.length > 120) errors.push("title must be 3-120 characters");
  if (!r.summary || r.summary.length > 300) errors.push("summary must be 1-300 characters");
  if (!r.license || r.license.length > 60) errors.push("license must be 1-60 characters");
  if (!Array.isArray(r.testedWith) || r.testedWith.some((t) => typeof t.tool !== "string" || !("model" in t) || !("version" in t)))
    errors.push("testedWith must be [{tool, model, version}]");
  if (errors.length) throw new Error(`${file}: ${errors.join("; ")}`);
  return r;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
const start = Date.now();
const out = [`-- ForkLift starter resources (${files.length}), author @${author}`];
files.forEach((file, i) => {
  const r = parse(file, fs.readFileSync(path.join(dir, file), "utf8"));
  const slug = slugify(r.title);
  // Earlier files get later timestamps so they sort first among equal scores.
  const at = start - i * 1000;
  out.push(
    `INSERT INTO resources (id, slug, type, title, summary, body_md, author_id, license, tested_with, files, has_executable_code, scan_flags, created_at, updated_at)
SELECT ${[newId(), slug, r.type, r.title, r.summary, r.bodyMd].map(q).join(", ")}, u.id, ${[r.license, JSON.stringify(r.testedWith), "[]", executable(r.bodyMd) ? 1 : 0, "[]", at, at].map(q).join(", ")}
FROM users u WHERE u.username = ${q(author)} AND NOT EXISTS (SELECT 1 FROM resources WHERE slug = ${q(slug)});`,
  );
});
console.log(out.join("\n"));
