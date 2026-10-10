import { lazy, Suspense, type ReactNode } from "react";
import type { Refractor } from "refractor/core";

type Nodes = ReturnType<Refractor["highlight"]>["children"];

// Import core plus only the requested grammar. Never import refractor/all or a theme.
const grammars = {
  javascript: () => import("refractor/javascript"),
  typescript: () => import("refractor/typescript"),
  jsx: () => import("refractor/jsx"),
  tsx: () => import("refractor/tsx"),
  json: () => import("refractor/json"),
  bash: () => import("refractor/bash"),
  python: () => import("refractor/python"),
  css: () => import("refractor/css"),
  markup: () => import("refractor/markup"),
  sql: () => import("refractor/sql"),
  powershell: () => import("refractor/powershell"),
};
const aliases = new Map([
  ["js", "javascript"], ["node", "javascript"], ["ts", "typescript"],
  ["sh", "bash"], ["shell", "bash"], ["py", "python"],
  ["html", "markup"], ["xml", "markup"], ["svg", "markup"],
  ["ps1", "powershell"], ["pwsh", "powershell"],
]);

// Only our token classes become props: no AST tag, style, URL or HTML is copied.
const colors = new Map([
  ...["comment", "prolog", "doctype", "cdata"].map((type) => [type, "text-muted"] as const),
  ...["keyword", "atrule", "boolean", "constant", "property", "attr-name"].map((type) => [type, "text-accent"] as const),
  ...["string", "char", "attr-value", "inserted"].map((type) => [type, "text-success"] as const),
  ...["number", "regex", "symbol"].map((type) => [type, "text-warning"] as const),
  ...["function", "class-name", "tag", "selector"].map((type) => [type, "text-info"] as const),
  ["deleted", "text-danger"],
]);

function renderTokens(nodes: Nodes): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;
    const names = Array.isArray(node.properties.className) ? node.properties.className.map(String) : [];
    const token = names.find((name) => colors.has(name));
    return <span key={index} className={token ? colors.get(token) : undefined} data-syntax-token={token ?? "plain"}>{renderTokens(node.children)}</span>;
  });
}

function PlainCode({ source }: { source: string }) { return <>{source}</>; }

const highlights = new Map(Object.entries(grammars).map(([language, loadGrammar]) => [language, lazy(async () => {
  try {
    const [{ refractor }, grammar] = await Promise.all([import("refractor/core"), loadGrammar()]);
    refractor.register(grammar.default);
    function Highlight({ source }: { source: string }) {
      try { return <>{renderTokens(refractor.highlight(source, language).children)}</>; }
      catch { return <PlainCode source={source} />; }
    }
    return { default: Highlight };
  } catch {
    // Failed chunk downloads must leave the post readable.
    return { default: PlainCode };
  }
})]));

export function HighlightedCode({ source, language }: { source: string; language: string }) {
  const normalized = language.toLowerCase();
  const Highlight = highlights.get(aliases.get(normalized) ?? normalized);
  // Keep expensive tokenization bounded. Large/unknown blocks stay monospace.
  if (!Highlight || source.length > 20000) return <code>{source}</code>;
  return <code><Suspense fallback={source}><Highlight source={source} /></Suspense></code>;
}
