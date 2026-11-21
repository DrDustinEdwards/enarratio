# 0043. Adapters for other design systems

Status: accepted, 2026-11-21. Builds on [0011](0011-theming-from-outside.md).

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** The package ships ready-made mappings from
popular design systems' CSS variables onto Enarratio's custom properties, each a small importable
file under `enarratio/adapters/<name>.css`: shadcn/ui, Radix Colors and Material Design 3, plus a
guide for writing one ([docs/adapters.md](../adapters.md)). Like `base.css`, they are unmeasured
mappings: the site owns its contrast. Each has a gallery page that draws every example on that
system's default values. Purpose: adoption by outside users, and the JOSS question of how
Enarratio fits an existing project.

## Implementation choices

1. **On the chart, without specificity.** Each adapter sets the properties on
   `:where(.enarratio, .enarratio-tooltip)`, not on `:root`. A custom property that names another
   is resolved where it is declared, so on `:root` a chart inside a section with its own theme
   (shadcn/ui's scoped themes, a nested Radix `.dark`) would keep the page's colors. On the chart,
   it reads the system's variables where it sits. `:where()` leaves a site's own `.enarratio` rule
   the winner wherever it loads. The cost: a value a site sets on an ancestor no longer reaches
   the chart, which the guide says. Capsomer's mapping (`capsomer/enarratio.css`) stays on `:root`
   and its theme wrappers: Capsomer knows where its themes switch.
2. **Every color property, or the guide says why not.** A property left undefined drops the rules
   that use it, so a mark is not drawn. A test reads the color properties `stylesheet()` writes
   (but for the series label shades and ramp edges, which the base rules derive) and fails unless
   each adapter defines them all. Fonts are left to the page except Material's plain typeface.
3. **Labels on a fill, shared.** shadcn/ui and Material's derived colors have no "on" color, so
   `enarratio/adapters/labels.css` picks black or white for each series and ramp step from its
   OKLCH lightness with relative color syntax (Baseline 2024), and falls back to the text color.
   Both adapters import it, and a site's own adapter can. Radix's labels are static: Radix
   documents white on steps 9 and 10, and step 1 reads on steps 11 and 12 in both themes.
4. **Eight series where a system has fewer.** shadcn/ui's six to eight mix three of its chart
   colors with the text color, so they differ in lightness. Material builds its
   roles from one seed, so its secondary is primary, muted: on the baseline scheme no set of its
   roles kept more than two series apart under `checkTheme`. Its series 3 to 8 are fixed hues mixed
   with the text color. Radix's eight were searched with `checkTheme` over its scales' light and
   dark values, hue and step, and pass with no findings.
5. **Success and warning where a system has none.** A fixed green and amber, mixed a quarter with
   the system's text color, so they read in either mode (shadcn/ui, Material).
6. **Measured once, on the defaults, and written down.** The values a site has live in its CSS,
   so `checkTheme` cannot run on them at build time. The browser resolved each property on each
   gallery page, light and dark, and `checkTheme` read the result: Radix none, shadcn/ui eight (seven
   from its own defaults), Material five. The guide lists them and says how to repeat it.
7. **Names checked at the source.** shadcn/ui against its theming and chart pages (2026-11-21:
   values are whole `oklch()` colors, `var(--chart-1)` not `hsl(var(--chart-1))`); Radix against
   `@radix-ui/colors` 3.0.0's files (`--blue-9`, `:root, .light, .light-theme` and
   `.dark, .dark-theme`); Material against `@material/web` 2.5.0's tokens (`--md-sys-color-*`,
   `--md-ref-typeface-plain`, and its focus ring's `--md-sys-color-secondary`).
8. **Plain CSS, copied by the build.** `scripts/build-css.mjs` copies `src/adapters` into
   `dist/adapters`; the export is the pattern `./adapters/*.css`.
