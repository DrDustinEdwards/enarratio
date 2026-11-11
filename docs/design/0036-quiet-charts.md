# 0036. Quiet charts: solid fills, names on the chart, and a pointer that reads the whole plot

Status: accepted, 2026-11-11. Replaces item 4 of [0022](0022-readable-for-every-reader.md)
(textures on every filled series) and the inside bar labels it named; the 1px grid-colored edge
of [0026](0026-rollout-fixes.md) becomes a 2px background gap.

## Problem

Every bar and area chart drew series 2 to 8 with a texture, so a two-series stack read as
hatching before it read as data. Ticks, a y-axis line, rotated y titles and x titles that repeat
a year axis added ink that says nothing. Hover answered only over a mark: a thin bar or a line
was hard to hit, a stack showed one segment at a time, and a phone had no way to scrub. The
sites that use Enarratio looked older than the charts readers meet elsewhere (Datawrapper,
the Financial Times, Our World in Data).

## Decision

Look:

1. **Solid fills, names on the chart.** Series are told apart by text, not texture. Stacked bars
   name each series beside the last column (spread apart, with a short leader); grouped bars
   with two series name them over the last group; stacked areas name each band at its right
   end; lines keep their end labels. `directLabels` is on by default with `series`.
2. **Textures only where they are still needed.** A chart whose series cannot all be named
   (`directLabels: false`, a band with no thickness at the last x, more grouped series than
   fit) carries `data-enarratio-textured` and shows the 0022 patterns. So do
   `prefers-contrast: more`, `forced-colors: active` and print, on every chart.
3. **Values at the tips.** Every bar prints its value (a stack its total) at its tip when all
   of them fit the slot and there are no error bars. Inside bar labels are gone.
4. **Bars are shapes.** A 2px background gap between bars and segments
   (`--enarratio-bar-gap`); bars at most 40 units wide, the band padding growing instead; the
   outer end of each bar or stack rounded at 4 units, its base square. Small multiples of bars get the same
   shapes and tip values, with headroom under each panel's name, and keep their textures since a
   panel has no room for names. Histogram bins and waterfall steps stay square: each measures a
   range or a running total edge to edge.
5. **Quiet axes.** No tick marks and no y-axis line; a hairline grid and the stronger zero rule.
   The y title sits above the y labels, unrotated. No x title under a year or date axis; the
   data table and the description keep it.
6. **Areas** fill lighter with a 2px top line.

Feel and behavior:

7. **The whole plot answers the pointer.** On bars, lines and areas the nearest column is
   picked (a stack, a group, or every series at one x); on other charts the nearest mark within
   40 px. Lines and areas draw a crosshair with a dot on each series; bars fade the other
   columns.
8. **One card.** The tooltip shows the column's heading, then a row per series with its color
   key, its value first and its name. Marks without the parts show their full description. A column's card sits
   past the pointer, so it never covers what is being read, and hides while a mouse drags a
   range; it stays hoverable and Escape dismisses it (0009, WCAG 1.4.13).
9. **Legend highlight.** Hovering or focusing a legend entry dims the other series
   (`data-enarratio-spotlight`) while no filter is on.
10. **Motion.** Dimming fades over `--enarratio-duration-hover` (150ms), none under
    `prefers-reduced-motion`.
11. **Touch scrubs.** On a phone a drag across the drawing moves the card (`touch-action:
    pan-y`, so a vertical swipe still scrolls); the mouse brush keeps the range. Arrow keys move
    the same card and crosshair (0021).

Both renderers share the finish: the bar shapes, tip values and band names are made from the
finished SVG string, as `texture()` is, so `enarratio/plot` and `enarratio/lite` agree by
construction.

## Why

- Direct labels are the readable way to tell series apart (Datawrapper, FT chart doctor, Our
  World in Data); texture is the fallback for when they cannot be read, which is what
  contrast, forced colors and print ask for.
- Tufte's data-ink ratio, and every current chart system, drop tick marks and redundant
  titles; a year axis needs no "Year".
- A column-wide hit area follows WCAG 2.5.8 (target size) in spirit for thin marks, and a
  single card with the value first is how readers compare a column.

## Consequences

- Breaking for pages that styled the inside bar labels, the halo (`--enarratio-halo-width` is
  gone) or `directLabels: true` on grouped bars (no longer an error).
- The pointer, the card, the crosshair and the legend highlight bring the enhancement layer to
  11.5 kB gzipped, over the 10 kB of [0035](0035-chart-toolbar.md); the budget rises to
  12 kB (`npm run size`). The per-mark hover handlers they replace are gone.
- Every stored snapshot and visual baseline is regenerated.
- Capsomer's chart frame and the sites take the new release through their usual bumps.
