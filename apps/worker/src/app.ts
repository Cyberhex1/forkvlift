/**
 * The Hono app (API only; static assets are served by Workers before this runs).
 * Kept free of `cloudflare:*` imports so tests can load it in plain Node.
 */
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./env";
import { HttpError } from "./core/errors";
import { errorResponse, unmountedRoutes } from "./core/http";
import { registerAdmin } from "./routes/admin";
import { registerAuth } from "./routes/auth";
import { registerCatalog } from "./routes/catalog";
import { registerCommunity } from "./routes/community";
import { registerDev } from "./routes/dev";
import { registerEvents } from "./routes/events";
import { registerFeeds } from "./routes/feeds";
import { registerGrowth } from "./routes/growth";
import { registerMessages } from "./routes/messages";
import { registerMcp } from "./routes/mcp";
import { registerMeta } from "./routes/meta";
import { registerSocial } from "./routes/social";
import { registerStudio } from "./routes/studio";
import { registerUsers } from "./routes/users";
import { registerV1 } from "./routes/v1";

export const app = new Hono<AppEnv>();

// WebSocket upgrades return a 101 with immutable headers, so they skip header middleware.
const headers = secureHeaders({ crossOriginResourcePolicy: "same-origin" });
app.use("/api/*", async (c, next) => {
  if (c.req.header("upgrade") === "websocket") return next();
  await headers(c, next);
  if (!c.res.headers.has("cache-control")) c.res.headers.set("cache-control", "no-store");
});

registerDev(app);
registerMeta(app);
registerAuth(app);
registerCatalog(app);
registerUsers(app);
registerSocial(app);
registerStudio(app);
registerMessages(app);
registerCommunity(app);
registerGrowth(app);
registerEvents(app);
registerFeeds(app);
registerAdmin(app);
registerMcp(app);
registerV1(app);

const missing = unmountedRoutes();
if (missing.length) throw new Error(`Contract routes without a handler: ${missing.join(", ")}`);

app.notFound((c) => errorResponse(c, "not_found", "No such API route"));

app.onError((err, c) => {
  if (err instanceof HttpError) return errorResponse(c, err.code, err.message, err.details);
  console.error(err);
  return errorResponse(c, "internal", "Something went wrong");
});
