# 0031. No reading-grade rule

Status: accepted, 2026-11-02. Replaces the reading-grade part of
[0023](0023-the-figure-in-words.md) (decision 2, "author text of 15 words or more above grade 9").

## Problem

Since 0.4, a chart reported its `alt`, `subtitle` or `caption` as an issue (`reading-level`) when
the text was 15 words or more and scored above grade 9 on the Flesch-Kincaid formula (checklist
B19). Under `strict: true` that issue failed a build. WCAG's reading level criterion (3.1.5) is
AAA and advisory, and a formula that counts syllables cannot tell clear writing from unclear: when
dustinedwards.info turned strict charts on, it refused two accurate, plainly written findings
because they contained words like "configurations" and "concurrent".

## Decision

Charts no longer score author text. The `reading-level` issue is gone, so `strict` fails a build
only on problems a reader cannot work around: no `alt`, no title, an unlabeled axis, too many
series or points, or a CSV too large to inline. The text is whatever its author judges best
(Dustin, 2026-11-02).

`readingGrade` stays exported as a measure a caller can use, so the public API does not change in
a patch release; nothing in Enarratio checks text against it.
