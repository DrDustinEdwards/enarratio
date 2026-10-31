// Parts of one whole, as a donut: at most six slices, each labeled with its share.
import { pieChart } from "enarratio/plot";

const replies = [
  { answer: "Very confident", count: 412 },
  { answer: "Somewhat confident", count: 538 },
  { answer: "Not very confident", count: 201 },
  { answer: "Not at all confident", count: 87 },
  { answer: "Not sure", count: 46 },
];

export default pieChart({
  data: replies,
  label: "answer",
  value: "count",
  donut: true,
  centerLabel: "1,284 replies",
  title: "Confidence in vaccine safety",
  alt: "Donut chart of 1,284 survey replies: 74% are very or somewhat confident in vaccine safety (32% and 42%), 16% not very confident, 7% not at all, and 4% not sure.",
  caption: "Illustrative data.",
});
