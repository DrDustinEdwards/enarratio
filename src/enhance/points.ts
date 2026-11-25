/** The native controls over a chart's marks, and moving between them with the keyboard. */

import { onResize } from "./batch.js";
import { button, fill } from "./controls.js";
import { label, parseScale, place } from "./marks.js";
import { brushBetween } from "./brush.js";
import type { Chart } from "./chart.js";

/** How many points Page Up and Page Down jump. */
const PAGE = 10;
/** Numbers each hint, so its points can point at it with aria-describedby. */
let hints = 0;

/** The series a mark belongs to: its series, or its row on charts without series (a heatmap). */
const seriesOf = (mark: Element): string =>
  mark.getAttribute("data-enarratio-series") ?? `\u0000${place(mark).row}`;

/**
 * Lays a native control over each mark: a button when it filters, else a named image. They take
 * no pointer events, so pointers keep using the marks; keyboards and screen readers use the
 * controls. They sit in an application, so screen readers switch to focus mode only once a point
 * has focus; in browse mode the chart reads as its image, hint and table.
 */
export function attachPoints(c: Chart, svg: SVGSVGElement, frame: HTMLElement | null): void {
  const s = c.strings;

  const lists = new Map<string, number[]>();
  c.marks.forEach((mark, i) => {
    const key = seriesOf(mark);
    lists.set(key, [...(lists.get(key) ?? []), i]);
  });
  c.series = c.marks.map((mark) => lists.get(seriesOf(mark)) ?? []);
  c.seriesOrder = [...lists.values()].sort((a, b) => rowOf(c, a[0] ?? 0) - rowOf(c, b[0] ?? 0));

  const layer = document.createElement("div");
  layer.className = "enarratio-points";
  layer.setAttribute("role", "application");
  layer.setAttribute(
    "aria-label",
    c.figure.querySelector(".enarratio-title")?.textContent || s.chart,
  );
  const hint = document.createElement("p");
  hint.id = `enarratio-hint-${++hints}`;
  hint.className = "enarratio-hint";
  hint.textContent = [
    s.hint,
    c.options.filter ? s.hintFilter : "",
    c.options.brush && parseScale(c.figure) ? s.hintRange : "",
  ]
    .filter(Boolean)
    .join(" ");
  layer.setAttribute("aria-describedby", hint.id);
  (frame ?? svg).after(hint);

  c.marks.forEach((mark, i) => {
    const text = label(mark);
    c.texts.set(mark, text);
    const title = mark.querySelector("title");
    if (title?.parentElement) {
      c.titles.push([title, title.parentElement]);
      title.remove();
    }
    // A linked bar that filters stays a filter button (the page can follow data-enarratio-href
    // on enarratio:select); one that does not is its link, outside the SVG.
    const href = mark.getAttribute("data-enarratio-href");
    const filterable = c.filters(mark);
    let point: HTMLElement;
    if (filterable) {
      point = button("", () => c.toggleMark(mark));
      point.setAttribute("aria-pressed", "false");
    } else if (href !== null) {
      point = document.createElement("a");
      point.setAttribute("href", href);
    } else {
      point = document.createElement("span");
      point.setAttribute("role", "img");
    }
    const list = c.series[i] ?? [];
    point.setAttribute(
      "aria-label",
      `${text}, ${fill(s.position, { index: list.indexOf(i) + 1, count: list.length })}`,
    );
    point.tabIndex = i === 0 ? 0 : -1;
    c.listen(point, "focus", () => {
      moveFocus(c, i, false);
      c.hover(mark);
    });
    c.listen(point, "blur", () => c.hover(null));
    layer.append(point);
  });
  c.points = [...layer.children] as HTMLElement[];
  (frame ?? c.figure).append(layer);
  c.listen(layer, "keydown", (e) => onKey(c, e as KeyboardEvent));

  // A focused point scrolls the frame into view itself, so the frame's own tab stop would
  // be a second, empty stop before the data.
  if (frame?.getAttribute("tabindex") === "0") {
    frame.removeAttribute("tabindex");
    c.untabbedFrame = frame;
  }

  // Every box is read before any style is written, and beside every other chart's (batch.ts),
  // so the page is laid out once, not once per mark or per chart.
  const read = () => {
    const parent = layer.parentElement;
    if (!parent) return null;
    return {
      x: parent.clientLeft - parent.scrollLeft,
      y: parent.clientTop - parent.scrollTop,
      base: parent.getBoundingClientRect(),
      box: svg.getBoundingClientRect(),
      rects: c.marks.map((mark) => mark.getBoundingClientRect()),
    };
  };
  const write = (boxes: ReturnType<typeof read>): void => {
    if (!boxes) return;
    const { x, y, base, box, rects } = boxes;
    const place = (el: HTMLElement, r: DOMRect, x: number, y: number): void => {
      el.style.left = `${r.left - x}px`;
      el.style.top = `${r.top - y}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
    };
    place(layer, box, base.left + x, base.top + y);
    rects.forEach((rect, i) => {
      const point = c.points[i];
      if (point) place(point, rect, box.left, box.top);
    });
  };
  c.layout = () => {
    c.picker?.reset();
    c.later(read, write);
  };
  // Also when a chart enhanced while hidden is shown, and when the window resizes.
  if (typeof ResizeObserver === "function") {
    c.cleanup.push(onResize(svg, () => c.layout()));
  } else {
    c.layout();
  }
  c.cleanup.push(() => {
    layer.remove();
    hint.remove();
  });
}

function rowOf(c: Chart, index: number): number {
  const mark = c.marks[index];
  return mark ? place(mark).row : 0;
}

/** The keys. Modified keys and keys the chart does not use pass through, so screen reader and browser shortcuts keep working. */
function onKey(c: Chart, event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey || c.marks.length === 0) return;
  const here = c.focusIndex;
  const list = c.series[here] ?? [here];
  const at = list.indexOf(here);
  let next: number | null | undefined;
  // Each moving key's target, held inside the series: a step past either end stays put.
  const to: Record<string, number> = {
    ArrowRight: at + 1,
    ArrowLeft: at - 1,
    PageDown: at + PAGE,
    PageUp: at - PAGE,
    Home: 0,
    End: list.length - 1,
  };
  const target = to[event.key];
  if (target !== undefined) next = list[Math.min(Math.max(target, 0), list.length - 1)];
  if (target === undefined) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      next = across(c, event.key === "ArrowUp" ? 1 : -1);
    } else if (event.key === "Backspace") {
      next = c.lastIndex;
    } else {
      if (event.key === "Escape" && (c.selected || c.range || c.rangeStart !== null)) {
        // Clears the filter and range (the tooltip's own Escape listener dismisses it). When
        // there was nothing to clear, Escape goes on to close an expanded view.
        c.clearAll(true);
        event.preventDefault();
      }
      return;
    }
  }
  event.preventDefault();
  next ??= here;
  if (event.shiftKey && c.brushRect && event.key !== "Backspace") {
    c.anchorIndex ??= here;
  } else {
    c.anchorIndex = null;
  }
  moveFocus(c, next);
  if (c.anchorIndex !== null) brushBetween(c, c.anchorIndex, next);
}

function columnOf(c: Chart, index: number): number | null {
  const mark = c.marks[index];
  return mark ? place(mark).column : null;
}

/** Up and down: the mark above or below in the same category; where the category holds only this point, the nearest point of the next series. */
function across(c: Chart, step: 1 | -1): number {
  const here = c.focusIndex;
  const column = columnOf(c, here);
  if (columnOf(c, here + step) === column) return here + step;
  if (columnOf(c, here - step) === column) return here;
  const order = c.seriesOrder;
  const target = order[order.indexOf(c.series[here] ?? []) + step];
  if (!target || column === null) return here;
  const distance = (i: number): number => Math.abs((columnOf(c, i) ?? 0) - column);
  return target.reduce((best, i) => (distance(i) < distance(best) ? i : best));
}

export function moveFocus(c: Chart, index: number, focus = true): void {
  const to = c.points[index];
  if (!to) return;
  if (index !== c.focusIndex) {
    c.lastIndex = c.focusIndex;
    c.points[c.focusIndex]?.setAttribute("tabindex", "-1");
  }
  to.tabIndex = 0;
  c.focusIndex = index;
  if (focus) to.focus();
}

/** The mark to carry the tab stop after an update: the same key, else the first in its category, else the nearest in reading order. */
export function successor(c: Chart, key: string, x: string | null, index: number): number {
  const same = c.marks.findIndex((m) => m.getAttribute("data-enarratio-key") === key);
  if (same !== -1) return same;
  const column =
    x === null ? -1 : c.marks.findIndex((m) => m.getAttribute("data-enarratio-x") === x);
  if (column !== -1) return column;
  return Math.min(index, c.marks.length - 1);
}
