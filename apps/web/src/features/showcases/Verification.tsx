import { useCallback, useState } from "react";
import { Button, Spinner, StateMessage } from "@forkvlift/ui";
import { useSiteConfig } from "../../app/session";
import { SubmitVerification } from "../catalog/SubmitVerification";

export function useVerification() {
  const config = useSiteConfig();
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const onToken = useCallback((value: string) => setToken(value), []);
  const needsToken = Boolean(config.data?.turnstileSiteKey);
  return { token, ready: Boolean(config.data) && (!needsToken || Boolean(token)), clear: () => { setToken(""); setReset(n => n + 1); },
    element: config.isPending ? <Spinner label="Loading verification" /> : config.isError ? <StateMessage title="Couldn't load verification" tone="danger" action={<Button onClick={() => void config.refetch()}>Retry verification</Button>} /> : needsToken ? <SubmitVerification siteKey={config.data!.turnstileSiteKey!} onToken={onToken} reset={reset} /> : null };
}
