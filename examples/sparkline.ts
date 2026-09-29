// A trend beside a number, with a text alternative generated from the data.
import { sparkline } from "enarratio";

export default sparkline({
  values: [4, 5, 7, 11, 8, 10],
  label: "Entries per year, 2019 to 2024",
  area: true,
});
