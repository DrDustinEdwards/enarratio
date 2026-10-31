# 0023. The figure in words: finding, overview, summary, source and data

Status: accepted, 2026-10-30. Builds on [0002](0002-server-rendering.md) and
[0015](0015-primitive-companions.md); ends the zero-domain difference noted in
[0017](0017-light-charts.md).

## Problem

The charts area 10 audit found that a chart said what it showed only in its SVG's `aria-label`: no visible finding,
no summary computed from the data, no overview of axes and ranges, no source line or notes, no "Get the data", English
and `en-US` only, and primitives with no figure or table unless the page called a companion. A missing `alt` threw, so
nothing was ever generated, and nothing else a reader would struggle with was reported.

## Decision

Every chart, and by default every primitive, is one `<figure>` that says what it shows in text, all of it in the
HTML with scripts off, in the order Capsomer's chart frame uses (title, finding, chart, data behind "Show data"):

1. **Head.** A `figcaption` first: title, subtitle (what it shows or how to read it), and the `alt` as the visible
   finding. The figcaption names the figure; the finding is `aria-hidden`, because the SVG reads the same text as its
   name and a screen reader should hear it once.
2. **Overview** (B53), visually hidden, before the legend and the drawing: chart type, series and points, each
   axis's label and range.
3. **Summary** (B39, B24), visible under the drawing, computed from the same values as the table: each series'
   first and last value, a peak or low when it passes both ends by more than half the range, the highest and lowest
   values, values beyond three interquartile ranges (judged in orders of magnitude on a log axis), and the last
   interval drawn. Short sentences in common words; the gallery's summaries score grade 2 to 7 (B19).
4. **Caption, notes, source line.** The source line holds the source (linked), byline and a "Download CSV" link (C1,
   C2).
5. **Data**, in a closed `details` labeled "Show data" and "Hide data".

## Implementation choices

1. **The CSV is a `data:` URL with `download`.** It is navigation, not a fetched resource, so a hash CSP does not
   block it, and `download` makes browsers save it rather than open a top-level `data:` page (which Chromium
   refuses). It is built from the table's rows, so it cannot disagree with them, with a byte order mark for
   spreadsheets. Fields are quoted per RFC 4180 and a field a spreadsheet would run as a formula gets an apostrophe; a
   negative number is left alone. Over 100,000 characters it would double a page's weight, so there is no link and an
   issue says to serve the file and pass `csvHref`.
2. **How a build fails.** A figure reports issues as it renders: no `alt` (it then names itself from its overview and
   summary, B52), no title, an axis with no label and no title, more than 6 series or 1,000 points (B21), author text of
   15 words or more above grade 9, a CSV too large to inline. They go to `onIssue`, else `console.warn`; `strict: true`
   throws on the first, naming the chart. A site sets `strict` once in the options it spreads into every chart, or
   collects issues with `onIssue` and fails at the end. No hidden global setting.
3. **Locale and strings are options, not globals,** for the same reason: `locale` drives every generated number and
   date (`Intl`), and `strings` replaces any generated text, English by default. `numberFormat` (decimal, percent,
   currency, compact, SI) and `dateFormat` are exported for `formatValue` and a page's own text.
4. **Dates are written out where people read them,** in the table, hover details and summary ("October 6, 2025",
   with the time and "UTC" for sub-daily data). Mark keys, `data-enarratio-x` and filter events keep ISO dates, so no
   site's filter handler changes. Bar charts on a time axis keep their compact interval labels, which are also their
   tick labels.
5. **Primitives are figures by default** (B30, B51): the companion's summary and table, titled by `label`. `inline:
   true` keeps the word-sized SVG for a sentence or a table cell. Their figure is `data-enarratio-static` and never
   scrolls, so `enhance()` leaves it alone.
6. **Extremes render.** Long category labels are cut with an ellipsis on the axis; the table, hover details and each
   bar's name keep the whole text. Values from a million up get compact tick labels so they fit the margin. A value
   axis whose values are all zero runs from 0 to 1 in both renderers, where Plot used to fill the frame.
7. **One file for the words** (`render/text.ts`) and one for the sentences (`render/describe.ts`), so the light
   charts carry them too: the light bundle grows about 4 kB gzipped, within its limit.

## Not done here

- Enhancement announcements ("Filtered to", "Range selected") are still English; they live in `enarratio/enhance`,
  which imports nothing from the server package.
- The primitives' own sentences stay English unless `alt` and `summary` are passed.
- The scatter regression band is drawn but not in the table.
