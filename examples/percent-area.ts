// Each month stacked to 100%: how the whole divides as its total changes.
import { areaChart } from "enarratio/plot";

const months = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
const share: Record<string, number[]> = {
  H1N1pdm09: [52, 46, 38, 30, 24, 20],
  H3N2: [38, 42, 44, 40, 36, 30],
  "B/Victoria": [10, 12, 18, 30, 40, 50],
};
const detections = Object.entries(share).flatMap(([subtype, counts]) =>
  counts.map((count, i) => ({ month: `${months[i]}-01`, subtype, count })),
);

export default areaChart({
  data: detections,
  x: "month",
  y: "count",
  series: "subtype",
  percent: true,
  xLabel: null,
  title: "Influenza detections by subtype",
  alt: "Share of influenza detections by subtype, January to June 2025: H1N1pdm09 falls from 52% to 20%, H3N2 stays near 40%, and B/Victoria rises from 10% to half of detections.",
  caption: "Illustrative data. Each month adds to 100%.",
});
