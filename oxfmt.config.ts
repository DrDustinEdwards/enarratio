import { defineConfig } from "oxfmt";
import { format } from "@dustinedwards/devkit/oxfmt";

export default defineConfig({
  ...format,
  // Snapshots are what the tests compare against, and the built gallery is output.
  ignorePatterns: [...format.ignorePatterns, "**/__snapshots__/", "site/dist/"],
});
