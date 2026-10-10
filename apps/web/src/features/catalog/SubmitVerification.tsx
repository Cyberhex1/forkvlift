import { useEffect, useRef, useState } from "react";
import { Button } from "@forkvlift/ui";

type WidgetAPI = { render: (element: HTMLElement, options: { sitekey: string; size: "flexible"; callback: (token: string) => void; "error-callback": () => void; "expired-callback": () => void }) => string; remove: (id: string) => void };
function widgetAPI() { return (window as Window & { turnstile?: WidgetAPI }).turnstile; }
let scriptPromise: Promise<void> | undefined;
function loadScript() {
  if (widgetAPI()) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => { script.remove(); reject(new Error("Verification took too long to load.")); }, 20000);
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error("Couldn't load verification.")); };
    document.head.append(script);
  }).catch((error: unknown) => { scriptPromise = undefined; throw error; });
  return scriptPromise;
}

/** Feature-local explicit widget. Tokens are cleared on expiration and on every submission attempt. */
export function SubmitVerification({ siteKey, onToken, reset }: { siteKey: string; onToken: (token: string) => void; reset: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true; let id: string | undefined;
    onToken(""); setError("");
    void loadScript().then(() => {
      if (!active || !container.current) return;
      const sdk = widgetAPI(); if (!sdk) throw new Error("Verification is unavailable.");
      id = sdk.render(container.current, { sitekey: siteKey, size: "flexible", callback: (token) => { if (active) { onToken(token); setError(""); } }, "error-callback": () => { if (active) { onToken(""); setError("Verification failed. Try again."); } }, "expired-callback": () => { if (active) { onToken(""); setError("Verification expired. Try again."); } } });
    }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : "Verification is unavailable."); });
    return () => { active = false; if (id) widgetAPI()?.remove(id); };
  }, [siteKey, onToken, reset, attempt]);
  return <div className="space-y-2"><div ref={container} aria-label="Submission verification" />{error ? <div role="alert" className="text-sm text-danger">{error} <Button variant="secondary" size="sm" onClick={() => setAttempt((value) => value + 1)}>Retry verification</Button></div> : null}</div>;
}
