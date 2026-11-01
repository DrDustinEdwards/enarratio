# 0029. Phone drawings, wrapped bar labels and Play as sound

Status: accepted, 2026-11-01. Builds on [0021](0021-native-points-and-reader-controls.md),
[0022](0022-readable-for-every-reader.md) and [0027](0027-contrast-export-and-roles.md).
Number 0028 is the maps record (A15).

## Problem

The area 10 live check at 320 px (C12) found chart text under 12 px on most gallery charts and
on Foxhound's /product/intelligence: a 480 to 720 px drawing scaled into a 288 px column. Two
causes. The gallery drew each chart once, wide. And a horizontal bar chart's label margin grew
with its longest label (up to 220 px), so drawn narrow the margin was wider than the bars;
and below vertical bars a long category label made its neighbors' labels drop out.

Separately, Dustin decided B54 on 2026-10-31 ("Add Play button"): Chartability's sonification
heuristic, for readers who follow a trend better by ear than by a table, on every enhanced chart,
with the code loaded only when pressed so the layer keeps its size budget (D6, 9.5 kB).

## Decision

1. **Horizontal bar labels take at most two fifths of the drawing** (72 to 220 px). A label longer
   than its room breaks at its last space onto two lines; a word longer than a line is cut with
   an ellipsis, and the full label stays in the mark's name and the data table. Below vertical
   bars, every category keeps its label while its slot holds four characters, wrapping the same
   way, rather than thinning to every other label: a reader should not need the table to learn
   what a bar is. Narrower slots (many categories) still thin. Both renderers.
2. **`enarratio/redraw/narrow`** is the narrow half of `enarratio/redraw` on its own:
   `narrowChart(host, narrow, options)` swaps in a narrow server drawing under 30rem and enhances
   it, without the light renderers (about 28 kB of the gallery's script instead of 90 kB).
   `redrawChart` uses it for a `{ narrow }` spec.
3. **The gallery draws every chart twice**, at its width and at 228 px, and swaps the narrow one in
   on a phone. Pages grow from 99 to 162 kB gzipped; the check found 120 charts and no finding.
4. **Play as sound.** The layer adds "Play as sound" to the control bar of every chart with two or
   more marks, where the browser has Web Audio (`sound: false` turns it off). Pressed, it imports
   `sound.js`, which plays each series in turn: one 160 ms triangle-wave note per mark in reading
   order, two octaves from A3 for the lowest value to A5 for the highest, panned left to right
   with the mark's place on the x axis, a 0.7 s pause between series. The live region names each
   series as it starts, and the tooltip and series emphasis follow the note, so a sighted reader
   sees where the sound is. The button becomes "Stop sound"; it, or Escape anywhere on the page,
   stops at once (WCAG 1.4.2).
5. **The sound reads the drawing, not the data.** The server already maps values to positions
   linearly (or on the chart's own scale), so a mark's far edge orders and spaces the notes as the
   data does: a bar's end away from the baseline the bars share (so negative bars sound low), a
   point's center. No values travel to the browser, and every chart type with marks plays.
6. **Size.** `sound.js` is a separate chunk, 0.9 kB gzipped, with its own 2 kB limit in
   `npm run size`; what a page loads up front is 9.47 of the 9.5 kB budget. The next feature in
   the layer needs either a cut or a new record raising D6.
7. **Integrity.** An `import()` carries no integrity, so a page under an enforced Integrity-Policy
   preloads `sound.js` with `<link rel="modulepreload" integrity>`, as the gallery does; bundlers
   (Vite, rolldown) emit it as their own chunk. Every site today sends the policy report-only.

## Consequences

- The published `dist/enhance/` has two files, `index.js` and `sound.js`; a page without a
  bundler serves them side by side.
- Sound follows the drawing: a log axis sounds logarithmic, which is what the reader sees.
- Not done: reading a value aloud during play, or tempo control. Screen readers already read each
  point when walked by keyboard; Play is for the shape.
