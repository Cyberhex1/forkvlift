import { describe, expect, it } from "vitest";
import { keywordCategory } from "../src/core/curation/categorize";
import { isTooling } from "../src/core/curation/discovery";

const repo = (name: string, description: string, topics: string[] = [], language: string | null = null) => ({ name, description, topics, language });

describe("keywordCategory", () => {
  it.each([
    [repo("dungeon-dash", "A tiny roguelike in the browser", ["game", "roguelike"]), "roguelikes"],
    [repo("pixel-pong", "Pong you can play in your browser", ["game", "html5"]), "browser-games"],
    [repo("chess-thing", "Chess", ["game"]), "games"],
    [repo("budget-buddy", "Track monthly expenses and budgets", ["budgeting", "personal-finance"]), "finance-and-money"],
    [repo("todo", "A keyboard-first to-do list with a habit tracker", ["productivity"]), "productivity"],
    [repo("mcp-weather", "MCP server exposing weather data to agents", ["mcp-server", "llm"]), "developer-tools"],
    [repo("chat-local", "Chat UI for local LLMs via Ollama", ["ollama", "llm", "chatbot"]), "ai-and-agents"],
    [repo("open-steps", "Plain-language agent skills for Claude Code, Codex, Cursor and Gemini CLI", ["agent-skill", "agent-skills", "ai-agents", "claude-code", "claude-code-plugin"]), "ai-and-agents"],
    [repo("homelab-dash", "Dashboard for my self-hosted services", ["self-hosted", "homelab"]), "self-hosted-and-homelab"],
    [repo("pocket-plant", "Plant watering reminders for iOS", [], "Swift"), "mobile-apps"],
    [repo("recipe-box", "Save and search recipes", ["recipes", "cooking"]), "home-and-life"],
    // How it was built doesn't decide the category (real queue examples).
    [repo("turbo-kart-rally", "Arcade kart racer in the spirit of Mario Kart, built entirely with Three.js. Built by Claude", ["ai-generated", "claude", "game", "kart-racer", "procedural-generation", "threejs", "webgl"]), "browser-games"],
    [repo("grandma-gta", "A browser-playable rural-Taiwan open world. 3D by Tripo, code by Claude Code", ["ai-generated", "browser-game", "claude-code", "game", "open-world", "threejs"]), "browser-games"],
    [repo("x64dbg-mcp-server", "A native MCP plugin for x64dbg that exposes the debugger to agents", ["ai-agents", "claude", "claude-code", "mcp", "mcp-server", "mcp-servers", "x64dbg-plugin"]), "developer-tools"],
    [repo("lieflat-charts", "Data visualization skill turning data into interactive HTML charts", ["agent-skills", "charts", "claude-code", "codex", "data-visualization", "svg"]), "data-and-analytics"],
    [repo("cindy", "The open-source AI agent that works out of the box", ["agent", "ai-agent", "ai-assistant", "android", "claude-code", "codex", "llm"]), "ai-and-agents"],
    // Apps that add an AI feature are filed by what they are (real queue examples).
    [repo("docmost", "Docmost is an open-source collaborative wiki and documentation software. It is an open-source alternative to Confluence and Notion.", ["ai", "ai-agents", "collaborative", "documentation", "knowledge-base", "notion-alternative", "wiki"]), "productivity"],
    [repo("Logue", "A local-first workspace for documents, tasks and meetings on macOS", ["ai-agent", "llm", "local-first", "meeting-notes", "note-taking", "notion-alternative", "obsidian-alternative", "swiftui"], "Swift"), "productivity"],
    [repo("eidos", "A single-file relational spreadsheet for you and your agent.", ["database", "editor", "llm", "local-first", "notion-alternative", "sqlite"]), "productivity"],
    [repo("open-design", "The open-source Claude Design alternative. Local-first desktop app.", ["design-systems", "figma-alternative", "prototyping", "ui-generator", "vibe-coding"]), "creative-and-design"],
    // Coding-agent add-ons still belong in AI and agents.
    [repo("repository-harness", "Turn any repo into an agent-ready workspace for Claude Code, Codex, Cursor, and other coding agents.", ["agents-md", "ai-agents", "claude-code", "coding-agents", "harness-engineering", "templates"]), "ai-and-agents"],
  ])("%o → %s", (r, slug) => {
    expect(keywordCategory(r)).toBe(slug);
  });

  it("ignores build-tool words entirely", () => {
    expect(keywordCategory(repo("thing", "Vibe coded with Claude Code and Cursor", ["claude-code", "cursor", "vibe-coding", "ai-generated"]))).toBeNull();
  });

  it("returns null when nothing is convincing", () => {
    expect(keywordCategory(repo("thing", "My project"))).toBeNull();
    expect(keywordCategory(repo("x", "a cli"))).toBeNull(); // one weak word isn't enough
    expect(keywordCategory(repo("x", "Reminders", [], "Swift"))).toBeNull(); // language alone isn't enough
  });
});

describe("isTooling", () => {
  it("spots coding-agent add-ons by topic or pitch, not by how a project was built", () => {
    expect(isTooling({ name: "h", topics: ["agent-harness"], description: "" })).toBe(true);
    expect(isTooling({ name: "aicontainer", topics: ["docker", "sandbox"], description: "Sandboxed devcontainer for running Claude Code, Codex, and OpenCode in bypass mode." })).toBe(true);
    expect(isTooling({ name: "kart", topics: ["game", "claude-code"], description: "A kart racer built with Claude Code" })).toBe(false);
    expect(isTooling({ name: "tela", topics: ["mcp", "wiki", "knowledge-base", "notion-alternative"], description: "Self-hostable team wiki with a built-in MCP server" })).toBe(false);
    expect(isTooling({ name: "notes", topics: ["notion-alternative"], description: "A local-first notes app" })).toBe(false);
  });
});
