/** One enhanced chart: tooltips, keyboard navigation, filters, the range brush and updates. */

import {
  center,
  invert,
  label,
  MARK,
  parseScale,
  place,
  readingOrder,
  SVG_NS,
  shape,
  svgPoint,
} from "./marks.js";
import { animateFrom, geometry, reducedMotion } from "./motion.js";
import { sanitize } from "./sanitize.js";
import { focusRing, hitArea } from "./targets.js";
import type { BrushDetail, EnhancedChart, EnhanceOptions, SelectDetail } from "./types.js";

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

export class Chart implements EnhancedChart {
  readonly figure: HTMLElement;
  readonly options: Required<EnhanceOptions>;
  private readonly cleanup: (() => void)[] = [];
  private tooltip: HTMLElement | null = null;
  private live: HTMLElement | null = null;
  private marks: SVGGraphicsElement[] = [];
  private focusIndex = 0;
  private anchorIndex: number | null = null;
  private selected: { field: string; value: string } | null = null;
  private brushRect: SVGRectElement | null = null;
  /** The SVG's role as the server rendered it, restored by destroy(). */
  private serverRole: string | null = null;
  /** A wide frame whose tab stop attach() removed, given back by destroy(). */
  private untabbedFrame: HTMLElement | null = null;
  private ring: SVGGElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  /** The first end of a range picked by clicking twice (A4). */
  private rangeStart: number | null = null;

  constructor(figure: HTMLElement, options: Required<EnhanceOptions>) {
    this.figure = figure;
    this.options = options;
    this.attach();
  }

  private get svg(): SVGSVGElement | null {
    return this.figure.querySelector("svg");
  }

  private get chartId(): string | null {
    return this.figure.id || null;
  }

  private listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private attach(): void {
    const svg = this.svg;
    if (!svg) return;
    this.figure.setAttribute("data-enarratio-enhanced", "");
    if (this.options.filter) this.figure.setAttribute("data-enarratio-interactive", "");

    const live = document.createElement("p");
    live.className = "enarratio-visually-hidden";
    live.setAttribute("aria-live", "polite");
    this.figure.append(live);
    this.live = live;

    this.marks = readingOrder([...svg.querySelectorAll<SVGGraphicsElement>(MARK)]);
    // With interactive marks inside, the SVG is a group of named buttons, not one opaque image.
    this.serverRole ??= svg.getAttribute("role");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-roledescription", "chart");
    this.marks.forEach((mark, i) => {
      const text = label(mark);
      mark.querySelector("title")?.remove();
      // A bar that is a link without script becomes a filter button with it; the page can read the
      // link from data-enarratio-href and follow it on enarratio:select if it wants to.
      const href = mark.getAttribute("href");
      if (href !== null) {
        mark.setAttribute("data-enarratio-href", href);
        mark.removeAttribute("href");
      }
      mark.setAttribute("aria-label", text);
      const filterable = this.options.filter && mark.hasAttribute("data-enarratio-field");
      mark.setAttribute("role", filterable ? "button" : "img");
      if (filterable) mark.setAttribute("aria-pressed", "false");
      mark.setAttribute("tabindex", i === 0 ? "0" : "-1");
    });
    // A focused mark scrolls the frame into view itself, so the frame's own tab stop (A13) would
    // be a second, empty stop before the data.
    const frame = this.figure.querySelector<HTMLElement>(":scope > .enarratio-frame");
    if (this.marks.length > 0 && frame?.getAttribute("tabindex") === "0") {
      frame.removeAttribute("tabindex");
      this.untabbedFrame = frame;
    }

    if (this.options.tooltips) {
      const tip = document.createElement("div");
      tip.className = "enarratio-tooltip";
      tip.hidden = true;
      tip.setAttribute("aria-hidden", "true");
      document.body.append(tip);
      this.tooltip = tip;
      // The pointer can move onto the tooltip without it vanishing (WCAG 1.4.13, F6).
      this.listen(tip, "pointerenter", () => clearTimeout(this.hideTimer));
      this.listen(tip, "pointerleave", () => this.hideTip());
    }

    for (const mark of this.marks) {
      const targets: Element[] = [mark];
      const hit = hitArea(mark);
      if (hit) {
        targets.push(hit);
        this.cleanup.push(() => hit.remove());
      }
      for (const target of targets) {
        this.listen(target, "pointerenter", () => this.showTip(mark));
        this.listen(target, "pointerleave", () => this.scheduleHide());
        if (this.options.filter) this.listen(target, "click", () => this.toggleMark(mark));
      }
      this.listen(mark, "focus", () => {
        this.focusIndex = this.marks.indexOf(mark);
        this.showTip(mark);
        this.drawRing(mark);
      });
      this.listen(mark, "blur", () => {
        this.hideTip();
        this.ring?.remove();
        this.ring = null;
      });
    }
    this.listen(svg, "keydown", (e) => this.onKey(e as KeyboardEvent));

    if (this.options.filter) this.attachLegend();
    if (this.options.brush && parseScale(this.figure)) this.attachBrush(svg);
    if (this.options.entrance) this.attachEntrance();
  }

  /** Draws the focus ring around a mark, replacing the last one. */
  private drawRing(mark: SVGGraphicsElement): void {
    this.ring?.remove();
    this.ring = focusRing(mark);
  }

  private attachLegend(): void {
    const field = this.figure.getAttribute("data-enarratio-series-field");
    if (!field) return;
    for (const item of this.figure.querySelectorAll<HTMLElement>(".enarratio-legend li")) {
      const value = item.getAttribute("data-enarratio-series") ?? "";
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.append(...item.childNodes);
      item.append(button);
      this.listen(button, "click", () => this.toggle(field, value));
      this.cleanup.push(() => item.replaceChildren(...button.childNodes));
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
        this.announce("Range start set; click again to set the end");
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

  private emitBrush(range: [number, number] | null): void {
    const scale = parseScale(this.figure);
    const time = scale?.type === "utc" || scale?.type === "time";
    if (!range && this.brushRect) this.brushRect.style.display = "none";
    const format = (n: number): string =>
      time ? new Date(n).toISOString().slice(0, 10) : String(Math.round(n * 1000) / 1000);
    this.announce(
      range ? `Range selected: ${format(range[0])} to ${format(range[1])}` : "Range cleared",
    );
    this.figure.dispatchEvent(
      new CustomEvent<BrushDetail>("enarratio:brush", {
        bubbles: true,
        detail: { chartId: this.chartId, range, time },
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
        const done = setTimeout(
          () => this.figure.removeAttribute("data-enarratio-entering"),
          ENTRANCE_MS,
        );
        this.cleanup.push(() => clearTimeout(done));
      },
      { threshold: ENTRANCE_VISIBLE },
    );
    observer.observe(this.figure);
    this.cleanup.push(() => observer.disconnect());
  }

  private showTip(mark: SVGGraphicsElement): void {
    const tip = this.tooltip;
    if (!tip) return;
    clearTimeout(this.hideTimer);
    tip.textContent = label(mark);
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

  private onKey(event: KeyboardEvent): void {
    if (this.marks.length === 0) return;
    const current = this.marks[this.focusIndex];
    let next = this.focusIndex;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft":
        next = this.column(event.key === "ArrowRight" ? 1 : -1);
        break;
      case "ArrowUp":
      case "ArrowDown":
        next = this.stack(event.key === "ArrowUp" ? 1 : -1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = this.marks.length - 1;
        break;
      case "Enter":
      case " ":
        if (current && this.options.filter) this.toggleMark(current);
        event.preventDefault();
        return;
      case "Escape":
        // Dismisses the tooltip (WCAG 1.4.13, F6) and clears the filter and range.
        this.hideTip();
        this.clearAll(true);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (event.shiftKey && this.brushRect) {
      this.anchorIndex ??= this.focusIndex;
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

  /** The first mark in the next or previous column, so arrows step category by category. */
  private column(step: 1 | -1): number {
    const here = this.columnOf(this.focusIndex);
    if (here === null) return this.focusIndex;
    for (let i = this.focusIndex + step; i >= 0 && i < this.marks.length; i += step) {
      const col = this.columnOf(i);
      if (col !== null && col !== here) {
        if (step === 1) return i;
        // Moving left lands on the bottom of the column, as moving right does.
        let first = i;
        while (first > 0 && this.columnOf(first - 1) === col) first -= 1;
        return first;
      }
    }
    return this.focusIndex;
  }

  /** The mark above or below in the same column (a stack), or the current one at its end. */
  private stack(step: 1 | -1): number {
    const here = this.columnOf(this.focusIndex);
    const there = this.columnOf(this.focusIndex + step);
    return here !== null && there === here ? this.focusIndex + step : this.focusIndex;
  }

  private moveFocus(index: number, focus = true): void {
    const from = this.marks[this.focusIndex];
    const to = this.marks[index];
    if (!to) return;
    from?.setAttribute("tabindex", "-1");
    to.setAttribute("tabindex", "0");
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
    for (const mark of this.marks) {
      const match =
        next !== null &&
        (bySeries
          ? mark.getAttribute("data-enarratio-series") === next.value
          : mark.getAttribute("data-enarratio-field") === next.field &&
            mark.getAttribute("data-enarratio-value") === next.value);
      mark.toggleAttribute("data-enarratio-dimmed", next !== null && !match);
      if (mark.hasAttribute("aria-pressed")) mark.setAttribute("aria-pressed", String(match));
    }
    for (const button of this.figure.querySelectorAll<HTMLButtonElement>(
      ".enarratio-legend button",
    )) {
      const value = button.parentElement?.getAttribute("data-enarratio-series");
      button.setAttribute("aria-pressed", String(bySeries && value === next?.value));
    }
    const field = next?.field ?? previous?.field;
    if (field === undefined || !notify) return;
    this.announce(next ? `Filtered to ${next.value}` : "Filter cleared");
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
    if (this.live) this.live.textContent = message;
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
      else this.brushRect.style.display = "none";
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
    const selected = this.selected;
    // The tab stop (and focus, if a reader is in the chart) moves to the same mark after the swap.
    const stop = this.marks[this.focusIndex];
    const stopKey = stop?.getAttribute("data-enarratio-key") ?? null;
    const stopX = stop?.getAttribute("data-enarratio-x") ?? null;
    const stopIndex = this.focusIndex;
    const hadFocus = stop !== undefined && document.activeElement === stop;
    this.teardown();
    for (const name of this.figure.getAttributeNames()) this.figure.removeAttribute(name);
    for (const name of incoming.getAttributeNames()) {
      this.figure.setAttribute(name, incoming.getAttribute(name) ?? "");
    }
    this.figure.replaceChildren(...incoming.childNodes);
    this.attach();
    // Restoring the page's own selection is not news to the page, so it fires nothing.
    if (selected) this.select(selected, false);
    if (stopKey !== null && this.marks.length > 0) {
      this.moveFocus(this.successor(stopKey, stopX, stopIndex), hadFocus);
    }
    if (!reducedMotion()) animateFrom(this.figure, before);
  }

  private teardown(): void {
    for (const undo of this.cleanup.splice(0)) undo();
    clearTimeout(this.hideTimer);
    this.ring?.remove();
    this.ring = null;
    this.rangeStart = null;
    this.tooltip?.remove();
    this.tooltip = null;
    this.live?.remove();
    this.live = null;
    this.brushRect = null;
    this.marks = [];
    this.focusIndex = 0;
    this.anchorIndex = null;
  }

  destroy(): void {
    this.teardown();
    const svg = this.svg;
    if (svg) {
      svg.setAttribute("role", this.serverRole ?? "img");
      if (this.serverRole !== "group") svg.removeAttribute("aria-roledescription");
      for (const mark of svg.querySelectorAll(MARK)) {
        const text = mark.getAttribute("aria-label");
        const href = mark.getAttribute("data-enarratio-href");
        if (href !== null) {
          mark.setAttribute("href", href);
          mark.removeAttribute("data-enarratio-href");
        }
        for (const name of ["role", "aria-pressed", "tabindex", "data-enarratio-dimmed"]) {
          mark.removeAttribute(name);
        }
        // Links keep their name, as the server rendered them; other marks get their title back.
        if (href === null) mark.removeAttribute("aria-label");
        if (text) {
          const title = document.createElementNS(SVG_NS, "title");
          title.textContent = text;
          shape(mark).append(title);
        }
      }
    }
    this.untabbedFrame?.setAttribute("tabindex", "0");
    this.untabbedFrame = null;
    for (const name of [
      "data-enarratio-enhanced",
      "data-enarratio-interactive",
      "data-enarratio-entering",
    ]) {
      this.figure.removeAttribute(name);
    }
    enhanced.delete(this.figure);
  }
}

export const enhanced = new WeakMap<HTMLElement, Chart>();
