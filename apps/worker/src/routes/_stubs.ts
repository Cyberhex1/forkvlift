/**
 * Phase 0 placeholders. Public reads return honest empty results (the catalog
 * really is empty until seeding); everything else answers 501 with the task id
 * that will build it. Replace these as tasks land.
 */
import { notFound, notImplemented } from "../core/http";

export const emptyPage = () => ({ items: [], nextCursor: null });
export const missing = (what: string) => {
  throw notFound(`${what} not found`);
};
export const todo = (task: string) => {
  throw notImplemented(task);
};
