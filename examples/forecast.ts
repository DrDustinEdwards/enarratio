// A forecast the caller computed: dashed after 24 February, with its 95% interval as a band.
import { lineChart } from "enarratio/plot";

// Observed daily visits, then a forecast made elsewhere (here: a straight trend with a widening
// interval). Enarratio draws the numbers it is given; it does not estimate them.
const days = Array.from({ length: 28 }, (_, i) => {
  const at = new Date(Date.UTC(2026, 1, 3 + i));
  const trend = 120 + i * 3 + 8 * Math.sin(i / 2);
  const forecast = i > 20;
  const spread = forecast ? 6 + (i - 20) * 4 : 0;
  return {
    day: at,
    visits: Math.round(trend),
    lower: forecast ? Math.round(trend - spread) : null,
    upper: forecast ? Math.round(trend + spread) : null,
  };
});

export default lineChart({
  id: "visits-forecast",
  data: days,
  x: "day",
  y: "visits",
  band: { lower: "lower", upper: "upper", label: "95% interval" },
  forecastFrom: "2026-02-23",
  forecastLabel: "Forecast",
  xLabel: "Day",
  yLabel: "Visits",
  title: "Daily visits and a one-week forecast",
  alt: "Daily visits from 3 February to 2 March 2026, rising from about 120 to about 207. From 24 February the line is a forecast: it continues the rise to about 207 by 2 March, with a 95% interval that widens from plus or minus 10 to plus or minus 34.",
  caption: "Illustrative data. The forecast and its interval were computed outside Enarratio.",
});
