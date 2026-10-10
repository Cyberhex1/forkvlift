import type { RouteObject } from "react-router";

/** Owner: Flash. Settings (2.10), collections pages (2.11). */
export const settingsRoutes: RouteObject[] = [
  { path: "/settings", lazy: async () => ({ Component: (await import("./SettingsPage")).SettingsPage }) },
  { path: "/collections/:id", lazy: async () => ({ Component: (await import("./CollectionPage")).CollectionPage }) },
];
