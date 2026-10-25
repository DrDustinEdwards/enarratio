/**
 * Mermaid diagrams drawn on the server: beautiful-mermaid lays the diagram out and draws SVG
 * without a browser, and Enarratio turns that SVG into its own markup, the way it does Observable
 * Plot's. Colors become the theme's custom properties, so a diagram follows light and dark like
 * every chart; the per-diagram `<style>` and inline styles go; marker ids are made unique to the
 * diagram; coordinates are rounded; and the diagram's structure becomes the figure's data table.
 */

import { parseMermaid, renderMermaidSVG } from "beautiful-mermaid";
import { parseSvg } from "#document";
import { type DataTable, type FigureOptions, figure, validateFigure } from "../render/figure.js";
import { roundCoordinates, serialize } from "../render/svg.js";

/** Options for {@link mermaidDiagram}. */
export interface MermaidDiagramOptions extends FigureOptions {
  /**
   * The diagram in Mermaid syntax: a flowchart (`flowchart` or `graph`), `stateDiagram-v2`,
   * `sequenceDiagram`, `classDiagram` or `erDiagram`. `%%` comments are allowed. Colors come from
   * the theme, so `style`, `classDef`, `linkStyle` and `cssClass` throw, and so do `click` and
   * `callback`, which a server-drawn diagram cannot run.
   */
  readonly source: string;
  /**
   * The drawing's width in CSS pixels. Without it, the diagram keeps the size its layout needs;
   * with only one of `width` and `height`, the other follows the diagram's proportions.
   */
  readonly width?: number;
}

/** The diagram types Enarratio draws. */
export type MermaidDiagramType = "flowchart" | "state" | "sequence" | "class" | "er";

const KIND = "mermaidDiagram";

const HEADERS: ReadonlyArray<readonly [RegExp, MermaidDiagramType]> = [
  [/^(?:graph|flowchart)\b/i, "flowchart"],
  [/^statediagram(?:-v2)?\b/i, "state"],
  [/^sequencediagram\s*$/i, "sequence"],
  [/^classdiagram\s*$/i, "class"],
  [/^erdiagram\s*$/i, "er"],
];

/** Statements that set colors past the theme's checks, or attach behavior a server drawing lacks. */
const REFUSED = /^(style|classDef|linkStyle|cssClass|click|callback)\b/;

/**
 * What beautiful-mermaid paints with, as Enarratio's custom properties. Text and lines take the
 * theme's checked text colors; fills and node outlines take the three diagram properties the
 * stylesheet derives from them. A color missing here throws, so a beautiful-mermaid release that
 * paints with something new cannot put an unthemed color on the page.
 */
const PAINT: Readonly<Record<string, string>> = {
  "--bg": "var(--enarratio-background)",
  "--_group-fill": "var(--enarratio-background)",
  "--_text": "var(--enarratio-text)",
  "--_arrow": "var(--enarratio-text)",
  "--_text-sec": "var(--enarratio-text-muted)",
  "--_text-muted": "var(--enarratio-text-muted)",
  "--_text-faint": "var(--enarratio-text-muted)",
  "--_line": "var(--enarratio-text-muted)",
  "--_inner-stroke": "var(--enarratio-grid)",
  "--_node-fill": "var(--enarratio-diagram-fill)",
  "--_group-hdr": "var(--enarratio-diagram-header)",
  "--_key-badge": "var(--enarratio-diagram-header)",
  "--_node-stroke": "var(--enarratio-diagram-stroke)",
};

const ELEMENTS = new Set([
  "svg",
  "defs",
  "marker",
  "g",
  "title",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
]);

/** Attributes rounded beyond the shared coordinate set: beautiful-mermaid writes long decimals here. */
const ROUNDED = ["dy", "rx", "ry", "stroke-width"];

/**
 * A Mermaid diagram drawn on the server into an accessible figure: flowcharts, state, sequence,
 * class and entity-relationship diagrams. Like every chart it needs `alt`, follows the theme in
 * light and dark, and carries an equivalent table: each node and where it leads, each message in
 * order, each class or entity with its members and relationships.
 *
 * @example
 * mermaidDiagram({
 *   source: "flowchart LR\n  Draft --> Review -->|approved| Publish",
 *   alt: "A post goes from draft to review, and is published once approved.",
 * });
 */
export function mermaidDiagram(options: MermaidDiagramOptions): string {
  validateFigure(KIND, options);
  const { lines, type } = readSource(options.source);
  const text = lines.join("\n");

  let markup: string;
  try {
    markup = renderMermaidSVG(text, { transparent: true, padding: 16 });
  } catch (error) {
    throw new Error(`${KIND}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const svg = parseSvg(markup);
  const table = TABLES[type](svg, text);
  if (table.rows.length === 0) throw new Error(`${KIND}: the diagram draws nothing`);

  tidy(svg, `enarratio-${hash(text)}-`);
  roundCoordinates(svg, ROUNDED);
  const size = sizeOf(svg, options);
  svg.setAttribute("width", String(size.width));
  svg.setAttribute("height", String(size.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", options.alt);

  return figure({ ...options, width: size.width }, { kind: "diagram", svg: serialize(svg), table });
}

/** The source's meaningful lines and its diagram type, refusing what Enarratio cannot draw. */
function readSource(source: string): { lines: string[]; type: MermaidDiagramType } {
  if (typeof source !== "string" || source.trim() === "") {
    throw new Error(`${KIND}: source is required`);
  }
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("%%"));
  const header = lines[0] ?? "";
  if (header === "---") {
    throw new Error(`${KIND}: front matter is not supported; give the title as the title option`);
  }
  const type = HEADERS.find(([pattern]) => pattern.test(header))?.[1];
  if (type === undefined) {
    const name = header.split(/\s/)[0];
    const advice = /^xychart/i.test(header)
      ? "; draw bar and line charts with barChart and lineChart from enarratio/plot"
      : "";
    throw new Error(
      `${KIND}: "${name}" diagrams are not supported; Enarratio draws flowchart, stateDiagram-v2, ` +
        `sequenceDiagram, classDiagram and erDiagram${advice}`,
    );
  }
  source.split(/\r?\n/).forEach((line, i) => {
    const refused = REFUSED.exec(line.trim())?.[1];
    if (refused) {
      throw new Error(
        `${KIND}: line ${i + 1} uses "${refused}"; diagrams take their colors from the theme, ` +
          "and a server-drawn diagram has no click handlers",
      );
    }
  });
  return { lines, type };
}

/** FNV-1a, so ids inside a diagram are the same on every render and differ between diagrams. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Rewrites beautiful-mermaid's SVG into Enarratio's markup, in place. */
function tidy(root: Element, prefix: string): void {
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (el.localName === "style") {
      el.remove();
      continue;
    }
    if (!ELEMENTS.has(el.localName)) {
      throw new Error(`${KIND}: beautiful-mermaid drew an unexpected <${el.localName}>`);
    }
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3 && (node.textContent ?? "").trim() === "") {
        node.remove();
      }
    }
    for (const name of el.getAttributeNames()) {
      const value = el.getAttribute(name) ?? "";
      if (name === "style" || name.startsWith("data-")) {
        el.removeAttribute(name);
      } else if (name === "class") {
        el.removeAttribute(name);
        if (value === "mono") el.setAttribute("class", "enarratio-numeric");
        else el.setAttribute("data-enarratio-mark", value);
      } else if (name === "fill" || name === "stroke") {
        el.setAttribute(name, paint(value));
      } else if (name === "id") {
        el.setAttribute(name, prefix + value);
      } else if (name === "marker-start" || name === "marker-end") {
        el.setAttribute(
          name,
          value.replace(/^url\(#(.+)\)$/, (_, id) => `url(#${prefix}${id})`),
        );
      } else if (/^on|href$/i.test(name)) {
        throw new Error(`${KIND}: beautiful-mermaid drew an unexpected ${name} attribute`);
      }
    }
  }
}

function paint(value: string): string {
  if (value === "none") return value;
  const variable = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  const themed = variable === undefined ? undefined : PAINT[variable];
  if (themed === undefined) {
    throw new Error(
      `${KIND}: beautiful-mermaid painted with "${value}", which no theme color matches`,
    );
  }
  return themed;
}

/** The drawing's size: the layout's own, or scaled to the width or height asked for. */
function sizeOf(svg: Element, options: MermaidDiagramOptions): { width: number; height: number } {
  const [, , w = 0, h = 0] = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  if (!(w > 0 && h > 0)) throw new Error(`${KIND}: the diagram has no size`);
  const round = (n: number): number => Math.round(n * 100) / 100;
  if (options.width !== undefined) {
    return { width: options.width, height: options.height ?? round((h * options.width) / w) };
  }
  if (options.height !== undefined) {
    return { width: round((w * options.height) / h), height: options.height };
  }
  return { width: round(w), height: round(h) };
}

const list = (items: readonly string[]): string => items.join("; ") || "none";
const data = (el: Element, name: string): string => el.getAttribute(`data-${name}`) ?? "";
const number = (value: string | null | undefined): number => Number(value ?? Number.NaN);

/** Flowcharts and state diagrams: each node, its group, and where it leads. */
function graphTable(type: "flowchart" | "state"): (svg: Element, text: string) => DataTable {
  return (_svg, text) => {
    const graph = parseMermaid(text);
    const groups = new Map<string, string>();
    const groupLabels = new Map<string, string>();
    const visit = (subgraph: (typeof graph.subgraphs)[number]): void => {
      groupLabels.set(subgraph.id, subgraph.label || subgraph.id);
      for (const id of subgraph.nodeIds) groups.set(id, subgraph.label || subgraph.id);
      subgraph.children.forEach(visit);
    };
    graph.subgraphs.forEach(visit);

    const label = (id: string): string => {
      const node = graph.nodes.get(id);
      if (node?.shape === "state-start") return "Start";
      if (node?.shape === "state-end") return "End";
      return node?.label || groupLabels.get(id) || id;
    };
    const leads = new Map<string, string[]>();
    const add = (from: string, to: string, edgeLabel: string | undefined): void => {
      const entry = edgeLabel ? `${label(to)} (${edgeLabel})` : label(to);
      leads.set(from, [...(leads.get(from) ?? []), entry]);
    };
    for (const edge of graph.edges) {
      const undirected = !edge.hasArrowStart && !edge.hasArrowEnd;
      if (edge.hasArrowEnd || undirected) add(edge.source, edge.target, edge.label);
      if (edge.hasArrowStart || undirected) add(edge.target, edge.source, edge.label);
    }

    const ids = [
      ...[...graph.nodes.values()].filter((n) => n.shape !== "state-end").map((n) => n.id),
      ...[...leads.keys()].filter((id) => !graph.nodes.has(id)),
    ];
    const grouped = groups.size > 0;
    return {
      columns: [type === "state" ? "State" : "Node", ...(grouped ? ["Group"] : []), "Leads to"],
      rows: ids.map((id) => [
        label(id),
        ...(grouped ? [groups.get(id) ?? ""] : []),
        list(leads.get(id) ?? []),
      ]),
    };
  };
}

// beautiful-mermaid's own sequence statements, so the table walks the source as it was drawn.
const ACTOR = /^(participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/;
const BLOCK = /^(loop|alt|opt|par|critical|break|rect)\s*(.*)$/;
const DIVIDER = /^(else|and)\s*(.*)$/;
const NOTE = /^note\s+(?:left of|right of|over)\s+[^:]+:/i;
const MESSAGES = [
  /^(\S+?)\s*(--?>?>|--?[)x]|--?>>|--?>)\s*([+-]?)(\S+?)\s*:\s*(.+)$/,
  /^(\S+?)\s*(->>|-->>|-\)|--\)|-x|--x|->|-->)\s*([+-]?)(\S+?)\s*:\s*(.+)$/,
];

/** Sequence diagrams: every message and note, in order, with the block section it is in. */
function sequenceTable(svg: Element, text: string): DataTable {
  const actors = new Map<string, string>();
  for (const actor of svg.querySelectorAll("g.actor")) {
    actors.set(data(actor, "id"), data(actor, "label") || data(actor, "id"));
  }
  const actor = (id: string): string => actors.get(id) ?? id;
  const messages = [...svg.querySelectorAll("g.message")];
  const notes = [...svg.querySelectorAll("g.note")];

  // The drawing places blocks and notes by message index, so their sections come from the source.
  const sections: string[] = [];
  const section = (keyword = "", label = ""): string => (label ? `${keyword}: ${label}` : keyword);
  const rows: { cells: string[]; section: string }[] = [];
  let message = 0;
  let note = 0;
  for (const line of text.split("\n").slice(1)) {
    // In beautiful-mermaid's order: a statement is the first of these it matches.
    if (ACTOR.test(line)) continue;
    let cells: string[] | undefined;
    const block = BLOCK.exec(line);
    const divider = DIVIDER.exec(line);
    if (NOTE.test(line)) {
      const el = notes[note++];
      const over = el ? data(el, "actors").split(",").filter(Boolean) : [];
      const words = el?.querySelector("text")?.textContent ?? "";
      cells = [over.map((id) => actor(id.trim())).join(" and "), "", `Note: ${words}`];
    } else if (block) {
      sections.push(section(block[1], block[2]));
    } else if (divider && sections.length > 0) {
      sections[sections.length - 1] = section(divider[1], divider[2]);
    } else if (line === "end" && sections.length > 0) {
      sections.pop();
    } else if (MESSAGES.some((pattern) => pattern.test(line))) {
      const el = messages[message++];
      if (el) cells = [actor(data(el, "from")), actor(data(el, "to")), data(el, "label")];
    }
    if (cells) rows.push({ cells, section: sections[sections.length - 1] ?? "" });
  }
  const blocks = rows.some((row) => row.section !== "");
  return {
    columns: ["Step", "From", "To", "Message", ...(blocks ? ["Section"] : [])],
    rows: rows.map((row, i) => [String(i + 1), ...row.cells, ...(blocks ? [row.section] : [])]),
  };
}

/** The text rows of a class or entity box below its name, in reading order. */
function boxRows(box: Element): string[] {
  const rows = new Map<number, Element[]>();
  for (const text of box.querySelectorAll("text")) {
    if (
      text.getAttribute("font-weight") === "700" ||
      text.getAttribute("font-style") === "italic"
    ) {
      continue;
    }
    const y = number(text.getAttribute("y"));
    rows.set(y, [...(rows.get(y) ?? []), text]);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, texts]) => {
      // Mono text first, left to right, then key badges (PK, FK, UK), then any comment.
      const mono = texts.filter((t) => t.getAttribute("class") === "mono");
      const badges = texts.filter((t) => t.getAttribute("class") !== "mono");
      const ordered = [...mono].sort(
        (a, b) => number(a.getAttribute("x")) - number(b.getAttribute("x")),
      );
      const words = [...ordered, ...badges].map((t) => (t.textContent ?? "").trim());
      const comment = [...(texts[0]?.parentElement?.children ?? [])].find(
        (child) => child.localName === "title",
      )?.textContent;
      return `${words.filter(Boolean).join(" ")}${comment ? ` (${comment})` : ""}`;
    });
}

/** Class diagrams: each class with its members and relationships. */
function classTable(svg: Element): DataTable {
  const labels = new Map<string, string>();
  const boxes = [...svg.querySelectorAll("g.class-node")];
  for (const box of boxes) labels.set(data(box, "id"), data(box, "label") || data(box, "id"));
  const related = new Map<string, string[]>();
  const add = (id: string, entry: string): void => {
    related.set(id, [...(related.get(id) ?? []), entry]);
  };
  for (const link of svg.querySelectorAll(".class-relationship")) {
    const from = data(link, "from");
    const to = data(link, "to");
    const how = [data(link, "type"), data(link, "label")].filter(Boolean).join(", ");
    add(from, `${labels.get(to) ?? to} (${how})`);
    add(to, `${labels.get(from) ?? from} (${how})`);
  }
  return {
    columns: ["Class", "Members", "Related to"],
    rows: boxes.map((box) => {
      const id = data(box, "id");
      const annotation = data(box, "annotation");
      return [
        `${labels.get(id) ?? id}${annotation ? ` «${annotation}»` : ""}`,
        list(boxRows(box)),
        list(related.get(id) ?? []),
      ];
    }),
  };
}

const CARDINALITY: Readonly<Record<string, string>> = {
  one: "exactly one",
  "zero-one": "zero or one",
  many: "one or more",
  "zero-many": "zero or more",
};

/** Entity-relationship diagrams: each entity with its attributes and relationships. */
function erTable(svg: Element): DataTable {
  const labels = new Map<string, string>();
  const boxes = [...svg.querySelectorAll("g.entity")];
  for (const box of boxes) labels.set(data(box, "id"), data(box, "label") || data(box, "id"));
  const name = (id: string): string => labels.get(id) ?? id;
  const related = new Map<string, string[]>();
  const add = (id: string, entry: string): void => {
    related.set(id, [...(related.get(id) ?? []), entry]);
  };
  for (const link of svg.querySelectorAll(".er-relationship")) {
    const [a, b] = [data(link, "entity1"), data(link, "entity2")];
    const verb = data(link, "label");
    const many = (side: string): string => CARDINALITY[data(link, side)] ?? data(link, side);
    add(a, `${verb ? `${verb} ` : ""}${many("cardinality2")} ${name(b)}`);
    add(b, `${many("cardinality1")} ${name(a)}${verb ? ` (${verb})` : ""}`);
  }
  return {
    columns: ["Entity", "Attributes", "Related to"],
    rows: boxes.map((box) => {
      const id = data(box, "id");
      return [name(id), list(boxRows(box)), list(related.get(id) ?? [])];
    }),
  };
}

const TABLES: Readonly<Record<MermaidDiagramType, (svg: Element, text: string) => DataTable>> = {
  flowchart: graphTable("flowchart"),
  state: graphTable("state"),
  sequence: sequenceTable,
  class: classTable,
  er: erTable,
};
