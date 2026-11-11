/** Arcs and rings for the radial charts (pie, sunburst, chord, gauge, radar), as SVG path data. */

/** A coordinate rounded to two decimals. */
export const n2 = (v: number): number => Math.round(v * 100) / 100;

/** A point at an angle (0 at 12 o'clock, clockwise, in radians) and radius from the center. */
export const polar = (cx: number, cy: number, r: number, angle: number): [number, number] => [
  cx + r * Math.sin(angle),
  cy - r * Math.cos(angle),
];

/**
 * The path of a ring segment from angle `a0` to `a1` between radii `inner` and `outer`: a pie
 * slice when `inner` is 0, a whole ring or disc when the angles span the circle.
 */
export function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  a0: number,
  a1: number,
): string {
  // A whole circle is two half arcs: one arc cannot start and end at the same point.
  if (a1 - a0 >= 2 * Math.PI - 1e-9) {
    const ring = (r: number, sweep: 0 | 1): string => {
      const [x0, y0] = polar(cx, cy, r, 0);
      const [x1, y1] = polar(cx, cy, r, Math.PI);
      return `M${n2(x0)},${n2(y0)}A${n2(r)},${n2(r)} 0 1 ${sweep} ${n2(x1)},${n2(y1)}A${n2(r)},${n2(r)} 0 1 ${sweep} ${n2(x0)},${n2(y0)}Z`;
    };
    return inner > 0 ? `${ring(outer, 1)}${ring(inner, 0)}` : ring(outer, 1);
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = polar(cx, cy, outer, a0);
  const [ox1, oy1] = polar(cx, cy, outer, a1);
  const start = `M${n2(ox0)},${n2(oy0)}A${n2(outer)},${n2(outer)} 0 ${large} 1 ${n2(ox1)},${n2(oy1)}`;
  if (inner <= 0) return `${start}L${n2(cx)},${n2(cy)}Z`;
  const [ix1, iy1] = polar(cx, cy, inner, a1);
  const [ix0, iy0] = polar(cx, cy, inner, a0);
  return `${start}L${n2(ix1)},${n2(iy1)}A${n2(inner)},${n2(inner)} 0 ${large} 0 ${n2(ix0)},${n2(iy0)}Z`;
}

/** A label's box: left, top, right, bottom. */
type Box = [number, number, number, number];

/** Where a name set at the rim of a radial chart sits. */
export interface RimLabel {
  readonly x: number;
  readonly y: number;
  readonly dy: string;
  readonly anchor: "start" | "middle" | "end";
}

/**
 * The largest radius at which names set just past the rim, at the given angles, all stay inside
 * the drawing, and where each sits. Names go beside the rim (left of it on the left, right on the
 * right) or, when that leaves the circle much smaller, as on a phone, centered over their point:
 * above it on the upper half, below on the lower, lifted clear of the circle and of each other.
 * `cap` is the most the radius may be.
 */
export function rimLabels(
  names: readonly string[],
  angles: readonly number[],
  size: { width: number; height: number; char: number; line: number; cap: number },
): { radius: number; labels: RimLabel[] } {
  const { width, height, char, line, cap } = size;
  const gap = 8;
  const cx = width / 2;
  const cy = height / 2;
  const besideFit = Math.min(
    cap,
    ...names.map((name, k) => {
      const a = angles[k] as number;
      const sx = Math.abs(Math.sin(a));
      const sy = Math.abs(Math.cos(a));
      const w = name.length * char * (sx < 0.2 ? 0.5 : 1);
      const across = sx > 0.01 ? (width / 2 - 2 - w) / sx - gap : Infinity;
      const down = sy > 0.01 ? (height / 2 - 2 - line) / sy - gap : Infinity;
      return Math.min(across, down);
    }),
  );
  const beside = Math.max(24, besideFit);
  // Centered names at radius r: each box clears the circle by 4 px; null if one leaves the
  // drawing or two overlap.
  const centered = (r: number): { box: Box; up: boolean }[] | null => {
    const boxes = names.map((name, k) => {
      const a = angles[k] as number;
      const half = (name.length * char) / 2;
      const [px] = polar(cx, cy, r + gap, a);
      const x = Math.min(width - 2 - half, Math.max(2 + half, px));
      const up = Math.cos(a) >= 0;
      const near = Math.max(0, Math.abs(x - cx) - half);
      const clear = r + 4 > near ? Math.sqrt((r + 4) ** 2 - near ** 2) : 0;
      const edge = up ? cy - clear - 2 : cy + clear + 2;
      const box: Box = up
        ? [x - half, edge - line, x + half, edge]
        : [x - half, edge, x + half, edge + line];
      return { box, up };
    });
    // Two names that collide on the same half: the one nearer the vertical moves further out,
    // past the other (a top name rises over its neighbors' names).
    const hits = (p: Box, q: Box): boolean =>
      p[0] < q[2] + 4 && q[0] < p[2] + 4 && p[1] < q[3] + 2 && q[1] < p[3] + 2;
    for (let pass = 0; pass < names.length; pass++) {
      let moved = false;
      for (const [i, a] of boxes.entries()) {
        for (const [j, b] of boxes.entries()) {
          if (j <= i || a.up !== b.up || !hits(a.box, b.box)) continue;
          const ca = Math.abs(Math.cos(angles[i] as number));
          const cb = Math.abs(Math.cos(angles[j] as number));
          const [mover, still] = ca >= cb ? [a, b] : [b, a];
          const shift = mover.up
            ? mover.box[3] - (still.box[1] - 2)
            : still.box[3] + 2 - mover.box[1];
          mover.box[1] += mover.up ? -shift : shift;
          mover.box[3] += mover.up ? -shift : shift;
          moved = true;
        }
      }
      if (!moved) break;
    }
    if (boxes.some(({ box }) => box[1] < 2 || box[3] > height - 2)) return null;
    for (const [i, { box: p }] of boxes.entries()) {
      for (const { box: q } of boxes.slice(i + 1)) if (hits(p, q)) return null;
    }
    return boxes;
  };
  // Too small a circle crowds the names together and too large pushes them out of the drawing,
  // so the radius is not searched by halving: the largest that works wins.
  let lo = 0;
  for (let r = Math.floor(Math.max(24, cap)); r >= 24; r--) {
    if (centered(r)) {
      lo = r;
      break;
    }
  }
  const over = lo > 0 && lo > beside * 1.25;
  if (over) {
    const boxes = centered(lo) ?? [];
    return {
      radius: lo,
      labels: boxes.map(({ box, up }) => ({
        x: (box[0] + box[2]) / 2,
        y: up ? box[3] : box[1],
        dy: up ? "-0.25em" : "0.8em",
        anchor: "middle",
      })),
    };
  }
  const labels = names.map((_, k): RimLabel => {
    const a = angles[k] as number;
    const [x, y] = polar(cx, cy, beside + gap, a);
    const side = Math.sin(a);
    return {
      x,
      y,
      dy: Math.cos(a) > 0.7 ? "0" : Math.cos(a) < -0.7 ? "0.71em" : "0.32em",
      anchor: Math.abs(side) < 0.2 ? "middle" : side > 0 ? "start" : "end",
    };
  });
  return { radius: beside, labels };
}
