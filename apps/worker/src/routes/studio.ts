import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import * as studio from "../core/studio";

/** Studio kanban + planning tools. Opus (task 2.1). */
export function registerStudio(app: Hono<AppEnv>) {
  const uid = (c: { get: (k: "user") => { id: string } | null }) => c.get("user")!.id;

  mount(app, "getBoard", (_, c) => studio.getBoard(c.env.DB, uid(c)));
  mount(app, "createColumn", ({ body }, c) => studio.createColumn(c.env.DB, uid(c), body.title));
  mount(app, "updateColumn", ({ params, body }, c) => studio.updateColumn(c.env.DB, uid(c), params.id, body));
  mount(app, "deleteColumn", async ({ params }, c) => {
    await studio.deleteColumn(c.env.DB, uid(c), params.id);
    return { ok: true as const };
  });
  mount(app, "reorderColumns", async ({ body }, c) => ({ columns: await studio.reorderColumns(c.env.DB, uid(c), body.columnIds) }));
  mount(app, "createCard", ({ body }, c) => studio.createCard(c.env.DB, uid(c), body));
  mount(app, "updateCard", ({ params, body }, c) => studio.updateCard(c.env.DB, uid(c), params.id, body));
  mount(app, "moveCard", ({ params, body }, c) => studio.moveCard(c.env.DB, uid(c), params.id, body.columnId, body.position));
  mount(app, "deleteCard", async ({ params }, c) => {
    await studio.deleteCard(c.env.DB, uid(c), params.id);
    return { ok: true as const };
  });
  mount(app, "getPlan", ({ params }, c) => studio.getPlan(c.env.DB, uid(c), params.id));
  mount(app, "updatePlan", ({ params, body }, c) => studio.updatePlan(c.env.DB, uid(c), params.id, body));
}
