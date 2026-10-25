import { describe, expect, it } from "vitest";
import { mermaidDiagram } from "../src/diagram/index.js";
import { parse } from "./helpers.js";

const SOURCES = {
  flowchart: `flowchart TD
  %% a comment
  subgraph Lab
    A[Sample in] --> B{Pass QC?}
  end
  B -->|Yes| C[Sequence]
  B -->|No| D[Resample]
  D --> A
  C --- E((Archive))`,
  state: `stateDiagram-v2
  [*] --> Idle
  state Busy {
    [*] --> Working
    Working --> [*]
  }
  Idle --> Busy: go
  Busy --> [*]`,
  sequence: `sequenceDiagram
  participant A as Alice
  actor B as Bob
  A->>B: Hello
  loop Every minute
    B->>A: ping
  end
  alt ok
    A->>B: yes
  else not ok
    A->>B: no
  end
  Note right of B: thinks`,
  class: `classDiagram
  class Animal {
    <<interface>>
    +int age
  }
  Animal <|-- Duck
  Animal o-- Food : eats
  Duck : +swim()`,
  er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string name PK "full name"
  }`,
};

function draw(source: string): Element {
  return parse(mermaidDiagram({ source, alt: "A diagram." }));
}

function rows(figure: Element): string[][] {
  return [...figure.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((cell) => cell.textContent ?? ""),
  );
}

describe("mermaidDiagram", () => {
  it.each(Object.entries(SOURCES))(
    "draws a %s in theme colors only, with its own marker ids",
    (_, source) => {
      const figure = draw(source);
      const svg = figure.querySelector("svg");
      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBe("A diagram.");
      expect(svg?.querySelector("style, [style], [class]:not(.enarratio-numeric)")).toBeNull();
      for (const el of figure.querySelectorAll("[fill], [stroke]")) {
        for (const name of ["fill", "stroke"]) {
          const value = el.getAttribute(name);
          if (value !== null) expect(value).toMatch(/^(none|var\(--enarratio-[a-z-]+\))$/);
        }
      }
      const ids = [...figure.querySelectorAll("[id]")].map((el) => el.getAttribute("id"));
      for (const id of ids) expect(id).toMatch(/^enarratio-[a-z0-9]+-/);
      for (const el of figure.querySelectorAll("[marker-end], [marker-start]")) {
        const ref = /url\(#(.+)\)/.exec(
          el.getAttribute("marker-end") ?? el.getAttribute("marker-start") ?? "",
        )?.[1];
        expect(ids).toContain(ref);
      }
    },
  );

  it("lists a flowchart's nodes with their group and where each leads", () => {
    expect(rows(draw(SOURCES.flowchart))).toEqual([
      ["Sample in", "Lab", "Pass QC?"],
      ["Pass QC?", "Lab", "Sequence (Yes); Resample (No)"],
      ["Sequence", "", "Archive"],
      ["Resample", "", "Sample in"],
      ["Archive", "", "Sequence"],
    ]);
  });

  it("names start states and composite states in a state diagram", () => {
    expect(rows(draw(SOURCES.state))).toEqual([
      ["Start", "", "Idle"],
      ["Idle", "", "Busy (go)"],
      ["Start", "Busy", "Working"],
      ["Working", "Busy", "End"],
      ["Busy", "", "End"],
    ]);
  });

  it("lists a sequence in source order with the block section of each step", () => {
    expect(rows(draw(SOURCES.sequence))).toEqual([
      ["1", "Alice", "Bob", "Hello", ""],
      ["2", "Bob", "Alice", "ping", "loop: Every minute"],
      ["3", "Alice", "Bob", "yes", "alt: ok"],
      ["4", "Alice", "Bob", "no", "else: not ok"],
      ["5", "Bob", "", "Note: thinks", ""],
    ]);
  });

  it("lists classes and entities with their members and relationships", () => {
    expect(rows(draw(SOURCES.class))).toEqual([
      ["Animal «interface»", "+ age: int", "Duck (inheritance); Food (aggregation, eats)"],
      ["Duck", "+ swim()", "Animal (inheritance)"],
      ["Food", "none", "Animal (aggregation, eats)"],
    ]);
    expect(rows(draw(SOURCES.er))).toEqual([
      ["CUSTOMER", "string name PK (full name)", "places zero or more ORDER"],
      ["ORDER", "none", "exactly one CUSTOMER (places)"],
    ]);
  });

  it("keeps the layout's size unless asked, and scales to one given dimension", () => {
    const natural = draw(SOURCES.er).querySelector("svg");
    const width = Number(natural?.getAttribute("width"));
    const height = Number(natural?.getAttribute("height"));
    const scaled = parse(
      mermaidDiagram({ source: SOURCES.er, alt: "A diagram.", width: width / 2 }),
    ).querySelector("svg");
    expect(Number(scaled?.getAttribute("height"))).toBeCloseTo(height / 2, 1);
  });

  it("refuses what it cannot draw faithfully", () => {
    const refuse = (source: string) => () => mermaidDiagram({ source, alt: "A diagram." });
    expect(refuse('pie title Pets\n  "Dogs": 3')).toThrow(/"pie" diagrams are not supported/);
    expect(refuse("xychart-beta\n  bar [1, 2]")).toThrow(/barChart and lineChart/);
    expect(refuse("graph TD\n  A --> B\n  style A fill:#f00")).toThrow(/line 3 uses "style"/);
    expect(refuse('graph TD\n  A --> B\n  click A "https://example.com"')).toThrow(/"click"/);
    expect(refuse("---\ntitle: x\n---\ngraph TD\n  A --> B")).toThrow(/front matter/);
    expect(refuse("  ")).toThrow(/source is required/);
    expect(() => mermaidDiagram({ source: SOURCES.flowchart, alt: " " })).toThrow(
      /alt is required/,
    );
  });
});
