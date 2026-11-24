/**
 * Fails when a gallery page's HTML passes 2,000,000 bytes. Googlebot reads the first 2 MB of a
 * page's HTML and drops the rest (Google's Googlebot documentation), so a page that grows past it
 * loses its last charts from search; a decimal 2 MB holds whichever way Google counts.
 *
 *   node scripts/html-limit.mjs [dir]
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 2_000_000;
const dir = process.argv[2] ?? "site/dist";
const over = readdirSync(dir)
  .filter((name) => name.endsWith(".html"))
  .map((name) => [name, statSync(join(dir, name)).size])
  .filter(([, bytes]) => bytes > LIMIT);
for (const [name, bytes] of over)
  console.error(`${name} is ${bytes} bytes, over 2,000,000, Googlebot's 2 MB`);
if (over.length) process.exit(1);
