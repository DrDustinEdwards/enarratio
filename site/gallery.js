// The gallery's own script: enhances every chart, wires Capsomer's site header and theme button,
// and prints each chart's events under it. Bundled by scripts/gallery.ts into one file, so the
// page needs no inline script.
import { enhance as enhanceHeader } from "capsomer/behaviour/site-header";
import { enhance as enhanceTheme } from "capsomer/behaviour/theme-switch";
import { enhance } from "./enhance.js";

enhance();
enhanceHeader();
enhanceTheme();

for (const type of ["enarratio:select", "enarratio:brush"]) {
  document.addEventListener(type, (event) => {
    const log = event.target.closest("section")?.querySelector(".events");
    if (log) log.textContent = `${type} ${JSON.stringify(event.detail)}`;
  });
}
