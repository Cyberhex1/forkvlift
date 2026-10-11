/**
 * Showcases (Phase 5): what people built with AI, with or without public
 * code. Separate from the catalog and never forkable.
 */
import { z } from "zod";
import { Id, IsoDate, Markdown, Slug, Url } from "./common";
import { CategoryRef, ProjectRef } from "./project";
import { UserSummary } from "./user";

export const ShowcaseKind = z.enum(["web", "mobile", "desktop", "game", "art", "video", "tool", "other"]);
export type ShowcaseKind = z.infer<typeof ShowcaseKind>;
export const ShowcaseStage = z.enum(["finished", "wip"]);
export type ShowcaseStage = z.infer<typeof ShowcaseStage>;
export const ShowcaseLinkKind = z.enum(["live", "app_store", "play_store", "download", "demo", "repo", "store", "other"]);
export type ShowcaseLinkKind = z.infer<typeof ShowcaseLinkKind>;

export const ShowcaseMedia = z.object({
  id: Id,
  kind: z.enum(["image", "gif", "video", "embed"]),
  /** Uploaded file (image, gif, video) or a YouTube/Vimeo player URL (embed). */
  url: z.string(),
  alt: z.string().max(200),
});
export type ShowcaseMedia = z.infer<typeof ShowcaseMedia>;

export const ShowcaseLink = z.object({
  kind: ShowcaseLinkKind,
  label: z.string().max(60),
  url: Url,
});
export type ShowcaseLink = z.infer<typeof ShowcaseLink>;

export const ShowcaseCard = z.object({
  id: Id,
  slug: Slug,
  title: z.string().max(100),
  tagline: z.string().max(140),
  maker: UserSummary,
  category: CategoryRef,
  kind: ShowcaseKind,
  stage: ShowcaseStage,
  coverUrl: z.string().nullable(),
  /** First video or embed, for hover previews. */
  previewVideoUrl: z.string().nullable(),
  /** True when it links a public repo; the UI says "Closed source" otherwise. */
  hasPublicCode: z.boolean(),
  /** Set when the code is also listed in the catalog. */
  catalogProject: ProjectRef.nullable(),
  aiTools: z.array(z.string().max(40)),
  tags: z.array(z.string().max(40)),
  upvotes: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  staffPick: z.boolean(),
  status: z.enum(["draft", "published"]),
  publishedAt: IsoDate.nullable(),
  updatedAt: IsoDate,
  viewer: z.object({ upvoted: z.boolean(), saved: z.boolean(), isMaker: z.boolean() }).nullable(),
});
export type ShowcaseCard = z.infer<typeof ShowcaseCard>;

/** A resource credited under "Built with". */
export const ShowcaseResourceRef = z.object({ id: Id, slug: Slug, title: z.string().max(120) });
export type ShowcaseResourceRef = z.infer<typeof ShowcaseResourceRef>;

export const ShowcaseDetail = ShowcaseCard.extend({
  bodyMd: Markdown,
  buildStoryMd: Markdown,
  buildTime: z.string().max(60).nullable(),
  repoUrl: Url.nullable(),
  media: z.array(ShowcaseMedia),
  links: z.array(ShowcaseLink),
  /** "Built with" (5.3): catalog projects and resources the maker credits. Removed or hidden ones drop out. */
  builtWith: z.object({ projects: z.array(ProjectRef), resources: z.array(ShowcaseResourceRef) }),
});
export type ShowcaseDetail = z.infer<typeof ShowcaseDetail>;

export const ShowcaseComment = z.object({
  id: Id,
  showcaseId: Id,
  parentId: Id.nullable(),
  author: UserSummary,
  body: z.string().max(5000),
  createdAt: IsoDate,
  editedAt: IsoDate.nullable(),
});
export type ShowcaseComment = z.infer<typeof ShowcaseComment>;

/** What the composer sends. Media is uploaded first (kind "media"), then referenced by key. */
export const ShowcaseInput = z.object({
  title: z.string().trim().min(2).max(100),
  tagline: z.string().trim().max(140),
  bodyMd: z.string().max(20_000),
  buildStoryMd: z.string().max(20_000),
  categorySlug: Slug,
  kind: ShowcaseKind,
  stage: ShowcaseStage,
  coverKey: z.string().max(200).nullable(),
  media: z
    .array(z.union([z.object({ key: z.string().max(200), alt: z.string().max(200) }), z.object({ embedUrl: Url, alt: z.string().max(200) })]))
    .max(12),
  links: z.array(ShowcaseLink).max(8),
  repoUrl: Url.nullable(),
  aiTools: z.array(z.string().trim().min(1).max(40)).max(10),
  buildTime: z.string().trim().max(60).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8),
  /** "Built with": slugs of catalog projects and resources. Omit to leave unchanged (none on create). */
  builtWith: z.object({ projects: z.array(Slug).max(10), resources: z.array(Slug).max(10) }).optional(),
});
export type ShowcaseInput = z.infer<typeof ShowcaseInput>;
