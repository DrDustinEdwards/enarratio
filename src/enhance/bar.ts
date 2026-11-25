/** The toolbar above a chart's drawing: Sound, Range, Expand and Download. */

import { downloadMenu, expander, fill, sortTable, toolbar, toolButton } from "./controls.js";
import { exportButtons } from "./export.js";
import { parseScale } from "./marks.js";
import { rangeForm } from "./brush.js";
import type { Chart } from "./chart.js";

/**
 * The toolbar above the drawing: Sound, Range, Expand when asked for, and the Download menu. It
 * takes the place of the one the server wrote (figure.ts) and the figure's "Download CSV" link;
 * destroy() puts both back.
 */
export function attachControls(c: Chart): void {
  const s = c.strings;
  const listen = (t: EventTarget, type: string, h: (event: Event) => void): void =>
    c.listen(t, type, h);
  if (c.options.table) c.cleanup.push(sortTable(c.figure, s, (m) => c.announce(m)));
  const bar = document.createElement("div");
  bar.className = "enarratio-controls";
  if (c.options.sound && c.marks.length > 1 && "AudioContext" in window) {
    bar.append(playButton(c));
  }
  const scale = parseScale(c.figure);
  if (c.brushRect && scale) bar.append(rangeForm(c, scale));
  // A primitive is small and has no points to read up close, so it is never expanded.
  if (c.options.expand && !c.figure.hasAttribute("data-enarratio-static")) {
    c.expandButton = expander(c.figure, s, listen);
    bar.append(c.expandButton);
  }
  const csv = c.figure.querySelector<HTMLAnchorElement>(".enarratio-csv");
  const svg = c.svg;
  const files = svg ? exportButtons(c.figure, svg, c.options, s, (m) => c.announce(m)) : [];
  const home = csv?.parentNode ? ([csv.parentNode, csv.nextSibling] as const) : null;
  if (csv || files.length > 0)
    bar.append(downloadMenu([...(csv ? [csv] : []), ...files], s, listen));
  const server = c.figure.querySelector<HTMLElement>(":scope > .enarratio-controls");
  if (bar.childElementCount === 0) {
    server?.remove();
    if (server)
      c.cleanup.push(() =>
        c.figure
          .querySelector(":scope > .enarratio-legend, :scope > .enarratio-frame")
          ?.before(server),
      );
    return;
  }
  toolbar(bar, s, listen);
  if (server) server.replaceWith(bar);
  else {
    const next = c.figure.querySelector(":scope > .enarratio-legend, :scope > .enarratio-frame");
    if (next) next.before(bar);
    else c.figure.append(bar);
  }
  c.cleanup.push(() => {
    if (server) bar.replaceWith(server);
    else bar.remove();
    if (csv && home) home[0].insertBefore(csv, home[1]);
  });
}

/** Play: sounds each series in turn, pitch rising with the value, while the tooltip follows. Pressing again, or Escape, stops it. */
function playButton(c: Chart): HTMLButtonElement {
  const s = c.strings;
  // The name stays "Sound"; aria-pressed says it is playing (WAI-ARIA APG, toggle button).
  const set = (stop: (() => void) | null): void => {
    c.stopSound?.();
    c.stopSound = stop;
    toggle.setAttribute("aria-pressed", String(stop !== null));
    if (!stop) c.hover(null);
  };
  const onPlay = async (): Promise<void> => {
    if (c.stopSound) return set(null);
    const run = c.runs;
    const { play } = await import("./sound.js");
    if (run !== c.runs) return;
    set(
      play(
        c.figure,
        c.seriesOrder.map((list) => list.flatMap((i) => c.marks[i] ?? [])),
        (name) => c.announce(fill(s.playing, { series: name })),
        (mark) => c.hover(mark),
        () => {
          c.stopSound = null;
          set(null);
        },
      ),
    );
  };
  const toggle = toolButton("sound", s.sound, () => void onPlay());
  toggle.setAttribute("aria-pressed", "false");
  // Anywhere on the page, so a reader can always stop the sound (WCAG 1.4.2).
  c.listen(document, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && c.stopSound) set(null);
  });
  c.cleanup.push(() => set(null));
  return toggle;
}
