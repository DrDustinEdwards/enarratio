# 0013. Forecast bands, the forecast boundary and time-axis bars

Status: accepted, 2026-10-02.

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** Forecasts are computed by
the caller; Enarratio only draws them. `lineChart` gains a `band` option (lower
and upper fields drawn as a shaded area) and `forecastFrom`, an x after which the
line is dashed, with the data table marking forecast rows and carrying the band's
bounds as columns. `barChart`, stacked bars included, gains a time axis so a run
per day needs no pre-formatted labels.

## Why

A dashboard that projects a metric needs to show which part of the line is
observed and which is projected, and how sure the projection is. Estimating
that is statistics, and which method is right depends on the data; drawing it is
Enarratio's job, so the same chart serves a naive trend, an ARIMA model or a
simulation. Hand-formatting a label per day for a bar chart of runs was the
other recurring chore, and a bar chart cannot use Plot's time scale (bars are
bands), so the time axis has to build its own.

## Implementation choices

1. **A forecast is never told from observed data by color alone.** After
   `forecastFrom` the line is dashed, points are hollow, a labelled rule marks
   the boundary, the hover text of a point says "forecast", and the table has a
   `Forecast` column. Any one of those survives a reader who loses the others.
2. **"After" means strictly after.** The row at `forecastFrom` is the last
   observed one, so a boundary that names the last day of data reads naturally.
   Each series' dashed stretch starts from its last row on or before the boundary
   so the line stays one line even when a series has no row exactly there.
3. **The band is in the series' color at 18% opacity, behind the line,** and is
   not a legend entry or a series of its own: it belongs to the line it surrounds.
   Its bounds are two table columns per series, named `Lower bound` and
   `Upper bound`, or `<label>, lower` and `<label>, upper` when the band is
   labelled; with several series the series name leads. A row has both bounds or
   neither, because a half-band has no honest drawing.
4. **`forecastFrom` must have data on both sides.** A boundary at or after the
   last x forecasts nothing, and one before the first x forecasts everything; both
   are almost certainly mistakes (a unit mix-up, say), so both throw rather than
   draw something plausible and wrong.
5. **Nothing changes when the options are absent.** The line chart builds the same
   Plot marks as before, which the unchanged stored markup of the existing
   examples demonstrates.
6. **The time axis is a category axis whose categories Enarratio generates.** Each
   row is floored to its UTC interval (weeks start on Monday), and every interval
   between the first and last gets a slot, so a missing day is visible as a gap
   instead of silently closing up. Bars keep the band scale, hover details,
   keyed marks, table rows and filtering of the category chart, and filter by the
   interval's label. Labels are ISO-style and sortable (`2026-01-05`, `2026-01`);
   `formatX` replaces them and must keep them distinct. More than 2000 intervals
   throw, so a mistyped year cannot ask for millions of bars.
7. **Long time axes thin their labels by themselves** (about one per
   `longest label * 7 + 12` pixels) because a year of days cannot print 365 labels;
   `maxXTicks` overrides. Every bar and table row remains.
