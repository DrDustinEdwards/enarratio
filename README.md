# Enarratio

**Accessible, server-rendered charts and scientific figures for the web.**

> **Status: in active development.** Enarratio is an alpha. The API may change
> before 1.0, and every change is recorded in the [changelog](CHANGELOG.md).

Enarratio draws charts on the server, into the HTML. A chart is complete before
any JavaScript runs: readers see it at once, screen readers get a written
description and an equivalent data table, search engines and language models
read the same numbers people do, and the page downloads no charting library.
An optional enhancement layer adds hover details, keyboard navigation,
click-to-filter events and range brushing on top.

It covers the charts a website needs (bars, lines, areas, scatter plots,
heatmaps, networks, with forecast bands and time axes), the small primitives a
dashboard needs (sparklines, progress rings, uptime and heat strips, event
timelines) and the
figures a laboratory needs, starting with antibody titer plots and genome
tracks. Charts are built on [Observable Plot](https://observablehq.com/plot/)
and [d3-force](https://d3js.org/d3-force) (optional peer dependencies, installed
only for the charts that use them), and return plain HTML strings, so
Enarratio works with any server framework. It is tested on Node.js 24 and 26
and runs on Cloudflare Workers (the gallery's first site renders charts in a
Worker); Deno and Bun should work, since it uses only standard modules, but are
not yet tested.

**Gallery:** every chart, in two themes, light and dark:
[enarratio.dustinedwards.info](https://enarratio.dustinedwards.info)
(built by `npm run gallery`).

**Astro and EmDash:** [enarratio-astro](https://www.npmjs.com/package/enarratio-astro)
draws Enarratio charts in Astro pages and Markdown, and
[enarratio-emdash](https://www.npmjs.com/package/enarratio-emdash) adds them to
the EmDash editor as a Chart block. They are separate packages, in
[DrDustinEdwards/astro](https://github.com/DrDustinEdwards/astro); see
[enarratio.dustinedwards.info/astro](https://enarratio.dustinedwards.info/astro).

## Statement of need

Most web charting libraries draw in the browser. A chart drawn in the browser
is absent until its script downloads and runs, is invisible to anything that
reads HTML without running scripts, and is usually opaque to screen readers.
Server-side alternatives exist for static images, but an image cannot follow
the site's dark mode, cannot be read by assistive technology beyond its alt
text, and cannot be made interactive.

Scientific figures on the web have the same problem, and a second one: the
figures researchers publish (titer plots, genome maps, dose-response curves,
phylogenies, surveillance maps) are not in general-purpose charting libraries,
so each lab site redraws them by hand, inconsistently, and usually without
text alternatives.

Enarratio is for developers of research, teaching and small-organization
websites who want charts that:

- **render on the server** as inline SVG inside semantic HTML, with no client
  code required;
- **are accessible by construction**: a written description (generated from
  the data when none is given), an equivalent data table, keyboard access and
  screen reader announcements for every interaction, and no reliance on color
  alone;
- **follow a site's theme** in light and dark mode from one render, with
  palettes checked for contrast and for color vision deficiency;
- **include scientific chart types** designed alongside the general ones,
  sharing their theming, accessibility and interaction.

## Install

```sh
npm install enarratio
```

That is the core: the theme, the stylesheet, the color checks, and the small
primitives (sparkline, progress ring, uptime strip, and the rest), with no
runtime dependencies. The charts are separate entry points, each with the
packages it needs as optional peer dependencies, so a site installs only what
it draws:

| Import | Holds | Also install |
|---|---|---|
| `enarratio` | Core, primitives and `tableChart` | Nothing |
| `enarratio/plot` | `lineChart`, `areaChart`, `barChart`, `scatterPlot`, `heatmap` and the charts below | `@observablehq/plot linkedom` |
| `enarratio/science` | `genomeTrack`, `titerPlot`, `doseResponse`, `survivalPlot`, `forestPlot`, `phylogeneticTree`, `networkChart`, and their statistics | `@observablehq/plot d3-force linkedom` |
| `enarratio/lite` | `barChart`, `lineChart`, `areaChart` without Observable Plot, for the browser; also `enarratio/lite/bar`, `/line`, `/area` | Nothing |
| `enarratio/enhance` | Browser interaction | Nothing |
| `enarratio/redraw` | Redraws a server's chart to its frame's width | Nothing |
| `enarratio/themes` | `defaultTheme` | Nothing |
| `enarratio/base.css` | The theme-free stylesheet | Nothing |

(`linkedom` is dropped from browser bundles, which use the browser's own
document.) To draw bar, line and area charts in the browser, import them from
`enarratio/lite`: the same options (error bars and annotations included) give
the same SVG, with no Observable Plot, linkedom or DOM, in 15 to 16 kB per chart
bundled, minified and gzipped. Enarratio is ESM only and needs Node.js 22 or
later (or any runtime with standard ES modules). TypeScript types are included.

## Five-minute start

**1. Render a chart on the server.** Every chart takes its data, the fields to
plot, and `alt`: a sentence saying what the chart shows.

```ts
import { stylesheet } from "enarratio";
import { barChart } from "enarratio/plot";
import { defaultTheme } from "enarratio/themes";

const entries = [
  { year: 2022, type: "Publications" },
  { year: 2022, type: "Talks" },
  { year: 2023, type: "Publications" },
  { year: 2024, type: "Publications" },
  { year: 2024, type: "Grants" },
];

const chart = barChart({
  id: "entries",
  data: entries,
  x: "year",
  series: "type", // stacks by type; omit y to count rows
  title: "Entries per year",
  alt: "Entries per year by type, 2022 to 2024: one or two a year, mostly publications.",
});
```

**2. Put it in a page with the theme's stylesheet.** The stylesheet is
included once per page, whatever the number of charts.

```ts
const html = `<!doctype html>
<html lang="en">
<head>
<meta name="color-scheme" content="light dark">
<style>${stylesheet(defaultTheme)}</style>
</head>
<body>${chart}</body>
</html>`;
```

That page is complete: the chart, its legend and a data table render with
scripts off, and the `color-scheme` meta tag makes them follow the reader's
light or dark preference.

**3. Optionally, enhance it in the browser.**

```ts
import { enhance } from "enarratio/enhance";

enhance(); // every Enarratio chart on the page
document.addEventListener("enarratio:select", (event) => {
  const { chartId, field, value } = event.detail; // e.g. "entries", "type", "Talks"
  console.log(chartId, field, value); // value is null when the filter is cleared
});
```

Now bars show details on hover and focus, arrow keys move between them (along
a series and between series), Enter or a click filters by the bar's series
(and fires `enarratio:select`), legend entries become toggle buttons, a drag,
Shift with the arrow keys or a from-and-to form picks a range on time axes
(`enarratio:brush`), and the data table sorts and can replace the chart.
Escape clears. Everything is announced to screen readers and motion stops
under `prefers-reduced-motion`. `{ expand: true, url: true }` adds an expanded
view and keeps the filter in the address; `strings` translates the layer.

To have a chart drawn on the server for a wide page fit a phone, write its spec beside it with
`redrawAttribute` and call `redrawCharts()` (or `redrawChart` for one host) from
`enarratio/redraw` instead: each chart is drawn again at its frame's width as that width
changes, then enhanced.

Without a bundler, serve `node_modules/enarratio/dist/enhance/index.js` as a
file (it has no imports of its own) and load it with
`<script type="module">import { enhance } from "/enhance.js"; enhance();</script>`,
or from a CDN such as
`https://cdn.jsdelivr.net/npm/enarratio@0.5.0/dist/enhance/index.js`.

To redraw a chart in place, pass new server markup to `update()` on the chart
`enhance()` returns. That markup should come from Enarratio: it is sanitized
before use, but it is not a way to insert arbitrary HTML.

The [examples](examples/) directory holds a runnable file for every chart in
the gallery. Each exports the chart's HTML, and `npm run gallery` renders them
all into `site/dist`.

## Charts

| Function | Import | Draws |
|---|---|---|
| `barChart` | `enarratio/plot` | Bars, stacked or grouped, vertical or horizontal, on a category or a time axis; counts rows when no value is given; error bars |
| `divergingBarChart` | `enarratio/plot` | Signed values about zero, each bar labeled with its sign |
| `waterfallChart` | `enarratio/plot` | A bridge from one total to another through increases and decreases |
| `lineChart` | `enarratio/plot` | Lines over time or any number, with gaps, reference lines, event markers, direct labels, log y, and a forecast band with the line dashed after a chosen x |
| `areaChart` | `enarratio/plot` | Stacked areas over time, or stacked to 100% |
| `smallMultiples` | `enarratio/plot` | One bar or line chart per group, on shared scales |
| `scatterPlot` | `enarratio/plot` | Points on linear or log axes, symbols per series, optional regression with 95% band, bubbles with a size legend, error bars |
| `histogram`, `densityPlot` | `enarratio/plot` | Distributions: binned counts, and kernel density curves |
| `boxPlot`, `stripPlot` | `enarratio/plot` | Box plots, and every value as a beeswarm |
| `dotPlot`, `rangePlot`, `dumbbellPlot` | `enarratio/plot` | One row per item: dots (with intervals), low-to-high ranges, and two values joined |
| `slopeChart` | `enarratio/plot` | Each item's value at two times, labeled at both ends |
| `pieChart` | `enarratio/plot` | A pie or donut, reported as an issue past six slices |
| `heatmap` | `enarratio/plot` | A grid on the theme's sequential ramp, with printed values and labeled bins |
| `tableChart` | `enarratio` | One sortable table with inline bars, heat cells and sparklines |
| `networkChart` | `enarratio/science` | A force-directed network laid out on the server, deterministic |
| `titerPlot` | `enarratio/science` | Titers on a dilution axis with geometric mean, 95% CI and limit of detection |
| `genomeTrack` | `enarratio/science` | Features to scale on a nucleotide axis, arrows by strand, overlaps in lanes |
| `doseResponse` | `enarratio/science` | A four-parameter logistic curve, fitted or given, with the EC50 marked |
| `survivalPlot` | `enarratio/science` | Kaplan-Meier curves with censor marks, confidence bands and the number at risk |
| `forestPlot` | `enarratio/science` | Study estimates with intervals, and a pooled estimate (fixed or random effects) |
| `phylogeneticTree` | `enarratio/science` | A tree from Newick, rectangular, tips colored by group, support at the nodes |
| `sparkline` | `enarratio` | A word-sized trend line |
| `progressRing` | `enarratio` | Progress toward a total |
| `uptimeStrip` | `enarratio` | Up, degraded, down or unmeasured, one tick per period |
| `heatStrip` | `enarratio` | A one-row strip on the sequential ramp, one cell per value |
| `timeline` | `enarratio` | Lanes for sites or agents, spans and point events over a time window, status by color and shape |

Forecasts are computed by you and only drawn by Enarratio: give `lineChart` the
bounds as fields and a boundary, and it shades the band, dashes the line after
the boundary, draws forecast points hollow, and marks forecast rows in the data
table. A time axis on `barChart` needs no pre-formatted labels:

```ts
import { barChart, lineChart } from "enarratio/plot";

lineChart({
  data: days, // { day, visits, lower, upper }, the last rows computed by your model
  x: "day",
  y: "visits",
  band: { lower: "lower", upper: "upper", label: "95% interval" },
  forecastFrom: "2026-02-23",
  alt: "Daily visits, with a one-week forecast and its 95% interval from 24 February.",
});

barChart({
  data: runs, // { at: "2026-06-09T08:00Z", site }, one row per run
  x: "at",
  xType: "time", // one bar per day, quiet days included
  series: "site",
  alt: "Analysis runs per day at three sites.",
});
```

Every primitive can also state its numbers: `sparklineTable`,
`uptimeStripTable`, `progressRingTable`, `timelineTable` and `heatStripTable`
return a table and a summary sentence computed from the same values as the
drawing, for pages that want them beside it.

Every function is documented in the [API reference](docs/api.md) and in its
TypeScript declarations. The chart types still to come, and the order they
come in, are in the [scientific chart plan](docs/design/0005-scientific-charts.md).

## Themes

A theme is data: fonts, gridlines, and a light and a dark color scheme, each
with eight series colors, a five-step sequential ramp and status colors.
`stylesheet(theme)` turns it into CSS custom properties; charts refer only to
those properties, so one server render serves every theme and both schemes.

```ts
import { checkTheme, defineTheme, stylesheet } from "enarratio";
import { defaultTheme, highContrastTheme } from "enarratio/themes";

const theme = defineTheme({
  ...defaultTheme,
  name: "lab",
  fonts: { body: "Inter, system-ui, sans-serif" },
  light: { ...defaultTheme.light, background: "#fbfaf7" },
});
const report = checkTheme(theme);
// report.issues: text below 4.5:1, marks below 3:1 (WCAG 2.2),
// series names below 4.5:1 on the background, ramp steps under 3:1 by fill
// and edge, and series colors closer than 10 CIEDE2000 units under simulated
// protanopia, deuteranopia or tritanopia. stylesheet() throws on any of them.
const css = stylesheet(theme, { highContrast: highContrastTheme });
```

Series names written on the background (direct labels, survival curve labels)
are drawn in a shade of each series color that reaches 4.5:1, and ramp steps
too pale to see on the background (a heatmap's lowest values) get an edge at
3:1. `stylesheet()` derives both from the theme, or takes a theme's own
`seriesLabels` and `sequentialEdges`.

### Your own tokens in a theme

Any theme color can be one of the site's own custom properties, with its value
as a fallback: `var(--brand-ink, #1c1727)`. The stylesheet writes it as given,
so charts follow the token wherever the site changes it (a family, a density, a
dark mode of its own), and nothing is copied in hex. `checkTheme()` measures
the fallback, so keep it equal to the token's value.

```ts
const theme = defineTheme({
  ...defaultTheme,
  name: "site",
  light: {
    ...defaultTheme.light,
    background: "var(--surface, #fdfdfe)",
    text: "var(--text, #1c1727)",
    mutedText: "var(--muted, #686471)",
  },
});
```

When the series or the ramp are tokens, give `seriesLabels` and
`sequentialEdges` as tokens too; otherwise their shades are derived from the
fallbacks and stay fixed.

A site whose colors and type already live in its own design tokens can skip the
`Theme` object: link `enarratio/base.css` (or call `baseStylesheet()`), define the
color and font properties yourself, and tune any size, weight, radius or animation
timing the same way, for example `--enarratio-font-size-mark` or
`--enarratio-duration-grow`. Every property has today's value as its fallback, so
setting none changes nothing. The full list is in the
[API reference](docs/api.md#custom-properties).

Any chart can override a series color with `colors: { Talks: "#8a4a1b" }` or a
light and dark pair. The chart carries it in a data attribute, never a `style`
attribute, so a strict Content-Security-Policy needs no `'unsafe-inline'`: add
`colorStyles(html)` to the page's CSS. Two themes ship with the package in
`enarratio/themes`: `defaultTheme`, and `highContrastTheme`, which the example
above uses for readers who ask for more contrast. The
gallery's second page uses a neutral, heavily commented example theme,
[examples/themes/example.ts](examples/themes/example.ts), written to be copied
and edited.

## Accessibility

- Every chart is a figure with a title, a visible one-sentence finding (its
  `alt`), a screen reader overview (type, axes and ranges, series and points),
  a summary computed from the data (trend, extremes, outliers, intervals, at
  grade 9 or below), notes, a source line, a "Download CSV" link and the data
  table, all in the HTML with scripts off. Primitives are figures too, unless
  `inline`.
- `alt` names the chart's SVG (`role="img"`), and belongs to the SVG rather
  than the figure so that the caption and table stay readable. A chart without
  one names itself from its data and reports an issue; `strict: true` turns
  every issue (no alt or title, an unlabeled axis, too many series or points,
  text above grade 9) into an error that fails the build.
- Numbers, dates and every generated string follow `locale` and `strings`.
- Every chart carries an equivalent data table, in a disclosure or visually
  hidden.
- Every mark has hover details that work without script, through SVG `<title>`.
- Series are distinguished by more than hue: textures on filled bars and
  areas, legends and direct labels (moved apart so they never overlap),
  symbols in scatter plots, hollow points below a limit of detection, heights
  in uptime strips, dashed outlines for missing values.
- Text in the drawing follows the browser's font size and never renders under
  12px at default zoom, down to a 320px screen.
- Charts follow forced colors (Windows High Contrast), `prefers-contrast:
  more`, `prefers-reduced-motion` and print, and carry no `style` attribute.
- A chart's drawing is one named image (`role="img"`), enhanced or not; the
  enhancement layer's points sit beside it, in their own `role="application"`
  layer ([record 0027](docs/design/0027-contrast-export-and-roles.md)).
- Enhanced charts add "Download SVG", "Download PNG" and, for a figure with an
  `id`, "Copy embed" (a link to the chart) beside "Download CSV".
- Enhanced charts are keyboard operable with one tab stop, through native
  buttons over the marks and a described key hint; they announce each point's
  place, filters, ranges, sorts and updates through a live region, and respect
  `prefers-reduced-motion`.
- The test suite runs axe-core over the gallery in both themes, light and
  dark, with and without scripts.

## Development

```sh
npm ci
npm run typecheck && npm run lint && npm test     # unit and rendering tests
npm run build && npm run gallery                  # site/dist
npm run test:browser                              # accessibility, interaction, visual
```

Development needs Node.js 24 or later, which runs the TypeScript scripts directly; `.nvmrc`
pins 26.

The gallery is hosted at https://enarratio.dustinedwards.info as an assets-only
Cloudflare Worker (`wrangler.jsonc`), with a strict Content-Security-Policy
and the portfolio's shared security headers, from the gallery's entry in site-runtime's site registry
(`worker/index.ts`, and `_headers` from `site-runtime-headers`). `npm run deploy:gallery` builds and
deploys it; the "Deploy gallery" workflow does the same on every push to
`main` once the repository has the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets. See
[docs/design/0008-gallery-hosting.md](docs/design/0008-gallery-hosting.md). See
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and
[docs/design](docs/design/) for why Enarratio is built the way it is.

## Citing

If you use Enarratio in research, please cite it using the metadata in
[CITATION.cff](CITATION.cff).

## License

[MIT](LICENSE). Copyright (c) 2026 Dustin Edwards.
