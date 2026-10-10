import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { emptyPage, todo } from "./_stubs";

/** DMs, collab requests, blocks, notifications. Opus (tasks 2.3, 2.4). */
export function registerMessages(app: Hono<AppEnv>) {
  mount(app, "listConversations", () => emptyPage());
  mount(app, "startConversation", () => todo("2.4"));
  mount(app, "listMessages", () => todo("2.4"));
  mount(app, "sendMessage", () => todo("2.4"));
  mount(app, "listCollabRequests", () => emptyPage());
  mount(app, "createCollabRequest", () => todo("2.4"));
  mount(app, "respondCollabRequest", () => todo("2.4"));
  mount(app, "listBlocks", () => ({ items: [] }));
  mount(app, "blockUser", () => todo("2.4"));
  mount(app, "unblockUser", () => todo("2.4"));

  mount(app, "listNotifications", () => ({ ...emptyPage(), unreadCount: 0 }));
  mount(app, "markNotificationsRead", () => ({ unreadCount: 0 }));
}
