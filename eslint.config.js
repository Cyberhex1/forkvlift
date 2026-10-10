import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.wrangler/**", "**/node_modules/**", "**/worker-configuration.d.ts", "**/migrations/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "apps/admin/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Clients never touch dev fixtures; they get fixture data through the API in dev.
    files: ["apps/web/**", "apps/admin/**", "packages/ui/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@forkvlift/shared/fixtures", "**/fixtures/**"], message: "Fixtures are dev-only and served by the Worker." }] }],
    },
  },
  {
    // No hard-coded colors in feature code: use packages/ui tokens.
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/admin/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]", message: "Hard-coded color. Use a token class from packages/ui." },
        { selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]", message: "Hard-coded color. Use a token class from packages/ui." },
        { selector: "Literal[value=/\\b(rgb|hsl)a?\\(/]", message: "Hard-coded color. Use a token class from packages/ui." },
      ],
    },
  },
);
