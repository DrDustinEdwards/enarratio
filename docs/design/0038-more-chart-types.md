# 0038. Fifteen more chart types, drawn by Enarratio

Status: accepted, 2026-11-11. Builds on [0024](0024-more-chart-types.md),
[0025](0025-new-charts-on-the-figure.md), [0035](0035-chart-toolbar.md) and
[0036](0036-quiet-charts.md).

## Problem

Enarratio draws about forty kinds of chart. Readers and the sites still ask for common types it
lacks: treemap, sunburst, Sankey, chord, funnel, radar, gauge, bullet, parallel coordinates, Gantt,
candlestick, violin, ridgeline, calendar heatmap and streamgraph.

## What others do

Checked 2026-11-11 (sources below):

- Observable Plot, which draws most of Enarratio's charts, has a mark for none of them except the
  streamgraph (`areaY` with the `wiggle` offset).
- D3 has layouts for the treemap and partition (`d3-hierarchy`), the Sankey (`d3-sankey`), the chord
  (`d3-chord`) and the streamgraph (`stackOffsetWiggle` with `stackOrderInsideOut`).
- Highcharts and Plotly between them draw nearly all fifteen. Highcharts' accessibility module
  gives keyboard navigation, a text description and a data table for every chart.
- Datawrapper offers none of them except bullet bars, and Vega-Lite only box plots and error bands
  among them.

Rules taken from the sources, by type:

- **Treemap.** Squarify the tiles (Bruls, Huizing and van Wijk 2000): slice-and-dice gives thin
  rectangles that cannot be compared. Sort siblings largest first.
- **Sunburst.** The rings are the levels, and angle is the value. Angles compare worse than
  lengths or areas, so a treemap is the better default for exact comparison.
- **Sankey.** A link is as wide as its value. The graph must be acyclic. d3-sankey's justify
  alignment and its six relaxation passes reduce crossings.
- **Chord.** The input is a square matrix of flows. A ribbon takes the color of the larger of its
  two flows. Too many groups clutter it.
- **Funnel.** No authority covers it. The stage counts, the share of the first stage and the share
  carried on from the previous stage are our own choice. They follow 0036's rule that values are
  printed, not read off angles or slopes.
- **Bullet.** Few's design spec: one featured bar about a third of the thickness, one or two
  comparative ticks, and two to five qualitative ranges in one hue from dark to light. The ranges
  reverse where lower is better.
- **Gauge.** Few built the bullet graph to replace gauges, which "display data poorly". Enarratio
  draws one only as a single value on a labeled arc, with the number printed. The docs point to the
  bullet.
- **Radar.** Keep the variables few and put them on one scale. A bar chart compares values more
  precisely, and the docs say so.
- **Parallel coordinates.** One axis per variable and one line per case. Axis order is deliberate.
  A static drawing highlights a subset because it cannot brush.
- **Gantt.** Tasks are rows and bars run over time. Milestones are symbols, and a labeled line marks
  today.
- **Candlestick.** The body is the open-to-close range and the wick the high-to-low range. Rising
  and falling bodies differ in fill (hollow or solid) as well as hue (WCAG 1.4.1).
- **Violin.** A density each side of the median and quartiles (Hintze and Nelson 1998). The width is
  density, so show raw points for small groups (Wilke).
- **Ridgeline.** Densities in rows on one x scale, overlapping a little, ordered by a meaningful key.
- **Calendar heatmap.** Weeks as columns and weekdays as rows, on the sequential ramp. An empty day
  is distinct from zero.
- **Streamgraph.** Wiggle with inside-out order. It shows an overview, not exact values, so the
  layers are named on the drawing and the table holds the values.

## Decision

1. **Enarratio draws all fifteen, in three releases.**
   - 0.13.0, parts and flows: `treemap`, `sunburst`, `funnelChart`, `sankeyDiagram`,
     `chordDiagram`.
   - 0.14.0, targets and profiles: `radarChart`, `gaugeChart`, `bulletChart`,
     `parallelCoordinates`.
   - 0.15.0, time and distribution: `ganttChart`, `candlestickChart`, `calendarHeatmap`,
     `streamgraph`, `violinPlot`, `ridgelinePlot`.

   All are in `enarratio/plot`, beside `pieChart`.

2. **They draw their own SVG with the light charts' helpers, with no new dependency.** This follows
   0024 point 9. The squarified layout, the partition, the Sankey layout and the chord geometry are
   written here, in `src/render/hierarchy.ts`, `flow.ts` and `arc.ts` (the arcs now shared with the
   pie), and are tested where they are tricky.
3. **Every new chart is a full Enarratio figure (0023, 0035).** Each one gets:
   - a title, the finding and the generated overview and summary;
   - the toolbar, with Sound, Download (CSV, SVG, PNG, tactile SVG, Copy embed) and Expand, and
     Range where the chart has a continuous x scale;
   - the visually hidden data table;
   - keyboard reading of every mark, Left and Right within a series and Up and Down across;
   - the one-card tooltip with the value first.

   Marks carry `data-enarratio-at` and `data-enarratio-shown`. A two-way chord ribbon instead shows
   its whole description, both directions.

4. **Quiet look (0036).** The new charts use:
   - solid fills;
   - a 2px background gap between touching shapes;
   - names and values written on the drawing where they fit, in the theme's text-on-series color;
   - no legend where every series is named.

   Textures show only under more contrast, forced colors and print. Treemap, sunburst and chord
   pass their drawing through `texture()`, since small tiles, arcs and ribbons can be too small to
   name.

5. **Hierarchies are flat rows and a `path` of fields,** from the outermost level in (one to four
   levels), as in Plotly's `path`. The data table lists every leaf with its path, value and share,
   then each group's subtotal ("Total" in the levels below it), then the whole.
6. **Flows are rows of `from`, `to` and `value`.** The field options are named `from` and `to`
   because `source` is every figure's source line. A Sankey with a cycle throws. A chord diagram
   with more than eight groups throws and advises a Sankey or a heatmap, as the pie refuses past
   eight slices (0025). The chord diagram's table is the matrix with each group's total.
7. **The plot-wide pointer picks the mark under it first.** Rings, ribbons and bands overlap one
   another's bounding boxes, so `Picker.pick` takes the mark whose shape holds the pointer
   (`isPointInFill`) before the nearest box. This holds on every chart, so every site behaves the
   same.
8. **Fewer words, one rule for the hard cases.** Charts the sources warn about (sunburst, gauge,
   radar, streamgraph) say in their API docs which chart compares better. They are not refused,
   since the choice is the author's.

## Sources

- Bruls, Huizing and van Wijk, "Squarified Treemaps" (2000): https://vanwijk.win.tue.nl/stm.pdf
- D3: https://d3js.org/d3-hierarchy/treemap, https://d3js.org/d3-chord,
  https://d3js.org/d3-shape/stack, https://github.com/d3/d3-sankey
- Few, "Bullet Graph Design Specification" (2013):
  https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf; on gauges:
  https://www.perceptualedge.com/blog/?p=102
- Byron and Wattenberg, "Stacked Graphs: Geometry and Aesthetics" (2008):
  http://leebyron.com/streamgraph/
- Wilke, _Fundamentals of Data Visualization_, ch. 9: https://clauswilke.com/dataviz/boxplots-violins.html
- Hintze and Nelson, "Violin Plots: A Box Plot-Density Trace Synergism", _The American Statistician_
  52(2), 1998, doi:10.1080/00031305.1998.10480559
- Data Viz Catalogue: https://datavizcatalogue.com/ (the treemap, sunburst, Sankey, chord, radar,
  parallel coordinates, Gantt, candlestick, violin, stream graph and calendar pages)
- FT Visual Vocabulary: https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md
- Highcharts chart types and accessibility module:
  https://www.highcharts.com/docs/chart-and-series-types/chart-types,
  https://www.highcharts.com/docs/accessibility/accessibility-module
- Plotly reference: https://plotly.com/javascript/reference/index/; Vega-Lite marks:
  https://vega.github.io/vega-lite/docs/mark.html; Datawrapper chart types:
  https://www.datawrapper.de/developer/visualization-types; Observable Plot marks:
  https://github.com/observablehq/plot/tree/main/docs/marks
- WCAG 2.2 Understanding 1.4.1 and 1.4.11: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html,
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

Not found in a source, and so our own design choice: the funnel's labels, the gauge's limits, the
ridgeline's overlap and ordering, and the calendar's week start (the locale's, Monday by default).
