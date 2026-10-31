// A force-directed network, laid out on the server.
import { networkChart } from "enarratio/science";

const people = [
  ["Rivera", "Virology"],
  ["Okafor", "Virology"],
  ["Lindqvist", "Virology"],
  ["Ramos", "Epidemiology"],
  ["Chen", "Epidemiology"],
  ["Haddad", "Epidemiology"],
  ["Novak", "Statistics"],
  ["Ibarra", "Statistics"],
  ["Mbeki", "Public health"],
  ["Sato", "Public health"],
] as const;
const pairs = [
  ["Rivera", "Okafor"],
  ["Rivera", "Lindqvist"],
  ["Okafor", "Lindqvist"],
  ["Rivera", "Ramos"],
  ["Ramos", "Chen"],
  ["Chen", "Haddad"],
  ["Ramos", "Haddad"],
  ["Chen", "Novak"],
  ["Novak", "Ibarra"],
  ["Rivera", "Novak"],
  ["Haddad", "Mbeki"],
  ["Mbeki", "Sato"],
  ["Ramos", "Sato"],
  ["Lindqvist", "Ibarra"],
] as const;

export default networkChart({
  nodes: people.map(([id, group]) => ({ id, group })),
  links: pairs.map(([source, target]) => ({ source, target })),
  title: "Co-authorship network",
  alt: "Network of ten co-authors in four fields. Rivera and Ramos are the hubs, with four co-authors each. Rivera links the virus team to statistics and epidemiology. Ramos links epidemiology to public health.",
  caption: "Illustrative data. Links are co-authored papers.",
});
