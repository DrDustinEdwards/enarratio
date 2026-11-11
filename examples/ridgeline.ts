// Many distributions in rows on one scale, overlapping a little, in a meaningful order (months).
import { ridgelinePlot } from "enarratio/plot";

// Daily high temperatures for a year: each month's highs scatter around a seasonal mean.
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const means = [17, 19, 23, 27, 30, 34, 36, 36, 33, 28, 22, 18];
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rows = months.flatMap((month, m) =>
  Array.from({ length: 30 }, () => {
    const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    // Winter highs swing more than summer ones.
    const spread = m < 2 || m > 9 ? 5 : m > 4 && m < 8 ? 1.8 : 3.5;
    return { month, high: Math.round((means[m] as number) + z * spread) };
  }),
);

export default ridgelinePlot({
  data: rows,
  x: "high",
  y: "month",
  xLabel: "Daily high (°C)",
  title: "Daily highs by month",
  alt: "Ridgeline plot of daily high temperatures for each month: highs center near 17 °C in January, rise to about 36 °C in July and August, and fall back to 18 °C in December. Winter months spread over about 20 degrees, while summer months are tightly bunched.",
  caption: "Illustrative data: 30 days a month.",
});
