# 0026. Fixes from the 0.4.0 rollout: linked bars, bar edges and hover titles

Status: accepted, 2026-10-31. Replaces the linked-bar exception of
[0002](0002-server-rendering.md) and the background-colored bar edge of
[0022](0022-readable-for-every-reader.md); builds on [0023](0023-the-figure-in-words.md).

## Problem

Rolling 0.4.0 out to the sites and running Prelum's chart audit (area 10) on the gallery found:

- A bar chart with `href` drew its SVG as a named group, not an image (B28), so it was the one
  chart whose drawing was not read as one named picture.
- Bars in series 2 to 8 are filled with a texture pattern, which a contrast check cannot read, so
  it measured those bars by their edge instead: the 1px background-colored stroke that keeps bars
  apart (B6), at 1:1 against the page (B1).
- Foxhound's product rules strike hover tooltips, and every mark carried a `<title>` that the
  browser shows on hover, with no way to leave it out.

## Decision

1. **A linked bar chart is one image too.** Its SVG is `role="img"`, like every other chart. The
   bars stay links for the pointer, out of the tab order (`tabindex="-1"`), and each category's
   row header in the data table is the same link, so keyboards and screen readers reach every
   link in the table, where the values are. The enhancement layer is unchanged: bars filter, and
   the link moves to `data-enarratio-href`.
2. **The edge between bars is grid-colored.** It stays 1px (`--enarratio-bar-gap`), but is
   drawn in `--enarratio-grid`, the theme's color for decoration that is not held to a contrast
   minimum, rather than the background. Bars still never touch, and a contrast check reads a bar by
   its fill. The change is slight: the default theme's grid is a light gray in light mode and a
   dark gray in dark mode.
3. **`hoverTitles: false`** leaves out every mark's `<title>`. Each mark's details move to a
   `data-enarratio-label` attribute, which `enhance()` names its points with, and the data
   stay in the table.

## Consequences

The audit still reads text printed on a textured bar (`directLabels`) against the page, because
it cannot see a pattern's color; that is the audit's to fix, by reading the color under a
pattern's texture. Smaller fixes in the same release (a capitalized summary, a range from a value
to itself drawn as a line, ranges said with their unit, date ticks for whole-day data) are in the
CHANGELOG.
