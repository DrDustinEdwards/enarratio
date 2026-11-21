/**
 * Writes dist/base.css, the theme-free base rules, from the same function the JavaScript API
 * uses, so `enarratio/base.css` and `baseStylesheet()` can never differ, and copies the adapters
 * (src/adapters, `enarratio/adapters/<name>.css`) beside it. Plain JavaScript because
 * `npm run build` runs on every supported Node.js line, and only Node.js 24 runs TypeScript files.
 */
import { cpSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { baseStylesheet } from "../dist/index.js";

const root = resolve(import.meta.dirname, "..");
writeFileSync(resolve(root, "dist", "base.css"), `${baseStylesheet()}\n`);
cpSync(resolve(root, "src", "adapters"), resolve(root, "dist", "adapters"), { recursive: true });
