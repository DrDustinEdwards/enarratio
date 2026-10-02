// A primitive's numbers as a table and a sentence: the same values as the drawing, so they cannot disagree.
// The summary is plain text, so it is escaped before it goes into HTML.
import { escapeHtml, heatStrip, heatStripTable, sparkline, sparklineTable } from "enarratio";

const entries = { values: [3, 5, 4, 8, 11, 9], label: "Entries per year" };
const load = {
  values: [12, 18, 31, 44, 38, 20, null, 9],
  label: "Requests per hour, 08:00 to 15:00",
  cellLabels: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
  width: 320,
};
const first = sparklineTable(entries);
const second = heatStripTable(load);

export default `<div class="primitive-tables">
<p>${sparkline(entries)} ${escapeHtml(first.summary)}</p>
${first.markup}
<p>${heatStrip(load)}</p>
<p>${escapeHtml(second.summary)}</p>
${second.markup}
</div>`;
