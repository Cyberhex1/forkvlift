import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { ApiError, NO_LICENSE_DISCLAIMER } from "@forkvlift/shared";
import { Button, Card, Modal, Spinner, StateMessage } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { usePreferences } from "../../app/preferences";
import { api } from "../../lib/api";
import { ProjectCard } from "../catalog/ProjectCard";

export function AlternativesPage() {
  const { product } = useParams();
  return product ? <ProductAlternatives key={product} product={product} /> : <Directory />;
}

function Directory() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const products = useQuery({ queryKey: ["alternatives"], queryFn: ({ signal }) => api.call("listAlternatives", {}, { signal }), retry: false });
  const visible = products.data?.items.filter(p => p.name.toLocaleLowerCase().includes(q.toLocaleLowerCase())) ?? [];
  return <PageShell title="Free alternatives">
    <p className="mb-5 max-w-2xl text-muted">Find public projects that replace subscription software. Check their license, setup needs and what works before choosing one.</p>
    <form role="search" aria-label="Find a product" className="mb-6 flex gap-2" onSubmit={event => { event.preventDefault(); const term = String(new FormData(event.currentTarget).get("q") ?? "").trim(); setParams(term ? { q: term } : {}); }}>
      <label className="min-w-0 flex-1"><span className="sr-only">Product name</span><input key={q} name="q" type="search" maxLength={60} defaultValue={q} placeholder="Search product names" className="w-full rounded-pixel border border-border bg-surface p-2" /></label><Button type="submit">Search</Button>
    </form>
    {products.isPending ? <Spinner label="Loading alternatives" />
      : products.isError ? <StateMessage title="Couldn't load alternatives" tone="danger" action={<Button onClick={() => void products.refetch()}>Try again</Button>}>Please try again in a moment.</StateMessage>
      : !visible.length ? <StateMessage title={q ? "No matching products" : "No alternatives listed yet"} action={q ? <Button variant="secondary" onClick={() => setParams({})}>Clear search</Button> : undefined}>Products appear here when a licensed public project names what it replaces.</StateMessage>
      : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(p => <li key={p.slug}><Card className="h-full"><Link to={`/alternatives/${encodeURIComponent(p.slug)}`} className="block space-y-2 p-4 hover:bg-surface-2"><h2 className="font-display text-lg break-words">{p.name}</h2><p className="text-sm text-muted">{p.projectCount} licensed {p.projectCount === 1 ? "alternative" : "alternatives"} →</p></Link></Card></li>)}</ul>}
  </PageShell>;
}

function ProductAlternatives({ product }: { product: string }) {
  const prefs = usePreferences();
  const [disclaimer, setDisclaimer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const result = useQuery({ queryKey: ["alternatives", product, prefs.showUnlicensed], queryFn: ({ signal }) => api.call("getAlternatives", { params: { product }, query: { showUnlicensed: prefs.showUnlicensed } }, { signal }), retry: false });
  const visible = result.data?.items.filter(p => prefs.showUnlicensed || p.license) ?? [];
  async function setUnlicensed(on: boolean, accepted = false) {
    setSaving(true); setError("");
    try { await prefs.setShowUnlicensed(on, { acceptDisclaimer: accepted || undefined }); setDisclaimer(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save your preference."); }
    finally { setSaving(false); }
  }
  return <PageShell className="[&_h1]:min-w-0 [&_h1]:break-words" title={result.data ? `Free alternatives to ${result.data.product.name}` : "Free alternatives"}>
    <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link to="/alternatives" className="text-accent underline">All products</Link></nav>
    <div className="mb-5 space-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" role="switch" checked={prefs.showUnlicensed} disabled={saving} onChange={e => { if (e.target.checked && !prefs.disclaimerAccepted) setDisclaimer(true); else void setUnlicensed(e.target.checked); }} />Show unlicensed projects</label>
      {!prefs.showUnlicensed && (result.data?.hiddenUnlicensedCount ?? 0) > 0 ? <p className="text-muted">{result.data!.hiddenUnlicensedCount} unlicensed projects hidden.</p> : null}
      {error ? <p role="alert" className="text-danger">{error}</p> : null}
    </div>
    {result.isPending ? <Spinner label="Loading projects" />
      : result.isError ? <StateMessage title={result.error instanceof ApiError && result.error.status === 404 ? "Product not found" : "Couldn't load projects"} tone="danger" action={<Button onClick={() => void result.refetch()}>Try again</Button>}>This product may have no public alternatives yet.</StateMessage>
      : !visible.length ? <StateMessage title="No projects to show">There are no licensed alternatives available for this product yet.</StateMessage>
      : <><p className="mb-4 text-sm text-muted">{visible.length} {visible.length === 1 ? "project" : "projects"}. Work in progress is welcome; review the project's details before building on it.</p><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map(p => <ProjectCard key={p.id} project={p} />)}</div></>}
    <Modal open={disclaimer} onClose={() => { if (!saving) setDisclaimer(false); }} title={NO_LICENSE_DISCLAIMER.title}><p className="mt-4 text-sm leading-relaxed">{NO_LICENSE_DISCLAIMER.body}</p><div className="mt-5 flex flex-wrap gap-2"><Button loading={saving} onClick={() => void setUnlicensed(true, true)}>I understand, show unlicensed</Button><Button variant="secondary" disabled={saving} onClick={() => setDisclaimer(false)}>Cancel</Button></div>{error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}</Modal>
  </PageShell>;
}
