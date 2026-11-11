// Flows from stage to stage: each band is as thick as what it carries.
import { sankeyDiagram } from "enarratio/plot";

const patients = [
  { from: "Referred", to: "Seen in clinic", patients: 820 },
  { from: "Referred", to: "Did not attend", patients: 140 },
  { from: "Walk-in", to: "Seen in clinic", patients: 310 },
  { from: "Seen in clinic", to: "Treated as outpatient", patients: 760 },
  { from: "Seen in clinic", to: "Admitted", patients: 290 },
  { from: "Seen in clinic", to: "Referred on", patients: 80 },
  { from: "Admitted", to: "Discharged home", patients: 240 },
  { from: "Admitted", to: "Transferred", patients: 50 },
];

export default sankeyDiagram({
  data: patients,
  from: "from",
  to: "to",
  value: "patients",
  valueLabel: "Patients",
  title: "Where clinic patients went in one quarter",
  alt: "Sankey diagram of 1,270 patients: 1,130 were seen in clinic (820 referred, 310 walk-ins) and 140 referrals did not attend. Of those seen, 760 were treated as outpatients, 290 admitted and 80 referred on; 240 of the admitted went home.",
  caption: "Illustrative data.",
});
