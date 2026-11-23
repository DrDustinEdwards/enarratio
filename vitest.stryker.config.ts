import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

/**
 * The unit suite as StrykerJS runs it (stryker.config.mjs). Same aliases and timeout as
 * vitest.config.ts, without the browser suite.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: ["test/browser/**"],
    },
  }),
);
