// A primitive's numbers as a table and a sentence, beside its inline drawing: the same values, so they cannot disagree.
// Each sits in a figure whose caption gives a visible title and the finding, worked out from the same values.
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

const top = Math.max(...entries.values);
const busiest = Math.max(...load.values.filter((v) => v !== null));
const hourOf = (v: number | null) => load.cellLabels[load.values.indexOf(v)];

const caption = (title: string, finding: string) =>
  `<figcaption class="enarratio-head"><p class="enarratio-title">${escapeHtml(title)}</p><p class="enarratio-finding">${escapeHtml(finding)}</p></figcaption>`;

export default `<div class="primitive-tables">
<figure>
${caption("Entries per year", `Entries rose from ${entries.values[0]} in the first year to ${top} in year ${entries.values.indexOf(top) + 1}, then fell to ${entries.values.at(-1)}.`)}
<p>${sparkline({ ...entries, inline: true })} ${escapeHtml(first.summary)}</p>
${first.markup}
</figure>
<figure>
${caption("Requests per hour, 08:00 to 15:00", `Requests peaked at ${busiest} at ${hourOf(busiest)}; ${hourOf(null)} has no reading.`)}
<p>${heatStrip({ ...load, inline: true })}</p>
<p>${escapeHtml(second.summary)}</p>
${second.markup}
</figure>
</div>`;
