# 0040. A narrow bar chart keeps its plot

Status: accepted, 2026-11-11. Amends item 3 of [0036](0036-quiet-charts.md) (series named beside
the last stack) and item 7 of [0013](0013-forecasts-and-time-bars.md), where `maxXTicks`
overrode the thinning of a bar chart's time labels.

## Problem

On a phone the gallery's "Entries per year, 2005 to 2026" drew at 228 units. The names beside
the last stack ("Publications" is 12 characters of text that grows as the drawing shrinks) took
about 95 units of right margin, leaving under 90 for 22 stacks: each bar was 2 units wide and
the chart looked empty. The chart asked for `maxXTicks: 8`, and bar charts printed exactly that
many labels whatever the width, so eight years overlapped under the bars. Line charts already
treated `maxXTicks` as a cap on what fits.

## Decision

- Stacked bars name their series beside the last stack only while that margin is at most a
  quarter of the drawing. Otherwise the legend names the series and the textures come back, as
  on any chart whose series cannot all be named (`data-enarratio-textured`).
- Category labels under vertical bars are fitted to the plot's real width, after the right
  margin, not to the drawing less a fixed 80.
- `maxXTicks` on a bar chart is the most labels to print, as on line charts: the fewer of it and
  what fits.

## Why

The bars are the chart; a label that leaves them no room defeats them. The same option should
mean the same thing on every chart.
