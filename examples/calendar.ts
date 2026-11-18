// Samples received each day: weeks as columns, weekdays as rows, empty days outlined.
import { calendarHeatmap } from "enarratio/plot";

const start = Date.UTC(2026, 0, 1);
const days = Array.from({ length: 181 }, (_, i) => {
  const date = new Date(start + i * 86_400_000);
  const weekday = date.getUTCDay();
  const month = date.getUTCMonth();
  // Busy midweek, quiet at weekends, and a winter peak that fades by spring.
  const base = weekday === 0 || weekday === 6 ? 6 : 40 + ((i * 13) % 17);
  const season = month < 2 ? 1.5 : month < 3 ? 1.2 : 1;
  return { day: date.toISOString().slice(0, 10), samples: Math.round(base * season) };
}).map((d) =>
  // The lab was closed on New Year's Day; the courier log is missing for 13 to 15 April.
  d.day === "2026-01-01"
    ? { ...d, samples: 0 }
    : d.day >= "2026-04-13" && d.day <= "2026-04-15"
      ? { ...d, samples: null }
      : d,
);

export default calendarHeatmap({
  data: days,
  date: "day",
  value: "samples",
  valueLabel: "samples",
  title: "Samples received each day, January to June 2026",
  alt: "Calendar heatmap of samples received each day from January to June 2026: weekdays bring 40 to 84 samples and weekends about 6 to 9. January and February are the busiest, with weekdays mostly above 60. New Year's Day had none, and 13 to 15 April have no record.",
  caption: "Illustrative data. Weeks start on Monday.",
});
