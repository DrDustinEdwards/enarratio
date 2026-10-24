# 0019. The gallery's page is Capsomer's

Status: accepted, 2026-10-23.

## Decision

**Author's decision (Dustin Edwards).** The gallery site adopts Capsomer, the family design
system, and the npm package stays independent of it (CLAUDE.md, "Rules that come first"). Until
now the gallery drew its own page: a heading, a text link per theme, a "Dark" button that set
`data-scheme`, and colours taken from the chart theme on show.

## Implementation choices

1. **Capsomer around the charts, the page's theme on them.** The page is Capsomer's fonts,
   tokens and base, its site header (written by hand, as `site-header.md` shows), page head,
   panels and disclosures. Each chart sits in a panel whose body is painted with the page's own
   chart theme background (`--enarratio-background`), so the charts look as that theme draws
   them and the theme's contrast checks still describe what a reader sees. The theme's
   stylesheet is unlayered, so it wins over Capsomer's mapping of the `--enarratio-*`
   properties (`capsomer/tokens.css`), which is layered.
2. **Capsomer's theme button replaces the "Dark" button.** It sets `data-theme`, remembers the
   choice, and `theme.js` applies a remembered choice in the head before first paint. The test
   of the old button (F17) is gone: the button is Capsomer's and is tested there.
3. **Files, not inline.** `scripts/gallery.ts` writes `capsomer.css` (Capsomer's CSS with its
   imports written in place, and two faces from `@fontsource`), and bundles `site/gallery.js`
   and `site/theme.js` with rolldown, Capsomer's behaviour included and `enhance.js` left as
   its own file. The Content-Security-Policy of [0018](0018-shared-security-headers.md) is
   unchanged.
4. **Dev dependencies only.** `capsomer` (pinned to a tag), `@fontsource/schibsted-grotesk` and
   `@fontsource/martian-mono`. Nothing under `src/` imports them.

## Consequences

The visual snapshots are of the charts alone, but a chart is now as wide as a panel's body, so
they were rendered again on CI (the "Visual snapshots" workflow) and committed.
