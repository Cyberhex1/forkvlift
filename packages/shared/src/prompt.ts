/**
 * Paste-ready prompt for a coding agent that is about to build on a project
 * (used by the MCP endpoint, the public API and the panel's "Copy agent
 * prompt" box). The author's own starter prompt wins when there is one.
 */
import { NO_LICENSE_DISCLAIMER, SITE_ORIGIN_PRODUCTION } from "./constants";
import type { ProjectDetail } from "./schemas";

export function buildStarterPrompt(p: ProjectDetail, origin: string = SITE_ORIGIN_PRODUCTION): string {
  if (p.starterPrompt?.trim()) return p.starterPrompt.trim();
  const lines: string[] = [];
  lines.push(`You're continuing "${p.name}" (${p.repoUrl}), found on ${origin}/p/${p.slug}.`);
  if (p.tagline) lines.push(`What it is: ${p.tagline}`);
  if (p.license) {
    lines.push(`License: ${p.license.spdx}. ${p.license.summary}`);
    lines.push(`Keep the original LICENSE file and credit the author${p.author ? ` (@${p.author.username})` : ""}.`);
  } else {
    lines.push(`${NO_LICENSE_DISCLAIMER.title} Don't copy or adapt this code until the author adds a license; read it for ideas only.`);
  }
  if (p.forkedFrom) lines.push(`It is itself a fork of "${p.forkedFrom.name}" (${origin}/p/${p.forkedFrom.slug}); keep that credit too.`);
  if (p.stack.length) lines.push(`Stack: ${p.stack.join(", ")}.`);
  if (p.stage !== "finished") lines.push(`Stage: ${p.stage === "wip" ? "work in progress" : "up for adoption (the author is looking for a new maintainer)"}.`);
  if (p.wipStatus?.whatWorks) lines.push(`What works: ${p.wipStatus.whatWorks}`);
  if (p.wipStatus?.whatsMissing) lines.push(`What's missing: ${p.wipStatus.whatsMissing}`);
  if (p.lookingForHelp) lines.push(`The author wants help with: ${p.lookingForHelp}`);
  if (p.safety.flags.length) lines.push(`Safety notes from the site's scan: ${p.safety.flags.join("; ")}. Review those files before running anything.`);
  lines.push("");
  lines.push(`First: ${p.license ? `clone it (${p.cloneCommand}), ` : ""}read the README, run it locally, and summarize how it's structured before changing anything.`);
  lines.push("Then: ask me what I want to change, and make small, reviewable commits.");
  return lines.join("\n");
}
