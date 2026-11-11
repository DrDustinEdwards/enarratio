# 0037. A primitive's drawing downloads as any chart's does

Status: accepted, 2026-11-11. Replaces the sentence of [0035](0035-chart-toolbar.md) that gave a
primitive's figure a toolbar with only "Download CSV".

## Problem

A sparkline, uptime strip, heat strip, progress ring or timeline in a figure had a Download menu
holding one item, "Download CSV", while every other chart's menu also held SVG, PNG, tactile SVG
and Copy embed. The layer skipped these figures (`data-enarratio-static`) because they have no
points to read or filter, so the same menu did less on some charts than on others.

## Decision

- The server writes the same Download menu on a primitive's figure as on any chart's: "Download
  CSV", then the drawing's files and, for a figure with an id, Copy embed, inert until the layer
  takes it over (0033, so nothing moves).
- `enhance()` picks up a primitive's figure and builds only its toolbar. A primitive still gets no
  points, tooltip, filter, Sound, Range or Expand: it has nothing to read up close.

## Why

Every chart behaves the same way. Saving a drawing is not interaction with its points, so the
reason the layer skipped primitives does not apply to it.
