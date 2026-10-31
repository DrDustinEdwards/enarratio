# 0024. The chart types of 0.4.0, and how each stays accessible

Status: accepted, 2026-10-30; points 2 and 8, and the light-chart parts of 3 and 4, replaced
by [0025](0025-new-charts-on-the-figure.md). Builds on [0005](0005-scientific-charts.md), whose plan it
carries out for dose-response curves and phylogenetic trees.

## Decision

The charts checklist (area 10, section A) asks for the chart types readers and labs expect.
0.4.0 adds them, server-rendered on the same figure, data table and keys as every other chart:

- `enarratio/plot`: `divergingBarChart`, `waterfallChart`, `smallMultiples` (bar and line),
  `histogram`, `densityPlot`, `boxPlot`, `stripPlot` (beeswarm or jitter), `dotPlot`,
  `rangePlot`, `dumbbellPlot`, `slopeChart` and `pieChart` (and donut); `areaChart` stacks to
  100% with `percent`; `scatterPlot` draws bubbles with a size legend; `barChart` and
  `scatterPlot` draw error bars; and bar, line, area and scatter charts (and most new ones) take
  `annotations`.
- `enarratio/science`: `doseResponse` (with `fitLogistic`), `survivalPlot` (with
  `kaplanMeier`), `forestPlot` (with `poolEstimates`) and `phylogeneticTree` (with
  `parseNewick`).
- `enarratio`: `tableChart`, a table with inline bars, heat cells and sparklines.

Maps (checklist A15) wait on the author's answer about boundaries.

## Implementation choices

1. **Series differ by more than hue, chart by chart.** Lines take a dash per series after the
   first (densities, dose-response, survival) and a label at the line (a peak, an end); points
   take a symbol per series; dumbbell ends differ in fill (hollow, filled); slope lines are
   labeled by name at both ends and rising and falling lines differ in dash; signed bars,
   waterfalls and pies print each value, sign or share as text.
2. **Pies refuse past six slices.** The checklist allows refusing or warning. A warning on a
   server is a log line nobody reads, so `pieChart` throws and says what to do: a bar chart, or
   an "Other" slice.
3. **Annotations are drawn from Plot's own scales, after layout, and read in the alt.** A note
   or range is placed with `plot.scale(...).apply`, so it lands where the data it names is
   drawn on any scale (band, time, log). The drawing is one image to a screen reader, so each
   note is appended to the text alternative ("Notes on the chart: ..."). They are a Plot-only
   option: the light charts (record 0017) are unchanged, and their option types do not offer
   them.
4. **Error bars are the caller's.** As with forecast bands (0013), Enarratio draws intervals and
   does not estimate them: `errorBars: { lower, upper, label }` names two fields. The bar model
   reads them, so the data table and hover text carry them; only the Plot renderer draws them,
   and the light bar chart's options do not offer them. Stacked segments have no interval of
   their own, so error bars need one series or the grouped layout.
5. **100% stacking is in the model.** `percent` turns each value into its share of the x's total
   before either renderer draws, so `enarratio/lite` draws it identically, and a parity case
   holds that.
6. **The statistics are pure, cited and tested against published numbers** (as 0005 asks): the
   4PL fit by Levenberg-Marquardt in log EC50 with a Wald interval on log EC50, against R
   `drc`'s fit of the ryegrass data; Kaplan-Meier with Greenwood's variance and the log-log
   interval, against the 6-MP leukemia data; the Newick parser; histogram binning with Sturges'
   rule and round edges. Pooling (inverse variance, DerSimonian-Laird) and Silverman's
   bandwidth are standard formulas, stated in the captions the charts write.
7. **The fit and its method are visible text.** Dose-response, density, survival and forest
   plots add a sentence to the caption stating the method and the numbers a reader would ask
   for (EC50 with its interval; n and bandwidth; n, events and median; Q and I²).
8. **`tableChart` draws HTML, and its data table is what assistive technology reads.** The
   visible table, with its bars and colored cells, is hidden from screen readers; the figure's
   data table holds the same values as text (a sparkline's values listed) and is visually
   hidden by default. Every visible cell still prints its number, so the drawing reads without
   color. Sorting needs script, and is left to the enhancement layer.
9. **No new dependency.** The tree is laid out by Enarratio (rectangular: tips in order,
   parents at their children's midpoint), not d3-hierarchy as 0005 planned; the pie is drawn as
   SVG strings with the light charts' helpers, without Plot's help.
