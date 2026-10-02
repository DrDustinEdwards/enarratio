import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const src = resolve(import.meta.dirname, "src");

export default defineConfig({
  // Examples import "enarratio" as a reader would; in tests that means the source, not dist.
  resolve: {
    alias: [
      { find: /^#document$/, replacement: resolve(src, "render", "document.ts") },
      { find: /^enarratio\/enhance$/, replacement: resolve(src, "enhance", "index.ts") },
      { find: /^enarratio\/plot$/, replacement: resolve(src, "plot", "index.ts") },
      { find: /^enarratio\/science$/, replacement: resolve(src, "science", "index.ts") },
      { find: /^enarratio\/themes$/, replacement: resolve(src, "themes", "index.ts") },
      { find: /^enarratio$/, replacement: resolve(src, "index.ts") },
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/browser/**"],
    // A cold first import of Observable Plot can take several seconds on a slow runner (A15).
    testTimeout: 30_000,
  },
});
