/**
 * The browser's own document for Observable Plot to draw into, where a real one exists. Chosen
 * by the `browser` condition of the `#document` import in package.json, which drops linkedom
 * from client bundles. Runtimes that set that condition without having a document (some Worker
 * bundlers do) are listed before it in package.json and get the server version; if one slips
 * through, this says so rather than failing inside Plot.
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
