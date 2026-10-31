// A phylogenetic tree from Newick, tips colored by clade, support at the nodes.
import { phylogeneticTree } from "enarratio/science";

const newick =
  "((((A/duck/Ohio/2024:0.012,A/chicken/Iowa/2024:0.009)98:0.006,A/cow/Texas/2024:0.015)87:0.011,(A/gull/Maine/2023:0.018,A/fox/Vermont/2023:0.021)92:0.009)100:0.024,((A/duck/Hokkaido/2022:0.016,A/swan/Niigata/2022:0.013)95:0.019,A/goose/Guangdong/1996:0.052)76:0.008);";

export default phylogeneticTree({
  tree: newick,
  groups: {
    "A/duck/Ohio/2024": "2.3.4.4b, B3.13",
    "A/chicken/Iowa/2024": "2.3.4.4b, B3.13",
    "A/cow/Texas/2024": "2.3.4.4b, B3.13",
    "A/gull/Maine/2023": "2.3.4.4b, other",
    "A/fox/Vermont/2023": "2.3.4.4b, other",
    "A/duck/Hokkaido/2022": "2.3.4.4b, Asia",
    "A/swan/Niigata/2022": "2.3.4.4b, Asia",
    "A/goose/Guangdong/1996": "Ancestral",
  },
  title: "H5N1 hemagglutinin phylogeny",
  alt: "Rectangular phylogenetic tree of eight H5N1 hemagglutinin sequences: the three 2024 B3.13 viruses from a duck, a chicken and a cow cluster together with 98 and 87 support, beside two 2023 New England viruses; two 2022 Japanese viruses group with the 1996 Guangdong goose virus on the longest branch.",
  caption: "Illustrative tree and branch lengths.",
});
