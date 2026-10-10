import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { emptyPage, missing, todo } from "./_stubs";

/** Requests board + alternatives directory. Owner: Sol (tasks 4.5, 4.7). */
export function registerGrowth(app: Hono<AppEnv>) {
  mount(app, "listRequests", () => emptyPage());
  mount(app, "getRequest", () => missing("Request"));
  mount(app, "createRequest", () => todo("4.5"));
  mount(app, "claimRequest", () => todo("4.5"));

  mount(app, "listAlternatives", () => ({ items: [] }));
  mount(app, "getAlternatives", () => missing("Product"));
}
