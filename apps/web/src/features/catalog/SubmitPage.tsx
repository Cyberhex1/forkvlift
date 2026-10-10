import { useState, type InputHTMLAttributes } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { AiInvolvement, AI_INVOLVEMENT_LABELS, AiTool, ApiError, Difficulty, NO_LICENSE_DISCLAIMER, Platform, PROJECT_STAGE_LABELS, ProjectStage, routes, type ProjectDetail, type RouteInput, type Routes, type SubmissionPreview } from "@forkvlift/shared";
import { Badge, Button, Card, Spinner, StateMessage, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { SubmitVerification } from "./SubmitVerification";

const fieldClass = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2 text-sm";
type SubmitBody = RouteInput<Routes["createProject"]>["body"];
function split(value: string) { return value.split(",").map((part) => part.trim()).filter(Boolean); }

export function SubmitPage() {
  const { user, isLoading, error } = useSession();
  return <PageShell title="Submit a project" className="max-w-4xl">{isLoading ? <Spinner label="Loading your session" /> : error ? <StateMessage title="Couldn't load your session" tone="danger">Reload this page to try again.</StateMessage> : !user ? <StateMessage title="Sign in to submit" action={<a className={buttonClasses()} href={signInUrl("/submit")}>Sign in with GitHub</a>}>List a public repository you own, or save an idea privately until it has code.</StateMessage> : <Submission />}</PageShell>;
}

function Submission() {
  const [repoUrl, setRepoUrl] = useState("");
  const [idea, setIdea] = useState(false);
  const [urlError, setUrlError] = useState("");
  const preview = useMutation({ mutationFn: (url: string) => api.call("previewSubmission", { body: { repoUrl: url } }) });
  return <div className="space-y-6"><p className="text-sm text-muted">Submit your own repository. Projects from other authors go through the curation queue. Ideas without a repository stay private.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={idea} onChange={(event) => { setIdea(event.target.checked); preview.reset(); }} disabled={preview.isPending} />Save a private idea without a repository</label>
    {!idea ? <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault(); setUrlError("");
      try { const url = new URL(repoUrl); if (url.protocol !== "https:" || url.hostname !== "github.com" || !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname) || url.search || url.hash) throw new Error(); preview.mutate(url.href); }
      catch { setUrlError("Enter an HTTPS GitHub repository URL with an owner and repository name."); }
    }}><Field label="GitHub repository URL" name="repoUrl" type="url" required value={repoUrl} disabled={preview.isPending} onChange={(event) => { setRepoUrl(event.target.value); preview.reset(); setUrlError(""); }} /><Button type="submit" loading={preview.isPending}>Preview repository</Button>{urlError ? <p role="alert" className="text-danger">{urlError}</p> : null}</form> : null}
    {preview.isPending ? <Spinner label="Fetching repository preview" /> : preview.isError ? <StateMessage title="Couldn't preview repository" tone="danger" action={<Button onClick={() => preview.mutate(repoUrl)}>Try preview again</Button>}>{preview.error.message}</StateMessage> : null}
    {idea ? <ProjectForm key="idea" preview={null} /> : preview.data ? <ProjectForm key={preview.data.repoUrl} preview={preview.data} /> : <StateMessage title="Start with a repository URL">Preview pulls in its name, description, language, license and README. You can edit the listing before submitting.</StateMessage>}
  </div>;
}

function ProjectForm({ preview }: { preview: SubmissionPreview | null }) {
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.call("listCategories"), retry: false });
  const config = useSiteConfig();
  const existing = useQuery({ queryKey: ["project", preview?.alreadyListed?.slug], queryFn: () => api.call("getProject", { params: { slug: preview!.alreadyListed!.slug } }), enabled: Boolean(preview?.ownedByViewer && preview.alreadyListed), retry: false });
  const [stage, setStage] = useState<SubmitBody["stage"]>("finished");
  const [token, setToken] = useState("");
  const [verificationReset, setVerificationReset] = useState(0);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [validation, setValidation] = useState<string[]>([]);
  const [created, setCreated] = useState<ProjectDetail | null>(null);
  const submit = useMutation({ mutationFn: (body: SubmitBody) => api.call("createProject", { body }), onSuccess: setCreated, onSettled: () => { setToken(""); setVerificationReset((value) => value + 1); } });
  const claim = useMutation({ mutationFn: (slug: string) => api.call("claimProject", { params: { slug } }), onSuccess: setCreated });
  const details = submit.error instanceof ApiError && submit.error.status === 409 && submit.error.details && typeof submit.error.details === "object" ? submit.error.details as { claimable?: unknown; slug?: unknown } : null;
  const claimSlug = details?.claimable === true && typeof details.slug === "string" ? details.slug : existing.data?.source === "curated" && !existing.data.claimed ? existing.data.slug : null;
  async function upload(files: FileList | null, kind: "thumbnail" | "media") {
    if (!files?.length) return;
    setUploadError("");
    const chosen = Array.from(files);
    const allowed = kind === "thumbnail" ? ["image/png", "image/jpeg", "image/webp", "image/gif"] : ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"];
    if (kind === "media" && chosen.length + media.length > 12) { setUploadError("Choose at most 12 gallery files."); return; }
    if (chosen.some((file) => !allowed.includes(file.type) || !file.size || file.size > (kind === "thumbnail" ? 5 : 25) * 1024 * 1024)) { setUploadError(`Choose supported ${kind === "thumbnail" ? "images up to 5" : "images or MP4/WebM videos up to 25"} MB per file.`); return; }
    setUploading(true);
    try {
      for (const file of chosen) {
        const reservation = await api.call("createUpload", { body: { kind, contentType: file.type, size: file.size } });
        await api.call("putUpload", { params: { key: reservation.key } }, { body: file, headers: { "content-type": file.type, accept: "application/json" } });
        if (kind === "thumbnail") setThumbnail(reservation.key); else setMedia((keys) => [...keys, reservation.key]);
      }
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Upload failed. Choose the file again to retry."); }
    finally { setUploading(false); }
  }
  if (created) return <StateMessage title={preview ? "Project submitted" : "Private idea saved"} action={<Link to={preview ? `/p/${created.slug}` : "/studio"} className={buttonClasses()}> {preview ? "View project" : "Open Studio"}</Link>}>{preview ? "Your listing is ready. Unlicensed projects stay hidden in default lists." : "Your idea is private. Add a public repository before publishing."}</StateMessage>;
  return <div className="space-y-5">
    {preview ? <Card className="space-y-3"><h2 className="font-display text-lg">Repository preview</h2><a href={preview.repoUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">{preview.repoFullName}</a><div className="flex flex-wrap gap-2"><Badge tone={preview.license ? "license-open" : "license-none"}>{preview.license?.spdx ?? "No license"}</Badge><Badge>{preview.stars} stars</Badge>{preview.language ? <Badge>{preview.language}</Badge> : null}</div>{preview.socialPreviewUrl ? <img src={preview.socialPreviewUrl} alt="Repository social preview" className="max-h-48 max-w-full object-contain" /> : null}{preview.license ? <p className="text-muted">{preview.license.summary}</p> : <div role="note" className="space-y-2 text-sm"><p className="font-semibold text-license-none">{NO_LICENSE_DISCLAIMER.title}</p><p>{NO_LICENSE_DISCLAIMER.body}</p></div>}{preview.warnings.map((warning, i) => <p key={i} className="text-sm text-warning">{warning}</p>)}{!preview.ownedByViewer ? <p role="alert" className="text-danger">You must own this repository or be a public member of its organization to submit it.</p> : null}{preview.alreadyListed ? <p>This repository is already listed: <Link className="text-accent underline" to={`/p/${preview.alreadyListed.slug}`}>{preview.alreadyListed.name}</Link></p> : null}<details><summary className="cursor-pointer">README preview</summary>{preview.readmeHtml ? <div className="mt-3 max-h-64 overflow-auto break-words text-sm" dangerouslySetInnerHTML={{ __html: preview.readmeHtml }} /> : <p className="text-muted">No README available.</p>}</details></Card> : null}
    {claimSlug ? <div className="space-y-2"><Button variant="secondary" loading={claim.isPending} onClick={() => claim.mutate(claimSlug)}>Claim it</Button>{claim.isError ? <p role="alert" className="text-danger">{claim.error.message}</p> : null}<p className="text-xs text-muted">Claiming succeeds only for an unclaimed curated listing whose repository you own.</p></div> : null}
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault(); if (uploading || !token || (preview && (!preview.ownedByViewer || preview.alreadyListed))) return;
      const data = new FormData(event.currentTarget); const str = (key: string) => String(data.get(key) ?? "").trim(); const nullable = (key: string) => str(key) || null;
      const body = { repoUrl: preview?.repoUrl ?? null, name: str("name"), tagline: str("tagline"), description: str("description"), categorySlug: str("categorySlug"), tags: split(str("tags")), stage, isPublic: preview ? data.has("isPublic") : false, liveUrl: nullable("liveUrl"), releaseUrl: nullable("releaseUrl"), stack: split(str("stack")), platforms: data.getAll("platforms"), difficulty: nullable("difficulty"), aiTools: data.getAll("aiTools"), buildTime: nullable("buildTime"), aiInvolvement: nullable("aiInvolvement"), replaces: split(str("replaces")), isTemplate: data.has("isTemplate"), whatWorks: stage === "finished" ? null : nullable("whatWorks"), whatsMissing: stage === "finished" ? null : nullable("whatsMissing"), lookingForHelp: stage === "finished" ? null : nullable("lookingForHelp"), forkedFromSlug: nullable("forkedFromSlug"), thumbnailKey: thumbnail, mediaKeys: media, turnstileToken: token };
      const parsed = routes.createProject.body.safeParse(body);
      if (!parsed.success) { setValidation(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)); return; }
      setValidation([]); submit.mutate(parsed.data);
    }}>
      <fieldset disabled={submit.isPending || claim.isPending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Project name" name="name" required maxLength={100} defaultValue={preview?.name ?? ""} /><Field label="Tagline" name="tagline" maxLength={80} /></div>
        <label className="block text-sm">Description<textarea name="description" maxLength={300} defaultValue={preview?.description.slice(0, 300) ?? ""} className={fieldClass} rows={3} /></label>
        <label className="block text-sm">Category<select aria-label="Category" name="categorySlug" required className={fieldClass} disabled={!categories.data?.items.length}><option value="">Choose a category</option>{categories.data?.items.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>{categories.isPending ? <Spinner label="Loading categories" /> : categories.isError ? <StateMessage title="Couldn't load categories" tone="danger" action={<Button onClick={() => void categories.refetch()}>Retry categories</Button>} /> : !categories.data.items.length ? <p role="alert" className="text-danger">No categories available. Try again later.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Stage<select aria-label="Stage" value={stage} onChange={(event) => setStage(event.target.value as typeof stage)} className={fieldClass}>{ProjectStage.options.map((value) => <option key={value} value={value}>{PROJECT_STAGE_LABELS[value]}</option>)}</select></label><Field label="Tags (up to 5, comma separated)" name="tags" maxLength={204} /></div>
        {stage !== "finished" ? <Card className="space-y-4"><label className="block text-sm">What works<textarea name="whatWorks" maxLength={1000} className={fieldClass} /></label><label className="block text-sm">What's missing<textarea name="whatsMissing" maxLength={1000} className={fieldClass} /></label><Field label="Looking for help with" name="lookingForHelp" maxLength={500} /></Card> : null}
        {preview ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked />Publish in the catalog</label> : <p className="text-sm text-muted">Visibility: private until you add a repository.</p>}
        <details className="space-y-4" open><summary className="cursor-pointer font-semibold">Build details and links</summary><div className="grid gap-4 sm:grid-cols-2"><Field label="Stack / languages (comma separated)" name="stack" defaultValue={preview?.language ?? ""} /><Field label="Build time (self-reported)" name="buildTime" maxLength={60} /><Field label="Live demo URL" name="liveUrl" type="url" /><Field label="Release URL" name="releaseUrl" type="url" /><Field label="Replaces paid products (up to 5, comma separated)" name="replaces" /><Field label="Forked from project slug" name="forkedFromSlug" maxLength={80} /><label className="block text-sm">Difficulty<select aria-label="Difficulty" name="difficulty" className={fieldClass}><option value="">Not specified</option>{Difficulty.options.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm">AI involvement<select aria-label="AI involvement" name="aiInvolvement" className={fieldClass}><option value="">Not specified</option>{AiInvolvement.options.map((value) => <option key={value} value={value}>{AI_INVOLVEMENT_LABELS[value]}</option>)}</select></label></div><Checks name="platforms" title="Platforms" values={Platform.options} /><Checks name="aiTools" title="AI tools (self-reported)" values={AiTool.options} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isTemplate" />This is a template or starter</label></details>
        <Card className="space-y-3"><h3 className="font-display">Preview files</h3><Field label="Thumbnail (image, up to 5 MB)" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={(event) => { void upload(event.target.files, "thumbnail"); event.target.value = ""; }} /><Field label="Gallery files (up to 12, 25 MB each)" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" disabled={uploading} onChange={(event) => { void upload(event.target.files, "media"); event.target.value = ""; }} />{uploading ? <Spinner label="Uploading files" /> : null}{thumbnail ? <div className="flex items-center gap-2"><p className="text-sm">Thumbnail uploaded</p><Button variant="ghost" size="sm" onClick={() => setThumbnail(null)}>Remove thumbnail</Button></div> : null}{media.map((key, index) => <div key={`${key}-${index}`} className="flex items-center gap-2"><p className="text-sm">Gallery file {index + 1} uploaded</p><Button variant="ghost" size="sm" onClick={() => setMedia((keys) => keys.filter((_, i) => i !== index))}>Remove file {index + 1}</Button></div>)}{uploadError ? <p role="alert" className="text-danger">{uploadError}</p> : null}</Card>
      </fieldset>
      {validation.length ? <div role="alert" className="text-sm text-danger"><p>Check these fields:</p><ul className="list-inside list-disc">{validation.map((message, i) => <li key={i}>{message}</li>)}</ul></div> : null}
      {submit.isError ? <p role="alert" className="text-danger">{submit.error.message}</p> : null}
      {config.isPending ? <Spinner label="Loading verification" /> : config.isError ? <StateMessage title="Couldn't load verification settings" tone="danger" action={<Button onClick={() => void config.refetch()}>Retry settings</Button>} /> : config.data.turnstileSiteKey ? <SubmitVerification siteKey={config.data.turnstileSiteKey} onToken={setToken} reset={verificationReset} /> : <p role="alert" className="text-danger">Submission verification is not configured. Please try again later.</p>}
      <p className="text-xs text-muted">Review code before running it. Build facts are self-reported; your repository license determines reuse rights.</p>
      <Button type="submit" loading={submit.isPending} disabled={!token || uploading || !categories.data?.items.length || claim.isPending || Boolean(preview && (!preview.ownedByViewer || preview.alreadyListed))}>{preview ? "Submit project" : "Save private idea"}</Button>
    </form>
  </div>;
}
function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block min-w-0 text-sm">{label}<input className={fieldClass} {...props} /></label>; }
function Checks({ name, title, values }: { name: string; title: string; values: readonly string[] }) { return <fieldset><legend className="text-sm font-semibold">{title}</legend><div className="mt-2 flex flex-wrap gap-3">{values.map((value) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} value={value} />{value.replaceAll("_", " ")}</label>)}</div></fieldset>; }


