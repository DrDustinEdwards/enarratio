# Contributing to Abscissa

Thank you for helping. Abscissa welcomes bug reports, questions, chart
requests, documentation fixes and code. Everyone taking part follows the
[code of conduct](CODE_OF_CONDUCT.md).

## Asking a question or reporting a problem

Open an [issue](https://github.com/DrDustinEdwards/abscissa/issues/new/choose).
For a bug, include the chart function, the options (with a small dataset that
shows the problem), what you expected and what you got. The templates ask for
exactly this. Report security problems privately, as described in
[SECURITY.md](SECURITY.md).

## Proposing a chart type or a change to the API

Open an issue first and describe the figure: who uses it, a published example,
and what its data looks like. New chart types follow the architecture in
[docs/design/0005-scientific-charts.md](docs/design/0005-scientific-charts.md).
A change to how Abscissa works (not just what it draws) gets a new design
record in `docs/design/`.

## Making a change

1. Fork the repository and create a branch.
2. `npm ci`. Development needs Node.js 24, which runs the TypeScript scripts
   directly.
3. Make the change, with tests. Every chart and primitive has unit tests; a
   new public function also needs a section in `docs/api.md` (a test checks),
   an example in `examples/` (which the gallery and the rendering tests pick
   up), and a changelog entry under "Unreleased".
4. Run the checks:

   ```sh
   npm run typecheck
   npm run lint          # npm run format fixes formatting
   npm test              # unit, rendering and documentation tests
   npm run build && npm run gallery
   npm run test:browser  # accessibility, interaction and visual tests
   ```

   If you changed what a chart looks like on purpose, update the stored
   output with `npx vitest run -u` (markup) and
   `UPDATE_SNAPSHOTS=1 npm run test:browser` (images), and check the diff.
   Visual images are compared per platform, and only Linux images (CI's
   platform) are committed, so on Windows or macOS the visual comparison is
   skipped unless you create local images with `UPDATE_SNAPSHOTS=1`. CI's
   Linux images come from a failed CI run's `visual-output` artifact or the
   "Visual snapshots" workflow, and a maintainer commits them after looking at
   each one.
5. Open a pull request. The template lists what reviewers look for. CI must
   pass.

## Standards

- TypeScript in strict mode; no `any`; every public export documented.
- Errors are thrown with the chart, row and field, never swallowed or turned
  into a quietly wrong chart.
- Charts never set a color directly: they use the theme's custom properties.
- Every chart has a required `alt`, a data table, and does not rely on color
  alone.
- Dependencies are pinned to exact versions. A new dependency needs a reason
  in the pull request.
- No em dashes in code, comments or documentation (a house style).

## Releases

Maintainers release by updating `CHANGELOG.md` and the version in
`package.json` following [Semantic Versioning](https://semver.org/), tagging
`vX.Y.Z`, and publishing to npm.

## Use of AI tools

If you use AI tools to prepare a contribution, say so in the pull request and
describe how you checked the result. The project's own record is in
[docs/AI_USAGE.md](docs/AI_USAGE.md).
