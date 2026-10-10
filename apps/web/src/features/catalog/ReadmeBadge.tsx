/** Task 4.8: "Badge for your README" for the project's author. */
import { useState } from "react";
import { Button } from "@forkvlift/ui";

export function ReadmeBadge({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const snippet = `[![Listed on ForkLift](${origin}/api/badge/${slug})](${origin}/p/${slug})`;
  return (
    <details className="rounded-pixel border border-border p-2 text-sm">
      <summary className="cursor-pointer font-semibold">Badge for your README</summary>
      <div className="mt-2 space-y-2">
        <img src={`/api/badge/${slug}`} alt="ForkLift badge preview" height={20} />
        <code className="block break-all select-all rounded-pixel bg-surface-2 p-2 font-mono text-xs">{snippet}</code>
        <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(snippet).then(() => setCopied(true))}>{copied ? "Copied" : "Copy Markdown"}</Button>
      </div>
    </details>
  );
}
