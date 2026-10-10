import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Avatar, buttonClasses, cn, Skeleton } from "@forkvlift/ui";
import { signInUrl, useSession, useSignOut } from "./session";

export function ProfileMenu() {
  const { user, isLoading } = useSession();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isLoading) return <Skeleton className="size-9 rounded-full" />;
  if (!user) {
    return (
      <a href={signInUrl()} className={buttonClasses("primary", "sm")}>
        Sign in
      </a>
    );
  }

  const item = "block w-full rounded-pixel px-3 py-2 text-left text-sm hover:bg-surface-2";
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)} className="rounded-full">
        <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
      </button>
      {open ? (
        <div role="menu" className={cn("absolute right-0 z-40 mt-2 w-52 rounded-card border border-border bg-surface p-1 shadow-panel animate-fade-in")}>
          <p className="truncate px-3 py-2 text-xs text-muted">@{user.username}</p>
          <Link role="menuitem" to={`/u/${user.username}`} className={item} onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link role="menuitem" to="/studio" className={item} onClick={() => setOpen(false)}>
            Studio
          </Link>
          <Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button role="menuitem" type="button" className={item} onClick={() => signOut.mutate(undefined, { onSuccess: () => setOpen(false) })}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
