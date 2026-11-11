// Stages of a process: each bar prints its count and share of the first stage, and each gap the
// share of the previous stage that carried on.
import { funnelChart } from "enarratio/plot";

const enrollment = [
  { stage: "Invited", people: 12000 },
  { stage: "Opened the invitation", people: 7450 },
  { stage: "Screened", people: 3120 },
  { stage: "Eligible", people: 1890 },
  { stage: "Consented", people: 1240 },
  { stage: "Enrolled", people: 1105 },
];

export default funnelChart({
  data: enrollment,
  stage: "stage",
  value: "people",
  valueLabel: "People",
  title: "From invitation to enrollment in a vaccine trial",
  alt: "Funnel of trial recruitment: of 12,000 people invited, 1,105 (9.2%) enrolled. The largest drop is from opening the invitation to screening, where 42% carried on; 89% of those who consented enrolled.",
  caption: "Illustrative data.",
});
