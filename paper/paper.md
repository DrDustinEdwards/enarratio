---
title: "Abscissa: accessible, server-rendered charts and scientific figures for the web"
tags:
  - TypeScript
  - data visualization
  - accessibility
  - scientific figures
  - virology
authors:
  - name: Dustin Edwards
    orcid: 0000-0001-6409-8041
    affiliation: 1
affiliations:
  - name: Tarleton State University, United States
    index: 1
date: 28 September 2026
bibliography: paper.bib
---

<!-- Draft written for submission after six months of public use. Not yet submitted. -->

# Summary

Abscissa is a TypeScript library that draws charts and scientific figures on
the server, as HTML and SVG that are complete before any script runs. Each
figure carries a required written description, an equivalent data table and
hover details that work without JavaScript, and takes its colors from a site
theme through CSS custom properties, so one rendering follows light and dark
mode. An optional browser module adds keyboard navigation, click-to-filter
events, range brushing and animated updates, all announced to screen readers
and disabled under reduced-motion preferences. Alongside bar, line, area,
scatter, heatmap and network charts, Abscissa includes figures common in
virology and immunology, beginning with antibody titer plots and genome
tracks, which share the same theming, accessibility and interaction.

# Statement of need

Research groups increasingly publish results, teaching material and
surveillance dashboards as websites rather than PDFs. Their figures should be
readable by everyone who visits, including people using screen readers or
keyboards and people with color vision deficiencies, and by the programs that
index and summarize the web. Figures specific to a field, such as titer plots
with geometric mean titers and limits of detection, or genome maps with
strand-oriented features, are also needed on these sites and are usually
redrawn by hand for each one.

# State of the field

Most web charting libraries draw in the browser: the figure is absent until
its script runs, invisible to search engines and other programs that read
HTML, and usually opaque to screen readers. Grammar-of-graphics libraries such
as Observable Plot [@plot] and Vega-Lite [@vegalite] can render static SVG,
but leave accessible structure, site theming across color schemes and
interaction to each user. Domain tools such as genome browsers and phylogeny
viewers are full interactive applications rather than figures for a page, and
general libraries do not include titer plots or genome maps.

Abscissa addresses both gaps for developers of research, teaching and
small-organization websites. It makes the accessible result the default
rather than an option: a figure cannot be drawn without a text alternative,
its data table is generated from the values it draws, series are
distinguished by more than hue, and themes are measured for WCAG 2.2 contrast
[@wcag22] and for color differences (CIEDE2000, @sharma2005) under simulated
color vision deficiency [@machado2009]. Because rendering happens on the
server and returns plain HTML strings, it works in any framework and in edge
runtimes such as Cloudflare Workers.

# Software design

Abscissa builds on Observable Plot [@plot] for scales, axes and marks,
rendering into a lightweight server-side DOM, and on d3-force [@d3] for
deterministic network layouts. Every chart is a function from typed options to
a string; field names are checked by TypeScript against the data's type, and
invalid input throws with the chart, row and field rather than drawing a
misleading figure. Charts contain no colors, only references to theme
properties, so a site's theme is a stylesheet included once per page. The
enhancement layer reads keys the server writes on each drawn datum and uses
the roving-tabindex keyboard pattern of the WAI-ARIA Authoring Practices
[@apg]. Scientific statistics (for example the geometric mean titer with its
Student's t confidence interval) are separate, tested, exported functions, so
text and tables can quote the same numbers as the figure.

The library is tested with unit tests of every chart, stored server output of
every gallery example, automated accessibility audits with axe-core [@axe] in
a headless browser in light and dark themes with and without script, and
visual regression comparisons.

# Research impact statement

Abscissa was built for the websites of a virology research and teaching
program, starting with an interactive curriculum vitae and laboratory
dashboards. Planned scientific figures include dose-response and growth
curves, endpoint dilution titrations, gel-style band plots, phylogenetic
trees and county-level surveillance maps.

# AI usage disclosure

The software, tests and documentation, including drafts of this paper, were
written by Claude Opus 5.5 (`claude-opus-5-5`), a large language model by
Anthropic, run through the Claude Code agent, directed by the author's written
brief and later decisions. The author defined the problem, requirements and
design decisions. After the first versions were published and the repository
made public, two independent AI reviews (Fable 5.1, `claude-fable-5-1`, and
Claude Opus 5.5, both by Anthropic; not human peer review) examined the code,
and their findings were fixed in version 0.1.0-alpha.6. The repository's
`docs/AI_USAGE.md` records the tools, models, sequence of events and where AI
was used.

# Acknowledgements

<!-- To be completed by the author. -->

# References
