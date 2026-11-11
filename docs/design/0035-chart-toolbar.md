# 0035. One toolbar above the chart, and a data table for screen readers and agents

Status: accepted, 2026-11-11. Replaces the "Show data" disclosure of [0023](0023-the-figure-in-words.md),
the chart and table switch of [0021](0021-native-points-and-reader-controls.md), and where the
downloads of [0027](0027-contrast-export-and-roles.md) and the controls of
[0033](0033-no-shift-on-load.md) sit.

## Problem

A chart carried its controls in three places. "Show data", a closed disclosure under the source line,
opened the whole table below the chart and pushed the page down. "Show table", in a row under the
drawing, swapped the chart for the same table and renamed itself "Show chart". The downloads ("Download
CSV", "Download SVG", "Download PNG", "Download tactile SVG", "Copy embed") were a row of links in the
source line, which Capsomer then folded into its own Download menu. Two controls opened the same table,
and a sighted reader had to scroll to compare the table with the chart. The table is there for screen
readers and AI agents, which read it from the HTML whether or not it is shown.

## Decision

- **The data table is visually hidden, always.** It stays in the HTML, right after the drawing it
  repeats, so screen readers and agents read it as before. Sighted readers get exact values from the
  hover and focus details, the summary sentence and "Download CSV". The `dataTable` option, the
  "Show data" disclosure (`showData`, `hideData`) and the "Show table" switch (`showTable`,
  `showChart`) are removed, with no fallback: the sites are not launched. A primitive's companion
  `markup` is hidden the same way; the companions lose their second argument.
- **One toolbar above the drawing**, under the head and before the legend: Sound, Range, then
  Download, each an icon and a one-word label. Tooltips never open on touch, and an icon needs its word
  to be understood (Nielsen Norman Group, "Icon usability"). It is a WAI-ARIA APG toolbar
  (`role="toolbar"`, "Chart controls"): one tab stop, Left and Right, Home and End. The Expand option
  sits before Download when it is on.
- **Toggles keep their names.** Sound and Expand say `aria-pressed`, never "Stop sound" or "Close
  expanded view" (APG toggle button).
- **The panels open over the chart.** Range (From, To, Apply, Clear) and the Download menu ("Download
  CSV" first, then the drawing's files and Copy embed) are native disclosures whose panel opens under
  the toolbar, over the drawing, so opening one never moves the page. Escape, a click outside, or focus
  leaving closes it, focus back on its button; opening one closes the other. Up and Down move in the
  menu.
- **One row, phones included.** The toolbar never wraps. Sound, Range and Download keep their words
  on a 360 px phone. Narrower, in steps by container query: the buttons tighten; then Download shows
  its icon and chevron without its word (a 320 px phone); then, at 200% text, every control shows its
  icon alone. A hidden word stays as screen-reader text, so every name stays.
- **No shift, and CSV without script.** The figure writes the toolbar ahead of the layer (0033): what
  only the layer can do is inert and hidden with scripts off, and "Download CSV" is a link in a native
  disclosure, so it works without script. A table chart and a primitive's figure have the toolbar with
  only Download.
- **Icons are masks** (replaced by [0037](0037-inline-toolbar-icons.md): inline SVG), drawn by the stylesheet on empty, hidden spans, so no icon is an `<svg>` a page's
  chart selectors could pick up. In forced colors they take `ButtonText`.
- **A keyboard never lands on something invisible.** A table chart's table still sorts; the hidden
  table gets no sort buttons. If a row header is a link, the table shows while focus is in it (WCAG 2.2
  SC 2.4.7). A host rule that makes tables scroll is overridden on the hidden one, which would
  otherwise be a scroll region nobody can reach.
- **Print** drops the toolbar; the hidden table stays hidden, as on screen.
- **Size (D6).** The toolbar's keys, panels and menu bring what a page loads up front to 9.64 kB,
  over the 9.5 kB that [0029](0029-phone-drawings-and-sound.md) left. The budget rises to 10 kB. A
  cut was weighed: the menu's Up and Down keys and the light dismiss are what make the panels behave
  as people expect, and the layer stays one file a page can serve without a bundler (0027).

## Consequences

Capsomer's `chart-downloads.ts`, which built a Download menu around the old row of links, is
removed. A site that styled `.enarratio-data > summary`, `.enarratio-export` or the source line's
CSV link has nothing left to style. `update()` keeps the CSV link's `data:text/csv` address, which its
sanitizer used to drop.
