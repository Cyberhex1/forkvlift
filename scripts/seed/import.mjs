#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

// Register custom ESM resolver for extensionless TypeScript imports in @forkvlift/shared
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sharedEntryUrl = new URL("packages/shared/src/index.ts", "file:///" + repoRoot.replace(/\\/g, "/") + "/").href;

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === "@forkvlift/shared") {
          return nextResolve("${sharedEntryUrl}", context);
        }
        try {
          return await nextResolve(specifier, context);
        } catch (err) {
          if (specifier.startsWith("./") || specifier.startsWith("../")) {
            for (const ext of [".ts", ".js", "/index.ts", "/index.js"]) {
              try {
                return await nextResolve(specifier + ext, context);
              } catch {}
            }
          }
          throw err;
        }
      }
    `),
  import.meta.url
);

const { createApiClient, ApiError } = await import("@forkvlift/shared");

const baseUrl = process.env.SEED_BASE_URL || "http://127.0.0.1:8789";
const cookie = process.env.SEED_COOKIE;

if (!cookie) {
  console.error("Error: SEED_COOKIE environment variable is required.");
  console.error("Provide a session token or cookie header (e.g. SEED_COOKIE=tok_admin_local_secret)");
  process.exit(1);
}

const cookieHeader = cookie.includes("=") ? cookie : `fv_session=${cookie}`;

const candidatesFile = path.resolve(repoRoot, "data/seed/candidates.txt");
const reportFile = path.resolve(repoRoot, "data/seed/import-report.md");

if (!fs.existsSync(candidatesFile)) {
  console.error(`Error: candidates file not found at ${candidatesFile}`);
  process.exit(1);
}

const lines = fs
  .readFileSync(candidatesFile, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

console.log(`ForkLift Seed Importer`);
console.log(`======================`);
console.log(`Base URL:   ${baseUrl}`);
console.log(`Candidates: ${lines.length}`);
console.log(`Output:     ${reportFile}\n`);

const api = createApiClient({
  baseUrl,
  fetch: (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookieHeader);
    return fetch(url, { ...init, headers });
  },
});

// Check existing candidates first to accurately detect 'already queued'
let existingRepos = new Set();
try {
  const existing = await api.call("listCandidates", { query: { limit: 60 } });
  for (const item of existing.items) {
    existingRepos.add(item.repoFullName.toLowerCase());
    existingRepos.add(item.repoUrl.toLowerCase());
  }
} catch (err) {
  console.warn("Notice: could not list existing candidates beforehand:", err instanceof Error ? err.message : String(err));
}

const results = [];

for (const line of lines) {
  const parts = line.split(/\s+/);
  const repoUrl = parts[0];
  const foundViaUrl = parts[1] ?? null;

  const repoClean = repoUrl.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
  const isAlreadyQueued = existingRepos.has(repoClean.toLowerCase()) || existingRepos.has(repoUrl.toLowerCase());

  process.stdout.write(`Importing ${repoUrl}... `);

  try {
    const candidate = await api.call("importCandidate", {
      body: {
        repoUrl,
        foundViaUrl,
      },
    });

    const status = isAlreadyQueued ? "already queued" : "imported";
    const licenseText = candidate.license?.spdx || (candidate.license ? candidate.license.name : "No license");

    results.push({
      repoUrl,
      repoFullName: candidate.repoFullName,
      foundViaUrl,
      status,
      candidateId: candidate.id,
      name: candidate.name,
      description: candidate.description,
      stars: candidate.stars,
      score: candidate.score,
      license: licenseText,
      hasDemo: candidate.hasDemo,
      hasReadme: candidate.hasReadme,
      error: null,
    });

    existingRepos.add(candidate.repoFullName.toLowerCase());
    existingRepos.add(candidate.repoUrl.toLowerCase());

    console.log(`[${status}] (Score: ${candidate.score}, Stars: ${candidate.stars}, License: ${licenseText})`);
  } catch (err) {
    let errorMsg = String(err);
    if (err instanceof ApiError) {
      errorMsg = `${err.code}: ${err.message}`;
    } else if (err instanceof Error) {
      errorMsg = err.message;
    }

    results.push({
      repoUrl,
      repoFullName: repoClean,
      foundViaUrl,
      status: "skipped",
      candidateId: null,
      name: "-",
      description: "-",
      stars: "-",
      score: "-",
      license: "-",
      hasDemo: false,
      hasReadme: false,
      error: errorMsg,
    });

    console.log(`[skipped] (${errorMsg})`);
  }
}

// Generate markdown report
const nowIso = new Date().toISOString();
let markdown = `# Seed Catalog Import Report\n\n`;
markdown += `Generated on **${nowIso}** by \`scripts/seed/import.mjs\` against \`${baseUrl}\`.\n\n`;
markdown += `| Repository | Status | License | Stars | Score | Ingestion Result / Error |\n`;
markdown += `| --- | --- | --- | --- | --- | --- |\n`;

for (const r of results) {
  const repoCell = `[${r.repoFullName}](${r.repoUrl})`;
  const statusCell = `**${r.status}**`;
  const licenseCell = r.license;
  const starsCell = String(r.stars);
  const scoreCell = typeof r.score === "number" ? r.score.toFixed(1) : String(r.score);
  const detailCell = r.error ? `\`${r.error}\`` : `Candidate \`${r.candidateId}\` (Demo: ${r.hasDemo ? "Yes" : "No"}, README: ${r.hasReadme ? "Yes" : "No"})`;

  markdown += `| ${repoCell} | ${statusCell} | ${licenseCell} | ${starsCell} | ${scoreCell} | ${detailCell} |\n`;
}

const importedCount = results.filter((r) => r.status === "imported").length;
const queuedCount = results.filter((r) => r.status === "already queued").length;
const skippedCount = results.filter((r) => r.status === "skipped").length;

markdown += `\n## Summary\n\n`;
markdown += `- **Total candidate URLs processed:** ${results.length}\n`;
markdown += `- **Newly imported to review queue:** ${importedCount}\n`;
markdown += `- **Already queued / refreshed:** ${queuedCount}\n`;
markdown += `- **Skipped with API errors:** ${skippedCount}\n`;

fs.writeFileSync(reportFile, markdown, "utf8");
console.log(`\nReport successfully written to ${reportFile}`);
