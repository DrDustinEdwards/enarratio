# Changelog

All notable changes to Enarratio (named Abscissa until 0.1.0-alpha.7) are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Before 1.0.0, a minor version may
change the public API; every such change is listed here.

## [Unreleased]

### Gallery

- Deployed by devkit's shared deploy (worker-deploy.yml v0.20.18), a `deploy` job in ci.yml after the checks and browser
  tests, in place of gallery.yml. It deploys with `DEPLOY_SHA`, waits for `/health` (site-runtime 0.60.0's `staticSite`) to
  report the commit, checks the home page and rolls back on a refusal; IndexNow runs after it. No package change.

## [0.5.0] - 2026-10-31

Contrast, theming, export and embed from the area 10 verification ([0027](docs/design/0027-contrast-export-and-roles.md)).

### Upgrading from 0.4

- Series names written on the background (direct labels, survival curve labels, at-risk rows) are drawn in each series' new label shade, `--enarratio-series-label-N`, at 4.5:1 (was the series color). A site that sets `--enarratio-*` itself (`base.css`) gets a mix of the series and text colors until it defines them.
- Sequential ramp steps under 3:1 on the background get a 1px edge, `--enarratio-sequential-edge-N`, on heatmap and heat strip cells and ramp legend swatches. On `base.css` alone, steps 1 to 3 get the muted text color as their edge.
- `checkTheme` (and so `stylesheet()`) adds three checks: `series-label-contrast`, `sequential-edge`, and `status.unknown` at 3:1. A theme with a given `seriesLabels` or `sequentialEdges` that falls short now fails; derived ones always pass. A theme whose unknown color is under 3:1 now fails.
- Theme colors are typed `ThemeColor` (hex, or `var(--token, #hex)`), not `HexColor`; code that reads a theme's colors as `HexColor` widens its type. `CheckIssue.colors` stays hex.
- `enhance()` adds "Download SVG" and "Download PNG" beside "Download CSV", and "Copy embed" on a figure with an `id`. Pass `download: false` or `embed: false` to leave them out. New strings: `downloadSvg`, `downloadPng`, `copyEmbed`, `embedCopied`, `exportFailed`.
- The default theme's light unknown gray is #818a94 (was #8c959f, 2.99:1).

### Added

- Theme colors may be a site's own custom property with a hex fallback, `var(--site-token, #hex)`: the stylesheet writes it as given, and `checkTheme` measures the fallback.
- `ColorScheme.seriesLabels` and `ColorScheme.sequentialEdges`, optional: the shades for series names on the background and for the edges of pale ramp steps. Left out, `stylesheet()` derives them.
- `readableShade(color, background, minimum)`: the least darkening or lightening of a color that reaches a contrast.
- `--enarratio-cell-edge-width` (default `1px`).
- Export (C3): "Download SVG" (the drawing with its computed colors and fonts, and the background) and "Download PNG" (the same, on a canvas at twice its size), from the enhancement layer, with no new dependency.
- `maxXTicks` on line and area charts, as on bar charts.
- Embed (C4): "Copy embed" copies `<a href="{page}#{id}">{title}</a>` for a figure with an `id`.
- `enarratio/redraw`: draws a server's bar, line or area chart again at its frame's width in the browser (with `enarratio/lite`), or swaps in a narrow server drawing for any other chart under 30rem, and enhances each drawing. Moved from Prelum's `render/chart-enhance`, so Prelum and Capsomer share one copy: `redrawAttribute(spec)` on the server, `redrawCharts()` in the page.

### Enhancement layer

- Charts read layout together. Each chart used to measure its marks right after the chart before it changed the page, so a page of charts was laid out once per chart; the gallery spent about 450 ms in one task on a throttled phone. Every chart now queues its reads (pointer targets, the points over the marks, line lengths for the entrance) and they run together after the next frame is drawn, when layout is already done, and then all the writes. One resize observer serves every chart, so charts resized together share one layout too. The longest task on the gallery fell to about 170 ms. The pointer targets and the points' places arrive a frame after `enhance()` returns; the marks answer the pointer from the start. No API change.

### Gallery

- The gallery's Worker is site-runtime v0.52.0's `staticSite` in place of its own code (no package change). The https redirect and the report endpoint are the same; every page now carries `Speculation-Rules: "/speculation-rules.json"` (the site's own prefetch rules, in place of Cloudflare's generic ones), `Server-Timing`, and a preload `Link` header for Capsomer's stylesheet, the home page's and Schibsted Grotesk, which Early Hints answers with a 103 (`PAGE_PRELOADS` in `scripts/security-headers.ts`; `scripts/gallery.ts` refuses a build where the home page links a stylesheet it leaves out). The 404 page and a page asked for with a cookie are `private, no-store`, where the 404 was `public, max-age=300`. The fonts no longer run the Worker. `test/worker.test.ts` and the Worker cases in `test/security-headers.test.ts` are removed: the Worker is site-runtime's, tested there. The home page looks the same: screenshots before and after are identical.

### Fixed

- Contrast (B1): network links draw at full strength (were at half opacity, 2.1 to 2.9:1); the donut's hole is painted in the background, and its center label has a background halo, so the label is never read against a slice.
- An axis title that already names its unit is not repeated: `yLabel: "reads"` with `yUnit: "reads"` reads "reads", not "reads (reads)".
- Tick labels use proportional figures (Plot's `font-variant="tabular-nums"` is removed, and the base rules no longer set tabular figures on tick labels): in faces whose tabular figures include a figure-width comma, such as Schibsted Grotesk, "1,600" read as "1 , 600". Table cells and other numbers keep tabular figures.
- At narrow widths, a numeric y axis's widest tick label and its rotated title no longer overlap, nor do the x tick labels (two lines on a time axis) and the x title: each chart's left and bottom margins grow to fit them, at the size the text reaches as the drawing shrinks, in both renderers.
- Direct labels on line charts are spread by a gap that grows with the text, and the right margin fits the longest series name, so close end values (225 and 195 in a 440-wide chart drawn in a narrow column) no longer collide or run off the edge.
- A linear y axis (and a vertical bar's value axis) is rounded to the step of the ticks drawn, not to d3's default of ten ticks, so it ends on a tick: data reaching 23 on a 0, 5, ..., 20 axis now end at a 25 tick, not at 24 above the last one. Both renderers. An x axis keeps d3's finer rounding, so a narrow scatter of doses 1 to 5 runs 1 to 5, not 0 to 10.
- A wide drawing (480 or more) that scrolls in a column under 30rem shows a shadow at the edge that has more, without script.
- Scatter plots inset their points from the axes, so the first point no longer sits on the axes over a tick label at narrow widths.
- Scatter plots widen each linear axis by a twentieth of its span before rounding it, so the lowest and highest points fall between ticks, not on the end tick beside its label ("2" under the lowest point of a 320 px dot chart).
- The x axis title sits one and a half ems below its tick labels' last line, in both renderers, instead of at the foot of a bottom margin sized for text grown in a narrow column: on a 440-wide line chart shown at its own size the title stood far below "24 Oct". A time axis counts a second line of tick label only when a tick uses one.
- Line and area charts thin their x tick labels to fit the width, in both renderers, so year or day labels no longer run together on a narrow chart (Prelum, a two-series line chart at 239 px). Every label prints when they fit (2020 to 2023 at 288 px), and a thinned axis keeps its first and last ticks when an even step allows.
- Category labels under vertical bars are thinned by the same rule as line charts' x ticks when they would come within the least gap at the width drawn, so seven day names at 254 px print every other one (Thu, Sat, Mon, Wed) instead of touching; `maxXTicks` still sets the count. A time axis thins by that rule too, so it may print one label fewer than before when no even step reaches the last.
- Direct labels' right margin is sized to the labels at the width drawn: under 480 it no longer keeps the desktop's 96, in both renderers.
- The timeline's plain list on narrow screens indents 2.25em (was 1.25em), so its markers ("1.", "10.") are not clipped by the frame.
- A summary capitalizes a sentence that opens with a lowercase word ("posts rose" reads "Posts rose"), but not one that opens with a domain or identifier: "carrel.app rose" stays as written.
- `enhance` reads every mark's size before it writes anything: the pointer targets, the point layer and the line lengths for the entrance. Measuring between writes laid the whole page out once per mark. On the gallery (40 charts, 10,000 elements) that cost 7.7 s of blocking time on a throttled phone, and it now costs 70 ms.

### Changed

- `npm run size` holds the enhancement layer to 9.5 kB (was 9 kB): export, embed and layout batching bring it to 9.2 kB, and it stays one file with no imports (0027).
- The renderers drop their unused `role="group"` option: every chart's SVG is `role="img"`, enhanced or not (B28, recorded in 0027 with the WAI-ARIA and APG reasons).
- Gallery: its pages, sitemap, icon, security.txt and 404 page name `charset=utf-8` (`headersFile` with `charset: true`, and the Worker sends every file through `applyHeaderSet`, on site-runtime v0.49.0). Not part of the package, which is unchanged.
- Gallery: the co-authorship network example uses a made-up name (Rivera) in place of a real one, and a link-safety test uses example.com instead of a real site. Not part of the package, which is unchanged.

## [0.4.1] - 2026-10-31

Fixes found rolling 0.4.0 out to the sites ([0026](docs/design/0026-rollout-fixes.md)).

### Upgrading from 0.4.0

- A bar chart with `href` draws its SVG as `role="img"` (was a named group) with no links inside it: each category in its data table is the link, and each bar is a plain mark carrying it in `data-enarratio-href` (was an `<a href>`), so without script a bar is not clickable. Enhanced, a bar that does not filter (`filter: false`) follows its link on a click, and its point is that link; `update()` checks that link like any other. Styles or tests aimed at `role="group"`, `aria-roledescription="chart"` or the bars' `<a>` no longer apply.
- The 1px edge between adjacent bars and stacked segments is drawn in `--enarratio-grid` (was `--enarratio-background`).

### Added

- `hoverTitles: false` on every chart leaves out the browser's hover title (`<title>`) on each mark, for a site that shows no hover tooltips. Each mark's details move to `data-enarratio-label`, which `enhance()` still names its points with; the data stay in the table.

### Fixed

- The computed summary starts with a capital letter when a series is named from a lowercase field ("Posts rose from 3 ...", was "posts rose ...").
- A range annotation from a value to itself (`from` equal to `to`) draws a dashed line there; it drew nothing.
- A range annotation reads naturally in the chart's text alternative: with the axis's unit ("Target: 500 to 630 words"), or after its label ("Target: Words 500 to 630"), not the raw axis name ("Target: y 500 to 630"). A range from a value to itself is said as one value.
- Line and area charts of whole-day data tick by the date where the axis ticked by the hour ("12 AM", "12 PM") between them, as with a few days drawn 720 pixels wide; both renderers agree.
- Contrast (B1): textured bars were measured by their background-colored edge, which a contrast check reads at 1:1 because it cannot see a pattern's color; the edge is now decoration in the grid color, so the check reads the bar by its fill.
- A bar chart with `href` was the one chart whose SVG was not `role="img"` (B28).

### Changed

- CI: devkit v0.20.3, with its workflow and dependency audits. The release job turns off setup-node's package cache, and no checkout keeps its credentials.
- Gallery: each example sits in Capsomer's chart frame (`frameHtml`), as on the family's sites, and a new page, /capsomer, shows every chart in `capsomerTheme` (with `capsomerMoreTheme` for more contrast). The gallery loads `capsomer/base.css`, writes `_headers` with site-runtime's `headersFile`, and pins Capsomer v0.53.0, Prelum v0.21.0, site-runtime v0.46.0 and devkit v0.20.4. Not part of the package, which is unchanged.

## [0.4.0] - 2026-10-31

### Upgrading from 0.3

- `stylesheet()` throws on a theme whose series colors are too close to tell apart (a `checkTheme` error); retune those colors.
- Primitives return a whole figure; pass `inline: true` for the bare SVG, as before.
- A chart's `colors` override (and a primitive's `color`) is a `data-enarratio-colors` attribute: add `colorStyles(html)` to the page's CSS.
- `enhance()` lays native point buttons over the marks: the SVG's `role="button"` marks and `.enarratio-focus-ring` are gone, so styles aimed at them no longer apply.
- Left and Right stay on the focused series.
- `alt` is optional: a chart without one is named from its data and reports `alt-missing`. Pass `strict: true` to keep failing on it.
- The caption moved to a `<p class="enarratio-caption">` under the chart; the `figcaption` is now the head.
- The data disclosure reads "Show data" and "Hide data" (was "Data table"), and `dataTableBlock` takes the strings as a fourth argument.
- A bar `href` with a user or password before the host now throws, like a `javascript:` link.

### Added

- `enhance()` lays a native button (or, where a mark does not filter, a named image) over each mark, grouped as an application and described by a key hint that also shows while a point has focus, so screen readers read the chart as its image, hint and table in browse mode and switch to focus mode only inside it ([0021](docs/design/0021-native-points-and-reader-controls.md)). Each point says its place in its series ("Year 2019, Talks: 1, 1 of 5"), and focus or hover fades the other series (`--enarratio-opacity-faded`).
- More keys, the same on every chart: Left and Right move along a series, Up and Down between series, Home and End to the ends of the series, Page Up and Page Down by ten, Backspace back to the last point. Keys with Alt, Control or Command pass through.
- The data table sorts by any column (a button in each header, `aria-sort`), a table chart's table too, and a "Show table" button swaps the chart for the table and back (option `table`, on by default).
- A "Pick a range" form (from and to) on charts with a brush, so a range never needs a pointer.
- Opt-in options: `expand` (an "Expand" button that fills the window; Escape closes it) and `url` (the filter and range kept in the address, and read back from a shared link).
- `strings` (and `ENHANCE_STRINGS`, the English defaults) translates every string the layer writes.
- `update()` is announced ("Chart updated"), and keeps the range and the table view.
- Escape hides a hovered tooltip wherever focus is.
- `npm run size` checks the enhancement layer against a 9 kB budget, bundled, minified and gzipped (7.9 kB, from 5.3 kB).
- Every chart's figure says what it shows in text, with scripts off: a `figcaption` with the title, a new `subtitle` and the `alt` shown as the finding (B2, B17, B18, B51); a screen reader overview before the chart, with its type, series and points, and each axis's label and range, its numbers written like the axis ticks ("0 to 1", not "0.000 to 1.000") (B53); and a summary computed from the data, under the chart: each series' trend with any peak or low that stands out, the highest and lowest values, values far from the rest and the last interval drawn, at grade 9 or below (B39, B24, B19). The science charts add their own: `titerPlot` each group's geometric mean titer with its 95% interval and the limit of detection, `genomeTrack` its features' lengths, strands and overlaps, and `networkChart` its nodes, links, most connected nodes and separate parts. `summary` replaces it or, `false`, leaves it out.
- `notes`, `source` (`{ name, href }`) and `byline`, and a "Download CSV" link on every figure, built on the server from the table's rows as a `data:` URL (C1, C2). `csv: false` drops it; `csvHref` links a file the site serves, built with the new `toCsv`.
- Issues a reader would meet are reported as a chart renders: no `alt` (the chart then names itself from its data, B52), no title, an unlabeled axis with no title (B25), more than 6 series or 1,000 points (B21), author text above grade 9 (B19) and a CSV too large to inline. They go to `onIssue` or `console.warn`; `strict: true` throws, so a build fails. New types `ChartIssue`, `IssueOptions`.
- `locale` and `strings` on every chart and primitive: generated numbers and dates follow the locale, and every generated string can be translated (B40, B56): hover details, table headers, legends and summaries on every chart, and the primitives' text alternatives, tables and hover details (`strings.terms` holds the words, such as `noData`, `forecast` and the statuses; the option's type is `StringOverrides`). `numberFormat` (decimal, percent, currency, compact, SI, unit, `maximumSignificantDigits`), `dateFormat` (dates written out, time zone named with a time), `readingGrade`, `ENGLISH` and the `Strings`, `At` and `AxisRange` types are exported (C10, C11).
- `xUnit` and `yUnit` on bar, line, area and scatter charts, titer plots and every new chart with axes, added to the axis label and table header (B23).
- `labelColor` is exported from the core: the text color the stylesheet prints on a mark, the scheme's text or background color when it reaches 4.5:1, else black or white.
- `ChartDescription`, `SummarySeries`, `SummaryPoint`, `StringOverrides` and `Terms` are exported, and `FigureParts` takes `description`, `limits`, `method` and `tableMarkup`, so a chart built on `figure()` describes itself as the library's do.
- `datasetJsonLd`, a schema.org `Dataset` entry for data a site wants indexed (C14).
- Every primitive (sparkline, progress ring, uptime strip, heat strip, timeline) takes `PrimitiveFigureOptions`.
- New charts in `enarratio/plot`, each server-rendered with an alt generated when none is given, an overview and summary computed from its data, a data table and keyed marks, and series told apart by more than color: `divergingBarChart` (signed values about zero), `waterfallChart`, `smallMultiples` (bar and line panels on shared scales), `histogram` and `densityPlot`, `boxPlot` and `stripPlot` (beeswarm or jitter), `dotPlot`, `rangePlot` and `dumbbellPlot`, `slopeChart`, and `pieChart` (and donut), which reports more than six slices as an issue (`strict` throws it) and refuses more than eight. Records [0024](docs/design/0024-more-chart-types.md) and [0025](docs/design/0025-new-charts-on-the-figure.md).
- `areaChart` stacks to 100% with `percent: true`, in `enarratio/lite` too.
- `scatterPlot` draws bubbles (`size`, `sizeLabel`) with a size legend.
- Error bars (`errorBars: { lower, upper, label }`) on `barChart` (in `enarratio/lite` too, with the same SVG) and `scatterPlot`, and intervals on `dotPlot`, from fields you compute. The data table and hover details carry them.
- Annotations (`annotations`: text notes with an arrow, highlighted x or y ranges) on bar, line, area and scatter charts (bar, line and area in `enarratio/lite` too) and most new ones, also added to the text alternative.
- `tableChart` in the core: one table with inline bars, heat cells and sparklines, its numbers printed as text: the visible table is the figure's data table, so screen readers read it and `enhance()` sorts it.
- Lab figures in `enarratio/science`: `doseResponse` (four-parameter logistic, fitted or given, EC50 marked), `survivalPlot` (Kaplan-Meier with censor marks, confidence bands and the number at risk), `forestPlot` (pooled fixed or random effects) and `phylogeneticTree` (Newick, rectangular layout). Their statistics are exported: `fitLogistic`, `logistic`, `kaplanMeier`, `poolEstimates` and `parseNewick`.
- **Textures for filled series** (B5, B49): bars and areas fill series 2 to 8 with an SVG pattern, the series color under a texture, and legend swatches show the same texture; series 1 stays solid. Stacked segments and bars get a 1px background-colored gap (B6), and names printed on bars a halo of their bar's color. New properties `--enarratio-opacity-texture`, `--enarratio-bar-gap` and `--enarratio-halo-width`.
- **`highContrastTheme`** in `enarratio/themes`, and `stylesheet(theme, { highContrast })` to use its colors under `prefers-contrast: more` (B43, B49). The gallery does.
- **Forced colors, more contrast and print** in the base rules (B43, B57, C5, D3): system colors under `forced-colors: active`, with series told apart by textures, line dashes, symbols and labels; full textures, wider gaps and stronger gridlines under `prefers-contrast: more`; and a print stylesheet (light scheme, no scroll, one page, the table open, no tooltip, focus ring or brush). The gallery's visual test gains forced-colors images.
- **`colorStyles(html)`**: the CSS rules for the per-chart color overrides in some chart markup, for the page's own stylesheet (D4).
- Line charts' direct labels that end close together are moved apart, so they never overlap (B8).
- Design record [0022](docs/design/0022-readable-for-every-reader.md).
- 22 gallery examples, one per new chart or option.
- **The gallery's head and machine files come from Prelum** (`@drdustinedwards/site-helpers`, a gallery devDependency; the npm package does not use it). Every page now sends Open Graph and Twitter tags with a share card (`site/og-card.png`), and the gallery pages describe the library as structured data. robots.txt follows the family bot policy, and a new `/ai.txt` and the `tdm-reservation: 1` header reserve training rights while welcoming citation.
- **The gallery has a page for Astro and EmDash** (`/astro`), on the separate enarratio-astro and enarratio-emdash packages, with structured data naming them. The gallery now also serves `sitemap.xml`, `robots.txt` (pointing to the sitemap) and `llms.txt`, and every page names its canonical address. Gallery only: the package is unchanged.

### Changed

- Line and area charts write x dates out for the locale in the table, hover details and summary ("January 6, 2025", "January 1, 2026 at 12:00 AM UTC"). Mark keys, `data-enarratio-x` and filter events keep ISO dates.
- Long category labels on bar axes are cut with an ellipsis; the table, hover details and bar names keep them whole. Values from a million up get compact tick labels (2.5M). A value axis whose values are all zero runs from 0 to 1, so the Plot bar chart no longer fills the frame (B41).
- Text in the drawing is `0.75rem` (`--enarratio-font-size-mark`, was `12px`), so it follows the browser's text size, and each chart's SVG carries a `font-size` that grows as the drawing shrinks, so text never renders under 12px at default zoom, down to a 320px screen (B3, B47). Bar direct labels lose their fixed 11px and the progress ring's value is at least `0.75rem`. The chart frame is a size container.
- No animation runs longer than 5 seconds, whatever its duration property says (B44).
- The gallery moves to Capsomer v0.37.0 (exact times in American English), with site-runtime v0.27.0 and devkit v0.17.0's workflows, the newest releases.
- The gallery moves to Capsomer v0.35.0: in dark, muted text, links and borders are stronger, and with "Increase contrast" on it takes Capsomer's stronger set.
- The gallery moves to Capsomer v0.34.1, so a short page keeps the scrollbar's room and its letterhead sits on the same pixels as a long page's.
- The gallery moves to Capsomer v0.34.0. Home starts at the same place as on every family site, x 496 at 1536px, whatever the site's name.
- The gallery moves to Capsomer v0.32.0: the family's 1280px page (now on the Astro page too, which was missing `.cap-page`), its faces from `capsomer/fonts.css` with Capsomer's own font files (one variable file each for Schibsted Grotesk and Martian Mono, so the footer's bold name is the same face as on every family site), the family footer in a plain `.cap-page` wrapper, and the family's 17px body from `.cap-page`. The `@fontsource/schibsted-grotesk` and `@fontsource/martian-mono` dev dependencies are gone.
- devkit v0.15.0, the newest release (its family check now also fails a site that loads the family's faces itself).
- The gallery wears the family letterhead (Capsomer v0.28.1, `letterheadHtml`): the rose stripe over the band, the mark with "Dustin Edwards" over Enarratio, the theme button, and the page links (Home first) in a second row, pinned at the top. It replaces the old one-row header and the running head sign.
- The gallery's page is Capsomer's family column (Capsomer v0.29.0, `.cap-page`), so its letterhead, charts and footer line up with every other family site. Its own 1180px width and `--header-max` are gone, and the chart list sits above the charts in two columns instead of in a narrow column beside them.
- The gallery's footer is Capsomer's family footer as it ships (Capsomer v0.30.0), the same on every family site. Its own `.site-foot` padding is gone, and the gallery keeps only its top padding.
- devkit v0.14.0, the newest release (its family check now also flags a site's own value for a Capsomer token).
- The old gallery address, abscissa.dustinedwards.info, no longer redirects; the gallery answers only at enarratio.dustinedwards.info.
- The gallery's Worker is named `enarratio`, after its site, as every family Worker serving a product's site is.
- The gallery takes the NASA manual theme the family's public sites share, in its own color, rose (Capsomer v0.27.0, record [0020](docs/design/0020-gallery-in-the-manual-theme.md)): a running head sign, the facts in form boxes, each chart numbered with a leader index beside them, and the family footer with Enarratio in its strip of sites.
- The gallery moves to Capsomer v0.22.0 and Prelum v0.15.0, the newest releases.
- devkit v0.13.3, site-runtime v0.24.0 and Capsomer v0.23.0, the newest releases.
- The repository runs devkit's no-bloat report in CI (`npm run bloat`: unused files, exports and dependencies, and duplicated blocks), as a warning.
- The gallery serves `/.well-known/security.txt` (security@dustinedwards.info) and its IndexNow key file (site-runtime builds security.txt), and the gallery deploy pings IndexNow with Prelum. A failed ping is only a warning.
- The family check (devkit) runs in CI; `.family.json` records its exceptions.
- American spelling in docs and comments. No exported name changes.
- site-runtime (a gallery dev dependency) is at v0.12.1; the package is unchanged.
- **The gallery's `Reporting-Endpoints` header comes from site-runtime v0.12.0's `reportingEndpoints`** in place of a hand-written string; the header and the policy are unchanged. Gallery only: site-runtime stays a dev dependency, and the package is unchanged. The gallery Worker grows to 11.6 KiB (5.0 KiB gzip), so its budget is reset to 10% over that.
- **The gallery's page is Capsomer's.** Capsomer's fonts, tokens, site header, page head, panels and disclosures around the charts, and its theme button in place of the gallery's "Dark" button. Each chart sits on its own theme's background. Gallery only: `capsomer` and two `@fontsource` faces are dev dependencies, and the package is unchanged (record 0019).
- Internal helpers that no subpath exports are no longer exported from their modules: the primitives' `prepare*` steps and their value types, `extent`, `markerPoints`, `tag`, and the gallery Worker's `HOST` and `OLD_HOST`. The public API does not change. One unit test that repeated the package test for `dist/base.css` is gone.
- The enhancement layer's source is split into modules (`src/enhance/`); the build bundles them, so the published `enhance/index.js` is still one file with no imports. No change in behaviour.
- The default chart size (640 by 320) and the enhancement layer's timings and gaps are named constants instead of numbers repeated across files. A shared `toDate` replaces two copies of the date parsing. Biome now fails on promises that are neither awaited nor handled. No change in behaviour.
- CI fails on a high `npm audit` advisory, and bump-consumers runs only by hand, after the npm approval, never on a tag push. `.gitignore` covers `.env`, `.mcp.json` and `.dev.vars`.
- The shared devkit workflows are pinned to devkit v0.7.0, and devkit is a dev dependency. The gallery Worker is minified with its source maps uploaded, and a new `worker-size` check holds its bundle to a budget in `.worker-size.json`.
- **Releases tag themselves.** Merging a version bump to `main` tags it, publishes the GitHub release and stages the package; nobody pushes a tag (`docs/releasing.md`).
- **A code map for the Capsid system explorer.** After each push to `main`, devkit's code-map workflow publishes each module's imports and each function's complexity, coverage and CRAP to the `code-map` branch; a weekly run adds Stryker mutation scores. Not part of the package.
- **The gallery's security headers come from site-runtime.** `scripts/security-headers.ts` builds them with `@dustinedwards/site-runtime` (a devDependency, now pinned to `v0.7.0`) and the gallery build writes `_headers`; the hand-written `site/_headers` is gone. The gallery now also refuses framing, sends the cross-origin opener and resource policies, `object-src 'none'`, a two-year HSTS, `Referrer-Policy: no-referrer` and the full Permissions-Policy, and reports policy violations to `/csp-report`, where its Worker logs them. The Worker's redirects carry the same headers. A test runs site-runtime's check on them. Not part of the package, which is unchanged (record 0018).
- **The gallery's report sink is site-runtime's shared receiver.** The Worker's own `/csp-report` handler is replaced by `receiveCspReport` from `@dustinedwards/site-runtime/csp-report`: every POST now gets 204, an oversized or malformed body included (an error status makes browsers resend), the body is read to 16 KB and no further, and OPTIONS is answered. Not part of the package.
- **The gallery's https redirect keeps a POST a POST.** A plain-http request other than GET or HEAD now gets 308 instead of 301 (a 301 lets a browser resend a POST as a GET without its body), and the redirect is never cached, the rule dustinedwards.info uses. Not part of the package.

### Removed and breaking

- **Primitives return a whole figure by default**: title (their `label`), finding, drawing, summary, CSV link and data table (B30, B51). Pass `inline: true` for the bare word-sized SVG, as before. `enhance()` skips these figures (`data-enarratio-static`).
- **`alt` is optional**: a chart without one is named from its overview and summary and reports `alt-missing`, instead of throwing. Pass `strict: true` to keep failing on it.
- The data table's disclosure reads "Show data", and "Hide data" when open (was "Data table"); `dataTableBlock` takes the strings as a fourth argument.
- The caption is a `<p class="enarratio-caption">` under the chart; the figure's `figcaption` is now its head.
- `checkTheme` reports series colors closer than 10 CIEDE2000 units (typical vision, protanopia, deuteranopia or tritanopia) as an error, not a warning, and `stylesheet()` throws on a theme with any error (B7). `defaultTheme`'s light series 7 is `#574d00` (was `#4f5500`, 6.0 units from series 8 under tritanopia), and the gallery's example theme is retuned to pass.
- A chart's `colors` override (and a primitive's `color`) is written as `data-enarratio-colors`, never a `style` attribute, so charts need no `style-src-attr 'unsafe-inline'` (D4). Add `colorStyles(html)` to the page's CSS to apply them. `update()` now drops every `style` attribute and keeps `<pattern>`. The gallery's policy no longer allows style attributes.
- Enhanced: the SVG is one image again (links, if any, become the points), and its marks keep no ARIA of their own. The focus ring is the point's own outline, drawn above every mark, in place of the ring drawn into the SVG, and Enter and Space are the buttons' own. Left and Right now stay on the focused series instead of returning to the bottom of the next category.
- **Security:** a bar `href` with a user or password before the host (`https://trusted.example@other.example/`) now throws, like a `javascript:` link. `update()` drops such links too, along with `ping`, any `form*` attribute and `button` elements, none of which the server emits.
- Removed docs/AI_USAGE.md.
- Removed the remaining AI-use mentions, including the paper's disclosure section.
- Removed the dated test baseline (`docs/research/`) and its report script (`scripts/report-mutation.mjs`); the code-map workflow keeps the mutation results now.

## [0.3.1] - 2026-10-14

### Changed

- **Narrow ticks keep a gap.** `uptimeStrip` and `heatStrip` left no space between ticks
  narrower than 5px, so a long strip (84 two-hour periods in 336px, say) read as one solid
  bar. A tick of 3px or more now keeps a 1px gap and one of 2px a half-pixel gap.
- **Area charts are lighter, with an edge.** Bands are filled at 0.3 opacity instead of
  0.85, with a 2px line along each band's top edge, in `enarratio/plot` and
  `enarratio/lite` alike, so gridlines show through and a stack reads as layers.

## [0.3.0] - 2026-10-11

### Added

- **Light bar, line and area charts for the browser: `enarratio/lite`.** `barChart`,
  `lineChart` and `areaChart` drawn without Observable Plot, linkedom or a DOM, from the
  same options and to the same SVG as the charts in `enarratio/plot` (a test compares
  them element by element on every gallery example and a matrix of options; the two
  exceptions, where the Plot chart is wrong, are in the design record). Each also
  has its own entry: `enarratio/lite/bar`, `enarratio/lite/line`, `enarratio/lite/area`.
  Bundled for the browser, minified and gzipped they are 7.3, 9.2 and 8.8 kB (12.7 kB
  together), against about 90 kB for the Plot versions without linkedom. The Plot
  charts are unchanged. Design record 0017.

### Fixed

- A wide drawing's frame (480 pixels or wider, which keeps 30rem and scrolls sideways on a narrow
  screen, A13) could not be reached by keyboard, so a keyboard user could not scroll it. The frame
  now carries `tabindex="0"`, `role="group"` and `aria-label="{title}, scrolls sideways"` ("Chart"
  when there is no title, since the SVG inside already reads the alt), and `base.css` gives it the
  same `:focus-visible` outline as the chart. Markup cannot know whether a frame overflows, so
  every wide frame gets them; narrower frames, which never scroll, get none. `enhance()` removes
  the frame's tab stop once the marks take focus (a focused mark scrolls itself into view), and
  `destroy()` gives it back.

### Changed

- CI tests Node.js 24 and 26, and the tooling jobs run on Node.js 26 (`.nvmrc`). `engines` is
  unchanged (`>=22`); Node.js 22 is no longer in the CI matrix.
- Node.js 20 (end of life) is dropped: `engines` is now `>=22`, CI tests Node.js 22 and 24, and the
  README says so. The Node version for the tooling jobs (browser tests, gallery build, visual
  snapshots) is set once, in `.nvmrc`.

### Development

- `npm run size` also bundles each `enarratio/lite` entry for the browser with rolldown
  (now a pinned dev dependency), minifies and gzips it, and fails above 40 kB, or if a
  light entry imports anything outside the package.
- The reading and checking of bar, line and area chart options moved out of the Plot
  renderer into `src/render/bar-model.ts` and `src/render/line-model.ts`, shared by both
  renderers. The Plot charts' output is byte for byte what it was.
- Releases are staged on npm from GitHub Actions (`.github/workflows/release.yml`) when a `v*`
  tag is pushed, using npm trusted publishing (no stored npm token) with provenance, and go live
  only after a maintainer approves them on npm. The steps are in `docs/releasing.md`.
- A test baseline (`docs/research/baseline.md`): suite counts and runtimes, a
  StrykerJS mutation score per file, and a per-test kill matrix
  (`docs/research/kill-matrix.json`) with removal candidates and the
  design-pinning tests listed separately. Measurement only: no test or source
  changed. The chunked Stryker config (`stryker.config.mjs`,
  `vitest.stryker.config.ts`) and the merge script
  (`scripts/report-mutation.mjs`) are committed; Stryker itself is not a
  dependency and is installed per run.

## [0.2.0] - 2026-10-02

Design records 0011 to 0016 explain each decision.

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

### Changed

- `stylesheet()` output: the base rules now use `var(--enarratio-*, <value>)`
  for every size, weight, radius and timing, with a leading comment, the
  timeline's rules and `max-width: 100%; height: auto` on `svg.enarratio`.
  Computed values are unchanged for any page that sets no property, so no stored
  markup or image changed; a primitive wider than its container now shrinks to
  fit instead of overflowing. This is the only default that changed.
- `barChart`'s `x` field may also be a `Date` when `xType` is `"time"`.
- The gallery's second page is `/example` (was `/dustinedwards`), and its
  rendering and image tests use it.
- New options' defaults: `interval: "day"`, `forecastLabel: "Forecast"`,
  `timeline` `width: 640`, `heatStrip` `width: 240` and `height: 24`. A band is
  drawn at 18% opacity behind its line. A missing value reads `no data` in the
  companion tables (chart tables keep blank cells).

### Removed

- **`dustinedwardsTheme`**, with its export and its API section, because
  dustinedwards.info is being redesigned (design record 0016). A site that used
  it should keep its own theme object; the removed theme was a `Theme` like any
  other. The gallery's second page, `/dustinedwards`, is now `/example`, a
  neutral worked example theme (`examples/themes/example.ts`).

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
- Companion functions for every primitive: `sparklineTable`, `uptimeStripTable`,
  `progressRingTable`, `timelineTable` and `heatStripTable`, each taking the
  primitive's options and returning `{ summary, table, markup }` computed from
  the same values as the drawing, so the table cannot disagree with the picture.
  The primitives return exactly what they did (design record 0015). Also
  `dataTableBlock`, the table markup figures carry.
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
