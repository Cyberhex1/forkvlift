import type { RouteObject } from "react-router";

/** Owner: Sol. Profiles (2.8), DMs + notifications (2.9). */
export const profileRoutes: RouteObject[] = [
  { path: "/u/:name", lazy: async () => ({ Component: (await import("./ProfilePage")).ProfilePage }) },
  { path: "/messages", lazy: async () => ({ Component: (await import("./MessagesPage")).MessagesPage }) },
  { path: "/notifications", lazy: async () => ({ Component: (await import("./NotificationsPage")).NotificationsPage }) },
];
