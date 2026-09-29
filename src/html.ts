/**
 * HTML string building. Every chart returns a string so it can be written into any server
 * template, and every piece of caller text that reaches that string passes through these helpers.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for use as HTML element content or as a double-quoted attribute value. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/** An attribute value; `false` and `undefined` omit the attribute, `true` writes it bare. */
export type AttributeValue = string | number | boolean | undefined;

/** Serializes attributes in the order given, skipping omitted ones. */
function attributes(attrs: Readonly<Record<string, AttributeValue>>): string {
  let out = "";
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    out += value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`;
  }
  return out;
}

/** One element as a string. `children` is trusted markup: callers escape text before passing it. */
export function element(
  tag: string,
  attrs: Readonly<Record<string, AttributeValue>>,
  children = "",
): string {
  return `<${tag}${attributes(attrs)}>${children}</${tag}>`;
}
