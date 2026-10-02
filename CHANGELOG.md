# Changelog

All notable changes to Enarratio (named Abscissa until 0.1.0-alpha.7) are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Before 1.0.0, a minor version may
change the public API; every such change is listed here.

## [Unreleased]

Becomes 0.2.0. Design records 0011 onward explain each decision.

### Breaking

- **The root import is core only.** Every chart moved to a subpath; markup,
  class names, custom properties, options and return values are unchanged, so
  stored rendered charts stay valid and only import lines change:

  ```ts
  // before
  import { barChart, lineChart, areaChart, scatterPlot, heatmap } from "enarratio";
  // after
  import { barChart, lineChart, areaChart, scatterPlot, heatmap } from "enarratio/plot";

  // before
  import { genomeTrack, titerPlot, geometricSummary, networkChart } from "enarratio";
  // after
  import { genomeTrack, titerPlot, geometricSummary, networkChart } from "enarratio/science";

  // before
  import { defaultTheme } from "enarratio";
  // after
  import { defaultTheme } from "enarratio/themes";
  ```

  The types moved with their functions (`BarChartOptions` with `barChart`,
  `LineChartOptions`, `SeriesChartOptions`, `ReferenceLine` and `EventMarker` with
  `lineChart`, `GenomeFeature` with `genomeTrack`, and so on). `sparkline`,
  `progressRing`, `uptimeStrip`, `stylesheet`, `defineTheme`, `checkTheme`, the
  color functions, the theme types and `enhance` stay where they were.
- **`@observablehq/plot`, `d3-force` and `linkedom` are optional peer
  dependencies, not dependencies.** Install what the entries you import need:
  `enarratio/plot` needs `@observablehq/plot` and `linkedom`; `enarratio/science`
  needs `@observablehq/plot`, `d3-force` and `linkedom`. A site using only core
  installs none of them. The versions tested are ranges `^0.6.17`, `^3.0.0` and
  `^0.18.13`.

### Added

- `lineChart` `band` (`lower` and `upper` fields drawn as a shaded area behind
  each line), `forecastFrom` (the line dashed after an x, points hollow, a
  labelled rule at the boundary) and `forecastLabel`. The data table marks
  forecast rows in a `Forecast` column and carries the band's bounds as
  columns. The caller computes the forecast; Enarratio only draws it (design
  record 0013).
- `barChart` time axis: `xType: "time"` with `interval` (`hour`, `day`, `week`,
  `month`, `year`) and `formatX`. One bar slot per interval from the first row
  to the last, labelled automatically; works for stacked, grouped and
  horizontal bars.
- `timeline` (core): an event timeline with a lane for each site or agent,
  spans and point events over a time window, status by color and shape, and a
  plain list that replaces the drawing under 30rem of room. `heatStrip` (core):
  a one-row, no-axis strip on the sequential ramp, a sibling of `uptimeStrip`
  (design record 0014).
- `enarratio/plot`, `enarratio/science` and `enarratio/themes` entry points.
- `baseStylesheet()` and `enarratio/base.css`: the theme-free rules.
- Every fixed size, weight, radius and animation timing in the CSS is a custom
  property with today's value as its fallback (`--enarratio-font-size-mark`,
  `--enarratio-font-size`, `--enarratio-radius`, `--enarratio-duration-*` and
  the rest); the contract is in docs/api.md and design record 0011. Rendered
  output is unchanged for anyone who sets none.
- Core exports the pieces charts are built from: `escapeHtml`, `element`,
  `figure`, `validateFigure`, `slotStyle` and their types.
- A `browser` export condition drops `linkedom` where a real document exists;
  Worker, Node.js, Deno and Bun builds keep it (design record 0012).
- CI: `npm run size` reports each entry's gzipped size and fails if core gains
  a runtime dependency.

## [0.1.0-alpha.8] - 2026-09-29

### Changed

- The rename reaches the code and the markup (design record 0010). Every
  name that carried `abscissa` now carries `enarratio`; a page that styles or
  listens for the old names needs the new ones:
  - the figure's `class="enarratio"` and its `data-enarratio` chart type;
  - every `data-abscissa-*` attribute, now `data-enarratio-*` (for example
    `data-enarratio-mark`, `data-enarratio-key`, `data-enarratio-x`,
    `data-enarratio-series`, `data-enarratio-enhanced`);
  - every `abscissa-*` class, now `enarratio-*` (for example
    `enarratio-frame`, `enarratio-legend`, `enarratio-tooltip`,
    `enarratio-visually-hidden`), and the `enarratio-grow`, `enarratio-draw`
    and `enarratio-fade` animations;
  - every `--abscissa-*` custom property, now `--enarratio-*`;
  - the `abscissa:select` and `abscissa:brush` events, now `enarratio:select`
    and `enarratio:brush`.
  No exported function or type changed its name.
- The repository is `DrDustinEdwards/enarratio` and the gallery is at
  `https://enarratio.dustinedwards.info`; the old gallery address redirects to
  the new one with a 301. The code of conduct's contact is
  `enarratio@dustinedwards.info`.

## [0.1.0-alpha.7] - 2026-09-29

### Changed

- Renamed from Abscissa to Enarratio. The npm package is now `enarratio`;
  `abscissa` is unpublished. Enarratio is the Roman
  grammarian's reading aloud and explanation of a text, which is what the
  toolkit does for a figure: it renders it on the server and explains it to
  people, screen readers and AI agents. This release is the alpha.6 code under
  the new package name, published first to reserve it; the names inside the
  code (the `data-abscissa-*` attributes, CSS classes and custom properties)
  and the rest of the repository are renamed in the next release.

## [0.1.0-alpha.6] - 2026-09-28

Fixes for the findings of two independent AI reviews of pull request #1
(Fable 5.1: A1 to A17; Claude Opus 5.5: F1 to F23). Each fix has a
regression test named for its finding; design record 0009 explains the
decisions. F21, A17 and F23 (JOSS history and the paper) are deferred.

### Added

- `barChart` `directLabels`: series names inside the stacked segments they
  fit in (A1).
- `EnhancedChart.options`: the options a chart was enhanced with (F18).
- `alt` on `progressRing` and `uptimeStrip`, as on every chart and on
  `sparkline`; `label` becomes optional when `alt` is given (F18).
- A range can be picked by clicking the plot twice, without dragging (A4).
- Invisible 24 CSS pixel pointer targets around small marks (A5).
- `checkTheme` measures the contrast of labels printed on every series and
  ramp color (`label-contrast`) (F8).
- The gallery: an http-to-https redirect in its own Worker,
  `Strict-Transport-Security`, `Permissions-Policy`, and a split `style-src`
  (A14, F16). Hosted at https://abscissa.dustinedwards.info, with a
  Content-Security-Policy, a 404 page, `npm run deploy:gallery`, and a
  workflow that deploys on pushes to `main`. Its policy allows Cloudflare Web
  Analytics, which the zone injects.
- CI runs the unit tests on Node.js 20, 22 and 24 (A16).

### Changed

- The default theme's series palette: series 1 to 6 now differ by at least 10
  CIEDE2000 units under every simulated color vision, in light and dark (A1).
- Mark keys are JSON arrays (`["2022","Talks"]`) and are opaque (A9, F14).
- Marks carry `data-abscissa-col` and `data-abscissa-row`, and keyboard order
  follows them rather than SVG geometry (F9).
- Labels on marks use black or white when neither the scheme's text nor its
  background color reaches 4.5:1 (F8).
- The focus ring is two rings, background inside focus color, drawn around the
  focused mark (F7).
- Escape hides the tooltip as well as clearing; the tooltip stays while the
  pointer is over it (F6).
- `update()` parses its markup inertly and keeps only what Abscissa emits (F11).
- Calling `enhance()` again with different options re-applies them (F18).
- Axis groups are `aria-hidden` (A12).
- Wide charts keep at least 30rem and scroll sideways on narrow screens, inside
  a new `div.abscissa-frame` around the SVG (A13).
- Count axes end at their last whole-number tick (A2).
- Local-midnight Dates are read as calendar dates (A3); sub-daily time series
  work and their labels include the UTC time (F3); years print without a
  thousands separator (F4).
- A progress ring past its total prints its real percentage and says so (A7).
- A number and its text (2022 and "2022") are one category (A8).
- Gallery pages link their stylesheet and script as files; the scheme button
  starts in the state shown (F17).

### Fixed

- Clicking a mark on a line, area or scatter chart with a real pointer did
  nothing (F1).
- A log-axis line chart silently dropped values of zero or less; it now throws
  (F2).
- Area chart gaps were drawn and described as zero (F5).
- A label containing the warning glyph made a chart throw (F13).
- Theme names, fonts and scheme selectors could break out of the stylesheet
  (F10, A10).
- `update()` could run script from the markup it was given (F11).
- Protocol-relative `//host` links were accepted by `href` (A11).
- Empty bar data, all-empty series, non-positive sizes, prototype-named uptime
  statuses and dilution factors too fine for an axis are now errors; very long
  sparklines no longer overflow the stack (A7, F15).
- The render tests' timeout suits a cold start (A15); visual tests are skipped,
  not failed, on platforms with no stored images (F20).

### Deprecated

- Nothing was renamed: `label` keeps its meaning on the primitives (what is
  measured), and `alt` is added as the text alternative everywhere (F18).

### Documentation

- The API reference covers `xType: "time"` for epoch milliseconds, heatmap
  filtering by row, the single-series names used by `colors`, key opacity,
  the `update()` markup contract, and pointer behavior (A16, F18, F11).
- The README's five-minute page sets `color-scheme`, explains loading the
  enhancement layer without a bundler, and marks Deno and Bun as untested
  (F19, A16).
- The AI usage record and the paper's disclosure give the true order of
  events and the exact models (F22).

## [0.1.0-alpha.5] - 2026-09-28

From the interactive CV's integration of alpha.4.

### Fixed

- A filter on the series field (from `setFilter` or a legend entry) on a
  `filterBy: "x"` chart dimmed every bar. It now emphasizes that series and
  presses its legend entry.
- `update()` dropped keyboard focus, so Escape then did nothing. It now keeps
  the tab stop and focus on the mark with the same key, or the first mark of
  the same category, or the nearest one.

## [0.1.0-alpha.4] - 2026-09-28

From the first customer's integration (the interactive CV).

### Added

- `barChart` `filterBy: "x"` filters by a bar's category (its year) instead of
  its series.
- `barChart` `href` makes each bar a link when scripts are off; enhanced, it
  filters instead and keeps the link in `data-abscissa-href`.
- `barChart` `maxXTicks` thins category labels for small drawings.
- `EnhancedChart.setFilter()` shows a filter the page chose.

### Changed

- `update()` and `clear()` no longer fire `abscissa:select` or
  `abscissa:brush`: calls the page makes are not echoed back to it. Escape,
  pressed by a reader, still fires them.

## [0.1.0-alpha.3] - 2026-09-28

The first complete version, for review.

### Added

- Charts: `lineChart` (time or numeric x, gaps, reference lines, event
  markers, direct labels, log y), `areaChart` (stacked), `scatterPlot` (log
  axes, symbols per series, regression with 95% band), `heatmap` (sequential
  ramp, labelled bins, printed values, outlined empty cells) and
  `networkChart` (deterministic force layout with d3-force).
- Scientific charts: `titerPlot` (dilution axis, GMT with 95% CI, limit of
  detection) and `genomeTrack` (strand arrows, tracks, lane packing), with
  `geometricSummary` exported.
- Primitives: `progressRing` and `uptimeStrip`.
- Themes: a sequential ramp and status colors in every scheme, and readable
  text colors for labels printed on marks.
- Tests: stored server output of every example, axe-core audits of the
  gallery with and without scripts, visual comparison, brush and update tests,
  a documentation completeness test, and CIEDE2000 against published pairs.
- Documentation: the API reference, design records, AI usage record,
  contributing guide, code of conduct, security policy, citation metadata and
  a draft JOSS paper.

## [0.1.0-alpha.2] - 2026-09-28

### Fixed

- The package builds itself when installed from git (`prepare` replaces
  `prepack`, and still runs before `npm pack` and `npm publish`).

## [0.1.0-alpha.1] - 2026-09-28

### Added

- `abscissa/enhance`: the enhancement layer. `enhance()` adds hover and focus
  details, keyboard navigation (arrow keys by column and through a stack,
  Home, End, Enter, Space, Escape), click-to-filter from marks and legend
  entries (`abscissa:select` events), a range brush on continuous axes
  (`abscissa:brush`), animated `update()`, an entrance animation and a live
  region for screen readers. Motion is off under `prefers-reduced-motion`.
- The gallery (`npm run gallery`) and browser tests of the enhancement layer.

### Changed

- Bar chart value axes are labelled along the axis; count axes use whole
  numbers.

## [0.1.0-alpha.0] - 2026-09-28

First release, published to reserve the package name while the first version
is built. In active development: the API will change.

### Added

- `barChart`: server-rendered bar chart, single series or stacked or grouped
  series, vertical or horizontal, counting rows when no value field is given.
- `sparkline`: word-sized line chart with a generated text alternative.
- Themes: the `Theme` type, `defineTheme`, `stylesheet`, `defaultTheme` and
  `dustinedwardsTheme`.
- `checkTheme`: WCAG contrast and color-vision-deficiency checks for a theme.

[Unreleased]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.6...HEAD
[0.1.0-alpha.6]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/DrDustinEdwards/abscissa/compare/v0.1.0-alpha.0...v0.1.0-alpha.1
[0.1.0-alpha.0]: https://github.com/DrDustinEdwards/abscissa/releases/tag/v0.1.0-alpha.0
