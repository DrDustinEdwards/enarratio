// Points sized by a third measurement, with a legend of reference sizes.
import { scatterPlot } from "enarratio/plot";

const sites = [
  { site: "Asheville", samples: 120, positivity: 8.1, wastewater: 42 },
  { site: "Boone", samples: 45, positivity: 5.2, wastewater: 18 },
  { site: "Charlotte", samples: 410, positivity: 11.4, wastewater: 96 },
  { site: "Durham", samples: 260, positivity: 9.8, wastewater: 61 },
  { site: "Greensboro", samples: 300, positivity: 7.4, wastewater: 55 },
  { site: "Raleigh", samples: 380, positivity: 12.6, wastewater: 88 },
  { site: "Wilmington", samples: 150, positivity: 6.3, wastewater: 30 },
];

export default scatterPlot({
  data: sites,
  x: "wastewater",
  y: "positivity",
  size: "samples",
  sizeLabel: "Samples",
  label: "site",
  xLabel: "Wastewater signal (copies per person, thousands)",
  yLabel: "Test positivity (%)",
  title: "Wastewater signal and test positivity by site",
  alt: "Bubble chart of seven sites: test positivity rises with wastewater signal, from 5.2% at Boone (signal 18, 45 samples) to 12.6% at Raleigh (signal 88, 380 samples); larger sites sit to the upper right.",
  caption: "Illustrative data. Bubble area shows the number of samples.",
});
