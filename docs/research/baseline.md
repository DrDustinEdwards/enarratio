# Enarratio test baseline (job_2e1907aaaf7a)

Measured 2026-10-10 at commit f613468 (main), using Foxhound's method
(foxhound `docs/research/baseline.md`). Linux container, 4 cores, Node 22.22.0.
This is measurement only. No test or source file was deleted or changed, and
package.json and the lockfile are untouched (StrykerJS is installed per run with
`--no-save`). The work added the Stryker config, the report script, this file and
the kill matrix.

## The suite

| What | Command | Result |
|------|---------|--------|
| Unit and render tests | `npx vitest run` | 17 files, 444 tests passed. 6.3 s in Vitest, 7.4 s wall |
| Browser tests | `npm run build && npm run gallery`, then `npm run test:browser` | 5 files, 42 tests. CI (main, run 38025026410): passed, 25 s for the test step, 44 s for the job. Locally 38 passed and the 4 visual tests failed, because the container's Chromium build renders differently from the one the stored Linux images came from. About 60 s locally, plus 4 s to build the package and gallery |
| Test declarations | `grep` over `it(`, `test(`, `it.each(` | 197 in the unit files and 31 in the browser files. `it.each` expands them to 444 and 42 at run time |
| Lines of code | `npx cloc@2.6.0 <dir>` | src 5,019 code lines (32 files), test 3,491 (24 files, browser included), examples 480 (19), scripts 399 (5, including the new report script), site 20, worker 16 |
| Stored output | `test/__snapshots__/render`, `test/browser/__snapshots__/linux` | 18 stored HTML renderings, 72 stored PNG images |

The browser tests drive the built gallery (`dist` and `site/dist`), not `src`, so
Stryker cannot run them against a mutant. They are outside the mutation run and
outside the kill matrix.

## Mutation testing (StrykerJS)

StrykerJS 9.6.1 with `@stryker-mutator/vitest-runner` 9.6.1 (10.0.0 has a Babel 8
parser bug). Config: `stryker.config.mjs` and `vitest.stryker.config.ts`, with
`coverageAnalysis: perTest`, `disableBail: true` (so every killing test is
recorded), `ignoreStatic: true`, concurrency 4, and `vitest.related: false`. The
runner's default (`related: true`) runs only test files that import the mutated
file, which silently dropped `docs.test.ts`, `render.test.ts` and
`worker.test.ts` (131 tests) in a first attempt. That attempt was discarded.

Mutated: every `.ts` file in `src`, in six chunks, run one at a time. Each chunk's
JSON report and incremental file went to the branch
`results/enarratio-mutation-baseline` (`chunks/`) as soon as the chunk finished.

| Chunk | Files | Time |
|-------|-------|------|
| render | `src/render/**` | 1,103 s |
| science | `src/science/**` | 594 s |
| theme | `src/theme/**`, `src/themes/**`, `src/html.ts`, `src/index.ts` | 307 s |
| primitives | `src/primitives/**` | 792 s |
| plot | `src/plot/**` | 1,355 s |
| enhance | `src/enhance/**` | 4,171 s |
| Total | 27 files with mutants | 8,322 s (2 h 19 min) |

To reproduce: install Stryker as above, `CHUNK=<name> npx stryker run
stryker.config.mjs` for each chunk, then `node scripts/report-mutation.mjs --json
docs/research/kill-matrix.json`.

### Score

| Status | Mutants |
|--------|---------|
| Killed | 3,477 |
| Timeout (counted as killed) | 34 |
| Survived | 1,776 |
| No coverage | 150 |
| Ignored (static) | 58 |
| Valid (killed, timeout, survived, no coverage) | 5,437 |

- **Mutation score: 64.58%** (3,511 of 5,437).
- Score over covered code: 66.41%.
- **Without `src/enhance`: 79.18%** (3,511 of 4,434). The enhancement layer
  has 1,003 mutants and the unit suite kills none of them. It runs in the
  browser, and the browser suite, which does exercise it, cannot run under
  Stryker. Read the overall score with that in mind.

### Per file

| File | Killed | Timeout | Survived | No coverage | Score |
|---|---|---|---|---|---|
| src/enhance/index.ts | 0 | 0 | 1003 | 0 | 0% |
| src/html.ts | 22 | 0 | 8 | 1 | 70.97% |
| src/plot/bar.ts | 381 | 18 | 41 | 18 | 87.12% |
| src/plot/heatmap.ts | 131 | 0 | 14 | 3 | 88.51% |
| src/plot/line.ts | 506 | 4 | 84 | 8 | 84.72% |
| src/plot/scatter.ts | 119 | 0 | 29 | 4 | 78.29% |
| src/primitives/companion.ts | 4 | 0 | 0 | 0 | 100% |
| src/primitives/heat-strip.ts | 139 | 0 | 18 | 1 | 87.97% |
| src/primitives/progress-ring.ts | 131 | 0 | 25 | 2 | 82.91% |
| src/primitives/sparkline.ts | 151 | 0 | 19 | 1 | 88.3% |
| src/primitives/timeline.ts | 401 | 7 | 70 | 10 | 83.61% |
| src/primitives/uptime-strip.ts | 121 | 0 | 33 | 1 | 78.06% |
| src/render/data.ts | 123 | 2 | 48 | 3 | 71.02% |
| src/render/document.browser.ts | 0 | 0 | 0 | 9 | 0% |
| src/render/document.ts | 2 | 0 | 0 | 0 | 100% |
| src/render/figure.ts | 146 | 0 | 14 | 1 | 90.68% |
| src/render/plot.ts | 119 | 0 | 38 | 27 | 64.67% |
| src/render/series.ts | 27 | 0 | 3 | 1 | 87.1% |
| src/science/genome.ts | 275 | 1 | 42 | 17 | 82.39% |
| src/science/network.ts | 116 | 1 | 24 | 17 | 74.05% |
| src/science/stats.ts | 45 | 0 | 4 | 1 | 90% |
| src/science/titer.ts | 202 | 1 | 32 | 5 | 84.58% |
| src/theme/check.ts | 62 | 0 | 50 | 6 | 52.54% |
| src/theme/color.ts | 183 | 0 | 75 | 5 | 69.58% |
| src/theme/define.ts | 42 | 0 | 30 | 8 | 52.5% |
| src/theme/stylesheet.ts | 29 | 0 | 72 | 1 | 28.43% |
| src/themes/default.ts | 0 | 0 | 0 | 0 | n/a |

`src/render/document.browser.ts` is the browser build of the document helper; Node
tests never load it. `src/index.ts`, `src/plot/index.ts`, `src/science/index.ts`
and `src/themes/index.ts` are re-exports with no mutants. The `src/theme/` files
score low partly because of the measurement gap described under the kill matrix:
the stylesheet tests build the stylesheet once, outside any test.

## Per-test kill matrix

`docs/research/kill-matrix.json` has, for each of the 444 unit tests (keyed by
file and test name): `covers` (mutants it executes), `kills`, `uniqueKills`
(mutants no other test kills), `candidate` (`zero-kill`, `covered-by-others` or
null), `protected` and `designPinning`. It also has the per-file table above. The
raw chunk reports are on the results branch.

262 tests kill at least one mutant; 1,253 mutants are killed by exactly one test.

| Group | Tests | Of which protected |
|-------|-------|--------------------|
| Zero-kill (kills no mutant) | 182 | 3 |
| Covered by others (every kill is also made by another test) | 177 | 109 |
| Unprotected zero-kill | 179 | |
| Unprotected covered by others | 68 | |

Protected means the file or test name matches the keep rules in
`scripts/report-mutation.mjs`: hostile input and escaping, injection and unsafe
values, accessibility, and tests named for a review finding (A1 to A17, F1 to
F23) or a fixed bug. Of the protected candidates, 80 are the whole of
`hostile.test.ts` and 26 are in `review.test.ts`. The match is a name heuristic that errs toward keeping.
Protected tests are never removal candidates.

### Every zero-kill test covers no mutant

All 182 zero-kill tests execute no mutated code inside the test body as Stryker
sees it. That has two causes, and neither shows the test is useless:

1. **The test checks something other than `src` behavior (103 tests).**
   `docs.test.ts` (92) checks that `docs/api.md` documents every public name,
   `package.test.ts` (8) checks package.json and the built entries, and
   `worker.test.ts` (3) checks the gallery worker. Mutating `src` cannot make
   these fail, by design.
2. **The test does its work outside the test body (79 tests).** Per-test coverage
   only sees code that runs inside an `it`. These describe blocks build their
   chart once in the describe scope (`const fig = parse(lineChart(...))`) and the
   tests only query it: `theme.test.ts` (41: the stylesheet and the custom
   property contract), `timeline.test.ts` (11), `forecast.test.ts` (7),
   `companions.test.ts` (2). In `render.test.ts` the 18 "is well-formed and every
   svg is named" tests import an example module that the stored-markup test
   already imported, so the rendering is credited to that test. Stryker never
   runs these 79 tests against a mutant, so their kills are unmeasured, and some
   of the survivors in the files they cover would likely be killed if they ran.

## Design-pinning tests (listed separately)

These pin exact rendered output, markup or pixels. They are not removal
candidates; any change to them is a design decision.

| Tests | Suite | Pins | In the matrix |
|-------|-------|------|---------------|
| 18 "renders the stored markup" in `test/render.test.ts` | unit | The full server markup of each gallery example against `test/__snapshots__/render/*.html` | Yes. They carry the most unique kills in the suite (744 of 1,253; `genome.ts` alone 153, `timeline.ts` 136), so none is a candidate |
| 4 "matches the stored images" in `test/browser/visual.test.ts` | browser | Every gallery example in each theme and color scheme, pixel by pixel against 72 PNGs in `test/browser/__snapshots__/linux` (30 pixels tolerated) | No (browser) |

The rest of the browser suite (axe checks, keyboard, pointer and tooltip
behavior in `a11y`, `enhance`, `review` and `timeline`) asserts behavior, not
pixels, and is the only coverage `src/enhance` has.

## Removal candidates (nothing removed)

247 unprotected candidates: 179 zero-kill and 68 covered by others. By file:

| Test file | Tests | Zero-kill | Covered by others | Protected candidates | Design-pinning |
|---|---|---|---|---|---|
| test/docs.test.ts | 92 | 91 | 0 | 1 | 0 |
| test/theme.test.ts | 60 | 41 | 7 | 0 | 0 |
| test/render.test.ts | 36 | 18 | 0 | 0 | 18 |
| test/timeline.test.ts | 22 | 11 | 3 | 0 | 0 |
| test/companions.test.ts | 17 | 2 | 11 | 0 | 0 |
| test/bar.test.ts | 17 | 0 | 11 | 2 | 0 |
| test/bar-time.test.ts | 13 | 0 | 9 | 0 | 0 |
| test/science.test.ts | 12 | 0 | 8 | 0 | 0 |
| test/forecast.test.ts | 15 | 7 | 1 | 0 | 0 |
| test/package.test.ts | 9 | 7 | 0 | 1 | 0 |
| test/line.test.ts | 9 | 0 | 6 | 1 | 0 |
| test/charts.test.ts | 10 | 0 | 5 | 0 | 0 |
| test/primitives.test.ts | 8 | 0 | 5 | 0 | 0 |
| test/sparkline.test.ts | 6 | 0 | 2 | 0 | 0 |
| test/worker.test.ts | 3 | 2 | 0 | 1 | 0 |
| test/hostile.test.ts | 80 | 0 | 0 | 80 | 0 |
| test/review.test.ts | 35 | 0 | 0 | 26 | 0 |

How to read this before any pruning job uses it:

- **The zero-kill list is not a deletion list.** Every one of the 179 is in one
  of the two groups above. 103 guard docs, packaging and the worker, which
  mutation testing cannot measure. The other 79 were never run against a mutant
  because of where their setup sits. Moving the describe-scope setup into
  each test (or a `beforeEach`) and re-running would measure them. Without that,
  none of them should be cut on this evidence.
- **The 68 covered-by-others are the real candidates**, and they are per test,
  not joint: two tests that only cover each other are both flagged, and removing
  both loses kills. Re-run Stryker (or at least re-check the matrix) after each
  batch.
- **Survived mutants point the other way.** 1,776 survive. 1,003 are in
  `src/enhance` (browser-only tests), and the rest are concentrated in
  `src/theme/stylesheet.ts` (72), `src/theme/color.ts` (75), `src/plot/line.ts`
  (84), `src/primitives/timeline.ts` (70) and `src/theme/check.ts` (50). Pinning
  that behavior is worth more than trimming.
- The 4 visual tests and the 18 stored-markup tests are design-pinning and stay
  unless the design changes.

Nothing was deleted or changed in `src` or in the tests.
