import { useNavigate, useSearchParams } from "react-router";

export function HeaderSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return <form role="search" aria-label="Header search" onSubmit={(event) => {
    event.preventDefault(); const next = new URLSearchParams(params);
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (q) next.set("q", q); else next.delete("q"); next.delete("cursor"); next.delete("limit");
    void navigate(`/${next.size ? `?${next}` : ""}`);
  }}><label htmlFor="header-search" className="sr-only">Search projects</label><input key={params.get("q") ?? ""} id="header-search" name="q" type="search" maxLength={200} defaultValue={params.get("q") ?? ""} placeholder="Search projects…" className="h-9 w-full max-w-sm rounded-pixel border border-border bg-surface px-3 text-sm placeholder:text-muted" /></form>;
}
