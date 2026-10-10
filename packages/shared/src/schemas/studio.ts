import { z } from "zod";
import { Id, IsoDate, Markdown } from "./common";
import { ProjectStage } from "./enums";
import { ProjectCard } from "./project";

export const BoardColumn = z.object({
  id: Id,
  title: z.string().min(1).max(60),
  /** A token key from packages/ui (e.g. "pixel-3"), never a raw color. */
  color: z.string().max(40).nullable(),
  position: z.number().int().nonnegative(),
  collapsed: z.boolean(),
  wipLimit: z.number().int().positive().nullable(),
});
export type BoardColumn = z.infer<typeof BoardColumn>;

export const BoardCard = z.object({
  id: Id,
  columnId: Id,
  position: z.number().int().nonnegative(),
  title: z.string().min(1).max(100),
  idea: z.string().max(1000).nullable(),
  stage: ProjectStage,
  isPublic: z.boolean(),
  /** Set once the card is linked to a catalog project. */
  project: ProjectCard.nullable(),
  updatedAt: IsoDate,
});
export type BoardCard = z.infer<typeof BoardCard>;

export const Board = z.object({
  id: Id,
  columns: z.array(BoardColumn),
  cards: z.array(BoardCard),
});
export type Board = z.infer<typeof Board>;

export const DEFAULT_BOARD_COLUMNS = ["Idea", "Develop", "Bug fix", "Ready for release"] as const;

export const RoadmapItem = z.object({
  id: Id,
  title: z.string().max(120),
  status: z.enum(["planned", "in_progress", "done"]),
  votes: z.number().int().nonnegative(),
});
export type RoadmapItem = z.infer<typeof RoadmapItem>;

export const ProjectPlan = z.object({
  cardId: Id,
  checklist: z.array(z.object({ id: Id, text: z.string().max(200), done: z.boolean() })),
  notesMd: Markdown,
  roadmap: z.array(RoadmapItem),
  lookingForHelp: z.string().max(500).nullable(),
  savedPrompts: z.array(z.object({ id: Id, title: z.string().max(100), body: z.string().max(10_000) })),
  githubIssuesSync: z.boolean(),
});
export type ProjectPlan = z.infer<typeof ProjectPlan>;
