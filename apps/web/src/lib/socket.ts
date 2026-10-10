/** WebSocket hook with reconnect (backoff up to 30s) for the chat and live threads. */
import { useCallback, useEffect, useRef, useState } from "react";

export type SocketStatus = "connecting" | "open" | "closed";

export function wsUrl(path: string): string {
  const u = new URL(path, window.location.href);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.href;
}

export function useSocket<In>(path: string | null, onEvent: (event: In) => void) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const ws = useRef<WebSocket | null>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!path) return;
    let stopped = false;
    let attempt = 0;
    let timer: number | undefined;
    let ping: number | undefined;

    const connect = () => {
      setStatus("connecting");
      const socket = new WebSocket(wsUrl(path));
      ws.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setStatus("open");
        // Keeps proxies from closing a quiet socket.
        ping = window.setInterval(() => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "ping" })), 45_000);
      };
      socket.onmessage = (m) => {
        try {
          handler.current(JSON.parse(String(m.data)) as In);
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = (e) => {
        window.clearInterval(ping);
        if (ws.current === socket) ws.current = null;
        setStatus("closed");
        // 4003 = removed by a moderator; don't bounce straight back in.
        if (stopped || e.code === 4003) return;
        const delay = Math.min(30_000, 1000 * 2 ** attempt++) + Math.random() * 500;
        timer = window.setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(ping);
      ws.current?.close(1000);
      ws.current = null;
    };
  }, [path]);

  const send = useCallback((event: unknown) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return false;
    ws.current.send(JSON.stringify(event));
    return true;
  }, []);

  return { status, send };
}
