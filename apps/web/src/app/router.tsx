/**
 * The route tree is assembled from each feature's routes.tsx, so feature owners
 * add pages without touching this file.
 */
import { createBrowserRouter } from "react-router";
import { avatarRoutes } from "../features/avatar/routes";
import { catalogRoutes } from "../features/catalog/routes";
import { communityRoutes } from "../features/community/routes";
import { growthRoutes } from "../features/growth/routes";
import { musicRoutes } from "../features/music/routes";
import { notFoundRoute, pagesRoutes } from "../features/pages/routes";
import { profileRoutes } from "../features/profile/routes";
import { resourcesRoutes } from "../features/resources/routes";
import { settingsRoutes } from "../features/settings/routes";
import { showcasesRoutes } from "../features/showcases/routes";
import { studioRoutes } from "../features/studio/routes";
import { Layout } from "./Layout";
import { RouteError } from "./RouteError";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      ...catalogRoutes,
      ...studioRoutes,
      ...profileRoutes,
      ...communityRoutes,
      ...resourcesRoutes,
      ...growthRoutes,
      ...showcasesRoutes,
      ...settingsRoutes,
      ...musicRoutes,
      ...avatarRoutes,
      ...pagesRoutes,
      notFoundRoute,
    ],
  },
]);
