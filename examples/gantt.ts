// A project plan: tasks as bars on a time axis, milestones as diamonds, and a line for today.
import { ganttChart } from "enarratio/plot";

const plan = [
  { task: "Protocol approval", team: "Study office", from: "2026-01-05", to: "2026-02-06" },
  { task: "Site training", team: "Study office", from: "2026-02-02", to: "2026-02-27" },
  { task: "First patient in", team: "Clinics", from: "2026-03-02" },
  { task: "Enrollment", team: "Clinics", from: "2026-03-02", to: "2026-06-26" },
  { task: "Sample testing", team: "Laboratory", from: "2026-03-16", to: "2026-07-10" },
  { task: "Data cleaning", team: "Data team", from: "2026-06-01", to: "2026-07-31" },
  { task: "Database lock", team: "Data team", from: "2026-08-03" },
];

export default ganttChart({
  data: plan,
  task: "task",
  start: "from",
  end: "to",
  group: "team",
  today: "2026-04-15",
  title: "Trial plan for 2026",
  alt: "Gantt chart of a 2026 trial plan: protocol approval and site training run January to February, enrollment from March to June with sample testing to July, data cleaning in June and July, and database lock on August 3. Today, April 15, is during enrollment.",
  caption: "Illustrative plan.",
});
