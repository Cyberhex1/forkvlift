import type { RouteObject } from "react-router";

/** Owner: Sol. Resources library (3.9). */
export const resourcesRoutes: RouteObject[] = [
  { path: "/resources", lazy: async () => ({ Component: (await import("./ResourcesPage")).ResourcesPage }) },
  { path: "/resources/:slug", lazy: async () => ({ Component: (await import("./ResourcesPage")).ResourcesPage }) },
];
