import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Import-direction layering (see .claude/rules/architecture.md):
//   web → shared           server → core → shared           shared → (nothing)
//   core MUST NOT import server, web, or any DB/transport driver.
//
// Cross-package imports are always `@waypoint/<name>` specifiers, so the boundary
// is enforced by matching those (plus any stray relative cross-package path) with
// @typescript-eslint/no-restricted-imports — reliable where element resolution is
// not, given composite project references resolve package names to built dist/.
const forbid = (groups, message) => ({
  "@typescript-eslint/no-restricted-imports": [
    "error",
    { patterns: groups.map((group) => ({ group: [group, `${group}/*`], message })) },
  ],
});

const SERVER = "@waypoint/server";
const WEB = "@waypoint/web";
const CORE = "@waypoint/core";
// Transport/DB/UI drivers core must never touch — keep in sync with packages it adopts.
const DRIVERS = ["pg", "ws", "fastify", "@fastify", "@modelcontextprotocol", "react", "react-dom"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts (plain ESM) — declare the runtime globals they legitimately use.
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly" },
    },
  },
  {
    files: ["packages/shared/src/**/*.{ts,tsx}"],
    rules: forbid(
      [CORE, SERVER, WEB],
      "@waypoint/shared is a leaf — it must not import core, server, or web.",
    ),
  },
  {
    files: ["packages/core/src/**/*.{ts,tsx}"],
    rules: forbid(
      [SERVER, WEB, ...DRIVERS],
      "@waypoint/core must depend only on @waypoint/shared — no server, web, or transport/DB drivers (talk to persistence through ports).",
    ),
  },
  {
    files: ["packages/server/src/**/*.{ts,tsx}"],
    rules: forbid([WEB], "@waypoint/server must not import @waypoint/web."),
  },
  {
    files: ["packages/web/src/**/*.{ts,tsx}"],
    rules: forbid(
      [CORE, SERVER],
      "@waypoint/web must depend only on @waypoint/shared — no core or server.",
    ),
  },
);
