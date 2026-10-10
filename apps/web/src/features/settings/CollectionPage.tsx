/** Task 2.11: a collection, with owner editing and "export as awesome-list Markdown". */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SITE_NAME, type CollectionDetail } from "@forkvlift/shared";
import { Badge, Button, Modal, Spinner, StateMessage, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { useSession } from "../../app/session";
import { api } from "../../lib/api";
import { ProjectCard } from "../catalog/ProjectCard";

const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2";

export function toAwesomeMarkdown(detail: CollectionDetail, origin: string): string {
  const lines = [`# ${detail.collection.name}`, ""];
  if (detail.collection.description) lines.push(detail.collection.description, "");
  lines.push(`A collection by @${detail.collection.owner.username} on ${SITE_NAME}: ${origin}/collections/${detail.collection.id}`, "");
  for (const p of detail.items) {
    const license = p.license ? p.license.spdx : "no license";
    lines.push(`- [${p.name}](${p.repoUrl}): ${p.tagline || p.description} (${license})`);
  }
  return lines.join("\n") + "\n";
}

export function CollectionPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = ["collection", id];
  const detail = useQuery({ queryKey: key, queryFn: () => api.call("getCollection", { params: { id } }), retry: false });
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const remove = useMutation({
    mutationFn: (projectId: string) => api.call("removeCollectionItem", { params: { id, projectId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });
  const del = useMutation({
    mutationFn: () => api.call("deleteCollection", { params: { id } }),
    onSuccess: () => void navigate(user ? `/u/${user.username}` : "/"),
  });

  if (detail.isPending) return <Spinner label="Loading collection" className="m-8" />;
  if (detail.isError) {
    return <StateMessage title="Collection not found" tone="danger" action={<Link to="/" className={buttonClasses("secondary")}>Back to the feed</Link>}>It may be private, or it was deleted.</StateMessage>;
  }
  const { collection, items } = detail.data;
  const own = user?.id === collection.owner.id;
  const markdown = toAwesomeMarkdown(detail.data, window.location.origin);

  return (
    <PageShell
      title={collection.name}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(markdown).then(() => setCopied(true))}>{copied ? "Copied" : "Copy as Markdown"}</Button>
          <a className={buttonClasses("secondary", "sm")} download={`${collection.name.replace(/[^\w-]+/g, "-").toLowerCase()}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}>Download .md</a>
          {own ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button> : null}
        </div>
      }
    >
      <p className="mb-2 text-muted">
        By <Link to={`/u/${collection.owner.username}`} className="text-accent underline">@{collection.owner.username}</Link> · {collection.itemCount} project{collection.itemCount === 1 ? "" : "s"}
        {collection.isPublic ? "" : " · "}
        {collection.isPublic ? null : <Badge>Private</Badge>}
      </p>
      {collection.description ? <p className="mb-6 max-w-2xl whitespace-pre-wrap">{collection.description}</p> : null}
      {!items.length ? (
        <StateMessage title="Nothing saved here yet">{own ? "Use Save to collection on any project." : "This collection is empty."}</StateMessage>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id} className="space-y-2">
              <ProjectCard project={p} includeUnlicensed={own} />
              {own ? <Button size="sm" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate(p.id)}>Remove from collection</Button> : null}
            </li>
          ))}
        </ul>
      )}
      {own ? <EditDialog open={editing} onClose={() => setEditing(false)} detail={detail.data} onDelete={() => del.mutate()} deleting={del.isPending} /> : null}
    </PageShell>
  );
}

function EditDialog({ open, onClose, detail, onDelete, deleting }: { open: boolean; onClose: () => void; detail: CollectionDetail; onDelete: () => void; deleting: boolean }) {
  const qc = useQueryClient();
  const c = detail.collection;
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [isPublic, setIsPublic] = useState(c.isPublic);
  const save = useMutation({
    mutationFn: () => api.call("updateCollection", { params: { id: c.id }, body: { ...(c.isDefault ? {} : { name }), description, isPublic } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["collection", c.id] });
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title="Edit collection">
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className="block text-sm">Name<input className={field} required maxLength={80} value={name} disabled={c.isDefault} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm">Description<textarea className={field} rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />Public</label>
        {save.isError ? <p role="alert" className="text-sm text-danger">{save.error.message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={save.isPending}>Save</Button>
          {!c.isDefault ? <Button variant="danger" loading={deleting} onClick={onDelete}>Delete collection</Button> : null}
        </div>
      </form>
    </Modal>
  );
}
