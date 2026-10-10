import { vi } from "vitest";

export interface FakeRepo {
  owner: string;
  ownerType?: "User" | "Organization";
  license?: string | null;
  stars?: number;
  archived?: boolean;
  homepage?: string | null;
  topics?: string[];
  /** Files in the default branch (path → content), for the safety scan. */
  files?: Record<string, string>;
}

/** Stub fetch with a tiny fake GitHub (+ always-pass Turnstile). */
export function fakeGithub(repos: Record<string, FakeRepo>, opts: { publicMembers?: string[]; search?: string[]; awesomeReadme?: string } = {}) {
  vi.stubGlobal("fetch", async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith("https://challenges.cloudflare.com/")) return Response.json({ success: true });
    const { hostname, pathname } = new URL(url);
    if (hostname === "raw.githubusercontent.com") {
      const [, owner, name, , ...rest] = pathname.split("/");
      const content = repos[`${owner}/${name}`]?.files?.[rest.map(decodeURIComponent).join("/")];
      return content === undefined ? new Response("", { status: 404 }) : new Response(content);
    }
    if (pathname === "/search/repositories") {
      return Response.json({ items: (opts.search ?? []).map((full_name) => ({ full_name, stargazers_count: 10, archived: false, private: false })) });
    }
    const member = pathname.match(/^\/orgs\/([^/]+)\/public_members\/([^/]+)$/);
    if (member) return new Response(null, { status: (opts.publicMembers ?? []).includes(`${member[1]}/${member[2]}`) ? 204 : 404 });
    const m = pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    if (m && m[2] === "/readme" && opts.awesomeReadme && !repos[m[1]!]) return new Response(opts.awesomeReadme);
    const repo = m && repos[m[1]!];
    if (!repo) return new Response("{}", { status: 404 });
    if (m![2] === "/readme") return new Response("<p>Readme</p>");
    if (m![2]?.startsWith("/git/trees/")) {
      return Response.json({ truncated: false, tree: Object.entries(repo.files ?? {}).map(([path, content]) => ({ path, type: "blob", size: content.length })) });
    }
    if (m![2]?.startsWith("/contributors")) return Response.json([{}]);
    const [owner, name] = m![1]!.split("/");
    return Response.json({
      id: 99, full_name: m![1], name, owner: { login: owner, type: repo.ownerType ?? "User" },
      html_url: `https://github.com/${m![1]}`, clone_url: `https://github.com/${m![1]}.git`,
      description: "A repo", homepage: repo.homepage ?? null, topics: repo.topics ?? [], language: "TypeScript",
      stargazers_count: repo.stars ?? 12, forks_count: 3, open_issues_count: 0, archived: repo.archived ?? false, disabled: false, fork: false,
      default_branch: "main", created_at: "2026-01-01T00:00:00Z", pushed_at: "2026-10-01T00:00:00Z", private: false,
      license: repo.license === null ? null : { spdx_id: repo.license ?? "MIT", name: "MIT License" },
    });
  });
}
