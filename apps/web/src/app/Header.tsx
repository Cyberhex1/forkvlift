import { NavLink, Link } from "react-router";
import { SITE_NAME } from "@forkvlift/shared";
import { cn } from "@forkvlift/ui";
import { HeaderSearch } from "../features/catalog/HeaderSearch";
import { MusicButton } from "../features/music/MusicButton";
import { ProfileMenu } from "./ProfileMenu";

const NAV = [
  { to: "/studio", label: "Studio" },
  { to: "/forum", label: "Forum" },
  { to: "/plaza", label: "Plaza" },
  { to: "/resources", label: "Resources" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="font-display text-base whitespace-nowrap sm:text-lg" aria-label={`${SITE_NAME} home`}>
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => cn("rounded-pixel px-2.5 py-1.5 text-sm", isActive ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <HeaderSearch />
        </div>
        <MusicButton />
        <ProfileMenu />
      </div>
      <nav aria-label="Main (mobile)" className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => cn("rounded-pixel px-2.5 py-1 text-sm whitespace-nowrap", isActive ? "bg-surface-2 text-fg" : "text-muted")}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
