import { z } from "zod";
import { Id, IsoDate, Markdown, Slug, Url } from "./common";
import { ReportReason, ReportTarget } from "./enums";
import { LicenseInfo, ProjectRef } from "./project";
import { UserSummary } from "./user";

// ── Curation queue ───────────────────────────────────────────────────────

export const CandidateCheck = z.object({
  key: z.enum(["license", "readme", "not_empty_fork", "not_archived", "no_secrets", "not_malware"]),
  label: z.string(),
  /** null = check has not run yet. License is shown, never required. */
  pass: z.boolean().nullable(),
  detail: z.string().nullable(),
});
export type CandidateCheck = z.infer<typeof CandidateCheck>;

export const CandidateStatus = z.enum(["pending", "published", "draft", "rejected", "snoozed"]);
export type CandidateStatus = z.infer<typeof CandidateStatus>;

export const Candidate = z.object({
  id: Id,
  repoUrl: Url,
  repoFullName: z.string(),
  name: z.string(),
  description: z.string(),
  stars: z.number().int().nonnegative(),
  starVelocity: z.number(),
  license: LicenseInfo.nullable(),
  lastCommitAt: IsoDate.nullable(),
  hasReadme: z.boolean(),
  hasDemo: z.boolean(),
  hasScreenshots: z.boolean(),
  score: z.number(),
  checks: z.array(CandidateCheck),
  status: CandidateStatus,
  foundVia: z.object({
    kind: z.enum(["github_search", "watchlist", "manual", "reddit_link"]),
    url: Url.nullable(),
  }),
  rejectReason: z.string().nullable(),
  snoozedUntil: IsoDate.nullable(),
  proposed: z.object({
    name: z.string(),
    tagline: z.string(),
    categorySlug: Slug.nullable(),
    tags: z.array(z.string()),
    thumbnailUrl: z.string().nullable(),
  }),
  project: ProjectRef.nullable(),
  createdAt: IsoDate,
});
export type Candidate = z.infer<typeof Candidate>;

export const CandidateAction = z.enum(["approve_publish", "approve_draft", "reject", "snooze"]);
export type CandidateAction = z.infer<typeof CandidateAction>;

// ── Moderation ───────────────────────────────────────────────────────────

export const Report = z.object({
  id: Id,
  targetType: ReportTarget,
  targetId: Id,
  reason: ReportReason,
  note: z.string().max(1000),
  status: z.enum(["open", "resolved", "dismissed"]),
  reporter: UserSummary.nullable(),
  /** What was reported, for the moderation queue ("Comment on Pixel Planner"). Null if it no longer exists. */
  targetLabel: z.string().nullable(),
  targetHref: z.string().nullable(),
  createdAt: IsoDate,
});
export type Report = z.infer<typeof Report>;

export const AuditLogEntry = z.object({
  id: Id,
  actor: UserSummary.nullable(),
  action: z.string().max(80),
  targetType: z.string().max(40),
  targetId: z.string().max(80),
  details: z.record(z.string(), z.unknown()),
  createdAt: IsoDate,
});
export type AuditLogEntry = z.infer<typeof AuditLogEntry>;

export const AdminStats = z.object({
  signups: z.object({ total: z.number(), last7d: z.number() }),
  projects: z.object({ total: z.number(), last7d: z.number(), unlicensed: z.number() }),
  forkClicks: z.object({ last7d: z.number() }),
  chat: z.object({ messagesLast7d: z.number() }),
  queue: z.object({ pending: z.number() }),
});
export type AdminStats = z.infer<typeof AdminStats>;

// ── Growth (requests board, alternatives) ────────────────────────────────

export const BuildRequest = z.object({
  id: Id,
  title: z.string().min(3).max(140),
  bodyMd: Markdown,
  author: UserSummary,
  replaces: z.string().max(60).nullable(),
  status: z.enum(["open", "claimed", "built"]),
  claimedBy: UserSummary.nullable(),
  builtProject: ProjectRef.nullable(),
  upvotes: z.number().int().nonnegative(),
  createdAt: IsoDate,
});
export type BuildRequest = z.infer<typeof BuildRequest>;

export const AlternativeProduct = z.object({
  slug: Slug,
  name: z.string().max(60),
  projectCount: z.number().int().nonnegative(),
  monthlyPriceUsd: z.number().nonnegative().nullable(),
});
export type AlternativeProduct = z.infer<typeof AlternativeProduct>;

export const SavingsStats = z.object({
  estimatedMonthlySavingsUsd: z.number().nonnegative(),
  forkCount: z.number().int().nonnegative(),
  asOf: IsoDate,
});
export type SavingsStats = z.infer<typeof SavingsStats>;
