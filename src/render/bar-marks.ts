/**
 * The finish both bar renderers share (record 0036): each bar's outer end rounded, the series
 * named beside the last stack, and values written at the bars' tips. It works on the finished
 * SVG, from the bars' drawn geometry, so `enarratio/plot` and `enarratio/lite` agree by
 * construction, as {@link texture} does for patterns.
 */

import { escapeHtml } from "../html.js";
import { num } from "../lite/svg.js";
import type { BarModel, BarPoint } from "./bar-model.js";
import { markKey } from "./data.js";
import { spreadLabels } from "./direct-labels.js";
import { charWidth, textGrowth } from "./size.js";

/** The radius of a bar's outer corners, in user units. */
const RADIUS = 4;
/** The gap between a bar's tip and its value, and between a stack and its names. */
const GAP = 6;
/** Where a name's leader line starts and ends beyond the stack, and where the name starts. */
const LEADER = [3, 10, 14] as const;
/** A line of mark text, in user units at full width. */
const LINE = 14;

/** Which end of a bar is its outer end: away from zero along the value axis. */
type End = "top" | "bottom" | "left" | "right";

/** A drawn bar: its datum and its box in the drawing's own coordinates. */
interface Drawn {
  readonly point: BarPoint;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What {@link finishBars} returns. */
export interface FinishedBars {
  readonly svg: string;
  /** Whether every series is named on the drawing, so color and legend are not the only key. */
  readonly labeled: boolean;
}

/**
 * How a chart's bars are found in its markup, for charts that draw more than one model's bars:
 * small multiples key each bar and stack with its panel, and name no series in the panels.
 */
export interface BarLayout {
  readonly points: readonly BarPoint[];
  /** A bar's `data-enarratio-key`. */
  readonly keyOf: (p: BarPoint) => string;
  /** The stack a bar is part of (its own key when grouped). */
  readonly stackOf: (p: BarPoint) => string;
  /** Whether series may be named beside the drawing. */
  readonly names: boolean;
}

const layoutOf = (model: BarModel): BarLayout => ({
  points: model.points,
  keyOf: (p) => markKey(p.x, p.series),
  stackOf: (p) => (model.grouped ? markKey(p.x, p.series) : p.x),
  names: true,
});

/**
 * The outer end of each bar that has one: the last positive and last negative segment of each
 * stack, or each bar of a grouped or single-series chart. Zero-length bars have none.
 */
function outerEnds(model: BarModel, layout: BarLayout): Map<string, End> {
  const ends = new Map<string, End>();
  const last = new Map<string, BarPoint>();
  for (const p of layout.points) {
    if (p.value === 0) continue;
    last.set(`${layout.stackOf(p)}\u0000${p.value > 0 ? "+" : "-"}`, p);
  }
  for (const p of last.values()) {
    const end: End = model.horizontal
      ? p.value > 0
        ? "right"
        : "left"
      : p.value > 0
        ? "top"
        : "bottom";
    ends.set(layout.keyOf(p), end);
  }
  return ends;
}

/** A rectangle as a path with its outer end's two corners rounded, its base square. */
function roundedPath(b: Omit<Drawn, "point">, end: End): string {
  const { x, y, width: w, height: h } = b;
  const along = end === "top" || end === "bottom" ? h : w;
  const across = end === "top" || end === "bottom" ? w : h;
  const r = Math.max(0, Math.min(RADIUS, across / 2, along));
  const arc = (tx: number, ty: number): string =>
    `A${num(r)},${num(r)} 0 0 1 ${num(tx)},${num(ty)}`;
  switch (end) {
    case "top":
      return `M${num(x)},${num(y + h)}V${num(y + r)}${arc(x + r, y)}H${num(x + w - r)}${arc(x + w, y + r)}V${num(y + h)}Z`;
    case "bottom":
      return `M${num(x + w)},${num(y)}V${num(y + h - r)}${arc(x + w - r, y + h)}H${num(x + r)}${arc(x, y + h - r)}V${num(y)}Z`;
    case "right":
      return `M${num(x)},${num(y)}H${num(x + w - r)}${arc(x + w, y + r)}V${num(y + h - r)}${arc(x + w - r, y + h)}H${num(x)}Z`;
    case "left":
      return `M${num(x + w)},${num(y + h)}H${num(x + r)}${arc(x, y + h - r)}V${num(y + r)}${arc(x + r, y)}H${num(x + w)}Z`;
  }
}

const ATTRIBUTE = /\s([\w:-]+)="([^"]*)"/g;

const unescape = (value: string): string =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const offsetOf = (tag: string): [number, number] => {
  const m = /\stransform="translate\(([-\d.e]+),([-\d.e]+)\)"/.exec(tag);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
};

/**
 * Rounds the bars' outer ends and reads where each bar is drawn, walking the bar group's markup
 * with the facet offsets it nests bars in.
 */
function shapeBars(
  svg: string,
  model: BarModel,
  layout: BarLayout,
): { svg: string; drawn: Drawn[] } | undefined {
  const open = svg.indexOf('<g data-enarratio-mark="bar">');
  if (open === -1) return undefined;
  const byKey = new Map(layout.points.map((p) => [layout.keyOf(p), p]));
  const ends = outerEnds(model, layout);
  const drawn: Drawn[] = [];
  const offsets: [number, number][] = [[0, 0]];
  const tags = /<(\/?)(g|rect)\b([^>]*?)(\/?)>/g;
  tags.lastIndex = open;
  let out = "";
  let from = 0;
  let closeAs: string[] = [];
  for (let m = tags.exec(svg); m; m = tags.exec(svg)) {
    const [whole, closing, name, attrs, selfClosing] = m as unknown as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (name === "g") {
      if (closing) {
        offsets.pop();
        if (offsets.length === 0) break;
      } else {
        const [px, py] = offsets.at(-1) ?? [0, 0];
        const [dx, dy] = m.index === open ? [0, 0] : offsetOf(attrs);
        offsets.push([px + dx, py + dy]);
      }
      continue;
    }
    if (closing) {
      // The closing tag of a rect that became a path.
      const as = closeAs.shift();
      if (as === "path") {
        out += `${svg.slice(from, m.index)}</path>`;
        from = m.index + whole.length;
      }
      continue;
    }
    const values = new Map([...attrs.matchAll(ATTRIBUTE)].map((a) => [a[1], a[2] ?? ""]));
    const key = values.get("data-enarratio-key");
    const point = key === undefined ? undefined : byKey.get(unescape(key));
    if (!selfClosing) closeAs.push("rect");
    if (!point || key === undefined) continue;
    const [dx, dy] = offsets.at(-1) ?? [0, 0];
    const box = {
      x: Number(values.get("x")),
      y: Number(values.get("y")),
      width: Number(values.get("width")),
      height: Number(values.get("height")),
    };
    drawn.push({ point, x: box.x + dx, y: box.y + dy, width: box.width, height: box.height });
    const end = ends.get(unescape(key));
    if (!end || !(box.width > 0 && box.height > 0)) continue;
    const kept = attrs.replace(/\s(?:x|y|width|height)="[^"]*"/g, "");
    out += `${svg.slice(from, m.index)}<path${kept} d="${roundedPath(box, end)}"${selfClosing ? "/" : ""}>`;
    from = m.index + whole.length;
    if (!selfClosing) closeAs[closeAs.length - 1] = "path";
  }
  closeAs = [];
  return { svg: out + svg.slice(from), drawn };
}

/** A text element of mark text. */
function label(
  x: number,
  y: number,
  value: string,
  attrs: Readonly<Record<string, string>> = {},
): string {
  const extra = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
    .join("");
  return `<text x="${num(x)}" y="${num(y)}"${extra}>${escapeHtml(value)}</text>`;
}

/**
 * Rounds each bar's outer end and writes the labels that name what the bars show: the series
 * beside the last stack of a stacked chart, the two series above the last group of a grouped one,
 * and each bar's value (each stack's total) at its tip where every one of them fits. Reports
 * whether every series is named, so the figure knows to fall back on textures (record 0036).
 */
export function finishBars(
  svg: string,
  model: BarModel,
  layout: BarLayout = layoutOf(model),
): FinishedBars {
  const shaped = shapeBars(svg, model, layout);
  const several = model.seriesNames.length > 1;
  if (!shaped) return { svg, labeled: !several };
  const { drawn } = shaped;
  const growth = textGrowth(model.width);
  const char = charWidth(model.width);
  const line = LINE * growth;
  const slotOf = new Map(model.seriesNames.map((name) => [name, model.plan.slot(name)] as const));
  const texts: string[] = [];
  const named = new Set<string>();
  const vertical = !model.horizontal;

  // Stacks, or bars when grouped: each with its extent and its total either side of zero.
  type Stack = {
    bars: Drawn[];
    lo: number;
    hi: number;
    pos: number;
    neg: number;
    center: number;
  };
  const stacks = new Map<string, Stack>();
  for (const d of drawn) {
    const id = layout.stackOf(d.point);
    const start = vertical ? d.y : d.x;
    const end = vertical ? d.y + d.height : d.x + d.width;
    const center = vertical ? d.x + d.width / 2 : d.y + d.height / 2;
    const s = stacks.get(id) ?? { bars: [], lo: start, hi: end, pos: 0, neg: 0, center };
    s.bars.push(d);
    s.lo = Math.min(s.lo, start);
    s.hi = Math.max(s.hi, end);
    if (d.point.value > 0) s.pos += d.point.value;
    else s.neg += d.point.value;
    stacks.set(id, s);
  }
  const all = [...stacks.values()];
  const centers = [...new Set(all.map((s) => s.center))].sort((a, b) => a - b);
  const step = centers.slice(1).reduce((m, c, i) => Math.min(m, c - (centers[i] ?? c)), Infinity);
  // A value needs its text's width (vertical bars) or a line (horizontal) of room in its slot:
  // the distance between neighboring bars' middles.
  const room = step;
  const values = all.flatMap((s) => [
    ...(s.pos > 0 || (s.pos === 0 && s.neg === 0) ? [{ s, value: s.pos, out: 1 }] : []),
    ...(s.neg < 0 ? [{ s, value: s.neg, out: -1 }] : []),
  ]);
  const fits = values.every(({ value }) =>
    vertical ? model.format(value).length * char + 4 <= room : line <= room,
  );
  const errorBars = model.bounds !== undefined;

  // Values at the tips, unless error bars stand there.
  if (fits && !errorBars) {
    for (const { s, value, out } of values) {
      const text = model.format(value);
      if (vertical) {
        // Positive tips are toward the top (smaller y), negative ones toward the bottom.
        const y = out > 0 ? s.lo - GAP : s.hi + GAP + 0.7 * line;
        texts.push(label(s.center, y, text, { "text-anchor": "middle" }));
      } else {
        const x = out > 0 ? s.hi + GAP : s.lo - GAP;
        texts.push(
          label(x, s.center, text, { "text-anchor": out > 0 ? "start" : "end", dy: "0.32em" }),
        );
      }
    }
  }

  // Series names beside the last stack of a vertical stacked chart (spread so none overlap).
  if (several && layout.names && model.directLabels && !model.grouped && vertical) {
    const lastColumn = [...model.xNames]
      .reverse()
      .find((x) => drawn.some((d) => d.point.x === x && d.point.value !== 0));
    const segments = drawn
      .filter((d) => d.point.x === lastColumn && d.point.value !== 0)
      .sort((a, b) => a.y - b.y);
    const ys = spreadLabels(
      segments.map((d) => d.y + d.height / 2),
      model.width,
    );
    const lines: string[] = [];
    segments.forEach((d, i) => {
      const y = ys[i] ?? d.y + d.height / 2;
      const edge = d.x + d.width;
      named.add(d.point.series);
      lines.push(
        `<path d="M${num(edge + LEADER[0])},${num(d.y + d.height / 2)}L${num(edge + LEADER[1])},${num(y)}"/>`,
      );
      texts.push(
        label(edge + LEADER[2], y, d.point.series, {
          dy: "0.32em",
          "text-anchor": "start",
          fill: `var(--enarratio-series-${slotOf.get(d.point.series) ?? 1})`,
        }),
      );
    });
    if (lines.length > 0) {
      texts.unshift(
        `<g data-enarratio-mark="bar leader" fill="none" stroke="var(--enarratio-text-muted)">${lines.join("")}</g>`,
      );
    }
  }

  // The two series of a grouped vertical chart named over the last group: the first ending at
  // its bar's middle, the second starting there, so the two never meet.
  if (
    several &&
    layout.names &&
    model.directLabels &&
    model.grouped &&
    vertical &&
    model.seriesNames.length === 2
  ) {
    const lastColumn = model.xNames.at(-1);
    const bars = drawn
      .filter((d) => d.point.x === lastColumn && d.point.value > 0)
      .sort((a, b) => a.x - b.x);
    if (bars.length === 2) {
      bars.forEach((d, i) => {
        const above = fits && !errorBars ? line + GAP : 0;
        named.add(d.point.series);
        texts.push(
          label(d.x + d.width / 2 + (i === 0 ? GAP : -GAP), d.y - GAP - above, d.point.series, {
            "text-anchor": i === 0 ? "end" : "start",
            fill: `var(--enarratio-series-${slotOf.get(d.point.series) ?? 1})`,
          }),
        );
      });
    }
  }

  const labels =
    texts.length === 0
      ? ""
      : `<g data-enarratio-mark="bar label" aria-hidden="true" pointer-events="none" fill="var(--enarratio-text)">${texts.join("")}</g>`;
  const marks = shaped.svg;
  const at = marks.indexOf('<g data-enarratio-mark="bar">');
  // After the bar group: find its end by depth.
  let depth = 0;
  const groupTags = /<(\/?)g\b[^>]*?(\/?)>/g;
  groupTags.lastIndex = at;
  let close = marks.length;
  for (let m = groupTags.exec(marks); m; m = groupTags.exec(marks)) {
    if (m[2]) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      close = m.index + m[0].length;
      break;
    }
  }
  return {
    svg: marks.slice(0, close) + labels + marks.slice(close),
    labeled: !several || model.seriesNames.every((n) => named.has(n)),
  };
}
