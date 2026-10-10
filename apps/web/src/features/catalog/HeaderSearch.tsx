import { useNavigate, useSearchParams } from "react-router";

/** Header search slot (task 1.10 replaces this with the full toolbar search). */
export function HeaderSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim();
        void navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
      }}
    >
      <label htmlFor="header-search" className="sr-only">
        Search projects
      </label>
      <input
        id="header-search"
        name="q"
        type="search"
        defaultValue={params.get("q") ?? ""}
        placeholder="Search projects…"
        className="h-9 w-full max-w-sm rounded-pixel border border-border bg-surface px-3 text-sm placeholder:text-muted"
      />
    </form>
  );
}
