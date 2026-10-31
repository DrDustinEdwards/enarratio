/** The controls the layer adds around a chart: table sorting, the chart and table switch, expand. */

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
 * Makes the figure's data table sortable (B35): each column header becomes a button that sorts
 * by it, ascending then descending, with `aria-sort` on the header. Without script the table is
 * complete, in source order. Returns the undo.
 */
export function sortTable(
  figure: HTMLElement,
  strings: EnhanceStrings,
  announce: (message: string) => void,
): () => void {
  const table = figure.querySelector<HTMLTableElement>(".enarratio-data table");
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
 * A button that shows the data table in place of the chart and back (B42). The table opens if it
 * was in a closed disclosure and shows if it was visually hidden; switching back restores it.
 */
export function viewSwitch(figure: HTMLElement, strings: EnhanceStrings): HTMLButtonElement | null {
  const data = figure.querySelector<HTMLElement>(".enarratio-data");
  if (!data) return null;
  const hidden = data.classList.contains("enarratio-visually-hidden");
  let wasOpen = false;
  const toggle = button(strings.showTable, () => {
    const table = !figure.hasAttribute("data-enarratio-view-table");
    figure.toggleAttribute("data-enarratio-view-table", table);
    toggle.textContent = table ? strings.showChart : strings.showTable;
    if (hidden) data.classList.toggle("enarratio-visually-hidden", !table);
    if (data instanceof HTMLDetailsElement) {
      if (table) wasOpen = data.open;
      data.open = table || wasOpen;
    }
  });
  return toggle;
}

/**
 * A button that expands the figure to fill the window (C6). Escape, the button again, or focus
 * leaving the figure closes it, so the expanded chart never hides focus elsewhere (WCAG 2.4.11).
 */
export function expander(
  figure: HTMLElement,
  strings: EnhanceStrings,
  listen: (target: EventTarget, type: string, handler: (event: Event) => void) => void,
): HTMLButtonElement {
  const set = (on: boolean): void => {
    figure.toggleAttribute("data-enarratio-expanded", on);
    toggle.textContent = on ? strings.collapse : strings.expand;
  };
  const toggle = button(strings.expand, () => set(!figure.hasAttribute("data-enarratio-expanded")));
  listen(document, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && !e.defaultPrevented) set(false);
  });
  listen(figure, "focusout", (e) => {
    const next = (e as FocusEvent).relatedTarget;
    if (next instanceof Node && !figure.contains(next)) set(false);
  });
  return toggle;
}
