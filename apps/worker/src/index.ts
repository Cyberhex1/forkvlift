import { app } from "./app";
import { handleQueue, handleScheduled } from "./jobs";

export { ChatRoom } from "./durable/chat-room";
export { LiveThread } from "./durable/live-thread";

export default {
  fetch: app.fetch,
  scheduled: (controller, env, ctx) => {
    ctx.waitUntil(handleScheduled(controller, env));
  },
  queue: (batch, env) => handleQueue(batch, env),
} satisfies ExportedHandler<Env>;
