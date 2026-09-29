import { parseHTML } from "linkedom";

/** Parses chart markup into a DOM so tests can assert on structure rather than on strings. */
export function parse(markup: string): Element {
  const { document } = parseHTML(`<!doctype html><html><body>${markup}</body></html>`);
  const root = document.body.firstElementChild;
  if (!root) throw new Error("markup is empty");
  return root as unknown as Element;
}

/** Every element carrying a datum key, in document order. */
export function keyedMarks(root: Element): Element[] {
  return [...root.querySelectorAll("[data-enarratio-key]")];
}
