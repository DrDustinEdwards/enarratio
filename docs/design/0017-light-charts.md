# 0017. Light bar, line and area charts for the browser

Status: accepted, 2026-10-11.

## Decision

**Author's decision (Dustin Edwards, 2026-10-10).** The Capsid Portal draws all
its charts with Enarratio, in the browser, and each lazily loaded chunk may
weigh 40 kB at most. `barChart`, `lineChart` and `areaChart` measured 188 to
196 kB gzipped bundled for the browser, and 91 to 99 kB even without linkedom,
because they carry Observable Plot. So these three charts get browser entries
that render the same SVG from the same options with neither Observable Plot
nor linkedom, each under 40 kB bundled, minified and gzipped. The Plot-based
entries stay as they are, for server rendering. No new chart types, and no
change to the existing chart APIs.

## Why

Plot is the right tool on the server (record 0002): it lays out every chart
type Enarratio has, and its size costs a server nothing. In a browser bundle the
same size is most of a page's budget, for three chart types whose layout is a
band scale, a linear, log or time scale, axes and a few marks. Drawing those
directly is a small amount of code; reproducing Plot's choices exactly (tick
counts, nice domains, label formats, rounding) is what keeps the two renderers
one chart rather than two that drift apart.

## Implementation choices

1. **One model, two renderers.** Everything about a chart except the drawing
   (reading and checking the rows, series and colors, hover text, the keys the
   enhancement layer reads, the layout numbers, the data table, the figure)
   moved out of `src/plot/bar.ts` and `src/plot/line.ts` into
   `src/render/bar-model.ts` and `src/render/line-model.ts`. The Plot renderer
   and the light renderer (`src/lite/`) both draw from it, so the same options
   throw the same errors and fill the same table. The Plot charts' output is
   byte for byte what it was before the move.
2. **Strings, not a DOM.** The job asked for the browser's DOM in place of
   linkedom. The light charts build the SVG as a string instead, as the
   figure around it already was, so they need no document at all: they run
   in a browser, a Worker (no DOM) or on a server, and there is no
   serialization step to keep in line with the Plot renderer's.
3. **The same SVG, held by a test.** The light charts port the parts of d3 and
   Plot that decide the drawing: d3's tick and nice algorithms, band scales
   with Plot's rounding rule, log ticks and their SI labels, UTC time ticks and
   Plot's two-line time labels, stacking, gaps, and d3-shape's rounding of path
   coordinates to three decimals before Enarratio rounds to two. The light
   charts write each group and element Plot writes (facets for grouped bars
   included). `test/lite.test.ts` renders every bar, line and area example of
   the gallery and a matrix of options (orientations, layouts, empty
   categories, thinned labels, negatives, links, direct labels, log axes,
   bands, forecasts, gaps, and time axes from milliseconds to centuries) with
   both renderers and compares them element by element and attribute by
   attribute, ignoring only attribute order. A browser test renders the bundled
   light build in Chrome and compares it with the same charts drawn on the
   server. The ported algorithms are credited in `src/lite/scale.ts` (ISC).
4. **Two known differences, both where the Plot chart is wrong.** First, a
   bar link's name. With `href`, the Plot renderer moves each bar link's
   `aria-label` to `data-enarratio-mark`, because the step that renames Plot's
   groups matches the links too. The light renderer
   keeps the `aria-label`, as the bar chart intends. The parity test reads the
   Plot output's attribute back as `aria-label`. Second, a bar chart whose
   values are all zero: Plot's value scale then has a domain of zero width and
   draws every bar the full height of the frame; the light chart draws bars of
   no height, and a test pins both. Fixing the Plot renderer is a separate
   change in both cases.
5. **Entries and size.** `enarratio/lite` holds all three; `enarratio/lite/bar`,
   `enarratio/lite/line` and `enarratio/lite/area` hold one each. `npm run size`
   bundles each for the browser with rolldown, minifies and gzips it, and fails
   above 40 kB or if a light entry imports anything outside the package. They
   measure 7.3, 9.2 and 8.8 kB, and 12.7 kB together.
