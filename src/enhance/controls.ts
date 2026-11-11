/**
 * The controls the layer adds to a chart: the toolbar above the drawing (record 0035), its
 * buttons and popovers, expand, and sorting a table chart's table.
 */

import { ICONS } from "../controls.js";
import { SVG_NS } from "./marks.js";
import type { EnhanceStrings } from "./types.js";

/** Fills `{name}` in a string with its value. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

export function button(text: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

/** A cell as a number when it reads as one ("1,234", "−2", "12%"), else null. */
function numeric(text: string): number | null {
  const n = Number(text.replace(/[,\s%]/g, "").replace("−", "-"));
  return text.trim() !== "" && Number.isFinite(n) ? n : null;
}

function compare(a: string, b: string): number {
  const x = numeric(a);
  const y = numeric(b);
  if (x !== null && y !== null) return x - y;
  if (x !== null || y !== null) return x === null ? 1 : -1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * Makes a table chart's table sortable (B35): each column header becomes a button that sorts
 * by it, ascending then descending, with `aria-sort` on the header. Without script the table is
 * complete, in source order. Returns the undo.
 */
export function sortTable(
  figure: HTMLElement,
  strings: EnhanceStrings,
  announce: (message: string) => void,
): () => void {
  // Only a table people can see: a chart's own table is visually hidden (record 0035), and sort
  // buttons in it would be tab stops with nothing on screen (WCAG 2.2 SC 2.4.7).
  const table = figure.querySelector<HTMLTableElement>(
    ".enarratio-data:not(.enarratio-visually-hidden) table",
  );
  const body = table?.tBodies[0];
  const headers = [...(table?.tHead?.rows[0]?.cells ?? [])];
  if (!body || headers.length === 0) return () => {};
  const source = [...body.rows];
  const undo = headers.map((th, column) => {
    const sort = button("", () => {
      const ascending = th.getAttribute("aria-sort") !== "ascending";
      for (const other of headers) other.removeAttribute("aria-sort");
      th.setAttribute("aria-sort", ascending ? "ascending" : "descending");
      const cell = (row: HTMLTableRowElement): string => row.cells[column]?.textContent ?? "";
      body.append(
        ...[...body.rows].sort((a, b) => compare(cell(a), cell(b)) * (ascending ? 1 : -1)),
      );
      announce(
        fill(strings.sorted, {
          column: th.textContent ?? "",
          order: ascending ? strings.ascending : strings.descending,
        }),
      );
    });
    sort.append(...th.childNodes);
    th.append(sort);
    return () => {
      th.removeAttribute("aria-sort");
      th.replaceChildren(...sort.childNodes);
    };
  });
  return () => {
    for (const u of undo) u();
    body.append(...source);
  };
}

/**
 * The Expand toggle (C6): expands the figure to fill the window. Its name stays "Expand" and
 * `aria-pressed` says whether it is (WAI-ARIA APG, toggle button). Escape, the button again, or
 * focus leaving the figure closes it, so the expanded chart never hides focus elsewhere (WCAG
 * 2.4.11).
 */
export function expander(
  figure: HTMLElement,
  strings: EnhanceStrings,
  listen: (target: EventTarget, type: string, handler: (event: Event) => void) => void,
): HTMLButtonElement {
  const set = (on: boolean): void => {
    figure.toggleAttribute("data-enarratio-expanded", on);
    toggle.setAttribute("aria-pressed", String(on));
  };
  const toggle = toolButton("expand", strings.expand, () =>
    set(!figure.hasAttribute("data-enarratio-expanded")),
  );
  toggle.setAttribute("aria-pressed", "false");
  listen(document, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && !e.defaultPrevented) set(false);
  });
  listen(figure, "focusout", (e) => {
    const next = (e as FocusEvent).relatedTarget;
    if (next instanceof Node && !figure.contains(next)) set(false);
  });
  return toggle;
}

/** A toolbar icon: an inline SVG built from elements, stroked in the button's color, hidden from assistive technology. */
function icon(name: keyof typeof ICONS): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "enarratio-icon");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

/** A toolbar control's face: its icon and its word, which is also its name. */
function face(el: HTMLElement, name: keyof typeof ICONS, text: string): void {
  const word = document.createElement("span");
  word.className = "enarratio-label";
  word.textContent = text;
  el.append(icon(name), word);
}

/** A toolbar button: an icon and a word (record 0035). */
export function toolButton(
  name: keyof typeof ICONS,
  text: string,
  onClick: () => void,
): HTMLButtonElement {
  const el = button("", onClick);
  face(el, name, text);
  return el;
}

/**
 * A toolbar button that opens a panel under the toolbar: a native disclosure (`details`), so it
 * opens by click, Enter and Space with no script of its own. Escape closes it and puts focus back
 * on its button; so does a click outside it, or focus leaving it.
 */
export function popover(
  cls: string,
  name: keyof typeof ICONS,
  text: string,
  panel: HTMLElement,
  listen: (target: EventTarget, type: string, handler: (event: Event) => void) => void,
  chevron = false,
): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = cls;
  const summary = document.createElement("summary");
  face(summary, name, text);
  if (chevron) summary.append(icon("chevron"));
  panel.classList.add("enarratio-panel");
  details.append(summary, panel);
  listen(details, "keydown", (e) => {
    if ((e as KeyboardEvent).key !== "Escape" || !details.open) return;
    // Only this panel closes: the chart's own Escape (clear the filter) waits for the next press.
    e.preventDefault();
    e.stopPropagation();
    details.open = false;
    summary.focus();
  });
  listen(document, "pointerdown", (e) => {
    if (details.open && e.target instanceof Node && !details.contains(e.target)) {
      details.open = false;
    }
  });
  // One panel open at a time.
  listen(details, "toggle", () => {
    if (!details.open) return;
    for (const other of details.parentElement?.querySelectorAll("details[open]") ?? []) {
      if (other !== details) (other as HTMLDetailsElement).open = false;
    }
  });
  listen(details, "focusout", (e) => {
    const next = (e as FocusEvent).relatedTarget;
    if (details.open && next instanceof Node && !details.contains(next)) details.open = false;
  });
  return details;
}

/** Where a key moves in `list` from index `at`: `back` and `on` step round, Home and End go to the ends. */
function step(list: HTMLElement[], at: number, key: string, back: string, on: string) {
  const n = list.length;
  const to =
    key === on
      ? at + 1
      : key === back
        ? at - 1 + n
        : key === "Home"
          ? 0
          : key === "End"
            ? n - 1
            : -1;
  return to < 0 ? undefined : list[to % n];
}

/**
 * The Download menu: "Download CSV" (the figure's own link, moved in) and the export buttons, in
 * a popover. Up and Down move between its items, Down on the closed button opens it at the first
 * one, and choosing an item closes it with focus back on its button.
 */
export function downloadMenu(
  items: readonly HTMLElement[],
  strings: EnhanceStrings,
  listen: (target: EventTarget, type: string, handler: (event: Event) => void) => void,
): HTMLDetailsElement {
  const list = document.createElement("div");
  list.className = "enarratio-menu";
  list.append(...items);
  const menu = popover("enarratio-download", "download", strings.download, list, listen, true);
  const summary = menu.firstElementChild as HTMLElement;
  listen(list, "click", (e) => {
    if (!(e.target as Element).closest("a, button")) return;
    menu.open = false;
    summary.focus();
  });
  listen(menu, "keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    const at = items.indexOf(e.target as HTMLElement);
    const next =
      at >= 0
        ? step([...items], at, key, "ArrowUp", "ArrowDown")
        : key === "ArrowDown"
          ? items[0]
          : undefined;
    if (!next || key === "Home" || key === "End") return;
    e.preventDefault();
    menu.open = true;
    next.focus();
  });
  return menu;
}

/**
 * Makes `bar` a toolbar (WAI-ARIA APG): one tab stop, and Left and Right (and Home and End) move
 * between its controls.
 */
export function toolbar(
  bar: HTMLElement,
  strings: EnhanceStrings,
  listen: (target: EventTarget, type: string, handler: (event: Event) => void) => void,
): void {
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", strings.controls);
  const controls = [...bar.children].map(
    (el) => (el.localName === "details" ? el.firstElementChild : el) as HTMLElement,
  );
  // The tab stop is the control last focused, by the arrows, a click or Tab.
  const stop = (to: HTMLElement): void => {
    for (const c of controls) c.tabIndex = c === to ? 0 : -1;
  };
  stop(controls[0] as HTMLElement);
  listen(bar, "focusin", (e) => {
    if (controls.includes(e.target as HTMLElement)) stop(e.target as HTMLElement);
  });
  listen(bar, "keydown", (e) => {
    const at = controls.indexOf(e.target as HTMLElement);
    const next =
      at < 0 ? undefined : step(controls, at, (e as KeyboardEvent).key, "ArrowLeft", "ArrowRight");
    if (!next) return;
    e.preventDefault();
    next.focus();
  });
}
