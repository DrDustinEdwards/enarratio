/**
 * The generated words and numbers: the summary computed from data, locale formats, CSV escaping
 * and the reading grade the summaries are held to. Tricky logic, tested where it lives.
 */
import { describe, expect, it } from "vitest";
import {
  dateFormat,
  heatStrip,
  numberFormat,
  readingGrade,
  sparkline,
  toCsv,
} from "../src/index.js";
import { barChart, lineChart } from "../src/plot/index.js";
import { outliers, summarize } from "../src/render/describe.js";
import { ENGLISH } from "../src/render/text.js";
import { parse } from "./helpers.js";

const series = (name: string, values: (number | null)[]) => ({
  name,
  points: values.map((value, i) => ({ at: String(2020 + i), value })),
});

describe("summarize", () => {
  it("states a trend, and a peak that passes both ends", () => {
    expect(summarize({ ordered: true, series: [series("Cases", [10, 12, 14])] }, ENGLISH)).toBe(
      "Cases rose from 10 (2020) to 14 (2022). The highest value is 14 (2022). The lowest is 10 (2020).",
    );
    expect(summarize({ ordered: true, series: [series("Cases", [10, 40, 11])] }, ENGLISH)).toMatch(
      /^Cases rose from 10 \(2020\) to a peak of 40 \(2021\), then fell to 11 \(2022\)\./,
    );
    expect(
      summarize({ ordered: true, series: [series("Cases", [10, 10.2, null, 10.3])] }, ENGLISH),
    ).toMatch(/^Cases stayed near 10 from 2020 to 2023\./);
  });

  it("names values far from the rest, judged on a log scale when the axis is one", () => {
    const values = [1, 2, 2, 3, 3, 3, 4, 50];
    expect(outliers(values.map((value) => ({ value }))).map((p) => p.value)).toEqual([50]);
    expect(
      outliers(
        [1, 10, 100, 1000, 10000].map((value) => ({ value })),
        Math.log10,
      ),
    ).toEqual([]);
    expect(summarize({ series: [series("Titer", values)] }, ENGLISH)).toContain(
      "One value stands out: 50 (2027).",
    );
  });

  it("states the interval drawn, and stays at grade 9 or below", () => {
    const text = summarize(
      {
        ordered: true,
        interval: "95% interval",
        series: [
          {
            name: "Visits",
            points: [
              { at: "March 1, 2026", value: 10, lower: null, upper: null },
              { at: "March 2, 2026", value: 30, lower: 21, upper: 42 },
            ],
          },
        ],
      },
      ENGLISH,
    );
    expect(text).toContain("The 95% interval for March 2, 2026 is 21 to 42.");
    expect(readingGrade(text)).toBeLessThanOrEqual(9);
    expect(readingGrade("The cat sat on the mat.")).toBeLessThan(3);
    expect(
      readingGrade(
        "Notwithstanding considerable methodological heterogeneity, the investigators characterized substantial longitudinal variability.",
      ),
    ).toBeGreaterThan(9);
  });
});

describe("locale formats", () => {
  it("formats numbers by locale and style", () => {
    expect(numberFormat({ locale: "de-DE" })(1234.5)).toBe("1.234,5");
    expect(numberFormat({ locale: "de-DE", style: "currency", currency: "EUR" })(1234.5)).toBe(
      "1.234,50\u00a0€",
    );
    expect(numberFormat({ style: "percent" })(0.256)).toBe("25.6%");
    expect(numberFormat({ style: "compact" })(1234)).toBe("1.2K");
    expect(numberFormat({ style: "si", unit: "B" })(1_500_000)).toBe("1.5 MB");
    expect(numberFormat({ style: "si", unit: "g" })(0.0025)).toBe("2.5 mg");
    expect(numberFormat({ style: "si" })(0)).toBe("0");
    expect(() => numberFormat({ style: "currency" })).toThrow(/needs a currency/);
  });

  it("writes dates out, naming the time zone with a time", () => {
    const d = new Date(Date.UTC(2026, 0, 5, 14, 30));
    expect(dateFormat()(d)).toBe("January 5, 2026");
    expect(dateFormat({ locale: "de-DE" })(d)).toBe("5. Januar 2026");
    expect(dateFormat({ time: true })(d)).toBe("January 5, 2026 at 2:30 PM UTC");
    expect(dateFormat({ time: true, timeZone: "America/Chicago" })(d)).toBe(
      "January 5, 2026 at 8:30 AM CST",
    );
  });

  it("carries the locale and translated strings through a chart", () => {
    const fig = parse(
      lineChart({
        data: [
          { t: "2026-01-05", v: 1234.5 },
          { t: "2026-01-06", v: 2000 },
        ],
        x: "t",
        y: "v",
        alt: "a",
        title: "t",
        locale: "de-DE",
        strings: { showData: "Daten zeigen", downloadCsv: "CSV herunterladen" },
      }),
    );
    expect([...fig.querySelectorAll("tbody tr")].map((tr) => tr.textContent)).toEqual([
      "5. Januar 20261.234,5",
      "6. Januar 20262.000",
    ]);
    expect(fig.querySelector(".enarratio-show")?.textContent).toBe("Daten zeigen");
    expect(fig.querySelector(".enarratio-csv")?.textContent).toBe("CSV herunterladen");
    // Filter events keep the ISO date, whatever the reader sees.
    expect(fig.querySelector("[data-enarratio-x]")?.getAttribute("data-enarratio-x")).toBe(
      "2026-01-05",
    );
  });

  it("translates the hover details a primitive builds", () => {
    const fig = parse(
      heatStrip({
        values: [1234.5, null],
        label: "Last",
        locale: "de-DE",
        strings: { terms: { cell: "Zelle", noData: "keine Daten" } },
      }),
    );
    expect([...fig.querySelectorAll("rect title")].map((t) => t.textContent)).toEqual([
      "Zelle 1: 1.234,5",
      "Zelle 2: keine Daten",
    ]);
  });
});

describe("CSV", () => {
  it("quotes what needs quoting and defuses formulas, keeping negative numbers", () => {
    expect(toCsv([["a,b", 'say "hi"', "two\nlines", "-3.5", "+1", "=SUM(A1)", "-x", "@me"]])).toBe(
      `"a,b","say ""hi""","two\nlines",-3.5,+1,'=SUM(A1),'-x,'@me`,
    );
  });

  it("links the table as a download, or reports one too large to inline", () => {
    const fig = parse(barChart({ data: [{ k: "a", v: 1 }], x: "k", y: "v", alt: "a", title: "T" }));
    const href = fig.querySelector(".enarratio-csv")?.getAttribute("href") ?? "";
    expect(decodeURIComponent(href.replace("data:text/csv;charset=utf-8,", ""))).toBe("﻿k,v\r\na,1");
    const data = Array.from({ length: 6000 }, (_, i) => ({ k: `category ${i}`, v: i }));
    const codes: string[] = [];
    const big = parse(
      barChart({ data, x: "k", y: "v", alt: "a", title: "T", onIssue: (i) => codes.push(i.code) }),
    );
    expect(codes).toEqual(["too-many-points", "csv-too-large"]);
    expect(big.querySelector(".enarratio-csv")).toBeNull();
    const served = parse(
      barChart({
        data,
        x: "k",
        y: "v",
        alt: "a",
        title: "T",
        csvHref: "/data/t.csv",
        onIssue() {},
      }),
    );
    expect(served.querySelector(".enarratio-csv")?.getAttribute("href")).toBe("/data/t.csv");
  });
});

describe("primitive figures", () => {
  it("are whole figures by default, and bare drawings inline", () => {
    const options = { values: [3, 5, 4, 8], label: "Entries per year" };
    const fig = parse(sparkline(options));
    expect(fig.tagName.toLowerCase()).toBe("figure");
    expect(fig.hasAttribute("data-enarratio-static")).toBe(true);
    expect(fig.querySelector(".enarratio-title")?.textContent).toBe("Entries per year");
    expect(fig.querySelector("figcaption")).not.toBeNull();
    expect(fig.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(fig.querySelector(".enarratio-frame")?.hasAttribute("tabindex")).toBe(false);
    expect(parse(sparkline({ ...options, inline: true })).tagName.toLowerCase()).toBe("svg");
  });
});
