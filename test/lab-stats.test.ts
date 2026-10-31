/**
 * The statistics behind the new charts that are easy to get subtly wrong: the 4PL fit, the
 * Kaplan-Meier estimator, the Newick parser and histogram binning. Checked against published
 * values where they exist.
 */
import { describe, expect, it } from "vitest";
import { histogramBins } from "../src/render/distribution.js";
import { kaplanMeier } from "../src/science/kaplan-meier.js";
import { fitLogistic, logistic } from "../src/science/logistic.js";
import { parseNewick } from "../src/science/newick.js";

describe("fitLogistic", () => {
  it("matches R drc's LL.4 fit of the ryegrass data", () => {
    // Inderjit et al. (2002), as shipped with drc; drm(rootl ~ conc, fct = LL.4()) gives
    // b 2.98222, c 0.48141, d 7.79296, e 3.05795 (drc's b is minus the Hill slope).
    const conc = [0, 0, 0, 0, 0, 0, 0.94, 0.94, 0.94, 1.88, 1.88, 1.88];
    conc.push(3.75, 3.75, 3.75, 7.5, 7.5, 7.5, 15, 15, 15, 30, 30, 30);
    const rootl = [7.58, 8, 8.328571, 7.25, 7.375, 7.9625, 8.355556, 6.914286, 7.75];
    rootl.push(6.871429, 6.45, 5.922222, 1.925, 2.885714, 4.233333, 1.1875, 0.8571429);
    rootl.push(1.057143, 0.6875, 0.525, 0.825, 0.25, 0.22, 0.44);
    const fit = fitLogistic(conc, rootl);
    expect(fit.hill).toBeCloseTo(-2.98222, 4);
    expect(fit.bottom).toBeCloseTo(0.48141, 4);
    expect(fit.top).toBeCloseTo(7.79296, 4);
    expect(fit.ec50).toBeCloseTo(3.05795, 4);
    // The interval surrounds the estimate and is about ±12% wide (drc's SE of e is 0.186).
    expect(fit.ec50Lower).toBeGreaterThan(2.6);
    expect(fit.ec50Upper).toBeLessThan(3.6);
  });

  it("recovers a rising curve from exact points, and refuses too few doses", () => {
    const truth = { bottom: 5, top: 95, ec50: 0.3, hill: 1.4 };
    const doses = [0.001, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 100];
    const fit = fitLogistic(
      doses,
      doses.map((d) => logistic(truth, d)),
    );
    expect(fit.ec50).toBeCloseTo(0.3, 6);
    expect(fit.hill).toBeCloseTo(1.4, 6);
    expect(fit.rss).toBeLessThan(1e-12);
    expect(() => fitLogistic([1, 2, 3], [1, 2, 3])).toThrow(/four distinct/);
  });
});

describe("kaplanMeier", () => {
  // The 6-MP arm of Freireich et al. (1963), as in Gehan (1965) and most survival textbooks.
  const weeks = [6, 6, 6, 6, 7, 9, 10, 10, 11, 13, 16, 17, 19, 20, 22, 23, 25, 32, 32, 34, 35];
  const censored = new Set([3, 5, 7, 8, 11, 12, 13, 16, 17, 18, 19, 20]);
  const events = weeks.map((_, i) => !censored.has(i));

  it("matches the published estimates, Greenwood errors and log-log intervals", () => {
    const km = kaplanMeier(weeks, events);
    const at = (t: number) => km.steps.find((s) => s.time === t);
    // Time: survival, standard error, lower, upper (R: survfit(..., conf.type = "log-log")).
    const expected: [number, number, number, number, number][] = [
      [6, 0.857, 0.0764, 0.62, 0.952],
      [7, 0.807, 0.0869, 0.563, 0.923],
      [10, 0.753, 0.0963, 0.503, 0.889],
      [13, 0.69, 0.1068, 0.432, 0.849],
      [16, 0.627, 0.1141, 0.368, 0.805],
      [22, 0.538, 0.1282, 0.268, 0.747],
      [23, 0.448, 0.1346, 0.188, 0.68],
    ];
    expect(km.steps.map((s) => s.time)).toEqual(expected.map((e) => e[0]));
    for (const [t, s, se, lo, hi] of expected) {
      const step = at(t);
      expect(step?.survival).toBeCloseTo(s, 3);
      expect(step?.standardError).toBeCloseTo(se, 3);
      expect(step?.lower).toBeCloseTo(lo, 2);
      expect(step?.upper).toBeCloseTo(hi, 2);
    }
    // At a tie of events and censoring (week 6), the censored subject is still at risk.
    expect(at(6)?.atRisk).toBe(21);
    expect(at(6)?.censored).toBe(1);
    expect(at(7)?.atRisk).toBe(17);
    expect(km.median).toBe(23);
    expect(km.censorTimes).toHaveLength(12);
  });

  it("has no median when survival never falls to half", () => {
    expect(kaplanMeier([1, 2, 3], [true, false, false]).median).toBeUndefined();
  });
});

describe("parseNewick", () => {
  it("reads lengths, internal labels, quoted names and comments", () => {
    const tree = parseNewick(
      "(('Homo sapiens':0.1,Pan_troglodytes:1e-1)95:0.05[&rate=1], 'it''s':.3 ,(C,D)E);",
    );
    expect(tree.children).toHaveLength(3);
    const [apes, quoted, pair] = tree.children;
    expect(apes?.name).toBe("95");
    expect(apes?.length).toBe(0.05);
    expect(apes?.children.map((c) => [c.name, c.length])).toEqual([
      ["Homo sapiens", 0.1],
      ["Pan troglodytes", 0.1],
    ]);
    expect(quoted).toEqual({ name: "it's", length: 0.3, children: [] });
    expect(pair?.name).toBe("E");
    expect(pair?.children.map((c) => c.name)).toEqual(["C", "D"]);
  });

  it("names the character where the text stops being Newick", () => {
    expect(() => parseNewick("(A,B")).toThrow(/at character 5/);
    expect(() => parseNewick("(A:x,B);")).toThrow(/branch length at character 4/);
    expect(() => parseNewick("(A,B);C")).toThrow(/unexpected "C"/);
  });
});

describe("histogramBins", () => {
  it("makes round edges by Sturges' rule and counts the maximum in the last bin", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = histogramBins(values);
    // ceil(log2 11) + 1 = 5 bins wanted; round steps of 2 from 0 to 10.
    expect(bins.map((b) => [b.x0, b.x1])).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
      [8, 10],
    ]);
    expect(bins.map((b) => b.count)).toEqual([2, 2, 2, 2, 3]);
  });

  it("keeps decimal edges exact and takes given edges as they are", () => {
    const decimal = histogramBins([0.1, 0.25, 0.3, 0.42, 0.7], 5);
    expect(decimal.map((b) => b.x0)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(decimal.reduce((n, b) => n + b.count, 0)).toBe(5);
    expect(histogramBins([1, 5, 9], [0, 4, 10]).map((b) => b.count)).toEqual([1, 2]);
    expect(() => histogramBins([1, 11], [0, 4, 10])).toThrow(/leave out/);
    expect(histogramBins([3, 3, 3])).toEqual([{ x0: 2.5, x1: 3.5, count: 3 }]);
  });
});
