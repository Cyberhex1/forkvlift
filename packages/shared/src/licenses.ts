import type { LicenseInfo } from "./schemas/project";

/**
 * Plain-English one-liners for common SPDX licenses. Anything not listed still
 * shows its name; null means "No license".
 */
const KNOWN: Record<string, Omit<LicenseInfo, "spdx">> = {
  MIT: { name: "MIT License", summary: "MIT: do anything, keep the credit", copyleft: false },
  "Apache-2.0": { name: "Apache License 2.0", summary: "Apache 2.0: do anything, keep the credit and notices; includes a patent grant", copyleft: false },
  "BSD-2-Clause": { name: "BSD 2-Clause", summary: "BSD: do anything, keep the credit", copyleft: false },
  "BSD-3-Clause": { name: "BSD 3-Clause", summary: "BSD: do anything, keep the credit, don't use the author's name to promote", copyleft: false },
  ISC: { name: "ISC License", summary: "ISC: do anything, keep the credit", copyleft: false },
  Unlicense: { name: "The Unlicense", summary: "Public domain: do anything", copyleft: false },
  "0BSD": { name: "Zero-Clause BSD", summary: "Do anything, no credit required", copyleft: false },
  "CC0-1.0": { name: "CC0 1.0", summary: "Public domain: do anything", copyleft: false },
  "MPL-2.0": { name: "Mozilla Public License 2.0", summary: "MPL: changes to its files must stay open", copyleft: true },
  "LGPL-3.0": { name: "GNU LGPL v3", summary: "LGPL: changes to the library must stay open", copyleft: true },
  "GPL-2.0": { name: "GNU GPL v2", summary: "GPL: your fork must stay open under the GPL", copyleft: true },
  "GPL-3.0": { name: "GNU GPL v3", summary: "GPL: your fork must stay open under the GPL", copyleft: true },
  "AGPL-3.0": { name: "GNU AGPL v3", summary: "AGPL: your fork must stay open, even when run as a web service", copyleft: true },
};

export function describeLicense(spdx: string | null | undefined, fallbackName?: string): LicenseInfo | null {
  if (!spdx || spdx === "NOASSERTION" || spdx === "NONE") return null;
  const base = spdx.replace(/-(only|or-later)$/, "");
  const known = KNOWN[spdx] ?? KNOWN[base];
  if (known) return { spdx, ...known };
  return { spdx, name: fallbackName ?? spdx, summary: `${fallbackName ?? spdx}: read the license before reusing`, copyleft: false };
}
