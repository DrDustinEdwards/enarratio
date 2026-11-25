/** The tooltip card: shown beside the picked marks, hidden after a short delay. */

import { fillCard } from "./pointer.js";
import type { Chart } from "./chart.js";

/** How long the tooltip waits for the pointer to reach it before hiding (WCAG 1.4.13). */
const HIDE_DELAY_MS = 300;
/** The tooltip's gap from its mark and from the viewport edge, in CSS pixels. */
const TIP_GAP = 8;

export function showChartTip(c: Chart, marks: readonly SVGGraphicsElement[]): void {
  const tip = c.tooltip;
  if (!tip || marks.length === 0) return;
  clearTimeout(c.hideTimer);
  fillCard(tip, c.figure, marks, c.texts);
  tip.hidden = false;
  const boxes = marks.map((m) => m.getBoundingClientRect());
  const box = {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
  const tipBox = tip.getBoundingClientRect();
  const page = document.documentElement.clientWidth;
  let left: number;
  let top: number;
  if (marks.length > 1) {
    // A column: beside it and past the pointer, right where it fits, else left, so the card never covers what is read.
    const px = c.pointerX;
    left = Math.max(box.right, px ?? box.right) + TIP_GAP;
    if (left + tipBox.width > page - TIP_GAP) {
      left = Math.min(box.left, px ?? box.left) - tipBox.width - TIP_GAP;
    }
    top = Math.max(TIP_GAP, box.top);
  } else {
    left = box.left + (box.right - box.left) / 2 - tipBox.width / 2;
    const above = box.top - tipBox.height - TIP_GAP;
    top = above > 0 ? above : box.bottom + TIP_GAP;
  }
  left = Math.min(Math.max(TIP_GAP, left), page - tipBox.width - TIP_GAP);
  tip.style.left = `${left + scrollX}px`;
  tip.style.top = `${top + scrollY}px`;
}

export function hideChartTip(c: Chart): void {
  clearTimeout(c.hideTimer);
  if (c.tooltip) c.tooltip.hidden = true;
}

/** Hides the tooltip shortly, unless the pointer reaches it first. */
export function scheduleHide(c: Chart): void {
  clearTimeout(c.hideTimer);
  c.hideTimer = setTimeout(() => hideChartTip(c), HIDE_DELAY_MS);
}
