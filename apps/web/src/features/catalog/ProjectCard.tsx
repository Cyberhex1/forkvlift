import { useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AI_INVOLVEMENT_LABELS, PROJECT_STAGE_LABELS, type ProjectCard as ProjectCardData } from "@forkvlift/shared";
import { Badge, Button, Card, Skeleton, buttonClasses, cn } from "@forkvlift/ui";
import { usePreferences } from "../../app/preferences";
import "./project-card.css";

/** One stationary action rail, two faces; hidden faces never receive focus. */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  const { motionReduced, showUnlicensed } = usePreferences();
  const [flipped, setFlipped] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const navigate = useNavigate();
  const location = useLocation();
  const faceId = useId();
  const panelUrl = `/p/${encodeURIComponent(project.slug)}${location.search}`;
  if (!project.license && !showUnlicensed) return null;

  async function copyClone() {
    try {
      await navigator.clipboard.writeText(project.cloneCommand);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <Card as="article" padded={false} aria-label={project.name}
      className={cn("project-card relative min-w-0", motionReduced && "project-card-reduced")}
      data-flipped={flipped} data-testid="project-card"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches) setFlipped(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) setFlipped(false);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button,input,textarea,select")) return;
        if (flipped) navigate(panelUrl, { state: { fromCatalog: true } });
        else setFlipped(true);
      }}>
      <div className="absolute top-3 right-3 z-10 flex max-w-[65%] flex-col items-end gap-1 rounded-pixel bg-surface/95 p-1">
        <Link to={panelUrl} state={{ fromCatalog: true }} className={buttonClasses("primary", "sm")} aria-label={`See more about ${project.name}`}>See more</Link>
        {project.author ? <Link to={`/u/${project.author.username}`} className="max-w-full truncate px-1 text-xs text-muted hover:text-fg" title={project.author.displayName}>@{project.author.username}</Link>
          : <span className="px-1 text-xs text-muted">Curated · unclaimed</span>}
      </div>
      <div className="project-card-turner" data-flipped={flipped}>
        <div className="project-card-face project-card-front overflow-hidden rounded-card bg-surface" inert={flipped} aria-hidden={flipped}>
          <div className="flex h-[52%] items-center justify-center overflow-hidden border-b border-border bg-surface-2">
            {project.thumbnailUrl && !imageFailed ? <img src={project.thumbnailUrl} alt={`${project.name} preview`} loading="lazy" className="size-full object-cover" onError={() => setImageFailed(true)} />
              : <div className="px-6 text-center text-muted"><span className="block font-display text-4xl" aria-hidden>↳</span><span className="mt-2 block text-sm">No preview available</span></div>}
          </div>
          <div className="flex h-[48%] flex-col gap-2 p-4 pb-12">
            <h2 className="line-clamp-2 break-words font-display text-lg leading-tight" title={project.name}>{project.name}</h2>
            <p className="line-clamp-2 text-sm text-muted" title={project.tagline}>{project.tagline || "No tagline provided."}</p>
            <div className="mt-auto flex flex-wrap gap-1.5">
              <Badge>{project.category.name}</Badge>
              <Badge tone={`stage-${project.stage}`}>{PROJECT_STAGE_LABELS[project.stage]}</Badge>
              {project.stage === "wip" && project.studioColumnTitle ? <Badge>{project.studioColumnTitle}</Badge> : null}
              <Badge tone={project.license ? "license-open" : "license-none"} title={project.license?.summary}>{project.license?.spdx ?? "No license"}{project.license?.copyleft ? " · copyleft" : ""}</Badge>
              <Badge>{project.forks.toLocaleString()} forks</Badge><Badge>{project.stars.toLocaleString()} stars</Badge>
              {project.isTemplate ? <Badge>Template</Badge> : null}
            </div>
          </div>
        </div>
        <div id={faceId} className="project-card-face project-card-back flex flex-col gap-3 overflow-auto rounded-card bg-surface p-4 pt-24 pb-14" inert={!flipped} aria-hidden={!flipped}>
          <h2 className="break-words font-display text-lg">{project.name}</h2>
          <p className="break-words text-sm leading-relaxed">{project.description || "No description provided."}</p>
          <div className="flex flex-wrap gap-2">
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>GitHub ↗</a>
            {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>Live site ↗</a> : null}
            {project.releaseUrl ? <a href={project.releaseUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>Release ↗</a> : null}
          </div>
          {project.license ? <div className="space-y-2">
            <p className="text-xs text-muted">{project.license.summary}</p>
            <code className="block select-all break-all rounded-pixel bg-surface-2 p-2 font-mono text-xs">{project.cloneCommand}</code>
            <Button size="sm" variant="secondary" onClick={() => void copyClone()}>Copy clone command</Button>
            <p role="status" className="text-xs text-muted">{copyState === "copied" ? "Clone command copied." : copyState === "error" ? "Could not copy. Select the command above to copy it manually." : ""}</p>
          </div> : <p className="text-sm text-license-none">No license. Ask the author to add a license before building on this project.</p>}
          <div className="space-y-1 border-t border-border pt-2 text-xs text-muted">
            <p>Build facts · self-reported</p>
            <div className="flex flex-wrap gap-1.5">{project.buildFacts.aiTools.map((tool) => <Badge key={tool}>{tool}</Badge>)}
              {project.buildFacts.buildTime ? <Badge>{project.buildFacts.buildTime}</Badge> : null}
              {project.buildFacts.aiInvolvement ? <Badge>{AI_INVOLVEMENT_LABELS[project.buildFacts.aiInvolvement]}</Badge> : null}
            </div>
            {!project.buildFacts.aiTools.length && !project.buildFacts.buildTime && !project.buildFacts.aiInvolvement ? <p>Not provided</p> : null}
          </div>
        </div>
      </div>
      <div className="absolute right-3 bottom-2 left-3 z-10 flex items-center justify-between gap-2 rounded-pixel bg-surface/95 p-1">
        <span className="text-xs text-muted">{flipped ? "Details & build facts" : "Preview"}</span>
        <Button size="sm" variant="ghost" aria-expanded={flipped} aria-controls={faceId} onClick={() => setFlipped((value) => !value)}>{flipped ? "Show preview" : "Flip card"}</Button>
      </div>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return <Card padded={false} className="aspect-[3/4] min-h-[520px] overflow-hidden" aria-hidden><Skeleton className="h-[52%] rounded-none" /><div className="space-y-3 p-4"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4" /><Skeleton className="h-12" /></div></Card>;
}

