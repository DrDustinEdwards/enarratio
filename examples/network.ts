// A force-directed network, laid out on the server.
import { networkChart } from "abscissa";

const people = [
  ["Edwards", "Virology"],
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
  ["Edwards", "Okafor"],
  ["Edwards", "Lindqvist"],
  ["Okafor", "Lindqvist"],
  ["Edwards", "Ramos"],
  ["Ramos", "Chen"],
  ["Chen", "Haddad"],
  ["Ramos", "Haddad"],
  ["Chen", "Novak"],
  ["Novak", "Ibarra"],
  ["Edwards", "Novak"],
  ["Haddad", "Mbeki"],
  ["Mbeki", "Sato"],
  ["Ramos", "Sato"],
  ["Lindqvist", "Ibarra"],
] as const;

export default networkChart({
  nodes: people.map(([id, group]) => ({ id, group })),
  links: pairs.map(([source, target]) => ({ source, target })),
  title: "Co-authorship network",
  alt: "Network of ten co-authors in four fields. Edwards and Ramos are the hubs, each with four collaborators; Edwards links the virologists to statistics and epidemiology, and Ramos links epidemiology to public health.",
  caption: "Illustrative data. Links are co-authored papers.",
});
