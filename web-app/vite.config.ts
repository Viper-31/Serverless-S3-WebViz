import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Use subpath ONLY when building in GitHub Actions, otherwise use root locally.
  base: command === "build" && process.env.CI ? "/Serverless-S3-WebViz/" : "/",
}));
