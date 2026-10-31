# CLAUDE.md - enarratio

Enarratio draws accessible, server-rendered charts and scientific figures into the HTML: the npm package `enarratio` and its gallery at https://enarratio.dustinedwards.info. Public research software, headed for a JOSS submission after the Capsid paper. Before writing anything another site might have, read what the sites share: https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md (CI's shared-code check fails on a copy).

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- The npm package stays independent of Capsomer (it ships its own themeable CSS); the gallery site adopts Capsomer.
- Design records are `docs/design/0001` onward. A new decision gets the next number; a reversal says which record it replaces.

## Commands

- `npm run check`: typecheck, Biome lint and unit tests. The quick local check.
- `npm run test:browser`: the browser suite. Runs in CI.
- `npm run build`: the package (TypeScript and CSS). `npm run size`: the bundle size check.
- `npm run gallery`: builds the gallery into `site/dist`.

## Releases and deploys

- Every change is in `CHANGELOG.md`.
- Merging a version bump to `main` is the release: `.github/workflows/release.yml` tags `vX.Y.Z`, publishes the GitHub release and stages the package on npm (trusted publishing, provenance, no npm token). It goes live only when Dustin approves it on npm with 2FA. No session approves. Steps: `docs/releasing.md`.
- The gallery deploys on every push to `main` once CI passes (ci.yml's `deploy` job, devkit's worker-deploy: live gate on `/health`, rollback on a refusal); `npm run deploy:gallery` deploys by hand. A merge to `main` is a gallery deploy.
- `wrangler.jsonc` is committed on purpose: it holds no account id or secret (wrangler takes the account from the login).
