/** Header bell with unread badge (task 2.9). Hidden when signed out. */
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { buttonClasses, cn } from "@forkvlift/ui";
import { useSession } from "../../app/session";
import { api } from "../../lib/api";

export function NotificationsButton() {
  const { user } = useSession();
  const count = useQuery({
    queryKey: ["notification-count"],
    queryFn: () => api.call("listNotifications", { query: { limit: 1 } }),
    enabled: Boolean(user),
    refetchInterval: 60_000,
    select: (d) => d.unreadCount,
  });
  if (!user) return null;
  const n = count.data ?? 0;
  return (
    <Link to="/notifications" className={cn(buttonClasses("ghost", "sm"), "relative px-2")} aria-label={n ? `Notifications, ${n} unread` : "Notifications"}>
      <svg viewBox="0 0 16 16" aria-hidden className="size-4" shapeRendering="crispEdges">
        <path fill="currentColor" d="M7 1h2v1h2v1h1v5h1v2h1v1H2v-1h1V8h1V3h1V2h2zM6 13h4v1H9v1H7v-1H6z" />
      </svg>
      {n ? <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-accent-fg">{n > 99 ? "99+" : n}</span> : null}
    </Link>
  );
}
