import type { RouteObject } from "react-router";

/** Owner: Flash. Avatar builder (3.11). */
export const avatarRoutes: RouteObject[] = [
  { path: "/settings/avatar", lazy: async () => ({ Component: (await import("./AvatarBuilder")).AvatarBuilderPage }) },
];
