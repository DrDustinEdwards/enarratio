// Dose-response curves: four-parameter logistic fits with the IC50 marked.
import { doseResponse } from "enarratio/science";

const doses = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30];
const curve = (ic50: number, hill: number, dose: number): number =>
  100 / (1 + (dose / ic50) ** hill);
// Three replicates per dose, offset by a fixed pattern of noise.
const noise = [-3.1, 1.8, 0.9, -1.2, 2.6, -0.4, 1.1, -2.2, 0.3];
const wells = (["Oseltamivir", "Baloxavir"] as const).flatMap((compound, c) =>
  doses.flatMap((dose, d) =>
    [0, 1, 2].map((r) => ({
      compound,
      dose,
      activity:
        Math.round(
          (curve(c === 0 ? 1.2 : 0.09, 1.1 + 0.3 * c, dose) + (noise[(d * 3 + r + c) % 9] ?? 0)) *
            10,
        ) / 10,
    })),
  ),
);

export default doseResponse({
  data: wells,
  dose: "dose",
  response: "activity",
  group: "compound",
  midpointLabel: "IC50",
  doseLabel: "Concentration (µM)",
  responseLabel: "Polymerase activity (% of control)",
  title: "Inhibition of viral polymerase activity",
  alt: "Dose-response curves for two antivirals, three replicates at eight concentrations: activity falls from about 100% to near 0 for both, baloxavir at about a fourteenth the concentration of oseltamivir, with IC50s near 0.09 µM and 1.2 µM.",
  caption: "Illustrative data.",
});
