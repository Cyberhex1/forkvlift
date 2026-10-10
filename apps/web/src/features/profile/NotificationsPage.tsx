/** Task 2.9: notification center. */
import { Link } from "react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Spinner, StateMessage, buttonClasses, cn } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";

export function NotificationsPage() {
  const { user, isLoading } = useSession();
  const qc = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.call("listNotifications", { query: { cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: Boolean(user),
  });
  const markAll = useMutation({
    mutationFn: () => api.call("markNotificationsRead", { body: { all: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notification-count"] });
    },
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.call("markNotificationsRead", { body: { ids: [id] } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notification-count"] }),
  });

  if (isLoading) return <Spinner label="Loading" className="m-8" />;
  if (!user) return <StateMessage title="Sign in to see notifications" action={<a className={buttonClasses()} href={signInUrl()}>Sign in with GitHub</a>} />;
  const unread = list.data?.pages[0]?.unreadCount ?? 0;
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <PageShell
      title="Notifications"
      actions={
        <div className="flex gap-2">
          <Link to="/settings#notifications" className={buttonClasses("ghost", "sm")}>Settings</Link>
          <Button size="sm" variant="secondary" disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
        </div>
      }
    >
      {list.isPending ? <Spinner label="Loading notifications" /> : null}
      {list.isError ? <StateMessage title="Couldn't load notifications" tone="danger" action={<Button onClick={() => void list.refetch()}>Try again</Button>} /> : null}
      {list.isSuccess && !items.length ? <StateMessage title="You're all caught up">Forks, comments, messages and collab requests will show up here.</StateMessage> : null}
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {items.map((n) => (
          <li key={n.id}>
            <Link to={n.href} onClick={() => !n.read && markOne.mutate(n.id)} className={cn("flex items-start gap-3 p-3 hover:bg-surface-2", !n.read && "bg-surface-2")}>
              {n.actor ? <Avatar src={n.actor.avatarUrl} name={n.actor.displayName} size="sm" /> : <span aria-hidden className="size-7" />}
              <span className="min-w-0 flex-1">
                <span className={cn("block break-words", !n.read && "font-semibold")}>{n.title}</span>
                <span className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
              </span>
              {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
            </Link>
          </li>
        ))}
      </ul>
      {list.hasNextPage ? <Button className="mt-4" variant="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Load more</Button> : null}
    </PageShell>
  );
}
