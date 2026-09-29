import { defineConfig } from "vitest/config";

// Browser tests drive one headless Chrome against the built gallery (npm run build, then
// npm run gallery). Files run one at a time: the gallery server and browser are shared per file.
export default defineConfig({
  test: {
    include: ["test/browser/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
