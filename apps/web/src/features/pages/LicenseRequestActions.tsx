/**
 * Task 2.12: what people can do about an unlicensed project.
 *  - "Ask the author to add a license": a prefilled GitHub issue.
 *  - "Request to build on this": a build_permission collab request to the author.
 * Plus AddLicenseLink, the owner-side shortcut to GitHub's add-a-license page.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SITE_NAME, type ProjectCard } from "@forkvlift/shared";
import { Button, Modal, buttonClasses } from "@forkvlift/ui";
import { signInUrl, useSession, useSiteConfig } from "../../app/session";
import { api } from "../../lib/api";
import { SubmitVerification } from "../catalog/SubmitVerification";

export function licenseIssueUrl(repoUrl: string, projectName: string): string {
  const title = "Would you consider adding an open source license?";
  const body = [
    `Hi! I found ${projectName} on ${SITE_NAME} and would love to build on it.`,
    "",
    "Right now the repository has no license, which means nobody else is allowed to reuse the code.",
    "Adding one (for example MIT or Apache-2.0) takes a minute: GitHub has a license picker under Add file → Create new file → name it LICENSE.",
    "",
    "Thanks for sharing your work!",
  ].join("\n");
  return `${repoUrl.replace(/\/$/, "")}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

export function LicenseRequestActions({ project }: { project: Pick<ProjectCard, "name" | "repoUrl" | "author" | "id"> }) {
  const { user } = useSession();
  const config = useSiteConfig();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [done, setDone] = useState(false);
  const isAuthor = user && project.author?.id === user.id;

  const request = useMutation({
    mutationFn: () =>
      api.call("createCollabRequest", {
        body: { toUsername: project.author!.username, projectId: project.id, kind: "build_permission", role: "Builder", availability: "", message, turnstileToken: token },
      }),
    onSuccess: () => {
      setDone(true);
      setOpen(false);
    },
    onError: () => setReset((n) => n + 1),
  });

  if (isAuthor) return <AddLicenseLink repoUrl={project.repoUrl} />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={licenseIssueUrl(project.repoUrl, project.name)} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>
        Ask the author to add a license ↗
      </a>
      {project.author ? (
        user ? (
          done ? (
            <p role="status" className="text-sm text-muted">Request sent to @{project.author.username}.</p>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              Request to build on this
            </Button>
          )
        ) : (
          <a href={signInUrl()} className={buttonClasses("ghost", "sm")}>
            Sign in to ask
          </a>
        )
      ) : (
        <p className="text-sm text-muted">This curated project has no claimed author yet.</p>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Request to build on this">
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <p className="text-sm text-muted">
            @{project.author?.username} will see your request. Explain what you'd like to build; they can say yes and add a license, or decline.
          </p>
          <label className="block text-sm">
            Message
            <textarea className="mt-1 block w-full rounded-pixel border border-border bg-surface p-2" required maxLength={2000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {config.data?.turnstileSiteKey ? <SubmitVerification siteKey={config.data.turnstileSiteKey} onToken={setToken} reset={reset} /> : null}
          {request.isError ? <p role="alert" className="text-sm text-danger">{request.error.message}</p> : null}
          <Button type="submit" loading={request.isPending} disabled={!message.trim() || (Boolean(config.data?.turnstileSiteKey) && !token)}>
            Send request
          </Button>
        </form>
      </Modal>
    </div>
  );
}

/** Owner-side: GitHub's add-a-license flow for this repo. */
export function AddLicenseLink({ repoUrl, branch = "main" }: { repoUrl: string; branch?: string }) {
  return (
    <a href={`${repoUrl.replace(/\/$/, "")}/community/license/new?branch=${encodeURIComponent(branch)}`} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>
      Add a license on GitHub ↗
    </a>
  );
}
