# 0005. Scientific chart types and the plan for the rest

Status: accepted, 2026-09-28.

## Decision

**Author's decision.** "Scientific chart types, designed in from the start and
added in stages: genome tracks, titer and dilution plots, phylogenetic trees,
county-level surveillance maps, gel-style band plots, dose-response and growth
curves. The first version ships the architecture for them and at least one
(genome tracks or titer plots); list the plan for the rest."

The first version ships **both** titer plots and genome tracks.

## The architecture they share

A scientific chart is an ordinary Enarratio chart. It:

1. takes typed options with a required `alt` (`FigureOptions`);
2. validates domain rules and throws with the row and field (a titer must be
   a positive reciprocal; a feature must lie inside the sequence);
3. computes its statistics in `src/science/`, as pure, separately tested
   functions that are also exported, so a paper's text and table can use the
   same numbers as the figure (`geometricSummary`);
4. draws with Plot marks, reshaped where needed by a render transform
   (genome features become strand arrows after Plot lays them out as bars);
5. keys every datum for the enhancement layer, and emits a data table suited
   to the field (for titers: n, GMT, 95% CI, number below the limit, and every
   titer).

## What shipped

**`titerPlot`.** Reciprocal titers by group on a log axis in the dilution
series' base, ticks at each dilution labelled 1:10, 1:20 and so on. Each
sample is a point, identical titers side by side so their number shows;
geometric mean titer with a Student's t 95% interval on the log scale; the
limit of detection as a labelled rule; values below it hollow at half the
limit, the usual convention, stated in the caption and table.

**`genomeTrack`.** A linear map: features to scale on a 1-based nucleotide
axis, as arrows along their strand, colored and listed by type, grouped into
tracks, with overlapping features packed into lanes by a greedy interval
algorithm. The data table gives every coordinate.

## The plan for the rest

Ordered by how many sites and papers need them, and by how much they reuse.

| Stage | Chart | Built from | Notes |
|---|---|---|---|
| 0.2 | **Dose-response curves** | `scatterPlot` points, a four-parameter logistic fit, `lineChart`-style curve | Fit (Levenberg-Marquardt) in `src/science/`, returning EC50/IC50 with confidence intervals; log x axis; tested against published datasets. |
| 0.2 | **Growth curves** | `lineChart` with log y | Replicate means with error bars; optional doubling time from the exponential phase. |
| 0.3 | **Dilution plots** (endpoint titration, plaque counts across dilutions) | `titerPlot` axis and the heatmap's cells | Reed-Muench and Spearman-Karber TCID50 in `src/science/`, with the plate drawn as a grid. |
| 0.3 | **Gel-style band plots** | Custom marks on a band scale | Lanes as columns, bands at log-scaled molecular weights against a ladder; for showing PCR and Western results as data, not photographs. |
| 0.4 | **Phylogenetic trees** | d3-hierarchy layout, Plot links and dots | Newick parser; rectangular and radial layouts; tips colored by metadata; keyboard traversal of the tree. Adds d3-hierarchy as a dependency. |
| 0.5 | **County-level surveillance maps** | Plot `geo` mark, the sequential ramp | Choropleths from caller-supplied TopoJSON (Enarratio will not bundle boundaries); the data table lists every county; a small-multiples form for weeks. |

Each stage adds its tests (unit, stored output, accessibility, visual), a
gallery example, an API section and a changelog entry before release.

The general charts also have planned additions from the site audit
([0007](0007-site-migrations.md)): signed stacked bars with a visible
baseline (Foxhound), a combined bars-and-line chart with event markers (the
Capsid error chart), and a swimlane timeline (the Capsid timeline).
