import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { emptyPage, todo } from "./_stubs";

/** Admin console API (behind Cloudflare Access). Opus (tasks 1.7, 3.4). */
export function registerAdmin(app: Hono<AppEnv>) {
  mount(app, "listCandidates", () => emptyPage());
  mount(app, "importCandidate", () => todo("1.7"));
  mount(app, "decideCandidate", () => todo("1.7"));
  mount(app, "bulkDecideCandidates", () => todo("1.7"));
  mount(app, "listReports", () => emptyPage());
  mount(app, "resolveReport", () => todo("3.4"));
  mount(app, "upsertCategory", () => todo("1.7"));
  mount(app, "setStaffPick", () => todo("1.7"));
  mount(app, "setResourceProven", () => todo("3.5"));
  mount(app, "banUser", () => todo("3.4"));
  mount(app, "adminStats", () => todo("1.7"));
  mount(app, "auditLog", () => emptyPage());
}
