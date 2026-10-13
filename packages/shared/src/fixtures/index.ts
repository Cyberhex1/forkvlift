/**
 * DEV-ONLY. See data.ts. Maps every JSON route in the contract to a fixture
 * response so the UIs can be built before the real handlers exist.
 */
import type { ErrorCode } from "../api/errors";
import type { ParsedInput, RouteOutput } from "../api/define";
import type { RouteId, Routes } from "../api/routes";
import type { ProjectCard, ProjectRef } from "../schemas";
import { DEFAULT_USER_SETTINGS } from "../schemas/user";
import { SITE_NAME } from "../constants";
import {
  FIXTURE_MARKER,
  fxBoard,
  fxCandidates,
  fxCategories,
  fxChannels,
  fxChatMessages,
  fxCollections,
  fxComments,
  fxForumBoards,
  fxNotifications,
  fxPosts,
  fxProjectDetail,
  fxProjects,
  fxResourceDetail,
  fxResources,
  fxSessionUser,
  fxThreads,
  fxUsers,
} from "./data";

export * from "./data";

export class FixtureError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface FixtureContext {
  /** Fixture user id from the fv_dev_user cookie, or null when signed out. */
  viewerId: string | null;
}

type FixtureFn<K extends RouteId> = (input: ParsedInput<Routes[K]>, ctx: FixtureContext) => RouteOutput<Routes[K]>;
type JsonRouteId = { [K in RouteId]: Routes[K]["kind"] extends "json" ? K : never }[RouteId];

const NOW = "2026-10-10T12:00:00.000Z";
const ok = { ok: true as const };
const fxAdoptionRequest = {
  id: "fx_adreq_1",
  project: { id: "fx_prj_2", slug: "fixture-dungeon-toaster", name: "Fixture: Dungeon Toaster", author: null },
  requester: fxUsers.ada,
  message: "Dev fixture: I'd love to keep this going.",
  status: "pending" as const,
  createdAt: "2026-10-09T12:00:00.000Z",
  decidedAt: null,
};
const fxEvent = {
  id: "fx_evt_1", slug: "fixture-build-jam", kind: "build_jam" as const, title: "Fixture build jam: tiny tools",
  bodyMd: "Dev fixture. Theme: **tiny tools**.", startsAt: "2026-10-08T00:00:00.000Z", submissionEndsAt: "2026-10-12T00:00:00.000Z",
  votingEndsAt: "2026-10-15T00:00:00.000Z", featuredProject: null, status: "submitting" as const, entryCount: 1,
};
const fxEntry = () => ({
  id: "fx_entry_1", eventId: "fx_evt_1", project: fxProjects[0]!, submittedBy: fxUsers.ada,
  submittedAt: "2026-10-09T12:00:00.000Z", voteCount: 3, viewerVoted: false, rank: null,
});
const fxCompetition = {
  id: "fx_comp_1", slug: "fixture-tiny-tools-cup", eventSlug: "fixture-build-jam", title: "Fixture: Tiny Tools Cup",
  rulesMd: "Dev fixture rules.", eligibilityMd: "Public, openly licensed projects.", submissionEndsAt: "2026-10-12T00:00:00.000Z",
  judgingEndsAt: "2026-10-20T00:00:00.000Z", publishedAt: null, status: "open" as const,
  prizes: [{ id: "fx_prize_1", label: "Best tiny tool", descriptionMd: "Bragging rights.", sponsorName: null, sponsorUrl: null, place: 1 }],
  criteria: [{ id: "fx_crit_1", label: "Usefulness", description: "Does it help?", maxScore: 10, weight: 1 }],
  judges: [fxUsers.bo], version: 2,
};
const fxShowcase = (over: Partial<{ slug: string; title: string; kind: "web" | "mobile" | "desktop" | "game" | "art" | "video" | "tool" | "other"; hasPublicCode: boolean; status: "draft" | "published" }> = {}) => ({
  id: `fx_show_${over.slug ?? "pocket-chef"}`, slug: over.slug ?? "fixture-pocket-chef", title: over.title ?? "Fixture: Pocket Chef",
  tagline: "Dev fixture: an iPhone app that plans dinner from what is in the fridge.", maker: fxUsers.ada,
  category: { slug: "home-and-life", name: "Home and life", iconKey: "cat-home-and-life" }, kind: over.kind ?? ("mobile" as const), stage: "finished" as const,
  coverUrl: null, previewVideoUrl: null, hasPublicCode: over.hasPublicCode ?? false, catalogProject: null, aiTools: ["claude-code", "cursor"], tags: ["ios", "cooking"],
  upvotes: 12, commentCount: 1, staffPick: false, status: over.status ?? ("published" as const), publishedAt: "2026-10-08T12:00:00.000Z", updatedAt: NOW,
  viewer: null,
});
const fxShowcaseDetail = (over: Parameters<typeof fxShowcase>[0] = {}) => ({
  ...fxShowcase(over), bodyMd: "Dev fixture. **Not a real app.**", buildStoryMd: "Built over two weekends with Claude Code.", buildTime: "2 weekends", repoUrl: null,
  media: [{ id: "fx_smed_1", kind: "embed" as const, url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", alt: "Demo video" }],
  links: [{ kind: "app_store" as const, label: "App Store", url: "https://example.com/app" }],
  builtWith: { projects: [{ id: "fx_prj_2", slug: "fixture-dungeon-toaster", name: "Fixture: Dungeon Toaster", author: null }], resources: [] },
});
const fxShowcaseEntry = () => ({
  id: "fx_sentry_1", eventId: "fx_evt_2", showcase: fxShowcase(), submittedBy: fxUsers.ada, submittedAt: NOW, voteCount: 3, viewerVoted: false, rank: null,
});
const fxShowcaseComment = { id: "fx_scom_1", showcaseId: "fx_show_pocket-chef", parentId: null, author: fxUsers.bo, body: "Dev fixture comment.", createdAt: NOW, editedAt: null };
const fxAdoption = { open: true, note: "Dev fixture: looking for someone to take this on.", openedAt: "2026-10-01T12:00:00.000Z", originalAuthor: fxUsers.bo, maintainer: fxUsers.bo, viewerRequest: null, canManage: false };
const ref = (p: ProjectCard): ProjectRef => ({ id: p.id, slug: p.slug, name: p.name, author: p.author });
const viewer = (ctx: FixtureContext) => (ctx.viewerId ? fxSessionUser(ctx.viewerId) : null);
const me = (ctx: FixtureContext) => {
  const u = viewer(ctx);
  if (!u) throw new FixtureError("unauthorized", "Sign in first (fixture mode: use /api/dev/login)");
  return u;
};
const project = (slug: string) => {
  const p = fxProjectDetail(slug);
  if (!p) throw new FixtureError("not_found", `No fixture project "${slug}"`);
  return p;
};
const user = (username: string) => {
  const u = Object.values(fxUsers).find((x) => x.username === username);
  if (!u) throw new FixtureError("not_found", `No fixture user "${username}"`);
  return u;
};

function filterProjects(q: ParsedInput<Routes["listProjects"]>["query"]) {
  let items = fxProjects.slice();
  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter((p) => `${p.name} ${p.tagline} ${p.tags.join(" ")} ${p.replaces.join(" ")}`.toLowerCase().includes(needle));
  }
  if (q.category?.length) items = items.filter((p) => q.category!.includes(p.category.slug));
  if (q.stage?.length) items = items.filter((p) => q.stage!.includes(p.stage));
  if (q.source) items = items.filter((p) => p.source === q.source);
  if (q.replacesPaid) items = items.filter((p) => p.replaces.length > 0);
  if (q.template) items = items.filter((p) => p.isTemplate);
  const hidden = q.showUnlicensed ? 0 : items.filter((p) => !p.license).length;
  if (!q.showUnlicensed) items = items.filter((p) => p.license);
  switch (q.sort) {
    case "most_starred": items.sort((a, b) => b.stars - a.stars); break;
    case "most_forked": items.sort((a, b) => b.forks - a.forks); break;
    case "newest": items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
    case "recently_updated": items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); break;
    case "most_discussed": items.sort((a, b) => b.commentCount - a.commentCount); break;
    default: items.sort((a, b) => b.upvotes - a.upvotes);
  }
  return { items, nextCursor: null, hiddenUnlicensedCount: hidden };
}

export const routeFixtures: { [K in JsonRouteId]: FixtureFn<K> } & { marker: string } = {
  marker: FIXTURE_MARKER,

  health: () => ({ ok: true, name: SITE_NAME, environment: "local", fixtures: true }),
  siteConfig: () => ({ siteName: SITE_NAME, environment: "local", turnstileSiteKey: "1x00000000000000000000AA", githubLogin: true, magicLink: true, fixtures: true, siteOrigin: "http://localhost:8787" }),

  me: (_, ctx) => ({ user: viewer(ctx) }),
  magicLinkRequest: () => ok,
  logout: () => ok,

  listCategories: () => ({ items: fxCategories }),
  suggestCategory: () => ok,

  listProjects: ({ query }) => filterProjects(query),
  similarProjects: ({ query }) => ({ items: fxProjects.filter((p) => p.license).slice(0, query.limit ?? 3), showcases: [fxShowcase()] }),
  getProject: ({ params }) => project(params.slug),
  previewSubmission: ({ body }) => ({
    repoUrl: body.repoUrl,
    repoFullName: body.repoUrl.replace(/^https?:\/\/github\.com\//, ""),
    name: "fixture-submission",
    description: "Auto-filled from the fixture repo",
    license: null,
    stars: 3,
    language: "TypeScript",
    socialPreviewUrl: null,
    readmeHtml: "<p>Fixture README</p>",
    ownedByViewer: true,
    alreadyListed: null,
    warnings: ["No license found: this project will be hidden from most visitors by default."],
  }),
  createProject: ({ body }, ctx) => ({ ...project("fixture-pixel-planner"), name: body.name, author: me(ctx) }),
  updateProject: ({ params }) => project(params.slug),
  deleteProject: () => ok,
  voteProject: ({ body }) => ({ upvotes: 88 + body.value, viewerUpvoted: body.value === 1 }),
  listComments: ({ params }) => ({ items: fxComments.filter((c) => fxProjectDetail(params.slug)?.id === c.projectId), nextCursor: null }),
  createComment: ({ params, body }, ctx) => ({
    id: "fx_cmt_new", projectId: project(params.slug).id, parentId: body.parentId, author: me(ctx), body: body.body, upvotes: 0, createdAt: NOW, editedAt: null,
  }),
  getForkTree: ({ params }) => {
    const root = project(params.slug);
    return { root: { project: ref(root), children: [{ project: ref(fxProjects[1]!), children: [] }] }, total: 2 };
  },
  forkProject: ({ params }) => {
    const p = project(params.slug);
    if (!p.license) throw new FixtureError("forbidden", "Unlicensed projects can't be forked here; send a build-on request instead.");
    return { forkRepoUrl: `https://github.com/fx-you/${params.slug}`, studioCardId: "fx_card_new" };
  },
  claimProject: ({ params }) => ({ ...project(params.slug), claimed: true }),
  voteRoadmapItem: () => ({ votes: 7 }),

  createUpload: ({ body }) => ({ key: `fixture/${body.kind}/upload.bin`, uploadUrl: "/api/uploads/fixture%2Fupload.bin", expiresAt: NOW }),
  putUpload: ({ params }) => ({ key: params.key, url: "/favicon.svg" }),

  getProfile: ({ params }, ctx) => {
    const u = user(params.username);
    return {
      user: u,
      bio: "Dev fixture profile.",
      location: null,
      links: { github: `https://github.com/${u.username}`, website: null, socials: [], donation: null },
      stats: { projects: 3, forksOfWork: 41, forkedBy: 12 },
      badges: [{ badge: { key: "first-fork", name: "First Fork", description: "Forked a project", iconKey: "badge-first-fork" }, awardedAt: NOW }],
      showcase: fxProjects.filter((p) => p.author?.id === u.id && p.license),
      joinedAt: "2026-08-01T00:00:00.000Z",
      online: true,
      viewer: ctx.viewerId ? { isSelf: ctx.viewerId === u.id, following: false, blocked: false } : null,
    };
  },
  listUserProjects: ({ params }) => {
    const u = user(params.username);
    const mine = fxProjects.filter((p) => p.author?.id === u.id);
    return { items: mine.filter((p) => p.license), nextCursor: null, hiddenUnlicensedCount: mine.filter((p) => !p.license).length };
  },

  updateMe: (_, ctx) => routeFixtures.getProfile({ params: { username: me(ctx).username }, query: {}, body: undefined }, ctx),
  getSettings: (_, ctx) => me(ctx).settings,
  updateSettings: ({ body }, ctx) => {
    const { acceptUnlicensedDisclaimer, ...rest } = body;
    return { ...me(ctx).settings, ...rest, unlicensedDisclaimerAcceptedAt: acceptUnlicensedDisclaimer ? NOW : null };
  },
  updateAvatar: ({ body }) => body,
  setShowcase: ({ body }) => ({ projectIds: body.projectIds }),
  exportData: () => ({ status: "queued", downloadUrl: null }),
  listApiKeys: () => ({ items: [{ id: "fx_key_1", name: "My script", prefix: "fl_live_ab12", createdAt: "2026-10-01T12:00:00.000Z", lastUsedAt: null }] }),
  createApiKey: ({ body }) => ({ key: { id: "fx_key_2", name: body.name, prefix: "fl_live_cd34", createdAt: "2026-10-10T12:00:00.000Z", lastUsedAt: null }, secret: "fl_live_cd34_fixture_secret_not_real" }),
  revokeApiKey: () => ok,
  listShowcases: () => ({ items: [fxShowcase(), fxShowcase({ slug: "fixture-neon-drift", title: "Fixture: Neon Drift", kind: "game" })], nextCursor: null }),
  getShowcase: ({ params }) => fxShowcaseDetail({ slug: params.slug }),
  createShowcase: ({ body }) => ({ ...fxShowcaseDetail({ title: body.title, status: body.publish ? "published" : "draft" }), tagline: body.tagline }),
  updateShowcase: ({ params, body }) => ({ ...fxShowcaseDetail({ slug: params.slug }), ...(body.title ? { title: body.title } : {}) }),
  deleteShowcase: () => ok,
  myShowcases: () => ({ items: [fxShowcase({ status: "draft", slug: "fixture-draft", title: "Fixture: Draft idea" })], nextCursor: null }),
  savedShowcases: () => ({ items: [fxShowcase()], nextCursor: null }),
  userShowcases: () => ({ items: [fxShowcase()], nextCursor: null }),
  voteShowcase: ({ body }) => ({ upvotes: 12 + body.value, upvoted: body.value === 1 }),
  saveShowcase: ({ body }) => ({ saved: body.saved }),
  listShowcaseComments: () => ({ items: [fxShowcaseComment], nextCursor: null }),
  createShowcaseComment: ({ body }) => ({ ...fxShowcaseComment, id: "fx_scom_2", body: body.body, parentId: body.parentId }),
  deleteShowcaseComment: () => ok,
  listShowcaseInCatalog: ({ params }) => ({
    showcase: { ...fxShowcaseDetail({ slug: params.slug, hasPublicCode: true }), repoUrl: "https://github.com/example/fixture" },
    project: ref(fxProjects[0]!),
    carriedOver: { upvotes: 0, comments: 0 },
  }),
  projectShowcases: () => ({ items: [fxShowcase()], nextCursor: null }),
  resourceShowcases: () => ({ items: [fxShowcase()], nextCursor: null }),
  setShowcaseStaffPick: () => ok,
  listCompetitions: () => ({ items: [fxCompetition], nextCursor: null }),
  getCompetition: () => fxCompetition,
  getCompetitionWinners: () => ({ competition: fxCompetition, awards: [] }),
  getCompetitionJudging: () => ({ competition: { ...fxCompetition, status: "judging" as const }, entries: [fxEntry()], scorecards: [], conflicts: [] }),
  saveCompetitionScorecard: ({ params, body }) => ({ entryId: params.entryId, scores: body.scores, note: body.note, submittedAt: body.submit ? NOW : null }),
  createCompetition: ({ body }) => ({ ...fxCompetition, slug: body.slug, title: body.title, status: "draft" as const }),
  updateCompetition: ({ body }) => ({ ...fxCompetition, status: body.cancelled ? ("cancelled" as const) : fxCompetition.status }),
  getCompetitionScores: () => ({ items: [{ entry: fxEntry(), total: 0.8, scorecards: 1, judges: 1 }] }),
  publishCompetitionWinners: () => ({ competition: { ...fxCompetition, status: "published" as const, publishedAt: NOW }, awards: [{ id: "fx_award_1", prize: fxCompetition.prizes[0]!, entry: fxEntry(), rationaleMd: "Dev fixture.", announcedAt: NOW }] }),
  listGrowthEvents: () => ({ items: [fxEvent], nextCursor: null }),
  getGrowthEvent: () => ({ ...fxEvent, viewerCanSubmit: true, viewerCanVote: false, viewerBallot: null }),
  listGrowthEventEntries: () => ({ items: [fxEntry()], nextCursor: null }),
  submitGrowthEntry: () => fxEntry(),
  withdrawGrowthEntry: () => ok,
  voteGrowthEntry: ({ body }) => ({ entryId: body.entryId }),
  listShowcaseEventEntries: () => ({ items: [fxShowcaseEntry()], nextCursor: null }),
  submitShowcaseEntry: () => fxShowcaseEntry(),
  withdrawShowcaseEntry: () => ok,
  createGrowthEvent: ({ body }) => ({ ...fxEvent, ...body, featuredProject: null, status: "scheduled" as const, entryCount: 0 }),
  updateGrowthEvent: ({ body }) => ({ ...fxEvent, ...(body.title ? { title: body.title } : {}), status: body.cancelled ? ("cancelled" as const) : fxEvent.status }),
  getProjectAdoption: () => fxAdoption,
  setProjectAdoption: ({ body }) => ({ ...fxAdoption, open: body.open, note: body.note, canManage: true }),
  requestProjectAdoption: ({ body }) => ({ ...fxAdoptionRequest, message: body.message }),
  listProjectAdoptionRequests: () => ({ items: [fxAdoptionRequest], nextCursor: null }),
  withdrawProjectAdoptionRequest: () => ok,
  decideProjectAdoption: ({ body }) => ({ request: { ...fxAdoptionRequest, status: body.decision === "approve" ? ("approved" as const) : ("declined" as const), decidedAt: "2026-10-10T12:00:00.000Z" }, adoption: { ...fxAdoption, open: body.decision !== "approve" } }),
  subscribeNewsletter: () => ({ ok: true as const, status: "pending" as const }),
  confirmNewsletter: () => ok,
  unsubscribeNewsletter: () => ok,
  deleteAccount: () => ok,

  listFollowing: () => ({ items: [{ targetType: "user", targetId: fxUsers.bo.id, label: fxUsers.bo.displayName, href: `/u/${fxUsers.bo.username}`, createdAt: NOW }], nextCursor: null }),
  follow: () => ok,
  unfollow: () => ok,
  listUserCollections: ({ params }, ctx) => {
    const u = user(params.username);
    return { items: fxCollections.filter((c) => c.owner.id === u.id && (c.isPublic || ctx.viewerId === u.id)) };
  },
  getCollection: ({ params }) => {
    const c = fxCollections.find((x) => x.id === params.id);
    if (!c) throw new FixtureError("not_found", "No such fixture collection");
    return { collection: c, items: fxProjects.slice(0, c.itemCount) };
  },
  createCollection: ({ body }, ctx) => ({ id: "fx_col_new", ...body, isDefault: false, owner: me(ctx), itemCount: 0, updatedAt: NOW }),
  updateCollection: ({ params, body }) => ({ ...(fxCollections.find((c) => c.id === params.id) ?? fxCollections[1]!), ...body }),
  deleteCollection: () => ok,
  addCollectionItem: () => ok,
  removeCollectionItem: () => ok,

  getBoard: (_, ctx) => (me(ctx), fxBoard),
  createColumn: ({ body }) => ({ id: "fx_col_new", title: body.title, color: null, position: fxBoard.columns.length, collapsed: false, wipLimit: null }),
  updateColumn: ({ params, body }) => ({ ...(fxBoard.columns.find((c) => c.id === params.id) ?? fxBoard.columns[0]!), ...body }),
  deleteColumn: () => ok,
  reorderColumns: ({ body }) => ({
    columns: body.columnIds.flatMap((id, position) => {
      const c = fxBoard.columns.find((x) => x.id === id);
      return c ? [{ ...c, position }] : [];
    }),
  }),
  createCard: ({ body }) => ({ id: "fx_card_new", columnId: body.columnId, position: 0, title: body.title, idea: body.idea, stage: "wip", isPublic: false, project: null, updatedAt: NOW }),
  updateCard: ({ params, body }) => ({ ...(fxBoard.cards.find((c) => c.id === params.id) ?? fxBoard.cards[0]!), ...body, updatedAt: NOW }),
  moveCard: ({ params, body }) => ({ ...(fxBoard.cards.find((c) => c.id === params.id) ?? fxBoard.cards[0]!), ...body, updatedAt: NOW }),
  deleteCard: () => ok,
  getPlan: ({ params }) => ({
    cardId: params.id,
    checklist: [{ id: "fx_chk_1", text: "Fixture task", done: false }],
    notesMd: "Fixture notes",
    roadmap: [{ id: "fx_rm_1", title: "Fixture: dark mode", status: "planned", votes: 6 }],
    lookingForHelp: "Sound design",
    savedPrompts: [],
    githubIssuesSync: false,
  }),
  updatePlan: ({ params, body }) => ({ ...routeFixtures.getPlan({ params, query: {}, body: undefined }, { viewerId: null }), ...body }),

  listConversations: (_, ctx) => ({
    items: [{ id: "fx_conv_1", participants: [me(ctx), fxUsers.bo], lastMessagePreview: "Fixture DM", unreadCount: 1, updatedAt: NOW }],
    nextCursor: null,
  }),
  startConversation: ({ body }, ctx) => ({ id: "fx_conv_new", participants: [me(ctx), user(body.username)], lastMessagePreview: body.body.slice(0, 200), unreadCount: 0, updatedAt: NOW }),
  listMessages: ({ params }) => ({ items: [{ id: "fx_dm_1", conversationId: params.id, sender: fxUsers.bo, body: "Fixture DM", createdAt: NOW }], nextCursor: null }),
  sendMessage: ({ params, body }, ctx) => ({ id: "fx_dm_new", conversationId: params.id, sender: me(ctx), body: body.body, createdAt: NOW }),
  listCollabRequests: (_, ctx) => ({
    items: [{ id: "fx_collab_1", from: fxUsers.bo, to: me(ctx), project: ref(fxProjects[0]!), kind: "collab", role: "Pixel art", availability: "Weekends", message: "Fixture collab request", status: "pending", createdAt: NOW }],
    nextCursor: null,
  }),
  createCollabRequest: ({ body }, ctx) => ({
    id: "fx_collab_new", from: me(ctx), to: user(body.toUsername), project: null, kind: body.kind, role: body.role, availability: body.availability, message: body.message, status: "pending", createdAt: NOW,
  }),
  respondCollabRequest: ({ body }, ctx) => ({
    id: "fx_collab_1", from: fxUsers.bo, to: me(ctx), project: null, kind: "collab", role: "Pixel art", availability: "Weekends", message: "Fixture", status: body.accept ? "accepted" : "declined", createdAt: NOW,
  }),
  listBlocks: () => ({ items: [] }),
  blockUser: () => ok,
  unblockUser: () => ok,

  listNotifications: () => ({ items: fxNotifications, nextCursor: null, unreadCount: fxNotifications.filter((n) => !n.read).length }),
  markNotificationsRead: () => ({ unreadCount: 0 }),

  listForumBoards: () => ({ items: fxForumBoards }),
  listThreads: ({ params }) => ({ items: fxThreads.filter((t) => t.boardSlug === params.slug), nextCursor: null }),
  createThread: ({ params, body }, ctx) => {
    const thread = { ...fxThreads[0]!, id: "fx_thr_new", boardSlug: params.slug, title: body.title, tags: body.tags, author: me(ctx), replyCount: 0, solved: false, createdAt: NOW, lastActivityAt: NOW };
    return { thread, posts: [{ ...fxPosts[0]!, id: "fx_post_new", threadId: thread.id, author: me(ctx), bodyMd: body.bodyMd, createdAt: NOW }], nextCursor: null };
  },
  getThread: ({ params }) => {
    const thread = fxThreads.find((t) => t.id === params.id);
    if (!thread) throw new FixtureError("not_found", "No such fixture thread");
    return { thread, posts: fxPosts.filter((p) => p.threadId === thread.id), nextCursor: null };
  },
  createPost: ({ params, body }, ctx) => ({ id: "fx_post_new", threadId: params.id, author: me(ctx), bodyMd: body.bodyMd, upvotes: 0, isSolution: false, createdAt: NOW, editedAt: null }),
  votePost: ({ body }) => ({ upvotes: 5 + body.value }),
  markSolved: ({ params }) => ({ ...(fxThreads.find((t) => t.id === params.id) ?? fxThreads[0]!), solved: true }),

  listChannels: () => ({ items: fxChannels }),
  channelHistory: ({ params }) => ({ items: fxChatMessages.filter((m) => m.channel === params.slug), nextCursor: null }),

  listResources: () => ({ items: fxResources, nextCursor: null }),
  getResource: ({ params }) => {
    if (params.slug !== fxResourceDetail.slug) throw new FixtureError("not_found", "No such fixture resource");
    return fxResourceDetail;
  },
  createResource: ({ body }, ctx) => ({ ...fxResourceDetail, id: "fx_res_new", slug: "fixture-new-resource", title: body.title, summary: body.summary, author: me(ctx) }),
  reportResourceResult: () => fxResources[0]!,
  rateResource: () => fxResources[0]!,

  createReport: () => ok,

  listRequests: () => ({
    items: [{ id: "fx_req_1", title: "Fixture request: free Figma-lite", bodyMd: "Dev fixture request", author: fxUsers.bo, replaces: "Figma", status: "open", claimedBy: null, builtProject: null, upvotes: 14, createdAt: NOW }],
    nextCursor: null,
  }),
  getRequest: ({ params }) => ({ id: params.id, title: "Fixture request: free Figma-lite", bodyMd: "Dev fixture request", author: fxUsers.bo, replaces: "Figma", status: "open", claimedBy: null, builtProject: null, upvotes: 14, createdAt: NOW }),
  createRequest: ({ body }, ctx) => ({ id: "fx_req_new", title: body.title, bodyMd: body.bodyMd, author: me(ctx), replaces: body.replaces, status: "open", claimedBy: null, builtProject: null, upvotes: 0, createdAt: NOW }),
  claimRequest: ({ params }, ctx) => ({ id: params.id, title: "Fixture request: free Figma-lite", bodyMd: "Dev fixture request", author: fxUsers.bo, replaces: "Figma", status: "claimed", claimedBy: me(ctx), builtProject: null, upvotes: 14, createdAt: NOW }),

  listAlternatives: () => ({ items: [{ slug: "notion", name: "Notion", projectCount: 1, monthlyPriceUsd: 10 }, { slug: "trello", name: "Trello", projectCount: 1, monthlyPriceUsd: 5 }] }),
  getAlternatives: ({ params, query }) => {
    const matches = fxProjects.filter((p) => p.replaces.some((r) => r.toLowerCase() === params.product));
    const shown = query.showUnlicensed ? matches : matches.filter((p) => p.license);
    return { product: { slug: params.product, name: params.product, projectCount: matches.length, monthlyPriceUsd: null }, items: shown, hiddenUnlicensedCount: matches.length - shown.length };
  },
  savingsStats: () => ({ estimatedMonthlySavingsUsd: 0, forkCount: 0, asOf: NOW }),

  listCandidates: () => ({ items: fxCandidates, nextCursor: null }),
  importCandidate: ({ body }) => ({ ...fxCandidates[0]!, id: "fx_cand_new", repoUrl: body.repoUrl, foundVia: { kind: body.foundViaUrl ? "reddit_link" : "manual", url: body.foundViaUrl } }),
  decideCandidate: ({ params, body }) => ({
    ...(fxCandidates.find((c) => c.id === params.id) ?? fxCandidates[0]!),
    status: ({ approve_publish: "published", approve_draft: "draft", reject: "rejected", snooze: "snoozed" } as const)[body.action],
    rejectReason: body.action === "reject" ? body.reason : null,
  }),
  bulkDecideCandidates: ({ body }) => ({ updated: body.ids.length }),
  suggestCandidateCategories: () => ({ updated: 0 }),
  runDiscovery: () => ({ queued: 0 }),
  listReports: () => ({
    items: [{ id: "fx_rep_1", targetType: "comment", targetId: "fx_cmt_1", reason: "spam", note: "Fixture report", status: "open", reporter: fxUsers.bo, targetLabel: "Comment on Fixture: Pixel Planner", targetHref: "/p/fixture-pixel-planner", createdAt: NOW }],
    nextCursor: null,
  }),
  moderateChat: () => ({ ok: true, slowModeSeconds: 0 }),
  resolveReport: ({ params, body }) => ({ id: params.id, targetType: "project", targetId: "fx_prj_1", reason: "spam", note: "", status: body.outcome, reporter: null, targetLabel: "Fixture: Pixel Planner", targetHref: "/p/fixture-pixel-planner", createdAt: NOW }),
  upsertCategory: ({ params, body }) => ({ slug: params.slug, name: body.name, parentSlug: body.parentSlug, iconKey: body.iconKey, description: body.description, projectCount: 0 }),
  setStaffPick: () => ok,
  setResourceProven: () => ok,
  banUser: () => ok,
  adminStats: () => ({ signups: { total: 3, last7d: 1 }, projects: { total: 5, last7d: 2, unlicensed: 1 }, forkClicks: { last7d: 9 }, chat: { messagesLast7d: 1 }, queue: { pending: 1 } }),
  auditLog: () => ({ items: [], nextCursor: null }),
};

/** Default settings re-exported so dev tools can build a session without the DB. */
export const fixtureDefaultSettings = DEFAULT_USER_SETTINGS;
