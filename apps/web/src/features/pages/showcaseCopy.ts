import { NO_LICENSE_DISCLAIMER } from "@forkvlift/shared";

/**
 * Task 5.8: Showcase copy, Plaza auto-post strings, and community rules.
 *
 * Designed for Sol and other agents to import directly:
 *   import { PLAZA_SHOWCASE_COPY, SHOWCASE_RULES, SHOW_OFF_SATURDAY } from "../pages";
 */

export interface ShowcaseAutoPostData {
  title: string;
  makerUsername: string;
  makerDisplayName?: string | null;
  tagline?: string | null;
  aiTools?: string[] | null;
  slug: string;
  isClosedSource?: boolean;
}

/**
 * Strings and formatters for the Plaza #showcase room auto-post integration.
 */
export const PLAZA_SHOWCASE_COPY = {
  /** Target Plaza room identifier. */
  room: "showcase",

  /** Label for the opt-in checkbox on the showcase composer. */
  optInLabel: "Post to Plaza #showcase",

  /** Description for the opt-in checkbox on the showcase composer. */
  optInDescription: "Share a live announcement card in the #showcase chat room so builders can see what you made.",

  /** Header announcement line. */
  announcementHeader: "✨ New showcase posted!",

  /** Short label for closed source showcase disclaimer. */
  closedSourceNotice: "🔒 Closed source (look, don't take)",

  /** Short label when public code is available. */
  openCodeNotice: "📦 Public code linked in catalog",

  /**
   * Generates formatted message text for a Plaza chat auto-post.
   * Plain, concise, and never includes clone or fork wording.
   */
  formatAutoPost(data: ShowcaseAutoPostData): string {
    const maker = data.makerDisplayName
      ? `${data.makerDisplayName} (@${data.makerUsername})`
      : `@${data.makerUsername}`;
    const tools = data.aiTools && data.aiTools.length > 0
      ? `\n🛠️ Built with: ${data.aiTools.join(", ")}`
      : "";
    const tagline = data.tagline ? `\n> ${data.tagline}` : "";
    const badge = data.isClosedSource
      ? `\n🔒 Closed source: look, don't take`
      : `\n✨ Community showcase`;

    return `✨ **${data.title}** by ${maker}${tagline}${tools}${badge}\n🔗 /showcases/${data.slug}`;
  },

  /**
   * Generates a compact one-liner for chat notifications.
   */
  formatOneLiner(title: string, username: string, slug: string): string {
    return `✨ ${title} by @${username} — /showcases/${slug}`;
  },
} as const;

/**
 * Core Showcase Rules (Task 5.8).
 * Kept plain, direct, and short.
 */
export const SHOWCASE_RULES = {
  whatsAllowed: {
    title: "1. What is allowed",
    summary:
      "Working web apps, mobile apps, games (itch.io, App Store, Google Play), desktop tools, SaaS, short films, and generative art built with AI. A public code repository is not required. Closed-source creations are warmly welcome. Commercial or paid apps are allowed with plain links; paid placements or sponsored rankings never exist.",
  },
  honestAiUse: {
    title: "2. Honest AI use",
    summary:
      "Tell the real build story. Accurately list the models and tools you used (Claude, Gemini, Cursor, v0, ChatGPT, etc.), the prompts or workflows that worked, and what was difficult. Do not exaggerate what AI generated, and do not present human-written code as AI-generated or vice versa.",
  },
  linksAndSafety: {
    title: "3. Links and downloads safety",
    summary:
      "Link to live web demos, app stores, or verified hosts whenever possible. Direct executable download links must carry an advisory notice: review before running. Distributing malware, keyloggers, cryptominers, adware, or deceptive installers results in an immediate permanent ban.",
  },
  lookDontTake: {
    title: "4. Look, don't take",
    summary:
      "Showcases are exhibitions for inspiration and storytelling. Unless the author links an open-source repository in the catalog, showcase projects are not open code. Respect closed-source boundaries: look, admire, and learn from how it was built, but do not scrape, copy, or redistribute closed code.",
  },
  noImpersonation: {
    title: "5. Authentic authorship",
    summary:
      "Only submit projects that you personally built, directed, or co-created. Do not submit third-party apps as your own work.",
  },
} as const;

/**
 * Rules and copy for "Show-off Saturday" (Showcase-only growth events, Task 5.9 & 5.8).
 */
export const SHOW_OFF_SATURDAY = {
  name: "Show-off Saturday",
  tagline: "The weekly community vote for favorite AI builds.",
  description:
    "Every Saturday, the ForkLift community gathers to spotlight what builders created with AI this week. Submit your published showcase, explore other creators' builds, and cast your ballot.",
  rules: [
    "Submissions: Enter one of your published showcases while the submission window is open.",
    "Ballot: One vote per person across the event. You cannot vote for your own showcase.",
    "Showcases only: Open-source catalog projects enter Hackathons and Fork Fridays; Show-off Saturday is exclusively for showcases.",
    "Fair play: Alt accounts, vote rings, or automated ballot stuffing will disqualify entries and may result in an account suspension.",
    "Recognition: The highest-ranked showcase earns the 'Showcase of the Week' badge and front-page rail placement.",
  ],
} as const;

/**
 * Download safety notice for external links.
 */
export const DOWNLOAD_SAFETY_NOTICE = {
  title: "Review before running",
  message:
    "This download link points to an external file or installer provided by the maker. ForkLift does not host or execute third-party binaries. Always inspect downloaded files and run untrusted software in an isolated environment or sandbox.",
} as const;

// Re-export the authoritative NO_LICENSE_DISCLAIMER unchanged (never reworded)
export { NO_LICENSE_DISCLAIMER };
