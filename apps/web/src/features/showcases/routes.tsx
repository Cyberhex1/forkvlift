import type { RouteObject } from "react-router";

/** Owner: Sol. Showcase feed and page (5.4), composer (5.5). Add showcase pages here. */
export const showcasesRoutes: RouteObject[] = [
  { path: "/showcase/new", lazy: async () => ({ Component: (await import("./ShowcaseComposer")).ShowcaseComposer }) },
  { path: "/showcase/mine", lazy: async () => ({ Component: (await import("./ShowcaseComposer")).MyShowcases }) },
  { path: "/showcase/:slug/edit", lazy: async () => ({ Component: (await import("./ShowcaseComposer")).ShowcaseComposer }) },
  { path: "/showcase", lazy: async () => ({ Component: (await import("./ShowcaseFeed")).ShowcaseFeed }) },
  { path: "/showcase/:slug", lazy: async () => ({ Component: (await import("./ShowcasePage")).ShowcasePage }) },
];
