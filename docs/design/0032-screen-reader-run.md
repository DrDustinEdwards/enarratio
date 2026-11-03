# 0032. A screen reader run in CI

Status: accepted, 2026-11-03. Replaces the B29 item under "Not done here" in
[0027](0027-contrast-export-and-roles.md).

## Problem

The keyboard and screen reader layer ([0021](0021-native-points-and-reader-controls.md)) was
reasoned from WAI-ARIA and tested in a headless browser's accessibility tree, but never heard: 0027
left a run with real screen readers to Dustin, because the cloud sessions that build Enarratio have
none. A chart could pass every test and still read badly, or not at all, in NVDA or VoiceOver.

## Decision

`.github/workflows/screen-readers.yml` runs `test/screen-reader/charts.spec.ts` with Guidepup
(`@guidepup/playwright`, set up by the `@guidepup/setup` CLI, as Guidepup's own CI does):

- NVDA with Chrome on a Windows runner, and VoiceOver with WebKit (Safari's engine) on a macOS
  runner.
- Against the built gallery, on a bar, a line and a map chart. For each, the reader must say the
  drawing's name (its `alt`) and the overview sentence on its way from the heading into the figure;
  focusing the points must announce the first point with "1 of N" and the next key "2 of N"; and
  "Show data" must open a table the reader announces as one.
- After each release, every night, by hand, and on a pull request that changes the run itself. Not
  on every pull request: a screen reader run takes minutes, and a timing failure there would block
  unrelated work. A red nightly run is the signal.

## Not covered

JAWS (licensed, no runner image has it), TalkBack and iOS VoiceOver (no Android or iOS runner
drives a screen reader) and Narrator. Those still need a person.
