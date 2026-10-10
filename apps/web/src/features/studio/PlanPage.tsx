/** Task 2.7: planning tools for a Studio card (checklist, notes, roadmap, help wanted, saved prompts). */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectPlan, RoadmapItem } from "@forkvlift/shared";
import { Badge, Button, Card, Spinner, StateMessage, buttonClasses } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";
import { CopyText } from "../catalog/CopyText";

const field = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2";
const tmpId = () => `new-${Math.random().toString(36).slice(2, 10)}`;
const STATUS_LABEL: Record<RoadmapItem["status"], string> = { planned: "Planned", in_progress: "In progress", done: "Done" };

export function PlanPage() {
  const { id = "" } = useParams();
  const { user, isLoading } = useSession();
  const qc = useQueryClient();
  const key = ["plan", id];
  const plan = useQuery({ queryKey: key, queryFn: () => api.call("getPlan", { params: { id } }), enabled: Boolean(user), retry: false });
  const [draft, setDraft] = useState<ProjectPlan | null>(null);
  useEffect(() => {
    if (plan.data) setDraft(plan.data);
  }, [plan.data]);

  const save = useMutation({
    mutationFn: (p: ProjectPlan) =>
      api.call("updatePlan", {
        params: { id },
        body: { checklist: p.checklist, notesMd: p.notesMd, roadmap: p.roadmap, lookingForHelp: p.lookingForHelp, savedPrompts: p.savedPrompts, githubIssuesSync: p.githubIssuesSync },
      }),
    onSuccess: (saved) => {
      qc.setQueryData(key, saved);
      setDraft(saved);
    },
  });

  if (isLoading) return <Spinner label="Loading" />;
  if (!user) return <StateMessage title="Sign in to plan" action={<a className={buttonClasses()} href={signInUrl()}>Sign in with GitHub</a>} />;
  if (plan.isPending || !draft) {
    if (plan.isError) {
      return <StateMessage title="Couldn't load this plan" tone="danger" action={<Link to="/studio" className={buttonClasses("secondary")}>Back to Studio</Link>}>{plan.error.message}</StateMessage>;
    }
    return <Spinner label="Loading plan" />;
  }

  const update = (patch: Partial<ProjectPlan>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(plan.data);
  const done = draft.checklist.filter((c) => c.done).length;

  return (
    <PageShell
      title="Plan"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/studio" className={buttonClasses("ghost", "sm")}>← Studio</Link>
          <Button size="sm" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(draft)}>
            {dirty ? "Save plan" : "Saved"}
          </Button>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="mb-4 text-sm text-muted">
        {save.isError ? <span className="text-danger">{save.error.message}</span> : save.isSuccess && !dirty ? "Plan saved." : dirty ? "Unsaved changes." : ""}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base">Checklist</h2>
            <Badge>{done}/{draft.checklist.length}</Badge>
          </div>
          {draft.checklist.length === 0 ? <p className="text-sm text-muted">No tasks yet.</p> : null}
          <ul className="space-y-2">
            {draft.checklist.map((item, i) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Done: ${item.text || "task"}`}
                  checked={item.done}
                  onChange={(e) => update({ checklist: draft.checklist.map((c) => (c.id === item.id ? { ...c, done: e.target.checked } : c)) })}
                />
                <input
                  aria-label={`Task ${i + 1}`}
                  className="min-w-0 flex-1 rounded-pixel border border-border bg-surface p-1.5 text-sm"
                  value={item.text}
                  maxLength={200}
                  onChange={(e) => update({ checklist: draft.checklist.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c)) })}
                />
                <Button size="sm" variant="ghost" aria-label={`Remove task ${i + 1}`} onClick={() => update({ checklist: draft.checklist.filter((c) => c.id !== item.id) })}>
                  ×
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" onClick={() => update({ checklist: [...draft.checklist, { id: tmpId(), text: "", done: false }] })}>
            Add task
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-base">Looking for help with</h2>
          <p className="text-sm text-muted">Shown on your public project so people with matching skills can offer to collaborate.</p>
          <input className={field} aria-label="Looking for help with" maxLength={500} value={draft.lookingForHelp ?? ""} placeholder="e.g. pixel art, sound effects, testing on iOS" onChange={(e) => update({ lookingForHelp: e.target.value || null })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.githubIssuesSync} onChange={(e) => update({ githubIssuesSync: e.target.checked })} />
            Mirror bug-fix cards from GitHub Issues (coming later)
          </label>
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <h2 className="font-display text-base">Notes</h2>
          <textarea className={`${field} font-mono text-sm`} aria-label="Notes (Markdown)" rows={10} maxLength={50000} value={draft.notesMd} onChange={(e) => update({ notesMd: e.target.value })} />
          <p className="text-xs text-muted">Markdown. Private to you.</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-base">Public roadmap</h2>
          <p className="text-sm text-muted">Visitors can upvote these on your public project. Votes are kept when you edit.</p>
          {draft.roadmap.length === 0 ? <p className="text-sm text-muted">Nothing on the roadmap yet.</p> : null}
          <ul className="space-y-2">
            {draft.roadmap.map((item, i) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Roadmap item ${i + 1}`}
                  className="min-w-0 flex-1 rounded-pixel border border-border bg-surface p-1.5 text-sm"
                  value={item.title}
                  maxLength={120}
                  onChange={(e) => update({ roadmap: draft.roadmap.map((r) => (r.id === item.id ? { ...r, title: e.target.value } : r)) })}
                />
                <select
                  aria-label={`Status of roadmap item ${i + 1}`}
                  className="rounded-pixel border border-border bg-surface p-1.5 text-sm"
                  value={item.status}
                  onChange={(e) => update({ roadmap: draft.roadmap.map((r) => (r.id === item.id ? { ...r, status: e.target.value as RoadmapItem["status"] } : r)) })}
                >
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <Badge>{item.votes} votes</Badge>
                <Button size="sm" variant="ghost" aria-label={`Remove roadmap item ${i + 1}`} onClick={() => update({ roadmap: draft.roadmap.filter((r) => r.id !== item.id) })}>
                  ×
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" onClick={() => update({ roadmap: [...draft.roadmap, { id: tmpId(), title: "", status: "planned", votes: 0 }] })}>
            Add roadmap item
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-base">Saved prompts</h2>
          <p className="text-sm text-muted">Prompts and agent instructions you used on this project.</p>
          {draft.savedPrompts.map((p, i) => (
            <div key={p.id} className="space-y-2 rounded-pixel border border-border p-2">
              <input aria-label={`Prompt ${i + 1} title`} className={field} maxLength={100} value={p.title} placeholder="Title" onChange={(e) => update({ savedPrompts: draft.savedPrompts.map((s) => (s.id === p.id ? { ...s, title: e.target.value } : s)) })} />
              <textarea aria-label={`Prompt ${i + 1}`} className={`${field} font-mono text-xs`} rows={4} maxLength={10000} value={p.body} onChange={(e) => update({ savedPrompts: draft.savedPrompts.map((s) => (s.id === p.id ? { ...s, body: e.target.value } : s)) })} />
              <div className="flex gap-2">
                <CopyText text={p.body} label="Copy prompt" />
                <Button size="sm" variant="ghost" onClick={() => update({ savedPrompts: draft.savedPrompts.filter((s) => s.id !== p.id) })}>Remove</Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => update({ savedPrompts: [...draft.savedPrompts, { id: tmpId(), title: "", body: "" }] })}>
            Add prompt
          </Button>
        </Card>
      </div>
    </PageShell>
  );
}
