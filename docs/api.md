# API reference

Enarratio is one npm package with several entry points, so a site installs and
ships only what it uses.

| Import | Holds | Needs |
|---|---|---|
| `enarratio` | Core: HTML helpers, theme types, `defineTheme`, `stylesheet`, `baseStylesheet`, `checkTheme`, color math, figure and data-table assembly, the primitives | Nothing. No runtime dependencies. |
| `enarratio/base.css` | The theme-free base rules as a stylesheet file | Nothing |
| `enarratio/plot` | `lineChart`, `areaChart`, `barChart`, `scatterPlot`, `heatmap` | Peers `@observablehq/plot`, and `linkedom` outside a browser |
| `enarratio/science` | `genomeTrack`, `titerPlot`, `geometricSummary`, `networkChart` | Peers `@observablehq/plot` and `d3-force`, and `linkedom` outside a browser |
| `enarratio/lite` | `barChart`, `lineChart`, `areaChart` drawn without Observable Plot; also one entry per chart: `enarratio/lite/bar`, `enarratio/lite/line`, `enarratio/lite/area` | Nothing |
| `enarratio/enhance` | Interaction for charts already on the page; runs in the browser | Nothing |
| `enarratio/redraw` | Draws a server's chart again at its frame's width in the browser, then enhances it | Nothing |
| `enarratio/themes` | The themes that ship with the package | Nothing |

`@observablehq/plot`, `d3-force` and `linkedom` are optional peer dependencies:
npm 7 and later does not install them for a site that imports only the core.
Install what the entries you import need, for example
`npm install @observablehq/plot linkedom` for `enarratio/plot`. Where a bundler
builds for browsers (the `browser` export condition) `linkedom` is dropped and
the browser's own document is used; Worker, Node.js, Deno and Bun builds keep it.
`enarratio/science` needs `d3-force` for `networkChart` even when a
page draws only a titer plot; split imports are not possible within one entry.

Everything returns HTML strings. Charts and primitives run anywhere (server,
build step); the primitives, the core, `enarratio/lite` and `enarratio/enhance`
also run in the browser. Where a section below names a function, its import is the entry above.

Every chart function takes one options object and returns a string. Options
are checked when the chart is drawn, and anything that would draw a wrong
chart (a missing field, a non-finite number, an unknown series in `colors`,
more series than the palette has colors) throws an `Error` naming the chart,
the row and the field. Nothing is silently dropped or defaulted: empty data,
an all-empty series, a non-positive `width` or `height`, and a value a log
axis cannot show all throw.

Every caller-supplied string is escaped: data values, labels, titles, captions,
`alt`, ids and formatter output reach the page as text, never as markup (a test
feeds hostile text through every function and parses the result).

The TypeScript declarations carry the same documentation, field by field, and
show in any editor. This page is the map; a test fails if an export is missing
from it.

## Core building blocks

The pieces every chart is made from, exported so a site can build its own figure
with the same markup, escaping and data table as the charts it imports.

### `escapeHtml`

`escapeHtml(value: string): string`. Escapes text for use as HTML element
content or as a double-quoted attribute value.

### `element`

`element(tag, attrs, children?): string`. One element as a string. Attribute
values are escaped; `false` and `undefined` omit the attribute and `true` writes
it bare. `children` is trusted markup: escape text with `escapeHtml` first.

### `AttributeValue`

`string | number | boolean | undefined`, the type of an attribute in `element`.

### `figure`

`figure(options: FigureOptions, parts: FigureParts): string`. Assembles the
figure every chart is delivered in (title, legend, the SVG named by `alt`,
caption and data table) from an SVG and a `DataTable`. Without an `alt` it
names the SVG from the description's overview and summary and reports
`alt-missing`.

### `FigureParts`

`kind`, `svg`, `table`, and optionally `legend`, `ramp`, `seriesField`, `x`
(a `ScaleDescription`), `orientation`, `slotColors`, and:

- `description`: a [`ChartDescription`](#chartdescription), from which the
  overview and summary are written.
- `limits`: `{ series?, points?, advice? }`, replacing the default 6 series and
  1,000 points past which a chart reports an issue, and what the issue advises.
- `method`: a sentence the chart writes about how it computed what it draws,
  added to the caption after the author's text is checked for reading level.
- `tableMarkup`: `(caption) => string`, a visible table that is the figure's
  data table, in place of the drawing and the hidden table (`tableChart`).
- `fixed`: a drawing that keeps its own small size (the primitives).

### `ChartDescription`

What a chart tells its figure so the figure can describe it in words: `axes`
(each an [`AxisRange`](#axisrange)), `series` (each a `SummarySeries`), and
optionally `kind` (the kind the overview names), `ordered` (points run in
order, so a trend means something), `format`, `interval` (what a drawn
interval is, such as "95% interval"), `log` and `sentence` (a sentence of the
chart's own).

### `SummarySeries`

`{ name; points: SummaryPoint[] }`: one series of values, in display order.

### `SummaryPoint`

`{ at; value; lower?; upper? }`: one value, where it is as text (its
category, date or x), and its interval when the chart draws one.

### `DataTable`

`{ columns: string[]; rows: string[][] }`. The first column holds row headers.

### `LegendItem`

`{ label: string; slot: number }`, the slot being a palette slot from 1 to 8.

### `RampItem`

`{ label: string; step: number }`, the step being a ramp step from 1 to 5.

### `ScaleDescription`

`{ type; domain; range }`: a scale as the enhancement layer needs it to turn a
pointer position back into data.

### `validateFigure`

`validateFigure(kind: string, options: FigureOptions): void`. Throws unless
any `width` and `height` are positive and finite.

### `slotStyle`

`slotStyle(colors?: ReadonlyMap<number, SeriesColor>): string | undefined`. Per-figure
palette overrides as CSS declarations, which a chart carries in its
`data-enarratio-colors` attribute (never a `style` attribute); throws on a color
that is not hex, a color function or `var()`.

## Common options

### `FigureOptions`

Every chart accepts these; the primitives take the text and issue options
through [`PrimitiveFigureOptions`](#primitivefigureoptions). A site sets the
shared ones once (`const site = { locale: "de-DE", strict: true }`) and
spreads them into each chart.

| Option | Type | Meaning |
|---|---|---|
| `alt` | `string` | What the chart shows, including its finding. Names the SVG for assistive technology and is shown as the finding under the title. Without it the chart names itself from its overview and summary and reports `alt-missing` (B52). |
| `title` | `string` | Visible title above the chart. Without it, a `title-missing` issue. |
| `subtitle` | `string` | A line under the title: what the chart shows, or how to read it (B17). |
| `caption` | `string` | Visible caption below: method, caveats. |
| `notes` | `string` or `string[]` | Notes below: definitions, exclusions (B23). |
| `source` | `string` or `{ name, href? }` | The source line, linked when `href` is given (relative or http(s)). |
| `byline` | `string` | Who made the chart, in the source line. |
| `summary` | `string` or `false` | The summary under the chart. Computed from the data by default: each series' trend (with a peak or low that stands out), the highest and lowest values, values far from the rest, and the last interval drawn (B39, B24). `false` leaves it out. |
| `csv` | `boolean` | The "Download CSV" link, built from the data table as a `data:` URL with `download` (default `true`). Over 100,000 characters there is no link and a `csv-too-large` issue. |
| `csvHref` | `string` | A CSV file the site serves, linked instead (build it with [`toCsv`](#tocsv)). |
| `locale` | `string` | BCP 47 locale for generated numbers and dates (default `"en-US"`). |
| `strings` | [`StringOverrides`](#stringoverrides) | Translations of the generated text; see [`Strings`](#strings). |
| `strict` | `boolean` | Throw on the first [issue](#chartissue) instead of reporting it, so a build fails. |
| `onIssue` | `(issue: ChartIssue) => void` | Receives issues instead of `console.warn`. |
| `id` | `string` | The figure's `id`, reported as `chartId` in events. |
| `width`, `height` | `number` | Drawing size in CSS pixels, positive and finite. Drawings 480 pixels or wider keep at least 30rem on narrow screens and scroll sideways inside the figure, so their text stays readable. That frame is in the tab order (`tabindex="0"`) and named "{title}, scrolls sideways" ("Chart" without a title), so a keyboard can scroll it; `enhance()` drops that tab stop once the marks take focus. |
| `dataTable` | `"details"` or `"visually-hidden"` | How the always-present data table is shown. Default `"details"`, closed, labeled "Show data" (and "Hide data" when open). |
| `hoverTitles` | `boolean` | The browser's hover title (a `<title>`) on each mark, on by default. `false` leaves them out, for a site that shows no hover tooltips; each mark's details move to `data-enarratio-label`, which `enhance()` still names its points with, and the data stay in the table. |

Bar, line, area and scatter charts, and the diverging, waterfall, small
multiples, histogram, density, box, strip, dot, range and dumbbell charts and
dose-response curves and titer plots, also take [`AxisUnits`](#axisunits);
survival, forest and tree plots take `xUnit`.

A chart returns:

```html
<figure class="enarratio" data-enarratio="bar" id="...">
  <figcaption class="enarratio-head">
    <p class="enarratio-title">...</p>
    <p class="enarratio-subtitle">...</p>
    <p class="enarratio-finding" aria-hidden="true">{alt}</p>
  </figcaption>
  <p class="enarratio-overview enarratio-visually-hidden">Bar chart with 18 points. X axis, Year: 2019 to 2024. ...</p>
  <ul class="enarratio-legend">...</ul>
  <div class="enarratio-frame enarratio-frame-wide" tabindex="0" role="group" aria-label="{title}, scrolls sideways">
    <svg role="img" aria-label="{alt}">... one keyed element per datum ...</svg>
  </div>
  <p class="enarratio-summary">Publications rose from 3 (2019) to 7 (2024). ...</p>
  <p class="enarratio-caption">...</p>
  <p class="enarratio-note">Notes: ...</p>
  <p class="enarratio-source">Source: <a href="...">...</a> · By ... · <a class="enarratio-csv" download="....csv" href="data:text/csv;...">Download CSV</a></p>
  <details class="enarratio-data"><summary>Show data / Hide data</summary><table>...</table></details>
</figure>
```

The finding repeats the SVG's name for sighted readers, so it is hidden from
assistive technology, which reads it once on the SVG. The overview (B53) is
read before the chart: its type, series and points, and each axis's range,
its numbers written as the chart's ticks and table write them ("0 to 1", not
"0.000 to 1.000").

### `AxisUnits`

`xUnit` and `yUnit`: units added to the axis label and the table header,
"Weight (kg)" (B23). A hidden (`null`) label stays hidden, and a label that
already names the unit as a word ("Reads per sample", unit `reads`) is left as
it is rather than "Reads per sample (reads)".

### `ChartIssue`

What a chart reports while it renders: `{ chart, code, message }`, where
`chart` is its `data-enarratio` kind and `code` is one of `alt-missing`,
`title-missing`, `axis-label-missing` (an axis with no label and no title),
`too-many-series` (more than 6) or `too-many-points` (more than 1,000), both
suggesting small multiples or a table (B21), `reading-level` (an `alt`,
`subtitle` or `caption` of 15 words or more above grade 9, B19) and
`csv-too-large`. Issues go to `onIssue`, else `console.warn`; with `strict`
the first one throws an `Error` naming the chart, which fails a build.

### `IssueOptions`

`strict` and `onIssue`, as above.

### `Source`

A source line's source: a name, or `{ name, href }`.

### `Strings`

Every generated string: the disclosure labels, table caption, frame name,
source and CSV labels, chart kind names (`kinds`), and the overview and
summary sentences as functions of already formatted values, including the
science charts' (`geometricMeans`, `limitOfDetection`, `genomeSummary`,
`networkSummary`) and the primitives' text alternatives (`sparklineSummary`,
`heatStripSummary`, `uptimeSummary`, `progressSummary`, `timelineSummary`).
Pass a partial table as `strings`; the rest stay English. [`ENGLISH`](#english)
is the default to start a translation from. `terms` holds the words charts and
primitives print in their tables, legends, hover details and summaries (Count,
Median, Running total, no data, Forecast, the statuses and so on); see
[`Terms`](#terms). With `locale` as well, every string a chart or primitive
generates is translated, and every number in it follows the locale.

```ts
barChart({ ...options, locale: "de-DE", strings: { showData: "Daten zeigen", hideData: "Daten verbergen", downloadCsv: "CSV herunterladen" } });
```

### `StringOverrides`

The `strings` option: any part of [`Strings`](#strings), with `terms` partial
too, so one word can be changed without the rest.

```ts
pieChart({ ...options, strings: { terms: { share: "Anteil", total: "Summe" } } });
```

### `Terms`

The words charts print, such as `count`, `median`, `share`, `total`,
`runningTotal`, `rising` and `falling`, `atRisk` and `survivalProbability`,
`noData` and `forecast`, a titer plot's `gmt` and `lod`, a genome track's
`forwardStrand` and `nucleotides`, and the primitives' `cell`, `period` and
statuses (`up`, `down`, `ok`, `error` and the rest). `ENGLISH.terms` lists them
all.

### `ENGLISH`

The English [`Strings`](#strings).

### `At`

A value and where it is, both formatted: `{ value, at }`, as the summary
strings receive them.

### `AxisRange`

An axis as the overview states it: `{ position: "x" | "y" | "size", label, from, to }`.

### `numberFormat`

`numberFormat(options?: NumberFormatOptions): (value: number) => string`. A
formatter for a locale and style, to pass as `formatValue` (C10).

```ts
numberFormat({ locale: "de-DE", style: "currency", currency: "EUR" })(1234.5); // "1.234,50 €"
numberFormat({ style: "compact" })(1200); // "1.2K"
numberFormat({ style: "si", unit: "B" })(1_500_000); // "1.5 MB"
```

### `NumberFormatOptions`

`locale`, `style` (`"decimal"`, `"percent"`, `"currency"`, `"compact"`,
`"si"` or `"unit"`), `currency` (ISO 4217), `unit` (an Intl unit for
`"unit"`, any symbol after an SI prefix), `maximumFractionDigits` and
`maximumSignificantDigits`.

### `dateFormat`

`dateFormat(options?: DateFormatOptions): (date: Date) => string`. Writes
dates out for a locale ("January 5, 2026"), with the time and the time zone
named when `time` is set (B40, C11). Line and area charts write their x
dates this way in the table, hover details and summary; filter events and
`data-enarratio-x` keep ISO dates.

### `DateFormatOptions`

`locale`, `timeZone` (IANA, default `"UTC"`) and `time`.

### `readingGrade`

`readingGrade(text: string): number`. The Flesch-Kincaid grade level of
English text. Generated summaries stay at 9 or below; charts report author
text above it (B19).

### `toCsv`

`toCsv(rows: string[][]): string`. Rows as CSV (RFC 4180, CRLF), the same
encoding as the "Download CSV" link: fields with a comma, quote or line break
are quoted, and a field a spreadsheet would run as a formula gets a leading
apostrophe. For the file behind `csvHref`.

### `datasetJsonLd`

`datasetJsonLd(options: DatasetOptions): string`. A
`<script type="application/ld+json">` schema.org `Dataset` entry for data a
site wants indexed (C14). A data block, never run, so a strict CSP allows it.

### `DatasetOptions`

`name` and `description` (required), `url`, `csvHref` (as a `DataDownload`),
`creator`, `license`, `datePublished`, `temporalCoverage`, `keywords` and
`variables` (the measured columns).

### `SeriesColor`

A color override for one series: any CSS color (`"#8a4a1b"`,
`"var(--brand)"`), or `{ light, dark }`, rendered with CSS `light-dark()`.
Given in a chart's `colors` option, keyed by series name. The chart carries the
override in `data-enarratio-colors`, not a `style` attribute, so it works under
a hash-based Content-Security-Policy; the page adds the rules
[`colorStyles`](#colorstyles) returns to its own CSS. A chart with no
`series` field has one series whose name is its value label: `yLabel` (or
"Count" for counted bars, "Value" when the label is hidden) for bar, line and
area charts; "Points" for a scatter plot; "Samples" for a titer plot with
`colorByGroup: false`.

Each drawn datum carries `data-enarratio-key`, which is opaque (compare keys,
never parse them), and `data-enarratio-col` and `data-enarratio-row`, its place
in keyboard reading order.

## Charts: `enarratio/plot`

### `barChart`

`barChart(options: BarChartOptions<T>): string`. Bars for categories, one
series or several stacked or grouped. When `y` is omitted it counts rows, so
one row per item (a CV entry, a case) is enough.

### `BarChartOptions`

`data`, `x` (category field), `y` (value field, optional), `series`,
`layout` (`"stacked"` or `"grouped"`), `orientation` (`"vertical"` or
`"horizontal"`), `xDomain` (every category in order, including empty ones),
`seriesDomain`, `colors`, `xLabel`, `yLabel`, `formatValue`, and:

- `filterBy`: what a click filters by once enhanced, `"series"` (the default
  when there are series) or `"x"` (the bar's category, such as its year).
- `href`: a function from category to link. Each category in the data table
  is that link, which keyboards and screen readers reach, and each bar carries
  it in `data-enarratio-href` (the SVG stays one image, with no links inside).
  With the enhancement layer a bar that filters still filters, and the page can
  follow the link on `enarratio:select`; with `filter: false` a click on a bar
  follows its link, and its point is that link. Only relative and `http(s)`
  links are allowed.
- `maxXTicks`: the most category labels to print; with more categories, every
  nth label is printed from the first. Without it, labels under vertical bars
  are thinned the same way when they would come within 12 units of each other
  at the width drawn (seven day names at 254), as line charts' x ticks are.
- `directLabels`: print each series' name inside the stacked segments it fits
  in, so series are told apart by text as well as color. Stacked layout only.
- `xType: "time"`, with `interval`, `formatX`: a time axis. `x` is a Date, an
  ISO 8601 string or epoch milliseconds; each row falls in the `interval`
  (`"hour"`, `"day"` the default, `"week"` starting Monday, `"month"` or
  `"year"`, all UTC) that contains it, and there is one bar slot for every
  interval from the first row's to the last's, empty ones included, so a quiet
  day is a gap in the chart and a zero in the table. Bars are labeled by their
  first moment (`2026-01-05`, `2026-01`, `2026`, `2026-01-05 14:00 UTC`) or by
  `formatX(start)`, which must give every interval its own label. Rows in an
  interval and series are summed, or counted when `y` is omitted. Works with
  stacked and grouped series and horizontal bars. Long axes print every nth
  label unless `maxXTicks` says otherwise; every bar keeps its hover details
  and table row. `xDomain` is not used with it, and `interval` and `formatX`
  need `xType: "time"`. More than 2000 intervals throw.

- `errorBars: { lower, upper, label? }`: an error bar on each bar, from two
  fields you computed (a 95% CI, ± one SD), capped at both ends, with a column
  per series in the data table and the interval in hover details. Needs `y`,
  and the grouped layout when there are series. A row's bounds must surround
  its value. `enarratio/lite` draws them too.
- `annotations`: see [`Annotation`](#annotation). Not on grouped bars.

Links given by `href` must be relative or `http(s)`; a `//host` link, or any
other scheme, throws. Count axes end at their last whole-number tick.

### `lineChart`

`lineChart(options: LineChartOptions<T>): string`. Lines over time or any
continuous x. `null` values are gaps. Supports `references`, `markers`,
`directLabels`, `points`, `yType: "log"` and `zero`.

### `areaChart`

`areaChart(options: AreaChartOptions<T>): string`. Stacked areas; values
must be zero or more.

### `AreaChartOptions`

`SeriesChartOptions` plus `percent` and `annotations`. With `percent: true`
each x stacks to 100%: every series is drawn, described and tabled as its share
of that x's total, the y label defaults to "Share of total (%)" and values print
as percentages. `enarratio/lite` draws `percent` too, identically.

### `SeriesChartOptions`

Options shared by line and area charts: `data`, `x`, `y`, `series`, `xType`
(`"time"` or `"linear"`), `seriesDomain`, `colors`, `xLabel`, `yLabel`,
`formatValue`, `formatX`, `references`, `markers`, `maxXTicks`.

- x tick labels are thinned to what fits the drawing's width (every nth from
  the first, about 7 units a character), so they never overlap on a narrow
  chart; `maxXTicks` caps them lower still (on a plain number or time axis it
  is the count asked for, which nice steps may round). Both renderers thin
  alike.
- `x` holds Dates or ISO 8601 strings (time) or numbers (linear). `xType` is
  inferred from the first row, so epoch milliseconds, being numbers, need
  `xType: "time"`.
- Dates are instants in UTC, except that when every Date falls at local
  midnight they are read as calendar dates, so `new Date(2025, 0, 6)` is 6
  January wherever the server runs.
- Rows are told apart by the x value itself, so hourly and finer data works;
  its default label adds the UTC time (`2026-01-01 14:00 UTC`). Numbers that
  look like years (whole, 1000 to 2999) print without a thousands separator.
- In an area chart a missing value is a gap: no point, no hover text, a blank
  table cell.

### `LineChartOptions`

`SeriesChartOptions` plus `points`, `directLabels`, `yType`, `zero`,
`annotations`, and the forecast options `band`, `forecastFrom` and
`forecastLabel`. With
`yType: "log"`, a value of zero or less (or a band lower bound of zero or less)
throws.

**Forecasts are computed by the caller; Enarratio only draws them.**

- `band: { lower, upper, label? }` draws a shaded area between two fields, in
  each series' color behind its line. A row has both bounds or neither
  (neither is a gap in the band); a lower bound above its upper bound throws.
  The data table gains two columns per series (`Lower bound` and `Upper bound`,
  or `95% interval, lower` when `label` is `"95% interval"`; with several series,
  prefixed by the series name), and hover details say the interval.
- `forecastFrom` is the x after which the data are a forecast: rows with x
  greater than it. The line is dashed from there (each series joined to its
  last observed point), points are hollow, a rule labeled `forecastLabel`
  (default "Forecast") marks the boundary, and the data table gets a `Forecast`
  column reading `Yes` on those rows. It must lie within the data's x range and
  before the last x, so that some rows are observed and some forecast.
- The two work apart or together. A chart without them is drawn exactly as
  before.

### `LineBand`

`{ lower: field; upper: field; label?: string }`: the fields holding a band's
bounds, and what the band is called.

### `ReferenceLine`

`{ y: number; label: string }`: a labeled horizontal line, such as a threshold.

### `EventMarker`

`{ x: number | Date | string; label: string }`: a labeled vertical line, such
as a deploy or an intervention.

### Light charts: `enarratio/lite`

`barChart`, `lineChart` and `areaChart` are also exported from `enarratio/lite`,
for drawing in the browser. They take the same options (the same types, under
the same names, `errorBars` and `annotations` included) and return the same
figure: the SVG is the one the Plot charts
draw, element for element, with coordinates equal to the hundredth of a pixel,
and a test holds every gallery example and a matrix of options to that. The
two exceptions are where the Plot chart is wrong (a bar link's accessible name,
and bars whose values are all zero), listed in design record 0017. They
need no Observable Plot, no linkedom and no DOM (the SVG is built as a string),
so they run in a browser, a Worker or a server alike. Bundled for the browser,
minified and gzipped, each is about 15 kB (`npm run size` measures them and
fails above 40 kB); the Plot versions are about 90 kB without linkedom. Import
one chart's entry, such as `enarratio/lite/bar`, for the smallest bundle. The
Plot charts in `enarratio/plot` are unchanged and remain the ones for server
rendering alongside the other Plot charts. Design record 0017 has the reasons.

### `scatterPlot`

`scatterPlot(options: ScatterPlotOptions<T>): string`. Points by two numeric
fields, with series told apart by color and symbol, and an optional ordinary
least-squares line with its 95% confidence band.

### `ScatterPlotOptions`

`data`, `x`, `y`, `series`, `label` (names each point), `xType`, `yType`
(`"linear"` or `"log"`), `regression`, `seriesDomain`, `colors`, `xLabel`,
`yLabel`, `formatValue`, `annotations`, and:

- `size`, `sizeLabel`: a field sizing each point by area (zero or more), making
  a bubble chart. A legend of three reference circles, drawn from the chart's
  own size scale, sits in the right margin, and the data table gains a column.
- `errorBars: { lower, upper, label? }`: a vertical error bar on each point
  around y, as on `barChart`.

### `Annotation`

A note or a highlighted range, given to `barChart`, `lineChart`, `areaChart`,
`scatterPlot` and most charts below in `annotations`:

- `{ type: "note", x, y, text, dx?, dy? }`: text at a point on the chart's x
  and y fields. Offset by `dx`, `dy` pixels, an arrow runs from the text to the
  point.
- `{ type: "range", axis: "x" | "y", from, to, label? }`: a shaded band across
  the chart between two positions on one axis, behind the marks. A range from
  a value to itself (`from` equal to `to` on a continuous axis) is drawn as a
  dashed line there.

On bar charts `x` is the category axis whichever way the bars run. Every note
and range is also added to the chart's text alternative ("Notes on the chart:
…"), since the drawing is one image to a screen reader. A range is said with
its axis's unit ("Target: 500 to 630 words"), or after the axis's label when
there is no unit ("Target: Words 500 to 630"). A position off the axis throws.

### `AnnotationValue`

`number | string | Date`: a number, a date (a Date or an ISO 8601 string, on
a time axis) or a category.

### `IntervalFields`

`{ lower: field; upper: field; label?: string }`: the fields holding an
interval you computed (error bars, a confidence interval), and what it is
called in the table and hover details. A row has both bounds or neither, and
the bounds must surround the value.

### `divergingBarChart`

`divergingBarChart(options: DivergingBarChartOptions<T>): string`. Bars for
signed values about zero (changes, differences from a baseline): positive one
way and negative the other from a drawn zero line, in two colors, each bar
labeled with its signed value (`+4.2`, `−3.4`), so the sign reads from position
and text as well as color.

### `DivergingBarChartOptions`

`data`, `x` (category), `y` (signed value), `orientation` (`"horizontal"`, the
default, or `"vertical"`), `sort` (`"data"` or `"descending"`),
`positiveLabel`, `negativeLabel` (legend names; default "Above zero" and
"Below zero"), `colors`, `xDomain`, `xLabel`, `yLabel`, `formatValue`,
`annotations`. One row per category.

### `waterfallChart`

`waterfallChart(options: WaterfallChartOptions<T>): string`. A bridge from one
total to another: each change floats from the level the last one reached,
joined by dashed connectors, and totals stand on zero. Increases, decreases and
totals differ in color and every bar is labeled with its signed change or its
total. The data table gives each change and the running total.

### `WaterfallChartOptions`

`data`, `x` (step name), `y` (the change), `total` (a boolean field marking
total rows), `increaseLabel`, `decreaseLabel`, `totalLabel`, `colors`,
`xLabel`, `yLabel`, `formatValue`, `annotations`. A total row's `y` is the
total: the first row's sets the starting level; later ones may be `null` (the
running sum is drawn) or must equal it, or it throws.

### `smallMultiples`

`smallMultiples(options: SmallMultiplesOptions<T>): string`. One bar chart
(`chart: "bar"`, stacked when there are series) or line chart
(`chart: "line"`) per value of `facet`, in a grid, on shared scales. Each panel
is named above it, a series keeps one color across panels, every value is keyed
with its panel, and the data table has a row per panel and x.

### `SmallMultiplesOptions`

`chart`, `data`, `facet`, `facetDomain`, `columns` (panels per row, default
3), `panelHeight` (default 160), and the panel chart's fields: for bars `x`,
`y`, `series`, `xDomain`, `seriesDomain`, `colors`, `xLabel`, `yLabel`,
`formatValue`; for lines the same without `xDomain`, plus `xType` and
`formatX`. At most 24 panels.

### `histogram`

`histogram(options: HistogramOptions<T>): string`. Counts of one measurement
in bins with round edges, the last bin including its upper edge, optionally
with a Gaussian kernel density curve scaled to counts. The data table lists
every bin, empty ones too.

### `HistogramOptions`

`data`, `x`, `thresholds` (a target number of bins, default Sturges' rule
ceil(log2 n) + 1, or the ascending edges, which must cover every value),
`density`, `color`, `xLabel`, `yLabel` (default "Count"), `formatValue`,
`annotations`.

### `densityPlot`

`densityPlot(options: DensityPlotOptions<T>): string`. Gaussian kernel density
estimates of one measurement, a curve per series on shared axes, told apart by
color, dash and a label at each peak. The bandwidth is Silverman's rule of
thumb, 0.9 min(SD, IQR/1.34) n^(-1/5), per series, unless given; the caption
states n and bandwidth, and the data table gives each curve's density at 15
evenly spaced values.

### `DensityPlotOptions`

`data`, `x`, `series`, `seriesDomain`, `bandwidth`, `colors`, `xLabel`,
`yLabel` (default "Density"), `formatValue`, `annotations`.

### `boxPlot`

`boxPlot(options: BoxPlotOptions<T>): string`. A Tukey box plot per group: the
box spans the quartiles (linear interpolation, R's default type 7) with a line
at the median, whiskers reach the furthest values within 1.5 IQR, and values
beyond are drawn as points. With `points: true` every value is drawn beside its
box in a beeswarm. The data table gives each group's n, minimum, quartiles,
maximum, whiskers and outliers.

### `BoxPlotOptions`

`data`, `x` (group), `y` (value), `xDomain`, `points`, `colorByGroup`,
`colors`, `xLabel`, `yLabel`, `formatValue`, `annotations`.

### `stripPlot`

`stripPlot(options: StripPlotOptions<T>): string`. Every value as a point, a
column per group, spread in a beeswarm (each point takes the place nearest the
center line where it overlaps no other) or a fixed jitter. The data table lists
every value.

### `StripPlotOptions`

`BoxPlotOptions` without `points`, plus `label` (names each value) and
`layout` (`"beeswarm"`, the default, or `"jitter"`, the same on every render).

### `dotPlot`

`dotPlot(options: DotPlotOptions<T>): string`. A Cleveland dot plot: a row per
item, a dot at each value, on an axis that need not start at zero. With
`series`, each item has a dot per series, told apart by color and symbol; with
`errorBars`, each dot has its interval.

### `DotPlotOptions`

`data`, `y` (item), `x` (value), `series`, `seriesDomain`, `errorBars`, `sort`
(`"data"` or `"descending"`), `yDomain`, `colors`, `xLabel`, `yLabel`,
`formatValue`, `zero`, `annotations`.

### `rangePlot`

`rangePlot(options: RangePlotOptions<T>): string`. A row per item, a bar from
its low to its high value, with an optional marked value (a median, a current
reading) as a tick inside it.

### `RangePlotOptions`

`data`, `y`, `low`, `high`, `value`, `valueLabel`, `yDomain`, `colors`,
`xLabel`, `yLabel`, `formatValue`, `zero`, `annotations`. `low` above `high`,
or a value outside its range, throws.

### `dumbbellPlot`

`dumbbellPlot(options: DumbbellPlotOptions<T>): string`. A row per item, two
values joined by a line: `from` a hollow circle, `to` a filled one, so the ends
differ by fill as well as color. The data table gives both and the change.

### `DumbbellPlotOptions`

`data`, `y`, `from`, `to`, `fromLabel`, `toLabel`, `sort` (`"data"` or
`"change"`), `yDomain`, `colors`, `xLabel`, `yLabel`, `formatValue`, `zero`,
`annotations`.

### `slopeChart`

`slopeChart(options: SlopeChartOptions<T>): string`. Each item's value at two
time points joined by a line and labeled with its name and value at both ends,
labels moved apart where values are close. Rising and falling lines differ in
color and dash. At most 30 items.

### `SlopeChartOptions`

`data`, `label`, `from`, `to`, `fromLabel`, `toLabel`, `colors` (by
"Rising", "Falling", "No change"), `formatValue`.

### `pieChart`

`pieChart(options: PieChartOptions<T>): string`. A pie, or a donut with
`donut: true`, for the parts of one whole. Slices run clockwise from 12
o'clock in data order, separated by a gap, each labeled outside with its name
and share. **More than six slices are a `too-many-points` issue** (which
`strict` throws), suggesting a bar chart or an "Other" slice: past that, angles
are too close to compare. More than eight throw, as the palette has eight
colors. A negative value, or a total
of zero, throws. The data table gives each value, its share and the total.

### `PieChartOptions`

`data`, `label`, `value`, `donut`, `centerLabel` (text in the donut's hole),
`colors`, `formatValue`.

### `heatmap`

`heatmap(options: HeatmapOptions<T>): string`. A grid colored on the theme's
five-step sequential ramp, with a labeled legend of the bins, values printed
in cells in a readable color, and dashed outlines for empty cells.

### `HeatmapOptions`

`data`, `x`, `y`, `value`, `xDomain`, `yDomain`, `thresholds` (four ascending
values; default equal intervals), `cellLabels`, `xLabel`, `yLabel`,
`valueLabel`, `formatValue`. Once enhanced, a click on a cell filters by its
row (the `y` field), and arrow keys move across columns and down rows.

### `networkChart`

`networkChart(options: NetworkChartOptions): string`. From `enarratio/science`. A force-directed
network laid out on the server with d3-force. The layout is deterministic: the
same data always draws the same picture. The summary gives the number of nodes
and links, the three most connected nodes, and how many separate parts the
network falls into.

### `NetworkChartOptions`

`nodes`, `links`, `groupDomain`, `colors`, `nodeLabels`, `iterations`.

### `NetworkNode`

`{ id: string; label?: string; group?: string }`.

### `NetworkLink`

`{ source: string; target: string }`, by node id.

## Scientific charts: `enarratio/science`

These, and `networkChart` above, import from `enarratio/science`.

### `titerPlot`

`titerPlot(options: TiterPlotOptions<T>): string`. Titers (reciprocal
dilutions) by group on a logarithmic dilution axis: each sample as a point,
identical titers spread side by side, the geometric mean titer with its 95%
confidence interval, and the limit of detection. Values below the limit are
drawn hollow at half the limit, and counted that way in the GMT.

### `TiterPlotOptions`

`data`, `group`, `titer`, `dilution`, `limitOfDetection`, `groupDomain`,
`colorByGroup`, `colors`, `tickLabels` (`"ratio"` for 1:40 or `"reciprocal"`
for 40), `groupLabel` and `titerLabel` (default "Titer"), with `xUnit` and
`yUnit` added to them. The summary names the highest and lowest titers, each
group's geometric mean titer with its 95% interval, and the limit of detection
with how many samples fall below it; the overview gives both axes' ranges.

### `DilutionSeries`

`{ start: number; factor: number }`: the first reciprocal dilution and the
step factor, e.g. `{ start: 10, factor: 2 }` for 1:10 two-fold.

### `genomeTrack`

`genomeTrack(options: GenomeTrackOptions): string`. Features drawn to scale on
a nucleotide axis, as arrows pointing along their strand, one row per track,
with overlapping features packed into lanes. The summary gives the number of
features, the shortest and longest, how many run on each strand, and how many
pairs overlap within a track; the overview gives the position axis's range.

### `GenomeTrackOptions`

`features`, `length`, `trackDomain`, `typeDomain`, `colors`, `positionLabel`,
`featureLabels`.

### `GenomeFeature`

`{ name; start; end; strand?: 1 | -1 | 0; type?; track? }`, with 1-based,
inclusive coordinates as in GenBank and GFF.

### `geometricSummary`

`geometricSummary(values: number[]): GeometricSummary`. The geometric mean of
positive values and its 95% confidence interval from Student's t on the log
scale. Used by `titerPlot`, exported for tables and text that must agree with
the chart.

### `GeometricSummary`

`{ n: number; mean: number; lower?: number; upper?: number }`. No interval for
a single value.

### `doseResponse`

`doseResponse(options: DoseResponseOptions<T>): string`. Responses as points on
a log dose axis, the four-parameter logistic curve through them, and the EC50
(or IC50) marked with a dashed drop line and its value. The curve is fitted by
`fitLogistic`, or drawn from `parameters` you give. Groups differ by color,
symbol and dash. The caption states each curve (EC50 with its 95% interval,
Hill slope, bottom and top), and the data table gives every measurement beside
the curve's value at its dose.

### `DoseResponseOptions`

`data`, `dose` (above zero), `response`, `group`, `groupDomain`, `parameters`
(by group name: `LogisticParameters`), `midpointLabel` (default "EC50"),
`colors`, `doseLabel`, `responseLabel`, `formatValue`.

### `fitLogistic`

`fitLogistic(doses: number[], responses: number[]): LogisticFit`. A
least-squares fit of bottom + (top − bottom) / (1 + (EC50 / dose)^hill) by
Levenberg-Marquardt, in log EC50, from several starts, keeping the best. The
EC50's 95% interval is the Wald interval on log EC50 (± t(0.975, n − 4)
standard errors from s²(JᵀJ)⁻¹), as GraphPad Prism reports it. Doses of zero
are allowed (the curve's limit there); it needs four distinct positive doses,
and five points for the interval. It matches R's `drc` (`LL.4`) on the
ryegrass data to five digits.

### `logistic`

`logistic(parameters: LogisticParameters, dose: number): number`. The 4PL
curve's value at a dose.

### `LogisticParameters`

`{ bottom; top; ec50; hill }`. A positive Hill slope rises with dose, a
negative one falls.

### `LogisticFit`

`LogisticParameters` plus `n`, `rss` (residual sum of squares) and, from five
points, `ec50Lower` and `ec50Upper`.

### `survivalPlot`

`survivalPlot(options: SurvivalPlotOptions<T>): string`. Kaplan-Meier curves:
each group's survival as a step line from 1 at time zero, a + at each censored
time, the 95% confidence band, and the number at risk at each time tick printed
under the axis. Groups differ by color, dash and an end label. The caption
gives each group's n, events and median survival; the data table gives every
step: time, at risk, events, censored, survival and its interval.

### `SurvivalPlotOptions`

`data`, `time`, `event` (true or 1 for the event, false or 0 for censored),
`group`, `groupDomain`, `confidence` (default on for one group, off for more),
`atRisk` (default true), `colors`, `timeLabel`, `survivalLabel`.

### `kaplanMeier`

`kaplanMeier(times: number[], events: boolean[]): SurvivalEstimate`. The
Kaplan-Meier product-limit estimate, with Greenwood's standard error and the
log-log 95% interval (Kalbfleisch and Prentice), which stays within 0 and 1.
At a time with both, events come before censoring. It matches the published
6-MP estimates (Freireich et al. 1963) and R's `survfit(conf.type = "log-log")`.

### `SurvivalEstimate`

`{ n; events; steps: SurvivalStep[]; censorTimes; end; median? }`. `median`
is the first time survival falls to 0.5 or below, absent when it never does.

### `SurvivalStep`

`{ time; atRisk; events; censored; survival; standardError; lower; upper }`,
one per distinct time with an event.

### `forestPlot`

`forestPlot(options: ForestPlotOptions<T>): string`. Study estimates as squares
sized by weight with their 95% intervals, against a line of no effect, and the
pooled estimate as a diamond spanning its interval. Every estimate and
interval is also printed in a column on the right. The caption states the
pooling method and heterogeneity; the data table gives every row and weight.

### `ForestPlotOptions`

`data`, `label`, `estimate`, `lower`, `upper`, `weight`, `pooled` (`"fixed"`,
`"random"` or a `StudyEstimate` with an optional `label`), `log` (for ratios:
a log axis, no effect at 1), `nullValue`, `estimateLabel`, `favors` (words
for each side of no effect), `formatValue`.

### `poolEstimates`

`poolEstimates(studies: StudyEstimate[], method?: "fixed" | "random", log?: boolean): PooledEstimate`.
Inverse-variance pooling, each standard error taken from its 95% interval
((upper − lower) / 3.92, on the log scale for ratios): the fixed-effect
estimate, or DerSimonian and Laird's random effects. Returns the pooled
estimate and interval, each study's share of the weight, Cochran's Q, I² and τ².

### `StudyEstimate`

`{ estimate; lower; upper }`: an estimate with its 95% interval.

### `PooledEstimate`

`StudyEstimate` plus `method`, `weights` (shares summing to 1), `q`, `i2` and
`tau2`.

### `phylogeneticTree`

`phylogeneticTree(options: PhylogeneticTreeOptions): string`. A tree in the
rectangular layout: branch lengths to scale on a distance axis (or tips aligned
as a cladogram), tips named and colored and shaped by group, internal labels
such as support values at their nodes. The data table lists every node with its
parent, branch length, distance from the root, label and group.

### `PhylogeneticTreeOptions`

`tree` (Newick text or a `TreeNode`), `groups` (tip name to group), `groupDomain`,
`colors`, `branchLengths` (default: to scale when every branch has a length),
`nodeLabels` (default true), `lengthLabel` (default "Substitutions per site").
Two tips with one name throw; more than 400 tips throw.

### `parseNewick`

`parseNewick(text: string): TreeNode`. Parses one Newick tree: quoted labels
(`'Homo sapiens'`, `''` for a quote), underscores as spaces in unquoted labels,
bracketed comments, whitespace, internal labels and branch lengths in any
number format; the final semicolon is optional. Errors name the character.

### `TreeNode`

`{ name?: string; length?: number; children: TreeNode[] }`.

## Primitives

From the core, `enarratio`.

Primitives return a whole figure by default, and with `inline: true` an
`<svg class="enarratio">` sized for inline use (the timeline, a `<div>` holding
one), named by a text alternative; see
[`PrimitiveFigureOptions`](#primitivefigureoptions). They use the same theme. As on charts, `alt` is the text
alternative; `label` names what is measured and is used to generate one when
`alt` is not given. One of the two is required.

### `sparkline`

`sparkline(options: SparklineOptions): string`. A word-sized trend. Its text
alternative is generated from the data unless `alt` is given.

### `SparklineOptions`

`values` (numbers or `null` for gaps), `label`, `alt`, `width`, `height`,
`area`, `endDot`, `color`, `formatValue`.

### `progressRing`

`progressRing(options: ProgressRingOptions): string`. Progress toward a total.

### `ProgressRingOptions`

`value`, `max` (default 1), `label` or `alt`, `size`, `thickness`,
`showValue`, `color`. A value past `max` fills the ring and prints its real
percentage, and the text alternative says it is more than the total.

### `timeline`

`timeline(options: TimelineOptions): string`. An event timeline: a lane for each
site, agent or service, with spans (things that lasted) and point events over a
time window. Status is carried by the theme's status colors and by shape (a
circle for `ok`, a triangle for `warning`, a square for `error`, a dashed
hollow circle for `unknown`), so it reads without hue. Events that overlap in a
lane stack in rows. Times are instants in UTC.

It returns a `<div class="enarratio enarratio-timeline">` holding the drawing,
named by a generated text alternative, and a plain `<ol>` of the same events in
time order. With `stylesheet` or `enarratio/base.css` the list is read by
screen readers beside the drawing and replaces it when the container has less
than 30rem of room; without CSS both show. Everything is checked when drawn: an
event with no time, a span that ends before it starts, an unknown status or
lane, or an event outside the window throws.

### `TimelineOptions`

`events`, `lanes` (top to bottom; default first-seen; a lane with no events is
drawn empty), `start` and `end` (the window; default the earliest and latest
event), `label` or `alt` (one is required), `width` (default 640), `formatTime`.

### `TimelineEvent`

A `TimelinePoint` or a `TimelineSpan`.

### `TimelinePoint`

`{ lane; label; status: TimelineStatus; at: TimelineTime }`: something that
happened at one moment.

### `TimelineSpan`

`{ lane; label; status: TimelineStatus; from: TimelineTime; to: TimelineTime }`:
something that lasted. A span past the window is clipped to it in the drawing,
and the list keeps its real times.

### `TimelineStatus`

`"ok" | "warning" | "error" | "unknown"`, drawn in the status colors good,
warning, bad and unknown.

### `TimelineTime`

A `Date`, an ISO 8601 string or epoch milliseconds.

### `heatStrip`

`heatStrip(options: HeatStripOptions): string`. A one-row strip of cells with no
axis, each colored on the theme's sequential ramp by its value; a sibling of
`uptimeStrip`. A missing value is a dashed outline. The text alternative is
generated from the values (count, first, last, lowest, highest, how many
missing) unless `alt` is given, and each cell's hover details carry its value.
Colors come in five steps, so the exact numbers are in the hover details and in
[`heatStripTable`](#heatstriptable).

### `HeatStripOptions`

`values` (numbers, or `null` for no data), `label` or `alt` (one is required),
`width` (default 240), `height` (default 24), `min` and `max` (the range the
ramp spans; default the lowest and highest value, fix them to compare strips),
`thresholds` (four ascending values, as in `heatmap`), `cellLabels` (hover names
such as "Mon 14:00"; one per value), `formatValue`.

### `uptimeStrip`

`uptimeStrip(options: UptimeStripOptions): string`. One tick per period;
status is carried by tick height and outline as well as color.

### `UptimeStripOptions`

`slots`, `label` or `alt`, `width`, `height`. An unknown status (including
names like `"constructor"` from JSON) throws.

### `UptimeSlot`

An `UptimeStatus`, or `{ status: UptimeStatus; label?: string }` with its own
hover text.

### `UptimeStatus`

`"up" | "degraded" | "down" | "unknown"`.

### Companion functions

Every primitive offers its numbers as a data table and a summary sentence,
through a companion function with the same options as the primitive:
`sparklineTable`, `uptimeStripTable`, `progressRingTable`, `timelineTable` and
`heatStripTable`. They are computed from the same validated values as the
drawing (the primitive and its companion share one `prepare` step), so the table
can never disagree with the picture, and they throw the same errors for the
same bad options. The primitives themselves return exactly what they always
did; the companions are separate, so a primitive used inline in a table cell or a
sentence stays small, and a page that wants the table asks for it.

```ts
const options = { values: [3, 5, 4, 8], label: "Entries per year" };
const strip = sparkline(options);
const { summary, table, markup } = sparklineTable(options);
// summary: "Entries per year: 4 values, from 3 to 8; lowest 3, highest 8."
// markup: a <details> holding the table, in the figure's own markup
```

The summary is the generated sentence, the same one that is the primitive's
text alternative when `alt` is not given (when only `alt` names a primitive
there is nothing to generate from, and the summary is that `alt`). A missing
value reads `no data` in these tables, because a blank cell is ambiguous to a
screen reader. The sentence, the columns and the words in them come from the
options' `strings` (and numbers from `locale`), as on a chart; the column names
below are the English ones.

| Companion | Columns | One row per |
|---|---|---|
| `sparklineTable` | Position, the label (or "Value") | Value |
| `uptimeStripTable` | Period, Status | Period |
| `progressRingTable` | Measure, Value, Total, Percent | Ring (one row) |
| `timelineTable` | Event, Lane, Status, Start, End | Event, in time order |
| `heatStripTable` | Cell, Value, Ramp step | Cell |

### `PrimitiveFigureOptions`

Every primitive returns a whole figure by default (B30, B51): its title (the
`label` unless `title` is given), the finding, the drawing, the companion's
summary and table, and the CSV link, with the text and issue options of
[`FigureOptions`](#figureoptions) (`title`, `subtitle`, `caption`, `notes`,
`source`, `byline`, `summary`, `csv`, `csvHref`, `id`, `dataTable`, `locale`,
`strings`, `strict`, `onIssue`). `inline: true` returns the bare drawing,
word-sized, for a sentence or a table cell. The figure carries
`data-enarratio-static`, so `enhance()` leaves it alone.

### `PrimitiveTable`

What a companion returns: `{ summary: string; table: DataTable; markup: string }`.
`markup` is the table in a closed disclosure (or visually hidden, per
`PrimitiveTableOptions`), ready to put beside the primitive.

### `PrimitiveTableOptions`

`{ dataTable?: "details" | "visually-hidden" }`, the second argument of every
companion: how `markup` shows the table, as on a figure.

### `sparklineTable`

`sparklineTable(options: SparklineOptions, display?: PrimitiveTableOptions): PrimitiveTable`.
Positions and values.

### `uptimeStripTable`

`uptimeStripTable(options: UptimeStripOptions, display?: PrimitiveTableOptions): PrimitiveTable`.
Each period, named as in its hover text, and its status; the summary has the
counts and availability.

### `progressRingTable`

`progressRingTable(options: ProgressRingOptions, display?: PrimitiveTableOptions): PrimitiveTable`.
Value, total and the real percentage.

### `timelineTable`

`timelineTable(options: TimelineOptions, display?: PrimitiveTableOptions): PrimitiveTable`.
Every event with lane, status, start and end (blank for a point event), in the
order of the timeline's plain list.

### `heatStripTable`

`heatStripTable(options: HeatStripOptions, display?: PrimitiveTableOptions): PrimitiveTable`.
Each cell's value and its ramp step.

### `dataTableBlock`

`dataTableBlock(table: DataTable, caption: string, display?, strings?): string`.
A data table as the markup a figure carries: a closed `<details>` labeled "Show
data" and "Hide data" (default) or visually hidden. `caption` names the table
for assistive technology; `strings` translates the labels.

### `tableChart`

`tableChart(options: TableChartOptions<T>): string`. From the core. A table
with graphics in its cells: a bar to scale beside a number, heat cells on the
sequential ramp, a sparkline per row. It is one table, and the figure's data
table: every cell prints its value as text, the first column holds row headers,
the bars are decorative, and each sparkline is named by its values. Screen
readers read it as a table, and `enhance()` sorts it by any column.

### `TableChartOptions`

`data`, `columns`, and the `FigureOptions` except `height` and `dataTable`.

### `TableColumn`

`{ field; label?; kind?; formatValue? }`. `kind` is `"text"` (default for
strings), `"number"` (default for numbers), `"bar"` (from zero; with negatives,
from a center line, in the second series color), `"heat"` (five equal steps
of the column's range) or `"sparkline"` (a field holding an array of numbers).

## Themes

### `Theme`

`{ name; fonts: { body; numeric? }; gridlines; light: ColorScheme; dark: ColorScheme }`.

### `ColorScheme`

`background`, `text`, `mutedText`, `grid`, `focus`, `series`
(`SeriesPalette`), `sequential` (`SequentialRamp`), `status` (`StatusColors`),
and two optional sets of shades:

- `seriesLabels?` (`SeriesPalette`): the colors series names are written in on
  the background (direct labels, curve labels). Left out, each series color is
  darkened (light scheme) or lightened (dark scheme) until it reaches 4.5:1.
- `sequentialEdges?` (`SequentialRamp`): the edge round each ramp step's cells
  and swatches. Left out, a step that reaches 3:1 on the background has none,
  and a paler one gets its own color darkened or lightened to 3:1.

Every color is a [`ThemeColor`](#themecolor).

### `SeriesPalette`

Exactly eight `ThemeColor`s, assigned to series in order.

### `SequentialRamp`

Exactly five `ThemeColor`s, from least to most.

### `StatusColors`

`{ good; warning; bad; unknown }`.

### `HexColor`

`` `#${string}` ``: `#rgb` or `#rrggbb`.

### `ThemeColor`

A `HexColor`, or a site's own custom property with a hex fallback,
`` `var(--${string}, #${string})` ``. The stylesheet writes it as given, so
charts follow the site's token wherever it changes; `checkTheme` and the
shades Enarratio derives (series labels, ramp edges, labels on marks) measure
the fallback. Keep the fallback equal to the token's value, and give
`seriesLabels` and `sequentialEdges` as tokens too when the series and ramp
are tokens, so the shades follow the site as well. See the README, "Your own
theme".

### `Gridlines`

`"none" | "x" | "y" | "both"`.

### `defineTheme`

`defineTheme(theme: Theme): Theme`. Validates a theme built at run time
(from JSON, say) and returns it. Throws naming the first bad field. The name
and fonts may not contain `<`, `>`, `{`, `}`, `;`, a backslash, `/*` or `*/`,
since they are written into CSS.

### `stylesheet`

`stylesheet(theme: Theme, options?: StylesheetOptions): string`. The CSS a
page includes once. Light and dark follow the page's `color-scheme`. It
validates the theme with `defineTheme` first and throws when `checkTheme`
reports an error, so a chart is never drawn in colors some readers cannot read
or tell apart. Labels printed on marks take the scheme's text or background
color when it reaches 4.5:1, otherwise black or white.

### `colorStyles`

`colorStyles(markup: string): string`. The CSS for every per-chart color
override (`colors`, `color`) in some rendered chart markup: one rule per
distinct override, e.g.
`.enarratio[data-enarratio-colors="--enarratio-series-2: #8a4a1b"] { --enarratio-series-2: #8a4a1b; }`.
Charts carry no `style` attribute, so a page under a hash-based
Content-Security-Policy (no `'unsafe-inline'`) puts these rules in its own
stylesheet, or in a `<style>` whose hash it allows. Throws on an attribute value
Enarratio would not write. Record [0022](design/0022-readable-for-every-reader.md).

### `baseStylesheet`

`baseStylesheet(): string`. The theme-free rules: layout, legend, data table,
tooltip, focus ring and animation. They use the color and font properties
below without defining them, so a site that defines those itself, or a theme
generated elsewhere, needs no `Theme` object. `stylesheet(theme)` is the
theme's properties, then these rules, then the gridline rules the theme asks
for. The same text is the package's `enarratio/base.css` (written at build
from this function), for sites that link a stylesheet instead of calling
JavaScript. See [Custom properties](#custom-properties) for what a site sets.

### `StylesheetOptions`

`{ colorScheme?: { dark?: string; light?: string }; highContrast?: Theme }`.
`colorScheme`: selectors for sites that switch schemes with an attribute, e.g.
`'[data-theme="dark"]'`. They are the page's own and trusted, but may not contain
the characters `defineTheme` refuses. `highContrast`: a theme whose colors
replace the theme's under `prefers-contrast: more`, e.g. `highContrastTheme`;
it is checked like the main theme.

### `defaultTheme`

From `enarratio/themes`. Enarratio's own theme: neutral surfaces, system fonts. The gallery's example
theme (`examples/themes/example.ts`) shows how to write another.

### `highContrastTheme`

From `enarratio/themes`. Black and white surfaces, text at 15:1 or more,
gridlines at 3:1, and series colors that each reach 4.5:1 and stay 10
CIEDE2000 apart under every simulated color vision deficiency. Use it as a
site's theme, or for readers who ask for more contrast with
`stylesheet(theme, { highContrast: highContrastTheme })`.

## Custom properties

Charts contain no colors and no fixed sizes of their own: the markup refers to
custom properties, and the base rules give each one a fallback. Set a property
on `:root`, on any ancestor of a chart, or on one `figure` and it applies there.
Set none and every chart looks exactly as it did before the property existed,
so a theme can be as small as one property or as large as all of them.

### Colors and fonts

`stylesheet(theme)` defines these from a `Theme`, as `light-dark()` pairs
following the page's `color-scheme`. A site using `enarratio/base.css` defines
them itself. They have no fallback: undefined, a rule using one is ignored.

| Property | Meaning |
|---|---|
| `--enarratio-background`, `--enarratio-text`, `--enarratio-text-muted` | Page, text and muted text colors |
| `--enarratio-grid`, `--enarratio-focus` | Gridlines and rules; the focus ring |
| `--enarratio-series-1` to `--enarratio-series-8` | The eight series colors, in order |
| `--enarratio-series-text-1` to `-8` | The label color that reads best on each series color |
| `--enarratio-series-label-1` to `-8` | Each series' shade for its name written on the background, at 4.5:1. Undefined, the base rules mix the series color 55% with the text color |
| `--enarratio-sequential-1` to `--enarratio-sequential-5` | The five-step ramp, least to most |
| `--enarratio-sequential-text-1` to `-5` | The label color that reads best on each ramp step |
| `--enarratio-sequential-edge-1` to `-5` | The edge round each ramp step's cells and legend swatch, at 3:1, or `transparent`. Undefined, the base rules draw steps 1 to 3 with an edge in the muted text color |
| `--enarratio-status-good`, `-warning`, `-bad`, `-unknown` | Status colors |
| `--enarratio-font`, `--enarratio-font-numeric` | Body and numeric font stacks |

Gridlines are the one theme choice that is not a property: hide a direction
with `.enarratio [data-enarratio-mark="x-grid"] { display: none; }` (or
`y-grid`).

### Sizes, weights, radii and timings

Each has the fallback shown, which is what Enarratio draws when it is unset.
A test keeps this table and the stylesheet in step.

| Property | Fallback | Controls |
|---|---|---|
| `--enarratio-font-size` | `1rem` | Text size of a figure; the other text sizes are relative to it |
| `--enarratio-font-size-mark` | `0.75rem` | Text inside the drawing: tick labels, direct labels. Raised on narrow screens so it never renders under 12px |
| `--enarratio-font-size-small` | `0.875em` | Caption, legend and data table |
| `--enarratio-font-size-tooltip` | `0.8125rem` | Tooltip text |
| `--enarratio-font-weight-title` | `600` | The visible title |
| `--enarratio-font-weight-emphasis` | `600` | A pressed legend button |
| `--enarratio-line-height-tooltip` | `1.35` | Tooltip lines |
| `--enarratio-space` | `0.5em` | Gap between title, legend, chart, caption and data table |
| `--enarratio-gap` | `1em` | Between legend entries |
| `--enarratio-gap-row` | `0.25em` | Between wrapped legend rows |
| `--enarratio-gap-inline` | `0.4em` | Between a swatch and its label |
| `--enarratio-padding-button` | `0.125em 0.25em` | Legend toggle buttons |
| `--enarratio-cell-padding` | `0.2em 0.75em 0.2em 0` | Data table cells |
| `--enarratio-border-width` | `1px` | Table rules, legend buttons, tooltip |
| `--enarratio-radius` | `0.25em` | Legend toggle buttons |
| `--enarratio-radius-swatch` | `0.15em` | Legend swatches |
| `--enarratio-radius-tooltip` | `0.3em` | The tooltip |
| `--enarratio-swatch-size` | `0.8em` | Legend swatches |
| `--enarratio-tooltip-max-width` | `18em` | The tooltip |
| `--enarratio-tooltip-padding` | `0.35em 0.6em` | The tooltip |
| `--enarratio-tooltip-shadow` | `0 2px 8px rgb(0 0 0 / 15%)` | The tooltip |
| `--enarratio-z-tooltip` | `10` | Stacking of the tooltip |
| `--enarratio-opacity-dimmed` | `0.25` | Marks outside the current filter |
| `--enarratio-opacity-faded` | `0.5` | Other series while a point has the pointer or focus |
| `--enarratio-z-expanded` | `20` | Stacking of an expanded chart |
| `--enarratio-padding-expanded` | `1rem` | Padding of an expanded chart |
| `--enarratio-opacity-brush` | `0.15` | Fill of a brushed range |
| `--enarratio-opacity-texture` | `0.6` | Textures on filled series 2 to 8 and their legend swatches (1 under more contrast and forced colors) |
| `--enarratio-cell-edge-width` | `1px` | The edge round a ramp step's cells (heatmap, heat strip) |
| `--enarratio-bar-gap` | `1px` | The grid-colored edge between adjacent bars and stacked segments |
| `--enarratio-halo-width` | `3px` | The halo of bar color behind a name printed on a textured bar |
| `--enarratio-focus-width-inner` | `5px` | Inner (background) ring on a focused point, twice its width |
| `--enarratio-focus-width-outer` | `2.5px` | Outer (focus color) ring on a focused point |
| `--enarratio-focus-outline-width` | `3px` | Outline on a focused button, field or frame |
| `--enarratio-focus-outline-offset` | `2px` | Distance of that outline |
| `--enarratio-timeline-list-indent` | `2.25em` | Indent of the timeline's plain list on narrow screens |
| `--enarratio-duration-hover` | `150ms` | Dimming and un-dimming |
| `--enarratio-duration-grow` | `600ms` | Bars growing in |
| `--enarratio-duration-fade` | `500ms` | Dots, areas and cells fading in |
| `--enarratio-duration-draw` | `800ms` | Lines drawing in |
| `--enarratio-ease-grow` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Easing of bars growing in |
| `--enarratio-ease-out` | `ease-out` | Easing of the other timings |

Not properties, on purpose: the 30rem minimum width of a wide drawing (the
same threshold decides whether a figure scrolls, in code, from the drawing's
`width`), the 30rem below which a timeline gives way to its plain list (a
container query cannot use a property), and the geometry written into the SVG itself (stroke widths, tick
lengths, the textures), which is part of each chart's drawing and cannot be set
from CSS. Animation stops under `prefers-reduced-motion` whatever the durations
are, and no animation runs longer than 5 seconds whatever they are set to.

### Reader settings

The base rules follow what the reader has asked for (record
[0022](design/0022-readable-for-every-reader.md)):

- **Font size.** Text in the drawing is in `rem`, so it follows the browser's
  text size, and each chart's SVG carries a `font-size` that grows as the
  drawing shrinks, so it never renders under 12px at default zoom.
- **`prefers-contrast: more`.** Textures at full strength, wider gaps between
  bars, gridlines in the muted text color, outlined legend swatches, and the
  `highContrast` theme's colors when the stylesheet has one.
- **`forced-colors: active`** (Windows High Contrast). Every color becomes a
  system color: marks `CanvasText` on `Canvas`, told apart by textures, line
  dashes, symbols and labels; the sequential ramp in steps between the two;
  focus in `Highlight`.
- **`prefers-reduced-motion: reduce`.** No animation or transition.
- **Print.** The light scheme, no scrolling frame, a figure kept on one page,
  the data table printed open (where `::details-content` is supported), and no
  tooltip, focus ring or brush. Anything carrying `data-enarratio-control` is
  hidden too.

## Color checks

### `checkTheme`

`checkTheme(theme: Theme, thresholds?: Partial<CheckThresholds>): CheckReport`.
Measures text and mark contrast (WCAG 2.2), including the unknown status
color, series names written on the background (each series' label shade at
4.5:1), each ramp step by its fill or its edge at 3:1, the contrast of labels
printed on every series and ramp color, the order of the sequential ramp, and the
difference between every pair of series colors with typical vision and
simulated protanopia, deuteranopia and tritanopia. Reports rather than throws.
The focus ring needs no check against series colors: it is drawn in two tones,
background inside focus color, so one always contrasts with its neighbor.

### `CheckReport`

`{ theme: string; ok: boolean; issues: CheckIssue[] }`. `ok` is false when
there is any error. Every check reports errors, two series colors closer than
`seriesDifference` included; `warning` remains in the type for findings that
do not fail a theme, and none do today.

### `CheckIssue`

`{ severity; scheme; check; message; colors; measured }`.

### `CheckThresholds`

`{ text: number; graphics: number; seriesDifference: number }`.

### `DEFAULT_THRESHOLDS`

`{ text: 4.5, graphics: 3, seriesDifference: 10 }`.

### `contrastRatio`

`contrastRatio(a: string, b: string): number`. WCAG 2 contrast, 1 to 21.

### `labelColor`

`labelColor(fill: string, text: HexColor, background: HexColor): HexColor`. The
color for text printed on a mark of color `fill`: the scheme's text or
background color, whichever contrasts more, when it reaches 4.5:1 on the fill,
otherwise black or white, one of which always does. The stylesheet picks bar
label colors this way.

### `readableShade`

`readableShade(color: string, background: string, minimum: number): HexColor`.
`color` itself when it reaches `minimum` contrast on `background`, otherwise
the least mix toward black (light background) or white (dark) that does. The
stylesheet derives series labels (to 4.6:1) and ramp edges (to 3.1:1) this way,
a tenth over each minimum so a page background a shade off the theme's keeps
them over it.

### `colorDifference`

`colorDifference(a: string, b: string, vision?: ColorVision): number`. CIEDE2000
difference, optionally as seen with a color vision deficiency.

### `simulateColorVision`

`simulateColorVision(color: string, vision: ColorVision): Rgb`. After Machado,
Oliveira and Fernandes (2009), at full severity.

### `ColorVision`

`"protanopia" | "deuteranopia" | "tritanopia"`.

### `Rgb`

`readonly [number, number, number]`: sRGB channels from 0 to 1.

## Enhancement layer: `enarratio/enhance`

### `enhance`

`enhance(root?: ParentNode, options?: EnhanceOptions): EnhancedChart[]`.
Enhances every `figure.enarratio` under `root` (default `document`). Safe to
call again: a figure is enhanced once, and calling again with different options
re-applies them.

### `EnhanceOptions`

`{ tooltips?; filter?; brush?; entrance?; table?; expand?; url?; download?; embed?; sound?; strings? }`.

| Option | Default | Does |
|---|---|---|
| `tooltips` | `true` | Hover and focus details on every mark |
| `filter` | `true` | A click, Enter or Space on a mark or legend entry filters by it |
| `brush` | `true` | On a continuous x axis, a range by drag, two clicks, Shift with arrows, or a from-and-to form ("Pick a range") |
| `entrance` | `true` | Marks animate in the first time the chart scrolls into view |
| `table` | `true` | The data table sorts by any column (a button in each header, `aria-sort`), and a "Show table" button swaps the chart for the table and back |
| `expand` | `false` | An "Expand" button fills the window with the chart; Escape, the button, or focus leaving the chart closes it |
| `url` | `false` | Keeps the filter and range in the address as `?{id}={field}:{value}` and `?{id}-range={low}..{high}`, so a link reproduces the view. Needs the figure's `id`. A view read from the address fires `enarratio:select` or `enarratio:brush`, so the page can follow it |
| `download` | `true` | "Download SVG" and "Download PNG" beside the CSV link (or in the control bar when the figure has none): the drawing as shown, its computed colors and fonts written onto each element and the background painted in; the PNG is that SVG on a canvas at twice its size. A PNG uses the fonts the browser has for a standalone image, so a web font may fall back |
| `embed` | `true` | "Copy embed" copies a link to the chart, `<a href="{page}#{id}">{title}</a>`, to paste into another page. Needs the figure's `id` and the Clipboard API; without either there is no button |
| `sound` | `true` | "Play as sound" plays each series in turn, one note per mark from A3 (lowest) to A5 (highest), panned with the mark's place on the x axis; the live region names each series and the tooltip follows the note. "Stop sound" or Escape stops it. Its code (`sound.js`, 0.9 kB) loads on the first press. Needs Web Audio and two or more marks ([record 0029](design/0029-phone-drawings-and-sound.md)) |
| `strings` | English | Translations of any of the [`EnhanceStrings`](#enhancestrings) |

### `ResolvedOptions`

The options a chart was enhanced with, every default filled in, `strings`
complete. `EnhancedChart.options` holds them.

### `EnhanceStrings`

Every string the layer writes: the key hint, the position after each point's
label (`"{index} of {count}"`), the live region's announcements, and the
labels of its buttons and form. `{name}` is filled in.

### `ENHANCE_STRINGS`

The English `EnhanceStrings`. A page passes only those it translates:
`enhance(document, { strings: { showTable: "Tabelle zeigen" } })`.

### `EnhancedChart`

`{ figure; options; update(markup); setFilter(filter); clear(); destroy() }`.

- `update` swaps in new server markup for the same chart, animating marks
  that share a key. It keeps the current filter, and keeps the tab stop (and
  keyboard focus, if a reader was in the chart) on the mark with the same key;
  if that mark is gone, on the first mark of the same category; otherwise on
  the mark at the nearest position.
- `setFilter({ field, value })` shows a filter the page chose (from its own
  controls or the URL); `setFilter(null)` removes it. A filter on the chart's
  series field (for example `{ field: "type", value: "Grants" }`) emphasizes
  that series and presses its legend entry, even on a chart whose clicks
  filter by x.
- `clear()` removes the filter and range.
- The live region says "Chart updated" after `update`, and announces filters,
  ranges and table sorts.
- The markup given to `update` should come from Enarratio. It is parsed inertly
  and sanitized first: only elements and attributes Enarratio emits survive,
  with event handlers, scripts, unsafe links and non-custom-property styles
  removed.
- `destroy()` restores the server markup.

Calls the page makes (`update`, `setFilter`, `clear`) fire no events, since
the page already knows; only a reader's clicks and keys fire
`enarratio:select` and `enarratio:brush`.

### `SelectDetail`

The detail of `enarratio:select`: `{ chartId; field; value; x? }`. `value` is
`null` when the filter is cleared.

### `BrushDetail`

The detail of `enarratio:brush`: `{ chartId; range; time }`. `range` is
`[low, high]` in data units (epoch milliseconds on a time axis), or `null`
when cleared.

### Keyboard

The chart's points are native controls laid over the marks, one per mark: a
button where it filters, an image otherwise, each named by its details and its
place in its series ("Year 2019, Talks: 2, 1 of 6"). They are grouped as an
application, described by the key hint, which also shows while a point has
focus. So screen readers read the chart as its image, hint and table in browse
mode, and switch to focus mode only once a point has focus. The same keys work
on every chart type.

| Key | Does |
|---|---|
| Tab | Moves into the chart (one tab stop, on the last point used) and on to the next control. |
| Left, Right | Previous or next point along the series. |
| Up, Down | Next or previous series: the mark above or below in a stack or group, or the nearest point of the next series. |
| Home, End | First or last point of the series. |
| Page Up, Page Down | Ten points back or forward along the series. |
| Backspace | Back to the point before the last move. |
| Enter, Space | Filter by the focused point; again to clear. |
| Shift with the arrows, Home, End, Page Up or Page Down | Extend a range on a continuous axis. |
| Escape | Hide the tooltip, and clear the filter and the range; with nothing to clear, close an expanded chart. |

Keys with Alt, Control or Command, and every key the chart does not use, pass
through to the browser and the screen reader. Escape hides a hovered tooltip
wherever focus is.

### Pointer

- Hover or focus shows the mark's details in a tooltip, which stays while the
  pointer moves onto it, and fades the other series.
- Click a mark (or anywhere in its 24 CSS pixel target) to filter; click again
  to clear.
- On a continuous x axis, drag to pick a range, or click the plot once for one
  end and again for the other: dragging is never the only way.

## Redraw to the frame: `enarratio/redraw`

A chart drawn on the server keeps the width it was drawn at; in a narrower column its text
shrinks below the mark size, or a wide frame scrolls. `enarratio/redraw` draws it again in the
browser at its frame's width, whenever that width changes, and enhances each drawing. Bar, line
and area charts are drawn again by `enarratio/lite` from their options; any other chart may give
a narrow drawing made on the server, used under 30rem. A line chart narrower than 400 drops its
end labels (its legend names the series); under 200 the server's drawing stays and scrolls.

```ts
// On the server, beside the chart:
import { redrawAttribute } from "enarratio/redraw";
const html = `<div ${redrawAttribute({ chart: "line", options })}>${lineChart(options)}</div>`;

// In the page's own script:
import { redrawCharts } from "enarratio/redraw";
redrawCharts();
```

Without the script, the server's drawing stands, with its table. The options must survive JSON.

### `RedrawSpec`

`{ chart: "bar" | "line" | "area", options }`, the light chart and the options it was drawn
with, or `{ narrow }`, the frame markup of a drawing about 240 wide.

### `REDRAW_ATTRIBUTE`

`"data-enarratio-redraw"`: the attribute that carries the spec.

### `redrawAttribute`

`redrawAttribute(spec)` returns the attribute, escaped, for the element around the figure.

### `redrawCharts`

`redrawCharts(root?, options?)` starts every chart under `root` (the document) that carries a
spec, once each, and returns them. `options` are `enhance`'s.

### `redrawChart`

`redrawChart(host, spec, options?)` starts one chart, for a host that carries its spec some other
way.

### `RedrawnChart`

`{ host, destroy() }`: `destroy` stops following the width and removes the enhancement.

### `narrowChart`

`narrowChart(host, narrow, options?)`, from `enarratio/redraw/narrow` (and re-exported by
`enarratio/redraw`): starts one chart whose server gave a narrow drawing, the `.enarratio-frame`
markup of the chart drawn about as wide as a phone's column. The frame shows it under 30rem and the
original above, and each drawing is enhanced. It brings none of the light renderers, so a page
whose charts all carry a narrow drawing (the gallery) loads only the enhancement layer and this.
