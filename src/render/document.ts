import { DOMParser, parseHTML } from "linkedom";

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

/** Parses SVG markup another library drew, as XML, so attribute names keep their case. */
export function parseSvg(markup: string): Element {
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  // linkedom's document and the DOM's differ in type only.
  return (parsed as unknown as Document).documentElement;
}
