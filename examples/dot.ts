// A dot plot: two values per item, told apart by color and symbol.
import { dotPlot } from "enarratio/plot";

const rates = [
  { state: "Georgia", year: "2015", rate: 41 },
  { state: "Georgia", year: "2025", rate: 52 },
  { state: "Ohio", year: "2015", rate: 44 },
  { state: "Ohio", year: "2025", rate: 49 },
  { state: "Oregon", year: "2015", rate: 39 },
  { state: "Oregon", year: "2025", rate: 55 },
  { state: "Texas", year: "2015", rate: 37 },
  { state: "Texas", year: "2025", rate: 46 },
  { state: "Vermont", year: "2015", rate: 51 },
  { state: "Vermont", year: "2025", rate: 58 },
];

export default dotPlot({
  data: rates,
  y: "state",
  x: "rate",
  series: "year",
  sort: "descending",
  xLabel: "Adults vaccinated against influenza (%)",
  title: "Influenza vaccination by state",
  alt: "Dot plot of adult influenza vaccination in five states, 2015 and 2025: every state rose, Oregon the most, from 39% to 55%, and Vermont stays highest at 58%.",
  caption: "Illustrative data.",
});
