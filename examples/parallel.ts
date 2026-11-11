// Many items over several measures: one axis per measure, one line per item, two highlighted.
import { parallelCoordinates } from "enarratio/plot";

const strains = [
  { strain: "A1", growth: 0.42, yield: 3.1, tolerance: 41, ph: 6.8 },
  { strain: "A2", growth: 0.38, yield: 2.7, tolerance: 44, ph: 6.6 },
  { strain: "B1", growth: 0.55, yield: 4.0, tolerance: 37, ph: 7.1 },
  { strain: "B2", growth: 0.61, yield: 4.4, tolerance: 35, ph: 7.3 },
  { strain: "C1", growth: 0.29, yield: 2.2, tolerance: 47, ph: 6.4 },
  { strain: "C2", growth: 0.33, yield: 2.4, tolerance: 46, ph: 6.5 },
  { strain: "D1", growth: 0.49, yield: 3.6, tolerance: 39, ph: 6.9 },
  { strain: "D2", growth: 0.52, yield: 3.5, tolerance: 40, ph: 7.0 },
  { strain: "E1", growth: 0.45, yield: 3.0, tolerance: 42, ph: 6.7 },
  { strain: "E2", growth: 0.58, yield: 4.1, tolerance: 36, ph: 7.2 },
  { strain: "F1", growth: 0.36, yield: 2.9, tolerance: 45, ph: 6.6 },
  { strain: "F2", growth: 0.4, yield: 3.2, tolerance: 43, ph: 6.8 },
];

export default parallelCoordinates({
  data: strains,
  label: "strain",
  axes: ["growth", "yield", "tolerance", "ph"],
  axisLabels: {
    growth: "Growth (per h)",
    yield: "Yield (g/L)",
    tolerance: "Heat limit (°C)",
    ph: "Best pH",
  },
  highlight: ["B2", "C1"],
  title: "Twelve yeast strains on four traits",
  alt: "Parallel coordinates of 12 yeast strains: growth and yield rise together, and both fall as heat tolerance rises. B2 grows fastest (0.61 per hour) and yields most but tolerates least heat; C1 is the reverse.",
  caption: "Illustrative data.",
});
