/**
 * The space left between neighbouring ticks of a strip, in CSS pixels, from the width each
 * tick has. A tick of 3px or more keeps a 1px gap and one of 2px a half-pixel gap, so a
 * strip of many narrow periods still reads as separate periods instead of one solid bar;
 * narrower ticks touch, since a gap would leave nothing of the tick to see.
 */
export function tickGap(step: number): number {
  if (step >= 3) return 1;
  if (step >= 2) return 0.5;
  return 0;
}
