/**
 * DEV-ONLY FIXTURES. Never imported by anything that ships: the Worker loads them
 * behind the compile-time __FIXTURES__ flag (true only under `vite dev`), and CI
 * fails the build if FIXTURE_MARKER shows up in any production bundle.
 *
 * Every name says "Fixture" so nobody mistakes these for real projects or people.
 * They cover the variants UIs must handle: licensed / unlicensed, finished / WIP /
 * up for adoption, curated + unclaimed, long text, no thumbnail.
 */
import { describeLicense } from "../licenses";
import type {
  Board,
  Candidate,
  Category,
  ChatChannel,
  ChatMessage,
  Collection,
  Comment,
  ForumBoard,
  Notification,
  Post,
  ProjectCard,
  ProjectDetail,
  Resource,
  ResourceDetail,
  SessionUser,
  Thread,
  UserSummary,
} from "../schemas";
import { DEFAULT_USER_SETTINGS } from "../schemas/user";

export const FIXTURE_MARKER = "__FORKVLIFT_DEV_FIXTURE__";

const T0 = "2026-09-01T12:00:00.000Z";
const T1 = "2026-09-20T09:30:00.000Z";
const T2 = "2026-10-05T18:15:00.000Z";

// ── Users ────────────────────────────────────────────────────────────────

export const fxUsers = {
  ada: {
    id: "fx_user_ada",
    username: "fx-ada",
    displayName: "Ada (fixture)",
    avatarUrl: null,
    avatar: { hair: "bob", outfit: "hoodie", color: "pixel-9", accessory: "glasses" },
  },
  bo: {
    id: "fx_user_bo",
    username: "fx-bo",
    displayName: "Bo (fixture)",
    avatarUrl: null,
    avatar: { hair: "spiky", outfit: "overalls", color: "pixel-4", accessory: null },
  },
  admin: {
    id: "fx_user_admin",
    username: "fx-admin",
    displayName: "Admin (fixture)",
    avatarUrl: null,
    avatar: null,
  },
} satisfies Record<string, UserSummary>;

export type FixtureUserKey = keyof typeof fxUsers;

export function fxSessionUser(id: string): SessionUser | null {
  const user = Object.values(fxUsers).find((u) => u.id === id);
  if (!user) return null;
  return {
    ...user,
    role: user.id === fxUsers.admin.id ? "admin" : "user",
    email: `${user.username}@example.invalid`,
    githubLogin: user.username,
    settings: { ...DEFAULT_USER_SETTINGS },
  };
}

// ── Categories ───────────────────────────────────────────────────────────

export const fxCategories: Category[] = [
  { slug: "games", name: "Games", parentSlug: null, iconKey: "cat-games", description: "Browser games, roguelikes, puzzles, jams", projectCount: 2 },
  { slug: "browser-games", name: "Browser games", parentSlug: "games", iconKey: null, description: null, projectCount: 1 },
  { slug: "productivity", name: "Productivity", parentSlug: null, iconKey: "cat-productivity", description: "Notes, to-do, calendars, habit trackers", projectCount: 2 },
  { slug: "developer-tools", name: "Developer tools", parentSlug: null, iconKey: "cat-developer-tools", description: "Editors, linters, API clients, MCP servers", projectCount: 1 },
  { slug: "home-and-life", name: "Home and life", parentSlug: null, iconKey: "cat-home-and-life", description: "Recipes, plant care, pet care", projectCount: 1 },
];

const cat = (slug: string) => {
  const c = fxCategories.find((x) => x.slug === slug)!;
  return { slug: c.slug, name: c.name, iconKey: c.iconKey };
};

// ── Projects ─────────────────────────────────────────────────────────────

function card(p: Partial<ProjectCard> & Pick<ProjectCard, "id" | "slug" | "name">): ProjectCard {
  return {
    tagline: "A fixture project for local development",
    description: "Dev fixture. Not a real project; exists so the UI has something to render locally.",
    thumbnailUrl: null,
    author: fxUsers.ada,
    source: "community",
    claimed: true,
    category: cat("productivity"),
    tags: [],
    stage: "finished",
    studioColumnTitle: null,
    license: describeLicense("MIT"),
    stars: 0,
    forks: 0,
    upvotes: 0,
    commentCount: 0,
    repoUrl: `https://github.com/example/${p.slug}`,
    cloneCommand: `git clone https://github.com/example/${p.slug}.git`,
    liveUrl: null,
    releaseUrl: null,
    buildFacts: { aiTools: ["claude-code"], buildTime: "a weekend", aiInvolvement: "mostly_ai" },
    replaces: [],
    isTemplate: false,
    createdAt: T0,
    updatedAt: T1,
    viewer: null,
    ...p,
  };
}

export const fxProjects: ProjectCard[] = [
  card({
    id: "fx_prj_1",
    slug: "fixture-pixel-planner",
    name: "Fixture: Pixel Planner",
    tagline: "Kanban-style planner with pixel-art columns",
    category: cat("productivity"),
    tags: ["kanban", "local-first"],
    stars: 412,
    forks: 37,
    upvotes: 88,
    commentCount: 12,
    liveUrl: "https://example.com/pixel-planner",
    replaces: ["Trello"],
    buildFacts: { aiTools: ["claude-code", "cursor"], buildTime: "2 weeks", aiInvolvement: "mostly_ai" },
  }),
  card({
    id: "fx_prj_2",
    slug: "fixture-dungeon-toaster",
    name: "Fixture: Dungeon Toaster",
    tagline: "Roguelike where every room is a kitchen appliance",
    author: fxUsers.bo,
    category: cat("browser-games"),
    tags: ["roguelike", "canvas"],
    stage: "wip",
    studioColumnTitle: "Bug fix",
    license: describeLicense("GPL-3.0"),
    stars: 58,
    forks: 4,
    upvotes: 21,
    buildFacts: { aiTools: ["lovable"], buildTime: null, aiInvolvement: "all_ai" },
  }),
  card({
    id: "fx_prj_3",
    slug: "fixture-plant-pal",
    name: "Fixture: Plant Pal",
    tagline: "Watering reminders for forgetful plant owners",
    category: cat("home-and-life"),
    stage: "adoption",
    license: describeLicense("Apache-2.0"),
    stars: 9,
    forks: 1,
    upvotes: 5,
    updatedAt: T0,
  }),
  card({
    id: "fx_prj_4",
    slug: "fixture-no-license-notes",
    name: "Fixture: No-License Notes",
    tagline: "Markdown notes app whose repo has no license file",
    description:
      "Dev fixture for the unlicensed variant: hidden by default, shows the disclaimer banner, and swaps the clone box for the ask-the-author actions.",
    author: fxUsers.bo,
    category: cat("productivity"),
    license: null,
    stars: 140,
    forks: 11,
    upvotes: 30,
    replaces: ["Notion"],
  }),
  card({
    id: "fx_prj_5",
    slug: "fixture-curated-cli",
    name: "Fixture: Curated CLI With A Deliberately Long Name To Test Wrapping",
    tagline: "Curated card nobody has claimed yet — eighty characters max on this line ok",
    description:
      "Dev fixture for the curated + unclaimed variant and for long text. This description is close to the three-hundred character limit so layout can be checked for overflow, wrapping, truncation and the card back staying readable at 375 pixels wide.",
    author: null,
    source: "curated",
    claimed: false,
    category: cat("developer-tools"),
    tags: ["cli", "rust", "terminal", "productivity", "mcp"],
    stars: 2310,
    forks: 190,
    upvotes: 140,
    releaseUrl: "https://github.com/example/fixture-curated-cli/releases",
    isTemplate: true,
    buildFacts: { aiTools: [], buildTime: null, aiInvolvement: null },
  }),
];

export function fxProjectDetail(slug: string): ProjectDetail | null {
  const c = fxProjects.find((p) => p.slug === slug);
  if (!c) return null;
  return {
    ...c,
    readmeHtml: `<h1>${c.name}</h1><p>Dev fixture README. Real READMEs are fetched from GitHub and sanitized.</p>`,
    media: [],
    stack: ["TypeScript", "React"],
    platforms: ["web"],
    difficulty: "one_click",
    repoStats: { stars: c.stars, forks: c.forks, openIssues: 3, contributors: 2, lastCommitAt: T2 },
    health: {
      score: 72,
      breakdown: {
        stars: { value: c.stars, points: 20 },
        forks: { value: c.forks, points: 15 },
        contributors: { value: 2, points: 10 },
        activity: { value: 5, points: 17 },
        age: { value: 40, points: 10 },
      },
    },
    forkedFrom: null,
    notableForks: [],
    wipStatus: c.stage === "finished" ? null : { whatWorks: "Core loop runs.", whatsMissing: "Save files, sound, mobile controls." },
    lookingForHelp: c.stage === "finished" ? null : "Pixel art and sound effects",
    starterPrompt: `You are working on a fork of ${c.name}. Start by reading README.md.`,
    safety: { flags: [] },
    verifiedAuthor: c.source === "community",
    staffPick: c.id === "fx_prj_1",
    foundVia: null,
  };
}

export const fxComments: Comment[] = [
  { id: "fx_cmt_1", projectId: "fx_prj_1", parentId: null, author: fxUsers.bo, body: "Forked this for my D&D campaign tracker.", upvotes: 3, createdAt: T1, editedAt: null },
  { id: "fx_cmt_2", projectId: "fx_prj_1", parentId: "fx_cmt_1", author: fxUsers.ada, body: "Nice! Send a link when it's up.", upvotes: 1, createdAt: T2, editedAt: null },
];

// ── Studio ───────────────────────────────────────────────────────────────

export const fxBoard: Board = {
  id: "fx_board_1",
  columns: [
    { id: "fx_col_1", title: "Idea", color: null, position: 0, collapsed: false, wipLimit: null },
    { id: "fx_col_2", title: "Develop", color: "pixel-4", position: 1, collapsed: false, wipLimit: 3 },
    { id: "fx_col_3", title: "Bug fix", color: null, position: 2, collapsed: false, wipLimit: null },
    { id: "fx_col_4", title: "Ready for release", color: null, position: 3, collapsed: true, wipLimit: null },
  ],
  cards: [
    { id: "fx_card_1", columnId: "fx_col_1", position: 0, title: "Fixture idea: recipe scaler", idea: "Scale recipes by servings, offline.", stage: "wip", isPublic: false, project: null, updatedAt: T1 },
    { id: "fx_card_2", columnId: "fx_col_2", position: 0, title: "Fixture: Pixel Planner", idea: null, stage: "finished", isPublic: true, project: fxProjects[0]!, updatedAt: T2 },
  ],
};

// ── Social ───────────────────────────────────────────────────────────────

export const fxCollections: Collection[] = [
  { id: "fx_col_saved", name: "Saved", description: "", isPublic: false, isDefault: true, owner: fxUsers.ada, itemCount: 2, updatedAt: T2 },
  { id: "fx_col_alts", name: "Fixture: Free Notion alternatives", description: "Dev fixture collection", isPublic: true, isDefault: false, owner: fxUsers.ada, itemCount: 1, updatedAt: T1 },
];

export const fxNotifications: Notification[] = [
  { id: "fx_ntf_1", type: "fork", read: false, actor: fxUsers.bo, title: "Bo (fixture) forked Fixture: Pixel Planner", href: "/p/fixture-pixel-planner", createdAt: T2 },
  { id: "fx_ntf_2", type: "comment", read: true, actor: fxUsers.bo, title: "New comment on Fixture: Pixel Planner", href: "/p/fixture-pixel-planner", createdAt: T1 },
];

// ── Community ────────────────────────────────────────────────────────────

export const fxForumBoards: ForumBoard[] = [
  { slug: "show-and-tell", name: "Show & Tell", description: "Share what you built", threadCount: 1 },
  { slug: "help", name: "Help & Debugging", description: "Stuck? Ask here", threadCount: 1 },
];

export const fxThreads: Thread[] = [
  { id: "fx_thr_1", boardSlug: "help", title: "Fixture thread: Durable Object keeps hibernating?", author: fxUsers.bo, tags: ["cloudflare"], upvotes: 4, replyCount: 1, solved: true, pinned: false, createdAt: T1, lastActivityAt: T2 },
];

export const fxPosts: Post[] = [
  { id: "fx_post_1", threadId: "fx_thr_1", author: fxUsers.bo, bodyMd: "Fixture post with `inline code`.\n\n```ts\nconsole.log('hi')\n```", upvotes: 2, isSolution: false, createdAt: T1, editedAt: null },
  { id: "fx_post_2", threadId: "fx_thr_1", author: fxUsers.ada, bodyMd: "Fixture answer: that's expected, it wakes on the next message.", upvotes: 5, isSolution: true, createdAt: T2, editedAt: null },
];

export const fxChannels: ChatChannel[] = [
  { slug: "general", name: "#general", description: "Hang out", kind: "general", onlineCount: 2, slowModeSeconds: 0 },
  { slug: "help", name: "#help", description: "Quick questions", kind: "general", onlineCount: 0, slowModeSeconds: 0 },
  { slug: "showcase", name: "#showcase", description: "Show what you made", kind: "general", onlineCount: 0, slowModeSeconds: 0 },
  { slug: "gamedev", name: "#gamedev", description: "Games and engines", kind: "category", onlineCount: 1, slowModeSeconds: 5 },
];

export const fxChatMessages: ChatMessage[] = [
  { id: "fx_msg_1", channel: "general", author: fxUsers.bo, body: "fixture says hi 👋", createdAt: T2, reactions: [{ emoji: "👋", count: 1, viewerReacted: false }] },
];

const fxResourceBase: Resource = {
  id: "fx_res_1",
  slug: "fixture-plan-scaffold-ship",
  type: "workflow",
  title: "Fixture: plan → scaffold → test → ship",
  summary: "Dev fixture workflow resource",
  author: fxUsers.ada,
  license: "CC0-1.0",
  testedWith: [{ tool: "Claude Code", model: null, version: null }],
  proven: false,
  workedCount: 2,
  didntWorkCount: 0,
  rating: 4.5,
  ratingCount: 2,
  hasExecutableCode: false,
  createdAt: T0,
  updatedAt: T1,
};
export const fxResources: Resource[] = [fxResourceBase];
export const fxResourceDetail: ResourceDetail = {
  ...fxResourceBase,
  bodyMd: "## Fixture\n\n1. Plan\n2. Scaffold\n3. Test\n4. Ship",
  files: [],
  downloadUrl: null,
  linkedProjects: [],
  reports: [{ id: "fx_rr_1", author: fxUsers.bo, worked: true, note: "Fixture report", createdAt: T2 }],
  versions: [{ version: "1", createdAt: T0 }],
  scanFlags: [],
};

// ── Admin ────────────────────────────────────────────────────────────────

export const fxCandidates: Candidate[] = [
  {
    id: "fx_cand_1",
    repoUrl: "https://github.com/example/fixture-candidate",
    repoFullName: "example/fixture-candidate",
    name: "fixture-candidate",
    description: "Dev fixture candidate in the review queue",
    stars: 77,
    starVelocity: 12.5,
    license: null,
    lastCommitAt: T2,
    hasReadme: true,
    hasDemo: false,
    hasScreenshots: true,
    score: 63,
    checks: [
      { key: "license", label: "License detected", pass: false, detail: "No license (shown, not required)" },
      { key: "readme", label: "README exists", pass: true, detail: null },
      { key: "not_empty_fork", label: "Not an unchanged fork", pass: true, detail: null },
      { key: "not_archived", label: "Not archived", pass: true, detail: null },
      { key: "no_secrets", label: "No committed secrets", pass: null, detail: "Scan pending" },
      { key: "not_malware", label: "Not malware-flagged", pass: true, detail: null },
    ],
    status: "pending",
    foundVia: { kind: "manual", url: null },
    rejectReason: null,
    snoozedUntil: null,
    proposed: { name: "Fixture Candidate", tagline: "Dev fixture candidate", categorySlug: "developer-tools", tags: [], thumbnailUrl: null },
    project: null,
    createdAt: T2,
  },
];
