# 0002. Charts are drawn on the server, as HTML strings

Status: accepted, 2026-09-28. Amended by [0009](0009-review-fixes.md) after the two reviews.

## Decision

**Author's decision.** Charts are "built on Observable Plot ... drawn on the
server into the HTML so they show without scripts; D3 for a force-directed
network chart."

**Implementation choices.**

1. **Every chart function returns a string of HTML.** Not a DOM node, not a
   React element. A string goes into any template: React Router, Next.js,
   Astro, a Worker's `Response`, a static site generator, a Markdown
   pipeline. React sites render it with `dangerouslySetInnerHTML`, which is
   safe here because every caller-supplied string is escaped (see below). A
   framework wrapper can be added later without changing the core.
2. **Plot draws into [linkedom](https://github.com/WebReflection/linkedom).**
   linkedom is a small DOM that runs in Node.js, Cloudflare Workers, Deno and
   Bun. dustinedwards.info had already established that Plot works inside a
   Worker with linkedom (jsdom and domino do not: domino uses `with`, which
   strict ESM bundles forbid).
3. **Enarratio serializes the SVG itself** and escapes every attribute and text
   node, so markup is valid as HTML and as XML whatever the data holds.
   linkedom's own serializer leaves `<` unescaped in attributes.
4. **Output is deterministic.** Coordinates are rounded to two decimals, Plot's
   per-chart `<style>` and inline font attributes are removed, and the network
   layout uses d3-force's seeded start. The same data renders byte for byte
   the same, which makes stored-output tests possible and lets a site cache
   rendered charts.
5. **Plot's warnings are errors.** Plot marks a chart it thinks is wrong (for
   example, numbers passed as strings) with a small warning glyph. Enarratio
   throws instead, because a chart that renders with a warning is a chart
   that says something other than what the author meant.

## The accessible structure

```html
<figure class="enarratio">
  <p class="enarratio-title">...</p>
  <ul class="enarratio-legend">...</ul>
  <svg role="img" aria-label="{alt}">...</svg>
  <figcaption>...</figcaption>
  <details class="enarratio-data"><summary>Data table</summary><table>...</table></details>
</figure>
```

The accessible name lives on the SVG, never on the figure: `role="img"` makes
its descendants presentational, so naming the figure would hide the caption
and data table from the readers they exist for. This rule was learned on
dustinedwards.info and is kept here. The one exception is a chart whose marks
are links (`barChart` with `href`): its SVG is a named group instead, because
an image cannot contain links a reader can reach.

Every keyed mark carries a `<title>`, so hovering shows its details in any
browser with no script at all. Every chart has a data table built from the
same values it draws, so the table cannot disagree with the picture.

## Consequences

- Charts cost the reader no JavaScript. The enhancement layer
  ([0004](0004-enhancement-layer.md)) is a separate, optional import.
- Text is laid out by the browser, not measured on the server, so Enarratio
  cannot wrap long labels precisely. It sizes margins from label lengths and
  prefers layouts that avoid the problem (horizontal bars for long names,
  direct labels at line ends).
- Live-updating dashboards re-render on the server (or in the browser, since
  the package also runs there) and call `EnhancedChart.update()` to animate
  from the old markup to the new.
