// A ranking with long category names reads best as horizontal bars.
import { barChart } from "abscissa";

const pages = [
  { page: "Teaching and mentoring", views: 1840 },
  { page: "Publications", views: 1320 },
  { page: "Influenza surveillance notes", views: 960 },
  { page: "Curriculum vitae", views: 720 },
  { page: "Contact", views: 310 },
];

export default barChart({
  data: pages,
  x: "page",
  y: "views",
  orientation: "horizontal",
  xLabel: null,
  yLabel: "Views",
  title: "Most viewed pages",
  alt: "Horizontal bars ranking five pages by views: Teaching and mentoring leads with 1,840, then Publications 1,320, surveillance notes 960, the CV 720 and Contact 310.",
});
