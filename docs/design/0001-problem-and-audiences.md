# 0001. The problem and the audiences

Status: accepted, 2026-09-28.

## The problem

Dustin Edwards runs several websites: a personal and academic site
(dustinedwards.info), a genomics resource (Germomics), and dashboards for
Foxhound, Foxing and the Capsid agent control plane. In September 2026 an audit
of their chart code found five approaches for one need:

| Site | How charts were drawn |
|---|---|
| dustinedwards.info | Observable Plot on the server, inside a Worker |
| Germomics | Recharts, in the browser only, behind a placeholder |
| Foxhound | Hand-drawn SVG in React components |
| Foxing | Hand-drawn SVG in a route |
| Capsid dashboard | Hand-drawn SVG and HTML in a browser app |

Each approach had its own gaps. Browser-drawn charts were absent until script
ran and hidden from screen readers. Hand-drawn charts duplicated scales,
ticks and legends, some stretched their text, and most had no text alternative
beyond a nearby number. Colors were set five different ways. None could draw
the figures a virology lab publishes.

**Author's decision.** "Abscissa, one shared charts package used by all of
Dustin's websites, so no site hand-draws a chart again, and research software
for accessible, server-rendered scientific figures on the web."

## Why a new package

Existing libraries each solve part of this. Observable Plot draws excellent
static SVG and runs on a server, but it is a grammar for analysts: it leaves
accessibility, theming across light and dark, interaction and domain chart
types to the caller. Browser libraries (Recharts, Chart.js, ECharts, Vega-Lite
in the browser) need script to show anything. Domain tools (genome browsers,
phylogeny viewers) are large interactive applications, not figures for a page.

Abscissa is the layer between: a small, typed API over Plot and d3-force that
makes the accessible, themed, server-rendered result the default, adds an
optional interaction layer, and adds scientific chart types that share all of
it.

## Audiences

1. **Developers of research and teaching websites**, who need figures on a
   page to be correct, readable and citable, and have no time to hand-draw a
   titer plot or a genome map.
2. **Developers of small-organization dashboards** (Foxhound, Foxing, Capsid),
   who need bars, lines, sparklines, progress rings and uptime strips that
   match their site and work in dark mode.
3. **Readers of those sites**, including people using screen readers,
   keyboards, high zoom, reduced motion or no JavaScript, and people with
   color vision deficiencies. They never install Abscissa but are the reason
   for most of its rules.
4. **Machines that read the web**: search engines and language models, which
   read the HTML without running scripts. **Author's rule** (from the
   dustinedwards.info standing law): "machines get the same facts people do,
   never a thinner version." A server-rendered chart with a data table does
   this; a browser-drawn one does not.

## What success looks like

- No site in the portfolio hand-draws a chart.
- Every chart has a written description and a data table, and passes an
  automated accessibility audit in light and dark.
- A lab can publish a titer plot or genome map with the same few lines as a
  bar chart.
- The package is good enough to pass review at the Journal of Open Source
  Software after six months of public use (**author's decision**).
