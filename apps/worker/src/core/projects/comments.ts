/** Project comments: posting, with notifications for the author, the parent commenter and @mentions. */
import type { Comment, SessionUser } from "@forkvlift/shared";
import { HttpError, notFound } from "../errors";
import { newId } from "../ids";
import { notificationStatements, type NewNotification } from "../notify";

const MENTION = /(?:^|[^\w@])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/g;

export async function createComment(db: D1Database, user: SessionUser, slug: string, body: string, parentId: string | null): Promise<Comment> {
  const project = await db
    .prepare(`SELECT id, name, owner_id, is_public, published_at FROM projects WHERE slug = ? AND deleted_at IS NULL AND hidden_at IS NULL`)
    .bind(slug)
    .first<{ id: string; name: string; owner_id: string | null; is_public: number; published_at: number | null }>();
  if (!project || (!(project.is_public && project.published_at) && project.owner_id !== user.id)) throw notFound("Project not found");

  let parentAuthor: string | null = null;
  if (parentId) {
    const parent = await db.prepare(`SELECT author_id FROM comments WHERE id = ? AND project_id = ? AND deleted_at IS NULL`).bind(parentId, project.id).first<{ author_id: string }>();
    if (!parent) throw new HttpError("invalid_request", "The comment you're replying to is gone.");
    parentAuthor = parent.author_id;
  }

  const mentioned = [...new Set([...body.matchAll(MENTION)].map((m) => m[1]!.toLowerCase()))].slice(0, 10);
  const mentionIds = mentioned.length
    ? (
        await db
          .prepare(`SELECT id FROM users WHERE lower(username) IN (${mentioned.map(() => "?").join(",")}) AND deleted_at IS NULL`)
          .bind(...mentioned)
          .all<{ id: string }>()
      ).results.map((r) => r.id)
    : [];

  const id = newId("cmt");
  const href = `/p/${slug}#comment-${id}`;
  const targets = new Map<string, NewNotification>();
  for (const uid of mentionIds) targets.set(uid, { userId: uid, type: "mention", actorId: user.id, title: `${user.displayName} mentioned you on ${project.name}`, href });
  if (parentAuthor) targets.set(parentAuthor, { userId: parentAuthor, type: "comment", actorId: user.id, title: `${user.displayName} replied to your comment on ${project.name}`, href });
  if (project.owner_id && !targets.has(project.owner_id)) {
    targets.set(project.owner_id, { userId: project.owner_id, type: "comment", actorId: user.id, title: `${user.displayName} commented on ${project.name}`, href });
  }

  await db.batch([
    db.prepare(`INSERT INTO comments (id, project_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, project.id, user.id, parentId, body, Date.now()),
    db.prepare(`UPDATE projects SET comment_count = (SELECT count(*) FROM comments WHERE project_id = ?1 AND deleted_at IS NULL) WHERE id = ?1`).bind(project.id),
    ...notificationStatements(db, [...targets.values()]),
  ]);
  return {
    id,
    projectId: project.id,
    parentId,
    author: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, avatar: user.avatar },
    body,
    upvotes: 0,
    createdAt: new Date().toISOString(),
    editedAt: null,
  };
}
