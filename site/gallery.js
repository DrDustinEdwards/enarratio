// The gallery's own script: enhances the charts, wires Capsomer's site header and theme button,
// and prints each chart's events under it. Bundled by scripts/gallery.ts into one file, so the
// page needs no inline script.
//
// A page holds up to forty charts, and enhancing one reads layout and inserts a layer of points,
// a hint and controls. Done for all of them at once that is one long block of main-thread work
// before the page can respond, for charts no one is looking at. So a chart is enhanced when it
// nears the viewport, nearest first and one to a task. The
// charts are complete and readable without it, as before; a shared link's filter or range, and
// the chart a #hash names, are enhanced at once. A chart with a narrow drawing swaps it in when it
// is enhanced, before it comes into view.
import { enhance as enhanceHeader } from "capsomer/behavior/site-header";
import { enhance as enhanceTheme } from "capsomer/behavior/theme-switch";
import { narrowChart, REDRAW_ATTRIBUTE } from "../dist/redraw/narrow.js";
import { enhance } from "./enhance.js";

const OPTIONS = { expand: true, url: true };
/** The chart enhance() would pick up (a primitive's figure has nothing to interact with). */
const FIGURES = "figure.enarratio:not([data-enarratio-static])";
/** How far from the viewport a chart is enhanced: two screens' worth. */
const NEAR = "200% 0px";

/**
 * Enhances a chart; one whose frame carries a narrow drawing is drawn again first (under 30rem it
 * swaps the drawing in, so it fits a phone's column with 12 px text) and then whenever its width
 * crosses that line.
 */
function start(figure) {
  const host = figure.closest(`[${REDRAW_ATTRIBUTE}]`);
  if (!host) return enhance(figure, OPTIONS);
  const spec = JSON.parse(host.getAttribute(REDRAW_ATTRIBUTE) ?? "{}");
  narrowChart(host, spec.narrow ?? "", OPTIONS);
}

const waiting = new Set(
  document.querySelectorAll(`${FIGURES}, [${REDRAW_ATTRIBUTE}] figure.enarratio`),
);
/** @type {{ figure: Element, distance: number }[]} */
const queue = [];
let draining = false;

const later = () =>
  globalThis.scheduler?.yield ? scheduler.yield() : new Promise((resolve) => setTimeout(resolve));

/** One chart to a task, so a long page never holds the thread for more than one chart's work. */
async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const next = queue.shift();
    if (next && waiting.delete(next.figure)) {
      observer?.unobserve(next.figure);
      start(next.figure);
    }
    await later();
  }
  draining = false;
}

const observer =
  typeof IntersectionObserver === "function"
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting)
              queue.push({
                figure: entry.target,
                distance: Math.abs(entry.boundingClientRect.top),
              });
          }
          void drain();
        },
        { rootMargin: NEAR },
      )
    : null;

// A figure a shared link filters or brushes, and the one a #hash names, do not wait for a scroll.
const params = new URLSearchParams(location.search);
const named =
  location.hash.length > 1
    ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
    : null;
for (const figure of waiting) {
  const wanted =
    (figure.id && (params.has(figure.id) || params.has(`${figure.id}-range`))) ||
    named?.contains(figure);
  if (wanted) {
    waiting.delete(figure);
    start(figure);
  } else if (observer) observer.observe(figure);
}

// A browser without IntersectionObserver gets every chart, one to a task.
if (!observer) for (const figure of waiting) queue.push({ figure, distance: 0 });
void drain();

enhanceHeader();
enhanceTheme();

for (const type of ["enarratio:select", "enarratio:brush"]) {
  document.addEventListener(type, (event) => {
    const log = event.target.closest("section")?.querySelector(".events");
    if (log) log.textContent = `${type} ${JSON.stringify(event.detail)}`;
  });
}
