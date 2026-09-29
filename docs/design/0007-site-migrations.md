# 0007. What moving each existing site onto Abscissa involves

Status: proposed, 2026-09-28. No site is migrated in the first version
(**author's decision**: "Do not migrate the other sites in this job; list what
each migration would involve").

Common to every site: add `abscissa` as a dependency, include
`stylesheet(siteTheme)` once in the root layout, write the site's theme from
its existing tokens and run `checkTheme` on it in CI, call `enhance()` once in
the client entry if interaction is wanted, and delete the hand-drawn code in
the same change.

## dustinedwards.info

- **Today:** `:::chart` directives in Markdown, rendered by
  `app/lib/content/chart.mjs` (Observable Plot and linkedom in the Worker),
  with the site's own figure, alt, data-table and palette rules, and a
  `check:content` determinism gate.
- **Involves:** replacing the body of `renderChartHast` with calls to
  `barChart` and `lineChart` (types `bar`, `line`, `dot` map to `barChart`,
  `lineChart`, `scatterPlot`; `area` to `areaChart`), keeping the directive
  syntax so no post changes; converting the returned HTML to hast with the
  site's existing parser rather than `allowDangerousHtml`; using
  `dustinedwardsTheme`, whose first six series are the ratified ladder. The
  site's rule "direct labels, never a legend" maps to `directLabels: true` on
  line charts; bar charts would need the same option added to Abscissa first.
  Stored renders change once, so D1 must be re-derived through the content
  pipeline (the site's rule 18), and `check:content` will flag the change
  until it is.
- **The interactive CV** is the first consumer and uses Abscissa directly.

## Germomics

- **Today:** one Recharts `LineChart` in `DataChart.client.tsx`, lazy-loaded
  in the browser behind a placeholder, `aria-hidden`, with a separate table.
- **Involves:** replacing the client-only component with a server-rendered
  `lineChart` in the route loader or component, which removes the
  `ClientOnly` and `lazy` wrapper and the placeholder; the chart gains a text
  alternative and keeps the existing table (or uses Abscissa's). Recharts is
  removed from the dependencies. A theme from its `--brand`, `--border`,
  `--muted`, `--card` and `--ink` tokens.

## Foxhound

- **Today:** `app/components/charts.tsx`, 800 lines of hand-drawn SVG and
  HTML: sparkline, line-and-area, multi-line with gaps and reference line,
  stacked bars with negative values, signed bars, grouped bars, a meter, and a
  cohort heatmap grid. Charts are `aria-hidden`.
- **Involves:** mapping each to `sparkline`, `lineChart` (with
  `references`), `areaChart`, `barChart` (stacked, grouped, signed), and
  `heatmap` (cohort retention is the gallery example). Two gaps to close in
  Abscissa first: stacked bars mixing positive and negative values need a
  test and a visible baseline (Plot supports it; Abscissa has not been
  exercised on it), and the HTML `Meter` is better kept as a native
  `<meter>` element than replaced. The known text-stretching defect in its
  BarChart and GroupedBars goes away. Five chart tests in `test/` need their
  assertions moved to the new markup.

## Foxing

- **Today:** `apps/web/app/routes/stats.tsx`: a monthly bars chart with
  per-bar titles, genre bars as an HTML list, and a progress bar.
- **Involves:** `barChart` for monthly books (with `xDomain` for all twelve
  months), `barChart` with `orientation: "horizontal"` for genres, and
  `progressRing` (or a native `<progress>`) for reading progress. A theme from
  `--brand-ui`, `--brand-subtle`, `--text-tertiary` and `--border-subtle`;
  Foxing switches dark mode by attribute only, so it passes
  `colorScheme: { dark: '[data-theme="dark"]' }` to `stylesheet`.

## Capsid dashboard

- **Today:** `dashboard/src/ui/charts.tsx` in a browser-rendered React app
  polling every 60 seconds: uptime ticks, sparkline, an error chart (bars,
  error-rate line, threshold, deploy markers), a swimlane timeline and a
  countdown ring.
- **Involves:** `uptimeStrip` (its partial-tick state maps to `degraded`),
  `sparkline`, `progressRing` for the freshness ring. Abscissa runs in the
  browser too, so the app calls the same functions client-side and uses
  `EnhancedChart.update()` on each poll to animate changes. The error chart
  needs a combined bars-and-line chart, and the timeline a swimlane chart,
  both on the plan in [0005](0005-scientific-charts.md); until then those two
  stay hand-drawn.
