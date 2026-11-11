// Parts of a whole in levels, read from the center out: each group keeps its color in every ring.
import { sunburst } from "enarratio/plot";

const reads = [
  { kingdom: "Bacteria", phylum: "Bacillota", reads: 41200 },
  { kingdom: "Bacteria", phylum: "Bacteroidota", reads: 28900 },
  { kingdom: "Bacteria", phylum: "Pseudomonadota", reads: 9800 },
  { kingdom: "Bacteria", phylum: "Actinomycetota", reads: 6100 },
  { kingdom: "Bacteria", phylum: "Verrucomicrobiota", reads: 2400 },
  { kingdom: "Archaea", phylum: "Methanobacteriota", reads: 3100 },
  { kingdom: "Archaea", phylum: "Thermoproteota", reads: 400 },
  { kingdom: "Eukaryota", phylum: "Ascomycota", reads: 1900 },
  { kingdom: "Eukaryota", phylum: "Basidiomycota", reads: 700 },
  { kingdom: "Viruses", phylum: "Uroviricota", reads: 4300 },
  { kingdom: "Viruses", phylum: "Phixviricota", reads: 1200 },
];

export default sunburst({
  data: reads,
  path: ["kingdom", "phylum"],
  value: "reads",
  valueLabel: "Reads",
  title: "Classified reads in one stool sample",
  alt: "Sunburst of 100,000 classified reads: bacteria make up 88%, led by Bacillota (41%) and Bacteroidota (29%); viruses 5.5%, archaea 3.5% and eukaryotes 2.6%.",
  caption: "Illustrative data.",
});
