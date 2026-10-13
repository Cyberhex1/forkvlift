/**
 * Suggest a category for a discovered repo, so the review queue starts with
 * one filled in. Keyword rules over GitHub topics, name and description come
 * first (free and predictable); Workers AI picks from the active list only when
 * the keywords don't settle it. The admin can always change the pick.
 */
import type { RepoSnapshot } from "../github/ingest";
import { proposedCard } from "./score";

type Repo = Pick<RepoSnapshot, "name" | "description" | "topics" | "language">;

/** slug → keywords. Hyphenated keywords also match as spaced phrases. */
const RULES: Record<string, string[]> = {
  "ai-and-agents": ["ai", "llm", "llms", "gpt", "chatgpt", "openai", "ollama", "llama", "agent", "agents", "ai-agent", "ai-agents", "agent-skill", "agent-skills", "claude-code-plugin", "coding-agent", "chatbot", "rag", "prompt", "prompts", "langchain", "embeddings", "local-llm", "machine-learning", "stable-diffusion", "whisper"],
  "developer-tools": ["developer-tools", "devtools", "ide", "code-editor", "vscode", "vscode-extension", "neovim", "vim", "linter", "lint", "formatter", "api-client", "devops", "ci", "github-actions", "git", "mcp", "mcp-server", "sdk", "debugger", "terminal", "code-review", "testing", "compiler", "language-server"],
  "tools-and-utilities": ["utility", "utilities", "tool", "tools", "cli", "converter", "file-converter", "browser-extension", "chrome-extension", "firefox-extension", "extension", "window-manager", "clipboard", "screenshot", "pdf", "downloader", "launcher"],
  productivity: ["productivity", "notes", "note-taking", "todo", "to-do", "todo-list", "tasks", "task-manager", "calendar", "habit", "habit-tracker", "pomodoro", "focus", "kanban", "journal", "bookmarks", "time-tracking", "markdown-editor"],
  games: ["game", "games", "gamedev", "game-development", "godot", "unity", "phaser", "pygame", "love2d", "chess", "platformer", "rpg", "browser-game", "fps", "racing", "kart-racer", "city-builder", "open-world", "roguelike", "puzzle-game", "multiplayer-game"],
  production: ["music", "audio", "daw", "synth", "synthesizer", "video", "video-editor", "video-editing", "streaming", "obs", "podcast", "podcasting", "3d", "blender", "music-production"],
  suites: ["office", "office-suite", "suite", "all-in-one"],
  "creative-and-design": ["design", "image-editor", "pixel-art", "drawing", "paint", "font", "fonts", "ui-kit", "figma", "svg", "icons", "illustration", "photo-editor", "color-palette"],
  "finance-and-money": ["finance", "personal-finance", "budget", "budgeting", "expense", "expenses", "expense-tracker", "invoice", "invoicing", "accounting", "portfolio-tracker", "stocks", "money", "banking"],
  "health-and-fitness": ["health", "fitness", "workout", "exercise", "meal-planner", "nutrition", "sleep", "mood", "mood-tracker", "meditation", "running", "calories"],
  "education-and-learning": ["education", "learning", "flashcards", "anki", "language-learning", "tutorial", "course", "study", "quiz", "teaching", "edtech"],
  "home-and-life": ["recipe", "recipes", "cooking", "home-automation", "home-assistant", "inventory", "plants", "pets", "grocery", "shopping-list", "family"],
  "social-and-community": ["social", "social-network", "forum", "chat", "messaging", "community", "link-in-bio", "events", "fediverse", "mastodon", "activitypub", "discord-bot"],
  "business-and-ops": ["crm", "booking", "scheduling", "erp", "small-business", "ecommerce", "e-commerce", "pos", "point-of-sale", "hr", "helpdesk"],
  "data-and-analytics": ["analytics", "data", "dashboard", "scraper", "scraping", "web-scraping", "visualization", "data-visualization", "charts", "spreadsheet", "etl", "sql"],
  "media-and-entertainment": ["media-player", "music-player", "video-player", "player", "ebook", "ebook-reader", "reader", "comics", "manga", "movies", "anime", "books", "spotify", "youtube"],
  "hardware-and-iot": ["raspberry-pi", "arduino", "esp32", "esp8266", "iot", "3d-printing", "firmware", "embedded", "hardware", "microcontroller"],
  "privacy-and-security": ["privacy", "security", "password", "password-manager", "vpn", "adblock", "ad-blocker", "encryption", "2fa", "e2ee", "pentest"],
  "self-hosted-and-homelab": ["self-hosted", "selfhosted", "homelab", "docker-compose", "server", "backup", "nas", "proxmox"],
  "web-templates-and-starters": ["template", "starter", "starter-kit", "boilerplate", "landing-page", "portfolio", "saas-boilerplate", "nextjs-template"],
  "mobile-apps": ["ios", "android", "react-native", "flutter", "mobile", "mobile-app", "swiftui", "expo"],
  accessibility: ["accessibility", "a11y", "screen-reader", "captions", "captioning", "high-contrast", "wcag"],
  "fun-and-experiments": ["fun", "toy", "experiment", "experiments", "joke", "meme", "creative-coding", "generative-art", "art"],
};

/** Inside Games, the more specific shelf when its words show up. */
const GAME_SUBS: Record<string, string[]> = {
  roguelikes: ["roguelike", "roguelite", "dungeon", "dungeon-crawler"],
  "puzzle-games": ["puzzle", "sudoku", "wordle", "tetris", "logic-game"],
  "multiplayer-games": ["multiplayer", "online-game", "mmo", "io-game"],
  "game-jams": ["game-jam", "gamejam", "ludum-dare", "js13k"],
  "game-engines-and-tools": ["game-engine", "engine", "level-editor", "tilemap", "game-framework"],
  "browser-games": ["browser-game", "html5-game", "html5", "browser", "webgl", "canvas", "phaser", "javascript-game"],
};

/**
 * Words that say how a project was built, not what it is. Most vibe-coded repos
 * carry them ("claude-code", "ai-generated", "vibe-coding"), so counting them
 * filed games and dev tools under AI and agents. They're dropped before scoring.
 */
const BUILT_WITH = new Set(["claude", "claude-ai", "claude-code", "anthropic", "cursor", "cursor-ai", "codex", "codex-cli", "openai-codex", "copilot", "github-copilot", "gemini", "gemini-ai", "gemini-flash", "gemini-cli", "antigravity", "antigravity-ai", "antigravity-ide", "opencode", "windsurf", "bolt", "lovable", "v0", "ai-generated", "ai-assisted", "ai-coded", "ai-made", "made-with-ai", "built-with-ai", "vibe-coding", "vibecoding", "vibe-coded", "vibecoded", "vibecode", "vibecoders", "ai-assisted-development", "ai-coding", "agentic-coding"]);
const BUILT_WITH_TEXT = /\b(?:(?:built|made|written|coded|generated|created)(?: entirely| fully| mostly)? (?:with|by|using|in)(?: the help of)? (?:ai(?: agents?)?|claude(?: code)?|cursor|codex|copilot|chatgpt|gpt-?\d*|gemini|an? (?:ai|llm))|ai[- ]generated|vibe[- ]coded|vibe[- ]coding)\b/gi;

const LANGUAGE_HINTS: Record<string, string> = { Swift: "mobile-apps", Kotlin: "mobile-apps", Dart: "mobile-apps", GDScript: "games" };

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;

function scoreRules(rules: Record<string, string[]>, repo: Repo): Map<string, number> {
  const topics = new Set(repo.topics.map((t) => t.toLowerCase()).filter((t) => !BUILT_WITH.has(t)));
  const text = norm(`${repo.name} ${repo.description.replace(BUILT_WITH_TEXT, " ")}`);
  const scores = new Map<string, number>();
  for (const [slug, words] of Object.entries(rules)) {
    let score = 0;
    for (const w of words) {
      if (topics.has(w)) score += 3;
      else if (text.includes(norm(w))) score += 1;
    }
    if (score) scores.set(slug, score);
  }
  return scores;
}

function best(scores: Map<string, number>, min: number): string | null {
  let pick: string | null = null;
  let top = 0;
  for (const [slug, score] of scores) {
    if (score > top) {
      top = score;
      pick = slug;
    }
  }
  return top >= min ? pick : null;
}

/** Keyword-only guess; null when nothing is convincing (one topic hit or two words). */
export function keywordCategory(repo: Repo): string | null {
  const scores = scoreRules(RULES, repo);
  const hint = repo.language ? LANGUAGE_HINTS[repo.language] : undefined;
  if (hint) scores.set(hint, (scores.get(hint) ?? 0) + 1);
  // "AI" and "tool" are everywhere; let a more specific category win a tie.
  for (const generic of ["ai-and-agents", "tools-and-utilities"]) {
    const s = scores.get(generic);
    if (s !== undefined) scores.set(generic, s - 0.5);
  }
  const pick = best(scores, 2);
  if (pick === "games") return best(scoreRules(GAME_SUBS, repo), 1) ?? "games";
  return pick;
}

interface CategoryRow {
  slug: string;
  name: string;
  description: string;
}

/** Ask Workers AI to choose one slug from the active list. Returns null on any doubt. */
async function aiCategory(env: Env, repo: Repo, categories: CategoryRow[]): Promise<string | null> {
  if (!env.AI) return null;
  const list = categories.map((c) => `${c.slug}: ${c.name}. ${c.description}`).join("\n");
  const about = `Name: ${repo.name}\nDescription: ${repo.description || "(none)"}\nTopics: ${repo.topics.join(", ") || "(none)"}\nLanguage: ${repo.language ?? "unknown"}`;
  try {
    const out = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as Parameters<Ai["run"]>[0], {
      messages: [
        { role: "system", content: `You sort open-source projects into one category by what the project does for its users. Ignore how it was built: most of these were written with AI coding tools, so "Claude", "Cursor", "AI-generated" or "vibe coding" say nothing about the category. Use ai-and-agents only when the project itself is an AI app, model tool or agent. Reply with exactly one slug from this list and nothing else:\n${list}` },
        { role: "user", content: about },
      ],
      max_tokens: 20,
      temperature: 0,
    })) as { response?: string };
    const answer = (out.response ?? "").toLowerCase();
    // Prefer the longest slug mentioned (subcategories are more specific).
    const found = categories.map((c) => c.slug).filter((slug) => new RegExp(`(^|[^a-z-])${slug}([^a-z-]|$)`).test(answer));
    return found.sort((a, b) => b.length - a.length)[0] ?? null;
  } catch (e) {
    console.error("[categorize] AI", e);
    return null;
  }
}

/** Best guess among the active categories, or null. */
export async function suggestCategory(env: Env, repo: Repo, opts: { useAi?: boolean } = {}): Promise<string | null> {
  const { results } = await env.DB.prepare(`SELECT slug, name, description FROM categories WHERE status = 'active' ORDER BY position`).all<CategoryRow>();
  const active = new Set(results.map((c) => c.slug));
  const guess = keywordCategory(repo);
  if (guess && active.has(guess)) return guess;
  if (guess) {
    // A sub-shelf might be retired; fall back to its parent if that is active.
    const parent = await env.DB.prepare(`SELECT parent_slug FROM categories WHERE slug = ?`).bind(guess).first<{ parent_slug: string | null }>();
    if (parent?.parent_slug && active.has(parent.parent_slug)) return parent.parent_slug;
  }
  return opts.useAi === false ? null : aiCategory(env, repo, results);
}

/**
 * Re-suggest categories for the queue. Pending candidates only ever hold the
 * automatic pick (an admin's edits are saved when they decide), so those are
 * re-scored; snoozed ones may carry an admin's choice and are only filled when
 * empty. Returns how many changed.
 */
export async function backfillCandidateCategories(env: Env, limit = 200): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, data, proposed FROM candidates
     WHERE status = 'pending' OR (status = 'snoozed' AND (proposed IS NULL OR json_extract(proposed, '$.categorySlug') IS NULL))
     ORDER BY score DESC LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: string; data: string; proposed: string | null }>();
  let updated = 0;
  for (const row of results) {
    const s = JSON.parse(row.data) as RepoSnapshot;
    const slug = await suggestCategory(env, s);
    const current = row.proposed ? (JSON.parse(row.proposed) as ReturnType<typeof proposedCard>) : proposedCard(s);
    if (!slug || slug === current.categorySlug) continue;
    const proposed = { ...current, categorySlug: slug };
    await env.DB.prepare(`UPDATE candidates SET proposed = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(proposed), Date.now(), row.id).run();
    updated++;
  }
  return updated;
}
