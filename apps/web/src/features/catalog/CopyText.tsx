import { useState } from "react";
import { Button } from "@forkvlift/ui";

export function CopyText({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState("");
  return <div className="space-y-2">
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-pixel bg-surface-2 p-3 font-mono text-xs"><code>{text}</code></pre>
    <Button variant="secondary" size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setStatus("Copied."); }
      catch { setStatus("Copy failed. Select the text above and copy it manually."); }
    }}>{label}</Button>
    <p role="status" className="text-xs text-muted">{status}</p>
  </div>;
}
