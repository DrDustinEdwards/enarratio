# API reference

Enarratio is one npm package with several entry points, so a site installs and
ships only what it uses.

| Import | Holds | Needs |
|---|---|---|
| `enarratio` | Core: HTML helpers, theme types, `defineTheme`, `stylesheet`, `baseStylesheet`, `checkTheme`, color maths, figure and data-table assembly, the primitives | Nothing. No runtime dependencies. |
| `enarratio/base.css` | The theme-free base rules as a stylesheet file | Nothing |
| `enarratio/plot` | `lineChart`, `areaChart`, `barChart`, `scatterPlot`, `heatmap` | Peers `@observablehq/plot`, and `linkedom` outside a browser |
| `enarratio/science` | `genomeTrack`, `titerPlot`, `geometricSummary`, `networkChart` | Peers `@observablehq/plot` and `d3-force`, and `linkedom` outside a browser |
| `enarratio/enhance` | Interaction for charts already on the page; runs in the browser | Nothing |
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
build step); the primitives, the core and `enarratio/enhance` also run in the
browser. Where a section below names a function, its import is the entry above.

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
caption and data table) from an SVG and a `DataTable`. Throws if `alt` is blank.

### `FigureParts`

`kind`, `svg`, `table`, and optionally `legend`, `ramp`, `seriesField`, `x`
(a `ScaleDescription`), `orientation` and `slotColors`.

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
`alt` is meaningful and any `width` and `height` are positive and finite.

### `slotStyle`

`slotStyle(colors?: ReadonlyMap<number, SeriesColor>): string | undefined`. Per-figure
palette overrides as an inline style value; throws on a color that is not hex, a
color function or `var()`.

## Common options

### `FigureOptions`

Every chart (not the primitives) accepts these.

| Option | Type | Meaning |
|---|---|---|
| `alt` | `string`, required | What the chart shows, including its finding. Names the SVG for assistive technology. |
| `title` | `string` | Visible title above the chart. |
| `caption` | `string` | Visible caption below: method, source, caveats. |
| `id` | `string` | The figure's `id`, reported as `chartId` in events. |
| `width`, `height` | `number` | Drawing size in CSS pixels, positive and finite. Drawings 480 pixels or wider keep at least 30rem on narrow screens and scroll sideways inside the figure, so their text stays readable. |
| `dataTable` | `"details"` or `"visually-hidden"` | How the always-present data table is shown. Default `"details"`. |

A chart returns:

```html
<figure class="enarratio" data-enarratio="bar" id="...">
  <p class="enarratio-title">...</p>
  <ul class="enarratio-legend">...</ul>
  <div class="enarratio-frame">
    <svg role="img" aria-label="{alt}">... one keyed element per datum ...</svg>
  </div>
  <figcaption class="enarratio-caption">...</figcaption>
  <details class="enarratio-data"><summary>Data table</summary><table>...</table></details>
</figure>
```

### `SeriesColor`

A color override for one series: any CSS color (`"#8a4a1b"`,
`"var(--brand)"`), or `{ light, dark }`, rendered with CSS `light-dark()`.
Given in a chart's `colors` option, keyed by series name. A chart with no
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
- `href`: a function from category to link. Without script each bar is a link
  (and the SVG a named group rather than one image, so the links stay
  reachable); with the enhancement layer the bar filters instead, and the link
  is kept in `data-enarratio-href`. Only relative and `http(s)` links are
  allowed.
- `maxXTicks`: the most category labels to print; with more categories, every
  nth label is printed from the first.
- `directLabels`: print each series' name inside the stacked segments it fits
  in, so series are told apart by text as well as color. Stacked layout only.
- `xType: "time"`, with `interval`, `formatX`: a time axis. `x` is a Date, an
  ISO 8601 string or epoch milliseconds; each row falls in the `interval`
  (`"hour"`, `"day"` the default, `"week"` starting Monday, `"month"` or
  `"year"`, all UTC) that contains it, and there is one bar slot for every
  interval from the first row's to the last's, empty ones included, so a quiet
  day is a gap in the chart and a zero in the table. Bars are labelled by their
  first moment (`2026-01-05`, `2026-01`, `2026`, `2026-01-05 14:00 UTC`) or by
  `formatX(start)`, which must give every interval its own label. Rows in an
  interval and series are summed, or counted when `y` is omitted. Works with
  stacked and grouped series and horizontal bars. Long axes print every nth
  label unless `maxXTicks` says otherwise; every bar keeps its hover details
  and table row. `xDomain` is not used with it, and `interval` and `formatX`
  need `xType: "time"`. More than 2000 intervals throw.

Links given by `href` must be relative or `http(s)`; a `//host` link, or any
other scheme, throws. Count axes end at their last whole-number tick.

### `lineChart`

`lineChart(options: LineChartOptions<T>): string`. Lines over time or any
continuous x. `null` values are gaps. Supports `references`, `markers`,
`directLabels`, `points`, `yType: "log"` and `zero`.

### `areaChart`

`areaChart(options: SeriesChartOptions<T>): string`. Stacked areas; values
must be zero or more.

### `SeriesChartOptions`

Options shared by line and area charts: `data`, `x`, `y`, `series`, `xType`
(`"time"` or `"linear"`), `seriesDomain`, `colors`, `xLabel`, `yLabel`,
`formatValue`, `formatX`, `references`, `markers`.

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

`SeriesChartOptions` plus `points`, `directLabels`, `yType`, `zero`, and the
forecast options `band`, `forecastFrom` and `forecastLabel`. With
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
  last observed point), points are hollow, a rule labelled `forecastLabel`
  (default "Forecast") marks the boundary, and the data table gets a `Forecast`
  column reading `Yes` on those rows. It must lie within the data's x range and
  before the last x, so that some rows are observed and some forecast.
- The two work apart or together. A chart without them is drawn exactly as
  before.

### `LineBand`

`{ lower: field; upper: field; label?: string }`: the fields holding a band's
bounds, and what the band is called.

### `ReferenceLine`

`{ y: number; label: string }`: a labelled horizontal line, such as a threshold.

### `EventMarker`

`{ x: number | Date | string; label: string }`: a labelled vertical line, such
as a deploy or an intervention.

### `scatterPlot`

`scatterPlot(options: ScatterPlotOptions<T>): string`. Points by two numeric
fields, with series told apart by color and symbol, and an optional ordinary
least-squares line with its 95% confidence band.

### `ScatterPlotOptions`

`data`, `x`, `y`, `series`, `label` (names each point), `xType`, `yType`
(`"linear"` or `"log"`), `regression`, `seriesDomain`, `colors`, `xLabel`,
`yLabel`, `formatValue`.

### `heatmap`

`heatmap(options: HeatmapOptions<T>): string`. A grid colored on the theme's
five-step sequential ramp, with a labelled legend of the bins, values printed
in cells in a readable color, and dashed outlines for empty cells.

### `HeatmapOptions`

`data`, `x`, `y`, `value`, `xDomain`, `yDomain`, `thresholds` (four ascending
values; default equal intervals), `cellLabels`, `xLabel`, `yLabel`,
`valueLabel`, `formatValue`. Once enhanced, a click on a cell filters by its
row (the `y` field), and arrow keys move across columns and down rows.

### `networkChart`

`networkChart(options: NetworkChartOptions): string`. From `enarratio/science`. A force-directed
network laid out on the server with d3-force. The layout is deterministic: the
same data always draws the same picture.

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
for 40), `groupLabel`, `titerLabel`.

### `DilutionSeries`

`{ start: number; factor: number }`: the first reciprocal dilution and the
step factor, e.g. `{ start: 10, factor: 2 }` for 1:10 two-fold.

### `genomeTrack`

`genomeTrack(options: GenomeTrackOptions): string`. Features drawn to scale on
a nucleotide axis, as arrows pointing along their strand, one row per track,
with overlapping features packed into lanes.

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

## Primitives

From the core, `enarratio`.

Primitives return an `<svg class="enarratio">` sized for inline use, named by a
text alternative. They use the same theme. As on charts, `alt` is the text
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

## Themes

### `Theme`

`{ name; fonts: { body; numeric? }; gridlines; light: ColorScheme; dark: ColorScheme }`.

### `ColorScheme`

`background`, `text`, `mutedText`, `grid`, `focus`, `series`
(`SeriesPalette`), `sequential` (`SequentialRamp`), `status` (`StatusColors`).
All hex colors.

### `SeriesPalette`

Exactly eight `HexColor`s, assigned to series in order.

### `SequentialRamp`

Exactly five `HexColor`s, from least to most.

### `StatusColors`

`{ good; warning; bad; unknown }`.

### `HexColor`

`` `#${string}` ``: `#rgb` or `#rrggbb`.

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
validates the theme with `defineTheme` first. Labels printed on marks take the
scheme's text or background color when it reaches 4.5:1, otherwise black or
white.

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

`{ colorScheme?: { dark?: string; light?: string } }`: selectors for sites
that switch schemes with an attribute, e.g. `'[data-theme="dark"]'`. They are
the page's own and trusted, but may not contain the characters `defineTheme`
refuses.

### `defaultTheme`

From `enarratio/themes`. Enarratio's own theme: neutral surfaces, system fonts.

### `dustinedwardsTheme`

The theme of dustinedwards.info, and a worked example of a site theme.

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
| `--enarratio-sequential-1` to `--enarratio-sequential-5` | The five-step ramp, least to most |
| `--enarratio-sequential-text-1` to `-5` | The label color that reads best on each ramp step |
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
| `--enarratio-font-size-mark` | `12px` | Text inside the drawing: tick labels, direct labels |
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
| `--enarratio-opacity-brush` | `0.15` | Fill of a brushed range |
| `--enarratio-focus-width-inner` | `5px` | Inner (background) ring on a focused mark |
| `--enarratio-focus-width-outer` | `2.5px` | Outer (focus color) ring on a focused mark |
| `--enarratio-focus-outline-width` | `3px` | Outline on a focused chart or legend button |
| `--enarratio-focus-outline-offset` | `2px` | Distance of that outline |
| `--enarratio-duration-hover` | `150ms` | Dimming and un-dimming |
| `--enarratio-duration-grow` | `600ms` | Bars growing in |
| `--enarratio-duration-fade` | `500ms` | Dots, areas and cells fading in |
| `--enarratio-duration-draw` | `800ms` | Lines drawing in |
| `--enarratio-ease-grow` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Easing of bars growing in |
| `--enarratio-ease-out` | `ease-out` | Easing of the other timings |

Not properties, on purpose: the 30rem minimum width of a wide drawing (the
same threshold decides whether a figure scrolls, in code, from the drawing's
`width`), and the geometry written into the SVG itself (stroke widths, tick
lengths, the size of direct labels), which is part of each chart's drawing and
cannot be set from CSS. Animation stops under `prefers-reduced-motion` whatever
the durations are.

## Color checks

### `checkTheme`

`checkTheme(theme: Theme, thresholds?: Partial<CheckThresholds>): CheckReport`.
Measures text and mark contrast (WCAG 2.2), the contrast of labels printed on
every series and ramp color, the order of the sequential ramp, and the
difference between every pair of series colors with typical vision and
simulated protanopia, deuteranopia and tritanopia. Reports rather than throws.
The focus ring needs no check against series colors: it is drawn in two tones,
background inside focus color, so one always contrasts with its neighbor.

### `CheckReport`

`{ theme: string; ok: boolean; issues: CheckIssue[] }`. `ok` is false only for
errors; warnings about similar series colors leave it true.

### `CheckIssue`

`{ severity; scheme; check; message; colors; measured }`.

### `CheckThresholds`

`{ text: number; graphics: number; seriesDifference: number }`.

### `DEFAULT_THRESHOLDS`

`{ text: 4.5, graphics: 3, seriesDifference: 10 }`.

### `contrastRatio`

`contrastRatio(a: string, b: string): number`. WCAG 2 contrast, 1 to 21.

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

`{ tooltips?; filter?; brush?; entrance? }`, each `true` unless set `false`.

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

| Key | Does |
|---|---|
| Tab | Moves into the chart (one tab stop) and on to the next control. |
| Left, Right | Previous or next category. |
| Up, Down | Through a stack or group within a category. |
| Home, End | First or last mark. |
| Enter, Space | Filter by the focused mark; again to clear. |
| Shift with arrows | Extend a range on a continuous axis. |
| Escape | Hide the tooltip, and clear the filter and the range. |

### Pointer

- Hover or focus shows the mark's details in a tooltip, which stays while the
  pointer moves onto it.
- Click a mark (or anywhere in its 24 CSS pixel target) to filter; click again
  to clear.
- On a continuous x axis, drag to pick a range, or click the plot once for one
  end and again for the other: dragging is never the only way.
