// Several series over time as layers around a moving center: how a whole and its parts change.
import { streamgraph } from "enarratio/plot";

// Weekly positive tests by virus over one season, each a bell-shaped wave peaking at its own week.
const viruses = [
  { virus: "RSV", peak: 9, height: 120, spread: 4 },
  { virus: "Influenza A", peak: 14, height: 210, spread: 3.5 },
  { virus: "SARS-CoV-2", peak: 6, height: 90, spread: 6 },
  { virus: "Influenza B", peak: 20, height: 70, spread: 3 },
  { virus: "Rhinovirus", peak: 3, height: 60, spread: 9 },
];
const weeks = Array.from({ length: 26 }, (_, w) => w);
const rows = viruses.flatMap((v) =>
  weeks.map((w) => ({
    week: new Date(Date.UTC(2025, 9, 6 + 7 * w)).toISOString().slice(0, 10),
    virus: v.virus,
    positives: Math.round(8 + v.height * Math.exp(-(((w - v.peak) / v.spread) ** 2) / 2)),
  })),
);

export default streamgraph({
  data: rows,
  x: "week",
  y: "positives",
  series: "virus",
  title: "Positive tests by virus, October 2025 to March 2026",
  alt: "Streamgraph of weekly positive tests for five respiratory viruses over 26 weeks: rhinovirus and SARS-CoV-2 lead in October and November, RSV peaks in early December, influenza A forms the largest wave in January, and influenza B peaks last, in late February.",
  caption: "Illustrative data.",
});
