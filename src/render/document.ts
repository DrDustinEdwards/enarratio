import { parseHTML } from "linkedom";

/**
 * A document for Observable Plot to draw into, outside a browser: linkedom, which runs in Node.js,
 * Workers, Deno and Bun. Browser bundles use `document.browser.ts` (the `browser` condition of the
 * `#document` import), so linkedom is not shipped to readers.
 */
export function createDocument(): Document {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  // linkedom implements the subset of the DOM that Plot and Enarratio use; its types differ.
  return document as unknown as Document;
}
