/**
 * Task 1.6: lightweight safety checks on import. The site never runs submitted
 * code; this only reads files to warn people.
 *
 * - Committed secrets: risky filenames + well-known key patterns in a handful of
 *   small text files. Findings go to the author privately, never on the public card.
 * - Suspicious install scripts: package.json lifecycle scripts and root shell
 *   scripts that pipe a download into a shell, decode-and-execute, etc. These are
 *   public "review before running" flags.
 */
import { github } from "../github/client";
import type { RepoSnapshot } from "../github/ingest";

export interface SecretFinding {
  path: string;
  kind: string;
}

export interface ScanResult {
  /** Public flags shown on the card/panel. */
  flags: string[];
  /** Private: shown only to the author and admins. */
  secrets: SecretFinding[];
  scanned: number;
}

const SECRET_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "AWS access key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: "GitHub token", re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { kind: "OpenAI API key", re: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { kind: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { kind: "Stripe live key", re: /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
  { kind: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: "Private key", re: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
];

/** Files that should never be committed. */
const RISKY_FILES = /(^|\/)(\.env(\.[\w-]+)?|id_rsa|id_ed25519|.*\.pem|.*\.p12|credentials\.json|service-account.*\.json|\.npmrc|\.pypirc)$/i;
const SAFE_ENV = /(^|\/)\.env\.(example|sample|template|dist|defaults)$/i;

/** Small text files worth reading. */
const READ_FILES = /(^|\/)(package\.json|\.env[^/]*|config\.(js|ts|json|ya?ml)|settings\.(json|py)|wrangler\.(toml|jsonc?)|docker-compose\.ya?ml|install\.sh|setup\.sh|[^/]+\.(sh|ps1))$/i;
const MAX_FILES = 15;
const MAX_BYTES = 100_000;

const DANGEROUS_SCRIPT: { flag: string; re: RegExp }[] = [
  { flag: "Install script downloads and runs remote code", re: /\b(curl|wget|iwr|Invoke-WebRequest)\b[^|\n;]*\|\s*(ba|z)?sh\b|\b(curl|wget)\b[^\n;]*\|\s*(sudo\s+)?(ba|z)?sh\b|\biex\s*\(\s*(iwr|Invoke-WebRequest|New-Object\s+Net\.WebClient)/i },
  { flag: "Install script runs encoded commands", re: /powershell[^\n]*-e(nc(odedcommand)?)?\s+[A-Za-z0-9+/=]{20,}|base64\s+(-d|--decode)[^\n]*\|\s*(ba|z)?sh\b|eval\s*\(\s*(atob|Buffer\.from)\(/i },
  { flag: "Install script touches credentials or SSH keys", re: /~\/\.ssh|\.aws\/credentials|\.npmrc|AppData[\\/]+Roaming[\\/]+(discord|Exodus|Electrum)/i },
];
const LIFECYCLE = ["preinstall", "install", "postinstall", "prepare"];

interface TreeResponse {
  tree: { path: string; type: "blob" | "tree"; size?: number }[];
  truncated: boolean;
}

export async function scanRepo(env: Env, s: Pick<RepoSnapshot, "fullName" | "defaultBranch">): Promise<ScanResult> {
  const result: ScanResult = { flags: [], secrets: [], scanned: 0 };
  const tree = await github<TreeResponse>(env, `/repos/${s.fullName}/git/trees/${encodeURIComponent(s.defaultBranch)}?recursive=1`, { allow404: true, freshFor: 3600 }).catch(() => null);
  const files = (tree?.data.tree ?? []).filter((f) => f.type === "blob" && !f.path.includes("node_modules/"));

  for (const f of files) {
    if (RISKY_FILES.test(f.path) && !SAFE_ENV.test(f.path)) result.secrets.push({ path: f.path, kind: "Sensitive file committed" });
  }

  const toRead = files
    .filter((f) => READ_FILES.test(f.path) && (f.size ?? 0) <= MAX_BYTES && f.path.split("/").length <= 3)
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
    .slice(0, MAX_FILES);

  await Promise.all(
    toRead.map(async (f) => {
      const text = await fetchRaw(s.fullName, s.defaultBranch, f.path);
      if (text === null) return;
      result.scanned++;
      for (const p of SECRET_PATTERNS) if (p.re.test(text)) result.secrets.push({ path: f.path, kind: p.kind });
      for (const flag of scriptFlags(f.path, text)) if (!result.flags.includes(flag)) result.flags.push(flag);
    }),
  );
  return result;
}

/** Public flags for one file. Exported for tests. */
export function scriptFlags(path: string, text: string): string[] {
  let scripts: string[] = [];
  if (/(^|\/)package\.json$/i.test(path)) {
    try {
      const pkg = JSON.parse(text) as { scripts?: Record<string, string> };
      scripts = LIFECYCLE.map((k) => pkg.scripts?.[k]).filter((v): v is string => typeof v === "string");
    } catch {
      return [];
    }
  } else if (/\.(sh|ps1)$/i.test(path)) {
    scripts = [text];
  }
  const flags: string[] = [];
  for (const script of scripts) for (const d of DANGEROUS_SCRIPT) if (d.re.test(script) && !flags.includes(d.flag)) flags.push(d.flag);
  return flags;
}

/** Secret kinds found in a text. Exported for tests. */
export function secretKinds(text: string): string[] {
  return SECRET_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.kind);
}

async function fetchRaw(fullName: string, branch: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${fullName}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      headers: { "user-agent": "ForkvLift safety scan" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  } catch {
    return null;
  }
}

/** Never store or show the secret itself: just where and what kind. */
export function describeSecrets(secrets: SecretFinding[]): string {
  return secrets.map((s) => `${s.kind} in ${s.path}`).join("; ");
}
