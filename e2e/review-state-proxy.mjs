/** Local browser QA only: exercise admin states using responses from the fixture API. */
import http from "node:http";
const upstream = "http://127.0.0.1:8791";
http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", upstream);
  if (url.pathname === "/__qa") { response.writeHead(302, { "set-cookie": `fv_review_qa=${url.searchParams.get("mode") ?? "fixture"}; Path=/; SameSite=Lax`, location: "/" }); response.end(); return; }
  const mode = /fv_review_qa=([^;]+)/.exec(request.headers.cookie ?? "")?.[1];
  const isQueue = url.pathname === "/api/admin/candidates" && request.method === "GET";
  if (isQueue && ["empty", "error", "loading"].includes(mode)) {
    if (mode === "loading") await new Promise((resolve) => setTimeout(resolve, 20000));
    response.writeHead(mode === "error" ? 503 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify(mode === "error" ? { error: { code: "internal", message: "Local QA queue outage" } } : { items: [], nextCursor: null })); return;
  }
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const headers = { ...request.headers, host: new URL(upstream).host }; delete headers.connection;
    const result = await fetch(url, { method: request.method, headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.concat(chunks), redirect: "manual" });
    const outputHeaders = Object.fromEntries([...result.headers].filter(([key]) => !["content-encoding", "content-length", "transfer-encoding"].includes(key)));
    if (isQueue && mode === "licensed" && result.ok) {
      const data = await result.json(); const project = await (await fetch(`${upstream}/api/projects/fixture-pixel-planner`)).json();
      data.items = data.items.map((item) => ({ ...item, license: project.license }));
      response.writeHead(result.status, outputHeaders); response.end(JSON.stringify(data));
    } else { response.writeHead(result.status, outputHeaders); response.end(Buffer.from(await result.arrayBuffer())); }
  } catch { response.writeHead(502); response.end("Dev server unavailable"); }
}).listen(8797, "127.0.0.1", () => console.log("Admin browser QA proxy: http://127.0.0.1:8797/__qa?mode=fixture"));
