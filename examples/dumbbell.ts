// Two values per item joined by a line, the ends told apart by fill as well as color.
import { dumbbellPlot } from "enarratio/plot";

const coverage = [
  { country: "Brazil", y2015: 72, y2025: 84 },
  { country: "India", y2015: 61, y2025: 89 },
  { country: "Kenya", y2015: 55, y2025: 71 },
  { country: "Peru", y2015: 80, y2025: 77 },
  { country: "Viet Nam", y2015: 68, y2025: 90 },
];

export default dumbbellPlot({
  data: coverage,
  y: "country",
  from: "y2015",
  to: "y2025",
  fromLabel: "2015",
  toLabel: "2025",
  sort: "change",
  xLabel: "Measles first-dose coverage (%)",
  title: "Measles vaccine coverage, 2015 and 2025",
  alt: "Dumbbell plot of measles first-dose coverage in five countries: India rose most, from 61% to 89%, Viet Nam from 68% to 90%, Kenya from 55% to 71% and Brazil from 72% to 84%, while Peru fell from 80% to 77%.",
  caption: "Illustrative data. Hollow circles are 2015, filled ones 2025.",
});
