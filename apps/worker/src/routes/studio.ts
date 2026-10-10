import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { todo } from "./_stubs";

/** Studio kanban + planning tools. Opus (task 2.1). */
export function registerStudio(app: Hono<AppEnv>) {
  mount(app, "getBoard", () => todo("2.1"));
  mount(app, "createColumn", () => todo("2.1"));
  mount(app, "updateColumn", () => todo("2.1"));
  mount(app, "deleteColumn", () => todo("2.1"));
  mount(app, "reorderColumns", () => todo("2.1"));
  mount(app, "createCard", () => todo("2.1"));
  mount(app, "updateCard", () => todo("2.1"));
  mount(app, "moveCard", () => todo("2.1"));
  mount(app, "deleteCard", () => todo("2.1"));
  mount(app, "getPlan", () => todo("2.1"));
  mount(app, "updatePlan", () => todo("2.1"));
}
