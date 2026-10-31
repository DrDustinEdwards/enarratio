# 0022. Readable for every reader: text size, textures, reader settings and a strict CSP

Status: proposed, 2026-10-30. Replaces the "similar series colors are a warning" rule of
[0003](0003-theming-and-color.md) and the style-attribute allowance of
[0008](0008-gallery-hosting.md); extends [0009](0009-review-fixes.md) (wide drawings scroll) and
[0011](0011-theming-from-outside.md) (the property contract).

## Decision

Charts meet the area-10 checklist's color, text and reader-setting rules (B1, B3, B5 to B8,
B43, B44, B47, B49, B57, C5, D3, D4) in the package itself, so every site gets them by
upgrading:

1. **Similar series colors fail a theme.** `checkTheme` reports two series colors closer than
   10 CIEDE2000 units, with typical vision or simulated protanopia, deuteranopia or
   tritanopia, as an error, and `stylesheet()` throws on any error. `defaultTheme`'s light
   series 7 moves from `#4f5500` to `#574d00` (it was 6.0 from series 8 under tritanopia), and
   the gallery's example theme was retuned to pass.
2. **A high-contrast theme.** `highContrastTheme` in `enarratio/themes`: text at 15:1 or
   more, gridlines at 3:1, every series at 4.5:1 and 10 units apart under every simulated
   vision. `stylesheet(theme, { highContrast })` uses its colors under
   `prefers-contrast: more`.
3. **Text in rem that never renders under 12px.** Mark text is `0.75rem`
   (`--enarratio-font-size-mark`), so it follows the browser's text size. Every chart's SVG
   carries a `font-size` presentation attribute that raises the size as the drawing shrinks:
   `clamp(mark, calc(a - b·cqw), max)`, measured against the frame (now a size container).
   The direct labels' fixed 11 and the progress ring's 11.2 are gone.
4. **Textures for filled series.** Bars and areas fill series 2 to 8 with an 8-unit SVG
   pattern (series color plus a texture in the color for text on it); series 1 stays solid.
   Legend swatches show the same textures with CSS gradients. Stacked segments and bars get a
   1px background-colored edge, and names printed on bars a halo of their bar's color.
5. **Direct labels never overlap.** Line labels that end close together are moved apart,
   order kept, by one shared function both renderers use.
6. **Reader settings in the base rules.** `prefers-contrast: more` (full textures, wider gaps,
   stronger gridlines); `forced-colors: active` (every color property becomes a system color,
   set on the drawing and legend so it wins over themes and overrides; series are told apart
   by textures, line dashes, symbols and labels; the ramp is steps between `Canvas` and
   `CanvasText`); print (light scheme, no scroll, one page, the table open, no tooltip, focus
   ring, brush or `[data-enarratio-control]`); animations capped at 5 seconds.
7. **No `style` attribute anywhere.** A chart's `colors` (or a primitive's `color`) override
   is written as `data-enarratio-colors="--enarratio-series-2: #8a4a1b"`, and
   `colorStyles(html)` returns `.enarratio[data-enarratio-colors="…"] { … }` rules for the
   page's own stylesheet. The gallery's policy drops `style-src-attr 'unsafe-inline'`.

## Why

- **Warning to error.** 0003 judged that eight colors always leave some pair close for
  someone, so a close pair was a warning and charts answered with labels. The checklist sets
  10 units under all three simulations as the bar (Chartability's CVD heuristic), and both
  shipped themes and the example theme can meet it, so a theme that does not is now a
  mistake, caught where the CSS is made rather than in a report nobody reads. Textures (4) are
  the answer for readers no palette serves.
- **The font-size attribute.** A wide drawing scales down to 30rem (0009), so a 640-unit
  chart's 12-unit text rendered at 9px on a phone. CSS cannot divide by the rendered width,
  so the attribute approximates the reciprocal with a line through the two ends (full width:
  the mark size; the narrowest width, 30rem for a wide drawing or 288px for a narrow one: the
  size that renders at 12px). Between the ends, size times scale is a concave curve, so it
  never dips below 12. The drawing's width is known only to the server, which is why the
  value is an attribute and not a rule; it is a presentation attribute, not a `style`
  attribute, so a strict CSP allows it. Measured in Chrome: 12px at 1280 wide, 16 units
  rendering at 12px at 320.
- **Patterns in the markup.** CSS cannot paint a texture into an SVG fill, so the patterns are
  `<pattern>` elements in each drawing. Their ids are hashed from the drawing's text and its
  color overrides, so the Plot and light renderers agree and two charts on a page never share
  one that the other recolors.
- **Forced colors on the drawing.** Chrome does not force SVG `fill` (measured: an inline
  `fill="#ff0000"` stays red under forced colors), so without rules marks keep theme colors on
  the reader's background. Setting `forced-color-adjust: none` on the drawing and defining the
  color properties there as system colors keeps one mechanism (custom properties) and lets the
  textures carry the series.
- **Overrides as rules (D4).** A hash CSP covers `<script>` and `<style>` elements, not `style`
  attributes; those need `style-src-attr 'unsafe-inline'`. The alternatives were SVG
  presentation attributes (cover the marks but not the HTML legend, cannot express
  `light-dark()` portably, and lose the label colors computed per slot) and a `<style>` inside
  each figure (needs a hash per chart). A data attribute plus rules the page places in its own
  stylesheet keeps every override a custom property, works under `style-src 'self'` with no
  inline allowance, and costs a page one call.

## Consequences

- **Breaking for themes that fail.** A site calling `stylesheet()` with a theme that has a
  close pair now gets an error. Capsomer's family theme had 7 such pairs on 2026-10-30
  (audit-packages.md, B7) and its own gate is 8 units; it must retune before it upgrades.
- **Breaking for overrides.** A page using `colors` must add `colorStyles(html)` to its CSS,
  or the override does not apply. `enarratio-astro` writes its own `<style>`; it should add
  these rules there.
- **Desktop text is a little larger.** A wide drawing's text is unchanged at full width but
  grows on narrow screens; margins are still estimated at 12 units, so very long category
  labels on horizontal bars can reach the frame's edge on a phone.
- **The frame is a size container** (`container-type: inline-size`). Inside a
  shrink-to-fit box (an inline-block, an auto-width grid track) a figure needs a width from
  its container.
- **Print opens the table** only where `::details-content` is supported (Chrome 131, Safari
  18.4); elsewhere the summary prints.
- **Visuals change** in every multi-series bar and area chart; the gallery's visual baselines
  are regenerated and gain forced-colors images, for Dustin's review.
