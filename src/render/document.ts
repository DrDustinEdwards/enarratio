import { parseHTML } from "linkedom";

/**
 * A document for Observable Plot to draw into, outside a browser. linkedom, because it runs in
 * Node.js, Workers, Deno and Bun. Bundlers that build for browsers use `document.browser.ts`
 * instead (the `browser` condition of the `#document` import in package.json), so linkedom is
 * not shipped to readers.
 */
export function createDocument(): Document {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  // linkedom implements the subset of the DOM that Plot and Enarratio use; its types differ.
  return document as unknown as Document;
}
