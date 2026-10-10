/**
 * Full-text search over projects (D1 / SQLite FTS5). The index is a standalone
 * FTS table kept in sync by syncProjectSearch() after every project write.
 */

/** Turn user input into a safe FTS5 query: quoted terms, prefix match on the last. */
export function buildFtsQuery(input: string): string | null {
  const terms = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (!terms.length) return null;
  return terms.map((t, i) => (i === terms.length - 1 && t.length >= 2 ? `"${t}"*` : `"${t}"`)).join(" ");
}

/** Plain text from sanitized README HTML, for indexing. */
export function htmlToText(html: string | null, max = 20_000): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Re-index one project (call after insert/update; removes it when deleted). */
export async function syncProjectSearch(db: D1Database, projectId: string): Promise<void> {
  const row = await db
    .prepare(
      `SELECT p.id, p.name, p.tagline, p.description, p.replaces, p.readme_html, p.deleted_at,
         (SELECT group_concat(tag, ' ') FROM project_tags WHERE project_id = p.id) AS tags
       FROM projects p WHERE p.id = ?`,
    )
    .bind(projectId)
    .first<{ id: string; name: string; tagline: string; description: string; replaces: string | null; readme_html: string | null; deleted_at: number | null; tags: string | null }>();

  const statements = [db.prepare(`DELETE FROM projects_fts WHERE project_id = ?`).bind(projectId)];
  if (row && !row.deleted_at) {
    let replaces = "";
    try {
      replaces = (JSON.parse(row.replaces ?? "[]") as string[]).join(" ");
    } catch {
      // ignore malformed
    }
    statements.push(
      db
        .prepare(`INSERT INTO projects_fts (project_id, name, tagline, description, tags, replaces, readme) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(row.id, row.name, row.tagline, row.description, row.tags ?? "", replaces, htmlToText(row.readme_html)),
    );
  }
  await db.batch(statements);
}
