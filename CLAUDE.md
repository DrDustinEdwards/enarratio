# CLAUDE.md - enarratio

Enarratio draws accessible, server-rendered charts and scientific figures into the HTML: the npm package `enarratio` and its gallery at https://enarratio.dustinedwards.info. Public research software, headed for a JOSS submission after the Capsid paper.

## Rules that come first

- The portfolio rules are in Capsid: `capsid/conventions.md`. Read it with this file. Where they disagree, conventions wins.
- The npm package stays independent of Capsomer (it ships its own themeable CSS); the gallery site adopts Capsomer (capsid/decisions.md, 2026-10-02).
- Design records are `docs/design/0001` onward. A new decision gets the next number; a reversal says which record it replaces.
- **AI disclosure (JOSS).** Commits and pull requests carry no AI attribution (portfolio rule). The disclosure lives in `docs/AI_USAGE.md` instead: every release adds the tools and model ids used and what they did, before it is published. That file is the record a JOSS reviewer reads.

## Commands

- `npm run check`: typecheck, Biome lint and unit tests. The quick local check.
- `npm run test:browser`: the browser suite. Runs in CI.
- `npm run build`: the package (TypeScript and CSS). `npm run size`: the bundle size check.
- `npm run gallery`: builds the gallery into `site/dist`.

## Releases and deploys

- Every change is in `CHANGELOG.md`. The package publishes with the `next` tag until 1.0; the API may change before then and every change is recorded.
- The gallery deploys on every push to `main` (`.github/workflows/gallery.yml`); `npm run deploy:gallery` deploys by hand. A merge to `main` is a gallery deploy.
- `wrangler.jsonc` is committed on purpose: it holds no account id or secret (wrangler takes the account from the login).
