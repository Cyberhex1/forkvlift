/** Task 3.10: the family tree of a project, from its oldest listed ancestor down. */
import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { ForkTreeNode } from "@forkvlift/shared";
import { Button, Modal, Spinner, StateMessage, cn } from "@forkvlift/ui";
import { api } from "../../lib/api";

export function ForkTreeButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>See the fork tree</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Fork tree" className="max-w-2xl">
        {open ? <ForkTreeView slug={slug} /> : null}
      </Modal>
    </>
  );
}

export function ForkTreeView({ slug }: { slug: string }) {
  const tree = useQuery({ queryKey: ["fork-tree", slug], queryFn: () => api.call("getForkTree", { params: { slug } }) });
  if (tree.isPending) return <Spinner label="Loading the fork tree" />;
  if (tree.isError) return <StateMessage title="Couldn't load the fork tree" tone="danger" action={<Button onClick={() => void tree.refetch()}>Try again</Button>} />;
  const { root, total } = tree.data;
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {total === 1 ? "No forks on the site yet. Be the first to continue it." : `${total} projects in this family.`}
        {total >= 200 ? " Showing the first 200." : ""}
      </p>
      <ul role="tree" aria-label="Fork tree" className="max-h-[60dvh] overflow-auto text-sm">
        <Node node={root} current={slug} level={1} />
      </ul>
    </div>
  );
}

function Node({ node, current, level }: { node: ForkTreeNode; current: string; level: number }) {
  const [open, setOpen] = useState(level < 4);
  const here = node.project.slug === current;
  const kids = node.children.length;
  return (
    <li role="treeitem" aria-level={level} aria-expanded={kids ? open : undefined} aria-current={here ? "page" : undefined} className="relative">
      <div className="flex items-center gap-1 py-0.5">
        {kids ? (
          <button type="button" className="grid size-5 place-items-center rounded-pixel text-muted hover:bg-surface-2" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse" : `Expand ${kids} forks`}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span aria-hidden className="size-5" />
        )}
        <Link to={`/p/${node.project.slug}`} className={cn("rounded-pixel px-1 hover:underline", here && "bg-accent text-accent-fg")}>
          {node.project.name}
        </Link>
        {node.project.author ? <span className="text-xs text-muted">@{node.project.author.username}</span> : null}
        {kids && !open ? <span className="text-xs text-muted">· {kids} {kids === 1 ? "fork" : "forks"}</span> : null}
      </div>
      {kids && open ? (
        <ul role="group" className="ml-2.5 border-l border-border pl-3">
          {node.children.map((c) => <Node key={c.project.id} node={c} current={current} level={level + 1} />)}
        </ul>
      ) : null}
    </li>
  );
}
