/** Owner: Sol (UI). Review queue (1.12), moderation queue (3.10). */
import { createBrowserRouter, NavLink, Outlet } from "react-router";
import { SITE_NAME } from "@forkvlift/shared";
import { cn, Spinner, StateMessage } from "@forkvlift/ui";

export { api } from "./api";


const NAV = [
  { to: "/", label: "Review queue" },
  { to: "/moderation", label: "Moderation" },
  { to: "/categories", label: "Categories" },
  { to: "/featured", label: "Staff picks" },
  { to: "/stats", label: "Stats" },
  { to: "/audit", label: "Audit log" },
];

function Shell() {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-border p-2 md:w-52 md:flex-col md:border-r md:border-b-0">
        <p className="px-2 py-1 font-display text-sm whitespace-nowrap">{SITE_NAME} admin</p>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end
            className={({ isActive }) => cn("rounded-pixel px-2 py-1.5 text-sm whitespace-nowrap", isActive ? "bg-surface-2" : "text-muted hover:text-fg")}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="min-w-0 flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}

const soon = (title: string) => () => <StateMessage title={title}>Coming soon.</StateMessage>;

export const router = createBrowserRouter([
  {
    element: <Shell />,
    HydrateFallback: () => <Spinner label="Loading admin console" />,
    children: [
      { path: "/", lazy: async () => ({ Component: (await import("./ReviewQueue")).ReviewQueue }) },
      { path: "/moderation", lazy: async () => ({ Component: (await import("./ModerationQueue")).ModerationQueue }) },
      { path: "/categories", Component: soon("Categories and tags") },
      { path: "/featured", Component: soon("Staff picks and featured slots") },
      { path: "/stats", Component: soon("Site stats") },
      { path: "/audit", Component: soon("Audit log") },
      { path: "*", Component: soon("Not found") },
    ],
  },
]);


