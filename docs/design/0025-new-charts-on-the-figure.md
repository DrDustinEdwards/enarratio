# 0025. The new chart types on the figure, in both renderers

Status: accepted, 2026-10-31. Replaces points 2, 8 and the light-chart parts of points 3 and 4
of [0024](0024-more-chart-types.md); builds on [0017](0017-light-charts.md),
[0022](0022-readable-for-every-reader.md) and [0023](0023-the-figure-in-words.md).

## Problem

The chart types of 0024 were written before the figure in words (0023) was merged. They drew
their own SVG and table, but gave the figure no description, so their summary and overview were
empty; their numbers were English only;
the pie threw where every other limit is an issue; the light bar and line charts lacked the
error bars and annotations their Plot twins had; and `tableChart` drew style attributes (which
0022 forbids), hid its visible table from screen readers and showed a second, hidden one, so
enhance's sorting found the wrong table.

## Decision

1. **Every chart describes its data.** Each new chart passes a `ChartDescription` to `figure()`:
   its axes with their labels and units (`xUnit`, `yUnit`), and its values as series, so the
   summary and overview are computed as for every other chart and a missing `alt` is generated
   from them. Words the charts print (Count, Median, Running total, ...) are in the strings
   table's `terms`, and numbers and dates go through `numberFormat` and `dateFormat`, so
   `locale` and `strings` change them all. A fitted chart's method sentence is passed to the
   figure as `method`: it joins the caption after the author's text is checked, so a generated
   sentence is not graded as the author's writing.
2. **Complexity is an issue, as everywhere else.** A pie past six slices raises an issue
   (`strict` throws it, otherwise `onIssue` or a warning) with its advice: a bar chart, or an
   "Other" slice. Past eight it is refused outright, because the palette has eight slots.
   Replaces 0024 point 2.
3. **The light bar and line charts draw annotations and error bars.** Both renderers place them
   with the same shared code (`src/render/annotation.ts`) from their own scales, so the same
   options give the same SVG, and parity cases hold it. Replaces the light-chart parts of 0024
   points 3 and 4.
4. **`tableChart` is one table.** Its visible table is the figure's data table: real cells with
   numbers as text, the first column as row headers, heat cells colored by a `data-step` class
   and bars as decorative SVG (`aria-hidden`), with no style attributes. Screen readers read it
   as a table, enhance sorts it like every chart's table, and there is no hidden copy or chart
   and table switch. Replaces 0024 point 8.
