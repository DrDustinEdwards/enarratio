/**
 * `enarratio/science`: figures for the laboratory (genome tracks, titer plots, dose-response
 * curves, survival curves, forest plots, phylogenetic trees), their statistics, and the network
 * chart. Needs the optional peer dependencies `@observablehq/plot` and `d3-force`, and, outside a
 * browser, `linkedom`.
 *
 * @packageDocumentation
 */

export { type DoseResponseOptions, doseResponse } from "./dose-response.js";
export { type ForestPlotOptions, forestPlot } from "./forest.js";
export { type GenomeFeature, type GenomeTrackOptions, genomeTrack } from "./genome.js";
export {
  kaplanMeier,
  type SurvivalEstimate,
  type SurvivalStep,
} from "./kaplan-meier.js";
export {
  fitLogistic,
  type LogisticFit,
  type LogisticParameters,
  logistic,
} from "./logistic.js";
export { type PooledEstimate, poolEstimates, type StudyEstimate } from "./meta.js";
export {
  type NetworkChartOptions,
  type NetworkLink,
  type NetworkNode,
  networkChart,
} from "./network.js";
export { parseNewick, type TreeNode } from "./newick.js";
export { type GeometricSummary, geometricSummary } from "./stats.js";
export { type SurvivalPlotOptions, survivalPlot } from "./survival.js";
export { type DilutionSeries, type TiterPlotOptions, titerPlot } from "./titer.js";
export { type PhylogeneticTreeOptions, phylogeneticTree } from "./tree.js";
