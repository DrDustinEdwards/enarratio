// A heat strip: a one-row strip on the sequential ramp, here requests per hour over two days.
import { heatStrip } from "enarratio";

const hours = Array.from({ length: 48 }, (_, i) => {
  // Quiet at night, busy in the afternoon; the monitor missed hours 20 and 21.
  if (i === 20 || i === 21) return null;
  const hour = i % 24;
  return Math.round(40 + 160 * Math.exp(-(((hour - 14) / 4) ** 2)) + (i >= 24 ? 30 : 0));
});

export default `<div class="primitives">
${heatStrip({
  values: hours,
  label: "Requests per hour, 7 and 8 June",
  width: 480,
  cellLabels: hours.map(
    (_, i) => `${i < 24 ? "7" : "8"} June ${String(i % 24).padStart(2, "0")}:00`,
  ),
})}
</div>`;
