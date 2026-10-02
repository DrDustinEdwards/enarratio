# 0014. The event timeline and the heat strip

Status: accepted, 2026-10-02.

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** Two new core primitives, no
Plot: an event timeline (lanes for sites or agents, spans and point events over a
time window, status shown by colour and shape, with a plain fallback on narrow
screens) and a heat strip (a one-row, no-axis strip using the sequential ramp, a
sibling of `uptimeStrip`). No straight meter: meters belong to Capsomer.

## Why

Dashboards of agents and sites ask two questions the existing charts answer badly
at small size: "what happened, where, when?" and "how busy was each hour?". A
timeline and a strip answer them in a row, without a charting dependency, so they
belong in core with the other primitives and run in the browser too.

## Implementation choices

1. **The timeline needs no hue.** Status is a shape (circle, triangle, square,
   dashed hollow circle) as well as one of the theme's four status colors, and
   every event has hover text, a line in the plain list and a row in the companion
   table. `status` is required, not defaulted: an event with no status would imply
   "ok".
2. **The fallback is a list in the markup, switched by a container query.** A
   drawing of lanes and spans cannot stay legible below about 30rem. The result is
   a container holding the SVG and an `<ol>` of the same events. By default the
   list is visually hidden (still read by screen readers, which cannot navigate an
   `role="img"` drawing); when the container is under 30rem the drawing is hidden
   and the list shown. A container query, not a media query, because the timeline
   may sit in a narrow column on a wide screen. Without CSS both show, which is
   readable. The 30rem is not a custom property (a container condition cannot use
   one) and matches the minimum width of wide figures.
3. **Overlapping events stack in rows inside their lane,** greedily by start time,
   with the marker's size counted so two point events a few pixels apart do not
   hide each other. Lane height follows the rows used.
4. **Times are UTC instants; the window is explicit or the events' extent.** Events
   outside an explicit window throw instead of vanishing; a span that runs past it
   is clipped in the drawing and keeps its real times in the list and hover text.
   Axis ticks are aligned to UTC (minutes to weeks, then months to decades) and
   about six, so labels stay readable.
5. **The heat strip reuses heatmap's ramp rules** (five equal steps between min and
   max, or four thresholds), moved to shared helpers so both agree. Colors come in
   five steps, so a strip cannot be read exactly by color; the exact values are in
   each cell's hover text, the summary sentence and `heatStripTable`. Cells get a
   hairline in the grid color so the palest step stays visible on the page.
6. **Both are built from a `prepare` function** that validates the options and
   computes everything once; the drawing, the text alternative and the companion
   table (0015) read from it, so they cannot disagree.
