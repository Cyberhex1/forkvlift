/**
 * Task 3.9: the Resources library. Skills, prompts, workflows and configs that
 * people used to build things. "Proven" sits on top; everything else is
 * "New / untested" until enough projects or reports back it up.
 */
import { useCallback, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Resource, ResourceDetail, ResourceType } from "@forkvlift/shared";
import { Avatar, Badge, Button, Card, Chip, Modal, Skeleton, Spinner, StateMessage, buttonClasses, cn } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { ShowcaseStrip } from "../showcases/ShowcaseStrip";
import { ReportButton } from "../../app/ReportButton";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { SubmitVerification } from "../catalog/SubmitVerification";
import { ProjectEmbed } from "../community/ProjectEmbed";
import { relative } from "../community/format";

export const RESOURCE_TYPES: { id: ResourceType; label: string }[] = [
  { id: "skill", label: "Skills" },
  { id: "system_prompt", label: "System prompts" },
  { id: "prompt_template", label: "Prompt templates" },
  { id: "workflow", label: "Workflows" },
  { id: "mcp_config", label: "MCP configs" },
  { id: "starter_repo", label: "Starter repos" },
];
const typeLabel = (t: ResourceType) => RESOURCE_TYPES.find((x) => x.id === t)?.label.replace(/s$/, "") ?? t;

export function ResourcesPage() {
  const { slug } = useParams();
  return slug ? <ResourceView slug={slug} /> : <Library />;
}

function Library() {
  const [params, setParams] = useSearchParams();
  const { user } = useSession();
  const [sharing, setSharing] = useState(false);
  const type = params.get("type") as ResourceType | null;
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const set = (k: string, v: string | null) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });
  const shelf = (proven: boolean) => ({
    queryKey: ["resources", { type, q, proven }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.call("listResources", { query: { type: type ? [type] : undefined, q: q || undefined, proven, cursor: pageParam } }),
    getNextPageParam: (p: { nextCursor: string | null }) => p.nextCursor ?? undefined,
  });
  const proven = useInfiniteQuery(shelf(true));
  const fresh = useInfiniteQuery(shelf(false));

  return (
    <PageShell
      title="Resources"
      actions={user ? <Button onClick={() => setSharing(true)}>Share a resource</Button> : <a className={buttonClasses()} href={signInUrl()}>Sign in to share</a>}
    >
      <p className="-mt-2 mb-4 max-w-2xl text-muted">Skills, prompts, workflows and configs people actually built with. Say whether they worked for you; that's what earns the Proven badge.</p>
      <form
        role="search"
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", search.trim() || null);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search resources</span>
          <input className="w-full rounded-pixel border border-border bg-surface p-2" type="search" placeholder="Search resources" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        <Chip selected={!type} onClick={() => set("type", null)}>All</Chip>
        {RESOURCE_TYPES.map((t) => <Chip key={t.id} selected={type === t.id} onClick={() => set("type", type === t.id ? null : t.id)}>{t.label}</Chip>)}
      </div>

      <Shelf title="Proven" hint="Linked by 3+ projects or confirmed by 5+ people." query={proven} empty="Nothing proven here yet." />
      <Shelf title="New / untested" hint="Try one and report back." query={fresh} empty={q || type ? "No matches." : "Nothing shared yet. Be the first."} />

      {sharing ? <ShareModal onClose={() => setSharing(false)} /> : null}
    </PageShell>
  );
}

function Shelf({ title, hint, query, empty }: { title: string; hint: string; query: ReturnType<typeof useInfiniteQuery<{ items: Resource[]; nextCursor: string | null }>>; empty: string }) {
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="mb-8" aria-labelledby={`shelf-${title}`}>
      <h2 id={`shelf-${title}`} className="font-display text-lg">{title}</h2>
      <p className="mb-3 text-sm text-muted">{hint}</p>
      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : query.isError ? (
        <StateMessage title="Couldn't load resources" tone="danger" action={<Button onClick={() => void query.refetch()}>Try again</Button>} />
      ) : !items.length ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => <li key={r.id}><ResourceCard r={r} /></li>)}
        </ul>
      )}
      {query.hasNextPage ? <Button className="mt-3" size="sm" variant="secondary" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>More</Button> : null}
    </section>
  );
}

function ResourceCard({ r }: { r: Resource }) {
  return (
    <Link to={`/resources/${r.slug}`} className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-4 hover:bg-surface-2">
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{typeLabel(r.type)}</Badge>
        {r.proven ? <Badge tone="success">Proven</Badge> : null}
        {r.hasExecutableCode ? <Badge tone="warning">Runs code</Badge> : null}
      </span>
      <span className="font-semibold break-words">{r.title}</span>
      <span className="line-clamp-2 text-sm text-muted">{r.summary}</span>
      <span className="mt-auto flex items-center gap-2 text-xs text-muted">
        <Avatar src={r.author.avatarUrl} name={r.author.displayName} size="xs" />
        @{r.author.username} · ✓ {r.workedCount} · ✗ {r.didntWorkCount}
        {r.ratingCount ? ` · ★ ${r.rating}` : ""}
      </span>
    </Link>
  );
}

function ResourceView({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const key = ["resource", slug];
  const r = useQuery({ queryKey: key, queryFn: () => api.call("getResource", { params: { slug } }) });
  const [note, setNote] = useState("");
  const refresh = (summary: Resource) => {
    qc.setQueryData<ResourceDetail>(key, (d) => (d ? { ...d, ...summary } : d));
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["resources"] });
  };
  const report = useMutation({ mutationFn: (worked: boolean) => api.call("reportResourceResult", { params: { slug }, body: { worked, note } }), onSuccess: (s) => { setNote(""); refresh(s); } });
  const rate = useMutation({ mutationFn: (stars: number) => api.call("rateResource", { params: { slug }, body: { stars } }), onSuccess: refresh });

  if (r.isPending) return <PageShell><Skeleton className="mb-4 h-8 w-1/2" /><Skeleton className="h-64" /></PageShell>;
  if (r.isError) {
    const gone = (r.error as { status?: number }).status === 404;
    return <PageShell><StateMessage title={gone ? "Resource not found" : "Couldn't load this resource"} tone={gone ? "neutral" : "danger"} action={gone ? <Link className={buttonClasses()} to="/resources">All resources</Link> : <Button onClick={() => void r.refetch()}>Try again</Button>} /></PageShell>;
  }
  const d = r.data;
  const mine = d.reports.find((x) => x.author.id === user?.id);

  return (
    <PageShell>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link to="/resources" className="hover:underline">Resources</Link> / {typeLabel(d.type)}</nav>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <article className="min-w-0">
          <h1 className="font-display text-xl break-words sm:text-2xl">{d.title}</h1>
          <p className="mt-1 text-muted">{d.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge>{typeLabel(d.type)}</Badge>
            {d.proven ? <Badge tone="success">Proven</Badge> : <Badge>New / untested</Badge>}
            <Badge tone="info">{d.license}</Badge>
            <span className="text-muted">by <Link className="hover:underline" to={`/u/${d.author.username}`}>@{d.author.username}</Link> · updated {relative(d.updatedAt)}</span>
          </div>

          {d.hasExecutableCode || d.scanFlags.length ? (
            <div role="note" className="mt-4 rounded-card border border-warning bg-surface-2 p-3 text-sm">
              <p className="font-semibold">Read before you run anything</p>
              <p>This resource includes code or commands that run on your machine. Check what each step does first.</p>
              {d.scanFlags.length ? <ul className="mt-2 list-disc pl-5">{d.scanFlags.map((f) => <li key={f}>{f}</li>)}</ul> : null}
            </div>
          ) : null}

          <Card className="mt-4 p-4">
            <div className="mb-2 flex justify-end">
              <CopyButton text={d.bodyMd} />
            </div>
            <Markdown source={d.bodyMd} renderProject={(s) => <ProjectEmbed slug={s} />} />
          </Card>

          {d.files.length ? (
            <section className="mt-4">
              <h2 className="mb-2 font-semibold">Files</h2>
              <ul className="text-sm">{d.files.map((f) => <li key={f.path} className="font-mono">{f.path} <span className="text-muted">({Math.ceil(f.size / 1024)} KB)</span></li>)}</ul>
              {d.downloadUrl ? <a href={d.downloadUrl} className={cn(buttonClasses("secondary", "sm"), "mt-2")} download>Download</a> : null}
            </section>
          ) : null}

          {d.testedWith.length ? (
            <section className="mt-4 text-sm">
              <h2 className="mb-1 font-semibold">Tested with</h2>
              <ul className="flex flex-wrap gap-2">{d.testedWith.map((t, i) => <li key={i}><Badge>{[t.tool, t.model, t.version].filter(Boolean).join(" · ")}</Badge></li>)}</ul>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="mb-2 font-semibold">Reports ({d.workedCount} worked · {d.didntWorkCount} didn't)</h2>
            {!d.reports.length ? <p className="text-sm text-muted">Nobody has reported back yet.</p> : (
              <ul className="space-y-2">
                {d.reports.map((x) => (
                  <li key={x.id} className="flex items-start gap-2 text-sm">
                    <Avatar src={x.author.avatarUrl} name={x.author.displayName} size="xs" />
                    <span><span className={x.worked ? "text-success" : "text-danger"}>{x.worked ? "Worked" : "Didn't work"}</span> · @{x.author.username}{x.note ? `: ${x.note}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>

        <aside className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Did it work for you?</h2>
            {user ? (
              <>
                {mine ? <p className="text-sm text-muted">You said it {mine.worked ? "worked" : "didn't work"}. You can change that.</p> : null}
                <label className="block text-sm">
                  <span className="sr-only">Note (optional)</span>
                  <input className="w-full rounded-pixel border border-border bg-surface p-2" placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="flex gap-2">
                  <Button size="sm" loading={report.isPending && report.variables} onClick={() => report.mutate(true)}>Worked for me</Button>
                  <Button size="sm" variant="secondary" loading={report.isPending && !report.variables} onClick={() => report.mutate(false)}>Didn't work</Button>
                </div>
                <div>
                  <p className="mb-1 text-sm">Rate it {d.ratingCount ? <span className="text-muted">(★ {d.rating} from {d.ratingCount})</span> : null}</p>
                  <div className="flex gap-1" role="group" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" className="text-xl leading-none text-pixel-4 hover:scale-110 disabled:opacity-50" disabled={rate.isPending} onClick={() => rate.mutate(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                        {n <= Math.round(d.rating) ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                </div>
                {report.isError || rate.isError ? <p role="alert" className="text-sm text-danger">{(report.error ?? rate.error)?.message}</p> : null}
              </>
            ) : (
              <a className={buttonClasses("secondary", "sm")} href={signInUrl()}>Sign in to report back</a>
            )}
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Built with this ({d.linkedProjects.length})</h2>
            {!d.linkedProjects.length ? <p className="text-sm text-muted">No linked projects yet.</p> : (
              <ul className="space-y-1 text-sm">{d.linkedProjects.map((p) => <li key={p.id}><Link className="hover:underline" to={`/p/${p.slug}`}>{p.name}</Link>{p.author ? <span className="text-muted"> · @{p.author.username}</span> : null}</li>)}</ul>
            )}
          </Card>
          <ShowcaseStrip source="resource" value={d.slug} title="Showcases built with this" hideEmpty />
          <ReportButton targetType="resource" targetId={d.id} label="Report this resource" />
        </aside>
      </div>
    </PageShell>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const config = useSiteConfig();
  const [form, setForm] = useState({ type: "system_prompt" as ResourceType, title: "", summary: "", bodyMd: "", license: "CC0-1.0", tool: "", model: "" });
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [files, setFiles] = useState<{ key: string; name: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadBusy = useRef(false);
  const [uploadError, setUploadError] = useState("");
  async function upload(chosen: File[]) {
    if (!chosen.length || uploadBusy.current) return;
    setUploadError("");
    if (files.length + chosen.length > 50) { setUploadError("Choose at most 50 files."); return; }
    const contentType = (file: File) => /\.zip$/i.test(file.name) ? "application/zip" : /\.md$/i.test(file.name) ? "text/markdown" : /\.txt$/i.test(file.name) ? "text/plain" : null;
    if (chosen.some((file) => !contentType(file) || !file.size || file.size > 10 * 1024 * 1024)) {
      setUploadError("Choose non-empty ZIP, Markdown or plain text files up to 10 MB each. Put scripts in a ZIP archive.");
      return;
    }
    uploadBusy.current = true;
    setUploading(true);
    try {
      for (const file of chosen) {
        const type = contentType(file)!;
        const reservation = await api.call("createUpload", { body: { kind: "resource", contentType: type, size: file.size } });
        await api.call("putUpload", { params: { key: reservation.key } }, { body: file, headers: { "content-type": type, accept: "application/json" } });
        setFiles((current) => [...current, { key: reservation.key, name: file.name, size: file.size }]);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Choose the file again to retry.");
    } finally {
      uploadBusy.current = false;
      setUploading(false);
    }
  }
  const onToken = useCallback((t: string) => setToken(t), []);
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const share = useMutation({
    mutationFn: () =>
      api.call("createResource", {
        body: {
          type: form.type,
          title: form.title.trim(),
          summary: form.summary.trim(),
          bodyMd: form.bodyMd,
          license: form.license.trim() || "CC0-1.0",
          testedWith: form.tool.trim() ? [{ tool: form.tool.trim(), model: form.model.trim() || null, version: null }] : [],
          fileKeys: files.map((file) => file.key),
          linkedProjectIds: [],
          turnstileToken: token,
        },
      }),
    onSuccess: (d) => navigate(`/resources/${d.slug}`),
    onSettled: () => { setToken(""); setReset((n) => n + 1); },
  });
  const field = "w-full rounded-pixel border border-border bg-surface p-2";
  return (
    <Modal open onClose={() => { if (!uploadBusy.current && !share.isPending) onClose(); }} title="Share a resource" className="max-w-2xl">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (uploadBusy.current || share.isPending) return;
          share.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Type</span>
          <select className={field} value={form.type} onChange={(e) => set("type", e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => <option key={t.id} value={t.id}>{typeLabel(t.id)}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Title</span>
          <input className={field} required minLength={3} maxLength={120} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">One-line summary</span>
          <input className={field} maxLength={300} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">The resource</span>
          <textarea aria-label="The resource" aria-describedby="resource-body-hint" className={cn(field, "font-mono text-sm")} required rows={10} maxLength={50000} value={form.bodyMd} onChange={(e) => set("bodyMd", e.target.value)} />
          <span id="resource-body-hint" className="text-xs text-muted">Markdown. Code blocks that run things get a "read before you run" warning.</span>
        </label>
        <section className="space-y-2" aria-label="Resource files">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Files (optional)</span>
            <input className={field} type="file" multiple accept=".zip,.md,.txt" disabled={uploading || share.isPending} onChange={(e) => { const chosen = Array.from(e.target.files ?? []); e.target.value = ""; void upload(chosen); }} />
          </label>
          <p className="text-xs text-muted">ZIP, Markdown or plain text, up to 10 MB each; at most 50 files. Put scripts in a ZIP archive. Archives get a Runs code warning.</p>
          {uploading ? <Spinner label="Uploading resource files" /> : null}
          {!files.length ? <p className="text-sm text-muted">No files attached.</p> : <ul className="space-y-2 text-sm">{files.map((file) => <li key={file.key} className="flex items-center gap-2"><span className="min-w-0 flex-1 break-words">{file.name} <span className="text-muted">({Math.max(1, Math.ceil(file.size / 1024))} KB)</span></span><Button variant="ghost" size="sm" aria-label={`Remove ${file.name}`} disabled={uploading || share.isPending} onClick={() => setFiles((current) => current.filter((f) => f.key !== file.key))}>Remove</Button></li>)}</ul>}
          {files.some((file) => /\.zip$/i.test(file.name)) ? <Badge tone="warning">Runs code</Badge> : null}
          {uploadError ? <p role="alert" className="text-sm text-danger">{uploadError} Files already uploaded remain attached.</p> : null}
        </section>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">License</span>
            <input className={field} maxLength={60} value={form.license} onChange={(e) => set("license", e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Tested with</span>
            <input className={field} maxLength={60} placeholder="Claude Code" value={form.tool} onChange={(e) => set("tool", e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Model</span>
            <input className={field} maxLength={60} placeholder="optional" value={form.model} onChange={(e) => set("model", e.target.value)} />
          </label>
        </div>
        {needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={onToken} reset={reset} /> : null}
        {share.isError ? <p role="alert" className="text-sm text-danger">{share.error.message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={uploading || share.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={share.isPending} disabled={uploading || form.title.trim().length < 3 || !form.bodyMd.trim() || (needsToken && !token)}>Share</Button>
        </div>
      </form>
    </Modal>
  );
}
