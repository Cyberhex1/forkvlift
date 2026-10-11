/**
 * D1 schema (Drizzle). Covers every table in the product plan's data model.
 * Change it, then `pnpm db:generate` to emit a migration. Opus only.
 *
 * Conventions: text ids with a type prefix (usr_, prj_ …), integer ms timestamps,
 * JSON in text columns, soft deletes via deleted_at where content can be reported.
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  AiInvolvement,
  AiTool,
  AvatarConfig,
  CandidateCheck,
  Difficulty,
  HealthScore,
  Platform,
  ProfileLinks,
  ProjectPlan,
  UserSettings,
} from "@forkvlift/shared";

const now = sql`(unixepoch() * 1000)`;
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(now);
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now);
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const bool = (name: string) => integer(name, { mode: "boolean" });
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// ── Accounts ─────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    githubId: integer("github_id").unique(),
    githubLogin: text("github_login"),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    bannedAt: ts("banned_at"),
    banReason: text("ban_reason"),
    /** Last weekly digest sent to this user. */
    digestSentAt: ts("digest_sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [uniqueIndex("users_username_lower").on(sql`lower(${t.username})`), uniqueIndex("users_email").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    /** sha-256 of the cookie token; the token itself is never stored. */
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const magicLinkTokens = sqliteTable("magic_link_tokens", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  returnTo: text("return_to"),
  createdAt: createdAt(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio").notNull().default(""),
  location: text("location"),
  links: json<ProfileLinks>("links"),
  showcase: json<string[]>("showcase"),
  settings: json<UserSettings>("settings"),
  updatedAt: updatedAt(),
});

export const avatars = sqliteTable("avatars", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  config: json<AvatarConfig>("config").notNull(),
  updatedAt: updatedAt(),
});

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["user", "category", "project"] }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.targetType, t.targetId] }), index("follows_target").on(t.targetType, t.targetId)],
);

export const blocks = sqliteTable(
  "blocks",
  {
    blockerId: text("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["block", "mute"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

// ── Catalog ──────────────────────────────────────────────────────────────

export const categories = sqliteTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  parentSlug: text("parent_slug"),
  iconKey: text("icon_key"),
  description: text("description"),
  position: integer("position").notNull().default(0),
  status: text("status", { enum: ["active", "suggested", "rejected"] }).notNull().default("active"),
  suggestedBy: text("suggested_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    /** null = curated and not yet claimed. */
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    source: text("source", { enum: ["community", "curated"] }).notNull(),
    claimedAt: ts("claimed_at"),
    categorySlug: text("category_slug").notNull().references(() => categories.slug),
    stage: text("stage", { enum: ["finished", "wip", "adoption"] }).notNull().default("finished"),
    isPublic: bool("is_public").notNull().default(false),
    repoUrl: text("repo_url"),
    repoFullName: text("repo_full_name"),
    githubRepoId: integer("github_repo_id"),
    liveUrl: text("live_url"),
    releaseUrl: text("release_url"),
    /** null = no license (hidden by default). */
    licenseSpdx: text("license_spdx"),
    licenseName: text("license_name"),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),
    contributors: integer("contributors").notNull().default(0),
    lastCommitAt: ts("last_commit_at"),
    repoCreatedAt: ts("repo_created_at"),
    readmeHtml: text("readme_html"),
    stack: json<string[]>("stack"),
    platforms: json<Platform[]>("platforms"),
    difficulty: text("difficulty").$type<Difficulty>(),
    aiTools: json<AiTool[]>("ai_tools"),
    buildTime: text("build_time"),
    aiInvolvement: text("ai_involvement").$type<AiInvolvement>(),
    isTemplate: bool("is_template").notNull().default(false),
    replaces: json<string[]>("replaces"),
    whatWorks: text("what_works"),
    whatsMissing: text("whats_missing"),
    lookingForHelp: text("looking_for_help"),
    starterPrompt: text("starter_prompt"),
    thumbnailKey: text("thumbnail_key"),
    thumbnailUrl: text("thumbnail_url"),
    healthScore: integer("health_score").notNull().default(0),
    health: json<HealthScore>("health"),
    staffPick: bool("staff_pick").notNull().default(false),
    featuredSlot: integer("featured_slot"),
    upvotes: integer("upvotes").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    safetyFlags: json<string[]>("safety_flags"),
    foundViaUrl: text("found_via_url"),
    hiddenAt: ts("hidden_at"),
    /** Semantic search (4.1): when the vector was last written, and a hash of the text it was made from. */
    embeddedAt: ts("embedded_at"),
    embeddingHash: text("embedding_hash"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: ts("published_at"),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("projects_feed").on(t.isPublic, t.licenseSpdx, t.publishedAt),
    index("projects_category").on(t.categorySlug),
    index("projects_owner").on(t.ownerId),
    uniqueIndex("projects_repo").on(t.repoFullName),
  ],
);

export const projectMedia = sqliteTable(
  "project_media",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["image", "gif", "video"] }).notNull(),
    key: text("key").notNull(),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("project_media_project").on(t.projectId)],
);

export const projectTags = sqliteTable(
  "project_tags",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.tag] }), index("project_tags_tag").on(t.tag)],
);

/** Fork tree edges (parent → child). A project has at most one parent. */
export const forks = sqliteTable(
  "forks",
  {
    childId: text("child_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
    parentId: text("parent_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("forks_parent").on(t.parentId)],
);

export const votes = sqliteTable(
  "votes",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["project", "thread", "post", "roadmap_item", "request", "comment"] }).notNull(),
    targetId: text("target_id").notNull(),
    value: integer("value").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] }), index("votes_target").on(t.targetType, t.targetId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    createdAt: createdAt(),
    editedAt: ts("edited_at"),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("comments_project").on(t.projectId, t.createdAt)],
);

// ── Studio ───────────────────────────────────────────────────────────────

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const boardColumns = sqliteTable(
  "board_columns",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    color: text("color"),
    position: integer("position").notNull(),
    collapsed: bool("collapsed").notNull().default(false),
    wipLimit: integer("wip_limit"),
  },
  (t) => [index("board_columns_board").on(t.boardId)],
);

export const boardCards = sqliteTable(
  "board_cards",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    columnId: text("column_id").notNull().references(() => boardColumns.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    idea: text("idea"),
    stage: text("stage", { enum: ["finished", "wip", "adoption"] }).notNull().default("wip"),
    isPublic: bool("is_public").notNull().default(false),
    position: integer("position").notNull(),
    plan: json<Omit<ProjectPlan, "cardId" | "roadmap">>("plan"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("board_cards_column").on(t.columnId, t.position)],
);

export const roadmapItems = sqliteTable(
  "roadmap_items",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull().references(() => boardCards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status", { enum: ["planned", "in_progress", "done"] }).notNull().default("planned"),
    votes: integer("votes").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("roadmap_items_card").on(t.cardId)],
);

// ── Messaging ────────────────────────────────────────────────────────────

export const collabRequests = sqliteTable(
  "collab_requests",
  {
    id: text("id").primaryKey(),
    fromId: text("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    toId: text("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["collab", "build_permission", "adoption"] }).notNull(),
    role: text("role").notNull().default(""),
    availability: text("availability").notNull().default(""),
    message: text("message").notNull().default(""),
    status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
    createdAt: createdAt(),
    respondedAt: ts("responded_at"),
  },
  (t) => [index("collab_to").on(t.toId, t.status), index("collab_from").on(t.fromId)],
);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: ts("last_read_at"),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_members_user").on(t.userId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("messages_conversation").on(t.conversationId, t.createdAt)],
);

// ── Forum ────────────────────────────────────────────────────────────────

export const forumBoards = sqliteTable("forum_boards", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
});

export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(),
    boardSlug: text("board_slug").notNull().references(() => forumBoards.slug),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    tags: json<string[]>("tags"),
    pinned: bool("pinned").notNull().default(false),
    solvedPostId: text("solved_post_id"),
    upvotes: integer("upvotes").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    createdAt: createdAt(),
    lastActivityAt: ts("last_activity_at").notNull().default(now),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("threads_board").on(t.boardSlug, t.lastActivityAt)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bodyMd: text("body_md").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    createdAt: createdAt(),
    editedAt: ts("edited_at"),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("posts_thread").on(t.threadId, t.createdAt)],
);

/** Periodic copies of Durable Object chat history, kept for moderation. */
export const chatSnapshots = sqliteTable(
  "chat_snapshots",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull(),
    fromTs: ts("from_ts").notNull(),
    toTs: ts("to_ts").notNull(),
    messages: json<unknown[]>("messages").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_snapshots_channel").on(t.channel, t.toTs)],
);

// ── Resources ────────────────────────────────────────────────────────────

export const resources = sqliteTable(
  "resources",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    type: text("type", { enum: ["skill", "system_prompt", "prompt_template", "workflow", "mcp_config", "starter_repo"] }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    bodyMd: text("body_md").notNull().default(""),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    license: text("license").notNull().default("CC0-1.0"),
    testedWith: json<{ tool: string; model: string | null; version: string | null }[]>("tested_with"),
    files: json<{ path: string; size: number; key: string }[]>("files"),
    hasExecutableCode: bool("has_executable_code").notNull().default(false),
    scanFlags: json<string[]>("scan_flags"),
    /** null = automatic Proven rule; true/false = admin override. */
    provenOverride: bool("proven_override"),
    workedCount: integer("worked_count").notNull().default(0),
    didntWorkCount: integer("didnt_work_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    version: integer("version").notNull().default(1),
    forkedFromId: text("forked_from_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("resources_type").on(t.type)],
);

export const resourceReports = sqliteTable(
  "resource_reports",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    worked: bool("worked").notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("resource_reports_one_per_user").on(t.resourceId, t.authorId)],
);

/** One rating per user per resource (1–5). */
export const resourceRatings = sqliteTable(
  "resource_ratings",
  {
    resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.userId] })],
);

/** Public API keys (task 4.3). Only a SHA-256 of the secret is stored. */
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

/**
 * "Up for adoption" (task 4.12). One row per adoption period; the open one has
 * closed_at NULL. Kept after it closes so the original author stays credited.
 */
export const projectAdoptions = sqliteTable(
  "project_adoptions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    originalOwnerId: text("original_owner_id").references(() => users.id, { onDelete: "set null" }),
    previousStage: text("previous_stage").notNull(),
    note: text("note").notNull().default(""),
    openedAt: integer("opened_at").notNull(),
    closedAt: ts("closed_at"),
    outcome: text("outcome", { enum: ["cancelled", "adopted"] }),
    adoptedBy: text("adopted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("project_adoptions_open_idx").on(t.projectId).where(sql`closed_at IS NULL`), index("project_adoptions_project_idx").on(t.projectId)],
);

export const adoptionRequests = sqliteTable(
  "adoption_requests",
  {
    id: text("id").primaryKey(),
    adoptionId: text("adoption_id").notNull().references(() => projectAdoptions.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    requesterId: text("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: text("status", { enum: ["pending", "approved", "declined", "withdrawn", "cancelled"] }).notNull().default("pending"),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
    decidedBy: text("decided_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("adoption_requests_pending_idx").on(t.projectId, t.requesterId).where(sql`status = 'pending'`),
    index("adoption_requests_project_idx").on(t.projectId, t.status),
  ],
);
/** Launch days, Fork Friday and build jams (task 4.6). Times are UTC ms; status is derived from them. */
export const growthEvents = sqliteTable("growth_events", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  kind: text("kind", { enum: ["launch_day", "fork_friday", "build_jam"] }).notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull().default(""),
  featuredProjectId: text("featured_project_id").references(() => projects.id, { onDelete: "set null" }),
  startsAt: integer("starts_at").notNull(),
  submissionEndsAt: integer("submission_ends_at").notNull(),
  votingEndsAt: integer("voting_ends_at").notNull(),
  cancelledAt: ts("cancelled_at"),
  /** Admin actor (user id or "access:<email>"). */
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const growthEntries = sqliteTable(
  "growth_entries",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => growthEvents.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    submittedBy: text("submitted_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    submittedAt: integer("submitted_at").notNull(),
    withdrawnAt: ts("withdrawn_at"),
  },
  (t) => [uniqueIndex("growth_entries_active_idx").on(t.eventId, t.projectId).where(sql`withdrawn_at IS NULL`), index("growth_entries_event_idx").on(t.eventId)],
);

/** One active vote per person per event. */
export const growthBallots = sqliteTable(
  "growth_ballots",
  {
    eventId: text("event_id").notNull().references(() => growthEvents.id, { onDelete: "cascade" }),
    voterId: text("voter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull().references(() => growthEntries.id, { onDelete: "cascade" }),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.voterId] }), index("growth_ballots_entry_idx").on(t.entryId)],
);
/**
 * Build competitions (task 4.14) ride on a growth event: the event holds the
 * entries and the submission window; the round adds rules, prizes (display
 * only: the site never handles money), criteria, judges and published awards.
 */
export const competitionRounds = sqliteTable("competition_rounds", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().unique().references(() => growthEvents.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  rulesMd: text("rules_md").notNull().default(""),
  eligibilityMd: text("eligibility_md").notNull().default(""),
  judgingEndsAt: integer("judging_ends_at").notNull(),
  /** null = draft (not public). */
  openedAt: ts("opened_at"),
  publishedAt: ts("published_at"),
  cancelledAt: ts("cancelled_at"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const competitionPrizes = sqliteTable("competition_prizes", {
  id: text("id").primaryKey(),
  roundId: text("round_id").notNull().references(() => competitionRounds.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  descriptionMd: text("description_md").notNull().default(""),
  sponsorName: text("sponsor_name"),
  sponsorUrl: text("sponsor_url"),
  place: integer("place"),
});

export const competitionCriteria = sqliteTable("competition_criteria", {
  id: text("id").primaryKey(),
  roundId: text("round_id").notNull().references(() => competitionRounds.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  maxScore: integer("max_score").notNull(),
  weight: real("weight").notNull().default(1),
});

export const competitionJudges = sqliteTable(
  "competition_judges",
  {
    roundId: text("round_id").notNull().references(() => competitionRounds.id, { onDelete: "cascade" }),
    judgeId: text("judge_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    conflictNote: text("conflict_note").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.judgeId] })],
);

export const competitionScorecards = sqliteTable(
  "competition_scorecards",
  {
    roundId: text("round_id").notNull().references(() => competitionRounds.id, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull().references(() => growthEntries.id, { onDelete: "cascade" }),
    judgeId: text("judge_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scores: text("scores").notNull(),
    note: text("note").notNull().default(""),
    submittedAt: ts("submitted_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.entryId, t.judgeId] })],
);

export const competitionAwards = sqliteTable(
  "competition_awards",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id").notNull().references(() => competitionRounds.id, { onDelete: "cascade" }),
    prizeId: text("prize_id").notNull().references(() => competitionPrizes.id, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull().references(() => growthEntries.id, { onDelete: "cascade" }),
    rationaleMd: text("rationale_md").notNull().default(""),
    announcedAt: integer("announced_at").notNull(),
  },
  (t) => [uniqueIndex("competition_awards_prize_idx").on(t.prizeId)],
);
/** The Fork Report newsletter (task 4.10). Double opt-in; the token confirms and unsubscribes. */
export const subscribers = sqliteTable("subscribers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["pending", "confirmed", "unsubscribed"] }).notNull().default("pending"),
  createdAt: createdAt(),
  confirmedAt: ts("confirmed_at"),
  unsubscribedAt: ts("unsubscribed_at"),
  /** Last confirmation email, to throttle re-sends. */
  lastSentAt: ts("last_sent_at"),
});

/**
 * Facts that count toward badges (task 3.12), one row per distinct thing:
 * kind "bug_fixed" → ref is a card id moved out of Bug fix;
 * kind "active_day" → ref is a UTC day (YYYY-MM-DD) the user was signed in.
 */
export const badgeEvents = sqliteTable(
  "badge_events",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    ref: text("ref").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.ref] })],
);
/** "Proof": projects built with a resource. */
export const resourceProjects = sqliteTable(
  "resource_projects",
  {
    resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.projectId] })],
);

// ── Collections ──────────────────────────────────────────────────────────

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isPublic: bool("is_public").notNull().default(false),
    isDefault: bool("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("collections_owner").on(t.ownerId)],
);

export const collectionItems = sqliteTable(
  "collection_items",
  {
    collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.projectId] })],
);

// ── Notifications, moderation, badges ────────────────────────────────────

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    href: text("href").notNull(),
    readAt: ts("read_at"),
    /** When the email for this notification was sent (or skipped by preferences). */
    emailedAt: ts("emailed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user").on(t.userId, t.createdAt), index("notifications_email_pending").on(t.emailedAt, t.createdAt)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    note: text("note").notNull().default(""),
    status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    resolvedBy: text("resolved_by"),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status").on(t.status, t.createdAt)],
);

export const badges = sqliteTable("badges", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconKey: text("icon_key").notNull(),
});

export const userBadges = sqliteTable(
  "user_badges",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key").notNull().references(() => badges.key),
    awardedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeKey] })],
);

// ── Admin ────────────────────────────────────────────────────────────────

export const candidates = sqliteTable(
  "candidates",
  {
    id: text("id").primaryKey(),
    repoFullName: text("repo_full_name").notNull().unique(),
    repoUrl: text("repo_url").notNull(),
    /** Snapshot of the GitHub metadata used for scoring. */
    data: json<Record<string, unknown>>("data").notNull(),
    proposed: json<Record<string, unknown>>("proposed"),
    score: integer("score").notNull().default(0),
    checks: json<CandidateCheck[]>("checks"),
    status: text("status", { enum: ["pending", "published", "draft", "rejected", "snoozed"] }).notNull().default("pending"),
    foundViaKind: text("found_via_kind", { enum: ["github_search", "watchlist", "manual", "reddit_link"] }).notNull(),
    foundViaUrl: text("found_via_url"),
    rejectReason: text("reject_reason"),
    snoozedUntil: ts("snoozed_until"),
    decidedBy: text("decided_by"),
    decidedAt: ts("decided_at"),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("candidates_status").on(t.status, t.score)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    /** User id, or the Cloudflare Access email for console actions. */
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    details: json<Record<string, unknown>>("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created").on(t.createdAt)],
);

// ── Growth ───────────────────────────────────────────────────────────────

export const buildRequests = sqliteTable(
  "build_requests",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull().default(""),
    replaces: text("replaces"),
    status: text("status", { enum: ["open", "claimed", "built"] }).notNull().default("open"),
    claimedBy: text("claimed_by").references(() => users.id, { onDelete: "set null" }),
    builtProjectId: text("built_project_id").references(() => projects.id, { onDelete: "set null" }),
    upvotes: integer("upvotes").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("build_requests_status").on(t.status, t.createdAt)],
);

/** Paid products referenced by projects' "replaces" field. */
export const paidProducts = sqliteTable("paid_products", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  monthlyPriceUsd: integer("monthly_price_usd_cents"),
});
