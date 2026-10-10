import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Outlet, useSearchParams } from "react-router";
import { AiTool, Difficulty, ListProjectsQuery, NO_LICENSE_DISCLAIMER, Platform, PROJECT_STAGE_LABELS, ProjectSort, ProjectStage, SITE_TAGLINE } from "@forkvlift/shared";
import { Button, Chip, Drawer, Modal, StateMessage } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { usePreferences } from "../../app/preferences";
import { api } from "../../lib/api";
import { ProjectCard, ProjectCardSkeleton } from "./ProjectCard";

const sortLabels: Record<(typeof ProjectSort.options)[number], string> = { trending: "Trending", newest: "Newest", most_forked: "Most forked", most_starred: "Most starred", recently_updated: "Recently updated", most_discussed: "Most discussed", staff_picks: "Staff picks", random: "Surprise me" };
const fieldClass = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2 text-sm";
const listKeys = ["category", "stage", "platform", "aiTool", "difficulty"] as const;
const textKeys = ["license", "stack", "replaces"] as const;
const boolKeys = ["hasDemo", "hasRelease", "maintained", "replacesPaid", "template"] as const;

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const prefs = usePreferences();
  const [drawer, setDrawer] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefError, setPrefError] = useState("");
  const raw = Object.fromEntries(params);
  // URL flags never bypass the account's unlicensed preference.
  delete raw.showUnlicensed; delete raw.cursor; delete raw.limit;
  const parsed = ListProjectsQuery.safeParse(raw);
  const query = { ...(parsed.success ? parsed.data : {}), showUnlicensed: prefs.showUnlicensed };
  const projects = useInfiniteQuery({ queryKey: ["projects", query], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam, signal }) => api.call("listProjects", { query: { ...query, cursor: pageParam } }, { signal }), getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: parsed.success, retry: false });
  const categories = useQuery({ queryKey: ["categories"], queryFn: ({ signal }) => api.call("listCategories", {}, { signal }), retry: false });
  const visible = [...new Map((projects.data?.pages.flatMap((page) => page.items) ?? []).filter((project) => project.license || prefs.showUnlicensed).map((project) => [project.id, project])).values()];
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = projects;
  useEffect(() => {
    if (!sentinel.current || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) void fetchNextPage(); }, { rootMargin: "250px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params); next.delete("cursor"); next.delete("limit");
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  }
  async function setUnlicensed(on: boolean, accept = false) {
    setSaving(true); setPrefError("");
    try { await prefs.setShowUnlicensed(on, { acceptDisclaimer: accept || undefined }); setDisclaimer(false); }
    catch (error) { setPrefError(error instanceof Error ? error.message : "Couldn't save this preference."); }
    finally { setSaving(false); }
  }
  function requestUnlicensed(on: boolean) { if (on && !prefs.disclaimerAccepted) setDisclaimer(true); else void setUnlicensed(on); }
  return <PageShell title={SITE_TAGLINE}>
    <p className="mb-6 max-w-2xl text-sm text-muted">Public code, a clear license, and a head start for your next build.</p>
    <div className="sticky top-[6.5rem] z-10 md:top-14 mb-4 space-y-3 rounded-card border border-border bg-surface p-3" aria-label="Feed toolbar">
      <div className="flex flex-wrap items-end gap-3">
        <form role="search" aria-label="Feed search" className="flex min-w-0 basis-full gap-2 sm:flex-1 sm:basis-auto" onSubmit={(event) => { event.preventDefault(); update("q", String(new FormData(event.currentTarget).get("q") ?? "").trim()); }}><label className="min-w-0 flex-1">Search<input key={params.get("q") ?? ""} name="q" type="search" maxLength={200} defaultValue={params.get("q") ?? ""} placeholder="Projects, tags, README…" className={fieldClass} /></label><Button type="submit" className="self-end">Search</Button></form>
        <label>Sort<select aria-label="Sort" className={fieldClass} value={params.get("sort") ?? "trending"} onChange={(event) => update("sort", event.target.value)}>{ProjectSort.options.map((sort) => <option key={sort} value={sort}>{sortLabels[sort]}</option>)}</select></label>
        <Button variant="secondary" onClick={() => setDrawer(true)}>Filters</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" role="switch" checked={prefs.showUnlicensed} disabled={saving} onChange={(event) => requestUnlicensed(event.target.checked)} />Show unlicensed projects</label>{params.size ? <Button variant="ghost" size="sm" onClick={() => setParams({})}>Clear search and filters</Button> : null}</div>
      <div className="flex flex-wrap gap-2" aria-label="Active filters">{Object.entries(raw).filter(([key, value]) => value && key !== "sort").map(([key, value]) => <Chip key={key} aria-label={`Remove ${key} filter`} onClick={() => update(key, "")}>{key}: {value} ×</Chip>)}</div>
      {prefError ? <p role="alert" className="text-sm text-danger">{prefError}</p> : null}
    </div>
    {!prefs.showUnlicensed && (projects.data?.pages[0]?.hiddenUnlicensedCount ?? 0) > 0 ? <p className="mb-4 text-sm text-muted">{projects.data!.pages[0]!.hiddenUnlicensedCount} unlicensed projects hidden · <Button variant="ghost" size="sm" disabled={saving} onClick={() => requestUnlicensed(true)}>Show them</Button></p> : null}
    {!parsed.success ? <StateMessage title="Invalid filters" tone="danger" action={<Button onClick={() => setParams({})}>Clear search and filters</Button>}>This URL contains a filter the API doesn't support. Clear it to browse projects.</StateMessage>
      : projects.isPending ? <div role="status"><span className="sr-only">Loading projects</span><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProjectCardSkeleton key={i} />)}</div></div>
      : projects.isError && !projects.data ? <StateMessage title="Couldn't load projects" tone="danger" action={<Button onClick={() => void projects.refetch()}>Try again</Button>}>Please try again in a moment.</StateMessage>
      : !visible.length ? <StateMessage title="No projects to show" action={params.size ? <Button variant="secondary" onClick={() => setParams({})}>Clear search and filters</Button> : undefined}>There are no matching projects. Try fewer filters or another search.</StateMessage>
      : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
    <div ref={sentinel} className="py-5" aria-live="polite">{projects.hasNextPage ? <div className="space-y-2">{projects.isFetchNextPageError ? <p className="text-danger">Couldn't load more projects. Your current results are still available.</p> : null}<Button variant="secondary" loading={projects.isFetchingNextPage} onClick={() => void projects.fetchNextPage()}>{projects.isFetchNextPageError ? "Retry loading more" : "Load more projects"}</Button></div> : visible.length ? <p className="text-sm text-muted">You've reached the end.</p> : null}</div>
    <Drawer open={drawer} onClose={() => setDrawer(false)} title="Filter projects"><form key={params.toString()} className="mt-4 space-y-5" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(params); next.delete("cursor"); next.delete("limit");
      for (const key of listKeys) { const values = data.getAll(key).map(String); if (values.length) next.set(key, values.join(",")); else next.delete(key); }
      for (const key of textKeys) { const value = String(data.get(key) ?? "").trim(); if (value) next.set(key, value); else next.delete(key); }
      for (const key of boolKeys) { if (data.has(key)) next.set(key, "true"); else next.delete(key); }
      const source = String(data.get("source") ?? ""); if (source) next.set("source", source); else next.delete("source");
      setParams(next); setDrawer(false);
    }}>
      <fieldset><legend className="font-semibold">Categories and subcategories</legend>{categories.isPending ? <p className="text-muted">Loading categories…</p> : categories.isError ? <StateMessage title="Couldn't load categories" tone="danger" action={<Button onClick={() => void categories.refetch()}>Retry categories</Button>} /> : !categories.data.items.length ? <p className="text-muted">No categories available.</p> : categories.data.items.map((category) => <label key={category.slug} className={`mt-2 flex items-center gap-2 ${category.parentSlug ? "pl-4" : ""}`}><input name="category" value={category.slug} type="checkbox" defaultChecked={(params.get("category") ?? "").split(",").includes(category.slug)} />{category.name}</label>)}</fieldset>
      <ChoiceGroup title="Stage" name="stage" values={ProjectStage.options} params={params} labels={PROJECT_STAGE_LABELS} />
      <ChoiceGroup title="Platform" name="platform" values={Platform.options} params={params} />
      <ChoiceGroup title="AI tool" name="aiTool" values={AiTool.options} params={params} />
      <ChoiceGroup title="Difficulty to run" name="difficulty" values={Difficulty.options} params={params} />
      <label className="block">License IDs (comma separated)<input name="license" maxLength={500} defaultValue={params.get("license") ?? ""} className={fieldClass} /></label>
      <label className="block">Stack / languages (comma separated)<input name="stack" maxLength={500} defaultValue={params.get("stack") ?? ""} className={fieldClass} /></label>
      <label className="block">Replaces product<input name="replaces" maxLength={60} defaultValue={params.get("replaces") ?? ""} className={fieldClass} /></label>
      <label className="block">Source<select name="source" defaultValue={params.get("source") ?? ""} className={fieldClass}><option value="">Any source</option><option value="community">Community</option><option value="curated">Curated</option></select></label>
      <fieldset><legend className="font-semibold">Availability</legend>{boolKeys.map((key, i) => <label key={key} className="mt-2 flex items-center gap-2"><input type="checkbox" name={key} defaultChecked={params.get(key) === "true" || params.get(key) === "1"} />{["Has live demo", "Has release binary", "Maintained in last 90 days", "Replaces a paid product", "Templates only"][i]}</label>)}</fieldset>
      <Button type="submit">Apply filters</Button>
    </form></Drawer>
    <Modal open={disclaimer} onClose={() => setDisclaimer(false)} title={NO_LICENSE_DISCLAIMER.title} className="max-w-[calc(100%-2rem)]"><p className="my-4 text-sm leading-relaxed">{NO_LICENSE_DISCLAIMER.body}</p><div className="flex flex-wrap gap-2"><Button loading={saving} onClick={() => void setUnlicensed(true, true)}>I understand</Button><Button variant="secondary" onClick={() => setDisclaimer(false)}>Cancel</Button></div>{prefError ? <p role="alert" className="mt-3 text-danger">{prefError}</p> : null}</Modal>
    <Outlet />
  </PageShell>;
}

function ChoiceGroup({ title, name, values, params, labels }: { title: string; name: string; values: readonly string[]; params: URLSearchParams; labels?: Record<string, string> }) {
  return <fieldset><legend className="font-semibold">{title}</legend>{values.map((value) => <label key={value} className="mt-2 flex items-center gap-2"><input name={name} value={value} type="checkbox" defaultChecked={(params.get(name) ?? "").split(",").includes(value)} />{labels?.[value] ?? value.replaceAll("_", " ")}</label>)}</fieldset>;
}



