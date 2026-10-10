import { asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { getDb, schema } from "../core/db";
import { mount } from "../core/http";
import { emptyPage, missing, todo } from "./_stubs";

/** Categories, projects, uploads. Opus (tasks 1.1–1.7, 2.2). */
export function registerCatalog(app: Hono<AppEnv>) {
  mount(app, "listCategories", async (_, c) => {
    const rows = await getDb(c.env)
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.status, "active"))
      .orderBy(asc(schema.categories.position), asc(schema.categories.name));
    return {
      items: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        parentSlug: r.parentSlug,
        iconKey: r.iconKey,
        description: r.description,
        projectCount: 0,
      })),
    };
  });
  mount(app, "suggestCategory", () => todo("1.15"));

  mount(app, "listProjects", () => ({ ...emptyPage(), hiddenUnlicensedCount: 0 }));
  mount(app, "similarProjects", () => ({ items: [] }));
  mount(app, "previewSubmission", () => todo("1.4"));
  mount(app, "getProject", () => missing("Project"));
  mount(app, "createProject", () => todo("1.4"));
  mount(app, "updateProject", () => todo("1.4"));
  mount(app, "deleteProject", () => todo("1.4"));
  mount(app, "voteProject", () => todo("1.2"));
  mount(app, "listComments", () => emptyPage());
  mount(app, "createComment", () => todo("1.9"));
  mount(app, "getForkTree", () => missing("Project"));
  mount(app, "forkProject", () => todo("2.2"));
  mount(app, "claimProject", () => todo("1.7"));
  mount(app, "voteRoadmapItem", () => todo("2.7"));

  mount(app, "createUpload", () => todo("1.5"));
  mount(app, "putUpload", () => todo("1.5"));
}
