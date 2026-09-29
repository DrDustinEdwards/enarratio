# 0004. The optional enhancement layer

Status: accepted, 2026-09-28. Amended by [0009](0009-review-fixes.md) after the two reviews.

## Decision

**Author's decision.** "A shared enhancement layer: hover details,
click-to-filter events a page can listen to, a brush for picking ranges,
animated transitions when data changes, entrance animation; all respecting
reduced motion, working by keyboard, and with text alternatives for screen
readers."

**Implementation choices.**

1. **A separate entry point, `abscissa/enhance`, with no dependencies.** It
   imports nothing from the server-side package, so a page ships only the
   interaction code (a few kilobytes), never Plot or d3.
2. **It reads the markup, it does not re-render.** The server tags each drawn
   datum with `data-abscissa-key` and, where filtering makes sense,
   `data-abscissa-field` and `data-abscissa-value`. Continuous charts carry
   their x scale's domain and range. The layer needs nothing else.
3. **Events are DOM `CustomEvent`s that bubble** from the figure:
   `abscissa:select` and `abscissa:brush`. Any framework, or none, can listen.
   The layer changes only the chart's own appearance (dimming, a brush
   rectangle); what a filter means for the rest of the page is the page's job.
4. **Keyboard model: one tab stop per chart, arrow keys inside it.** Left and
   right move by category, up and down through a stack, Home and End to the
   ends, Enter or Space to filter, Shift with arrows to extend a range, Escape
   to clear. This follows the roving-tabindex pattern of the WAI-ARIA
   Authoring Practices, so a chart with sixty bars is not sixty tab stops.
5. **Semantics change when enhanced.** Without script the SVG is one image
   with a text alternative. With the layer, it becomes a group with the role
   description "chart", and each mark a button (or an image, when it has
   nothing to filter) named by its hover text, with `aria-pressed` for the
   filter state. A polite live region announces filters and ranges.
6. **Motion is opt-out by the reader.** Entrance animations and update
   transitions are skipped under `prefers-reduced-motion: reduce`, both in
   script and in CSS. Entrance runs once, when a chart first scrolls into
   view.
7. **Events report readers, not the page.** A click or key fires
   `abscissa:select` or `abscissa:brush`; `update()`, `setFilter()` and
   `clear()`, which the page calls itself, fire nothing, so a page never
   hears its own changes echoed back. (Changed after the first customer, the
   interactive CV, had to suppress those echoes.)
8. **What a click filters by is the chart's choice, made on the server.** A
   stacked bar filters by its series by default and by its category with
   `filterBy: "x"`, because a CV selects a year, not a publication type. A
   filter on the series field still matches by series on such a chart, so the
   legend and `setFilter` can emphasize a type while clicks select years.
   (Added in alpha.5, after the CV found series filters dimmed every bar.)
9. **An update never takes focus away.** `update()` replaces the marks, so it
   moves the roving tab stop, and focus if a reader was in the chart, to the
   mark with the same key, else the first of the same category, else the
   nearest position. Keyboard users keep their place and Escape keeps working;
   pages do not restore focus themselves, which left the tab stop disagreeing
   with the real focus. (Added in alpha.5.)
10. **Links without script, filters with it.** A bar chart given `href` renders
   each bar as a link, so a reader without script can still reach the
   filtered view. The SVG is then a named group, not one image, because
   `role="img"` would hide the links. The enhancement layer turns the links
   into filter buttons and keeps the address in `data-abscissa-href`.
11. **`destroy()` restores the server markup**, so a page can hand a chart back
   to server rendering, and tests can check the round trip.

## Consequences

- With script off, nothing is lost but interaction: the data, the
  description, the hover titles and the table are all in the HTML.
- The layer is tested in a real browser (headless Chrome): keyboard paths,
  pointer filtering, legend toggles, brushing by drag and by keyboard,
  animated update and destroy, and axe audits of the enhanced pages.
