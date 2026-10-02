# Design records

These records explain why Enarratio is built the way it is: the problem, who it
is for, and the choices that shape the code. They are written for reviewers,
contributors and future maintainers, and for the Journal of Open Source
Software review, which asks authors to show the human framing of the problem
and the design decisions behind the software.

Each record says where a decision came from:

- **Author's decision**: set by Dustin Edwards in the project brief of
  2026-09-28, quoted where it matters.
- **Implementation choice**: made while building the first version to carry
  out an author's decision, by the AI model that wrote the code (see
  [docs/AI_USAGE.md](../AI_USAGE.md)). These are the ones most open to change,
  and the ones the two AI reviews of 0.1.0-alpha.5 tested hardest.

| Record | Subject |
|---|---|
| [0001](0001-problem-and-audiences.md) | The problem and the audiences |
| [0002](0002-server-rendering.md) | Charts are drawn on the server, as HTML strings |
| [0003](0003-theming-and-color.md) | Themes, CSS custom properties and color checks |
| [0004](0004-enhancement-layer.md) | The optional enhancement layer |
| [0005](0005-scientific-charts.md) | Scientific chart types and the plan for the rest |
| [0006](0006-api-and-quality.md) | API shape, errors, dependencies and tests |
| [0007](0007-site-migrations.md) | What moving each existing site onto Enarratio involves |
| [0008](0008-gallery-hosting.md) | Hosting the gallery, and its Content-Security-Policy |
| [0009](0009-review-fixes.md) | What the two reviews changed, and why |
| [0010](0010-rename-to-enarratio.md) | The rename from Abscissa to Enarratio |
| [0011](0011-theming-from-outside.md) | Theming from outside: the custom property contract and the base rules |
| [0012](0012-subpath-exports.md) | One package, subpath exports, optional peers |
| [0013](0013-forecasts-and-time-bars.md) | Forecast bands, the forecast boundary and time-axis bars |
| [0014](0014-timeline-and-heat-strip.md) | The event timeline and the heat strip |
| [0015](0015-primitive-companions.md) | Companion tables for the primitives |
| [0016](0016-remove-the-site-theme.md) | The dustinedwards.info theme is removed |

A new record is added when a decision changes; an old one is not rewritten
except to link to the record that supersedes it.
