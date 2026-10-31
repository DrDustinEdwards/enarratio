/**
 * A parser for trees in Newick format (Felsenstein's "Newick" standard, 1986; the PHYLIP
 * description), as phylogenetics programs write them: `((A:0.1,B:0.2)90:0.05,C:0.3);`.
 */

/** A node of a parsed tree. */
export interface TreeNode {
  /** The label: a tip's name, or an internal node's label (often a support value). */
  readonly name?: string;
  /** The branch length to the parent, when given. */
  readonly length?: number;
  readonly children: readonly TreeNode[];
}

/**
 * Parses one Newick tree. Handles quoted labels (`'Homo sapiens'`, with `''` for a quote),
 * underscores in unquoted labels as spaces, bracketed comments, whitespace and line breaks
 * between tokens, internal node labels and branch lengths in any number format. The final
 * semicolon is optional. Throws with the position of anything else.
 */
export function parseNewick(text: string): TreeNode {
  let at = 0;
  const fail = (what: string): never => {
    throw new Error(`parseNewick: ${what} at character ${at + 1}`);
  };
  const skip = (): void => {
    for (;;) {
      while (at < text.length && /\s/.test(text[at] as string)) at += 1;
      if (text[at] !== "[") return;
      const close = text.indexOf("]", at);
      if (close < 0) fail("an unclosed comment");
      at = close + 1;
    }
  };
  const label = (): string | undefined => {
    skip();
    if (text[at] === "'") {
      let out = "";
      at += 1;
      for (;;) {
        if (at >= text.length) fail("an unclosed quoted label");
        if (text[at] === "'") {
          if (text[at + 1] === "'") {
            out += "'";
            at += 2;
            continue;
          }
          at += 1;
          return out;
        }
        out += text[at];
        at += 1;
      }
    }
    const start = at;
    while (at < text.length && !/[\s(),:;[\]']/.test(text[at] as string)) at += 1;
    return at > start ? text.slice(start, at).replaceAll("_", " ") : undefined;
  };
  const node = (depth: number): TreeNode => {
    if (depth > 10_000) fail("a tree nested too deeply");
    skip();
    const children: TreeNode[] = [];
    if (text[at] === "(") {
      at += 1;
      for (;;) {
        children.push(node(depth + 1));
        skip();
        if (text[at] === ",") {
          at += 1;
          continue;
        }
        if (text[at] === ")") {
          at += 1;
          break;
        }
        fail(
          `expected "," or ")" but found ${text[at] === undefined ? "the end" : `"${text[at]}"`}`,
        );
      }
    }
    const name = label();
    skip();
    let length: number | undefined;
    if (text[at] === ":") {
      at += 1;
      skip();
      const match = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(at));
      if (!match) fail("expected a branch length");
      length = Number((match as RegExpExecArray)[0]);
      at += (match as RegExpExecArray)[0].length;
    }
    return {
      ...(name === undefined ? {} : { name }),
      ...(length === undefined ? {} : { length }),
      children,
    };
  };
  const root = node(0);
  skip();
  if (text[at] === ";") at += 1;
  skip();
  if (at < text.length) fail(`unexpected "${text[at]}"`);
  return root;
}
