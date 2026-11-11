/** Motion: the entrance and update animations, both skipped under `prefers-reduced-motion`. */

import { MARK, shape } from "./marks.js";

export const DURATION = 450;
const ANIMATED = ["x", "y", "width", "height", "cx", "cy", "r", "x1", "x2", "y1", "y2"] as const;
const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/**
 * A path's numbers and the commands between them, so two paths drawn by the same rule (the rounded
 * bars of record 0036) tween number by number. Null when the two do not share their commands.
 */
function pathTween(from: string, to: string): ((t: number) => string) | null {
  const shape = (d: string): string => d.replace(NUMBER, "#");
  if (from === to || shape(from) !== shape(to)) return null;
  const a = from.match(NUMBER)?.map(Number) ?? [];
  const b = to.match(NUMBER)?.map(Number) ?? [];
  const parts = to.split(NUMBER);
  return (t) =>
    t >= 1
      ? to
      : parts.reduce(
          (d, part, i) =>
            d +
            part +
            (i < b.length
              ? String(+((a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * t).toFixed(2))
              : ""),
          "",
        );
}

export const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Each mark's geometry by key, taken before an update so the new marks can grow from it. */
export function geometry(figure: HTMLElement): Map<string, Record<string, string>> {
  const before = new Map<string, Record<string, string>>();
  for (const mark of figure.querySelectorAll(MARK)) {
    const attrs: Record<string, string> = {};
    for (const name of ANIMATED) {
      const value = shape(mark).getAttribute(name);
      if (value !== null) attrs[name] = value;
    }
    const d = shape(mark).getAttribute("d");
    if (d !== null) attrs["d"] = d;
    before.set(mark.getAttribute("data-enarratio-key") ?? "", attrs);
  }
  return before;
}

/**
 * Animates the figure's marks from their geometry `before` an update to their new one. Marks that
 * share a key tween; new marks fade in.
 */
export function animateFrom(
  figure: HTMLElement,
  before: Map<string, Record<string, string>>,
): void {
  const tweens: { mark: Element; name: string; from: number; to: number }[] = [];
  const paths: { mark: Element; at: (t: number) => string }[] = [];
  for (const mark of figure.querySelectorAll(MARK)) {
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
    const d = el.getAttribute("d");
    const at = old["d"] !== undefined && d !== null ? pathTween(old["d"], d) : null;
    if (at) {
      paths.push({ mark: el, at });
      el.setAttribute("d", at(0));
    }
  }
  const started = performance.now();
  const frame = (now: number): void => {
    const t = Math.min(1, (now - started) / DURATION);
    const eased = 1 - (1 - t) ** 3;
    for (const { mark, name, from, to } of tweens) {
      mark.setAttribute(name, String(from + (to - from) * eased));
    }
    for (const { mark, at } of paths) mark.setAttribute("d", at(eased));
    if (t < 1) requestAnimationFrame(frame);
  };
  if (tweens.length > 0 || paths.length > 0) requestAnimationFrame(frame);
}
