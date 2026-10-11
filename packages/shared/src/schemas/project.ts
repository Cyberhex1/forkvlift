import { z } from "zod";
import { LIMITS } from "../constants";
import { Id, IsoDate, Markdown, Slug, Url } from "./common";
import { AiInvolvement, AiTool, Difficulty, Platform, ProjectSource, ProjectStage } from "./enums";
import { UserSummary } from "./user";

export const Category = z.object({
  slug: Slug,
  name: z.string().max(60),
  parentSlug: Slug.nullable(),
  iconKey: z.string().max(60).nullable(),
  description: z.string().max(300).nullable(),
  projectCount: z.number().int().nonnegative(),
});
export type Category = z.infer<typeof Category>;

export const CategoryRef = Category.pick({ slug: true, name: true, iconKey: true });
export type CategoryRef = z.infer<typeof CategoryRef>;

/** null license = "No license" (all rights reserved). */
export const LicenseInfo = z.object({
  spdx: z.string().max(60),
  name: z.string().max(120),
  /** One-line plain-English summary, e.g. "MIT: do anything, keep the credit". */
  summary: z.string().max(160),
  copyleft: z.boolean(),
});
export type LicenseInfo = z.infer<typeof LicenseInfo>;

export const BuildFacts = z.object({
  aiTools: z.array(AiTool),
  buildTime: z.string().max(60).nullable(),
  aiInvolvement: AiInvolvement.nullable(),
});
export type BuildFacts = z.infer<typeof BuildFacts>;

export const ProjectRef = z.object({
  id: Id,
  slug: Slug,
  name: z.string().max(100),
  author: UserSummary.nullable(),
});
export type ProjectRef = z.infer<typeof ProjectRef>;

/** Everything a feed card needs (front and back). */
export const ProjectCard = z.object({
  id: Id,
  slug: Slug,
  name: z.string().max(100),
  tagline: z.string().max(LIMITS.taglineMax),
  description: z.string().max(LIMITS.descriptionMax),
  thumbnailUrl: z.string().nullable(),
  /** null for curated projects nobody has claimed yet. */
  author: UserSummary.nullable(),
  source: ProjectSource,
  claimed: z.boolean(),
  category: CategoryRef,
  tags: z.array(z.string().max(40)).max(LIMITS.maxTags),
  stage: ProjectStage,
  studioColumnTitle: z.string().max(60).nullable(),
  license: LicenseInfo.nullable(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  upvotes: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  repoUrl: Url,
  cloneCommand: z.string(),
  liveUrl: Url.nullable(),
  releaseUrl: Url.nullable(),
  buildFacts: BuildFacts,
  /** Paid products this is a free alternative to, e.g. ["Notion"]. */
  replaces: z.array(z.string().max(60)),
  isTemplate: z.boolean(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  viewer: z.object({ upvoted: z.boolean(), saved: z.boolean() }).nullable(),
});
export type ProjectCard = z.infer<typeof ProjectCard>;

export const ProjectMedia = z.object({
  id: Id,
  kind: z.enum(["image", "gif", "video"]),
  url: z.string(),
  alt: z.string().max(200),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
export type ProjectMedia = z.infer<typeof ProjectMedia>;

const HealthPart = z.object({ value: z.number(), points: z.number() });
export const HealthScore = z.object({
  score: z.number().min(0).max(100),
  breakdown: z.object({
    stars: HealthPart,
    forks: HealthPart,
    contributors: HealthPart,
    activity: HealthPart,
    age: HealthPart,
  }),
});
export type HealthScore = z.infer<typeof HealthScore>;

export const ProjectDetail = ProjectCard.extend({
  readmeHtml: z.string().nullable(),
  media: z.array(ProjectMedia),
  stack: z.array(z.string().max(40)),
  platforms: z.array(Platform),
  difficulty: Difficulty.nullable(),
  repoStats: z.object({
    stars: z.number().int().nonnegative(),
    forks: z.number().int().nonnegative(),
    openIssues: z.number().int().nonnegative(),
    contributors: z.number().int().nonnegative(),
    lastCommitAt: IsoDate.nullable(),
  }),
  health: HealthScore,
  forkedFrom: ProjectRef.nullable(),
  notableForks: z.array(ProjectRef),
  /** Author-written box shown on WIP panels. */
  wipStatus: z.object({ whatWorks: z.string().max(1000), whatsMissing: z.string().max(1000) }).nullable(),
  lookingForHelp: z.string().max(500).nullable(),
  starterPrompt: z.string().max(4000).nullable(),
  safety: z.object({ flags: z.array(z.string().max(120)) }),
  verifiedAuthor: z.boolean(),
  staffPick: z.boolean(),
  foundVia: Url.nullable(),
});
export type ProjectDetail = z.infer<typeof ProjectDetail>;

export interface ForkTreeNode {
  project: ProjectRef;
  children: ForkTreeNode[];
}
export const ForkTreeNode: z.ZodType<ForkTreeNode> = z.lazy(() =>
  z.object({ project: ProjectRef, children: z.array(ForkTreeNode) }),
);
export const ForkTree = z.object({ root: ForkTreeNode, total: z.number().int().nonnegative() });
export type ForkTree = z.infer<typeof ForkTree>;

export const Comment = z.object({
  id: Id,
  projectId: Id,
  parentId: Id.nullable(),
  author: UserSummary,
  body: Markdown,
  upvotes: z.number().int().nonnegative(),
  createdAt: IsoDate,
  editedAt: IsoDate.nullable(),
});
export type Comment = z.infer<typeof Comment>;

/** Auto-filled data from a pasted GitHub URL, before the project is saved. */
export const SubmissionPreview = z.object({
  repoUrl: Url,
  repoFullName: z.string(),
  name: z.string(),
  description: z.string(),
  license: LicenseInfo.nullable(),
  stars: z.number().int().nonnegative(),
  language: z.string().nullable(),
  socialPreviewUrl: z.string().nullable(),
  readmeHtml: z.string().nullable(),
  /** True when the signed-in user's GitHub account owns the repo. */
  ownedByViewer: z.boolean(),
  alreadyListed: ProjectRef.nullable(),
  warnings: z.array(z.string()),
});
export type SubmissionPreview = z.infer<typeof SubmissionPreview>;

// ── Adoption (task 4.12) ─────────────────────────────────────────────────

export const AdoptionRequestStatus = z.enum(["pending", "approved", "declined", "withdrawn", "cancelled"]);
export type AdoptionRequestStatus = z.infer<typeof AdoptionRequestStatus>;

export const AdoptionRequest = z.object({
  id: Id,
  project: ProjectRef,
  requester: UserSummary,
  message: z.string().max(2000),
  status: AdoptionRequestStatus,
  createdAt: IsoDate,
  decidedAt: IsoDate.nullable(),
});
export type AdoptionRequest = z.infer<typeof AdoptionRequest>;

/** Public view of a project's adoption state. Applicants and their messages are never public. */
export const ProjectAdoption = z.object({
  open: z.boolean(),
  note: z.string().max(1000),
  openedAt: IsoDate.nullable(),
  /** Who built it first (kept after a handover). null when it was never handed over and isn't open. */
  originalAuthor: UserSummary.nullable(),
  maintainer: UserSummary.nullable(),
  /** The viewer's most recent request for this project, if any. */
  viewerRequest: AdoptionRequest.nullable(),
  canManage: z.boolean(),
});
export type ProjectAdoption = z.infer<typeof ProjectAdoption>;

// ── Launch days, Fork Friday, build jams (task 4.6) ──────────────────────

/** show_off (5.9): a showcase-only event, e.g. "Show-off Saturday". Entries are showcases, not projects. */
export const GrowthEventKind = z.enum(["launch_day", "fork_friday", "build_jam", "show_off"]);
export type GrowthEventKind = z.infer<typeof GrowthEventKind>;
export const GrowthEventStatus = z.enum(["scheduled", "submitting", "voting", "ended", "cancelled"]);
export type GrowthEventStatus = z.infer<typeof GrowthEventStatus>;

export const GrowthEvent = z.object({
  id: Id,
  slug: Slug,
  kind: GrowthEventKind,
  title: z.string().max(120),
  bodyMd: z.string().max(10_000),
  startsAt: IsoDate,
  submissionEndsAt: IsoDate,
  votingEndsAt: IsoDate,
  featuredProject: ProjectRef.nullable(),
  /** Derived from the server clock and cancellation. */
  status: GrowthEventStatus,
  entryCount: z.number().int().nonnegative(),
});
export type GrowthEvent = z.infer<typeof GrowthEvent>;

export const GrowthEventDetail = GrowthEvent.extend({
  viewerCanSubmit: z.boolean(),
  viewerCanVote: z.boolean(),
  /** The entry the viewer voted for, if any. */
  viewerBallot: Id.nullable(),
});
export type GrowthEventDetail = z.infer<typeof GrowthEventDetail>;

export const EventEntry = z.object({
  id: Id,
  eventId: Id,
  project: ProjectCard,
  submittedBy: UserSummary,
  submittedAt: IsoDate,
  voteCount: z.number().int().nonnegative(),
  viewerVoted: z.boolean(),
  /** 1-based by votes (ties: earlier submission, then id); null while submissions are open. */
  rank: z.number().int().positive().nullable(),
});
export type EventEntry = z.infer<typeof EventEntry>;

// ── Build competitions (task 4.14) ───────────────────────────────────────

export const CompetitionStatus = z.enum(["draft", "open", "judging", "published", "cancelled"]);
export type CompetitionStatus = z.infer<typeof CompetitionStatus>;

/** Display only: the site never takes or pays money. */
export const Prize = z.object({
  id: Id,
  label: z.string().max(140),
  descriptionMd: z.string().max(2000),
  sponsorName: z.string().max(100).nullable(),
  sponsorUrl: Url.nullable(),
  place: z.number().int().positive().nullable(),
});
export type Prize = z.infer<typeof Prize>;

export const Criterion = z.object({
  id: Id,
  label: z.string().max(80),
  description: z.string().max(500),
  maxScore: z.number().int().min(1).max(100),
  weight: z.number().min(0.1).max(10),
});
export type Criterion = z.infer<typeof Criterion>;

export const CompetitionRound = z.object({
  id: Id,
  slug: Slug,
  eventSlug: Slug,
  title: z.string().max(120),
  rulesMd: z.string().max(20_000),
  eligibilityMd: z.string().max(10_000),
  submissionEndsAt: IsoDate,
  judgingEndsAt: IsoDate,
  publishedAt: IsoDate.nullable(),
  status: CompetitionStatus,
  prizes: z.array(Prize),
  criteria: z.array(Criterion),
  judges: z.array(UserSummary),
  version: z.number().int().positive(),
});
export type CompetitionRound = z.infer<typeof CompetitionRound>;

export const Scorecard = z.object({
  entryId: Id,
  scores: z.array(z.object({ criterionId: Id, score: z.number().int().min(0) })),
  note: z.string().max(2000),
  submittedAt: IsoDate.nullable(),
});
export type Scorecard = z.infer<typeof Scorecard>;

export const Award = z.object({
  id: Id,
  prize: Prize,
  entry: EventEntry,
  rationaleMd: z.string().max(5000),
  announcedAt: IsoDate,
});
export type Award = z.infer<typeof Award>;
