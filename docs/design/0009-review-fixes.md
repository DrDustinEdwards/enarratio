# 0009. What the two reviews changed, and why

Status: accepted, 2026-09-28. Amends 0002, 0003, 0004 and 0008 where noted.

Two independent AI reviews of pull request #1 at d4fe7b6 (Fable 5.1,
findings A1 to A17; Claude Opus 5.5, findings F1 to F23; see
[AI_USAGE.md](../AI_USAGE.md)) found problems the tests had missed. Dustin
Edwards set the order of the fixes (**author's decision**); they ship as
0.1.0-alpha.6. The CHANGELOG maps every change to its finding. This record
keeps the decisions that changed how Abscissa works.

## Rendering (amends 0002)

- **Keys are JSON** (`["2022","Talks"]`), not parts joined by `|`, so no data
  can make two marks share a key (A9, F14). Keys are documented as opaque.
- **Reading order comes from the data.** The server writes each mark's
  category and position (`data-abscissa-col`, `data-abscissa-row`); the
  enhancement layer sorts by those instead of SVG geometry, which is local to a
  facet and zero for a chart enhanced while hidden (F9).
- **Plot's warning is recognized by its structure**, a top-level `<text>` whose
  `<title>` counts warnings, not by the glyph, which data may contain (F13).
- **More input throws**: empty bar data, an all-empty series, non-positive or
  non-finite sizes, a log axis given zero or less, a dilution factor needing
  more than 40 steps, and statuses that are only `Object.prototype` names (A7,
  F2, F15). Local-midnight Dates are read as calendar dates (A3); rows are
  identified by the x value, not its label, so sub-daily series work (F3).
- **Axes are `aria-hidden`**, since the text alternative and table say what
  they say (A12).
- **Wide drawings keep 30rem and scroll inside the figure** on narrow screens,
  rather than shrinking text to 5px (A13).

## Color (amends 0003)

- **The default palette was replaced.** Series 1 to 6 now differ by at least 10
  CIEDE2000 units under every simulated vision, in both schemes, with each
  slot keeping its hue from light to dark (A1). The palette was found by a
  search over OKLCH hues constrained by 3:1 contrast in both schemes, then
  checked with `checkTheme`; slots 7 and 8 keep one warning between them.
- **Bars can be labelled directly** (`directLabels`), so series are told apart
  by text as well as color (A1).
- **Labels printed on marks reach 4.5:1** (F8). The label color is the scheme's
  text or background color when either reaches it, otherwise black or white,
  one of which always does; `checkTheme` now measures these pairs.
- **The focus ring has two tones** (F7): a background-colored ring inside a
  focus-colored one, drawn by the enhancement layer around the mark, so it
  shows against a neighboring series of any color. Measuring the focus color
  against every series color would still fail for some palettes; the two-tone
  ring makes that measurement unnecessary.
- **Theme text reaching CSS is validated** (F10, A10): names, fonts and
  selectors may not contain characters that end a comment, rule or element.

## Interaction (amends 0004)

- **Pointer capture waits for a drag** (F1). Capturing on pointerdown sent
  every click on a continuous chart to the SVG instead of the mark.
- **A range can be picked without dragging** (A4, WCAG 2.2 SC 2.5.7): click the
  plot once for one end and again for the other.
- **Small marks get 24 CSS pixel targets** (A5, SC 2.5.8): an invisible
  target drawn beneath each small mark. Where marks are denser than 24 pixels
  (titer points, thin stacked segments), targets overlap and the mark on top
  wins; there the data point's position is essential to the figure (the
  criterion's essential exception), every mark stays reachable by keyboard,
  and the data table carries every value. This is a partial fix: a pixel-exact
  24 pixel target for every mark of a dense dot plot would move the points.
  axe's target-size rule is now enabled; it measures the HTML controls, since
  it does not examine SVG.
- **The tooltip is dismissible and hoverable** (F6, SC 1.4.13): Escape hides
  it, and it stays while the pointer moves onto it.
- **`update()` parses inertly and sanitizes** (F11): only the elements and
  attributes Abscissa emits survive; handlers, scripts, unsafe links and
  styles other than palette custom properties are removed.
- **Enhancing again with other options re-applies them** (F18).

## Hosting (amends 0008)

- **A small Worker runs in front of the assets** and redirects `http:` to
  `https:` with a 301 (A14, F16). No zone setting was changed: the redirect
  and the headers belong to the gallery's own Worker.
- **Headers added**: `Strict-Transport-Security: max-age=31536000` (without
  `includeSubDomains`, since not every dustinedwards.info subdomain is known to
  be HTTPS-only) and a `Permissions-Policy` that turns off device features the
  gallery never uses.
- **`style-src` is split**: `style-src-elem 'self'` for stylesheets and
  `style-src-attr 'unsafe-inline'` for the palette overrides in `style`
  attributes, so inline `<style>` blocks are refused.

## Deferred

F21 and A17 (a development history of sustained, visible, collaborative
work) and F23 (the paper's state of the field and research impact) are for
the six months of public use before a JOSS submission.
