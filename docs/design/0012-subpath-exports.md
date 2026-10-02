# 0012. One package, subpath exports, optional peers

Status: accepted, 2026-10-02. Supersedes the dependency table in [0006](0006-api-and-quality.md).

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** Stay one npm package, with
subpath exports: `enarratio` (core), `enarratio/base.css`, `enarratio/plot`,
`enarratio/science`, `enarratio/enhance` (unchanged), `enarratio/themes`.
Observable Plot, d3-force and linkedom become optional peer dependencies. At
0.2.0 the root import is core only and every chart moves to its subpath; markup,
options and return values do not change, so stored rendered charts stay valid.
A `browser` export condition drops linkedom where a real document exists.

## Why

Server-first does not mean every site needs the server renderer. A site that
uses only a sparkline or an uptime strip (Capsomer's components do) had to
install Plot, d3-force and linkedom, about 60 packages. A peer dependency that
is optional costs a site that does not use it nothing, and tells one that does
exactly what to add.

## Implementation choices

1. **Core's contents follow the dependency boundary.** Everything that needs
   none of the three packages is core: HTML helpers, the theme and its
   stylesheet, the color checks, `figure()` and the data-table assembly,
   and the primitives. `ScaleDescription` moved into `figure.ts`, so core's
   type declarations do not mention Plot either. A test walks core's files and
   fails on any bare import.
2. **`networkChart` lives in `science`, which therefore needs d3-force.** The
   decision puts it there. A page that draws only a titer plot still needs
   `d3-force` installed to import the entry; making the import lazy would need
   top-level `await`, which not every bundler accepts. The cost is one small
   package, stated in the docs.
3. **The browser condition is on an internal import, not on the entry.**
   Charts import `#document` (package.json `imports`), which resolves to the
   linkedom document by default and to `document.createHTMLDocument` under
   `browser`. The condition is on a module, so a browser bundle contains the same
   chart code as a server one and only the document factory differs; measured by
   `npm run size`, the browser variant of `enarratio/plot` drops linkedom from its
   imports.
4. **Server bundlers that also set `browser` keep linkedom.** Wrangler (Workers)
   builds with the conditions `workerd`, `worker` and `browser` and has no
   `document`. Conditions match in the order the object lists them, so `node`,
   `workerd`, `worker`, `edge-light` and `deno` come before `browser`, and a test
   checks that order. If a runtime slips through anyway, the browser factory
   throws an error that says what to do, not a failure inside Plot.
5. **Peer ranges are caret ranges of the tested versions** (`^0.6.17`,
   `^3.0.0`, `^0.18.13`), while the development copies stay pinned exactly.
   Peers must be ranges to be useful to a site; exact pins would force a
   duplicate copy of Plot on any site that already has one. The Plot range stays
   inside 0.6 because 0.x minors can break.
6. **The size check measures what a reader would download.** `npm run size`
   follows each compiled entry's relative imports and reports the gzipped size
   of everything it brings from this package (compiled, not minified, so an
   upper bound for a bundler's output) and which outside packages it imports.
   It fails if `dependencies` is not empty or if core imports anything outside
   the package. It uses no bundler, so it adds no dependency.
