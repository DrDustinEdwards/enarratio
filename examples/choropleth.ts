// Regions shaded in five labeled steps of the sequential ramp.
import { choroplethMap } from "enarratio/map";

// A sample county of nine wards, three by three, each a slightly uneven square.
const wards = {
  type: "FeatureCollection",
  features: Array.from({ length: 9 }, (_, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const corner = (c: number, r: number) => [
      -1 + c * 0.2 + ((c * 7 + r * 3) % 5) * 0.006,
      52.6 - r * 0.12 + ((c * 3 + r * 5) % 4) * 0.005,
    ];
    return {
      type: "Feature",
      properties: { ward: `Ward ${i + 1}` },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            corner(col, row),
            corner(col + 1, row),
            corner(col + 1, row + 1),
            corner(col, row + 1),
            corner(col, row),
          ],
        ],
      },
    };
  }),
};

const rates = [12, 18, 25, 9, 31, 44, 15, 22, null].map((rate, i) => ({
  ward: `Ward ${i + 1}`,
  rate,
}));

export default choroplethMap({
  regions: wards,
  regionKey: "ward",
  data: rates,
  region: "ward",
  value: "rate",
  valueLabel: "cases per 10,000",
  regionHeader: "Ward",
  thresholds: [10, 20, 30, 40],
  title: "Cases per 10,000 by ward",
  alt: "Map of nine sample wards: Ward 6, in the east, has the highest rate at 44 per 10,000 and Ward 4 the lowest at 9; Ward 9 has no data.",
  caption: "Illustrative data.",
});
