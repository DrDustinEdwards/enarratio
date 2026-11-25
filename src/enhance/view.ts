/** What a chart wires to its drawing and legend: the plot-wide pointer, legend spotlight and buttons, and the entrance. */

import { button } from "./controls.js";
import { svgPoint } from "./marks.js";
import { reducedMotion } from "./motion.js";
import { crosshair, Picker } from "./pointer.js";
import type { Chart } from "./chart.js";

/** How long the entrance attribute stays on: longer than the slowest default animation (800ms). */
const ENTRANCE_MS = 1000;
/** How much of a chart must be on screen before it animates in. */
const ENTRANCE_VISIBLE = 0.25;

/**
 * The whole drawing answers a pointer: moving over it picks the nearest column of a bar, line or
 * area chart, or the nearest mark within reach on others. A finger dragging across scrubs the
 * same way (the drawing pans only vertically), and a tap shows what is under it.
 */
export function attachPointer(c: Chart, svg: SVGSVGElement): void {
  const picker = new Picker(c.figure, c.marks);
  c.picker = picker;
  const kind = c.figure.getAttribute("data-enarratio");
  if (picker.byColumn && (kind === "line" || kind === "area")) {
    c.cross = crosshair(svg, picker, c.marks);
    c.cleanup.push(() => svg.querySelector(".enarratio-crosshair")?.remove());
  }
  const at = (event: PointerEvent): void => {
    c.pointerX = event.clientX;
    const p = svgPoint(svg, event);
    const scale = svg.getScreenCTM()?.a ?? 1;
    c.show(picker.pick(p.x, p.y, scale));
  };
  c.listen(svg, "pointermove", (e) => {
    const event = e as PointerEvent;
    // A touch moves the view only once pressed; a mouse hovers, and a mouse dragging picks a
    // range, which the card would cover.
    if (event.pointerType !== "mouse" && event.buttons === 0) return;
    if (event.pointerType === "mouse" && event.buttons !== 0) {
      c.show(null);
      return;
    }
    at(event);
  });
  c.listen(svg, "pointerdown", (e) => {
    const event = e as PointerEvent;
    c.pointerType = event.pointerType;
    if (event.pointerType !== "mouse") at(event);
  });
  c.listen(svg, "pointerleave", (e) => {
    if ((e as PointerEvent).pointerType === "mouse") c.show(null);
  });
  c.listen(document, "pointerdown", (e) => {
    if (!c.figure.contains(e.target as Node)) c.show(null);
  });
}

/** Legend entries spotlight their series while pointed at or focused: everything else fades. A click still filters, where the chart filters. */
export function attachSpotlight(c: Chart): void {
  for (const item of c.figure.querySelectorAll<HTMLElement>(".enarratio-legend li[data-slot]")) {
    const slot = item.getAttribute("data-slot") ?? "";
    const on = (): void => {
      if (!c.selected) c.figure.setAttribute("data-enarratio-spotlight", slot);
    };
    const off = (): void => c.figure.removeAttribute("data-enarratio-spotlight");
    c.listen(item, "pointerenter", on);
    c.listen(item, "pointerleave", off);
    c.listen(item, "focusin", on);
    c.listen(item, "focusout", off);
    c.cleanup.push(off);
  }
}

export function attachLegend(c: Chart): void {
  const field = c.figure.getAttribute("data-enarratio-series-field");
  if (!field) return;
  for (const item of c.figure.querySelectorAll<HTMLElement>(".enarratio-legend li")) {
    const value = item.getAttribute("data-enarratio-series") ?? "";
    const toggle = button("", () => c.toggle(field, value));
    toggle.setAttribute("aria-pressed", "false");
    toggle.append(...item.childNodes);
    item.append(toggle);
    c.cleanup.push(() => item.replaceChildren(...toggle.childNodes));
  }
}

export function attachEntrance(c: Chart): void {
  if (reducedMotion() || typeof IntersectionObserver !== "function") return;
  const svg = c.svg;
  if (!svg) return;
  // Measured before any is written, beside every other chart's, so the lines cost one layout.
  const paths = [...svg.querySelectorAll<SVGPathElement>('[data-enarratio-mark="line"] > path')];
  c.later(
    () => paths.map((path) => Math.ceil(path.getTotalLength())),
    (lengths) => {
      paths.forEach((path, i) => {
        path.style.setProperty("--enarratio-length", String(lengths[i]));
      });
    },
  );
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      c.figure.setAttribute("data-enarratio-entering", "");
      const done = setTimeout(() => {
        c.figure.removeAttribute("data-enarratio-entering");
        c.layout();
      }, ENTRANCE_MS);
      c.cleanup.push(() => clearTimeout(done));
    },
    { threshold: ENTRANCE_VISIBLE },
  );
  observer.observe(c.figure);
  c.cleanup.push(() => observer.disconnect());
}
