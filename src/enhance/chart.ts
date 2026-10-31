/** One enhanced chart: tooltips, keyboard navigation, filters, the range brush and updates. */

import { button, expander, fill, sortTable, viewSwitch } from "./controls.js";
import {
  center,
  invert,
  label,
  MARK,
  parseScale,
  place,
  project,
  readingOrder,
  SVG_NS,
  svgPoint,
  type XScale,
} from "./marks.js";
import { animateFrom, DURATION, geometry, reducedMotion } from "./motion.js";
import { sanitize } from "./sanitize.js";
import { hitArea } from "./targets.js";
import type { BrushDetail, EnhancedChart, ResolvedOptions, SelectDetail } from "./types.js";

/** How far a pointer moves, in SVG units, before a press becomes a drag (the brush). */
const DRAG_THRESHOLD = 3;
/** How long the entrance attribute stays on: longer than the slowest default animation (800ms). */
const ENTRANCE_MS = 1000;
/** How much of a chart must be on screen before it animates in. */
const ENTRANCE_VISIBLE = 0.25;
/** How long the tooltip waits for the pointer to reach it before hiding (WCAG 1.4.13, F6). */
const HIDE_DELAY_MS = 300;
/** The tooltip's gap from its mark and from the viewport edge, in CSS pixels. */
const TIP_GAP = 8;
/** How many points Page Up and Page Down jump (B38). */
const PAGE = 10;

/** Numbers each hint, so its points can point at it with aria-describedby. */
let hints = 0;

const isTime = (scale: XScale | null): boolean => scale?.type === "utc" || scale?.type === "time";

/** The series a mark belongs to: its series, or its row on charts without series (a heatmap). */
const seriesOf = (mark: Element): string =>
  mark.getAttribute("data-enarratio-series") ?? `\u0000${place(mark).row}`;

export class Chart implements EnhancedChart {
  readonly figure: HTMLElement;
  readonly options: ResolvedOptions;
  private readonly cleanup: (() => void)[] = [];
  private tooltip: HTMLElement | null = null;
  private live: HTMLElement | null = null;
  private marks: SVGGraphicsElement[] = [];
  /** One native control per mark, in the same order: what keyboards and screen readers use. */
  private points: HTMLElement[] = [];
  /** Each mark's label, read before its title was taken off. */
  private texts = new Map<Element, string>();
  /** Titles taken off the marks, and where they were, for destroy() to put back. */
  private titles: [Element, Element][] = [];
  /** For each mark, the indexes of the marks in its series, in reading order. */
  private series: number[][] = [];
  /** The series' index lists, in row order, for moving between series. */
  private seriesOrder: number[][] = [];
  private focusIndex = 0;
  /** The point focused before the last move, which Backspace returns to (B32). */
  private lastIndex: number | null = null;
  private anchorIndex: number | null = null;
  private selected: { field: string; value: string } | null = null;
  private range: [number, number] | null = null;
  private brushRect: SVGRectElement | null = null;
  private rangeInputs: HTMLInputElement[] = [];
  private hint: HTMLElement | null = null;
  private viewButton: HTMLButtonElement | null = null;
  private expandButton: HTMLButtonElement | null = null;
  /** Places the points over the marks again, after the drawing moved or resized. */
  private layout: () => void = () => {};
  /** The SVG's role as the server rendered it, restored by destroy(). */
  private serverRole: string | null = null;
  /** A wide frame whose tab stop attach() removed, given back by destroy(). */
  private untabbedFrame: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  /** The first end of a range picked by clicking twice (A4). */
  private rangeStart: number | null = null;

  constructor(figure: HTMLElement, options: ResolvedOptions) {
    this.figure = figure;
    this.options = options;
    this.attach();
    // After enhance() returns, so listeners the page adds next hear a view read from the address.
    if (options.url) queueMicrotask(() => this.restoreUrl());
  }

  /** The drawing, not an SVG inside the table (a table chart's sparklines and cell bars). */
  private get svg(): SVGSVGElement | null {
    return this.figure.querySelector(":scope > .enarratio-frame > svg");
  }

  private get chartId(): string | null {
    return this.figure.id || null;
  }

  private get strings(): ResolvedOptions["strings"] {
    return this.options.strings;
  }

  private listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private attach(): void {
    const svg = this.svg;
    this.figure.setAttribute("data-enarratio-enhanced", "");
    if (this.options.filter) this.figure.setAttribute("data-enarratio-interactive", "");

    if (!this.live) {
      this.live = document.createElement("p");
      this.live.className = "enarratio-visually-hidden";
      this.live.setAttribute("aria-live", "polite");
    }
    if (!this.live.isConnected) this.figure.append(this.live);
    // A figure that is only a table (tableChart) gets its sortable headers and nothing else.
    if (!svg) {
      if (this.options.table)
        this.cleanup.push(sortTable(this.figure, this.strings, (m) => this.announce(m)));
      return;
    }

    this.marks = readingOrder([...svg.querySelectorAll<SVGGraphicsElement>(MARK)]);
    const frame = this.figure.querySelector<HTMLElement>(":scope > .enarratio-frame");
    if (this.marks.length > 0) this.attachPoints(svg, frame);

    if (this.options.tooltips) {
      const tip = document.createElement("div");
      tip.className = "enarratio-tooltip";
      tip.hidden = true;
      tip.setAttribute("aria-hidden", "true");
      document.body.append(tip);
      this.tooltip = tip;
      // The pointer can move onto the tooltip without it vanishing, and Escape dismisses it
      // wherever focus is (WCAG 1.4.13, F6, C7).
      this.listen(tip, "pointerenter", () => clearTimeout(this.hideTimer));
      this.listen(tip, "pointerleave", () => this.hideTip());
      this.listen(document, "keydown", (e) => {
        if ((e as KeyboardEvent).key === "Escape") this.hideTip();
      });
    }

    for (const mark of this.marks) {
      const targets: Element[] = [mark];
      const hit = hitArea(mark);
      if (hit) {
        targets.push(hit);
        this.cleanup.push(() => hit.remove());
      }
      for (const target of targets) {
        this.listen(target, "pointerenter", () => this.hover(mark));
        this.listen(target, "pointerleave", () => this.hover(null));
        if (this.options.filter) this.listen(target, "click", () => this.toggleMark(mark));
      }
    }

    if (this.options.filter) this.attachLegend();
    if (this.options.brush && parseScale(this.figure)) this.attachBrush(svg);
    this.attachControls(frame ?? svg);
    if (this.options.entrance) this.attachEntrance();
  }

  /**
   * Lays a native control over each mark (B26): a button when it filters, else a named image.
   * They take no pointer events, so pointers keep using the marks and their targets; keyboards and
   * screen readers use the controls. Their focus ring is the control's own outline, drawn above
   * every mark (B13). They sit in an application, so screen readers switch to focus mode only once
   * a point has focus and pass the arrow keys on; in browse mode the chart reads as its image,
   * hint and table (B11).
   */
  private attachPoints(svg: SVGSVGElement, frame: HTMLElement | null): void {
    const s = this.strings;
    this.serverRole ??= svg.getAttribute("role");
    // The links (if any) become the points, so the drawing is one image again.
    svg.setAttribute("role", "img");

    const lists = new Map<string, number[]>();
    this.marks.forEach((mark, i) => {
      const key = seriesOf(mark);
      lists.set(key, [...(lists.get(key) ?? []), i]);
    });
    this.series = this.marks.map((mark) => lists.get(seriesOf(mark)) ?? []);
    this.seriesOrder = [...lists.values()].sort(
      (a, b) => this.rowOf(a[0] ?? 0) - this.rowOf(b[0] ?? 0),
    );

    const layer = document.createElement("div");
    layer.className = "enarratio-points";
    layer.setAttribute("role", "application");
    layer.setAttribute(
      "aria-label",
      this.figure.querySelector(".enarratio-title")?.textContent || s.chart,
    );
    const hint = document.createElement("p");
    hint.id = `enarratio-hint-${++hints}`;
    hint.className = "enarratio-hint";
    hint.textContent = [
      s.hint,
      this.options.filter ? s.hintFilter : "",
      this.options.brush && parseScale(this.figure) ? s.hintRange : "",
    ]
      .filter(Boolean)
      .join(" ");
    layer.setAttribute("aria-describedby", hint.id);
    (frame ?? svg).after(hint);
    this.hint = hint;

    this.marks.forEach((mark, i) => {
      const text = label(mark);
      this.texts.set(mark, text);
      const title = mark.querySelector("title");
      if (title?.parentElement) {
        this.titles.push([title, title.parentElement]);
        title.remove();
      }
      // A bar that is a link without script becomes a filter button with it; the page can read the
      // link from data-enarratio-href and follow it on enarratio:select if it wants to.
      const href = mark.getAttribute("href");
      if (href !== null) {
        mark.setAttribute("data-enarratio-href", href);
        mark.removeAttribute("href");
      }
      const filterable = this.options.filter && mark.hasAttribute("data-enarratio-field");
      const point = filterable
        ? button("", () => this.toggleMark(mark))
        : document.createElement("span");
      if (filterable) point.setAttribute("aria-pressed", "false");
      else point.setAttribute("role", "img");
      const list = this.series[i] ?? [];
      point.setAttribute(
        "aria-label",
        `${text}, ${fill(s.position, { index: list.indexOf(i) + 1, count: list.length })}`,
      );
      point.tabIndex = i === 0 ? 0 : -1;
      this.listen(point, "focus", () => {
        this.moveFocus(i, false);
        this.hover(mark);
      });
      this.listen(point, "blur", () => this.hover(null));
      layer.append(point);
    });
    this.points = [...layer.children] as HTMLElement[];
    (frame ?? this.figure).append(layer);
    this.listen(layer, "keydown", (e) => this.onKey(e as KeyboardEvent));

    // A focused point scrolls the frame into view itself, so the frame's own tab stop (A13) would
    // be a second, empty stop before the data (B14).
    if (frame?.getAttribute("tabindex") === "0") {
      frame.removeAttribute("tabindex");
      this.untabbedFrame = frame;
    }

    this.layout = () => {
      const parent = layer.parentElement;
      if (!parent) return;
      const base = parent.getBoundingClientRect();
      const box = svg.getBoundingClientRect();
      const place = (el: HTMLElement, r: DOMRect, x: number, y: number): void => {
        el.style.left = `${r.left - x}px`;
        el.style.top = `${r.top - y}px`;
        el.style.width = `${r.width}px`;
        el.style.height = `${r.height}px`;
      };
      place(
        layer,
        box,
        base.left + parent.clientLeft - parent.scrollLeft,
        base.top + parent.clientTop - parent.scrollTop,
      );
      this.marks.forEach((mark, i) => {
        const point = this.points[i];
        if (point) place(point, mark.getBoundingClientRect(), box.left, box.top);
      });
    };
    // Also when a chart enhanced while hidden is shown, and when the window resizes.
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => this.layout());
      observer.observe(svg);
      this.cleanup.push(() => observer.disconnect());
    } else {
      this.layout();
    }
    this.cleanup.push(() => {
      layer.remove();
      hint.remove();
    });
  }

  private rowOf(index: number): number {
    const mark = this.marks[index];
    return mark ? place(mark).row : 0;
  }

  /** The chart and table switch, the expand button and the range form, after the drawing. */
  private attachControls(after: Element): void {
    const s = this.strings;
    const bar = document.createElement("div");
    bar.className = "enarratio-controls";
    if (this.options.table) {
      this.cleanup.push(sortTable(this.figure, s, (m) => this.announce(m)));
      this.viewButton = viewSwitch(this.figure, s);
      if (this.viewButton) bar.append(this.viewButton);
    }
    if (this.options.expand) {
      this.expandButton = expander(this.figure, s, (t, type, h) => this.listen(t, type, h));
      bar.append(this.expandButton);
    }
    const scale = parseScale(this.figure);
    if (this.brushRect && scale) bar.append(this.rangeForm(scale));
    if (bar.childElementCount === 0) return;
    (this.hint ?? after).after(bar);
    this.cleanup.push(() => bar.remove());
  }

  /** The range as a form (B15): from and to, in data units, for readers who cannot drag. */
  private rangeForm(scale: XScale): HTMLElement {
    const s = this.strings;
    const time = isTime(scale);
    const details = document.createElement("details");
    details.className = "enarratio-range";
    const summary = document.createElement("summary");
    summary.textContent = s.range;
    const form = document.createElement("form");
    const [d0, d1] = scale.domain as [number, number];
    this.rangeInputs = [s.from, s.to].map((text) => {
      const field = document.createElement("label");
      const input = document.createElement("input");
      input.type = time ? "date" : "number";
      if (!time) input.step = "any";
      input.min = this.format(Math.min(d0, d1));
      input.max = this.format(Math.max(d0, d1));
      field.append(`${text} `, input);
      form.append(field);
      return input;
    });
    const apply = document.createElement("button");
    apply.textContent = s.apply;
    form.append(
      apply,
      button(s.clear, () => {
        if (this.range) this.emitBrush(null);
      }),
    );
    this.listen(form, "submit", (e) => {
      e.preventDefault();
      const clamp = (n: number): number =>
        Math.min(Math.max(n, Math.min(d0, d1)), Math.max(d0, d1));
      const [a, b] = this.rangeInputs.map((input) =>
        input.value === ""
          ? Number.NaN
          : clamp(time ? Date.parse(input.value) : Number(input.value)),
      ) as [number, number];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      this.drawBrush(project(scale, a), project(scale, b));
      this.emitBrush([Math.min(a, b), Math.max(a, b)]);
    });
    details.append(summary, form);
    return details;
  }

  private format(n: number): string {
    return isTime(parseScale(this.figure))
      ? new Date(n).toISOString().slice(0, 10)
      : String(Math.round(n * 1000) / 1000);
  }

  private attachLegend(): void {
    const field = this.figure.getAttribute("data-enarratio-series-field");
    if (!field) return;
    for (const item of this.figure.querySelectorAll<HTMLElement>(".enarratio-legend li")) {
      const value = item.getAttribute("data-enarratio-series") ?? "";
      const toggle = button("", () => this.toggle(field, value));
      toggle.setAttribute("aria-pressed", "false");
      toggle.append(...item.childNodes);
      item.append(toggle);
      this.cleanup.push(() => item.replaceChildren(...toggle.childNodes));
    }
  }

  private attachBrush(svg: SVGSVGElement): void {
    const scale = parseScale(this.figure);
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
    this.brushRect = rect;
    this.cleanup.push(() => rect.remove());

    const clampX = (x: number): number => Math.min(Math.max(x, Math.min(r0, r1)), Math.max(r0, r1));
    let dragging = false;
    let dragged = false;
    this.listen(svg, "pointerdown", (e) => {
      const event = e as PointerEvent;
      if (event.button !== 0) return;
      start = clampX(svgPoint(svg, event).x);
      dragging = false;
    });
    this.listen(svg, "pointermove", (e) => {
      const event = e as PointerEvent;
      if (start === null) return;
      const x = clampX(svgPoint(svg, event).x);
      if (!dragging) {
        if (Math.abs(x - start) < DRAG_THRESHOLD) return;
        // Capture only once this is a drag: capturing on pointerdown sent every click to the
        // SVG instead of the mark under the pointer, so marks on these charts could not be
        // clicked (F1).
        dragging = true;
        svg.setPointerCapture(event.pointerId);
      }
      this.drawBrush(start, x);
    });
    this.listen(svg, "pointerup", (e) => {
      if (start === null) return;
      const from = start;
      start = null;
      if (!dragging) return; // A click: the mark under the pointer, or the plot, handles it.
      dragging = false;
      dragged = true;
      const end = clampX(svgPoint(svg, e as PointerEvent).x);
      this.drawBrush(from, end);
      this.emitBrush([invert(scale, Math.min(from, end)), invert(scale, Math.max(from, end))]);
    });
    // A range without dragging (WCAG 2.2 SC 2.5.7, A4): click the plot once for one end and again
    // for the other. Clicks on marks filter instead.
    this.listen(svg, "click", (e) => {
      const event = e as MouseEvent;
      if (dragged) {
        dragged = false;
        return;
      }
      const target = event.target as Element | null;
      if (target?.closest(`${MARK}, .enarratio-hit`)) return;
      const x = svgPoint(svg, event).x;
      if (x < Math.min(r0, r1) || x > Math.max(r0, r1)) return;
      if (this.rangeStart === null) {
        this.rangeStart = x;
        this.drawBrush(x, x + 1);
        this.announce(this.strings.rangeStart);
        return;
      }
      const from = this.rangeStart;
      this.rangeStart = null;
      this.drawBrush(from, x);
      this.emitBrush([invert(scale, Math.min(from, x)), invert(scale, Math.max(from, x))]);
    });
  }

  private drawBrush(a: number, b: number): void {
    if (!this.brushRect) return;
    this.brushRect.style.display = "";
    this.brushRect.setAttribute("x", String(Math.min(a, b)));
    this.brushRect.setAttribute("width", String(Math.abs(b - a)));
  }

  /** Records a range (or none), shows it in the form and the address, and reports it. */
  private setRange(range: [number, number] | null): void {
    this.range = range;
    if (!range && this.brushRect) this.brushRect.style.display = "none";
    this.rangeInputs.forEach((input, i) => {
      input.value = range ? this.format(range[i] ?? 0) : "";
    });
    this.syncUrl();
  }

  private emitBrush(range: [number, number] | null): void {
    this.setRange(range);
    const s = this.strings;
    this.announce(
      range
        ? fill(s.rangeSelected, { from: this.format(range[0]), to: this.format(range[1]) })
        : s.rangeCleared,
    );
    this.figure.dispatchEvent(
      new CustomEvent<BrushDetail>("enarratio:brush", {
        bubbles: true,
        detail: { chartId: this.chartId, range, time: isTime(parseScale(this.figure)) },
      }),
    );
  }

  private attachEntrance(): void {
    if (reducedMotion() || typeof IntersectionObserver !== "function") return;
    const svg = this.svg;
    if (!svg) return;
    for (const path of svg.querySelectorAll<SVGPathElement>(
      '[data-enarratio-mark="line"] > path',
    )) {
      path.style.setProperty("--enarratio-length", String(Math.ceil(path.getTotalLength())));
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        this.figure.setAttribute("data-enarratio-entering", "");
        const done = setTimeout(() => {
          this.figure.removeAttribute("data-enarratio-entering");
          this.layout();
        }, ENTRANCE_MS);
        this.cleanup.push(() => clearTimeout(done));
      },
      { threshold: ENTRANCE_VISIBLE },
    );
    observer.observe(this.figure);
    this.cleanup.push(() => observer.disconnect());
  }

  /**
   * A mark under the pointer or with focus: its tooltip, and the other series dimmed while no
   * filter is on (C9). Null when it leaves.
   */
  private hover(mark: SVGGraphicsElement | null): void {
    const series = mark?.getAttribute("data-enarratio-series") ?? null;
    for (const m of this.marks) {
      m.toggleAttribute(
        "data-enarratio-faded",
        series !== null && !this.selected && m.getAttribute("data-enarratio-series") !== series,
      );
    }
    if (mark) this.showTip(mark);
    else this.scheduleHide();
  }

  private showTip(mark: SVGGraphicsElement): void {
    const tip = this.tooltip;
    if (!tip) return;
    clearTimeout(this.hideTimer);
    tip.textContent = this.texts.get(mark) ?? label(mark);
    tip.hidden = false;
    const box = mark.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(TIP_GAP, box.left + box.width / 2 - tipBox.width / 2),
      document.documentElement.clientWidth - tipBox.width - TIP_GAP,
    );
    const above = box.top - tipBox.height - TIP_GAP;
    tip.style.left = `${left + scrollX}px`;
    tip.style.top = `${(above > 0 ? above : box.bottom + TIP_GAP) + scrollY}px`;
  }

  private hideTip(): void {
    clearTimeout(this.hideTimer);
    if (this.tooltip) this.tooltip.hidden = true;
  }

  /** Hides the tooltip shortly, unless the pointer reaches it first. */
  private scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hideTip(), HIDE_DELAY_MS);
  }

  /**
   * The keys (B34, B38, B32, B33). Modified keys pass through untouched, as do keys the chart
   * does not use, so screen reader and browser shortcuts keep working (B11). Enter and Space are
   * the buttons' own.
   */
  private onKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || this.marks.length === 0) return;
    const here = this.focusIndex;
    const list = this.series[here] ?? [here];
    const at = list.indexOf(here);
    let next: number | null | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft":
        next = list[at + (event.key === "ArrowRight" ? 1 : -1)];
        break;
      case "PageDown":
      case "PageUp":
        next =
          list[
            Math.min(Math.max(at + (event.key === "PageDown" ? PAGE : -PAGE), 0), list.length - 1)
          ];
        break;
      case "Home":
        next = list[0];
        break;
      case "End":
        next = list[list.length - 1];
        break;
      case "ArrowUp":
      case "ArrowDown":
        next = this.across(event.key === "ArrowUp" ? 1 : -1);
        break;
      case "Backspace":
        next = this.lastIndex;
        break;
      case "Escape":
        // Dismisses the tooltip (WCAG 1.4.13, F6) and clears the filter and range. When there
        // was nothing to clear, Escape goes on to close an expanded view.
        this.hideTip();
        if (this.selected || this.range || this.rangeStart !== null) {
          this.clearAll(true);
          event.preventDefault();
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    next ??= here;
    if (event.shiftKey && this.brushRect && event.key !== "Backspace") {
      this.anchorIndex ??= here;
    } else {
      this.anchorIndex = null;
    }
    this.moveFocus(next);
    if (this.anchorIndex !== null) this.brushBetween(this.anchorIndex, next);
  }

  private columnOf(index: number): number | null {
    const mark = this.marks[index];
    return mark ? place(mark).column : null;
  }

  /**
   * Up and down: the mark above or below in the same category (a stack or group). Where the
   * category holds only this point, as in a scatter plot, the nearest point of the next series.
   */
  private across(step: 1 | -1): number {
    const here = this.focusIndex;
    const column = this.columnOf(here);
    if (this.columnOf(here + step) === column) return here + step;
    if (this.columnOf(here - step) === column) return here;
    const order = this.seriesOrder;
    const target = order[order.indexOf(this.series[here] ?? []) + step];
    if (!target || column === null) return here;
    const distance = (i: number): number => Math.abs((this.columnOf(i) ?? 0) - column);
    return target.reduce((best, i) => (distance(i) < distance(best) ? i : best));
  }

  private moveFocus(index: number, focus = true): void {
    const to = this.points[index];
    if (!to) return;
    if (index !== this.focusIndex) {
      this.lastIndex = this.focusIndex;
      this.points[this.focusIndex]?.setAttribute("tabindex", "-1");
    }
    to.tabIndex = 0;
    this.focusIndex = index;
    if (focus) to.focus();
  }

  /**
   * The mark to carry the tab stop after an update: the same key if it still exists, else the
   * first mark in the same category, else the mark at the nearest position in reading order.
   */
  private successor(key: string, x: string | null, index: number): number {
    const same = this.marks.findIndex((m) => m.getAttribute("data-enarratio-key") === key);
    if (same !== -1) return same;
    const column =
      x === null ? -1 : this.marks.findIndex((m) => m.getAttribute("data-enarratio-x") === x);
    if (column !== -1) return column;
    return Math.min(index, this.marks.length - 1);
  }

  private brushBetween(a: number, b: number): void {
    const scale = parseScale(this.figure);
    const ma = this.marks[a];
    const mb = this.marks[b];
    if (!scale || !ma || !mb) return;
    const xa = center(ma).x;
    const xb = center(mb).x;
    this.drawBrush(xa, xb);
    this.emitBrush([invert(scale, Math.min(xa, xb)), invert(scale, Math.max(xa, xb))]);
  }

  private toggleMark(mark: Element): void {
    const field = mark.getAttribute("data-enarratio-field");
    const value = mark.getAttribute("data-enarratio-value");
    if (field === null || value === null) return;
    this.toggle(field, value, mark.getAttribute("data-enarratio-x") ?? undefined);
  }

  private toggle(field: string, value: string, x?: string): void {
    const same = this.selected?.field === field && this.selected.value === value;
    this.select(same ? null : { field, value }, true, x);
  }

  private select(next: { field: string; value: string } | null, notify: boolean, x?: string): void {
    const previous = this.selected;
    this.selected = next;
    const seriesField = this.figure.getAttribute("data-enarratio-series-field");
    // A filter on the series field matches by series even where a click filters by x, so a
    // legend entry or setFilter can emphasize one series on a chart that selects years.
    const bySeries = next !== null && next.field === seriesField;
    this.marks.forEach((mark, i) => {
      const match =
        next !== null &&
        (bySeries
          ? mark.getAttribute("data-enarratio-series") === next.value
          : mark.getAttribute("data-enarratio-field") === next.field &&
            mark.getAttribute("data-enarratio-value") === next.value);
      mark.toggleAttribute("data-enarratio-dimmed", next !== null && !match);
      mark.removeAttribute("data-enarratio-faded");
      const point = this.points[i];
      if (point?.hasAttribute("aria-pressed")) point.setAttribute("aria-pressed", String(match));
    });
    for (const toggle of this.figure.querySelectorAll<HTMLButtonElement>(
      ".enarratio-legend button",
    )) {
      const value = toggle.parentElement?.getAttribute("data-enarratio-series");
      toggle.setAttribute("aria-pressed", String(bySeries && value === next?.value));
    }
    this.syncUrl();
    const field = next?.field ?? previous?.field;
    if (field === undefined || !notify) return;
    this.announce(
      next ? fill(this.strings.filtered, { value: next.value }) : this.strings.filterCleared,
    );
    this.figure.dispatchEvent(
      new CustomEvent<SelectDetail>("enarratio:select", {
        bubbles: true,
        detail: {
          chartId: this.chartId,
          field,
          value: next?.value ?? null,
          ...(x === undefined ? {} : { x }),
        },
      }),
    );
  }

  private announce(message: string): void {
    // The same message twice is still news: a changed space makes the region speak again.
    if (this.live)
      this.live.textContent = this.live.textContent === message ? `${message} ` : message;
  }

  /** Writes the filter and range into the address (B36), when the page asked for it. */
  private syncUrl(): void {
    const id = this.chartId;
    if (!this.options.url || !id) return;
    const url = new URL(location.href);
    const set = (name: string, value: string | null): void => {
      if (value === null) url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    };
    set(id, this.selected ? `${this.selected.field}:${this.selected.value}` : null);
    set(`${id}-range`, this.range ? this.range.join("..") : null);
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  }

  /** Shows the filter and range a shared link carries, as if a reader had picked them. */
  private restoreUrl(): void {
    const id = this.chartId;
    if (!id) return;
    const params = new URLSearchParams(location.search);
    const filter = params.get(id) ?? "";
    const colon = filter.indexOf(":");
    if (colon > 0)
      this.select({ field: filter.slice(0, colon), value: filter.slice(colon + 1) }, true);
    const range = (params.get(`${id}-range`) ?? "").split("..").map(Number);
    const scale = parseScale(this.figure);
    const [lo, hi] = range;
    if (scale && this.brushRect && range.length === 2 && lo !== undefined && hi !== undefined) {
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
      this.drawBrush(project(scale, lo), project(scale, hi));
      this.emitBrush([lo, hi]);
    }
  }

  setFilter(filter: { readonly field: string; readonly value: string } | null): void {
    this.select(filter ? { field: filter.field, value: filter.value } : null, false);
  }

  clear(): void {
    this.clearAll(false);
  }

  private clearAll(notify: boolean): void {
    this.rangeStart = null;
    if (this.selected) this.select(null, notify);
    if (this.brushRect && this.brushRect.style.display !== "none") {
      if (notify) this.emitBrush(null);
      else this.setRange(null);
    }
    this.anchorIndex = null;
  }

  update(markup: string): void {
    // DOMParser builds an inert document: nothing in it loads or runs while it is checked.
    const parsed = new DOMParser().parseFromString(markup.trim(), "text/html");
    const candidate = parsed.body.firstElementChild;
    if (!candidate?.matches("figure.enarratio")) {
      throw new Error("update() needs the markup of one Enarratio figure");
    }
    sanitize(candidate);
    const incoming = document.importNode(candidate, true);
    const before = geometry(this.figure);
    const { selected, range } = this;
    const table = this.figure.hasAttribute("data-enarratio-view-table");
    const expanded = this.figure.hasAttribute("data-enarratio-expanded");
    // The tab stop (and focus, if a reader is in the chart) moves to the same mark after the swap.
    const stop = this.marks[this.focusIndex];
    const stopKey = stop?.getAttribute("data-enarratio-key") ?? null;
    const stopX = stop?.getAttribute("data-enarratio-x") ?? null;
    const stopIndex = this.focusIndex;
    const hadFocus = document.activeElement === this.points[this.focusIndex];
    this.teardown();
    for (const name of this.figure.getAttributeNames()) this.figure.removeAttribute(name);
    for (const name of incoming.getAttributeNames()) {
      this.figure.setAttribute(name, incoming.getAttribute(name) ?? "");
    }
    // The live region stays in place, so what it says next is announced.
    for (const node of [...this.figure.childNodes]) if (node !== this.live) node.remove();
    this.figure.prepend(...incoming.childNodes);
    this.attach();
    // Restoring the page's own selection is not news to the page, so it fires nothing.
    if (selected) this.select(selected, false);
    const scale = parseScale(this.figure);
    if (range && scale && this.brushRect) {
      this.drawBrush(project(scale, range[0]), project(scale, range[1]));
      this.setRange(range);
    }
    if (table) this.viewButton?.click();
    if (expanded) this.expandButton?.click();
    if (stopKey !== null && this.marks.length > 0) {
      this.moveFocus(this.successor(stopKey, stopX, stopIndex), hadFocus);
    }
    if (!reducedMotion()) {
      animateFrom(this.figure, before);
      const settled = setTimeout(() => this.layout(), DURATION);
      this.cleanup.push(() => clearTimeout(settled));
    }
    this.announce(this.strings.updated);
  }

  private teardown(): void {
    if (this.figure.hasAttribute("data-enarratio-view-table")) this.viewButton?.click();
    for (const undo of this.cleanup.splice(0)) undo();
    clearTimeout(this.hideTimer);
    this.rangeStart = null;
    this.tooltip?.remove();
    this.tooltip = null;
    this.brushRect = null;
    this.rangeInputs = [];
    this.hint = null;
    this.viewButton = null;
    this.expandButton = null;
    this.layout = () => {};
    this.marks = [];
    this.points = [];
    this.texts = new Map();
    this.titles = [];
    this.focusIndex = 0;
    this.lastIndex = null;
    this.anchorIndex = null;
  }

  destroy(): void {
    const marks = this.marks;
    const titles = this.titles;
    this.teardown();
    this.live?.remove();
    this.live = null;
    if (this.serverRole !== null) this.svg?.setAttribute("role", this.serverRole);
    for (const mark of marks) {
      const href = mark.getAttribute("data-enarratio-href");
      if (href !== null) {
        mark.setAttribute("href", href);
        mark.removeAttribute("data-enarratio-href");
      }
      mark.removeAttribute("data-enarratio-dimmed");
      mark.removeAttribute("data-enarratio-faded");
    }
    for (const [title, parent] of titles) parent.append(title);
    this.untabbedFrame?.setAttribute("tabindex", "0");
    this.untabbedFrame = null;
    for (const name of [
      "data-enarratio-enhanced",
      "data-enarratio-interactive",
      "data-enarratio-entering",
      "data-enarratio-expanded",
    ]) {
      this.figure.removeAttribute(name);
    }
    enhanced.delete(this.figure);
  }
}

export const enhanced = new WeakMap<HTMLElement, Chart>();
