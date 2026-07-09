import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import svelte from "eslint-plugin-svelte";
import svelteConfig from "./svelte.config.js";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,

  ...svelte.configs.recommended.map((config) => ({
    ...config,
    files: config.files ?? ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
  })),
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
        svelteConfig,
      },
    },
  },
  {
    files: [
      "**/*.test.{ts,js}",
      "**/__tests__/**/*.{ts,js}",
      "test/**/*.{ts,js}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
]);
