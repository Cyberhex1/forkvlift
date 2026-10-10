/** Local-only browser QA: proxy the real dev app with empty/error/loading feed responses. */
import http from "node:http";
const upstream = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8788";
const port = Number(process.env.E2E_STATE_PORT ?? 8798);
http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", upstream);
  if (url.pathname === "/__qa") {
    response.writeHead(302, { "set-cookie": `fv_e2e_mode=${url.searchParams.get("mode") ?? "fixture"}; Path=/; SameSite=Lax`, location: "/" });
    response.end(); return;
  }
  const mode = /fv_e2e_mode=([^;]+)/.exec(request.headers.cookie ?? "")?.[1];
  if (url.pathname === "/api/projects" && ["empty", "error", "loading"].includes(mode)) {
    if (mode === "loading") await new Promise((resolve) => setTimeout(resolve, 20000));
    response.writeHead(mode === "error" ? 503 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify(mode === "error" ? { error: { code: "internal", message: "Local QA outage" } } : { items: [], nextCursor: null, hiddenUnlicensedCount: 0 }));
    return;
  }
  try {
    const headers = { ...request.headers, host: new URL(upstream).host };
    delete headers["connection"];
    const result = await fetch(url, { method: request.method, headers, redirect: "manual" });
    response.writeHead(result.status, Object.fromEntries([...result.headers].filter(([key]) => !["content-encoding", "content-length", "transfer-encoding"].includes(key))));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch { response.writeHead(502); response.end("Dev server unavailable"); }
}).listen(port, "127.0.0.1", () => console.log(`Browser state QA proxy: http://127.0.0.1:${port}/__qa?mode=fixture`));
