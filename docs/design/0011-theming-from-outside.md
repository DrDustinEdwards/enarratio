# 0011. Theming from outside: the custom property contract and the base rules

Status: accepted, 2026-10-02. Extends [0003](0003-theming-and-color.md); does not replace it.

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** Every fixed size, weight,
radius and animation timing in Enarratio's CSS becomes a custom property with
today's value as its fallback, so the rendered output does not change for
anyone who sets nothing. A theme-free `baseStylesheet()` and
`enarratio/base.css` ship beside `stylesheet(theme)`, and the full contract is
documented in [docs/api.md](../api.md#custom-properties). `stylesheet(theme)`
with a measured hex theme stays as it is.

## Why

0003 made colors external: charts hold references, a theme defines them. Sizes
were still inside the package, so a site whose design differs in type scale,
corner radius or motion had to override Enarratio's selectors and chase them
across releases. A site (or a design system that generates its own theme) should
set a property, not write a rule against internals.

Two kinds of consumer need two entry points:

- A site with an Enarratio `Theme` object (measured, hex) calls
  `stylesheet(theme)`: properties, base rules, gridline rules. Unchanged.
- A site whose colors come from somewhere else, such as a design system's
  tokens, links `enarratio/base.css` (or calls `baseStylesheet()`) and defines
  the color and font properties itself, in its own CSS. It gets no measured
  guarantee from `checkTheme`, which needs hex values, and that trade is its own.

## Implementation choices

1. **The fallback lives at the use**, `var(--enarratio-radius, 0.25em)`, not in
   a block of defaults on `.enarratio` or `:root`. A defaults block is a rule
   with a selector, so it would win over a value a site set on an ancestor of
   the figure (custom properties inherit, and a rule on the element itself
   beats the inherited value). A fallback at the use can only ever lose to the
   site.
2. **The names say the role, not the place**: `--enarratio-radius` is the
   control radius, `-radius-swatch` and `-radius-tooltip` are the exceptions.
   Text sizes are `em` fallbacks relative to `--enarratio-font-size`, so one
   property rescales a figure, and `-font-size-mark` rescales the drawing's text
   alone (the drawing's text is the one size a user asked for by name).
3. **The contract is tested against the stylesheet.** A test reads every
   `var(--enarratio-*, fallback)` out of `baseStylesheet()` and fails unless
   `docs/api.md` documents that property with that fallback. A property cannot
   be added, or a fallback changed, without the documentation moving too.
4. **Not properties, with reasons.** The `30rem` minimum width of wide drawings
   is the same decision `figure()` makes in code from `width` (480 px); two
   places to change it would let them disagree. Geometry written into the SVG
   (stroke widths, tick lengths, the 11-pixel direct labels, a ring's text
   size) is attribute markup, and presentation attributes cannot use `var()`;
   changing it would change stored rendered charts, which 0.2 promises not to.
5. **`enarratio/base.css` is generated** from `baseStylesheet()` by
   `scripts/build-css.mjs` during `npm run build`, so the two cannot differ
   (a test compares them when `dist/` exists). The script is plain JavaScript
   because the build runs on every supported Node.js line.
6. **Gridlines stay a theme choice, not a property.** Hiding is a `display`
   rule per direction; a theme-free site writes the one-line rule itself, shown
   in the API reference.
