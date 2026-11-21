# Adapters: charts in your design system's colors

An adapter is a small CSS file that sets Enarratio's color properties from another design
system's own variables, so charts follow that system's theme, light and dark, with no `Theme`
object. Three ship with the package:

| Import                            | Design system                                                | Reads                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enarratio/adapters/shadcn.css`   | [shadcn/ui](https://ui.shadcn.com/docs/theming)              | `--background`, `--foreground`, `--muted-foreground`, `--border`, `--ring`, `--destructive`, `--chart-1` to `--chart-5`                                                                                   |
| `enarratio/adapters/radix.css`    | [Radix Colors](https://www.radix-ui.com/colors) 3            | Steps of the gray, blue, orange, jade, pink, violet, brown, teal, amber, green and red scales                                                                                                             |
| `enarratio/adapters/material.css` | [Material Design 3](https://material-web.dev/theming/color/) | `--md-sys-color-surface`, `-on-surface`, `-on-surface-variant`, `-outline-variant`, `-primary`, `-on-primary`, `-secondary`, `-tertiary`, `-on-tertiary`, `-error`, `-outline`; `--md-ref-typeface-plain` |

Each draws every gallery example on that system's default values:
[shadcn/ui](https://enarratio.dustinedwards.info/shadcn),
[Radix Colors](https://enarratio.dustinedwards.info/radix) and
[Material](https://enarratio.dustinedwards.info/material).

## Using one

Load the base rules, then the adapter, after the design system's own CSS:

```css
@import "enarratio/base.css";
@import "enarratio/adapters/shadcn.css";
```

or, without a bundler, two `<link rel="stylesheet">` tags. shadcn/ui's adapter needs nothing
else: its variables are in the site's CSS already. Radix Colors' adapter reads the eleven scales
named above, so import each one and its dark file (`@radix-ui/colors/blue.css` and
`@radix-ui/colors/blue-dark.css`, and so on). Material's reads the `--md-sys-color-*` roles a
site generates with the Material Theme Builder or `material-color-utilities`.

Dark mode is the design system's: shadcn/ui's `.dark` class, Radix's `.dark` or `.dark-theme`
class, or wherever a Material site swaps its scheme. The adapter sets each property on the chart
itself (`.enarratio` and its tooltip), so the chart reads the system's variables where it sits,
and a chart inside a section with its own theme follows that section.

To change one property, set it on `.enarratio` in your own CSS. The adapter's rule has no
specificity (`:where()`), so yours wins wherever it loads. A value set on an ancestor does not
reach the chart through an adapter; set it on `.enarratio`.

Fonts: the Material adapter takes the plain typeface. The others set no font, so a chart uses the
page's.

## Contrast is yours

An adapter maps names. It cannot measure your colors, and `checkTheme` cannot either, because
the values live in your CSS. Your design system's colors were chosen for buttons and text, not
for telling eight series apart, so check yours: draw your charts with every series, read them
under simulated color vision deficiencies (Chrome's DevTools Rendering panel), and check that
each series reaches 3:1 against the background. Where one falls short, set that series on
`.enarratio`.

On the design systems' default values, measured with `checkTheme` after the browser resolved
each property (2026-11-21):

- **Radix Colors:** no findings, light or dark.
- **shadcn/ui:** eight findings. Seven are its own defaults: `--chart-4` and `--chart-5` under
  3:1 on white and too close for deuteranopia, dark `--chart-1` at 2.9:1 (as series 1 and as the
  ramp's darkest step), dark `--chart-1` and `--chart-4` too close for protanopia, and the light focus ring `--ring` at 2.6:1. One is the
  adapter's: series 6 and 8 too close for protanopia in light mode.
- **Material Design 3** (the baseline scheme): five findings, between series 6, 7 and 8 and their
  neighbours, under protanopia, deuteranopia or tritanopia.

## What an adapter maps

shadcn/ui has five chart colors. Series 6 to 8 mix the first, second and fourth with the text
color, so they differ from the five in lightness. The ramp is `--chart-1` from 15% to full
strength over the background. It has no success or warning color, so those two are a fixed green
and amber mixed a quarter with the text color, which keeps them readable in either mode.

Radix Colors uses its scales' own steps: 1 for the background, 6 for gridlines, 11 and 12 for text
and the focus ring, 9 to 12 for the series. The eight series take a different hue each, at steps
chosen to differ in lightness too, so neighbours stay apart under every color vision deficiency
(the combination was searched with `checkTheme` on Radix's light and dark values). Labels on a
series are white on steps 9 and 10, as Radix designs them, and step 1 on steps 11 and 12. Status
colors follow Radix's own pairings: green, orange and red.

Material Design 3 builds every role from one seed color, so primary, secondary and tertiary
share a hue family: too close for more than two series. Series 1 and 2 are primary and tertiary;
3 to 8 are six fixed hues, each mixed a tenth with the text color (7 is mixed half and half, so it
is darker in light mode and lighter in dark). The ramp is primary over the surface.
Material has no success or warning role either; those are the same as shadcn/ui's.

## Writing your own

Start from the adapter nearest your system and set, on `:where(.enarratio, .enarratio-tooltip)`,
every color property in the [API reference](api.md#colors-and-fonts):

- `--enarratio-background`, `--enarratio-text`, `--enarratio-text-muted`, `--enarratio-grid` and
  `--enarratio-focus`;
- `--enarratio-series-1` to `-8`, and `--enarratio-sequential-1` to `-5`;
- `--enarratio-status-good`, `-warning`, `-bad` and `-unknown`;
- the label on each fill, `--enarratio-series-text-1` to `-8` and
  `--enarratio-sequential-text-1` to `-5`. If your system has matching "on" colors, use them.
  If not, `@import "enarratio/adapters/labels.css";` first: it picks black or white for each
  fill by its lightness, and the text color in a browser without relative colors.

A property left undefined drops every rule that uses it, so a mark that needs it is not drawn.
`--enarratio-series-label-N` and `--enarratio-sequential-edge-N` are optional: the base rules
derive them. The fonts are optional too: undefined, a chart uses the page's.

When your system has fewer than eight colors, mix the ones it has with its text color
(`color-mix(in oklab, var(--chart-1) 50%, var(--foreground))`): the mix is darker in a light
theme and lighter in a dark one, which keeps it apart from the original. When it has none for a
role, mix a fixed color with the text color the same way.

Then measure. Open a page with all eight series and a heatmap, read each property's resolved
color (`getComputedStyle` of an element whose `color` is `var(--enarratio-series-1)`), and put the
values into a `Theme` for `checkTheme`, light and dark. That is how the findings above were made.
