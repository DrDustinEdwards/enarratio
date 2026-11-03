# 0034. The gallery's phone drawings and controls do not move the page

Status: accepted, 2026-11-03. Closes two gaps [0033](0033-no-shift-on-load.md) left under "Not
covered", for the gallery; changes the height of the gallery's narrow drawings from
[0029](0029-phone-drawings-and-sound.md). No change to the package.

## Problem

The live check (`prelum-chart-audit`, D5) measured the gallery at 320 px on 2026-11-03: a layout
shift of 0.040 on each theme page (largest 0.032, `p.enarratio-summary` +80 px) and 0.034 on the
Astro page. Record 0033 said the gallery measured 0 because it swaps its narrow drawings before the
first paint; on a long page the browser paints before the page's module script runs, so the swap
lands after it.

1. **The narrow drawing was a different shape.** The server's drawing of the first chart is
   640 x 320, wide, so on a phone it keeps 30rem and scrolls: 480 x 240. The narrow drawing
   (`narrowChart`, drawn 228 wide) took the chart's own height, 320, so the frame grew by 80 px.
   Every chart with a narrow drawing grew by a quarter of its height; the maps shrank.
2. **The control row gained a button.** The gallery enhances with `{ expand: true, url: true }`;
   the figure writes the controls `enhance()` adds with its default options, which have no
   Expand. Show table, Expand and Play as sound do not fit one row in a phone's column, so the
   row wrapped from 26 to 56 px as the layer arrived.

## Decision

- **A narrow drawing is drawn at the height its wide drawing shows on a phone**: H x 480 / W for
  a wide drawing (30rem at the default 16 px rem), its height scaled to the column for a
  narrower one. The width stays 228, so its text stays 12 px (C12). A chart that adds rows to the
  height it is given (the survival curve's numbers at risk) is drawn again with that much less.
- **A chart whose rows set its height keeps it.** Horizontal bars with wrapped labels, the slope
  chart, the genome map and the tree overlap their labels drawn three quarters as tall, so their
  narrow drawings keep their own height. The gallery's stylesheet gives the wide drawing that
  height under 30rem, `@container (width < 30rem)` on the frame, which is where gallery.js swaps:
  the wide drawing keeps its scale, centred in the taller box, until the narrow one replaces it.
  Without scripts a phone keeps that drawing, with a little space above and below.
- **The gallery writes Expand into the pending row** after Show table, where `enhance()` puts it,
  with the layer's own label (`ENHANCE_STRINGS.expand`), so the row is the size it will be.
  `url: true` adds no control.

The maps' narrow drawings are taller than the map they hold (a map keeps its shape, so a 228 px
map is shorter than the 458 px the wide one shows); the space is left below the map rather than
let the page move.

## Why not in the package

The package draws what it is given; the narrow drawing's size is the caller's. The height rule
needs the wide drawing's markup and the breakpoint, both of which a caller of `narrowChart` has,
so it is documented beside `narrowChart` (docs/api.md, README) rather than exported as a helper,
and no release is needed. A figure option that writes Expand (`controls: { expand: true }`) would
let other sites that enhance with it do the same without string surgery; it waits until a site
needs it.

## Measured

`prelum-chart-audit` against the built gallery served locally with the live site's preload
headers, at 1280 and 320 px: no findings on the four pages (before: D5 0.040, 0.040, 0.034 and
0.034). A layout-shift observer scrolling each page at 320 and 1280 px records no shift.
