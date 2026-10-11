/**
 * Task 4.13: the open catalog mirror. Nightly, every listed, openly licensed
 * project is written to `projects/<slug>.json` in a public GitHub repo (one
 * commit, only when something changed), with `categories.json` alongside.
 * When a pull request that adds a `projects/*.json` file is merged there, the
 * webhook sends each repo URL to the admin review queue, the same as the
 * paste-a-link importer.
 *
 * Needs MIRROR_REPO ("owner/name"), MIRROR_GITHUB_TOKEN (contents: write on
 * that repo only) and MIRROR_WEBHOOK_SECRET. Without them it does nothing.
 */
import { importByUrl } from "./curation/candidates";
import { LISTED, parseJson } from "./projects/rows";

const API = "https://api.github.com";
const PROJECT_FILE = /^projects\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;
const MAX_FILES_PER_PR = 20;

export function mirrorConfigured(env: Env): boolean {
  return Boolean(env.MIRROR_REPO && env.MIRROR_GITHUB_TOKEN && /^[\w.-]+\/[\w.-]+$/.test(env.MIRROR_REPO));
}

async function gh<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.MIRROR_GITHUB_TOKEN}`,
      "user-agent": "forklift-mirror",
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

interface MirrorRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  repo_url: string;
  category_slug: string;
  stage: string;
  license_spdx: string | null;
  live_url: string | null;
  release_url: string | null;
  stack: string | null;
  platforms: string | null;
  difficulty: string | null;
  ai_tools: string | null;
  build_time: string | null;
  ai_involvement: string | null;
  is_template: number;
  replaces: string | null;
  what_works: string | null;
  whats_missing: string | null;
  looking_for_help: string | null;
}

/** One record in the shape of data/seed/project.schema.json (no extra keys). */
export function mirrorRecord(r: MirrorRow, tags: string[]) {
  const record: Record<string, unknown> = {
    slug: r.slug,
    name: r.name.slice(0, 80),
    tagline: (r.tagline || r.name).slice(0, 140),
    description: (r.description || r.tagline || r.name).slice(0, 5000),
    repoUrl: r.repo_url,
    categorySlug: r.category_slug,
    stage: r.stage,
    licenseSpdx: r.license_spdx,
    liveUrl: r.live_url,
    releaseUrl: r.release_url,
    tags: tags.slice(0, 10),
    stack: parseJson<string[]>(r.stack, []),
    platforms: parseJson<string[]>(r.platforms, []),
    difficulty: r.difficulty,
    aiTools: parseJson<string[]>(r.ai_tools, []),
    buildTime: r.build_time,
    aiInvolvement: r.ai_involvement,
    isTemplate: r.is_template === 1,
    replaces: parseJson<string[]>(r.replaces, []),
    whatWorks: r.what_works,
    whatsMissing: r.whats_missing,
    lookingForHelp: r.looking_for_help,
  };
  return record;
}

/** Write the catalog to the mirror repo. Returns the new commit sha, or null when nothing changed. */
export async function exportCatalog(env: Env): Promise<{ commit: string | null; projects: number }> {
  if (!mirrorConfigured(env)) return { commit: null, projects: 0 };
  const db = env.DB;
  const repo = env.MIRROR_REPO!;
  const { results: rows } = await db
    .prepare(`SELECT p.* FROM projects p WHERE ${LISTED} AND p.license_spdx IS NOT NULL AND p.repo_url LIKE 'https://github.com/%' ORDER BY p.slug`)
    .all<MirrorRow>();
  const { results: tagRows } = await db.prepare(`SELECT project_id, tag FROM project_tags ORDER BY tag`).all<{ project_id: string; tag: string }>();
  const tags = new Map<string, string[]>();
  for (const t of tagRows) tags.set(t.project_id, [...(tags.get(t.project_id) ?? []), t.tag]);
  const { results: categories } = await db
    .prepare(`SELECT slug, name, parent_slug AS parentSlug, description FROM categories WHERE status = 'active' ORDER BY position`)
    .all();

  const ref = await gh<{ object: { sha: string } }>(env, `/repos/${repo}/git/ref/heads/main`);
  const head = await gh<{ tree: { sha: string } }>(env, `/repos/${repo}/git/commits/${ref.object.sha}`);
  const current = await gh<{ tree: { path: string; mode: string; type: string; sha: string }[]; truncated: boolean }>(env, `/repos/${repo}/git/trees/${head.tree.sha}?recursive=1`);
  if (current.truncated) throw new Error("Mirror tree too large to rewrite in one commit");

  // Keep everything we don't own (README, schema, scripts…); replace projects/ and categories.json.
  const kept = current.tree.filter((e) => e.type === "blob" && !e.path.startsWith("projects/") && e.path !== "categories.json").map(({ path, mode, type, sha }) => ({ path, mode, type, sha }));
  const ours = [
    { path: "categories.json", mode: "100644", type: "blob", content: `${JSON.stringify(categories, null, 2)}\n` },
    ...rows.map((r) => ({ path: `projects/${r.slug}.json`, mode: "100644", type: "blob", content: `${JSON.stringify(mirrorRecord(r, tags.get(r.id) ?? []), null, 2)}\n` })),
  ];
  const tree = await gh<{ sha: string }>(env, `/repos/${repo}/git/trees`, { method: "POST", body: JSON.stringify({ tree: [...kept, ...ours] }) });
  if (tree.sha === head.tree.sha) return { commit: null, projects: rows.length };

  const commit = await gh<{ sha: string }>(env, `/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: `Nightly catalog export: ${rows.length} projects`, tree: tree.sha, parents: [ref.object.sha] }),
  });
  await gh(env, `/repos/${repo}/git/refs/heads/main`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
  return { commit: commit.sha, projects: rows.length };
}

// ── Pull request intake ──────────────────────────────────────────────────

/** Constant-time check of GitHub's X-Hub-Signature-256 header. */
export async function verifyWebhook(secret: string, body: string, signature: string | null): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

interface PullRequestEvent {
  action?: string;
  pull_request?: { number: number; merged?: boolean; merge_commit_sha?: string | null; html_url: string; base?: { ref?: string } };
  repository?: { full_name?: string };
}

/** For a merged PR into the mirror's main branch: queue every added or changed project file. */
export async function ingestMergedPull(env: Env, event: PullRequestEvent): Promise<{ queued: string[]; skipped: string[] }> {
  const out = { queued: [] as string[], skipped: [] as string[] };
  const pr = event.pull_request;
  if (!mirrorConfigured(env) || event.action !== "closed" || !pr?.merged || !pr.merge_commit_sha) return out;
  if (event.repository?.full_name?.toLowerCase() !== env.MIRROR_REPO!.toLowerCase() || pr.base?.ref !== "main") return out;

  const files = await gh<{ filename: string; status: string }[]>(env, `/repos/${env.MIRROR_REPO}/pulls/${pr.number}/files?per_page=100`);
  for (const f of files.filter((x) => (x.status === "added" || x.status === "modified") && PROJECT_FILE.test(x.filename)).slice(0, MAX_FILES_PER_PR)) {
    try {
      const raw = await fetch(`${API}/repos/${env.MIRROR_REPO}/contents/${f.filename}?ref=${pr.merge_commit_sha}`, {
        headers: { accept: "application/vnd.github.raw", authorization: `Bearer ${env.MIRROR_GITHUB_TOKEN}`, "user-agent": "forklift-mirror" },
      });
      const data = (await raw.json()) as { repoUrl?: unknown };
      const url = typeof data.repoUrl === "string" ? data.repoUrl.trim() : "";
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(url)) throw new Error("repoUrl isn't a GitHub repo URL");
      await importByUrl(env, url, pr.html_url);
      out.queued.push(f.filename);
    } catch (e) {
      console.error(`[mirror] ${f.filename}`, e);
      out.skipped.push(f.filename);
    }
  }
  return out;
}
