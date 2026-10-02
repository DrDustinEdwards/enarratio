# 0016. The dustinedwards.info theme is removed

Status: accepted, 2026-10-02. Supersedes the last section of [0003](0003-theming-and-color.md).

## Decision

**Author's decision (Dustin Edwards, 2026-10-02).** Delete `dustinedwardsTheme` from the
package entirely: dustinedwards.info is being redesigned. The gallery's theming example
becomes a neutral, well-documented example now, and later Capsomer's generated theme.

## Why

A theme named for one site, shipped in a general package, ties Enarratio to that site's
design and to its redesign schedule. The site's tokens were the first test of the theme
contract (0003), and the contract is now documented, tested and shared with sites that
define their own properties (0011). A site's theme belongs in the site.

## Implementation choices

1. **The package ships one theme, `defaultTheme`,** now from `enarratio/themes`. The
   subpath stays (rather than moving `defaultTheme` back to core) because the author put
   themes there, and Capsomer's generated theme will give it a second occupant of a kind
   that is not Enarratio's to ship.
2. **The gallery's second page is a worked example, not a brand.** `examples/themes/example.ts`
   is written to be copied: warm paper, a serif body, gridlines both ways and a violet
   ramp, so the gallery shows a theme far from the default while every chart's markup is
   unchanged. Its comment explains each part of a theme and what `checkTheme` holds it to.
   It lives under `examples/themes/`, not beside the chart examples, because every file in
   `examples/` is rendered as a chart.
3. **Its palette is not tested for its colors.** A test asserts it passes `checkTheme` with
   no errors (it measures; it does not pin a choice), and the gallery lists its warnings,
   as for the default. A few series pairs are still close for some readers, as they are
   for any eight colors; the comment says so rather than claiming otherwise.
4. **The gallery page moved from `/dustinedwards` to `/example`.** The old address now
   gives the gallery's 404 page: it was published for a few days and nothing in this
   repository links to it. The Linux visual images for the old page were deleted and the
   new page's images added.
5. **Earlier records are not rewritten** (0001, 0003, 0007 and 0009 describe the theme as
   it was); this record is the link to what replaced it.
