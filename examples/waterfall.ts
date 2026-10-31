// A bridge from one total to another through increases and decreases.
import { waterfallChart } from "enarratio/plot";

const budget = [
  { item: "2025 budget", amount: 1200, total: true },
  { item: "New grant", amount: 340 },
  { item: "Indirect costs", amount: 85 },
  { item: "Ended award", amount: -260 },
  { item: "Equipment", amount: -140 },
  { item: "Salaries", amount: -95 },
  { item: "2026 budget", amount: null, total: true },
];

export default waterfallChart({
  data: budget,
  x: "item",
  y: "amount",
  total: "total",
  xLabel: null,
  yLabel: "Thousands of dollars",
  title: "Lab budget, 2025 to 2026",
  alt: "Waterfall from the 2025 lab budget of $1,200k to the 2026 budget of $1,130k: a new grant adds $340k and indirect costs $85k, while an ended award removes $260k, equipment $140k and salaries $95k.",
  caption: "Illustrative data.",
});
