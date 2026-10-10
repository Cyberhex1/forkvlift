import { z } from "zod";
import { Id, IsoDate, Markdown, Slug } from "./common";
import { ResourceType } from "./enums";
import { ProjectRef } from "./project";
import { UserSummary } from "./user";

// ── Forum ────────────────────────────────────────────────────────────────

export const ForumBoard = z.object({
  slug: Slug,
  name: z.string().max(60),
  description: z.string().max(300),
  threadCount: z.number().int().nonnegative(),
});
export type ForumBoard = z.infer<typeof ForumBoard>;

export const Thread = z.object({
  id: Id,
  boardSlug: Slug,
  title: z.string().min(3).max(160),
  author: UserSummary,
  tags: z.array(z.string().max(30)).max(5),
  upvotes: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative(),
  solved: z.boolean(),
  pinned: z.boolean(),
  createdAt: IsoDate,
  lastActivityAt: IsoDate,
});
export type Thread = z.infer<typeof Thread>;

export const Post = z.object({
  id: Id,
  threadId: Id,
  author: UserSummary,
  bodyMd: Markdown,
  upvotes: z.number().int().nonnegative(),
  isSolution: z.boolean(),
  createdAt: IsoDate,
  editedAt: IsoDate.nullable(),
});
export type Post = z.infer<typeof Post>;

export const ThreadDetail = z.object({
  thread: Thread,
  posts: z.array(Post),
  nextCursor: z.string().nullable(),
});
export type ThreadDetail = z.infer<typeof ThreadDetail>;

/** Messages pushed over /api/forum/threads/:id/live. */
export const ThreadLiveEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("post"), post: Post }),
  z.object({ type: z.literal("typing"), count: z.number().int().nonnegative() }),
]);
export type ThreadLiveEvent = z.infer<typeof ThreadLiveEvent>;

// ── Live chat / Plaza ────────────────────────────────────────────────────

export const ChatChannel = z.object({
  slug: Slug,
  name: z.string().max(40),
  description: z.string().max(200),
  kind: z.enum(["general", "category"]),
  onlineCount: z.number().int().nonnegative(),
  slowModeSeconds: z.number().int().nonnegative(),
});
export type ChatChannel = z.infer<typeof ChatChannel>;

export const ChatMessage = z.object({
  id: Id,
  channel: Slug,
  author: UserSummary,
  body: z.string().min(1).max(2000),
  createdAt: IsoDate,
  reactions: z.array(z.object({ emoji: z.string().max(16), count: z.number().int(), viewerReacted: z.boolean() })),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

/** Where someone stands in the Plaza room (0..1 normalized coordinates). */
export const PlazaPresence = z.object({
  user: UserSummary,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  state: z.enum(["active", "idle", "away"]),
});
export type PlazaPresence = z.infer<typeof PlazaPresence>;

export const ChatClientEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("say"), body: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("react"), messageId: Id, emoji: z.string().max(16) }),
  z.object({ type: z.literal("move"), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  z.object({ type: z.literal("typing") }),
  z.object({ type: z.literal("ping") }),
]);
export type ChatClientEvent = z.infer<typeof ChatClientEvent>;

export const ChatServerEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    you: UserSummary.nullable(),
    presence: z.array(PlazaPresence),
    history: z.array(ChatMessage),
    slowModeSeconds: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("message"), message: ChatMessage }),
  z.object({ type: z.literal("presence"), presence: PlazaPresence }),
  z.object({ type: z.literal("leave"), userId: Id }),
  z.object({ type: z.literal("typing"), userId: Id }),
  z.object({ type: z.literal("deleted"), messageId: Id }),
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ChatServerEvent = z.infer<typeof ChatServerEvent>;

// ── Resources ────────────────────────────────────────────────────────────

export const TestedWith = z.object({
  tool: z.string().max(60),
  model: z.string().max(60).nullable(),
  version: z.string().max(40).nullable(),
});

export const Resource = z.object({
  id: Id,
  slug: Slug,
  type: ResourceType,
  title: z.string().max(120),
  summary: z.string().max(300),
  author: UserSummary,
  license: z.string().max(60),
  testedWith: z.array(TestedWith),
  proven: z.boolean(),
  workedCount: z.number().int().nonnegative(),
  didntWorkCount: z.number().int().nonnegative(),
  rating: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  hasExecutableCode: z.boolean(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Resource = z.infer<typeof Resource>;

export const ResourceReport = z.object({
  id: Id,
  author: UserSummary,
  worked: z.boolean(),
  note: z.string().max(500),
  createdAt: IsoDate,
});
export type ResourceReport = z.infer<typeof ResourceReport>;

export const ResourceDetail = Resource.extend({
  bodyMd: Markdown,
  files: z.array(z.object({ path: z.string().max(200), size: z.number().int().nonnegative() })),
  downloadUrl: z.string().nullable(),
  linkedProjects: z.array(ProjectRef),
  reports: z.array(ResourceReport),
  versions: z.array(z.object({ version: z.string(), createdAt: IsoDate })),
  scanFlags: z.array(z.string()),
});
export type ResourceDetail = z.infer<typeof ResourceDetail>;
