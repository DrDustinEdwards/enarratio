// Small primitives with the same styling: progress rings and an uptime strip.
import { progressRing, type UptimeStatus, uptimeStrip } from "abscissa";

const hours = Array.from({ length: 48 }, (_, i): UptimeStatus => {
  if (i < 4) return "unknown";
  if (i === 30) return "down";
  return i === 29 || i === 31 ? "degraded" : "up";
});

export default `<div class="primitives">
${progressRing({ value: 7, max: 12, label: "Chapters drafted" })}
${progressRing({ value: 0.92, label: "Tests passing", size: 56 })}
${uptimeStrip({ slots: hours, label: "Site, last 48 hours" })}
</div>`;
