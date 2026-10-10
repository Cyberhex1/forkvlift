import { z } from "zod";
import { Id, IsoDate, Url } from "./common";
import { FollowTarget, NotificationType } from "./enums";
import { ProjectCard, ProjectRef } from "./project";
import { ProfileLinks, UserBadge, UserSummary } from "./user";

export const Profile = z.object({
  user: UserSummary,
  bio: z.string().max(2000),
  location: z.string().max(80).nullable(),
  links: ProfileLinks,
  stats: z.object({
    projects: z.number().int().nonnegative(),
    forksOfWork: z.number().int().nonnegative(),
    forkedBy: z.number().int().nonnegative(),
  }),
  badges: z.array(UserBadge),
  showcase: z.array(ProjectCard),
  joinedAt: IsoDate,
  online: z.boolean().nullable(),
  viewer: z.object({ isSelf: z.boolean(), following: z.boolean(), blocked: z.boolean() }).nullable(),
});
export type Profile = z.infer<typeof Profile>;

export const Follow = z.object({
  targetType: FollowTarget,
  targetId: Id,
  label: z.string(),
  href: z.string(),
  createdAt: IsoDate,
});
export type Follow = z.infer<typeof Follow>;

export const Collection = z.object({
  id: Id,
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  isPublic: z.boolean(),
  /** The built-in "Saved" collection that bookmarks go into. */
  isDefault: z.boolean(),
  owner: UserSummary,
  itemCount: z.number().int().nonnegative(),
  updatedAt: IsoDate,
});
export type Collection = z.infer<typeof Collection>;

export const CollectionDetail = z.object({
  collection: Collection,
  items: z.array(ProjectCard),
});
export type CollectionDetail = z.infer<typeof CollectionDetail>;

export const Notification = z.object({
  id: Id,
  type: NotificationType,
  read: z.boolean(),
  actor: UserSummary.nullable(),
  title: z.string().max(200),
  href: z.string(),
  createdAt: IsoDate,
});
export type Notification = z.infer<typeof Notification>;

export const Conversation = z.object({
  id: Id,
  participants: z.array(UserSummary),
  lastMessagePreview: z.string().max(200).nullable(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: IsoDate,
});
export type Conversation = z.infer<typeof Conversation>;

export const DirectMessage = z.object({
  id: Id,
  conversationId: Id,
  sender: UserSummary,
  body: z.string().max(4000),
  createdAt: IsoDate,
});
export type DirectMessage = z.infer<typeof DirectMessage>;

export const CollabRequest = z.object({
  id: Id,
  from: UserSummary,
  to: UserSummary,
  project: ProjectRef.nullable(),
  /** "Request to build on this" for unlicensed projects uses kind=build_permission. */
  kind: z.enum(["collab", "build_permission", "adoption"]),
  role: z.string().max(80),
  availability: z.string().max(120),
  message: z.string().max(2000),
  status: z.enum(["pending", "accepted", "declined"]),
  createdAt: IsoDate,
});
export type CollabRequest = z.infer<typeof CollabRequest>;

export const BlockedUser = z.object({ user: UserSummary, kind: z.enum(["block", "mute"]), createdAt: IsoDate });
export type BlockedUser = z.infer<typeof BlockedUser>;

export const SocialLink = Url;
