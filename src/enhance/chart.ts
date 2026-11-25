/** One enhanced chart: tooltips, keyboard navigation, filters, the range brush and updates. */

import { measure } from "./batch.js";
import { fill, sortTable } from "./controls.js";
import { MARK, parseScale, readingOrder } from "./marks.js";
import { animateFrom, DURATION, geometry, reducedMotion } from "./motion.js";
import { Picker, type Picked } from "./pointer.js";
import { sanitize } from "./sanitize.js";
import { drawHits, measureHits } from "./targets.js";
import type { EnhancedChart, ResolvedOptions, SelectDetail } from "./types.js";
import { parseMarkup } from "../parse.js";
import { attachBrush, emitBrush, setRange, showRange } from "./brush.js";
import { attachPoints, moveFocus, successor } from "./points.js";
import { hideTip, scheduleHide, showTip } from "./tip.js";
import { attachControls } from "./bar.js";
import { attachEntrance, attachLegend, attachPointer, attachSpotlight } from "./view.js";

export class Chart implements EnhancedChart {
  readonly figure: HTMLElement;
  readonly options: ResolvedOptions;
  readonly cleanup: (() => void)[] = [];
  tooltip: HTMLElement | null = null;
  live: HTMLElement | null = null;
  marks: SVGGraphicsElement[] = [];
  /** One native control per mark, in the same order: what keyboards and screen readers use. */
  points: HTMLElement[] = [];
  texts = new Map<Element, string>();
  /** Titles taken off the marks, and where they were, for destroy() to put back. */
  titles: [Element, Element][] = [];
  /** For each mark, the indexes of the marks in its series, in reading order. */
  series: number[][] = [];
  seriesOrder: number[][] = [];
  focusIndex = 0;
  /** The point focused before the last move, which Backspace returns to. */
  lastIndex: number | null = null;
  anchorIndex: number | null = null;
  selected: { field: string; value: string } | null = null;
  range: [number, number] | null = null;
  brushRect: SVGRectElement | null = null;
  rangeInputs: HTMLInputElement[] = [];
  expandButton: HTMLButtonElement | null = null;
  stopSound: (() => void) | null = null;
  layout: () => void = () => {};
  /** Counts teardowns, so a batched read queued before one is dropped (batch.ts). */
  runs = 0;
  /** A wide frame whose tab stop attach() removed, given back by destroy(). */
  untabbedFrame: HTMLElement | null = null;
  hideTimer: ReturnType<typeof setTimeout> | undefined;
  rangeStart: number | null = null;
  picker: Picker | null = null;
  cross: ((picked: Picked | null) => void) | null = null;
  pointerType = "mouse";
  /** Where the pointer is across the page, so a column's card never sits under it; null by key. */
  pointerX: number | null = null;

  constructor(figure: HTMLElement, options: ResolvedOptions) {
    this.figure = figure;
    this.options = options;
    this.attach();
    // After enhance() returns, so listeners the page adds next hear a view read from the address.
    if (options.url) queueMicrotask(() => this.restoreUrl());
  }

  /** The drawing, not an SVG inside the table (a table chart's sparklines and cell bars). */
  get svg(): SVGSVGElement | null {
    return this.figure.querySelector(":scope > .enarratio-frame > svg");
  }

  get chartId(): string | null {
    return this.figure.id || null;
  }

  get strings(): ResolvedOptions["strings"] {
    return this.options.strings;
  }

  /** A layout read and its write, batched with every other chart's and dropped after a teardown. */
  later<T>(read: () => T, write: (value: T) => void): void {
    const run = this.runs;
    measure(
      () => (run === this.runs ? read() : undefined),
      (value) => {
        if (run === this.runs) write(value as T);
      },
    );
  }

  listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  attach(): void {
    const svg = this.svg;
    this.figure.setAttribute("data-enarratio-enhanced", "");
    if (this.options.filter) this.figure.setAttribute("data-enarratio-interactive", "");

    if (!this.live) {
      this.live = document.createElement("p");
      this.live.className = "enarratio-visually-hidden";
      this.live.setAttribute("aria-live", "polite");
    }
    if (!this.live.isConnected) this.figure.append(this.live);
    // A primitive has no points: it gets its toolbar, so its drawing downloads as any chart's does, and nothing else.
    if (this.figure.hasAttribute("data-enarratio-static")) {
      this.figure.removeAttribute("data-enarratio-interactive");
      attachControls(this);
      return;
    }
    // A figure that is only a table (tableChart) gets its sortable headers and nothing else.
    if (!svg) {
      if (this.options.table)
        this.cleanup.push(sortTable(this.figure, this.strings, (m) => this.announce(m)));
      return;
    }

    this.marks = readingOrder([...svg.querySelectorAll<SVGGraphicsElement>(MARK)]);
    const frame = this.figure.querySelector<HTMLElement>(":scope > .enarratio-frame");
    if (this.marks.length > 0) attachPoints(this, svg, frame);

    if (this.options.tooltips) {
      const tip = document.createElement("div");
      tip.className = "enarratio-tooltip";
      tip.hidden = true;
      tip.setAttribute("aria-hidden", "true");
      document.body.append(tip);
      this.tooltip = tip;
      // The pointer can move onto the tooltip without it vanishing, and Escape dismisses it
      // wherever focus is (WCAG 1.4.13).
      this.listen(tip, "pointerenter", () => clearTimeout(this.hideTimer));
      this.listen(tip, "pointerleave", () => hideTip(this));
      this.listen(document, "keydown", (e) => {
        if ((e as KeyboardEvent).key === "Escape") hideTip(this);
      });
    }

    // Clicks belong to the marks and their targets; hovering belongs to the whole drawing
    // (attachPointer).
    const pointAt = (mark: SVGGraphicsElement, target: Element): void => {
      const href = mark.getAttribute("data-enarratio-href");
      if (this.filters(mark)) this.listen(target, "click", () => this.toggleMark(mark));
      else if (href !== null) this.listen(target, "click", () => location.assign(href));
    };
    const marks = this.marks;
    for (const mark of marks) pointAt(mark, mark);
    this.later(
      () => measureHits(marks),
      (sizes) => {
        drawHits(marks, sizes).forEach((hit, i) => {
          const mark = marks[i];
          if (!hit || !mark) return;
          pointAt(mark, hit);
          this.cleanup.push(() => hit.remove());
        });
      },
    );

    if (marks.length > 0) attachPointer(this, svg);
    if (this.options.filter) attachLegend(this);
    attachSpotlight(this);
    if (this.options.brush && parseScale(this.figure)) attachBrush(this, svg);
    attachControls(this);
    if (this.options.entrance) attachEntrance(this);
  }

  filters(mark: Element): boolean {
    return this.options.filter && mark.hasAttribute("data-enarratio-field");
  }

  /** A mark with focus, or one the sound is playing: shows its column as a pointer over it would. Null when it leaves. */
  hover(mark: SVGGraphicsElement | null): void {
    this.pointerX = null;
    const index = mark ? this.marks.indexOf(mark) : -1;
    const picked =
      index < 0 ? null : (this.picker?.columnOf(index) ?? { indexes: [index], column: false });
    this.show(picked);
  }

  /**
   * Shows what was picked: one tooltip card; on bars the other columns fade, on lines and areas
   * the crosshair moves to it, on other charts the other series fade, while no filter is on.
   */
  show(picked: Picked | null): void {
    const chosen = new Set(picked?.indexes ?? []);
    const series =
      picked && !picked.column
        ? (this.marks[picked.indexes[0] ?? -1]?.getAttribute("data-enarratio-series") ?? null)
        : null;
    const bars = this.figure.getAttribute("data-enarratio") === "bar";
    this.marks.forEach((m, i) => {
      const fade =
        picked !== null &&
        !this.selected &&
        (picked.column
          ? bars && !chosen.has(i)
          : series !== null && m.getAttribute("data-enarratio-series") !== series);
      m.toggleAttribute("data-enarratio-faded", fade);
    });
    this.cross?.(picked);
    if (picked)
      showTip(
        this,
        picked.indexes.flatMap((i) => this.marks[i] ?? []),
      );
    else scheduleHide(this);
  }

  toggleMark(mark: Element): void {
    const field = mark.getAttribute("data-enarratio-field");
    const value = mark.getAttribute("data-enarratio-value");
    if (field === null || value === null) return;
    this.toggle(field, value, mark.getAttribute("data-enarratio-x") ?? undefined);
  }

  toggle(field: string, value: string, x?: string): void {
    const same = this.selected?.field === field && this.selected.value === value;
    this.select(same ? null : { field, value }, true, x);
  }

  select(next: { field: string; value: string } | null, notify: boolean, x?: string): void {
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

  announce(message: string): void {
    // The same message twice is still news: a changed space makes the region speak again.
    if (this.live)
      this.live.textContent = this.live.textContent === message ? `${message} ` : message;
  }

  /** Writes the filter and range into the address, when the page asked for it. */
  syncUrl(): void {
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
  restoreUrl(): void {
    const id = this.chartId;
    if (!id) return;
    const params = new URLSearchParams(location.search);
    const filter = params.get(id) ?? "";
    const colon = filter.indexOf(":");
    if (colon > 0)
      this.select({ field: filter.slice(0, colon), value: filter.slice(colon + 1) }, true);
    const range = (params.get(`${id}-range`) ?? "").split("..").map(Number);
    const [lo, hi] = range;
    if (range.length === 2 && Number.isFinite(lo) && Number.isFinite(hi)) {
      if (showRange(this, [lo as number, hi as number]))
        emitBrush(this, [lo as number, hi as number]);
    }
  }

  setFilter(filter: { readonly field: string; readonly value: string } | null): void {
    this.select(filter ? { field: filter.field, value: filter.value } : null, false);
  }

  clear(): void {
    this.clearAll(false);
  }

  clearAll(notify: boolean): void {
    this.rangeStart = null;
    if (this.selected) this.select(null, notify);
    if (this.brushRect && this.brushRect.style.display !== "none") {
      if (notify) emitBrush(this, null);
      else setRange(this, null);
    }
    this.anchorIndex = null;
  }

  update(markup: string): void {
    // DOMParser builds an inert document: nothing in it loads or runs while it is checked.
    const parsed = parseMarkup(markup.trim());
    const candidate = parsed.body.firstElementChild;
    if (!candidate?.matches("figure.enarratio")) {
      throw new Error("update() needs the markup of one Enarratio figure");
    }
    sanitize(candidate);
    const incoming = document.importNode(candidate, true);
    const before = geometry(this.figure);
    const { selected, range } = this;
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
    // A copy: childNodes is live, and removing from it while walking it would skip every other node.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const node of [...this.figure.childNodes]) if (node !== this.live) node.remove();
    this.figure.prepend(...incoming.childNodes);
    this.attach();
    // Restoring the page's own selection is not news to the page, so it fires nothing.
    if (selected) this.select(selected, false);
    if (range && showRange(this, range)) setRange(this, range);
    if (expanded) this.expandButton?.click();
    if (stopKey !== null && this.marks.length > 0) {
      moveFocus(this, successor(this, stopKey, stopX, stopIndex), hadFocus);
    }
    if (!reducedMotion()) {
      animateFrom(this.figure, before);
      const settled = setTimeout(() => this.layout(), DURATION);
      this.cleanup.push(() => clearTimeout(settled));
    }
    this.announce(this.strings.updated);
  }

  teardown(): void {
    this.runs++;
    for (const undo of this.cleanup.splice(0)) undo();
    clearTimeout(this.hideTimer);
    this.rangeStart = null;
    this.tooltip?.remove();
    this.tooltip = null;
    this.brushRect = null;
    this.picker = null;
    this.cross = null;
    this.rangeInputs = [];
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
    for (const mark of marks) {
      mark.removeAttribute("data-enarratio-dimmed");
      mark.removeAttribute("data-enarratio-faded");
    }
    this.figure.removeAttribute("data-enarratio-spotlight");
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
