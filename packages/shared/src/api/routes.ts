/**
 * THE API CONTRACT. Every endpoint the Worker serves is declared here, with its
 * input and output schemas. Clients call routes by id (see client.ts); the Worker
 * registers a handler for every id (apps/worker/src/routes). Opus owns this file;
 * request changes through docs/contract-requests/.
 */
import { z } from "zod";
import {
  AdminStats,
  AiInvolvement,
  AiTool,
  AlternativeProduct,
  AuditLogEntry,
  AvatarConfig,
  BlockedUser,
  Board,
  BoardCard,
  BoardColumn,
  BuildRequest,
  Candidate,
  CandidateAction,
  CandidateStatus,
  Category,
  ChatChannel,
  ChatMessage,
  Collection,
  CollectionDetail,
  CollabRequest,
  Comment,
  Conversation,
  csv,
  Difficulty,
  DirectMessage,
  Follow,
  FollowTarget,
  ForkTree,
  ForumBoard,
  Id,
  Markdown,
  Notification,
  OkResponse,
  page,
  PageQuery,
  Platform,
  Post,
  Profile,
  ProfileLinks,
  ProjectCard,
  ProjectDetail,
  ProjectPlan,
  ProjectSort,
  ProjectSource,
  ProjectStage,
  QueryBool,
  QueryLimit,
  Report,
  ReportReason,
  ReportTarget,
  Resource,
  ResourceDetail,
  ResourceType,
  SavingsStats,
  SessionUser,
  Slug,
  SubmissionPreview,
  Thread,
  ThreadDetail,
  Url,
  UserSettings,
  Username,
} from "../schemas";
import { LIMITS } from "../constants";
import { route, type RouteDef } from "./define";

// ── Shared pieces ────────────────────────────────────────────────────────

const SlugParams = z.object({ slug: Slug });
const IdParams = z.object({ id: Id });
const UsernameParams = z.object({ username: Username });
const TurnstileToken = z.string().max(2048);

export const ListProjectsQuery = PageQuery.extend({
  q: z.string().max(200).optional(),
  sort: ProjectSort.optional(),
  category: csv(Slug).optional(),
  license: csv(z.string().max(60)).optional(),
  stack: csv(z.string().max(40)).optional(),
  platform: csv(Platform).optional(),
  aiTool: csv(AiTool).optional(),
  stage: csv(ProjectStage).optional(),
  difficulty: csv(Difficulty).optional(),
  hasDemo: QueryBool.optional(),
  hasRelease: QueryBool.optional(),
  maintained: QueryBool.optional(),
  replacesPaid: QueryBool.optional(),
  replaces: z.string().max(60).optional(),
  source: ProjectSource.optional(),
  template: QueryBool.optional(),
  /** Unlicensed projects are excluded unless this is true. */
  showUnlicensed: QueryBool.optional(),
});
export type ListProjectsQuery = z.output<typeof ListProjectsQuery>;

export const ListProjectsResponse = page(ProjectCard).extend({
  /** How many unlicensed matches were hidden ("4 unlicensed projects hidden · Show them"). */
  hiddenUnlicensedCount: z.number().int().nonnegative(),
});

const ProjectWrite = z.object({
  name: z.string().min(1).max(100),
  tagline: z.string().max(LIMITS.taglineMax),
  description: z.string().max(LIMITS.descriptionMax),
  categorySlug: Slug,
  tags: z.array(z.string().max(40)).max(LIMITS.maxTags),
  stage: ProjectStage,
  isPublic: z.boolean(),
  liveUrl: Url.nullable(),
  releaseUrl: Url.nullable(),
  stack: z.array(z.string().max(40)).max(20),
  platforms: z.array(Platform),
  difficulty: Difficulty.nullable(),
  aiTools: z.array(AiTool),
  buildTime: z.string().max(60).nullable(),
  aiInvolvement: AiInvolvement.nullable(),
  replaces: z.array(z.string().max(60)).max(5),
  isTemplate: z.boolean(),
  whatWorks: z.string().max(1000).nullable(),
  whatsMissing: z.string().max(1000).nullable(),
  lookingForHelp: z.string().max(500).nullable(),
  thumbnailKey: z.string().max(200).nullable(),
  mediaKeys: z.array(z.string().max(200)).max(12),
});

const CreateProjectBody = ProjectWrite.extend({
  /** null for an idea-only project with no repo yet (stays private or publishes as an Idea). */
  repoUrl: Url.nullable(),
  forkedFromSlug: Slug.nullable(),
  turnstileToken: TurnstileToken,
});

const UploadKind = z.enum(["thumbnail", "media", "avatar", "resource"]);

// ── Routes ───────────────────────────────────────────────────────────────

export const routes = {
  // meta
  health: route({
    method: "GET", path: "/api/health", auth: "public", kind: "json", area: "meta",
    summary: "Liveness check",
    response: z.object({ ok: z.literal(true), name: z.string(), environment: z.string(), fixtures: z.boolean() }),
  }),
  siteConfig: route({
    method: "GET", path: "/api/config", auth: "public", kind: "json", area: "meta",
    summary: "Public runtime config for the clients",
    response: z.object({
      siteName: z.string(),
      environment: z.string(),
      turnstileSiteKey: z.string().nullable(),
      githubLogin: z.boolean(),
      magicLink: z.boolean(),
      fixtures: z.boolean(),
      /** Public site origin, for links from the admin console. */
      siteOrigin: z.string(),
    }),
  }),

  // auth
  me: route({
    method: "GET", path: "/api/auth/me", auth: "public", kind: "json", area: "auth",
    summary: "The signed-in user, or null",
    response: z.object({ user: SessionUser.nullable() }),
  }),
  githubStart: route({
    method: "GET", path: "/api/auth/github", auth: "public", kind: "redirect", area: "auth",
    summary: "Start GitHub OAuth",
    query: z.object({ returnTo: z.string().max(500).optional() }),
  }),
  githubCallback: route({
    method: "GET", path: "/api/auth/github/callback", auth: "public", kind: "redirect", area: "auth",
    summary: "GitHub OAuth callback",
    query: z.object({ code: z.string().max(200).optional(), state: z.string().max(200).optional(), error: z.string().max(200).optional() }),
  }),
  magicLinkRequest: route({
    method: "POST", path: "/api/auth/magic-link", auth: "public", kind: "json", area: "auth",
    summary: "Email a sign-in link",
    body: z.object({ email: z.email(), turnstileToken: TurnstileToken, returnTo: z.string().max(500).optional() }),
    response: OkResponse,
  }),
  magicLinkVerify: route({
    method: "GET", path: "/api/auth/magic-link/verify", auth: "public", kind: "redirect", area: "auth",
    summary: "Consume a sign-in link",
    query: z.object({ token: z.string().max(200) }),
  }),
  logout: route({
    method: "POST", path: "/api/auth/logout", auth: "public", kind: "json", area: "auth",
    summary: "End the session",
    response: OkResponse,
  }),

  // categories
  listCategories: route({
    method: "GET", path: "/api/categories", auth: "public", kind: "json", area: "categories",
    summary: "All active categories and sub-categories",
    response: z.object({ items: z.array(Category) }),
  }),
  suggestCategory: route({
    method: "POST", path: "/api/categories/suggestions", auth: "user", kind: "json", area: "categories",
    summary: "Suggest a new category (admin approves)",
    body: z.object({ name: z.string().min(2).max(60), parentSlug: Slug.nullable(), reason: z.string().max(500) }),
    response: OkResponse,
  }),

  // projects
  listProjects: route({
    method: "GET", path: "/api/projects", auth: "public", kind: "json", area: "projects",
    summary: "Feed: search, filter, sort, paginate",
    query: ListProjectsQuery,
    response: ListProjectsResponse,
  }),
  similarProjects: route({
    method: "GET", path: "/api/search/similar", auth: "public", kind: "json", area: "projects",
    summary: "\"Has this been built?\" check",
    query: z.object({ q: z.string().min(3).max(300), limit: QueryLimit.optional() }),
    response: z.object({ items: z.array(ProjectCard) }),
  }),
  getProject: route({
    method: "GET", path: "/api/projects/:slug", auth: "public", kind: "json", area: "projects",
    summary: "Focus panel data (unlicensed projects open by direct link)",
    params: SlugParams,
    response: ProjectDetail,
  }),
  previewSubmission: route({
    method: "POST", path: "/api/projects/preview", auth: "user", kind: "json", area: "projects",
    summary: "Paste a GitHub URL → auto-filled preview",
    body: z.object({ repoUrl: Url }),
    response: SubmissionPreview,
  }),
  createProject: route({
    method: "POST", path: "/api/projects", auth: "user", kind: "json", area: "projects",
    summary: "Submit a project",
    body: CreateProjectBody,
    response: ProjectDetail,
  }),
  updateProject: route({
    method: "PATCH", path: "/api/projects/:slug", auth: "user", kind: "json", area: "projects",
    summary: "Edit your project",
    params: SlugParams,
    body: ProjectWrite.partial(),
    response: ProjectDetail,
  }),
  deleteProject: route({
    method: "DELETE", path: "/api/projects/:slug", auth: "user", kind: "json", area: "projects",
    summary: "Remove your project",
    params: SlugParams,
    response: OkResponse,
  }),
  voteProject: route({
    method: "POST", path: "/api/projects/:slug/vote", auth: "user", kind: "json", area: "projects",
    summary: "Upvote (1) or clear (0)",
    params: SlugParams,
    body: z.object({ value: z.union([z.literal(0), z.literal(1)]) }),
    response: z.object({ upvotes: z.number().int(), viewerUpvoted: z.boolean() }),
  }),
  listComments: route({
    method: "GET", path: "/api/projects/:slug/comments", auth: "public", kind: "json", area: "projects",
    summary: "Project comments",
    params: SlugParams,
    query: PageQuery,
    response: page(Comment),
  }),
  createComment: route({
    method: "POST", path: "/api/projects/:slug/comments", auth: "user", kind: "json", area: "projects",
    summary: "Comment on a project",
    params: SlugParams,
    body: z.object({ body: Markdown.min(1), parentId: Id.nullable(), turnstileToken: TurnstileToken }),
    response: Comment,
  }),
  getForkTree: route({
    method: "GET", path: "/api/projects/:slug/fork-tree", auth: "public", kind: "json", area: "projects",
    summary: "Lineage graph",
    params: SlugParams,
    response: ForkTree,
  }),
  forkProject: route({
    method: "POST", path: "/api/projects/:slug/fork", auth: "user", kind: "json", area: "projects",
    summary: "\"Continue this\": fork to the viewer's GitHub (licensed only) and add to Studio",
    params: SlugParams,
    response: z.object({ forkRepoUrl: Url, studioCardId: Id }),
  }),
  claimProject: route({
    method: "POST", path: "/api/projects/:slug/claim", auth: "user", kind: "json", area: "projects",
    summary: "Claim a curated project (GitHub owner only)",
    params: SlugParams,
    response: ProjectDetail,
  }),
  voteRoadmapItem: route({
    method: "POST", path: "/api/projects/:slug/roadmap/:itemId/vote", auth: "user", kind: "json", area: "projects",
    summary: "Upvote a public roadmap item",
    params: z.object({ slug: Slug, itemId: Id }),
    response: z.object({ votes: z.number().int() }),
  }),

  // uploads
  createUpload: route({
    method: "POST", path: "/api/uploads", auth: "user", kind: "json", area: "uploads",
    summary: "Reserve an upload slot",
    body: z.object({ kind: UploadKind, contentType: z.string().max(100), size: z.number().int().positive().max(25 * 1024 * 1024) }),
    response: z.object({ key: z.string(), uploadUrl: z.string(), expiresAt: z.string() }),
  }),
  putUpload: route({
    method: "PUT", path: "/api/uploads/:key", auth: "user", kind: "json", area: "uploads",
    summary: "Upload the bytes for a reserved key (raw body, Content-Type as reserved)",
    params: z.object({ key: z.string().max(200) }),
    response: z.object({ key: z.string(), url: z.string() }),
  }),
  getMedia: route({
    method: "GET", path: "/api/media/:key", auth: "public", kind: "text", area: "uploads",
    summary: "Serve an uploaded file. Images accept ?w= (resized when Cloudflare Images is enabled)",
    params: z.object({ key: z.string().max(200) }),
    query: z.object({ w: z.coerce.number().int().min(16).max(2048).optional() }),
  }),

  // users (public profiles)
  getProfile: route({
    method: "GET", path: "/api/users/:username", auth: "public", kind: "json", area: "users",
    summary: "Profile page",
    params: UsernameParams,
    response: Profile,
  }),
  listUserProjects: route({
    method: "GET", path: "/api/users/:username/projects", auth: "public", kind: "json", area: "users",
    summary: "Profile tabs: projects or forks",
    params: UsernameParams,
    query: PageQuery.extend({ tab: z.enum(["projects", "forks"]).optional(), showUnlicensed: QueryBool.optional() }),
    response: page(ProjectCard).extend({ hiddenUnlicensedCount: z.number().int().nonnegative() }),
  }),

  // me (account)
  updateMe: route({
    method: "PATCH", path: "/api/me", auth: "user", kind: "json", area: "me",
    summary: "Edit username, display name, bio, links",
    body: z.object({
      username: Username,
      displayName: z.string().max(80),
      bio: z.string().max(2000),
      location: z.string().max(80).nullable(),
      links: ProfileLinks,
    }).partial(),
    response: Profile,
  }),
  getSettings: route({
    method: "GET", path: "/api/me/settings", auth: "user", kind: "json", area: "me",
    summary: "Account settings",
    response: UserSettings,
  }),
  updateSettings: route({
    method: "PATCH", path: "/api/me/settings", auth: "user", kind: "json", area: "me",
    summary: "Change settings (turning on showUnlicensed records the disclaimer acceptance)",
    body: UserSettings.omit({ unlicensedDisclaimerAcceptedAt: true }).partial().extend({
      acceptUnlicensedDisclaimer: z.boolean().optional(),
    }),
    response: UserSettings,
  }),
  updateAvatar: route({
    method: "PUT", path: "/api/me/avatar", auth: "user", kind: "json", area: "me",
    summary: "Save the 16-bit avatar",
    body: AvatarConfig,
    response: AvatarConfig,
  }),
  setShowcase: route({
    method: "PUT", path: "/api/me/showcase", auth: "user", kind: "json", area: "me",
    summary: "Pin up to 6 projects",
    body: z.object({ projectIds: z.array(Id).max(LIMITS.showcaseMax) }),
    response: z.object({ projectIds: z.array(Id) }),
  }),
  exportData: route({
    method: "POST", path: "/api/me/export", auth: "user", kind: "json", area: "me",
    summary: "Start a JSON export of everything you've made",
    response: z.object({ status: z.enum(["queued", "ready"]), downloadUrl: z.string().nullable() }),
  }),
  downloadExport: route({
    method: "GET", path: "/api/me/export", auth: "user", kind: "text", area: "me",
    summary: "Download the export as a JSON file (built on request)",
  }),
  deleteAccount: route({
    method: "DELETE", path: "/api/me", auth: "user", kind: "json", area: "me",
    summary: "Delete the account",
    body: z.object({ confirmUsername: Username }),
    response: OkResponse,
  }),

  // social: follows + collections (Sol, task 2.5)
  listFollowing: route({
    method: "GET", path: "/api/me/following", auth: "user", kind: "json", area: "social",
    summary: "What the viewer follows",
    query: PageQuery,
    response: page(Follow),
  }),
  follow: route({
    method: "POST", path: "/api/follows", auth: "user", kind: "json", area: "social",
    summary: "Follow a user, category or project",
    body: z.object({ targetType: FollowTarget, targetId: Id }),
    response: OkResponse,
  }),
  unfollow: route({
    method: "DELETE", path: "/api/follows", auth: "user", kind: "json", area: "social",
    summary: "Unfollow",
    body: z.object({ targetType: FollowTarget, targetId: Id }),
    response: OkResponse,
  }),
  listUserCollections: route({
    method: "GET", path: "/api/users/:username/collections", auth: "public", kind: "json", area: "social",
    summary: "A user's collections (private ones only for the owner)",
    params: UsernameParams,
    response: z.object({ items: z.array(Collection) }),
  }),
  getCollection: route({
    method: "GET", path: "/api/collections/:id", auth: "public", kind: "json", area: "social",
    summary: "Collection with its projects",
    params: IdParams,
    response: CollectionDetail,
  }),
  createCollection: route({
    method: "POST", path: "/api/collections", auth: "user", kind: "json", area: "social",
    summary: "New collection",
    body: z.object({ name: z.string().min(1).max(80), description: z.string().max(500), isPublic: z.boolean() }),
    response: Collection,
  }),
  updateCollection: route({
    method: "PATCH", path: "/api/collections/:id", auth: "user", kind: "json", area: "social",
    summary: "Rename / change visibility",
    params: IdParams,
    body: z.object({ name: z.string().min(1).max(80), description: z.string().max(500), isPublic: z.boolean() }).partial(),
    response: Collection,
  }),
  deleteCollection: route({
    method: "DELETE", path: "/api/collections/:id", auth: "user", kind: "json", area: "social",
    summary: "Delete a collection",
    params: IdParams,
    response: OkResponse,
  }),
  addCollectionItem: route({
    method: "POST", path: "/api/collections/:id/items", auth: "user", kind: "json", area: "social",
    summary: "Save a project into a collection",
    params: IdParams,
    body: z.object({ projectId: Id }),
    response: OkResponse,
  }),
  removeCollectionItem: route({
    method: "DELETE", path: "/api/collections/:id/items/:projectId", auth: "user", kind: "json", area: "social",
    summary: "Remove a project from a collection",
    params: z.object({ id: Id, projectId: Id }),
    response: OkResponse,
  }),

  // studio
  getBoard: route({
    method: "GET", path: "/api/studio/board", auth: "user", kind: "json", area: "studio",
    summary: "The viewer's kanban board (created with default columns on first visit)",
    response: Board,
  }),
  createColumn: route({
    method: "POST", path: "/api/studio/columns", auth: "user", kind: "json", area: "studio",
    summary: "Add a column",
    body: z.object({ title: z.string().min(1).max(60) }),
    response: BoardColumn,
  }),
  updateColumn: route({
    method: "PATCH", path: "/api/studio/columns/:id", auth: "user", kind: "json", area: "studio",
    summary: "Rename, recolor, collapse, set WIP limit",
    params: IdParams,
    body: BoardColumn.pick({ title: true, color: true, collapsed: true, wipLimit: true }).partial(),
    response: BoardColumn,
  }),
  deleteColumn: route({
    method: "DELETE", path: "/api/studio/columns/:id", auth: "user", kind: "json", area: "studio",
    summary: "Delete a column (cards move to the first column)",
    params: IdParams,
    response: OkResponse,
  }),
  reorderColumns: route({
    method: "PUT", path: "/api/studio/columns/order", auth: "user", kind: "json", area: "studio",
    summary: "Set column order",
    body: z.object({ columnIds: z.array(Id) }),
    response: z.object({ columns: z.array(BoardColumn) }),
  }),
  createCard: route({
    method: "POST", path: "/api/studio/cards", auth: "user", kind: "json", area: "studio",
    summary: "Add a card (idea, or link an existing project)",
    body: z.object({ columnId: Id, title: z.string().min(1).max(100), idea: z.string().max(1000).nullable(), projectId: Id.nullable() }),
    response: BoardCard,
  }),
  updateCard: route({
    method: "PATCH", path: "/api/studio/cards/:id", auth: "user", kind: "json", area: "studio",
    summary: "Edit a card, toggle Public/Private, change stage",
    params: IdParams,
    body: BoardCard.pick({ title: true, idea: true, stage: true, isPublic: true }).partial(),
    response: BoardCard,
  }),
  moveCard: route({
    method: "POST", path: "/api/studio/cards/:id/move", auth: "user", kind: "json", area: "studio",
    summary: "Move/reorder a card (optimistic on the client)",
    params: IdParams,
    body: z.object({ columnId: Id, position: z.number().int().nonnegative() }),
    response: BoardCard,
  }),
  deleteCard: route({
    method: "DELETE", path: "/api/studio/cards/:id", auth: "user", kind: "json", area: "studio",
    summary: "Delete a card",
    params: IdParams,
    response: OkResponse,
  }),
  getPlan: route({
    method: "GET", path: "/api/studio/cards/:id/plan", auth: "user", kind: "json", area: "studio",
    summary: "Planning tools for a card",
    params: IdParams,
    response: ProjectPlan,
  }),
  updatePlan: route({
    method: "PATCH", path: "/api/studio/cards/:id/plan", auth: "user", kind: "json", area: "studio",
    summary: "Save checklist, notes, roadmap, prompts",
    params: IdParams,
    body: ProjectPlan.omit({ cardId: true }).partial(),
    response: ProjectPlan,
  }),

  // messages, collab requests, blocks
  listConversations: route({
    method: "GET", path: "/api/conversations", auth: "user", kind: "json", area: "messages",
    summary: "DM inbox",
    query: PageQuery,
    response: page(Conversation),
  }),
  startConversation: route({
    method: "POST", path: "/api/conversations", auth: "user", kind: "json", area: "messages",
    summary: "Open a DM (respects the recipient's DM policy and blocks)",
    body: z.object({ username: Username, body: z.string().min(1).max(4000) }),
    response: Conversation,
  }),
  listMessages: route({
    method: "GET", path: "/api/conversations/:id/messages", auth: "user", kind: "json", area: "messages",
    summary: "Messages in a conversation (newest first)",
    params: IdParams,
    query: PageQuery,
    response: page(DirectMessage),
  }),
  sendMessage: route({
    method: "POST", path: "/api/conversations/:id/messages", auth: "user", kind: "json", area: "messages",
    summary: "Send a DM",
    params: IdParams,
    body: z.object({ body: z.string().min(1).max(4000) }),
    response: DirectMessage,
  }),
  listCollabRequests: route({
    method: "GET", path: "/api/collab-requests", auth: "user", kind: "json", area: "messages",
    summary: "Collab requests received or sent",
    query: PageQuery.extend({ box: z.enum(["inbox", "sent"]).optional() }),
    response: page(CollabRequest),
  }),
  createCollabRequest: route({
    method: "POST", path: "/api/collab-requests", auth: "user", kind: "json", area: "messages",
    summary: "Send a collab / build-permission / adoption request",
    body: z.object({
      toUsername: Username,
      projectId: Id.nullable(),
      kind: CollabRequest.shape.kind,
      role: z.string().max(80),
      availability: z.string().max(120),
      message: z.string().max(2000),
      turnstileToken: TurnstileToken,
    }),
    response: CollabRequest,
  }),
  respondCollabRequest: route({
    method: "POST", path: "/api/collab-requests/:id/respond", auth: "user", kind: "json", area: "messages",
    summary: "Accept or decline",
    params: IdParams,
    body: z.object({ accept: z.boolean() }),
    response: CollabRequest,
  }),
  listBlocks: route({
    method: "GET", path: "/api/blocks", auth: "user", kind: "json", area: "messages",
    summary: "Blocked and muted users",
    response: z.object({ items: z.array(BlockedUser) }),
  }),
  blockUser: route({
    method: "POST", path: "/api/blocks", auth: "user", kind: "json", area: "messages",
    summary: "Block or mute someone",
    body: z.object({ username: Username, kind: z.enum(["block", "mute"]) }),
    response: OkResponse,
  }),
  unblockUser: route({
    method: "DELETE", path: "/api/blocks/:username", auth: "user", kind: "json", area: "messages",
    summary: "Unblock / unmute",
    params: UsernameParams,
    response: OkResponse,
  }),

  // notifications
  listNotifications: route({
    method: "GET", path: "/api/notifications", auth: "user", kind: "json", area: "notifications",
    summary: "Notification center",
    query: PageQuery,
    response: page(Notification).extend({ unreadCount: z.number().int().nonnegative() }),
  }),
  markNotificationsRead: route({
    method: "POST", path: "/api/notifications/read", auth: "user", kind: "json", area: "notifications",
    summary: "Mark some (or all) as read",
    body: z.object({ ids: z.array(Id).max(200).optional(), all: z.boolean().optional() }),
    response: z.object({ unreadCount: z.number().int().nonnegative() }),
  }),

  // forum
  listForumBoards: route({
    method: "GET", path: "/api/forum/boards", auth: "public", kind: "json", area: "forum",
    summary: "Forum boards",
    response: z.object({ items: z.array(ForumBoard) }),
  }),
  listThreads: route({
    method: "GET", path: "/api/forum/boards/:slug/threads", auth: "public", kind: "json", area: "forum",
    summary: "Threads in a board",
    params: SlugParams,
    query: PageQuery.extend({ sort: z.enum(["active", "new", "top", "unsolved"]).optional(), tag: z.string().max(30).optional() }),
    response: page(Thread),
  }),
  createThread: route({
    method: "POST", path: "/api/forum/boards/:slug/threads", auth: "user", kind: "json", area: "forum",
    summary: "Start a thread",
    params: SlugParams,
    body: z.object({ title: z.string().min(3).max(160), bodyMd: Markdown.min(1), tags: z.array(z.string().max(30)).max(5), turnstileToken: TurnstileToken }),
    response: ThreadDetail,
  }),
  getThread: route({
    method: "GET", path: "/api/forum/threads/:id", auth: "public", kind: "json", area: "forum",
    summary: "Thread with posts",
    params: IdParams,
    query: PageQuery,
    response: ThreadDetail,
  }),
  createPost: route({
    method: "POST", path: "/api/forum/threads/:id/posts", auth: "user", kind: "json", area: "forum",
    summary: "Reply",
    params: IdParams,
    body: z.object({ bodyMd: Markdown.min(1), turnstileToken: TurnstileToken }),
    response: Post,
  }),
  votePost: route({
    method: "POST", path: "/api/forum/posts/:id/vote", auth: "user", kind: "json", area: "forum",
    summary: "Upvote a post",
    params: IdParams,
    body: z.object({ value: z.union([z.literal(0), z.literal(1)]) }),
    response: z.object({ upvotes: z.number().int() }),
  }),
  markSolved: route({
    method: "POST", path: "/api/forum/threads/:id/solved", auth: "user", kind: "json", area: "forum",
    summary: "Mark the answer (thread author only)",
    params: IdParams,
    body: z.object({ postId: Id.nullable() }),
    response: Thread,
  }),
  threadLive: route({
    method: "GET", path: "/api/forum/threads/:id/live", auth: "public", kind: "websocket", area: "forum",
    summary: "WebSocket: ThreadLiveEvent stream",
    params: IdParams,
  }),

  // chat / Plaza
  listChannels: route({
    method: "GET", path: "/api/chat/channels", auth: "public", kind: "json", area: "chat",
    summary: "Chat channels with online counts",
    response: z.object({ items: z.array(ChatChannel) }),
  }),
  channelHistory: route({
    method: "GET", path: "/api/chat/channels/:slug/messages", auth: "public", kind: "json", area: "chat",
    summary: "Recent messages (before cursor)",
    params: SlugParams,
    query: PageQuery,
    response: page(ChatMessage),
  }),
  channelSocket: route({
    method: "GET", path: "/api/chat/channels/:slug/ws", auth: "public", kind: "websocket", area: "chat",
    summary: "WebSocket: ChatClientEvent in, ChatServerEvent out (read-only when signed out)",
    params: SlugParams,
  }),

  // resources
  listResources: route({
    method: "GET", path: "/api/resources", auth: "public", kind: "json", area: "resources",
    summary: "Resources library",
    query: PageQuery.extend({ q: z.string().max(200).optional(), type: csv(ResourceType).optional(), proven: QueryBool.optional() }),
    response: page(Resource),
  }),
  getResource: route({
    method: "GET", path: "/api/resources/:slug", auth: "public", kind: "json", area: "resources",
    summary: "Resource page",
    params: SlugParams,
    response: ResourceDetail,
  }),
  createResource: route({
    method: "POST", path: "/api/resources", auth: "user", kind: "json", area: "resources",
    summary: "Share a resource (scanned for risky scripts)",
    body: z.object({
      type: ResourceType,
      title: z.string().min(3).max(120),
      summary: z.string().max(300),
      bodyMd: Markdown,
      license: z.string().max(60),
      testedWith: ResourceDetail.shape.testedWith,
      fileKeys: z.array(z.string().max(200)).max(50),
      linkedProjectIds: z.array(Id).max(20),
      turnstileToken: TurnstileToken,
    }),
    response: ResourceDetail,
  }),
  reportResourceResult: route({
    method: "POST", path: "/api/resources/:slug/reports", auth: "user", kind: "json", area: "resources",
    summary: "\"Worked for me\" / \"Didn't work\"",
    params: SlugParams,
    body: z.object({ worked: z.boolean(), note: z.string().max(500) }),
    response: Resource,
  }),
  rateResource: route({
    method: "POST", path: "/api/resources/:slug/rating", auth: "user", kind: "json", area: "resources",
    summary: "Rate 1–5",
    params: SlugParams,
    body: z.object({ stars: z.number().int().min(1).max(5) }),
    response: Resource,
  }),

  // reports (any signed-in user)
  createReport: route({
    method: "POST", path: "/api/reports", auth: "user", kind: "json", area: "reports",
    summary: "Report something to moderators",
    body: z.object({ targetType: ReportTarget, targetId: Id, reason: ReportReason, note: z.string().max(1000) }),
    response: OkResponse,
  }),

  // requests board (Sol, task 4.5)
  listRequests: route({
    method: "GET", path: "/api/requests", auth: "public", kind: "json", area: "requests",
    summary: "\"I wish there were a free X\" board",
    query: PageQuery.extend({ status: z.enum(["open", "claimed", "built"]).optional() }),
    response: page(BuildRequest),
  }),
  getRequest: route({
    method: "GET", path: "/api/requests/:id", auth: "public", kind: "json", area: "requests",
    summary: "One request",
    params: IdParams,
    response: BuildRequest,
  }),
  createRequest: route({
    method: "POST", path: "/api/requests", auth: "user", kind: "json", area: "requests",
    summary: "Post a request",
    body: z.object({ title: z.string().min(3).max(140), bodyMd: Markdown, replaces: z.string().max(60).nullable(), turnstileToken: TurnstileToken }),
    response: BuildRequest,
  }),
  claimRequest: route({
    method: "POST", path: "/api/requests/:id/claim", auth: "user", kind: "json", area: "requests",
    summary: "Claim a request to build it",
    params: IdParams,
    response: BuildRequest,
  }),

  // growth (Sol: alternatives; Flash: savings counter)
  listAlternatives: route({
    method: "GET", path: "/api/alternatives", auth: "public", kind: "json", area: "growth",
    summary: "Paid products that have free alternatives listed",
    response: z.object({ items: z.array(AlternativeProduct) }),
  }),
  getAlternatives: route({
    method: "GET", path: "/api/alternatives/:product", auth: "public", kind: "json", area: "growth",
    summary: "Free alternatives to one product",
    params: z.object({ product: Slug }),
    query: z.object({ showUnlicensed: QueryBool.optional() }),
    response: z.object({ product: AlternativeProduct, items: z.array(ProjectCard), hiddenUnlicensedCount: z.number().int().nonnegative() }),
  }),
  savingsStats: route({
    method: "GET", path: "/api/stats/savings", auth: "public", kind: "json", area: "growth",
    summary: "Subscription savings counter",
    response: SavingsStats,
  }),

  // feeds (Flash)
  projectsRss: route({
    method: "GET", path: "/api/feeds/projects.rss", auth: "public", kind: "text", area: "feeds",
    summary: "RSS: new projects (?category= and ?user= filters)",
    query: z.object({ category: Slug.optional(), user: Username.optional() }),
  }),
  readmeBadge: route({
    method: "GET", path: "/api/badge/:slug", auth: "public", kind: "text", area: "feeds",
    summary: "SVG README badge with forks and upvotes",
    params: SlugParams,
  }),

  // admin (behind Cloudflare Access)
  listCandidates: route({
    method: "GET", path: "/api/admin/candidates", auth: "admin", kind: "json", area: "admin",
    summary: "Review queue",
    query: PageQuery.extend({ status: CandidateStatus.optional(), sort: z.enum(["score", "newest", "stars"]).optional() }),
    response: page(Candidate),
  }),
  importCandidate: route({
    method: "POST", path: "/api/admin/candidates", auth: "admin", kind: "json", area: "admin",
    summary: "Paste-a-link importer (GitHub URL, optional Reddit post as found-via credit)",
    body: z.object({ repoUrl: Url, foundViaUrl: Url.nullable() }),
    response: Candidate,
  }),
  decideCandidate: route({
    method: "POST", path: "/api/admin/candidates/:id/decision", auth: "admin", kind: "json", area: "admin",
    summary: "Approve and publish / approve as draft / reject / snooze",
    params: IdParams,
    body: z.object({
      action: CandidateAction,
      reason: z.string().max(500).nullable(),
      snoozeDays: z.number().int().min(1).max(365).nullable(),
      edits: Candidate.shape.proposed.partial().nullable(),
    }),
    response: Candidate,
  }),
  bulkDecideCandidates: route({
    method: "POST", path: "/api/admin/candidates/bulk", auth: "admin", kind: "json", area: "admin",
    summary: "Bulk approve/reject",
    body: z.object({ ids: z.array(Id).min(1).max(100), action: CandidateAction, reason: z.string().max(500).nullable() }),
    response: z.object({ updated: z.number().int() }),
  }),
  suggestCandidateCategories: route({
    method: "POST", path: "/api/admin/candidates/categorize", auth: "admin", kind: "json", area: "admin",
    summary: "Fill in a suggested category for queued candidates that have none",
    response: z.object({ updated: z.number().int() }),
  }),
  listReports: route({
    method: "GET", path: "/api/admin/reports", auth: "admin", kind: "json", area: "admin",
    summary: "Moderation queue",
    query: PageQuery.extend({ status: z.enum(["open", "resolved", "dismissed"]).optional() }),
    response: page(Report),
  }),
  resolveReport: route({
    method: "POST", path: "/api/admin/reports/:id/resolve", auth: "admin", kind: "json", area: "admin",
    summary: "Resolve or dismiss a report, optionally acting on the target",
    params: IdParams,
    body: z.object({ outcome: z.enum(["resolved", "dismissed"]), action: z.enum(["none", "hide", "delete", "ban_user"]), note: z.string().max(500) }),
    response: Report,
  }),
  upsertCategory: route({
    method: "PUT", path: "/api/admin/categories/:slug", auth: "admin", kind: "json", area: "admin",
    summary: "Create/rename/approve a category",
    params: SlugParams,
    body: z.object({
      name: z.string().min(2).max(60),
      parentSlug: Slug.nullable(),
      iconKey: z.string().max(60).nullable(),
      description: z.string().max(300).nullable(),
      status: z.enum(["active", "suggested", "rejected"]),
      mergeInto: Slug.nullable(),
    }),
    response: Category,
  }),
  setStaffPick: route({
    method: "POST", path: "/api/admin/projects/:slug/staff-pick", auth: "admin", kind: "json", area: "admin",
    summary: "Staff pick / featured slot",
    params: SlugParams,
    body: z.object({ staffPick: z.boolean(), featuredSlot: z.number().int().min(1).max(12).nullable() }),
    response: OkResponse,
  }),
  setResourceProven: route({
    method: "POST", path: "/api/admin/resources/:slug/proven", auth: "admin", kind: "json", area: "admin",
    summary: "Override the Proven badge (null = automatic)",
    params: SlugParams,
    body: z.object({ proven: z.boolean().nullable() }),
    response: OkResponse,
  }),
  banUser: route({
    method: "POST", path: "/api/admin/users/:username/ban", auth: "admin", kind: "json", area: "admin",
    summary: "Ban / unban",
    params: UsernameParams,
    body: z.object({ banned: z.boolean(), reason: z.string().max(500) }),
    response: OkResponse,
  }),
  moderateChat: route({
    method: "POST", path: "/api/admin/chat/:slug", auth: "admin", kind: "json", area: "admin",
    summary: "Chat moderation: delete a message (or all of a user's), slow mode, mute/unmute, kick",
    params: SlugParams,
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("delete"), messageId: z.string().max(64) }),
      z.object({ action: z.literal("deleteByUser"), userId: Id }),
      z.object({ action: z.literal("slow"), seconds: z.number().int().min(0).max(3600) }),
      z.object({ action: z.literal("mute"), userId: Id, minutes: z.number().int().min(1).max(60 * 24 * 30) }),
      z.object({ action: z.literal("unmute"), userId: Id }),
      z.object({ action: z.literal("kick"), userId: Id }),
    ]),
    response: z.object({ ok: z.literal(true), slowModeSeconds: z.number().int() }),
  }),
  adminStats: route({
    method: "GET", path: "/api/admin/stats", auth: "admin", kind: "json", area: "admin",
    summary: "Site stats",
    response: AdminStats,
  }),
  auditLog: route({
    method: "GET", path: "/api/admin/audit-log", auth: "admin", kind: "json", area: "admin",
    summary: "Every admin action",
    query: PageQuery,
    response: page(AuditLogEntry),
  }),
} as const;

export type Routes = typeof routes;
export type RouteId = keyof Routes;
export const ROUTE_IDS = Object.keys(routes) as RouteId[];

/** Loosely typed view of the contract for generic code (avoids huge unions). */
export const ROUTE_DEFS: Readonly<Record<string, RouteDef>> = routes;

