/**
 * README sanitizing. GitHub's rendered HTML is the input; the output is safe to
 * drop into the focus panel with dangerouslySetInnerHTML.
 *
 * Allowlist only: unknown tags are stripped (content kept), script/style bodies
 * are removed, attributes are limited per tag, URLs must be http(s)/mailto or
 * in-page anchors, and relative links are resolved against the repo.
 */
import { FilterXSS, type IWhiteList } from "xss";

const BLOCK_ATTRS = ["align"];
const whiteList: IWhiteList = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "title", "width", "height", "align", "loading"],
  h1: BLOCK_ATTRS, h2: BLOCK_ATTRS, h3: BLOCK_ATTRS, h4: BLOCK_ATTRS, h5: BLOCK_ATTRS, h6: BLOCK_ATTRS,
  p: BLOCK_ATTRS,
  div: ["align", "class"],
  span: ["class"],
  pre: ["class"],
  code: ["class"],
  br: [], hr: [],
  ul: [], ol: ["start"], li: [],
  blockquote: [],
  em: [], strong: [], b: [], i: [], del: [], s: [], kbd: [], sup: [], sub: [], mark: [],
  table: [], thead: [], tbody: [], tr: [],
  th: ["align", "colspan", "rowspan"],
  td: ["align", "colspan", "rowspan"],
  details: ["open"], summary: [],
  dl: [], dt: [], dd: [],
};

/** Only GitHub's syntax-highlighting classes survive (never our own utility classes). */
const SAFE_CLASS = /^(?:pl-[a-z0-9]+|highlight(?:-[a-z0-9-]+)?|language-[a-z0-9+#-]+)$/i;

export interface RepoContext {
  fullName: string;
  defaultBranch: string;
}

export const README_MAX_BYTES = 200_000;

export function sanitizeReadme(html: string, repo: RepoContext): string {
  const filter = new FilterXSS({
    whiteList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style", "noscript", "iframe", "object", "embed", "template", "svg", "math"],
    allowCommentTag: false,
    onIgnoreTagAttr: () => "",
    safeAttrValue: (tag, name, value) => safeValue(tag, name, value, repo),
    onTagAttr: (tag, name, value) => {
      if (name === "class") {
        const kept = value.split(/\s+/).filter((c) => SAFE_CLASS.test(c)).join(" ");
        return kept ? `class="${kept}"` : "";
      }
      if (tag === "a" && (name === "rel" || name === "target")) return ""; // added after filtering
      return undefined;
    },
  });
  // Every link opens outside the site and passes no referrer or rank. Safe to add
  // after filtering: only allowlisted attributes remain on <a>.
  const out = filter.process(html).replace(/<a(?=[^>]*\shref="(?:https?:|mailto:))/g, '<a rel="nofollow noopener noreferrer ugc" target="_blank"');
  return out.length > README_MAX_BYTES ? out.slice(0, README_MAX_BYTES) : out;
}

function safeValue(tag: string, name: string, value: string, repo: RepoContext): string {
  const v = value.trim();
  if (name === "href" || name === "src") return safeUrl(v, tag === "img" ? "raw" : "blob", repo);
  if (name === "width" || name === "height" || name === "colspan" || name === "rowspan" || name === "start") {
    return /^\d{1,4}%?$/.test(v) ? v : "";
  }
  if (name === "align") return /^(left|right|center|justify)$/i.test(v) ? v : "";
  if (name === "loading") return "lazy";
  return v.replace(/[<>"]/g, "");
}

function safeUrl(value: string, kind: "raw" | "blob", repo: RepoContext): string {
  if (!value) return "";
  if (value.startsWith("#")) return `#${value.slice(1).replace(/[^\w-]/g, "")}`;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // keep as-is
  }
  if (/^\s*(javascript|data|vbscript|file):/i.test(decoded)) return "";
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  // Relative to the repo root.
  const path = value.replace(/^\.?\//, "");
  return kind === "raw"
    ? `https://raw.githubusercontent.com/${repo.fullName}/${repo.defaultBranch}/${path}`
    : `https://github.com/${repo.fullName}/blob/${repo.defaultBranch}/${path}`;
}

/** Whether the sanitized README shows any images (a hint for "has screenshots"). */
export function readmeHasImages(html: string): boolean {
  return /<img\b[^>]*\bsrc="https?:\/\//i.test(html);
}
