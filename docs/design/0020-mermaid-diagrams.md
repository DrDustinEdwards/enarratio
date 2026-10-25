# 0020. Mermaid diagrams, drawn on the server

Status: accepted, 2026-10-25.

## Decision

**Author's decision (Dustin Edwards, 2026-10-25).** Mermaid goes into
Enarratio itself, "part of the core like we did for Observable": a diagram is
written in Mermaid syntax and comes out as an Enarratio figure, the way a bar
chart's options come out as one through Observable Plot. It is an entry of the
`enarratio` package, `enarratio/diagram`, with its renderer an optional peer
dependency, as record 0012 set for Plot and d3-force. No separate package.

## Why

Sites already write flowcharts and sequence diagrams in Mermaid, in Markdown,
and the usual way to show them is Mermaid's own script, which draws in the
browser: the diagram is absent until Mermaid's script downloads and runs, and
what it draws is an SVG with no text alternative beyond what the author adds by
hand. That is the problem record 0001 names for charts, so the answer is the
same: draw on the server, into HTML, with a required `alt`, an equivalent
table, and the theme's colors in light and dark.

## Implementation choices

1. **beautiful-mermaid, not Mermaid.** Mermaid itself lays out text by
   measuring it in a browser (`getBBox`), so on a server it needs a headless
   browser (mermaid-cli runs Puppeteer), which no Worker can run.
   [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) 1.1.3 (MIT,
   by Craft) parses the same syntax and lays it out with ELK in pure
   JavaScript, synchronously, with its own text metrics: no DOM, no browser.
   Checked on 2026-10-25: it renders in Node.js, in Chrome, and in a Worker
   under `wrangler dev` (workerd), and neither it nor elkjs uses `eval` or
   `new Function`. The cost is coverage: it draws flowcharts, state, sequence,
   class, entity-relationship and XY charts, not pie, Gantt, mindmap, timeline,
   git graph or the rest. Those throw, naming the types it can draw. XY charts
   throw too, pointing to `barChart` and `lineChart`, which already draw them
   with a data table and the enhancement layer.
2. **Its SVG becomes Enarratio's SVG, as Plot's does.** The output is parsed
   (as XML, with linkedom on servers and the browser's own `DOMParser` in
   browsers, behind the same `#document` switch as Plot) and rewritten: its
   `<style>` (which also `@import`s a Google font) and inline styles go; every
   color, which beautiful-mermaid writes as one of its own custom properties,
   becomes an Enarratio property; class names become `data-enarratio-mark`;
   marker ids get a prefix hashed from the source, so two diagrams on a page do
   not share arrowheads; coordinates are rounded; and the result is serialized
   with the same escaping as Plot's charts. Anything it draws that Enarratio
   does not expect (an element, a color, an `on*` or `href` attribute) throws,
   so a new beautiful-mermaid release cannot put unthemed or unexpected markup
   on a page unnoticed. The rounding and serialization moved out of
   `src/render/plot.ts` into `src/render/svg.ts`, unchanged, so both renderers
   share them; Plot's output is byte for byte what it was.
3. **Colors from the theme, checked.** Text and arrowheads take
   `--enarratio-text`, secondary text and lines `--enarratio-text-muted`,
   faint rules `--enarratio-grid`. Box fills, header fills and outlines are
   three new properties the base rules derive: the text color mixed 4% and 10%
   into the background (`color-mix`, with plain fallbacks where it is missing),
   and the muted text color. They sit inside `:where()`, at zero specificity,
   so a site can set any of them. Muted text lands on the 10% tint in group and
   block headers, so `checkTheme` gained one check, `diagram-contrast`: muted
   text against that tint must reach the text minimum. Mermaid's own `style`,
   `classDef`, `linkStyle` and `cssClass` set colors no check has seen, so they
   throw, as do `click` and `callback`, which a server drawing cannot run.
4. **The table says what the picture shows.** One table per diagram, built
   from the structure beautiful-mermaid parsed or drew, never from guessed
   positions: each flowchart node or state with its subgraph and where it
   leads (edge labels in brackets, undirected links both ways, start states
   named "Start"); each sequence message and note in source order with the
   `loop`, `alt` or other section it sits in (walked from the source with
   beautiful-mermaid's own statement patterns, because its drawing places a
   note after a block inside the block's frame); each class with its
   annotation, members and relationships; each entity with its attributes,
   keys and comments, and its relationships in words ("places zero or more
   ORDER").
5. **Size.** The drawing keeps the size its layout needs, and scales when the
   caller gives a width or height. Sequence labels sit on lifelines, so they
   get a halo in the background color (`--enarratio-diagram-halo`, 4px).
6. **Known limits.** beautiful-mermaid measures text with its own metrics for
   Inter; a much wider body font can crowd a label in its box. Its layout of
   an `actor` (the stick figure) puts the name close to the first message.
   In a browser bundle, elkjs makes the entry about 465 kB minified and
   gzipped, so diagrams are for the server and the build step; the light
   charts stay the browser's charts.
