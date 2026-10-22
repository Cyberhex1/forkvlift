import { Link } from "react-router";
import type { ShowcaseCard as Showcase } from "@forkvlift/shared";
import { Badge, Card } from "@forkvlift/ui";

export function ShowcaseLabels({ showcase }: { showcase: Showcase }) {
  return <div className="flex flex-wrap gap-2"><Badge tone="accent">Showcase</Badge>{!showcase.hasPublicCode ? <Badge>Closed source</Badge> : null}<Badge tone={showcase.stage === "wip" ? "warning" : "success"}>{showcase.stage === "wip" ? "Work in progress" : "Finished"}</Badge>{showcase.status === "draft" ? <Badge>Draft</Badge> : null}{showcase.staffPick ? <Badge tone="info">Staff pick</Badge> : null}</div>;
}

export function ShowcaseCard({ showcase }: { showcase: Showcase }) {
  return <Card className="h-full min-w-0 overflow-hidden p-0">
    <Link to={`/showcase/${showcase.slug}`} aria-label={`View ${showcase.title}`} className="block aspect-video overflow-hidden bg-surface-2">{showcase.coverUrl ? <img src={showcase.coverUrl} alt={showcase.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-display text-sm text-muted">{showcase.kind} · Showcase</div>}</Link>
    <div className="space-y-3 p-4"><ShowcaseLabels showcase={showcase} /><h2 className="break-words font-display text-base"><Link className="text-accent underline" to={`/showcase/${showcase.slug}`}>{showcase.title}</Link></h2><p className="break-words text-sm text-muted">{showcase.tagline}</p><p className="break-words text-xs"><Link className="text-accent underline" to={`/u/${showcase.maker.username}`}>@{showcase.maker.username}</Link> · {showcase.upvotes} upvotes · {showcase.commentCount} comments</p><p className="break-words text-xs text-muted">{showcase.aiTools.join(" · ")}</p></div>
  </Card>;
}
