// A viral genome map: features to scale, arrows by strand, overlaps stacked into lanes.
import { genomeTrack } from "enarratio";

export default genomeTrack({
  length: 9719,
  features: [
    { name: "5' LTR", start: 1, end: 634, type: "LTR" },
    { name: "gag", start: 790, end: 2292, strand: 1, type: "Gene" },
    { name: "pol", start: 2085, end: 5096, strand: 1, type: "Gene" },
    { name: "vif", start: 5041, end: 5619, strand: 1, type: "Accessory" },
    { name: "vpr", start: 5559, end: 5850, strand: 1, type: "Accessory" },
    { name: "tat", start: 5831, end: 6045, strand: 1, type: "Accessory" },
    { name: "rev", start: 5970, end: 6045, strand: 1, type: "Accessory" },
    { name: "vpu", start: 6062, end: 6310, strand: 1, type: "Accessory" },
    { name: "env", start: 6225, end: 8795, strand: 1, type: "Gene" },
    { name: "nef", start: 8797, end: 9417, strand: 1, type: "Accessory" },
    { name: "3' LTR", start: 9086, end: 9719, type: "LTR" },
    { name: "asp", start: 7270, end: 8260, strand: -1, type: "Antisense" },
  ],
  typeDomain: ["Gene", "Accessory", "Antisense", "LTR"],
  title: "HIV-1 HXB2 genome",
  alt: "Map of the 9,719-nucleotide HIV-1 HXB2 genome: long terminal repeats at both ends; the gag, pol and env genes on the forward strand, overlapping at their junctions; six accessory genes between pol and env and after env; and the antisense asp gene on the reverse strand inside env.",
  caption:
    "Coordinates approximate the HXB2 reference (GenBank K03455) and are rounded for display.",
});
