#!/usr/bin/env node
/**
 * Validate project JSON submissions against the ForkLift schema and category taxonomy.
 * Usage:
 *   node scripts/seed/validate-pr.mjs <path-to-json-file-or-dir>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const categoriesFile = path.resolve(repoRoot, "data/seed/categories.json");

let validCategories = new Set();
if (fs.existsSync(categoriesFile)) {
  try {
    const raw = JSON.parse(fs.readFileSync(categoriesFile, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.categories || [];
    for (const c of list) {
      if (c.slug) validCategories.add(c.slug);
    }
  } catch (err) {
    console.warn("Warning: Could not parse categories.json:", err.message);
  }
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/;
const VALID_STAGES = new Set(["finished", "wip", "adoption"]);
const VALID_DIFFICULTY = new Set(["beginner", "intermediate", "advanced"]);
const VALID_AI_INVOLVEMENT = new Set(["high", "medium", "low"]);

export function validateProjectJson(data, filename = "project.json") {
  const errors = [];

  // Required fields
  if (!data.slug || typeof data.slug !== "string") {
    errors.push("Missing or invalid 'slug'");
  } else {
    if (!SLUG_REGEX.test(data.slug)) {
      errors.push(`'slug' "${data.slug}" must be lowercase alphanumeric with hyphens`);
    }
    if (data.slug.length < 2 || data.slug.length > 60) {
      errors.push(`'slug' length must be between 2 and 60 characters`);
    }
    const baseName = path.basename(filename, ".json");
    if (baseName !== "project" && baseName !== "_template" && baseName !== data.slug) {
      errors.push(`Filename '${filename}' does not match slug '${data.slug}'`);
    }
  }

  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    errors.push("Missing or empty 'name'");
  } else if (data.name.length > 80) {
    errors.push("'name' exceeds 80 characters");
  }

  if (!data.tagline || typeof data.tagline !== "string" || data.tagline.trim().length === 0) {
    errors.push("Missing or empty 'tagline'");
  } else if (data.tagline.length > 140) {
    errors.push("'tagline' exceeds 140 characters");
  }

  if (!data.description || typeof data.description !== "string" || data.description.trim().length === 0) {
    errors.push("Missing or empty 'description'");
  } else if (data.description.length > 5000) {
    errors.push("'description' exceeds 5000 characters");
  }

  if (!data.repoUrl || typeof data.repoUrl !== "string") {
    errors.push("Missing 'repoUrl'");
  } else if (!GITHUB_REPO_REGEX.test(data.repoUrl)) {
    errors.push(`'repoUrl' "${data.repoUrl}" must be a public GitHub URL (https://github.com/owner/repo)`);
  }

  if (!data.categorySlug || typeof data.categorySlug !== "string") {
    errors.push("Missing 'categorySlug'");
  } else if (validCategories.size > 0 && !validCategories.has(data.categorySlug)) {
    errors.push(`'categorySlug' "${data.categorySlug}" is not in categories.json`);
  }

  if (!data.stage || typeof data.stage !== "string" || !VALID_STAGES.has(data.stage)) {
    errors.push(`'stage' must be one of: finished, wip, adoption`);
  }

  // Optional fields validation
  if (data.licenseSpdx !== undefined && data.licenseSpdx !== null && typeof data.licenseSpdx !== "string") {
    errors.push("'licenseSpdx' must be a string or null");
  }

  if (data.tags !== undefined && data.tags !== null) {
    if (!Array.isArray(data.tags)) {
      errors.push("'tags' must be an array of strings");
    } else if (data.tags.length > 10) {
      errors.push("'tags' may have at most 10 items");
    }
  }

  if (data.stack !== undefined && data.stack !== null && !Array.isArray(data.stack)) {
    errors.push("'stack' must be an array of strings");
  }

  if (data.difficulty !== undefined && data.difficulty !== null && !VALID_DIFFICULTY.has(data.difficulty)) {
    errors.push("'difficulty' must be beginner, intermediate, advanced, or null");
  }

  if (data.aiInvolvement !== undefined && data.aiInvolvement !== null && !VALID_AI_INVOLVEMENT.has(data.aiInvolvement)) {
    errors.push("'aiInvolvement' must be high, medium, low, or null");
  }

  if (data.isTemplate !== undefined && typeof data.isTemplate !== "boolean") {
    errors.push("'isTemplate' must be boolean");
  }

  return errors;
}

// CLI execution
const target = process.argv[2];
if (target) {
  const targetPath = path.resolve(process.cwd(), target);
  let filesToValidate = [];

  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      filesToValidate = fs.readdirSync(targetPath).filter((f) => f.endsWith(".json")).map((f) => path.join(targetPath, f));
    } else if (targetPath.endsWith(".json")) {
      filesToValidate = [targetPath];
    }
  }

  if (filesToValidate.length === 0) {
    console.error(`No JSON files found at: ${target}`);
    process.exit(1);
  }

  let hasErrors = false;
  for (const file of filesToValidate) {
    try {
      const content = JSON.parse(fs.readFileSync(file, "utf8"));
      const errors = validateProjectJson(content, path.basename(file));
      if (errors.length > 0) {
        hasErrors = true;
        console.error(`❌ ${path.basename(file)}:`);
        for (const e of errors) console.error(`   - ${e}`);
      } else {
        console.log(`✓ ${path.basename(file)} is valid.`);
      }
    } catch (err) {
      hasErrors = true;
      console.error(`❌ ${path.basename(file)}: JSON parse error: ${err.message}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log(`\nAll ${filesToValidate.length} file(s) passed validation.`);
  }
}
