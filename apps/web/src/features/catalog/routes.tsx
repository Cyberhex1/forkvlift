import type { RouteObject } from "react-router";

/** Owner: Sol. Feed (1.10), focus panel at /p/:slug (1.9), submit form (1.11). */
export const catalogRoutes: RouteObject[] = [
  {
    path: "/",
    lazy: async () => ({ Component: (await import("./FeedPage")).FeedPage }),
    children: [{ path: "p/:slug", lazy: async () => ({ Component: (await import("./ProjectPanelRoute")).ProjectPanelRoute }) }],
  },
  { path: "/submit", lazy: async () => ({ Component: (await import("./SubmitPage")).SubmitPage }) },
];
