/** Focus-panel actions: "Continue this" (2.2) and posting comments. */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { ApiError, type ProjectDetail } from "@forkvlift/shared";
import { Button, buttonClasses } from "@forkvlift/ui";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { SubmitVerification } from "./SubmitVerification";

export function ContinueThis({ project }: { project: ProjectDetail }) {
  const { user } = useSession();
  const [forkUrl, setForkUrl] = useState<string | null>(null);
  const go = useMutation({
    mutationFn: () => api.call("forkProject", { params: { slug: project.slug } }),
    onError: (err) => {
      const details = err instanceof ApiError ? (err.details as { forkUrl?: string } | undefined) : undefined;
      if (details?.forkUrl) {
        setForkUrl(details.forkUrl);
        window.open(details.forkUrl, "_blank", "noopener,noreferrer");
      }
    },
  });
  if (!user) return <a href={signInUrl()} className={buttonClasses("primary", "sm")}>Sign in to continue this project</a>;
  if (project.author?.id === user.id) return null;
  if (go.isSuccess) {
    return (
      <p role="status" className="text-sm">
        Added to your Studio as an idea. <Link to="/studio" className="text-accent underline">Open Studio</Link> · <a href={go.data.forkRepoUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">Your fork ↗</a>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <Button size="sm" loading={go.isPending} onClick={() => go.mutate()}>
        {forkUrl ? "I've forked it, continue" : "Continue this"}
      </Button>
      {forkUrl ? (
        <p className="text-sm text-muted">
          Fork it on GitHub first (<a href={forkUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">open the fork page ↗</a>), then press the button again. We record the fork and add it to your Studio with credit to the original.
        </p>
      ) : go.isError ? (
        <p role="alert" className="text-sm text-danger">{go.error.message}</p>
      ) : (
        <p className="text-xs text-muted">Forks it to your GitHub, then adds it to your Studio with lineage back to this project.</p>
      )}
    </div>
  );
}

export function CommentForm({ slug, parentId = null, onDone }: { slug: string; parentId?: string | null; onDone?: () => void }) {
  const { user } = useSession();
  const config = useSiteConfig();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const post = useMutation({
    mutationFn: () => api.call("createComment", { params: { slug }, body: { body, parentId, turnstileToken: token } }),
    onSuccess: () => {
      setBody("");
      setReset((n) => n + 1);
      void qc.invalidateQueries({ queryKey: ["comments", slug] });
      void qc.invalidateQueries({ queryKey: ["project", slug] });
      onDone?.();
    },
    onError: () => setReset((n) => n + 1),
  });
  if (!user) return <a href={signInUrl()} className={buttonClasses("secondary", "sm")}>Sign in to comment</a>;
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        post.mutate();
      }}
    >
      <label className="block text-sm">
        {parentId ? "Reply" : "Add a comment"}
        <textarea className="mt-1 block w-full rounded-pixel border border-border bg-surface p-2" rows={3} maxLength={5000} required value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={setToken} reset={reset} /> : null}
      {post.isError ? <p role="alert" className="text-sm text-danger">{post.error.message}</p> : null}
      <Button type="submit" size="sm" loading={post.isPending} disabled={!body.trim() || (needsToken && !token)}>
        {parentId ? "Post reply" : "Post comment"}
      </Button>
    </form>
  );
}
