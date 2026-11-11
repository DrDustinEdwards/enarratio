/**
 * The plot-wide pointer (record 0036): the whole drawing answers a pointer, not only the marks.
 * On bars, lines and areas the nearest column is picked (a stack, a group, or every series at one
 * x); elsewhere the nearest mark within reach. The tooltip is one card for what is picked, value
 * first, and lines and areas draw a crosshair at the picked x.
 */

import { label, SVG_NS, shape } from "./marks.js";

/** Kinds whose marks stand in columns the pointer picks whole. */
const COLUMN_KINDS = new Set(["bar", "line", "area"]);
/** How far from a mark, in CSS pixels, a pointer still picks it on other charts. */
const REACH = 40;

/** What the pointer picked: the marks of one column, or one mark. */
export interface Picked {
  /** Indexes into the chart's marks, in reading order. */
  readonly indexes: readonly number[];
  /** Whether a column was picked, rather than a single mark. */
  readonly column: boolean;
}

/** A mark's box in SVG user units and its middle. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
}

/** Reads and caches where the marks are, and picks the column or mark nearest a pointer. */
export class Picker {
  private boxes: Box[] | null = null;
  private columns: { at: number; indexes: number[] }[] | null = null;
  readonly byColumn: boolean;
  private readonly horizontal: boolean;

  constructor(
    figure: HTMLElement,
    private readonly marks: readonly SVGGraphicsElement[],
  ) {
    this.byColumn =
      COLUMN_KINDS.has(figure.getAttribute("data-enarratio") ?? "") &&
      marks.length > 0 &&
      marks.every((m) => m.hasAttribute("data-enarratio-col"));
    this.horizontal = figure.getAttribute("data-enarratio-orientation") === "horizontal";
  }

  /** Forgets the geometry, after the drawing changed size or moved. */
  reset(): void {
    this.boxes = null;
    this.columns = null;
  }

  box(index: number): Box | undefined {
    return this.read()[index];
  }

  private read(): Box[] {
    this.boxes ??= this.marks.map((mark) => {
      const b = (shape(mark) as SVGGraphicsElement).getBBox();
      return { ...rect(b), cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    });
    return this.boxes;
  }

  /** The columns in order, each at its middle along the category axis. */
  private columnList(): { at: number; indexes: number[] }[] {
    if (this.columns) return this.columns;
    const boxes = this.read();
    const groups = new Map<string, number[]>();
    this.marks.forEach((mark, i) => {
      const key = mark.getAttribute("data-enarratio-col") ?? "";
      groups.set(key, [...(groups.get(key) ?? []), i]);
    });
    this.columns = [...groups.values()].map((indexes) => ({
      indexes,
      at:
        indexes.reduce(
          (sum, i) => sum + ((this.horizontal ? boxes[i]?.cy : boxes[i]?.cx) ?? 0),
          0,
        ) / indexes.length,
    }));
    return this.columns;
  }

  /** The column holding a mark, when the chart picks columns. */
  columnOf(index: number): Picked {
    if (!this.byColumn) return { indexes: [index], column: false };
    const found = this.columnList().find((c) => c.indexes.includes(index));
    return { indexes: found?.indexes ?? [index], column: true };
  }

  /**
   * What a pointer at (x, y), in SVG user units, picks: the nearest column along the category
   * axis, or the nearest mark within reach (`scale` CSS pixels per user unit). Null for none.
   */
  pick(x: number, y: number, scale: number): Picked | null {
    if (this.byColumn) {
      const along = this.horizontal ? y : x;
      let best: { at: number; indexes: number[] } | null = null;
      for (const c of this.columnList()) {
        if (!best || Math.abs(c.at - along) < Math.abs(best.at - along)) best = c;
      }
      return best ? { indexes: best.indexes, column: true } : null;
    }
    const reach = REACH / (scale || 1);
    // A mark whose shape holds the pointer wins: rings, ribbons and flows overlap each other's
    // boxes (record 0037).
    const inside = this.marks.findIndex((mark, i) => {
      const b = this.read()[i];
      if (!b || x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) return false;
      const s = shape(mark);
      return "isPointInFill" in s && (s as SVGGeometryElement).isPointInFill(new DOMPoint(x, y));
    });
    if (inside >= 0) return { indexes: [inside], column: false };
    let found = -1;
    let least = Infinity;
    this.read().forEach((b, i) => {
      // Distance to the box, so a large mark is picked anywhere over it.
      const dx = Math.max(b.x - x, 0, x - (b.x + b.width));
      const dy = Math.max(b.y - y, 0, y - (b.y + b.height));
      const d = Math.hypot(dx, dy);
      if (d < least) {
        least = d;
        found = i;
      }
    });
    return found >= 0 && least <= reach ? { indexes: [found], column: false } : null;
  }
}

const rect = (b: DOMRect): Omit<Box, "cx" | "cy"> => ({
  x: b.x,
  y: b.y,
  width: b.width,
  height: b.height,
});

/** The palette slot a mark is drawn in, from its fill: a series color or its pattern. */
export function slotOf(mark: Element): number | null {
  const paint = shape(mark).getAttribute("fill") ?? mark.getAttribute("fill") ?? "";
  const m = /--enarratio-series-(\d)\)/.exec(paint) ?? /^url\(#enarratio-[^)]*-(\d)\)$/.exec(paint);
  return m ? Number(m[1]) : null;
}

/**
 * Fills the tooltip with one card for the picked marks: the column's heading, then a row per mark
 * with its color, its value first and its series. A mark without the parts (a chart that does not
 * write them) shows its whole description instead.
 */
export function fillCard(
  tip: HTMLElement,
  figure: HTMLElement,
  marks: readonly SVGGraphicsElement[],
  texts: ReadonlyMap<Element, string>,
): void {
  const parts = marks.every(
    (m) => m.hasAttribute("data-enarratio-at") && m.hasAttribute("data-enarratio-shown"),
  );
  if (!parts) {
    tip.replaceChildren(
      ...marks.map((m) => {
        const p = document.createElement("p");
        p.className = "enarratio-tip-text";
        p.textContent = texts.get(m) ?? label(m);
        return p;
      }),
    );
    return;
  }
  const head = document.createElement("p");
  head.className = "enarratio-tip-at";
  head.textContent = marks[0]?.getAttribute("data-enarratio-at") ?? "";
  const colors = getComputedStyle(figure);
  // Top of the stack first, as the eye meets it; a column of one series reads alone.
  const ordered = [...marks].reverse();
  const rows = ordered.map((m) => {
    const row = document.createElement("p");
    row.className = "enarratio-tip-row";
    const key = document.createElement("span");
    key.className = "enarratio-tip-key";
    const slot = slotOf(m);
    if (slot !== null) {
      key.style.background =
        colors.getPropertyValue(`--enarratio-series-${slot}`).trim() ||
        `var(--enarratio-series-${slot})`;
    }
    const value = document.createElement("b");
    value.textContent = m.getAttribute("data-enarratio-shown") ?? "";
    row.append(key, value);
    const series = m.getAttribute("data-enarratio-series");
    if (series !== null) {
      const name = document.createElement("span");
      name.textContent = series;
      row.append(name);
    }
    return row;
  });
  tip.replaceChildren(head, ...rows);
}

/**
 * A crosshair at a column of a line or area chart: a rule from the top of the plot to its foot,
 * and a dot on each series there in the series' color. Returns a function that moves it, or hides
 * it when given null.
 */
export function crosshair(
  svg: SVGSVGElement,
  picker: Picker,
  marks: readonly SVGGraphicsElement[],
): (picked: Picked | null) => void {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "enarratio-crosshair");
  group.setAttribute("aria-hidden", "true");
  group.setAttribute("pointer-events", "none");
  group.setAttribute("visibility", "hidden");
  const rule = document.createElementNS(SVG_NS, "line");
  group.append(rule);
  svg.append(group);
  // The plot's height, from its horizontal gridlines, else from the marks themselves.
  const extent = (): [number, number] => {
    const ys = [...svg.querySelectorAll('[data-enarratio-mark="y-grid"] line')].map((l) =>
      Number(l.getAttribute("y1")),
    );
    if (ys.length > 1) return [Math.min(...ys), Math.max(...ys)];
    const view = svg.viewBox.baseVal;
    return [0, view.height || svg.height.baseVal.value];
  };
  let dots: SVGCircleElement[] = [];
  return (picked) => {
    if (!picked) {
      group.setAttribute("visibility", "hidden");
      return;
    }
    const boxes = picked.indexes.flatMap((i) => picker.box(i) ?? []);
    const first = boxes[0];
    if (!first) return;
    const [top, bottom] = extent();
    rule.setAttribute("x1", String(first.cx));
    rule.setAttribute("x2", String(first.cx));
    rule.setAttribute("y1", String(top));
    rule.setAttribute("y2", String(bottom));
    for (const dot of dots) dot.remove();
    dots = picked.indexes.flatMap((i) => {
      const box = picker.box(i);
      const mark = marks[i];
      if (!box || !mark) return [];
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(box.cx));
      dot.setAttribute("cy", String(box.cy));
      dot.setAttribute("r", "4.5");
      const slot = slotOf(mark);
      dot.setAttribute("fill", slot === null ? "currentColor" : `var(--enarratio-series-${slot})`);
      group.append(dot);
      return [dot];
    });
    group.setAttribute("visibility", "visible");
  };
}
