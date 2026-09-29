# 0006. API shape, errors, dependencies and tests

Status: accepted, 2026-09-28.

## Author's decisions

"TypeScript in strict mode, fully typed public API, no any; a small,
deliberate, well-named API designed before it is built; no dead code."
"Tests: unit tests on every chart and primitive, rendering tests on the server
output, accessibility tests, and visual regression snapshots of the gallery in
light and dark. CI runs them all on every push." "Dependencies pinned and
minimal."

## API shape (implementation choices)

- **One function per chart, one options object each, one string back.** Names
  say what is drawn: `barChart`, `lineChart`, `titerPlot`, `genomeTrack`.
  Options objects let fields be added without breaking callers.
- **Fields are named by key, and typed against the data.** `x: "year"` is
  checked by TypeScript to be a key of the row type whose values suit the
  axis (`KeysOfType<T, string | number>`), so a typo or a wrong-typed field is
  a compile error, not an empty chart.
- **`alt` is required** on every chart, and throws if blank.
- **Errors are thrown, never swallowed, and name the chart, row and field.**
  A missing value, a non-finite number, an unknown series, an unsorted
  threshold, a ninth series or a Plot warning all throw. `checkTheme` is the
  one function that reports instead, because which findings block a build is
  the site's decision.
- **The enhancement layer is a second entry point** (`enarratio/enhance`), so
  server code never imports browser code or the reverse.

## Dependencies

| Package | Why |
|---|---|
| `@observablehq/plot` | Scales, axes and marks, drawn as SVG (author's decision). |
| `d3-force` | The network layout (author's decision). Already a transitive dependency of Plot. |
| `linkedom` | A DOM for Plot outside the browser, which works in Workers. |

All three are pinned to exact versions, as are the development tools, and the
lockfile is committed. Development tools are kept to one of each kind:
TypeScript, Biome (lint and format), Vitest (tests), Puppeteer (one headless
browser for accessibility, interaction and visual tests), axe-core, and
pixelmatch with pngjs (image comparison).

## Tests

| Suite | What it proves | Where |
|---|---|---|
| Unit | Each chart, primitive, statistic and color function behaves and fails as documented | `test/*.test.ts` |
| Rendering | The server output of every gallery example is exactly the stored markup, well-formed, named, and free of scripts | `test/render.test.ts`, `test/__snapshots__/render/` |
| Documentation | Every public export is documented | `test/docs.test.ts` |
| Accessibility | axe-core finds no WCAG 2.2 A or AA or best-practice violations on the gallery, in both themes, light and dark, with and without script | `test/browser/a11y.test.ts` |
| Interaction | Keyboard, pointer, legend, brush, update and destroy work in Chrome | `test/browser/enhance.test.ts` |
| Visual | Every example in both themes, light and dark, matches a stored image | `test/browser/visual.test.ts` |

Continuous integration runs all of them on every push and pull request.
Visual images are stored per platform; CI's Linux images are produced by the
"Visual snapshots" workflow for review, never committed automatically.
