import type { RouteObject } from "react-router";

/** Owner: Sol. Kanban (2.6) and planning panel (2.7). */
export const studioRoutes: RouteObject[] = [
  { path: "/studio", lazy: async () => ({ Component: (await import("./StudioPage")).StudioPage }) },
];
