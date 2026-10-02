# 0015. Companion tables for the primitives

Status: accepted, 2026-10-02. To be reviewed by the author once used: "Try it; Dustin
will say if it feels wrong."

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** Every primitive (`sparkline`,
`uptimeStrip`, `progressRing`, `timeline`, `heatStrip`) also offers its numbers as a
data table and a summary sentence, through a companion function per primitive
(`sparklineTable`, and so on), computed from the same values so the table can never
disagree with the picture. The primitives keep returning exactly what they return
today, because Capsomer's components already call them.

## Why

Figures carry a data table because a picture of numbers is not a way to read them.
The primitives are pictures too, and until now carried only a one-line text
alternative. A reader who wants the values of a sparkline, or the events of a
timeline, had nothing to read. A separate function keeps a primitive small where it
sits inline in a sentence or a table cell, and lets a page add the table only where
there is room for it.

## Implementation choices

1. **A function beside the primitive, not an option on it.** An option that changed
   the return value (a string or an object) would break the contract Capsomer relies
   on and make every call's type depend on its options. A companion has its own
   return type, `{ summary, table, markup }`.
2. **One `prepare` step per primitive feeds both.** `prepareSparkline`,
   `prepareUptimeStrip`, `prepareProgressRing`, `prepareHeatStrip` and
   `prepareTimeline` validate the options and compute the values; the primitive draws
   from the result, and so does its companion. Disagreement is then not a thing to
   test for after the fact but something the structure rules out. Each companion
   throws the primitive's own errors, and the unchanged stored markup of the existing
   primitive examples shows the refactor changed nothing the primitives return.
3. **The summary is the generated sentence,** which is also each primitive's text
   alternative when `alt` is not given. It ignores a caller's `alt`, because `alt`
   may say something else (a finding, not the numbers); when a primitive has only
   `alt` there is nothing to generate from and the summary is that `alt`.
4. **`markup` is the figure's own table markup** (`dataTableBlock`: a closed
   `<details>`, or visually hidden), so the existing CSS styles it and a primitive
   beside its table looks like a figure with a data table. `table` is the same data
   as rows and columns for callers who render their own. The summary is plain text,
   not markup; callers escape it (`escapeHtml` is in core).
5. **A missing value reads `no data`,** not a blank, because a blank cell is
   ambiguous to a screen reader. Chart tables keep their blank cells, which was an
   earlier decision; the primitives' tables are new and can be clearer.
6. **Each table's columns follow what the primitive draws:** position and value;
   period and status; measure, value, total and percent; event, lane, status, start
   and end; cell, value and ramp step. The heat strip's ramp step is in the table
   because colour is the only thing a strip draws, and the step is that colour as a
   number.
