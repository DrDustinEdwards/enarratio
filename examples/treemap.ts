// Parts of a whole in two levels: each top-level group takes a color and a header with its total.
import { treemap } from "enarratio/plot";

const spending = [
  { group: "Housing", item: "Rent or mortgage", dollars: 1420 },
  { group: "Housing", item: "Utilities", dollars: 310 },
  { group: "Housing", item: "Insurance", dollars: 140 },
  { group: "Transport", item: "Car payment", dollars: 520 },
  { group: "Transport", item: "Fuel", dollars: 210 },
  { group: "Transport", item: "Transit", dollars: 60 },
  { group: "Food", item: "Groceries", dollars: 610 },
  { group: "Food", item: "Eating out", dollars: 290 },
  { group: "Health", item: "Premiums", dollars: 380 },
  { group: "Health", item: "Out of pocket", dollars: 120 },
  { group: "Other", item: "Savings", dollars: 400 },
  { group: "Other", item: "Leisure", dollars: 180 },
  { group: "Other", item: "Clothing", dollars: 110 },
];

export default treemap({
  data: spending,
  path: ["group", "item"],
  value: "dollars",
  valueLabel: "Dollars a month",
  formatValue: (v) => `$${v.toLocaleString("en-US")}`,
  title: "Where a monthly budget of $4,750 goes",
  alt: "Treemap of a $4,750 monthly household budget: housing takes $1,870 (39%), mostly rent; food $900, transport $790, other spending $690 (of which $400 is savings) and health $500.",
  caption: "Illustrative data.",
});
