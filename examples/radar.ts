// A few profiles over several measures on one scale: each series an outline, the second dashed.
import { radarChart } from "enarratio/plot";

const assays = [
  { method: "PCR", sensitivity: 98, specificity: 99, speed: 40, cost: 35, ease: 45 },
  { method: "Antigen test", sensitivity: 72, specificity: 97, speed: 95, cost: 90, ease: 95 },
];

export default radarChart({
  data: assays,
  label: "method",
  axes: ["sensitivity", "specificity", "speed", "cost", "ease"],
  axisLabels: {
    sensitivity: "Sensitivity",
    specificity: "Specificity",
    speed: "Speed",
    cost: "Low cost",
    ease: "Ease of use",
  },
  max: 100,
  title: "Two diagnostic tests, scored out of 100",
  alt: "Radar chart scoring PCR and an antigen test out of 100: PCR leads on sensitivity (98 to 72), both are near 100 on specificity, and the antigen test leads on speed, cost and ease of use, each by 45 to 55 points.",
  caption: "Illustrative scores.",
});
