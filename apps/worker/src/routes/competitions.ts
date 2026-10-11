import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import * as comps from "../core/competitions";

/** Build competitions (task 4.14). Opus. Entries go through the event's entries route. */
export function registerCompetitions(app: Hono<AppEnv>) {
  mount(app, "listCompetitions", ({ query }, c) => comps.listCompetitions(c.env.DB, query));
  mount(app, "getCompetition", ({ params }, c) => comps.getCompetition(c.env.DB, params.slug));
  mount(app, "getCompetitionWinners", ({ params }, c) => comps.getWinners(c.env.DB, params.slug, c.get("user")?.id ?? null));
  mount(app, "getCompetitionJudging", ({ params }, c) => comps.getJudging(c.env.DB, params.slug, c.get("user")!));
  mount(app, "saveCompetitionScorecard", ({ params, body }, c) => comps.saveScorecard(c.env.DB, c.get("user")!, params.slug, params.entryId, body));
}
