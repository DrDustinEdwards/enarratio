import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

/**
 * The unit suite as StrykerJS runs it (docs/research/baseline.md). Same aliases and timeout as
 * vitest.config.ts. Tests that read source files as text are left out: Stryker's rewriting changes
 * that text, so they would fail on every mutant for the wrong reason.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: ["test/browser/**", ...(process.env["STRYKER_EXCLUDE"]?.split(",") ?? [])],
    },
  }),
);
