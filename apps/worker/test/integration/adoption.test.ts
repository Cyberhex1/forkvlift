import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdoptionRequest, ProjectAdoption, ProjectDetail } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let cy = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.batch([env.DB.prepare(`DELETE FROM adoption_requests`), env.DB.prepare(`DELETE FROM project_adoptions`)]);
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  cy = await seedUser("usr_cy", "cy");
  await seedProject({ slug: "old-tool", owner: "usr_ada", stage: "wip" });
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const call = <T>(path: string, method: string, as: string | undefined, body?: unknown) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const open = () => call<ProjectAdoption>("/api/projects/old-tool/adoption", "PATCH", ada, { open: true, note: "Moving on to other things" });
const ask = (as: string) => call<AdoptionRequest>("/api/projects/old-tool/adoption/requests", "POST", as, { message: "I use this daily", turnstileToken: "t" });

describe("adoption", () => {
  it("only the maintainer opens it; the stage switches and switches back", async () => {
    expect((await call("/api/projects/old-tool/adoption", "PATCH", bo, { open: true, note: "" })).status).toBe(403);
    expect((await open()).body).toMatchObject({ open: true, canManage: true, maintainer: { username: "ada" } });
    expect((await api<ProjectDetail>("/api/projects/old-tool")).body.stage).toBe("adoption");
    await call("/api/projects/old-tool/adoption", "PATCH", ada, { open: false, note: "" });
    expect((await api<ProjectDetail>("/api/projects/old-tool")).body.stage).toBe("wip");
  });

  it("requests need an open adoption, one pending each, no self-requests", async () => {
    expect((await ask(bo)).status).toBe(409); // not open
    await open();
    expect((await ask(ada)).status).toBe(400);
    expect((await ask(bo)).status).toBe(200);
    expect((await ask(bo)).status).toBe(409);
    // Applicants aren't public; the maintainer sees them.
    expect((await call("/api/projects/old-tool/adoption/requests", "GET", bo)).status).toBe(403);
    const list = await call<{ items: AdoptionRequest[] }>("/api/projects/old-tool/adoption/requests", "GET", ada);
    expect(list.body.items.map((r) => r.requester.username)).toEqual(["bo"]);
    const pub = await call<ProjectAdoption>("/api/projects/old-tool/adoption", "GET", cy);
    expect(pub.body).toMatchObject({ open: true, viewerRequest: null, canManage: false });
    const mine = await call<ProjectAdoption>("/api/projects/old-tool/adoption", "GET", bo);
    expect(mine.body.viewerRequest).toMatchObject({ status: "pending" });
  });

  it("approval hands the project over once, credits the original author, and cancels the rest", async () => {
    await open();
    const boReq = (await ask(bo)).body;
    const cyReq = (await ask(cy)).body;
    expect((await call(`/api/projects/old-tool/adoption/requests/${boReq.id}/decision`, "POST", bo, { decision: "approve" })).status).toBe(403);

    const done = await call<{ request: AdoptionRequest; adoption: ProjectAdoption }>(`/api/projects/old-tool/adoption/requests/${boReq.id}/decision`, "POST", ada, { decision: "approve" });
    expect(done.status).toBe(200);
    expect(done.body.request.status).toBe("approved");
    expect(done.body.adoption).toMatchObject({ open: false, maintainer: { username: "bo" }, originalAuthor: { username: "ada" } });

    const p = (await api<ProjectDetail>("/api/projects/old-tool")).body;
    expect(p.author?.username).toBe("bo");
    expect(p.stage).toBe("wip");
    // A second approval (retry) can't transfer again, and the other request is closed.
    expect((await call(`/api/projects/old-tool/adoption/requests/${boReq.id}/decision`, "POST", ada, { decision: "approve" })).status).toBe(403);
    const cyRow = await env.DB.prepare(`SELECT status FROM adoption_requests WHERE id = ?`).bind(cyReq.id).first<{ status: string }>();
    expect(cyRow!.status).toBe("cancelled");
    // The new maintainer can now manage it.
    expect((await call<ProjectAdoption>("/api/projects/old-tool/adoption", "GET", bo)).body.canManage).toBe(true);
  });

  it("withdraw and decline", async () => {
    await open();
    const r = (await ask(bo)).body;
    expect((await call(`/api/projects/old-tool/adoption/requests/${r.id}`, "DELETE", cy)).status).toBe(404);
    expect((await call(`/api/projects/old-tool/adoption/requests/${r.id}`, "DELETE", bo)).status).toBe(200);
    expect((await call(`/api/projects/old-tool/adoption/requests/${r.id}`, "DELETE", bo)).status).toBe(200); // idempotent
    const r2 = (await ask(bo)).body;
    const declined = await call<{ request: AdoptionRequest }>(`/api/projects/old-tool/adoption/requests/${r2.id}/decision`, "POST", ada, { decision: "decline" });
    expect(declined.body.request.status).toBe("declined");
    expect((await api<ProjectDetail>("/api/projects/old-tool")).body.author?.username).toBe("ada");
  });
});
