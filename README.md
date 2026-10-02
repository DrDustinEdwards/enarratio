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
Enarratio works with any server framework. It is tested on Node.js 20, 22 and 24
and runs on Cloudflare Workers (the gallery's first site renders charts in a
Worker); Deno and Bun should work, since it uses only standard modules, but are
not yet tested.

**Gallery:** every chart, in two themes, light and dark:
[enarratio.dustinedwards.info](https://enarratio.dustinedwards.info)
(built by `npm run gallery`).

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
- **are accessible by construction**: a required written description, an
  equivalent data table, keyboard access and screen reader announcements for
  every interaction, and no reliance on color alone;
- **follow a site's theme** in light and dark mode from one render, with
  palettes checked for contrast and for color vision deficiency;
- **include scientific chart types** designed alongside the general ones,
  sharing their theming, accessibility and interaction.

## Install

```sh
npm install enarratio@next
```

That is the core: the theme, the stylesheet, the color checks, and the small
primitives (sparkline, progress ring, uptime strip, and the rest), with no
runtime dependencies. The charts are separate entry points, each with the
packages it needs as optional peer dependencies, so a site installs only what
it draws:

| Import | Holds | Also install |
|---|---|---|
| `enarratio` | Core and primitives | Nothing |
| `enarratio/plot` | `lineChart`, `areaChart`, `barChart`, `scatterPlot`, `heatmap` | `@observablehq/plot linkedom` |
| `enarratio/science` | `genomeTrack`, `titerPlot`, `geometricSummary`, `networkChart` | `@observablehq/plot d3-force linkedom` |
| `enarratio/enhance` | Browser interaction | Nothing |
| `enarratio/themes` | `defaultTheme` | Nothing |
| `enarratio/base.css` | The theme-free stylesheet | Nothing |

(`linkedom` is dropped from browser bundles, which use the browser's own
document.) Enarratio is ESM only and needs Node.js 20 or later (or any runtime with
standard ES modules). TypeScript types are included.

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

Now bars show details on hover and focus, arrow keys move between them,
Enter or a click filters by the bar's series (and fires `enarratio:select`),
legend entries become toggle buttons, and a drag or Shift with the arrow keys
picks a range on time axes (`enarratio:brush`). Escape clears. Everything is
announced to screen readers and motion stops under `prefers-reduced-motion`.

Without a bundler, serve `node_modules/enarratio/dist/enhance/index.js` as a
file (it has no imports of its own) and load it with
`<script type="module">import { enhance } from "/enhance.js"; enhance();</script>`,
or from a CDN such as
`https://cdn.jsdelivr.net/npm/enarratio@0.1.0-alpha.6/dist/enhance/index.js`.

To redraw a chart in place, pass new server markup to `update()` on the chart
`enhance()` returns. That markup should come from Enarratio: it is sanitized
before use, but it is not a way to insert arbitrary HTML.

The [examples](examples/) directory holds a runnable file for every chart in
the gallery. Each exports the chart's HTML, and `npm run gallery` renders them
all into `site/dist`.

## Charts

| Function | Import | Draws |
|---|---|---|
| `barChart` | `enarratio/plot` | Bars, stacked or grouped, vertical or horizontal, on a category or a time axis; counts rows when no value is given |
| `lineChart` | `enarratio/plot` | Lines over time or any number, with gaps, reference lines, event markers, direct labels, log y, and a forecast band with the line dashed after a chosen x |
| `areaChart` | `enarratio/plot` | Stacked areas over time |
| `scatterPlot` | `enarratio/plot` | Points on linear or log axes, symbols per series, optional regression with 95% band |
| `heatmap` | `enarratio/plot` | A grid on the theme's sequential ramp, with printed values and labelled bins |
| `networkChart` | `enarratio/science` | A force-directed network laid out on the server, deterministic |
| `titerPlot` | `enarratio/science` | Titers on a dilution axis with geometric mean, 95% CI and limit of detection |
| `genomeTrack` | `enarratio/science` | Features to scale on a nucleotide axis, arrows by strand, overlaps in lanes |
| `sparkline` | `enarratio` | A word-sized trend line |
| `progressRing` | `enarratio` | Progress toward a total |
| `uptimeStrip` | `enarratio` | Up, degraded, down or unmeasured, one tick per period |
| `heatStrip` | `enarratio` | A one-row strip on the sequential ramp, one cell per value |
| `timeline` | `enarratio` | Lanes for sites or agents, spans and point events over a time window, status by color and shape |

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
import { defaultTheme } from "enarratio/themes";

const theme = defineTheme({
  ...defaultTheme,
  name: "lab",
  fonts: { body: "Inter, system-ui, sans-serif" },
  light: { ...defaultTheme.light, background: "#fbfaf7" },
});
const css = stylesheet(theme);
const report = checkTheme(theme);
// report.issues: text below 4.5:1, marks below 3:1 (WCAG 2.2),
// and series colors closer than 10 CIEDE2000 units under simulated
// protanopia, deuteranopia or tritanopia.
```

A site whose colors and type already live in its own design tokens can skip the
`Theme` object: link `enarratio/base.css` (or call `baseStylesheet()`), define the
color and font properties yourself, and tune any size, weight, radius or animation
timing the same way, for example `--enarratio-font-size-mark` or
`--enarratio-duration-grow`. Every property has today's value as its fallback, so
setting none changes nothing. The full list is in the
[API reference](docs/api.md#custom-properties).

Any chart can override a series color with `colors: { Talks: "#8a4a1b" }` or a
light and dark pair. One theme ships with the package, `defaultTheme` in `enarratio/themes`. The
gallery's second page uses a neutral, heavily commented example theme,
[examples/themes/example.ts](examples/themes/example.ts), written to be copied
and edited.

## Accessibility

- `alt` is required. It names the chart's SVG (`role="img"`), and belongs to
  the SVG rather than the figure so that the caption and table stay readable.
- Every chart carries an equivalent data table, in a disclosure or visually
  hidden.
- Every mark has hover details that work without script, through SVG `<title>`.
- Series are distinguished by more than hue: legends and direct labels,
  symbols in scatter plots, hollow points below a limit of detection, heights
  in uptime strips, dashed outlines for missing values.
- Enhanced charts are keyboard operable, announce filters and ranges through a
  live region, and respect `prefers-reduced-motion`.
- The test suite runs axe-core over the gallery in both themes, light and
  dark, with and without scripts.

## Development

```sh
npm ci
npm run typecheck && npm run lint && npm test     # unit and rendering tests
npm run build && npm run gallery                  # site/dist
npm run test:browser                              # accessibility, interaction, visual
```

Development needs Node.js 24, which runs the TypeScript scripts directly.

The gallery is hosted at https://enarratio.dustinedwards.info as an assets-only
Cloudflare Worker (`wrangler.jsonc`), with a strict Content-Security-Policy
and security headers from `site/_headers`. `npm run deploy:gallery` builds and
deploys it; the "Deploy gallery" workflow does the same on every push to
`main` once the repository has the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets. See
[docs/design/0008-gallery-hosting.md](docs/design/0008-gallery-hosting.md). See
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and
[docs/design](docs/design/) for why Enarratio is built the way it is.

## Citing

If you use Enarratio in research, please cite it using the metadata in
[CITATION.cff](CITATION.cff).

## AI use

Enarratio was designed by Dustin Edwards and written with an AI coding
assistant. What was done by whom is recorded in [docs/AI_USAGE.md](docs/AI_USAGE.md).

## License

[MIT](LICENSE). Copyright (c) 2026 Dustin Edwards.
