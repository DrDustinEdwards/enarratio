# 0041. Every chart fits a phone's drawing

Status: accepted, 2026-11-11. Builds on [0040](0040-narrow-bars-keep-their-plot.md) and amends
[0034](0034-gallery-swaps-without-shift.md) (the gallery's narrow drawing) where its height came from the
wrong `svg`.

## Problem

Under 30rem the gallery shows each chart drawn again at 228 units. A sweep of every figure on the
gallery's five pages at five widths (Galaxy S9+, 320, 390, 768 and 1280 pixels) found text that
overlapped other text or ran past the drawing on the waterfall, forest, Kaplan-Meier, slope,
donut, small multiples, facets, scatter, dose-response, titer, box, funnel, timeline and
phylogenetic tree charts, and long axis titles cut off on many more. Every narrow drawing was also
944 units tall: the gallery read the toolbar's 16-unit icon as the chart's `viewBox`, so it
asked for a height scaled from the wrong width (since 0.12.2).

## Decision

Each chart decides its layout from the room its drawing has, in the shared render code, so sites
get the same result as the gallery:

- Axis titles: centered under the plot if they fit there, else under the drawing, else on two
  balanced lines, the second cut short. The bottom margin grows by the lines it holds.
- Numeric x axes on a plot under 200 units print one tick per 50 units. Month ticks on a plot
  under 240 units step through 1, 2, 3, 4, 6 or 12 months to what fits.
- Category names under a slot (waterfall, box, titer) wrap onto up to three lines.
- Waterfall: a word or value wider than its slot turns the steps across, as horizontal bars.
- Forest plot: under 120 units of plot beside the estimate column, each row's name and estimate
  go above its interval, with a halo where they cross the line of no effect.
- Slope chart: where both side columns do not fit, the left shows the value and the right the
  value and name, cut to fit.
- Donut and pie: where the names do not fit beside the pie, a swatch list under it.
- Kaplan-Meier: ticks run to the end of follow-up at a spacing that fits; the at-risk table's
  head is sized from the text.
- Facets and small multiples: fewer columns until each panel's name fits and each panel is at
  least 60 units wide.
- Scatter: the size legend moves to a row under the plot.
- Funnel: a count that fits neither in nor beside its bar goes on the stage's name line.
- Dose-response: midpoint labels go to the side with room, else on two lines.
- Annotations: notes and range labels turn inward rather than run off the drawing.
- Line charts: reference, marker and forecast labels have a halo in the background color.
- Grouped bars name two series over the last group only when each name fits half a group;
  otherwise the legend and textures name them.
- Phylogenetic tree: where the branches have no room for two distance labels, the axis keeps one,
  as a scale bar.
- The gallery reads the chart's own `svg` in `.enarratio-frame` for its size.

The light renderers draw the same as Plot for every change above that touches a chart they draw.

## Why

A chart that overlaps its own text on a phone is unreadable for most of its readers. Rotated or
cut labels hide the names a reader needs; moving them to where there is room keeps every name
whole. Doing it in the render code, not the gallery, gives every site the fix.

## Consequences

The waterfall in the gallery now draws across at 640 units too, because "Equipment" is wider than
its upright slot; it no longer rotates names. Stored render snapshots for the forest, small
multiples, Kaplan-Meier, timeline, line, forecast and waterfall examples changed with it.
