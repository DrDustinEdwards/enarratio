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
