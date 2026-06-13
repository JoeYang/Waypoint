import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Cross-package imports resolve to TypeScript source so tests run without a build.
// Mirrors the published package names; keep in sync with the workspace packages.
export default defineConfig({
  resolve: {
    alias: {
      "@waypoint/shared": fromRoot("./packages/shared/src/index.ts"),
      "@waypoint/core": fromRoot("./packages/core/src/index.ts"),
      "@waypoint/server": fromRoot("./packages/server/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      exclude: ["**/dist/**", "**/*.{test,spec}.{ts,tsx}"],
    },
  },
});
