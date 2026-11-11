// Daily prices as candles: hollow where the day closed up, solid where it closed down.
import { candlestickChart } from "enarratio/plot";

const closes = [
  41.2, 41.9, 41.5, 42.8, 43.1, 42.4, 41.7, 42.9, 44.0, 44.6, 43.8, 44.9, 45.7, 45.1, 46.3, 45.8,
  44.9, 45.6, 46.8, 47.4,
];
// Weekdays from 2 November 2026: each day opens at the previous close and ranges past both.
const days = closes.map((close, i) => {
  const week = Math.floor(i / 5);
  const date = new Date(Date.UTC(2026, 10, 2 + week * 7 + (i % 5)));
  const open = i === 0 ? 40.8 : (closes[i - 1] as number);
  const spread = 0.4 + ((i * 7) % 5) * 0.15;
  return {
    date: date.toISOString().slice(0, 10),
    open,
    high: Math.round((Math.max(open, close) + spread) * 100) / 100,
    low: Math.round((Math.min(open, close) - spread) * 100) / 100,
    close,
  };
});

export default candlestickChart({
  data: days,
  x: "date",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  yLabel: "Price ($)",
  title: "A reagent supplier's share price, November 2026",
  alt: "Candlestick chart of 20 trading days in November 2026: the price rises from 40.80 to 47.40 dollars, with 13 days closing up and 7 closing down, and two-day dips on 9 and 10 and on 23 and 24 November.",
  caption: "Illustrative prices.",
});
