import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { emptyPage, missing, todo } from "./_stubs";

/** Follows, bookmarks, collections. Owner: Sol (task 2.5). */
export function registerSocial(app: Hono<AppEnv>) {
  mount(app, "listFollowing", () => emptyPage());
  mount(app, "follow", () => todo("2.5"));
  mount(app, "unfollow", () => todo("2.5"));
  mount(app, "listUserCollections", () => ({ items: [] }));
  mount(app, "getCollection", () => missing("Collection"));
  mount(app, "createCollection", () => todo("2.5"));
  mount(app, "updateCollection", () => todo("2.5"));
  mount(app, "deleteCollection", () => todo("2.5"));
  mount(app, "addCollectionItem", () => todo("2.5"));
  mount(app, "removeCollectionItem", () => todo("2.5"));
}
