// Points sized by value over the caller's own streets, with landmarks.
import { dotMap } from "enarratio/map";

// A sample town: four streets each way, about 1 km across, in longitude and latitude.
const line = (name: string, coordinates: number[][]) => ({
  type: "Feature",
  properties: { name },
  geometry: { type: "LineString", coordinates },
});
const streets = {
  type: "FeatureCollection",
  features: [
    ...["Mill Street", "Market Street", "Church Street", "Quay Street"].map((name, i) =>
      line(name, [
        [-0.01, 51.502 + i * 0.002],
        [0.006, 51.5025 + i * 0.002],
      ]),
    ),
    ...["North Lane", "Bridge Road", "School Lane", "Park Road"].map((name, i) =>
      line(name, [
        [-0.0075 + i * 0.004, 51.501],
        [-0.007 + i * 0.004, 51.5095],
      ]),
    ),
  ],
};

// Cases by address cluster round the well on Market Street.
const cases = Array.from({ length: 24 }, (_, i) => {
  const angle = i * 2.4;
  const spread = 0.0004 + (i % 6) * 0.0006;
  return {
    address: `${10 + i * 2} ${["Market", "Church", "Bridge", "School"][i % 4]} sample`,
    lon: -0.0035 + Math.cos(angle) * spread * 1.6,
    lat: 51.5045 + Math.sin(angle) * spread,
    cases: Math.max(1, 9 - (i % 6) * 1.5 - (i % 4)),
  };
});

export default dotMap({
  data: cases,
  longitude: "lon",
  latitude: "lat",
  value: "cases",
  label: "address",
  labelHeader: "Address",
  basemap: [{ geometry: streets, labels: "name" }],
  landmarks: [
    { name: "Market well", longitude: -0.0034, latitude: 51.5044, highlight: true },
    { name: "Mill well", longitude: 0.0035, latitude: 51.5028 },
    { name: "Park well", longitude: -0.0085, latitude: 51.5082 },
  ],
  landmarkLabel: "Well",
  title: "Cases by address",
  alt: "Dot map of 24 sample addresses: the largest dots, up to 9 cases, sit round the Market well, and fewer cases lie farther from it.",
  caption: "Illustrative data.",
});
