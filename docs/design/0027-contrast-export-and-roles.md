# 0027. Text-safe series shades, ramp edges, export and embed, and the drawing's role

Status: accepted, 2026-10-31. Builds on [0003](0003-theming-and-color.md),
[0011](0011-theming-from-outside.md), [0021](0021-native-points-and-reader-controls.md),
[0022](0022-readable-for-every-reader.md) and [0026](0026-rollout-fixes.md).

## Problem

The area 10 verifier ran Prelum's chart audit, in strict mode, over the gallery and the sites
on 2026-10-31 and found, in Enarratio's own drawing:

- Series colors used as text (direct labels, survival curve labels, at-risk rows) at 3.99 to
  4.41:1 in Capsomer's theme and 4.01 to 4.30:1 in the default theme. A series color needs only
  3:1 as a mark; written as text it needs 4.5:1 (B1).
- The lightest steps of the sequential ramp (heatmap, heat strip, the companion strip, the ramp
  legend) at 1.19 to 1.30:1 on the background, on every theme.
- Network links at 2.1 to 2.9:1, drawn in the muted text color at half opacity.
- The default theme's "unknown" gray, #8c959f, at 2.99:1 on the gallery's page, and
  `checkTheme` did not check the unknown color at all.
- The donut's center label measured against a slice (2.1 to 3.9:1). It sits in the hole, on the
  background, but nothing was drawn there for a check to read.
- No way to save the drawing as an image (C3) or to point another page at one chart (C4).
- The audit's B28 row demands `role="img"`, and asked whether an enhanced chart should be a group.

## Decision

1. **Each series has a label shade.** `stylesheet()` writes `--enarratio-series-label-1` to `-8`:
   each series color darkened (light scheme) or lightened (dark) by the least mix toward black or
   white that reaches 4.6:1 on the background, a tenth over the minimum so a page background a
   shade off the theme's keeps it over 4.5:1 (`readableShade`). A color that already passes is
   kept. Text whose fill is a series color takes it, by a base rule on `text[fill]` and
   `g[fill] > text`, so every chart that writes series names (Plot and the light renderers alike)
   is covered without changing its markup. A theme may give its own `seriesLabels`; a site with
   only `base.css` gets a 55% mix of the series and text colors; a chart's color override gets
   the same mix through `colorStyles()`. `checkTheme` reports a label under 4.5:1
   (`series-label-contrast`). The name is new because `--enarratio-series-text-N` already means
   the ink printed *on* a series color, and sites set it.
2. **Pale ramp steps get an edge.** Rather than start every ramp at 3:1, which would fail
   Capsomer's theme and every site theme overnight and halve the ramp's range, each step whose
   fill is under 3:1 gets a 1px edge (`--enarratio-cell-edge-width`) in its own color darkened or
   lightened to 3.1:1 (`--enarratio-sequential-edge-N`); a step that passes has a transparent
   edge. Cells and legend swatches carry it. `checkTheme` reports a step that reaches 3:1 by
   neither fill nor edge (`sequential-edge`). A site on `base.css` gets the muted text color round
   steps 1 to 3 until it defines the edges.
3. **Links, unknown and the donut hole.** Network links draw in the muted text color at full
   strength (it is checked at 4.5:1). The default unknown gray is #818a94 (3.5:1), and
   `checkTheme` now checks `status.unknown` at 3:1. The donut's hole is painted in the background
   and its label has a background halo, so it is read, and measured, on the background. No pie
   label sits on a slice (labels are outside, with leader lines), so there is no ink to pick by
   slice.
4. **Theme colors may be the site's tokens.** Any theme color may be
   `var(--site-token, #hex)`. The stylesheet writes it as given; `checkTheme` and every derived
   shade measure the fallback. This lets a site map its tokens without copying hex values, and
   keeps the checks.
5. **Export and embed, from the enhancement.** `enhance()` adds "Download SVG" and "Download PNG"
   beside "Download CSV" (`download`, on by default) and "Copy embed" for a figure with an `id`
   (`embed`, on by default). The SVG is the drawing as shown, with computed colors and fonts
   written as presentation attributes (not `style`, so a strict CSP reports nothing), the
   background painted in, and the pointer targets and brush removed. The PNG is that SVG drawn on
   a canvas at twice its size; no dependency. The embed snippet is a link,
   `<a href="{page}#{id}">{title}</a>`: an iframe of the page would embed the whole page, and a
   chart-only endpoint is the site's to serve. The enhancement layer's budget rises from 9 to 9.5 kB, replacing the limit in 0021: export, embed and the shared layout batching bring it to 9.2 kB. Loading the export code on demand would keep the first load under 9 kB, but the published `dist/enhance/index.js` is one file with no imports so a page without a bundler can serve it (README, "Without a bundler"), and a second file would break that.
6. **The drawing is one image, enhanced or not (B28).** Since 0.4.1 every chart's SVG is
   `role="img"` named by its `alt`, and `enhance()` does not change that. Its keyboard and
   screen reader points are native buttons in a separate `role="application"` layer beside the
   SVG ([0021](0021-native-points-and-reader-controls.md)). This follows WAI-ARIA 1.2, where `img`
   has presentational children, so nothing interactive may sit inside it; and the ARIA Authoring
   Practices Guide (APG), which asks that a composite widget be one tab stop with a roving
   `tabindex` ("Developing a Keyboard Interface") and that `aria-roledescription` be used only
   where it adds to a real role ("Providing Accessible Names and Descriptions"). A `group` with
   `aria-roledescription="chart"` would put the points inside the drawing and make every
   chart read differently once scripts ran. The unused `group` option is removed from the
   renderers. The audit's B28 rule (SVG `role="img"`) is therefore right, for enhanced charts
   too; the one `group` it found, on a linked bar chart on dustinedwards.info, is the markup 0.4.0
   drew and 0.4.1 replaced. The wide frame that scrolls
   is a named `group`, but that is a `div` round the SVG, not the drawing.
7. **Line and area x ticks fit the width.** Year and day ticks were chosen by span alone (about
   six), so at 239 pixels a two-series line chart's years ran together (found by Prelum). Ticks
   are now thinned to every nth, from the first, until the labels fit the plot's width at about 7
   units a character (more on a drawing whose text grows as it shrinks), in both renderers, and
   `maxXTicks` caps them as it does on bar charts. n labels need only n - 1 gaps, so all four of
   2020 to 2023 print at 288 px, and a step that lands on the last tick is preferred (2020 and
   2023, not 2020 and 2022).
8. **Narrow widths.** Screenshots at 320 px and in Capsomer's narrow columns showed more:
   - An axis title repeated its unit, "reads (reads)". A unit is now added only when the label
     does not already name it as a word.
   - "1,600" read as "1 , 600" in Capsomer's face. Enarratio asked for tabular figures on tick
     labels, and Schibsted Grotesk's tabular comma is as wide as a digit (15.2 against 6.4 units
     at 24px, measured in Chromium). Tick labels are end-anchored and need no columns, so they
     use proportional figures; tables keep tabular ones.
   - Fixed margins did not count the text's growth as a drawing shrinks (record 0022), so the y
     title met the widest tick label, the x title met the tick labels ("Day" on "Sun"), direct
     labels touched and a long series name ran off the edge. The left, bottom and (with direct
     labels) right margins and the direct label gap now grow with the text, computed the same way
     by both renderers (`leftMargin`, `bottomMargin` and `rightMargin`); renderPlot draws again
     with the wider margin when Plot's first drawing needs it.
   - A scatter's first point sat on the axes over a tick label; points are inset from them.
   - A rounded axis was rounded for ten ticks but drew about one per 35 units, so data reaching
     23 ended above a top tick of 20. A y axis is now rounded to the step of the ticks it draws.
     An x axis is not: with two or three ticks across a narrow drawing, doses 1 to 5 ran 0 to 10.
   - Direct labels kept a 96-unit gutter at every width. Under 480 it is sized to the labels.
   - A scatter's lowest point sat on the "2" tick beside its label; each linear axis is
     widened by a twentieth of its span before rounding.
   - The x title stood at the foot of a bottom margin sized for text grown in a narrow column,
     so at a drawing's own size it stood far below the ticks. It now sits 1.5em below the tick
     labels' last line, and a time axis counts a second line only when a tick uses one.
   - A server drawing 440 wide in a 320 px column shrank its text below 12px: nothing drew it
     again. Prelum's redraw moves into the package as `enarratio/redraw`, for Prelum and
     Capsomer to share: lite draws bar, line and area charts again at the frame's width.
   - The timeline's narrow list indented 1.25em, so the frame's overflow clipped "1."; 2.25em.
   - A summary capitalized every sentence's first letter, so "example.com: ..." and "carrel.app
     rose" read "Example.com" and "Carrel.app". Only a sentence opening with a plain lowercase
     word is capitalized.
   - A drawing 480 or wider keeps its text size and scrolls under 30rem, as designed (A13), but
     nothing showed that it did: the "Reads per sample" bar at 480 hid S3 and S4 at 320 px while
     a 288-wide line chart beside it scaled. The frame now shows a shadow at the edge that has
     more (background covers that scroll with the drawing), with no script.
9. **Forced colors are already in the visual suite (B57).** `test/browser/visual.test.ts`
   screenshots every gallery example in forced colors (`forced-colors: active`, emulated in
   Chrome) in both the default and the example theme, beside light and dark, and CI compares them
   with the stored images. No new screenshots are needed.

## Not done here

- **A screen reader run (B29)** needs NVDA, JAWS and VoiceOver on real machines, which the cloud
  sessions that build Enarratio do not have. It stays with Dustin; the modes in 0021 are still
  reasoned, not observed.
- **Tactile export (B55)**, a swell-paper or embosser file, needs a format choice (braille labels,
  simplified marks, a fixed paper size) and testing with readers who use one. Skipped for now.

## Consequences

Direct labels and curve labels are a shade darker in light mode and lighter in dark mode than
their lines; a heatmap's palest cells and ramp swatches gain a thin edge; network links are
darker. Sites that set `--enarratio-*` themselves (Capsomer's `css/enarratio.css`) should add
`--enarratio-series-label-N` and `--enarratio-sequential-edge-N` from the theme's values, or
take the fallbacks above. Every enhanced chart gains two or three buttons; a site that does not
want them passes `download: false` or `embed: false`.
