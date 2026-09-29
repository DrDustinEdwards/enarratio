// The gallery's own script: enhances every chart, toggles the color scheme, and prints each
// chart's events under it. Served as a file, so the page needs no inline script.
import { enhance } from "./enhance.js";

enhance();

const root = document.documentElement;
const button = document.querySelector("button.scheme");
// The page follows the system scheme until the button is used, so the button starts out
// reporting the scheme actually shown (F17).
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.scheme ? root.dataset.scheme === "dark" : systemDark.matches);
const sync = () => button?.setAttribute("aria-pressed", String(isDark()));
sync();
systemDark.addEventListener("change", sync);
button?.addEventListener("click", () => {
  root.dataset.scheme = isDark() ? "light" : "dark";
  sync();
});

for (const type of ["abscissa:select", "abscissa:brush"]) {
  document.addEventListener(type, (event) => {
    const log = event.target.closest("section")?.querySelector(".events");
    if (log) log.textContent = `${type} ${JSON.stringify(event.detail)}`;
  });
}
