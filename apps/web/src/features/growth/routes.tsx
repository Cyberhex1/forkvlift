import type { RouteObject } from "react-router";

/** Owner: Sol. Requests board (4.5), alternatives directory (4.7). */
export const growthRoutes: RouteObject[] = [
  { path: "/requests", lazy: async () => ({ Component: (await import("./RequestsPage")).RequestsPage }) },
  { path: "/requests/:id", lazy: async () => ({ Component: (await import("./RequestsPage")).RequestsPage }) },
  { path: "/alternatives", lazy: async () => ({ Component: (await import("./AlternativesPage")).AlternativesPage }) },
  { path: "/alternatives/:product", lazy: async () => ({ Component: (await import("./AlternativesPage")).AlternativesPage }) },
];
