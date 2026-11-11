// One reading against its scale, with qualitative bands and a target.
import { gaugeChart } from "enarratio/plot";

export default gaugeChart({
  value: 87,
  min: 0,
  max: 100,
  label: "Beds occupied (%)",
  target: 85,
  bands: [
    { to: 85, label: "normal" },
    { to: 95, label: "busy" },
    { to: 100, label: "full" },
  ],
  lowerIsBetter: true,
  formatValue: (v) => `${v}%`,
  title: "Hospital bed occupancy today",
  alt: "Gauge: 87% of beds are occupied, in the busy band, above the 85% target.",
  caption: "Illustrative data.",
});
