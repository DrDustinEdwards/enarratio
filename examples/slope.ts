// A slope chart: each item's value at two times, labeled at both ends.
import { slopeChart } from "enarratio/plot";

const programs = [
  { program: "Biology", y2020: 412, y2025: 486 },
  { program: "Chemistry", y2020: 238, y2025: 251 },
  { program: "Microbiology", y2020: 118, y2025: 176 },
  { program: "Physics", y2020: 164, y2025: 142 },
  { program: "Public health", y2020: 196, y2025: 263 },
  { program: "Statistics", y2020: 92, y2025: 134 },
];

export default slopeChart({
  data: programs,
  label: "program",
  from: "y2020",
  to: "y2025",
  fromLabel: "2020",
  toLabel: "2025",
  title: "Enrolled majors, 2020 and 2025",
  alt: "Slope chart of majors in six programs between 2020 and 2025: five grew, Biology most, from 412 to 486, then Public health from 196 to 263, while Physics fell from 164 to 142.",
  caption: "Illustrative data.",
});
