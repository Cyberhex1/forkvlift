import { z } from "zod";

/** Public stage badge. WIP cards may also show their Studio column title. */
export const ProjectStage = z.enum(["finished", "wip", "adoption"]);
export type ProjectStage = z.infer<typeof ProjectStage>;
export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  finished: "Finished",
  wip: "Work in progress",
  adoption: "Up for adoption",
};

export const ProjectSource = z.enum(["community", "curated"]);
export type ProjectSource = z.infer<typeof ProjectSource>;

export const AiTool = z.enum([
  "claude-code",
  "cursor",
  "lovable",
  "bolt",
  "replit",
  "windsurf",
  "v0",
  "codex",
  "antigravity",
  "copilot",
  "gemini-cli",
  "other",
]);
export type AiTool = z.infer<typeof AiTool>;

export const AiInvolvement = z.enum(["assisted", "mostly_ai", "all_ai"]);
export type AiInvolvement = z.infer<typeof AiInvolvement>;
export const AI_INVOLVEMENT_LABELS: Record<AiInvolvement, string> = {
  assisted: "AI-assisted",
  mostly_ai: "Mostly AI",
  all_ai: "No hand-written code",
};

export const Platform = z.enum(["web", "desktop", "mobile", "cli", "browser_extension", "self_hosted"]);
export type Platform = z.infer<typeof Platform>;

export const Difficulty = z.enum(["one_click", "needs_api_keys", "needs_server"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const ProjectSort = z.enum([
  "trending",
  "newest",
  "most_forked",
  "most_starred",
  "recently_updated",
  "most_discussed",
  "staff_picks",
  "random",
]);
export type ProjectSort = z.infer<typeof ProjectSort>;

export const Theme = z.enum(["system", "light", "dark", "retro"]);
export type Theme = z.infer<typeof Theme>;

export const Role = z.enum(["user", "admin"]);
export type Role = z.infer<typeof Role>;

export const DmPolicy = z.enum(["everyone", "followers", "nobody"]);
export type DmPolicy = z.infer<typeof DmPolicy>;

export const NotificationType = z.enum([
  "fork",
  "comment",
  "collab_request",
  "message",
  "mention",
  "follow_post",
  "stage_change",
  "system",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const ReportTarget = z.enum(["project", "comment", "thread", "post", "chat_message", "user", "resource"]);
export type ReportTarget = z.infer<typeof ReportTarget>;

export const ReportReason = z.enum(["spam", "malware", "harassment", "stolen_code", "other"]);
export type ReportReason = z.infer<typeof ReportReason>;

export const ResourceType = z.enum([
  "skill",
  "system_prompt",
  "prompt_template",
  "workflow",
  "mcp_config",
  "starter_repo",
]);
export type ResourceType = z.infer<typeof ResourceType>;

export const FollowTarget = z.enum(["user", "category", "project"]);
export type FollowTarget = z.infer<typeof FollowTarget>;
