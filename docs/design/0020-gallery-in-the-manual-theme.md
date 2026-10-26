# 0020. The gallery in the family's manual theme, in rose

Status: accepted, 2026-10-26. Builds on [0019](0019-gallery-on-capsomer.md).

## Decision

**Author's decision (Dustin Edwards).** The gallery joins the family's public sites (dustinedwards.info, Capsid,
Capsomer, Prelum, Carrel) on their shared look: the 1976 NASA Graphics Standards Manual, Capsomer's `manual.css`, with
each site in its own color family. Enarratio's is rose (Capsomer's `data-family="rose"`). It ends with the family
footer, Enarratio lit in the strip of sites.

## Implementation choices

1. **The charts keep their column.** The examples stay in a 52rem column, so every chart is drawn at the width its
   stored images were taken at; the page around them widens to 1180px, and from 75rem the contents sit beside the charts
   as a leader index.
2. **Numbered, not renamed.** Each example's heading is a short name with its number; the sentence that was its heading
   is its description. The leader index names the module each one imports.
3. **Still files, not inline.** The footer is written at build time by Capsomer's `familyFooterHtml`; the
   Content-Security-Policy of [0018](0018-shared-security-headers.md) is unchanged.
