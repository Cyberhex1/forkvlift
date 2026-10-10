import { z } from "zod";
import { Id, IsoDate, Url, Username } from "./common";
import { DmPolicy, NotificationType, Role, Theme } from "./enums";

/** Layered 16-bit avatar choices (sprite keys come from packages/ui/src/sprites). */
export const AvatarConfig = z.object({
  hair: z.string().max(40),
  outfit: z.string().max(40),
  color: z.string().max(40),
  accessory: z.string().max(40).nullable(),
});
export type AvatarConfig = z.infer<typeof AvatarConfig>;

export const UserSummary = z.object({
  id: Id,
  username: Username,
  displayName: z.string().max(80),
  avatarUrl: z.string().nullable(),
  avatar: AvatarConfig.nullable(),
});
export type UserSummary = z.infer<typeof UserSummary>;

export const NotificationPref = z.object({ email: z.boolean(), push: z.boolean() });

export const UserSettings = z.object({
  theme: Theme,
  reducedMotion: z.enum(["system", "on", "off"]),
  musicDefault: z.enum(["on", "off"]),
  /** Off by default. Turning it on requires accepting the no-license disclaimer once. */
  showUnlicensed: z.boolean(),
  unlicensedDisclaimerAcceptedAt: IsoDate.nullable(),
  dmPolicy: DmPolicy,
  hideOnlineStatus: z.boolean(),
  weeklyDigest: z.boolean(),
  notifications: z.partialRecord(NotificationType, NotificationPref),
});
export type UserSettings = z.infer<typeof UserSettings>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: "system",
  reducedMotion: "system",
  musicDefault: "off",
  showUnlicensed: false,
  unlicensedDisclaimerAcceptedAt: null,
  dmPolicy: "everyone",
  hideOnlineStatus: false,
  weeklyDigest: false,
  notifications: {},
};

/** The signed-in user, as returned by /api/auth/me. */
export const SessionUser = UserSummary.extend({
  role: Role,
  email: z.string().nullable(),
  githubLogin: z.string().nullable(),
  settings: UserSettings,
});
export type SessionUser = z.infer<typeof SessionUser>;

export const ProfileLinks = z.object({
  github: Url.nullable(),
  website: Url.nullable(),
  socials: z.array(Url).max(6),
  donation: Url.nullable(),
});
export type ProfileLinks = z.infer<typeof ProfileLinks>;

export const Badge = z.object({
  key: z.string().max(40),
  name: z.string().max(60),
  description: z.string().max(200),
  iconKey: z.string().max(60),
});
export type Badge = z.infer<typeof Badge>;

export const UserBadge = z.object({ badge: Badge, awardedAt: IsoDate });
export type UserBadge = z.infer<typeof UserBadge>;
