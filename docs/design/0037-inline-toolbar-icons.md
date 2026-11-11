# 0037. Toolbar icons are inline SVG, not CSS data URLs

Status: accepted, 2026-11-11. Replaces the "Icons are masks" item of [0035](0035-chart-toolbar.md).

## Problem

The toolbar icons were CSS masks whose images were `data:image/svg+xml` URLs. A page whose
Content Security Policy is `img-src 'self'` (site-runtime's default, and the right default) blocks
every one of them, so the buttons lost their icons on those pages. Allowing `data:` for images
would loosen the policy on every site for the sake of the icons.

## Decision

Each icon is an inline `<svg class="enarratio-icon" viewBox="0 0 16 16" aria-hidden="true"
focusable="false">` holding one `<path>`, stroked in the button's text color. The server render
writes it into the figure's markup; the enhancement layer builds the same element with
`createElementNS` and `setAttribute`, never a markup string, so a page that enforces Trusted
Types has nothing to approve. No policy change is needed anywhere. In forced colors the stroke
follows the button's text color.

0035 kept icons out of `<svg>` so a page's chart selectors could not pick them up. The rules the
package writes now name `svg.enarratio-icon`, and the enhancement layer finds a chart's drawing
by `:scope > .enarratio-frame > svg`, so the icons are not mistaken for it. A host that selects
`.enarratio svg` for the drawing should select `.enarratio-frame > svg`.
