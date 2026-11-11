// Each group's distribution as a mirrored density, with its quartiles and median inside.
import { violinPlot } from "enarratio/plot";

// Time to result, in hours, for three test types: a fixed pseudo-random sample for each.
const draw = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};
const normal = (rand: () => number) => () =>
  Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const tests = [
  // Rapid antigen tests: nearly all back within a few hours.
  { test: "Rapid antigen", n: 60, at: (z: () => number) => 2 + Math.abs(z()) * 1.2 },
  // PCR: two waves, same-day runs and next-morning runs.
  {
    test: "PCR",
    n: 80,
    at: (z: () => number, r: () => number) => (r() < 0.55 ? 8 + z() * 2 : 20 + z() * 2.5),
  },
  // Culture: slow and spread out.
  { test: "Culture", n: 50, at: (z: () => number) => 46 + z() * 9 },
];
const rows = tests.flatMap((t, k) => {
  const rand = draw(17 + k * 101);
  const z = normal(rand);
  return Array.from({ length: t.n }, () => ({
    test: t.test,
    hours: Math.round(Math.max(0.5, t.at(z, rand)) * 10) / 10,
  }));
});

export default violinPlot({
  data: rows,
  x: "test",
  y: "hours",
  yLabel: "Hours to result",
  colorByGroup: true,
  title: "How long results take, by test",
  alt: "Violin plot of hours to result for three tests: rapid antigen results cluster at 2 to 4 hours, PCR results come in two waves around 8 and 20 hours, and culture results spread from about 30 to 65 hours, centered near 46.",
  caption: "Illustrative data.",
});
