import type { RouteObject } from "react-router";

/** Owner: Sol. Forum (3.8), Plaza (3.7). */
export const communityRoutes: RouteObject[] = [
  { path: "/forum", lazy: async () => ({ Component: (await import("./ForumPage")).ForumPage }) },
  { path: "/forum/:board", lazy: async () => ({ Component: (await import("./ForumPage")).ForumPage }) },
  { path: "/forum/t/:id", lazy: async () => ({ Component: (await import("./ThreadPage")).ThreadPage }) },
  { path: "/plaza", lazy: async () => ({ Component: (await import("./PlazaPage")).PlazaPage }) },
];
