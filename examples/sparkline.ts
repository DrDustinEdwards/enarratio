// A primitive as a whole figure (the default): title, generated description, drawing, table and CSV.
import { sparkline } from "enarratio";

export default sparkline({
  values: [4, 5, 7, 11, 8, 10],
  label: "Entries per year, 2019 to 2024",
  area: true,
});
