import { describe, expect, it } from "vitest";
import { keywordCategory } from "../src/core/curation/categorize";

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
