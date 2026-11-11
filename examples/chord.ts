// Flows among a few groups: each arc is what a group sends, each ribbon what flows each way.
import { chordDiagram } from "enarratio/plot";

const regions = ["Northeast", "Midwest", "South", "West"];
// Thousands of people who moved between regions in a year: rows send, columns receive.
const moves = [
  [0, 52, 310, 98],
  [41, 0, 265, 140],
  [128, 190, 0, 230],
  [62, 118, 290, 0],
];

export default chordDiagram({
  data: moves.flatMap((row, i) =>
    row.flatMap((thousands, j) =>
      thousands > 0 ? [{ from: regions[i] as string, to: regions[j] as string, thousands }] : [],
    ),
  ),
  from: "from",
  to: "to",
  value: "thousands",
  valueLabel: "Thousands of people",
  title: "Moves between US regions in one year",
  alt: "Chord diagram of moves between four US regions: the South gains most, receiving 865,000 people and sending 548,000. The largest single flow is 310,000 from the Northeast to the South.",
  caption: "Illustrative data.",
});
