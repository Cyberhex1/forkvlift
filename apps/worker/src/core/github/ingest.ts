/**
 * Task 1.1: everything we know about a repo, fetched from GitHub's API.
 * Used by submit (1.4), the curation queue (1.7) and the stats refresh job.
 */
import { describeLicense, type LicenseInfo } from "@forkvlift/shared";
import { countFromLink, github, GithubNotFound } from "./client";
import { parseRepoUrl, type RepoRef } from "./repo-url";
import { readmeHasImages, sanitizeReadme } from "./sanitize";
import { HttpError } from "../errors";

export interface RepoSnapshot {
  githubRepoId: number;
  fullName: string;
  owner: string;
  ownerType: "User" | "Organization";
  name: string;
  htmlUrl: string;
  cloneUrl: string;
  description: string;
  homepage: string | null;
  topics: string[];
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  contributors: number;
  archived: boolean;
  disabled: boolean;
  isFork: boolean;
  parentFullName: string | null;
  defaultBranch: string;
  createdAt: string;
  pushedAt: string | null;
  /** null = no license (all rights reserved). */
  license: LicenseInfo | null;
  readmeHtml: string | null;
  hasScreenshots: boolean;
  /** GitHub's generated Open Graph card; used as a fallback thumbnail. */
  socialPreviewUrl: string;
  fetchedAt: string;
}

interface GhRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; type: "User" | "Organization" };
  html_url: string;
  clone_url: string;
  description: string | null;
  homepage: string | null;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  parent?: { full_name: string };
  default_branch: string;
  created_at: string;
  pushed_at: string | null;
  private: boolean;
  license: { spdx_id: string | null; name: string } | null;
}

export interface IngestOptions {
  /** Skip revalidation for cached responses younger than this (seconds). */
  freshFor?: number;
}

export async function ingestRepo(env: Env, input: string | RepoRef, opts: IngestOptions = {}): Promise<RepoSnapshot> {
  const ref = typeof input === "string" ? parseRepoUrl(input) : input;
  if (!ref) throw new HttpError("invalid_request", "That doesn't look like a GitHub repository URL.");

  let repo: GhRepo;
  try {
    repo = (await github<GhRepo>(env, `/repos/${ref.fullName}`, { freshFor: opts.freshFor }))!.data;
  } catch (err) {
    if (err instanceof GithubNotFound) throw new HttpError("not_found", "Repository not found. It must be public.");
    throw err;
  }
  if (repo.private) throw new HttpError("bad_request", "Only public repositories can be listed.");

  // GitHub may redirect renamed repos; always use the canonical name from here on.
  const fullName = repo.full_name;
  const [readmeRaw, contributors] = await Promise.all([
    github<string>(env, `/repos/${fullName}/readme`, { accept: "application/vnd.github.html+json", allow404: true, freshFor: opts.freshFor }),
    github<unknown[]>(env, `/repos/${fullName}/contributors?per_page=1&anon=1`, { allow404: true, freshFor: opts.freshFor }).catch(() => null),
  ]);

  const readmeHtml = typeof readmeRaw?.data === "string" ? sanitizeReadme(readmeRaw.data, { fullName, defaultBranch: repo.default_branch }) : null;
  const contributorCount = contributors && Array.isArray(contributors.data) ? countFromLink(contributors.link, contributors.data.length) : 0;

  return {
    githubRepoId: repo.id,
    fullName,
    owner: repo.owner.login,
    ownerType: repo.owner.type,
    name: repo.name,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    description: (repo.description ?? "").trim(),
    homepage: normalizeHomepage(repo.homepage),
    topics: repo.topics ?? [],
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    contributors: contributorCount,
    archived: repo.archived,
    disabled: repo.disabled,
    isFork: repo.fork,
    parentFullName: repo.parent?.full_name ?? null,
    defaultBranch: repo.default_branch,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    license: describeLicense(repo.license?.spdx_id ?? null, repo.license?.name),
    readmeHtml,
    hasScreenshots: readmeHtml ? readmeHasImages(readmeHtml) : false,
    socialPreviewUrl: `https://opengraph.githubassets.com/1/${fullName}`,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeHomepage(value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
