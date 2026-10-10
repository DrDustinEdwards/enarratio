// StrykerJS mutation baseline (docs/research/baseline.md). Not a dependency: install per run with
//   npm install --no-save @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1
// (10.0.0 has a Babel 8 parser bug), then run one chunk at a time:
//   CHUNK=plot npx stryker run stryker.config.mjs

/** Each chunk mutates one part of src, so a restart loses at most one chunk. */
const CHUNKS = {
  enhance: ["src/enhance/**/*.ts"],
  plot: ["src/plot/**/*.ts"],
  primitives: ["src/primitives/**/*.ts"],
  render: ["src/render/**/*.ts"],
  science: ["src/science/**/*.ts"],
  theme: ["src/theme/**/*.ts", "src/themes/**/*.ts", "src/html.ts", "src/index.ts"],
};

const chunk = process.env.CHUNK ?? "";
const mutate = CHUNKS[chunk];
if (!mutate) throw new Error(`Set CHUNK to one of: ${Object.keys(CHUNKS).join(", ")}`);

export default {
  testRunner: "vitest",
  // related: false runs every test file. The default runs only files that import the mutated file,
  // which misses the tests that reach src through examples, the worker or a dynamic import.
  vitest: { configFile: "vitest.stryker.config.ts", related: false },
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [...mutate, "!**/*.d.ts"],
  coverageAnalysis: "perTest",
  disableBail: true,
  ignoreStatic: true,
  concurrency: 4,
  timeoutMS: 30000,
  incremental: true,
  incrementalFile: `reports/mutation/${chunk}.incremental.json`,
  reporters: ["json", "progress"],
  jsonReporter: { fileName: `reports/mutation/${chunk}.json` },
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};
