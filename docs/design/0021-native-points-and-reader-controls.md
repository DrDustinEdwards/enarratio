# 0021. Native points over the marks, the full keyboard and the reader controls

Status: accepted, 2026-10-30. Amends [0004](0004-enhancement-layer.md), points 4 and 5.

## Decision

**Author's decision.** Enarratio 0.4.0 meets the charts checklist (area 10)
for interaction: every interaction by mouse, touch, keyboard and screen reader,
described keys, no key a screen reader needs taken from it, native controls,
position announced, structural navigation, a sortable table and a chart and
table switch, with Highcharts' keyboard model where it agrees with the WAI-ARIA
Authoring Practices.

**Implementation choices.**

1. **Native points over the marks.** The marks were SVG elements given
   `role="button"`. Now each gets a native `<button>` (a `<span role="img">`
   where it does not filter) laid over it in an HTML layer the size of the
   drawing, placed from the mark's box and placed again when the drawing
   resizes. The points take no pointer events: pointers keep using the marks
   and their 24 pixel targets, so where targets overlap the visible mark still
   wins. Keyboards and screen readers use the points, which brings native
   activation (Enter and Space are the button's own), and a focus ring that is
   the button's outline, painted above every mark instead of drawn into the SVG
   where a later series could cover it. The SVG is one image again.
2. **An application, entered on purpose.** The points are grouped in
   `role="application"`, named by the chart's title and described by a key
   hint. In browse mode a screen reader reads the chart as its image, its hint
   and its table; Tab onto a point switches NVDA and JAWS to focus mode, so the
   arrow keys reach the chart. A grid would also switch modes but needs rows
   the drawing does not have. Keys with Alt, Control or Command, and keys the
   chart does not use, are never handled. The hint also shows, as text, while a
   point has focus.
3. **Highcharts' keys.** Left and Right move along the focused series (not to
   the bottom of the next category, as 0004 had it), Up and Down between
   series: within a stack or group that is the mark above or below, as before;
   where a category holds one point (a scatter plot) it is the nearest point of
   the next series. Home and End go to the ends of the series, Page Up and Page
   Down jump ten, and Backspace goes back to the point before the last move.
   A chart without series (a heatmap) treats each row as one. Every chart type
   gets the same keys from the same code.
4. **Place in the label.** Each point is named by its details and its place in
   its series ("Year 2019, Talks: 1, 1 of 5"): fixed at enhance, so screen
   readers never see a name change under focus.
5. **The table stays the server's.** Without script it is complete and in
   source order. The layer adds a sort button to each column header, with
   `aria-sort`, and a "Show table" button that shows the table in place of the
   chart (opening the disclosure, or un-hiding a visually hidden table) and
   puts it back as it was.
6. **Opt-in where a page should choose.** Expanding a chart to the window and
   keeping the view in the address are off by default. The expanded chart
   closes when focus leaves it, so it never covers the focused element. A view
   read from the address fires its event, unlike a filter the page sets: the
   page did not choose it, a reader who shared the link did.
7. **Strings are options.** Every string the layer writes is in
   `ENHANCE_STRINGS` and can be replaced through `strings`, so translations
   come from the page, as the server's do.

## Consequences

- The enhancement layer grows from 5.3 to 7.9 kB, bundled, minified and
  gzipped; `npm run size` now fails it past 9 kB.
- Pages that read `aria-pressed` or `tabindex` from the marks read them from
  the points instead (`.enarratio-points > *`, in the marks' reading order).
- The modes are reasoned from how NVDA and JAWS treat an application; no screen
  reader run is recorded yet (checklist B29).
