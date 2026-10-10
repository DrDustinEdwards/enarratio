/**
 * Merges the StrykerJS chunk reports (stryker.config.mjs) into one baseline: the mutation score
 * overall and per file, and a per-test kill matrix with removal candidates. Measures only; it
 * changes no test.
 *
 *   node scripts/report-mutation.mjs [reports/mutation] [--json docs/research/kill-matrix.json]
 *
 * A test is a removal candidate when it kills no mutant (zero-kill) or when every mutant it kills
 * is also killed by another test (covered by others). Candidates are per test, not joint: two tests
 * that only cover each other are both flagged. Protected tests are never candidates; see PROTECT.
 * covers counts the mutants a test executes. A zero-kill test that covers nothing either never
 * reaches src or does its work outside the test (describe-scope setup, a module an earlier test
 * imported), where per-test coverage cannot see it; it is unmeasured, not shown useless.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
const dir = resolve(
  args.find((a, i) => !a.startsWith("--") && i !== jsonAt + 1) ?? "reports/mutation",
);

/**
 * Keep rules, matched against the test file and name. Escaping and hostile input (the package
 * renders untrusted text into HTML), accessibility, and tests written for a fixed finding (an id
 * such as A15 or F20 in the name). A name heuristic that errs toward keeping.
 */
const PROTECT = [
  /hostile/i,
  /escap/i,
  /inject/i,
  /xss/i,
  /sanitiz/i,
  /unsafe/i,
  /\ba11y\b|accessib|aria|screen reader|axe/i,
  /\b[A-Z]{1,2}\d{1,3}\b/,
  /regression|\bbug\b|\bfix(es|ed)?\b/i,
];

/** Tests that pin exact rendered output (stored HTML files or images): design-pinning. */
const PINNING = [/stored markup|stored images?|snapshot/i];

const chunks = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes(".incremental"));
const files = {};
const tests = new Map();
const keyOf = new Map();

for (const chunk of chunks) {
  const report = JSON.parse(readFileSync(resolve(dir, chunk), "utf8"));
  const ids = new Map();
  for (const [file, { tests: list }] of Object.entries(report.testFiles ?? {})) {
    for (const t of list) {
      const key = `${file}#${t.name}`;
      ids.set(t.id, key);
      if (!tests.has(key)) tests.set(key, { file, name: t.name, kills: new Set(), covers: 0 });
    }
  }
  for (const [file, { mutants }] of Object.entries(report.files)) {
    files[file] ??= { killed: 0, timeout: 0, survived: 0, noCoverage: 0, ignored: 0, other: 0 };
    const row = files[file];
    for (const m of mutants) {
      const status = m.status;
      if (status === "Killed") row.killed++;
      else if (status === "Timeout") row.timeout++;
      else if (status === "Survived") row.survived++;
      else if (status === "NoCoverage") row.noCoverage++;
      else if (status === "Ignored") row.ignored++;
      else row.other++;
      for (const id of m.coveredBy ?? []) {
        const key = ids.get(id);
        if (key) tests.get(key).covers++;
      }
      if (status !== "Killed") continue;
      const mutantKey = `${file}:${m.id}`;
      for (const id of m.killedBy ?? []) {
        const key = ids.get(id);
        if (key) tests.get(key).kills.add(mutantKey);
        keyOf.set(mutantKey, (keyOf.get(mutantKey) ?? 0) + 1);
      }
    }
  }
}

const score = (r) => {
  const valid = r.killed + r.timeout + r.survived + r.noCoverage;
  return {
    valid,
    detected: r.killed + r.timeout,
    pct: valid ? (100 * (r.killed + r.timeout)) / valid : 0,
  };
};

const total = { killed: 0, timeout: 0, survived: 0, noCoverage: 0, ignored: 0, other: 0 };
for (const r of Object.values(files)) for (const k of Object.keys(total)) total[k] += r[k];

const matrix = [...tests.values()]
  .map((t) => {
    const unique = [...t.kills].filter((m) => keyOf.get(m) === 1).length;
    const text = `${t.file} ${t.name}`;
    const isProtected = PROTECT.some((p) => p.test(text));
    const pinning = PINNING.some((p) => p.test(text));
    const kind = t.kills.size === 0 ? "zero-kill" : unique === 0 ? "covered-by-others" : null;
    return {
      file: t.file,
      name: t.name,
      covers: t.covers,
      kills: t.kills.size,
      uniqueKills: unique,
      candidate: kind,
      protected: isProtected,
      designPinning: pinning,
    };
  })
  .sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));

const overall = score(total);
const summary = {
  chunks: chunks.map((c) => c.replace(/\.json$/, "")).sort(),
  mutants: total,
  score: Number(overall.pct.toFixed(2)),
  scoreCovered: Number(
    ((100 * overall.detected) / (overall.valid - total.noCoverage || 1)).toFixed(2),
  ),
  files: Object.fromEntries(
    Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, r]) => [
        f,
        { ...r, score: score(r).valid ? Number(score(r).pct.toFixed(2)) : null },
      ]),
  ),
  tests: matrix,
};

console.log(`Chunks: ${summary.chunks.join(", ")}`);
console.log(
  `Killed ${total.killed}, timeout ${total.timeout}, survived ${total.survived}, no coverage ${total.noCoverage}, ignored ${total.ignored}, other ${total.other}`,
);
console.log(
  `Score ${summary.score}% (${overall.detected} of ${overall.valid}); covered ${summary.scoreCovered}%`,
);
console.log(
  "\n| File | Killed | Timeout | Survived | No coverage | Score |\n|---|---|---|---|---|---|",
);
for (const [f, r] of Object.entries(summary.files)) {
  console.log(
    `| ${f} | ${r.killed} | ${r.timeout} | ${r.survived} | ${r.noCoverage} | ${r.score === null ? "n/a" : `${r.score}%`} |`,
  );
}
const count = (fn) => matrix.filter(fn).length;
console.log(`\nTests in matrix: ${matrix.length}`);
console.log(
  `Zero-kill: ${count((t) => t.candidate === "zero-kill")} (protected ${count((t) => t.candidate === "zero-kill" && t.protected)})`,
);
console.log(
  `Covered by others: ${count((t) => t.candidate === "covered-by-others")} (protected ${count((t) => t.candidate === "covered-by-others" && t.protected)})`,
);
console.log(
  `Zero-kill covering no mutant: ${count((t) => t.candidate === "zero-kill" && t.covers === 0)}`,
);
console.log(`Design-pinning: ${count((t) => t.designPinning)}`);

if (jsonOut) writeFileSync(resolve(jsonOut), `${JSON.stringify(summary, null, 2)}\n`);
