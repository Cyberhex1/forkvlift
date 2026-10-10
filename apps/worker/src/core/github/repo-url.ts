/** Parse anything a person might paste into "owner/repo". */
export interface RepoRef {
  owner: string;
  repo: string;
  fullName: string;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoUrl(input: string): RepoRef | null {
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/^git@github\.com:/i, "https://github.com/");
  s = s.replace(/^git\+/, "");

  let path: string;
  if (/^[\w.-]+\/[\w.-]+$/.test(s)) {
    path = s;
  } else {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return null;
    path = url.pathname.replace(/^\/+/, "");
  }

  const [owner, rawRepo] = path.split("/");
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/i, "");
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

export function repoHtmlUrl(ref: RepoRef): string {
  return `https://github.com/${ref.fullName}`;
}
