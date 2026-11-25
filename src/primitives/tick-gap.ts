/**
 * The space between neighboring ticks of a strip, in CSS pixels, from the width each tick has: a tick of
 * 3px or more keeps a 1px gap and one of 2px a half-pixel gap, so many narrow periods still read as
 * separate; narrower ticks touch, since a gap would leave nothing to see.
 */
export function tickGap(step: number): number {
  if (step >= 3) return 1;
  if (step >= 2) return 0.5;
  return 0;
}
