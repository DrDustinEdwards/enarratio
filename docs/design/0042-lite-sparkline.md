# 0042. A light sparkline entry

Status: accepted, 2026-11-13. Builds on [0012](0012-subpath-exports.md) and [0017](0017-light-charts.md).

## Decision

`enarratio/lite/sparkline` (and `sparkline` from `enarratio/lite`) draws the bare SVG that
`sparkline({ inline: true })` draws, byte for byte, without the figure, the strings table or the
companion table. A page that shows a word-sized trend beside a number imported all of `enarratio`
for it (about 9.5 kB gzipped for the sparkline alone); the light entry is about 2 kB.

## How

- The drawing, its validation and the generated sentence move to `src/render/sparkline.ts`, which
  imports neither `figure.ts` nor `text.ts`. `sparkline` in `enarratio` wraps the same code in a
  figure; the light entry returns it as it is. `slotStyle` moves to `src/render/slot-style.ts` for
  the same reason (as `format.ts` did in 0012's follow-up).
- The light entry writes the English sentence. A page in another language gives `alt`, which both
  entries take; `strings` is the core entry's.
- `npm run size` fails above 4 kB for this entry, so it cannot grow back into the figure.
- A test holds the light drawing equal to `sparkline({ inline: true })` for a matrix of options,
  including the errors.
