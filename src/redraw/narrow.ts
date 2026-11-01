/**
 * `enarratio/redraw/narrow`: a chart that follows its frame's width with drawings the server made,
 * without the light renderers `enarratio/redraw` brings for drawing at any width. Under 30rem the
 * frame shows the server's narrow drawing, so a phone keeps 12 px text instead of a wide drawing
 * that scrolls (C12); each drawing is enhanced. `enarratio/redraw` is built on it.
 */

import { enhance } from "../enhance/index.js";
import type { EnhancedChart, EnhanceOptions } from "../enhance/types.js";

/** The attribute that carries a chart's spec on the element around its figure. */
export const REDRAW_ATTRIBUTE = "data-enarratio-redraw";

/** A chart that follows its frame's width; `destroy` stops it and its enhancement. */
export interface RedrawnChart {
  readonly host: HTMLElement;
  destroy(): void;
}

/** The frame markup for a width, and a key that is the same when the drawing would be. */
export type Drawing = (width: number, original: string) => { markup: string; key: string };

/** Under this many rems a wide frame scrolls (A13), so a narrow drawing is used. */
const WIDE_REM = 30;

const started = new WeakSet<Element>();

/** Whether `host`'s chart has started following its width. */
export const isStarted = (host: Element): boolean => started.has(host);

/**
 * Enhances the chart in `host` and swaps its drawing whenever its width changes, by `drawing`:
 * the markup of an `.enarratio-frame` for the width, and a key that names it.
 */
export function followWidth(
  host: HTMLElement,
  drawing: Drawing,
  options: EnhanceOptions = {},
): RedrawnChart {
  started.add(host);
  const original = host.querySelector(".enarratio-frame")?.outerHTML ?? "";
  let charts: EnhancedChart[] = enhance(host, options);
  let drawn = "original";
  let pending: number | undefined;

  const redraw = (): void => {
    pending = undefined;
    const frame = host.querySelector(".enarratio-frame");
    const box = frame?.parentElement;
    if (!frame || !box || !original) return;
    const { markup, key } = drawing(Math.floor(box.clientWidth), original);
    if (key === drawn) return;
    const next = new DOMParser()
      .parseFromString(markup, "text/html")
      .body.querySelector(".enarratio-frame");
    if (!next) return;
    for (const chart of charts) chart.destroy();
    frame.replaceWith(document.adoptNode(next));
    drawn = key;
    charts = enhance(host, options);
  };
  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          if (pending === undefined) pending = requestAnimationFrame(redraw);
        });
  observer?.observe(host);
  redraw();

  return {
    host,
    destroy() {
      observer?.disconnect();
      if (pending !== undefined) cancelAnimationFrame(pending);
      for (const chart of charts) chart.destroy();
      started.delete(host);
    },
  };
}

/**
 * Enhances the chart in `host` and shows `narrow`, the server's narrow drawing (an
 * `.enarratio-frame`), while the frame is under 30rem, and the original drawing above that.
 */
export function narrowChart(
  host: HTMLElement,
  narrow: string,
  options: EnhanceOptions = {},
): RedrawnChart {
  return followWidth(
    host,
    (width, original) => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return width < WIDE_REM * rem
        ? { markup: narrow, key: "narrow" }
        : { markup: original, key: "original" };
    },
    options,
  );
}
