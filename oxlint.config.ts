import { defineConfig } from "oxlint";
import { base, node, ignorePatterns } from "@dustinedwards/devkit/oxlint";

export default defineConfig({
  extends: [base],
  // Oxlint does not carry ignorePatterns through extends. Snapshots and the built gallery are output.
  ignorePatterns: [...ignorePatterns, "**/__snapshots__/", "site/dist/"],
  overrides: [
    { files: ["scripts/**", "test/**"], ...node },
    // The browser tests build the page's own import() with new Function, so the test runner does not rewrite it.
    { files: ["test/browser/**"], rules: { "typescript/no-implied-eval": "off" } },
  ],
});
