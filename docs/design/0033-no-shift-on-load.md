# 0033. No layout shift when the layer loads

Status: accepted, 2026-11-03. Changes the redraw height of [0029](0029-phone-drawings-and-sound.md)
(`enarratio/redraw`, first in 0.6.0) and how the controls of [0021](0021-native-points-and-reader-controls.md)
and [0027](0027-contrast-export-and-roles.md) arrive.

## Problem

Checklist item D5 says a chart reserves its size, with no layout shift from charts. The area 10
verifier measured otherwise on 2026-11-03, with a layout-shift observer at 1280 and 320 px:
0.10 on dustinedwards.info/cv, 0.094 on Foxhound's dashboard, 0.045 and 0.10 on Foxing's stats
page and 0.018 on the Desk. On /cv at 320 px the figure grew from 442 to 585 px after scripts ran:

1. The redraw drew the chart at the frame's width and the spec's own height. The server's drawing
   had shown at its own shape (a wide drawing keeps 30rem and scrolls), 165 px tall on /cv; the
   redraw made it 215.
2. `enhance()` wrapped each legend entry in a button with padding and a border (47 to 58 px).
3. It added the control row (Show table, Play as sound) after the drawing, and the downloads after
   the CSV link, which wrapped the source line from one line to three (24 to 73 px).

The gallery measured 0, only because it swaps its narrow drawings before the first paint.

## Decision

- **The redraw keeps the server drawing's height.** It reads the drawing's viewBox and draws at the
  height that drawing showed in the frame: its own shape at the frame's width, or at 30rem for a wide
  drawing, which keeps that width and scrolls under it. A chart on a phone is a little shorter than
  before (165 instead of 215 px on /cv) and still has room for its axes; the page no longer moves.
- **A legend entry has its button's box before it has the button**: the same padding, border and
  24 px minimum height, dropped once it holds one (`li:has(> button)`).
- **The figure writes the controls ahead of the layer.** For a drawing that is not static, the
  server writes the controls `enhance()` adds with its default options, in its order, with its
  labels (`ENHANCE_STRINGS`, now in `src/controls.ts` beside the brush's scales so both sides use one
  list): Show table, Play as sound for two or more marks, Pick a range on a continuous x axis, then
  the downloads (beside the CSV link, or in the row without one) and Copy embed for a figure with an
  `id`. They are `inert` and marked `data-enarratio-pending`; `enhance()` swaps the working ones into
  the same place. With scripts off, `@media (scripting: none)` hides them, so a reader without
  JavaScript sees no dead buttons.
- The `controls: false` figure option leaves them out, for a page that never calls `enhance()` or
  turns those controls off; such a page would otherwise show inert buttons, or shift as the layer
  removes them.

The point controls, hint, tooltip and brush add no height: they are absolutely positioned or
visually hidden until focused.

## Not covered

- A page that enhances with options other than the defaults (`table: false`, `sound: false`,
  `download: false`, `expand: true`) still shifts unless its server figures match (`controls: false`
  when they turn controls off). Strings translated in `enhance({ strings })` are swapped in over the
  English ones, which can change a row's width.
- `narrowChart` (a server's narrow drawing) swaps a drawing of a different shape; the gallery does it
  before the first paint. A site that swaps later still shifts by the difference.
- The gallery closes both for itself in [0034](0034-gallery-swaps-without-shift.md).
- `prelum-chart-audit` measures layout shift on each page it checks, so a regression is found live.
