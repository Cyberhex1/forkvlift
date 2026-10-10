import { github } from "./client";

/**
 * Does this GitHub login own the repo? True for the user's own repos, and for
 * org repos when the user is a *public* member of the org (GitHub doesn't reveal
 * private membership without the user's own token).
 */
export async function viewerOwnsRepo(env: Env, githubLogin: string | null, repoOwner: string, ownerType: "User" | "Organization"): Promise<boolean> {
  if (!githubLogin) return false;
  if (githubLogin.toLowerCase() === repoOwner.toLowerCase()) return true;
  if (ownerType !== "Organization") return false;
  try {
    // 204 = public member; 404 = not a public member. Cached briefly.
    const res = await github<unknown>(env, `/orgs/${repoOwner}/public_members/${githubLogin}`, { allow404: true, freshFor: 600 });
    return res !== null;
  } catch {
    return false;
  }
}
