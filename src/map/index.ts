/**
 * `enarratio/map`: maps drawn on the server from the caller's GeoJSON (design record 0028). A dot
 * map sizes points by value over a quiet basemap; a choropleth shades regions in five labeled
 * steps. Enarratio ships no boundaries. No dependencies.
 *
 * @packageDocumentation
 */

export { type ChoroplethMapOptions, choroplethMap } from "./choropleth.js";
export { type DotMapOptions, dotMap, type MapLandmark } from "./dot.js";
export type { BasemapLayer } from "./draw.js";
export type {
  GeoExtent,
  GeoFeature,
  GeoFeatureCollection,
  GeoGeometry,
  GeoJson,
  GeoPosition,
  Projection,
} from "./geo.js";
