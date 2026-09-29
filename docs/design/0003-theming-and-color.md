# 0003. Themes, CSS custom properties and color checks

Status: accepted, 2026-09-28. Amended by [0009](0009-review-fixes.md) after the two reviews.

## Decision

**Author's decision.** "Each site passes a theme (palette, fonts, gridlines,
light and dark); any chart can override colors. Abscissa checks palettes for
colorblind-safe differences and readable contrast in light and dark."

**Implementation choices.**

1. **Charts contain no colors, only references.** A bar's fill is
   `var(--abscissa-series-2)`, never a hex value. `stylesheet(theme)` defines
   the properties once per page. One rendered chart therefore serves every
   theme, both color schemes and forced-colors mode, and a site can cache
   rendered charts independently of the reader's preference. (dustinedwards.info
   already worked this way with its own tokens.)
2. **Light and dark follow the page's `color-scheme`**, through CSS
   `light-dark()`. Sites that switch with an attribute (`[data-theme="dark"]`)
   pass that selector to `stylesheet`. Browsers without `light-dark()` get the
   light scheme, declared first as a fallback.
3. **A theme is data, with fixed-size palettes.** Eight series colors, five
   sequential steps, four status colors. Fixed sizes mean every chart can rely
   on every slot existing, and a chart with a ninth series throws rather than
   drawing it in an undefined color. Eight is the practical limit of
   distinguishable categorical hues; past it, the right chart groups series.
4. **Theme colors are hex**, so they can be measured. Per-chart overrides may
   be any CSS color (the caller takes responsibility for those), and are
   applied by overriding the slot's property on that one figure.
5. **Gridlines are CSS too.** Charts always draw them; the theme's stylesheet
   hides the ones it does not want.

## The checks

`checkTheme` measures, in light and in dark:

| Check | Standard | Severity |
|---|---|---|
| Text and muted text on the background | 4.5:1, WCAG 2.2 SC 1.4.3 | error |
| Series, status, focus and the darkest ramp step on the background | 3:1, WCAG 2.2 SC 1.4.11 | error |
| Sequential steps move away from the background in order | monotonic contrast | error |
| Every pair of series colors, with typical vision and simulated protanopia, deuteranopia and tritanopia | CIEDE2000 difference of 10 or more | warning |

Color vision deficiency is simulated with the Machado, Oliveira and Fernandes
(2009) model at full severity, and differences are measured with CIEDE2000
(Sharma, Wu and Dalal 2005), both implemented in `src/theme/color.ts`.
CIEDE2000 is tested against the published test pairs of Sharma, Wu and Dalal.

Similar series colors are a **warning**, not an error. With eight colors,
some pair is always close for some reader; the charts answer that by never
relying on hue alone (legends, direct labels, symbols, hollow points, heights,
outlines, data tables). The warning tells a site which series to label
directly. Both shipped themes pass with no errors; their warnings are shown in
the gallery.

## The dustinedwards.info theme

Its first six series colors are the site's ratified chart ladder (cadet,
purple, claret, sage, gold, rust), in the same order, with the site's light
and dark values. Slots seven and eight, and the sequential ramp, come from the
site's figure ramps. They began as an implementation choice, since the
site's own rule allows six series; the **author ratified them on
2026-09-28**.
