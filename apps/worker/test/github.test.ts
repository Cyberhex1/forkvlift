import { afterEach, describe, expect, it, vi } from "vitest";
import { countFromLink } from "../src/core/github/client";
import { ingestRepo } from "../src/core/github/ingest";
import { parseRepoUrl } from "../src/core/github/repo-url";
import { readmeHasImages, sanitizeReadme } from "../src/core/github/sanitize";

const repo = { fullName: "octo/app", defaultBranch: "main" };

describe("parseRepoUrl", () => {
  it.each([
    ["https://github.com/octo/app", "octo/app"],
    ["github.com/octo/app.git", "octo/app"],
    ["https://www.github.com/octo/app/tree/main/src?x=1", "octo/app"],
    ["git@github.com:octo/app.git", "octo/app"],
    ["octo/app", "octo/app"],
    ["  https://github.com/Octo-Org/my.app_2  ", "Octo-Org/my.app_2"],
  ])("%s → %s", (input, expected) => {
    expect(parseRepoUrl(input)?.fullName).toBe(expected);
  });

  it.each(["", "https://gitlab.com/octo/app", "https://github.com/octo", "javascript:alert(1)", "https://github.com/-bad/app", "https://github.com/octo/.."])(
    "rejects %s",
    (input) => expect(parseRepoUrl(input)).toBeNull(),
  );
});

describe("sanitizeReadme", () => {
  it("removes scripts, handlers and dangerous URLs", () => {
    const out = sanitizeReadme(
      `<h1 onclick="x()">Hi</h1><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="x" onerror="y()"><iframe src="https://evil"></iframe><style>body{}</style>`,
      repo,
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe|<style/i);
    expect(out).toContain("<h1>Hi</h1>");
  });

  it("resolves relative links and images against the repo", () => {
    const out = sanitizeReadme(`<a href="docs/USAGE.md">u</a><img src="./shot.png" alt="s">`, repo);
    expect(out).toContain('href="https://github.com/octo/app/blob/main/docs/USAGE.md"');
    expect(out).toContain('src="https://raw.githubusercontent.com/octo/app/main/shot.png"');
    expect(readmeHasImages(out)).toBe(true);
  });

  it("makes links open safely in a new tab", () => {
    const out = sanitizeReadme(`<a href="https://example.com" target="_self" rel="opener">e</a>`, repo);
    expect(out).toBe('<a rel="nofollow noopener noreferrer ugc" target="_blank" href="https://example.com">e</a>');
  });

  it("leaves in-page anchors in the same tab", () => {
    expect(sanitizeReadme(`<a href="#install">i</a>`, repo)).toBe('<a href="#install">i</a>');
  });

  it("keeps GitHub highlight classes but not arbitrary ones", () => {
    const out = sanitizeReadme(`<div class="highlight highlight-source-ts fixed inset-0"><pre><span class="pl-k bg-danger">const</span></pre></div>`, repo);
    expect(out).toContain('class="highlight highlight-source-ts"');
    expect(out).toContain('class="pl-k"');
    expect(out).not.toMatch(/fixed|inset-0|bg-danger/);
  });

  it("strips svg and unknown tags but keeps text", () => {
    expect(sanitizeReadme(`<section><svg><path d="M0"/></svg>text</section>`, repo)).toBe("text");
  });
});

describe("countFromLink", () => {
  it("reads the last page", () => {
    expect(countFromLink('<https://api.github.com/x?per_page=1&page=2>; rel="next", <https://api.github.com/x?per_page=1&page=37>; rel="last"', 1)).toBe(37);
    expect(countFromLink(null, 1)).toBe(1);
  });
});

describe("ingestRepo", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeEnv() {
    const store = new Map<string, string>();
    return {
      store,
      env: {
        CACHE: {
          get: async (k: string) => (store.has(k) ? JSON.parse(store.get(k)!) : null),
          put: async (k: string, v: string) => void store.set(k, v),
        },
      } as unknown as Env,
    };
  }

  const ghRepo = {
    id: 1,
    full_name: "octo/app",
    name: "app",
    owner: { login: "octo", type: "User" },
    html_url: "https://github.com/octo/app",
    clone_url: "https://github.com/octo/app.git",
    description: " A thing ",
    homepage: "octo.dev",
    topics: ["vibe-coding"],
    language: "TypeScript",
    stargazers_count: 10,
    forks_count: 2,
    open_issues_count: 1,
    archived: false,
    disabled: false,
    fork: false,
    default_branch: "main",
    created_at: "2026-01-01T00:00:00Z",
    pushed_at: "2026-10-01T00:00:00Z",
    private: false,
    license: null,
  };

  it("builds a snapshot and caches with ETags", async () => {
    const calls: { url: string; etag: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ url, etag: headers["if-none-match"] ?? null });
      if (headers["if-none-match"]) return new Response(null, { status: 304 });
      if (url.endsWith("/repos/octo/app")) return Response.json(ghRepo, { headers: { etag: '"r1"' } });
      if (url.endsWith("/readme")) return new Response('<p>Hello <img src="a.png"></p>', { headers: { etag: '"m1"' } });
      if (url.includes("/contributors")) return Response.json([{}], { headers: { etag: '"c1"', link: '<https://api.github.com/x?page=4>; rel="last"' } });
      return new Response("nope", { status: 404 });
    });

    const { env } = fakeEnv();
    const s = await ingestRepo(env, "https://github.com/octo/app");
    expect(s).toMatchObject({
      fullName: "octo/app",
      description: "A thing",
      homepage: "https://octo.dev/",
      license: null,
      contributors: 4,
      hasScreenshots: true,
      socialPreviewUrl: "https://opengraph.githubassets.com/1/octo/app",
    });

    calls.length = 0;
    await ingestRepo(env, "octo/app");
    expect(calls.every((c) => c.etag)).toBe(true); // second run revalidates only
  });

  it("reports missing repos as not found", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 404 }));
    await expect(ingestRepo(fakeEnv().env, "octo/missing")).rejects.toMatchObject({ code: "not_found" });
  });
});
