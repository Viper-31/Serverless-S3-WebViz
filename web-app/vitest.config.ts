import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig(async (configEnv) => {
  const loadedViteConfig = await (typeof viteConfig === "function"
    ? viteConfig(configEnv)
    : viteConfig);
  return mergeConfig(loadedViteConfig, {
    test: {
      environment: "node",
      include: [
        "test/**/*.{test,spec}.ts",
        "src/**/__tests__/**/*.test.ts",
        "src/**/*.{test,spec}.ts",
      ],
      globals: false,

      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        all: true,
        include: ["src/**/*.{ts,tsx}"],
      },
    },
  });
});
