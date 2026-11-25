# CLAUDE.md - enarratio

Enarratio draws accessible, server-rendered charts and scientific figures into the HTML: the npm package `enarratio` and its gallery at https://enarratio.dustinedwards.info. Public research software, headed for a JOSS submission after the Capsid paper.

## Rules every repo shares

- **Tests.** Keep the minimal set: a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives. Remove a test that pins design, repeats coverage or never caught a mistake, unless it guards a harm that cannot be undone.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, "this page lets you" intros, hints a label already gives or empty-state essays. Labels, accessible names, errors, one-way warnings and legal text stay (Dustin, 2026-11-18; capsid/conventions.md).
- **Shared code.** Before writing anything another site might have, check https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md. Change shared code in place and delete what the change replaces in the same PR.
- **Browser support.** devkit's docs/browser-support.md: Baseline Widely available freely, Newly available with a small fallback, Limited only feature-detected, no polyfills.
- **Secrets.** Never commit or print a key, token, `.dev.vars` or `.env`.
- **Reproduce first.** Reproduce a reported failure before fixing it; report red before and green after.
- **Deploys.** A merge to the default branch deploys; never deploy from a session.

## Rules for this repo

- The npm package stays independent of Capsomer (it ships its own themeable CSS); the gallery site adopts Capsomer.
- Design records are `docs/design/0001` onward. A new decision gets the next number; a reversal says which record it replaces.

## Commands

- `npm run check`: typecheck, Oxlint and unit tests. The quick local check.
- `npm run test:browser`: the browser suite. Runs in CI.
- `npm run build`: the package (TypeScript and CSS). `npm run size`: the bundle size check.
- `npm run gallery`: builds the gallery into `site/dist`.

## Releases and deploys

- Every change is in `CHANGELOG.md`.
- Merging a version bump to `main` is the release: `.github/workflows/release.yml` tags `vX.Y.Z`, publishes the GitHub release and stages the package on npm (trusted publishing, provenance, no npm token). It goes live only when Dustin approves it on npm with 2FA. No session approves. Steps: `docs/releasing.md`.
- The gallery deploys on every push to `main` once CI passes (ci.yml's `deploy` job, devkit's worker-deploy: live gate on `/health`, rollback on a refusal).
- `wrangler.jsonc` is committed on purpose: it holds no account id or secret (wrangler takes the account from the login).
