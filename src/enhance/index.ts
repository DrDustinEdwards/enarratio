/**
 * The enhancement layer: optional browser code that adds hover details, keyboard navigation,
 * click-to-filter events, a range brush, animated updates and an entrance animation to charts
 * Enarratio rendered on the server. Charts are complete without it.
 *
 * Every interaction works by pointer and by keyboard, is announced to screen readers, and
 * respects `prefers-reduced-motion`. It has no dependencies and imports nothing from the
 * server-side package, so a page ships only this module.
 *
 * @packageDocumentation
 */

/** Detail of the `enarratio:select` event, fired when a reader selects or clears a filter. */
export interface SelectDetail {
  /** The figure's `id`, or null when the chart was rendered without one. */
  readonly chartId: string | null;
  /** The data field the filter applies to, e.g. `"type"`. */
  readonly field: string;
  /** The value selected, e.g. `"Publications"`; null when the filter was cleared. */
  readonly value: string | null;
  /** The category of the mark selected, when a mark (not a legend entry) was used. */
  readonly x?: string;
}

/** Detail of the `enarratio:brush` event, fired when a reader picks or clears a range. */
export interface BrushDetail {
  readonly chartId: string | null;
  /**
   * The range in data units, low then high: numbers, or milliseconds since the epoch on a time
   * axis. Null when the range was cleared.
   */
  readonly range: readonly [number, number] | null;
  /** Whether the axis is time, so the range holds epoch milliseconds. */
  readonly time: boolean;
}

declare global {
  interface HTMLElementEventMap {
    "enarratio:select": CustomEvent<SelectDetail>;
    "enarratio:brush": CustomEvent<BrushDetail>;
  }
}

/** Options for {@link enhance}. Every feature is on unless turned off. */
export interface EnhanceOptions {
  /** Show a hover and focus tooltip with each mark's details. */
  readonly tooltips?: boolean;
  /** Let a click, Enter or Space on a mark or legend entry filter by its value. */
  readonly filter?: boolean;
  /** Let a drag, or Shift with arrow keys, pick a range on charts with a continuous x axis. */
  readonly brush?: boolean;
  /** Animate charts in the first time they scroll into view. */
  readonly entrance?: boolean;
}

/** A chart the enhancement layer is attached to. */
export interface EnhancedChart {
  readonly figure: HTMLElement;
  /** The options the chart was enhanced with, every default filled in. */
  readonly options: Readonly<Required<EnhanceOptions>>;
  /**
   * Replaces the chart with new server-rendered markup for the same chart, animating marks that
   * share a key from their old shape to their new one. The filter, the tab stop and keyboard
   * focus stay on the mark with the same key, or the nearest one if it is gone.
   *
   * The markup should come from Enarratio. It is parsed inertly and sanitized before it touches
   * the page: only the elements and attributes Enarratio emits are kept, and event handlers,
   * scripts and unsafe links are dropped (F11).
   */
  update(markup: string): void;
  /**
   * Shows a filter the page chose (from its own controls, or a URL) without firing
   * `enarratio:select`: the page already knows. A filter on the series field emphasizes that
   * series even where clicks filter by x. `null` clears it.
   */
  setFilter(filter: { readonly field: string; readonly value: string } | null): void;
  /**
   * Clears any filter and range the page wants gone, without firing events. A reader pressing
   * Escape clears them too, and that does fire events.
   */
  clear(): void;
  /** Removes every listener and element the layer added, leaving the server markup. */
  destroy(): void;
}

interface XScale {
  readonly type: string;
  readonly domain: readonly (number | string)[];
  readonly range: readonly number[];
}

const MARK = "[data-enarratio-key]";
const DURATION = 450;
const ANIMATED = ["x", "y", "width", "height", "cx", "cy", "r", "x1", "x2", "y1", "y2"] as const;

const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function label(mark: Element): string {
  return mark.getAttribute("aria-label") ?? mark.querySelector("title")?.textContent ?? "";
}

/** The element holding a mark's geometry: the mark, or the shape inside a linked mark. */
function shape(mark: Element): Element {
  return mark.hasAttribute("x") || mark.hasAttribute("cx") || !mark.firstElementChild
    ? mark
    : mark.firstElementChild;
}

function center(mark: SVGGraphicsElement): { x: number; y: number } {
  const box = mark.getBBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A mark's place in reading order: the column (category) and row (position within it) the server
 * wrote from the data. Geometry is the fallback for markup without them, measured on screen so
 * facets compare correctly (F9).
 */
function place(mark: Element): { column: number; row: number } {
  const column = mark.getAttribute("data-enarratio-col");
  const row = mark.getAttribute("data-enarratio-row");
  if (column !== null && row !== null) return { column: Number(column), row: Number(row) };
  const box = mark.getBoundingClientRect();
  return {
    column: Math.round(box.left + box.width / 2),
    row: -Math.round(box.top + box.height / 2),
  };
}

/** Marks in reading order: columns in order, and within a column bottom to top. */
function readingOrder(marks: SVGGraphicsElement[]): SVGGraphicsElement[] {
  const places = new Map(marks.map((m) => [m, place(m)]));
  const at = (m: SVGGraphicsElement): { column: number; row: number } =>
    places.get(m) ?? { column: 0, row: 0 };
  return [...marks].sort((a, b) => at(a).column - at(b).column || at(a).row - at(b).row);
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** The elements Enarratio's server markup is made of; update() keeps only these (F11). */
const ALLOWED_ELEMENTS = new Set([
  "figure",
  "p",
  "ul",
  "li",
  "span",
  "div",
  "figcaption",
  "details",
  "summary",
  "table",
  "caption",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "button",
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "path",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "a",
  "defs",
  "clippath",
]);
const LINK_ATTRIBUTES = new Set(["href", "xlink:href"]);
const SAFE_STYLE = /^(\s*--enarratio-[a-z0-9-]+\s*:\s*[^;{}<>]*;?)*\s*$/i;

/** Relative and http(s) links only, as the server allows (A11). */
function safeLink(value: string): boolean {
  const compact = [...value].filter((ch) => ch.charCodeAt(0) > 0x20).join("");
  if (/^[/\\][/\\]/.test(compact)) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === "http" || scheme === "https";
}

/** Removes everything the server never emits: other elements, handlers, unsafe links and styles. */
function sanitize(root: Element): void {
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (!ALLOWED_ELEMENTS.has(el.localName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const name of el.getAttributeNames()) {
      const value = el.getAttribute(name) ?? "";
      const lower = name.toLowerCase();
      if (
        lower.startsWith("on") ||
        (LINK_ATTRIBUTES.has(lower) && !safeLink(value)) ||
        (lower === "style" && !SAFE_STYLE.test(value)) ||
        lower === "srcdoc" ||
        lower === "formaction"
      ) {
        el.removeAttribute(name);
      }
    }
  }
}

function parseScale(figure: HTMLElement): XScale | null {
  const raw = figure.getAttribute("data-enarratio-x-scale");
  if (!raw) return null;
  const scale = JSON.parse(raw) as XScale;
  return ["linear", "utc", "time", "log", "sqrt", "pow"].includes(scale.type) ? scale : null;
}

/** Inverts a continuous scale for a position in SVG user units. */
function invert(scale: XScale, px: number): number {
  const [d0, d1] = scale.domain as [number, number];
  const [r0, r1] = scale.range as [number, number];
  const t = Math.min(1, Math.max(0, (px - r0) / (r1 - r0)));
  if (scale.type === "log") return Math.exp(Math.log(d0) + t * (Math.log(d1) - Math.log(d0)));
  return d0 + t * (d1 - d0);
}

function svgPoint(svg: SVGSVGElement, event: { clientX: number; clientY: number }): DOMPoint {
  const matrix = svg.getScreenCTM();
  const point = new DOMPoint(event.clientX, event.clientY);
  return matrix ? point.matrixTransform(matrix.inverse()) : point;
}

/** The smallest pointer target, in CSS pixels (WCAG 2.2 SC 2.5.8). */
const TARGET = 24;

class Chart implements EnhancedChart {
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
      const hit = this.hitArea(mark);
      if (hit) targets.push(hit);
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

  /**
   * An invisible target around a mark smaller than 24 CSS pixels, so it is large enough to point
   * at (WCAG 2.2 SC 2.5.8, A5). Drawn beneath the marks, so a mark still wins where targets
   * overlap in dense charts.
   */
  private hitArea(mark: SVGGraphicsElement): SVGRectElement | null {
    const scale = mark.getScreenCTM()?.a ?? 0;
    const parent = mark.parentElement;
    if (!(scale > 0) || !parent) return null;
    const shapeEl = shape(mark) as SVGGraphicsElement;
    const box = shapeEl.getBBox();
    const side = TARGET / scale;
    if (box.width >= side && box.height >= side) return null;
    const width = Math.max(box.width, side);
    const height = Math.max(box.height, side);
    const hit = document.createElementNS(SVG_NS, "rect");
    hit.setAttribute("class", "enarratio-hit");
    hit.setAttribute("aria-hidden", "true");
    hit.setAttribute("x", String(box.x + box.width / 2 - width / 2));
    hit.setAttribute("y", String(box.y + box.height / 2 - height / 2));
    hit.setAttribute("width", String(width));
    hit.setAttribute("height", String(height));
    parent.insertBefore(hit, parent.firstChild);
    this.cleanup.push(() => hit.remove());
    return hit;
  }

  /**
   * Draws the focus ring around a mark: a background-colored ring inside a focus-colored one, so
   * the ring shows against any series color beside it, not only against the background (F7).
   */
  private drawRing(mark: SVGGraphicsElement): void {
    this.ring?.remove();
    const parent = mark.parentElement;
    if (!parent) return;
    const box = (shape(mark) as SVGGraphicsElement).getBBox();
    const scale = mark.getScreenCTM()?.a || 1;
    const pad = 2 / scale;
    const ring = document.createElementNS(SVG_NS, "g");
    ring.setAttribute("class", "enarratio-focus-ring");
    ring.setAttribute("aria-hidden", "true");
    for (const [cls, extra] of [
      ["enarratio-focus-ring-inner", pad],
      ["enarratio-focus-ring-outer", pad + 3.5 / scale],
    ] as const) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", cls);
      rect.setAttribute("x", String(box.x - extra));
      rect.setAttribute("y", String(box.y - extra));
      rect.setAttribute("width", String(box.width + 2 * extra));
      rect.setAttribute("height", String(box.height + 2 * extra));
      rect.setAttribute("rx", String(2 / scale));
      ring.append(rect);
    }
    parent.append(ring);
    this.ring = ring;
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
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
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
        if (Math.abs(x - start) < 3) return;
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
        const done = setTimeout(() => this.figure.removeAttribute("data-enarratio-entering"), 1000);
        this.cleanup.push(() => clearTimeout(done));
      },
      { threshold: 0.25 },
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
      Math.max(8, box.left + box.width / 2 - tipBox.width / 2),
      document.documentElement.clientWidth - tipBox.width - 8,
    );
    const above = box.top - tipBox.height - 8;
    tip.style.left = `${left + scrollX}px`;
    tip.style.top = `${(above > 0 ? above : box.bottom + 8) + scrollY}px`;
  }

  private hideTip(): void {
    clearTimeout(this.hideTimer);
    if (this.tooltip) this.tooltip.hidden = true;
  }

  /** Hides the tooltip shortly, unless the pointer reaches it first. */
  private scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hideTip(), 300);
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
    const before = new Map<string, Record<string, string>>();
    for (const mark of this.figure.querySelectorAll(MARK)) {
      const attrs: Record<string, string> = {};
      for (const name of ANIMATED) {
        const value = shape(mark).getAttribute(name);
        if (value !== null) attrs[name] = value;
      }
      before.set(mark.getAttribute("data-enarratio-key") ?? "", attrs);
    }
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
    if (reducedMotion()) return;

    const tweens: { mark: Element; name: string; from: number; to: number }[] = [];
    for (const mark of this.figure.querySelectorAll(MARK)) {
      const old = before.get(mark.getAttribute("data-enarratio-key") ?? "");
      if (!old) {
        mark.animate?.([{ opacity: 0 }, { opacity: 1 }], {
          duration: DURATION,
          easing: "ease-out",
        });
        continue;
      }
      const el = shape(mark);
      for (const name of ANIMATED) {
        const from = Number(old[name]);
        const to = Number(el.getAttribute(name));
        if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
          tweens.push({ mark: el, name, from, to });
          el.setAttribute(name, String(from));
        }
      }
    }
    const started = performance.now();
    const frame = (now: number): void => {
      const t = Math.min(1, (now - started) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      for (const { mark, name, from, to } of tweens) {
        mark.setAttribute(name, String(from + (to - from) * eased));
      }
      if (t < 1) requestAnimationFrame(frame);
    };
    if (tweens.length > 0) requestAnimationFrame(frame);
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
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = text;
          shape(mark).append(title);
        }
      }
    }
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

const enhanced = new WeakMap<HTMLElement, Chart>();

/**
 * Enhances every Enarratio figure under `root` (the whole document by default) and returns them.
 * Calling it again is safe: a figure is enhanced once, and calling it with different options
 * re-applies the chart with the new ones (F18).
 *
 * @example
 * import { enhance } from "enarratio/enhance";
 * enhance();
 * document.addEventListener("enarratio:select", (e) => filterList(e.detail.field, e.detail.value));
 */
export function enhance(
  root: ParentNode = document,
  options: EnhanceOptions = {},
): EnhancedChart[] {
  const resolved: Required<EnhanceOptions> = {
    tooltips: options.tooltips ?? true,
    filter: options.filter ?? true,
    brush: options.brush ?? true,
    entrance: options.entrance ?? true,
  };
  const figures = [...root.querySelectorAll<HTMLElement>("figure.enarratio")];
  if (root instanceof HTMLElement && root.matches("figure.enarratio")) figures.unshift(root);
  return figures.map((figure) => {
    const existing = enhanced.get(figure);
    if (existing && JSON.stringify(existing.options) === JSON.stringify(resolved)) return existing;
    existing?.destroy();
    const chart = new Chart(figure, resolved);
    enhanced.set(figure, chart);
    return chart;
  });
}
