/**
 * The browser's own document for Observable Plot to draw into, chosen by the `browser` condition of the
 * `#document` import in package.json, which drops linkedom from client bundles. A runtime that sets
 * that condition without a document gets this module's error rather than a failure inside Plot.
 */
export function createDocument(): Document {
  const real = (globalThis as { document?: Document }).document;
  if (!real?.implementation) {
    throw new Error(
      "Enarratio's browser build needs a document, and this runtime has none. Bundle for the server " +
        "(without the 'browser' condition) so Enarratio can use linkedom.",
    );
  }
  return real.implementation.createHTMLDocument("");
}
