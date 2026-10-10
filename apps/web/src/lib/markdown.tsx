/**
 * Minimal, safe Markdown → React (task 3.8). Builds elements directly, never
 * HTML strings, so nothing a user writes can inject markup or script.
 *
 * Supported: paragraphs, line breaks, # headings, > quotes, - / 1. lists,
 * ``` fences, `code`, **bold**, *italic*, [links](https://…), bare URLs.
 * A line that is only a link to a project (/p/<slug>) becomes an embed.
 */
import { Fragment, type ReactNode } from "react";
import { cn } from "@forkvlift/ui";

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Only http(s) links and same-site paths survive. */
export function safeHref(raw: string): string | null {
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function isExternal(href: string) {
  return !href.startsWith("/") && new URL(href).origin !== window.location.origin;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  const ext = isExternal(href);
  return (
    <a href={href} className="text-accent underline underline-offset-2 break-words" {...(ext ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}>
      {children}
    </a>
  );
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index;
    if (idx > last) out.push(text.slice(last, idx));
    const k = `${key}-${i++}`;
    const [all, code, bold, italic, link, bare] = m;
    if (code) out.push(<code key={k} className="rounded-pixel bg-surface-2 px-1 font-mono text-[0.9em]">{code.slice(1, -1)}</code>);
    else if (bold) out.push(<strong key={k}>{inline(bold.slice(2, -2), k)}</strong>);
    else if (italic) out.push(<em key={k}>{inline(italic.slice(1, -1), k)}</em>);
    else if (link) {
      const close = link.indexOf("](");
      const href = safeHref(link.slice(close + 2, -1));
      out.push(href ? <A key={k} href={href}>{inline(link.slice(1, close), k)}</A> : link.slice(1, close));
    } else if (bare) {
      const href = safeHref(bare);
      out.push(href ? <A key={k} href={href}>{bare}</A> : bare);
    } else out.push(all);
    last = idx + all.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** "/p/slug" or "https://<this site>/p/slug" alone on a line. */
export function projectSlugFromLine(line: string): string | null {
  const t = line.trim();
  const m = /^(?:https?:\/\/[^/\s]+)?\/p\/([a-z0-9-]{1,80})\/?$/i.exec(t);
  if (!m) return null;
  if (/^https?:/i.test(t)) {
    try {
      if (new URL(t).origin !== window.location.origin && !/forklift\.stream$/i.test(new URL(t).hostname)) return null;
    } catch {
      return null;
    }
  }
  return m[1]!.toLowerCase();
}

export interface MarkdownProps {
  source: string;
  className?: string;
  /** Rendered for a line that is only a project link. Without it, the line stays a link. */
  renderProject?: (slug: string) => ReactNode;
}

export function Markdown({ source, className, renderProject }: MarkdownProps) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  const key = () => `b${n++}`;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    // Fenced code
    const fence = /^\s*```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      blocks.push(
        <pre key={key()} className="overflow-x-auto rounded-card border border-border bg-surface-2 p-3 font-mono text-sm" data-lang={fence[1] || undefined}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    // Project embed
    const slug = renderProject ? projectSlugFromLine(line) : null;
    if (slug) {
      blocks.push(<Fragment key={key()}>{renderProject!(slug)}</Fragment>);
      i++;
      continue;
    }
    // Heading (rendered small; posts never get page-level headings)
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const k = key();
      blocks.push(h[1]!.length <= 2 ? <h3 key={k} className="font-display text-base">{inline(h[2]!, k)}</h3> : <h4 key={k} className="font-semibold">{inline(h[2]!, k)}</h4>);
      i++;
      continue;
    }
    // Quote
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={key()} className="border-l-4 border-border pl-3 text-muted">
          <Markdown source={body.join("\n")} renderProject={renderProject} />
        </blockquote>,
      );
      continue;
    }
    // Lists
    const ordered = /^\s*\d+[.)]\s+/;
    const bullet = /^\s*[-*+]\s+/;
    if (ordered.test(line) || bullet.test(line)) {
      const re = ordered.test(line) ? ordered : bullet;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i]!)) items.push(lines[i++]!.replace(re, ""));
      const k = key();
      const lis = items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>);
      blocks.push(re === ordered ? <ol key={k} className="list-decimal space-y-1 pl-6">{lis}</ol> : <ul key={k} className="list-disc space-y-1 pl-6">{lis}</ul>);
      continue;
    }
    // Paragraph: consecutive plain lines, single newlines become <br>.
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^\s*(```|>|#{1,4}\s|[-*+]\s|\d+[.)]\s)/.test(lines[i]!) && !(renderProject && projectSlugFromLine(lines[i]!))) para.push(lines[i++]!);
    if (!para.length) {
      // A line that looked special but wasn't handled above; print it as text.
      para.push(lines[i++]!);
    }
    const k = key();
    blocks.push(
      <p key={k} className="break-words">
        {para.map((l, j) => (
          <Fragment key={j}>
            {j ? <br /> : null}
            {inline(l, `${k}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className={cn("space-y-3 leading-relaxed", className)}>{blocks}</div>;
}
