import { Link } from "react-router";
import { SITE_NAME } from "@forkvlift/shared";

/** Footer slot (task 1.17). */
export function Footer() {
  const links = [
    ["/about", "About"],
    ["/licensing", "Licensing 101"],
    ["/rules", "Rules"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
    ["/dmca", "DMCA"],
  ] as const;
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
        <span className="font-display">{SITE_NAME}</span>
        {links.map(([to, label]) => (
          <Link key={to} to={to} className="hover:text-fg">
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
