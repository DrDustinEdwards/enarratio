import { describe, expect, it } from "vitest";
import { progressRing, uptimeStrip } from "../src/index.js";
import { parse } from "./helpers.js";

describe("progressRing", () => {
  it("states label, value and total, and fills the matching arc", () => {
    const svg = parse(
      progressRing({ inline: true, value: 3, max: 4, label: "Chapters", size: 40, thickness: 4 }),
    );
    expect(svg.getAttribute("aria-label")).toBe("Chapters: 3 of 4 (75%)");
    const arc = svg.querySelectorAll("circle")[1];
    const circumference = 2 * Math.PI * 18;
    expect(arc?.getAttribute("stroke-dasharray")).toBe(
      `${Math.round(circumference * 0.75 * 100) / 100} ${Math.round(circumference * 100) / 100}`,
    );
    expect(svg.querySelector("text")?.textContent).toBe("75%");
  });

  it("uses a percentage for fractions, says when a value passes the total, and draws no arc at zero (A7)", () => {
    expect(
      parse(progressRing({ inline: true, value: 0.5, label: "Done" })).getAttribute("aria-label"),
    ).toBe("Done: 50%");
    expect(
      parse(progressRing({ inline: true, value: 2, label: "Done" })).querySelector("text")
        ?.textContent,
    ).toBe("200%");
    expect(
      parse(progressRing({ inline: true, value: 3, max: 2, label: "Done" })).getAttribute(
        "aria-label",
      ),
    ).toBe("Done: 3 of 2 (150%, more than the total)");
    expect(
      parse(progressRing({ inline: true, value: 0, label: "Done" })).querySelectorAll("circle"),
    ).toHaveLength(1);
  });

  it("hides the number on small rings unless asked", () => {
    expect(
      parse(progressRing({ inline: true, value: 0.5, label: "Done", size: 20 })).querySelector(
        "text",
      ),
    ).toBeNull();
  });

  it("refuses bad values", () => {
    expect(() => progressRing({ inline: true, value: -1, label: "x" })).toThrow(/zero or more/);
    expect(() => progressRing({ inline: true, value: 1, max: 0, label: "x" })).toThrow(
      /above zero/,
    );
    expect(() => progressRing({ inline: true, value: 1, label: " " })).toThrow(
      /label or alt is required/,
    );
    // F15: sizes must be real numbers.
    expect(() => progressRing({ inline: true, value: 1, label: "x", size: Number.NaN })).toThrow(
      /size/,
    );
    expect(() =>
      progressRing({ inline: true, value: 1, label: "x", size: 10, thickness: 10 }),
    ).toThrow(/thickness/);
  });
});

describe("uptimeStrip", () => {
  it("summarizes counts and availability, ignoring unmeasured periods", () => {
    const svg = parse(
      uptimeStrip({
        inline: true,
        slots: ["up", "up", "degraded", "down", "unknown"],
        label: "API, last 5 hours",
      }),
    );
    expect(svg.getAttribute("aria-label")).toBe(
      "API, last 5 hours: 5 periods, 2 up, 1 degraded, 1 down, 1 no data; 75% available.",
    );
  });

  it("encodes status by height as well as color", () => {
    const svg = parse(
      uptimeStrip({ inline: true, slots: ["up", "degraded", "down"], label: "x", height: 30 }),
    );
    expect([...svg.querySelectorAll("rect")].map((r) => r.getAttribute("height"))).toEqual([
      "30",
      "19.8",
      "9.9",
    ]);
  });

  it("keeps a gap between narrow ticks, so many periods do not merge into one bar", () => {
    const widths = (slots: number, width: number) =>
      [
        ...parse(
          uptimeStrip({ inline: true, slots: Array(slots).fill("up"), label: "x", width }),
        ).querySelectorAll("rect"),
      ].map((r) => r.getAttribute("width"));
    // 84 two-hour periods in 336px: 4px a tick, 1px of it gap (enarratio 0.3.0 left none).
    expect(new Set(widths(84, 336))).toEqual(new Set(["3"]));
    expect(new Set(widths(100, 250))).toEqual(new Set(["2"]));
    expect(new Set(widths(100, 150))).toEqual(new Set(["1.5"]));
  });

  it("uses per-slot labels in hover details", () => {
    const svg = parse(
      uptimeStrip({ inline: true, slots: [{ status: "down", label: "Mon 14:00" }], label: "x" }),
    );
    expect(svg.querySelector("rect title")?.textContent).toBe("Mon 14:00: down");
  });

  it("refuses empty strips and unknown states", () => {
    expect(() => uptimeStrip({ inline: true, slots: [], label: "x" })).toThrow(/at least one/);
    expect(() => uptimeStrip({ inline: true, slots: ["sideways" as never], label: "x" })).toThrow(
      /unknown status/,
    );
  });
});
