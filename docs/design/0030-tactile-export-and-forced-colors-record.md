# 0030. Tactile export, and the forced-colors record

Status: accepted, 2026-11-01. Builds on [0027](0027-contrast-export-and-roles.md) and
[0029](0029-phone-drawings-and-sound.md).

## Problem

Area 10's checklist has two items record 0027 left open:

- **B55, tactile export** (from Highcharts): a reader who reads graphics by touch should be able
  to download the chart as a file a braille embosser or swell-paper printer can produce. Highcharts
  offers an SVG "suitable for tactile printing" from its export menu.
- **B57, Windows High Contrast**: charts stay readable in forced colors, "tested by screenshot".
  The visual suite has screenshotted every gallery example in forced colors since 0.4, but the
  verifier found no record of anyone reading those screenshots.

## Decision

1. **"Download tactile SVG"** joins "Download SVG" and "Download PNG" (`tactile`, on by default,
   needs `download`). It follows the Braille Authority of North America's *Guidelines and
   Standards for Tactile Graphics* (2022) where a drawing can be changed without a transcriber:
   - an 11 by 11.5 inch page (`width="11in"`), the braille page size (3.4.2), with the title as
     a heading and the drawing scaled to fill the rest;
   - black on white: every series black, told apart by the textures, line dashes and symbols
     forced colors already uses; the sequential ramp as five grays from white to black, with the
     printed values carrying what a gray cannot;
   - gridlines left out: they are to be less than the data (3.4.3.8), and at screen spacing they
     read as an area texture;
   - every raised line at least 0.7 mm, which a fingertip finds;
   - labels horizontal (5.10.1): a turned axis title moves under the heading; a map's street
     names keep their angle along the street;
   - every label kept as text, black on a white patch that leaves blank space round it on a
     raised area (3.4.3.13), so braille translation software (or the embosser's own, as with
     ViewPlus) can write it in braille.
   The file is made in the browser from the drawing as shown, like the other downloads.
2. **The download code loads on demand.** The SVG, PNG and tactile files are made by
   `dist/enhance/image.js` (1.8 kB gzipped), imported on the first press, as `sound.js` is on
   Play. The layer's first load drops from 9.5 to 9.0 kB. A page that serves the layer as files
   serves `image.js` beside it, and a page under Integrity-Policy preloads it with its integrity,
   as the gallery does.
3. **The forced-colors record.** On 2026-11-01 every gallery example's stored forced-colors
   screenshot (default theme, CI's Linux Chrome) was read. Bars, areas, heatmaps, strips and
   timelines held up: textures, dashes, hollow points, printed values and direct labels told
   every series apart. Two failures were found and are fixed here:
   - **Legends did not match their marks.** Line, density, survival, dose-response and slope
     legends were identical black squares while the lines differed by dash; scatter, dot plot,
     tree and network legends were black squares while the marks differed by symbol. A legend
     swatch now takes its marks' form: a short line, dashed in forced colors as the line is, or
     the series' symbol in Plot's order (circle, cross, diamond, square, star, triangle, wye).
     In ordinary colors the swatches now match the marks too.
   - **The network's groups were told apart by color alone.** Nodes now take a symbol per
     group, as the tree's tips do.
   The record is repeated for each release: the visual suite fails on any change to a stored
   forced-colors screenshot, and new or changed screenshots are read before they are stored.

## Not done here

- The tactile file is a start for a transcriber, not a finished tactile graphic: BANA asks for
  point symbols at least 6 mm, keys before the graphic and fewer than five textures per page,
  which need judgment about the chart. A drawing with many series or points will still need a
  transcriber's hand.
- No reader of tactile graphics has tried the file yet, so the format is reasoned from the
  guidelines, not observed.
- The dumbbell's two ends are hollow and filled, and its legend still shows squares in both;
  its marks were readable in the record, and its two values are named in the summary.
