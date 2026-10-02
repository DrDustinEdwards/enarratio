/**
 * Writes dist/base.css, the theme-free base rules, from the same function the JavaScript API
 * uses, so `enarratio/base.css` and `baseStylesheet()` can never differ. Plain JavaScript because
 * `npm run build` runs on every supported Node.js line, and only Node.js 24 runs TypeScript files.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { baseStylesheet } from "../dist/index.js";

writeFileSync(resolve(import.meta.dirname, "..", "dist", "base.css"), `${baseStylesheet()}\n`);
