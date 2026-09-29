/**
 * Color measurement: WCAG 2 contrast, color-vision-deficiency simulation and CIEDE2000 color
 * difference. Pure functions over hex strings, so they run the same on a server, in CI and in a
 * browser.
 */

import type { HexColor } from "./types.js";

/** Red, green and blue in the range 0 to 1, gamma-encoded (sRGB) unless a name says linear. */
export type Rgb = readonly [number, number, number];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Whether a string is a hex color Abscissa can measure. */
export function isHexColor(value: string): value is HexColor {
  return HEX.test(value);
}

/** Parses `#rgb` or `#rrggbb` into sRGB channels from 0 to 1. Throws on anything else. */
function parseHex(color: string): Rgb {
  if (!isHexColor(color)) {
    throw new Error(`"${color}" is not a hex color (#rgb or #rrggbb)`);
  }
  const digits =
    color.length === 4
      ? color
          .slice(1)
          .split("")
          .map((d) => d + d)
          .join("")
      : color.slice(1);
  const channel = (i: number): number => Number.parseInt(digits.slice(i, i + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearize(rgb: Rgb): Rgb {
  return [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
}

function fromLinear(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

/** WCAG 2 relative luminance, from 0 (black) to 1 (white). */
function relativeLuminance(color: string): number {
  const [r, g, b] = linearize(parseHex(color));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colors, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The kinds of color vision deficiency Abscissa simulates, each at full severity. */
export type ColorVision = "protanopia" | "deuteranopia" | "tritanopia";

type Matrix = readonly [Rgb, Rgb, Rgb];

/**
 * Machado, Oliveira and Fernandes (2009), "A physiologically-based model for simulation of color
 * vision deficiency", IEEE TVCG 15(6), severity 1.0. Applied to linear RGB.
 */
const CVD_MATRICES: Readonly<Record<ColorVision, Matrix>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** How a color appears under a color vision deficiency, as sRGB channels from 0 to 1. */
export function simulateColorVision(color: string, vision: ColorVision): Rgb {
  const [r, g, b] = linearize(parseHex(color));
  const m = CVD_MATRICES[vision];
  const row = (i: 0 | 1 | 2): number => {
    const [mr, mg, mb] = m[i];
    return fromLinear(mr * r + mg * g + mb * b);
  };
  return [row(0), row(1), row(2)];
}

/** CIE L*a*b* under the D65 white point. */
export type Lab = readonly [number, number, number];

/** Converts sRGB channels (0 to 1) to CIE L*a*b*. */
function rgbToLab(rgb: Rgb): Lab {
  const [r, g, b] = linearize(rgb);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const degrees = (radians: number): number => (radians * 180) / Math.PI;
const radians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * CIEDE2000 color difference (Sharma, Wu and Dalal 2005). About 1 is a just-noticeable
 * difference; categorical palettes want well over 10 between any two colors.
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number): number => {
    if (a === 0 && b === 0) return 0;
    const h = degrees(Math.atan2(b, a));
    return h >= 0 ? h : h + 360;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);

  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(radians(dhp / 2));

  const lBarP = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hBarP = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hBarP = (h1p + h2p + 360) / 2;
    else hBarP = (h1p + h2p - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos(radians(hBarP - 30)) +
    0.24 * Math.cos(radians(2 * hBarP)) +
    0.32 * Math.cos(radians(3 * hBarP + 6)) -
    0.2 * Math.cos(radians(4 * hBarP - 63));
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const cBarP7 = cBarP ** 7;
  const rC = 2 * Math.sqrt(cBarP7 / (cBarP7 + 25 ** 7));
  const sL = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;
  const rT = -Math.sin(radians(2 * dTheta)) * rC;
  const lTerm = dLp / sL;
  const cTerm = dCp / sC;
  const hTerm = dHp / sH;
  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rT * cTerm * hTerm);
}

/**
 * The perceived difference between two colors as seen with typical vision or a simulated color
 * vision deficiency, in CIEDE2000 units.
 */
export function colorDifference(a: string, b: string, vision?: ColorVision): number {
  const see = (c: string): Rgb => (vision ? simulateColorVision(c, vision) : parseHex(c));
  return deltaE2000(rgbToLab(see(a)), rgbToLab(see(b)));
}

/**
 * The color for text printed on a mark: the scheme's text or background color when either reaches
 * 4.5:1 on the mark (the better of the two), otherwise black or white, one of which always does
 * (F8).
 */
export function labelColor(fill: string, text: HexColor, background: HexColor): HexColor {
  const best = (a: HexColor, b: HexColor): HexColor =>
    contrastRatio(fill, a) >= contrastRatio(fill, b) ? a : b;
  const themed = best(text, background);
  return contrastRatio(fill, themed) >= 4.5 ? themed : best("#000000", "#ffffff");
}
