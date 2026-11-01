/**
 * The maps (record 0028): each is checked against the data it was given, so what is drawn, hovered
 * and listed agree, and bad GeoJSON fails naming the feature.
 */
import { describe, expect, it } from "vitest";
import { choroplethMap, dotMap } from "../src/map/index.js";
import { parse } from "./helpers.js";

const square = (name: string, west: number, south: number) => ({
  type: "Feature",
  properties: { name },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [west + 0.01, south],
        [west + 0.01, south + 0.01],
        [west, south + 0.01],
        [west, south],
      ],
    ],
  },
});
const districts = {
  type: "FeatureCollection",
  features: [
    square("North", -0.14, 51.52),
    square("East", -0.13, 51.51),
    square("South", -0.14, 51.5),
    square("West", -0.15, 51.51),
  ],
};
const streets = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Sample Street" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-0.15, 51.515],
          [-0.12, 51.515],
        ],
      },
    },
  ],
};

describe("dotMap", () => {
  const cases = [
    { address: "1 Sample Street", lon: -0.14, lat: 51.515, deaths: 4 },
    { address: "9 Sample Street", lon: -0.13, lat: 51.516, deaths: 1 },
    { address: "2 Example Lane", lon: -0.135, lat: 51.52, deaths: 0 },
  ];
  const root = parse(
    dotMap({
      data: cases,
      longitude: "lon",
      latitude: "lat",
      value: "deaths",
      label: "address",
      basemap: [{ geometry: streets, labels: "name" }],
      landmarks: [
        { name: "Pump A", longitude: -0.137, latitude: 51.514, highlight: true },
        { name: "Pump B", longitude: -0.145, latitude: 51.518 },
      ],
      landmarkLabel: "Water pump",
      alt: "Deaths by address near the sample pumps.",
    }),
  );

  it("draws one keyed dot per row, sized by area, and a zero as a ring", () => {
    const dots = [...root.querySelectorAll('[data-enarratio-mark="dot"] circle')];
    expect(dots).toHaveLength(3);
    const r = (name: string) =>
      Number(
        dots
          .find((d) => d.querySelector("title")?.textContent?.startsWith(name))
          ?.getAttribute("r"),
      );
    expect(r("1 Sample Street") / r("9 Sample Street")).toBeCloseTo(2, 5);
    const zero = dots.find((d) => d.querySelector("title")?.textContent?.startsWith("2 Example"));
    expect(zero?.getAttribute("fill")).toBe("none");
  });

  it("walks the dots north to south", () => {
    const col = (name: string) =>
      [...root.querySelectorAll("[data-enarratio-key]")]
        .find((d) => d.querySelector("title")?.textContent?.startsWith(name))
        ?.getAttribute("data-enarratio-col");
    expect(Number(col("2 Example Lane"))).toBeLessThan(Number(col("1 Sample Street")));
  });

  it("lists every point and landmark in the table, and names the highlighted one", () => {
    const rows = [...root.querySelectorAll("table tbody tr")].map((tr) =>
      tr.querySelector("th, td")?.textContent?.trim(),
    );
    expect(rows).toEqual([
      "1 Sample Street",
      "9 Sample Street",
      "2 Example Lane",
      "Pump A (Water pump, highlighted)",
      "Pump B (Water pump)",
    ]);
    expect(root.textContent).toContain("the filled square is Pump A");
  });

  it("fails on a position that is not in degrees", () => {
    expect(() =>
      dotMap({
        data: [{ lon: 200, lat: 0, n: 1 }],
        longitude: "lon",
        latitude: "lat",
        value: "n",
        alt: "x",
      }),
    ).toThrow(/outside ±180/);
    expect(() =>
      dotMap({
        data: cases,
        longitude: "lon",
        latitude: "lat",
        value: "deaths",
        basemap: [
          {
            geometry: {
              type: "FeatureCollection",
              features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[1]] } }],
            },
          },
        ],
        alt: "x",
      }),
    ).toThrow(/basemap layer 1 feature 1/);
  });
});

describe("choroplethMap", () => {
  const rates = [
    { district: "North", rate: 10 },
    { district: "East", rate: 20 },
    { district: "South", rate: 50 },
    { district: "West", rate: null },
  ];
  const root = parse(
    choroplethMap({
      regions: districts,
      regionKey: "name",
      data: rates,
      region: "district",
      value: "rate",
      valueLabel: "deaths per 10,000",
      alt: "Death rates by sample district.",
    }),
  );
  const region = (name: string) =>
    [...root.querySelectorAll('[data-enarratio-mark="cell"] path')].find((p) =>
      p.querySelector("title")?.textContent?.startsWith(name),
    );

  it("shades each region by its step and outlines a region with no data", () => {
    expect(region("North")?.getAttribute("fill")).toBe("var(--enarratio-sequential-1)");
    expect(region("South")?.getAttribute("fill")).toBe("var(--enarratio-sequential-5)");
    expect(region("West")?.getAttribute("fill")).toBe("none");
    expect(region("West")?.getAttribute("stroke-dasharray")).toBeTruthy();
  });

  it("labels the ramp's five steps and lists every region", () => {
    expect(root.querySelectorAll(".enarratio-ramp li")).toHaveLength(5);
    const rows = [...root.querySelectorAll("table tbody tr")].map((tr) =>
      [...tr.querySelectorAll("th, td")].map((c) => c.textContent?.trim()),
    );
    expect(rows).toEqual([
      ["East", "20"],
      ["North", "10"],
      ["South", "50"],
      ["West", "no data"],
    ]);
  });

  it("fails naming a region the geometry lacks", () => {
    expect(() =>
      choroplethMap({
        regions: districts,
        regionKey: "name",
        data: [{ district: "Nowhere", rate: 1 }],
        region: "district",
        value: "rate",
        alt: "x",
      }),
    ).toThrow(/no region named "Nowhere"/);
  });
});
