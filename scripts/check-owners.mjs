#!/usr/bin/env node
// Ownership check: fails if a PR edits files outside its author's folders.
//
//   node scripts/check-owners.mjs --base origin/main --branch sol/1.8-project-card
//   node scripts/check-owners.mjs --files a.ts,b.ts --agent sol      (manual)
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith("--") ? [...acc, [cur.slice(2), all[i + 1]]] : acc), []),
);
const owners = JSON.parse(fs.readFileSync(new URL("../OWNERS.json", import.meta.url), "utf8"));

export function agentForBranch(branch = "") {
  const b = branch.replace(/^refs\/heads\//, "");
  if (/^(agent\/sol|sol\/)/.test(b) || b === "agent/sol") return "sol";
  if (/^(agent\/flash|flash\/)/.test(b) || b === "agent/flash") return "flash";
  return "opus";
}

function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (ch === "*") re += "[^/]*";
    else re += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

const rules = owners.rules.map((r) => ({ ...r, re: globToRegex(r.pattern), weight: r.pattern.replace(/\*.*$/, "").length }));
const shared = owners.shared.map(globToRegex);

export function ownerOf(file) {
  const matches = rules.filter((r) => r.re.test(file)).sort((a, b) => b.weight - a.weight);
  return matches[0]?.owner ?? "opus";
}

const agent = args.agent ?? agentForBranch(args.branch ?? process.env.GITHUB_HEAD_REF ?? "");
let files;
if (args.files) files = args.files.split(",").filter(Boolean);
else {
  const base = args.base ?? "origin/main";
  files = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" }).split("\n").filter(Boolean);
}

// Opus integrates and owns everything unassigned; it may still touch others' folders when merging.
if (agent === "opus") {
  console.log(`check-owners: ${files.length} files, author opus (integrator): ok`);
  process.exit(0);
}

const violations = files.filter((f) => !shared.some((re) => re.test(f)) && ownerOf(f) !== agent);
if (violations.length) {
  console.error(`check-owners: ${agent} edited files it doesn't own:\n` + violations.map((f) => `  ${f}  (owner: ${ownerOf(f)})`).join("\n"));
  console.error("Request the change via docs/contract-requests/ instead.");
  process.exit(1);
}
console.log(`check-owners: ${files.length} files, all owned by ${agent}: ok`);
