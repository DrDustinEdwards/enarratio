/** The range brush: drag, click twice, the keyboard or the Range form picks a span of the x axis. */

import { button, fill, popover } from "./controls.js";
import {
  center,
  invert,
  MARK,
  parseScale,
  project,
  SVG_NS,
  svgPoint,
  type XScale,
} from "./marks.js";
import type { BrushDetail } from "./types.js";
import type { Chart } from "./chart.js";

/** How far a pointer moves, in SVG units, before a press becomes a drag. */
const DRAG_THRESHOLD = 3;

/** `n` held between two ends, in either order. */
const within = (n: number, a: number, b: number): number =>
  Math.min(Math.max(n, Math.min(a, b)), Math.max(a, b));

const isTime = (scale: XScale | null): boolean => scale?.type === "utc" || scale?.type === "time";

/** The range as a form: from and to, in data units, for readers who cannot drag. */
export function rangeForm(c: Chart, scale: XScale): HTMLElement {
  const s = c.strings;
  const time = isTime(scale);
  const form = document.createElement("form");
  const [d0, d1] = scale.domain as [number, number];
  c.rangeInputs = [s.from, s.to].map((text) => {
    const field = document.createElement("label");
    const input = document.createElement("input");
    input.type = time ? "date" : "number";
    if (!time) input.step = "any";
    // Both ends are needed: the browser names a blank field and focuses it, where a silent
    // return left the reader with no sign the form did nothing (WCAG 2.2 SC 3.3.1).
    input.required = true;
    input.min = format(c, Math.min(d0, d1));
    input.max = format(c, Math.max(d0, d1));
    field.append(`${text} `, input);
    form.append(field);
    return input;
  });
  const apply = document.createElement("button");
  apply.textContent = s.apply;
  form.append(
    apply,
    button(s.clear, () => {
      if (c.range) emitBrush(c, null);
    }),
  );
  c.listen(form, "submit", (e) => {
    e.preventDefault();
    const [a, b] = c.rangeInputs.map((input) =>
      input.value === ""
        ? Number.NaN
        : within(time ? Date.parse(input.value) : Number(input.value), d0, d1),
    ) as [number, number];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    showRange(c, [a, b]);
    emitBrush(c, [Math.min(a, b), Math.max(a, b)]);
  });
  return popover("enarratio-range", "range", s.range, form, (t, type, h) => c.listen(t, type, h));
}

/** Draws a range given in data units; false when the chart has no brush to draw it on. */
export function showRange(c: Chart, range: readonly [number, number]): boolean {
  const scale = parseScale(c.figure);
  if (!scale || !c.brushRect) return false;
  drawBrush(c, project(scale, range[0]), project(scale, range[1]));
  return true;
}

function format(c: Chart, n: number): string {
  return isTime(parseScale(c.figure))
    ? new Date(n).toISOString().slice(0, 10)
    : String(Math.round(n * 1000) / 1000);
}

export function attachBrush(c: Chart, svg: SVGSVGElement): void {
  const scale = parseScale(c.figure);
  if (!scale) return;
  const [r0, r1] = scale.range as [number, number];
  const view = svg.viewBox.baseVal;
  let start: number | null = null;
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("class", "enarratio-brush");
  rect.setAttribute("y", "0");
  rect.setAttribute("height", String(view.height || svg.height.baseVal.value));
  rect.setAttribute("aria-hidden", "true");
  rect.style.display = "none";
  svg.prepend(rect);
  c.brushRect = rect;
  c.cleanup.push(() => rect.remove());

  const clampX = (x: number): number => within(x, r0, r1);
  let dragging = false;
  let dragged = false;
  c.listen(svg, "pointerdown", (e) => {
    const event = e as PointerEvent;
    // A finger dragging scrubs instead (attachPointer); a range is the Range form's then.
    if (event.button !== 0 || event.pointerType === "touch") return;
    start = clampX(svgPoint(svg, event).x);
    dragging = false;
  });
  c.listen(svg, "pointermove", (e) => {
    const event = e as PointerEvent;
    if (start === null) return;
    const x = clampX(svgPoint(svg, event).x);
    if (!dragging) {
      if (Math.abs(x - start) < DRAG_THRESHOLD) return;
      // Capture only once this is a drag: capturing on pointerdown sent every click to the SVG
      // instead of the mark under the pointer.
      dragging = true;
      svg.setPointerCapture(event.pointerId);
    }
    drawBrush(c, start, x);
  });
  c.listen(svg, "pointerup", (e) => {
    if (start === null) return;
    const from = start;
    start = null;
    if (!dragging) return; // A click: the mark under the pointer, or the plot, handles it.
    dragging = false;
    dragged = true;
    const end = clampX(svgPoint(svg, e as PointerEvent).x);
    drawBrush(c, from, end);
    emitBrush(c, [invert(scale, Math.min(from, end)), invert(scale, Math.max(from, end))]);
  });
  // A range without dragging (WCAG 2.2 SC 2.5.7): click the plot once for one end and again
  // for the other. Clicks on marks filter instead.
  c.listen(svg, "click", (e) => {
    const event = e as MouseEvent;
    if (dragged) {
      dragged = false;
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest(`${MARK}, .enarratio-hit`)) return;
    // A tap reads the column under it (attachPointer) rather than starting a range.
    if (c.pointerType === "touch") return;
    const x = svgPoint(svg, event).x;
    if (within(x, r0, r1) !== x) return;
    if (c.rangeStart === null) {
      c.rangeStart = x;
      drawBrush(c, x, x + 1);
      c.announce(c.strings.rangeStart);
      return;
    }
    const from = c.rangeStart;
    c.rangeStart = null;
    drawBrush(c, from, x);
    emitBrush(c, [invert(scale, Math.min(from, x)), invert(scale, Math.max(from, x))]);
  });
}

function drawBrush(c: Chart, a: number, b: number): void {
  if (!c.brushRect) return;
  c.brushRect.style.display = "";
  c.brushRect.setAttribute("x", String(Math.min(a, b)));
  c.brushRect.setAttribute("width", String(Math.abs(b - a)));
}

/** Records a range (or none), shows it in the form and the address, and reports it. */
export function setRange(c: Chart, range: [number, number] | null): void {
  c.range = range;
  if (!range && c.brushRect) c.brushRect.style.display = "none";
  c.rangeInputs.forEach((input, i) => {
    input.value = range ? format(c, range[i] ?? 0) : "";
  });
  c.syncUrl();
}

export function emitBrush(c: Chart, range: [number, number] | null): void {
  setRange(c, range);
  const s = c.strings;
  c.announce(
    range
      ? fill(s.rangeSelected, { from: format(c, range[0]), to: format(c, range[1]) })
      : s.rangeCleared,
  );
  c.figure.dispatchEvent(
    new CustomEvent<BrushDetail>("enarratio:brush", {
      bubbles: true,
      detail: { chartId: c.chartId, range, time: isTime(parseScale(c.figure)) },
    }),
  );
}

export function brushBetween(c: Chart, a: number, b: number): void {
  const scale = parseScale(c.figure);
  const ma = c.marks[a];
  const mb = c.marks[b];
  if (!scale || !ma || !mb) return;
  const xa = center(ma).x;
  const xb = center(mb).x;
  drawBrush(c, xa, xb);
  emitBrush(c, [invert(scale, Math.min(xa, xb)), invert(scale, Math.max(xa, xb))]);
}
