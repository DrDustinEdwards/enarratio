# CLAUDE.md - enarratio

Enarratio draws accessible, server-rendered charts into the HTML: the npm package `enarratio` and its gallery at https://enarratio.dustinedwards.info. Public research software, headed for JOSS.

## Rules every repo shares

- **Tests.** Reproduce a reported failure before fixing it: red before, green after.
- **UI copy.** No eyebrows, restating subtitles, intros or hints a label already gives (Dustin, 2026-11-18).
- **Shared code.** Check devkit's [SHARED.md](https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md) before writing anything another repo might have; change it in place.
- **Secrets.** Never commit or print a key or token. AI provider keys stay on the server.
- **Production.** Never deploy, tag, release or run production DDL from a session; a merge deploys. Back up and restore D1 only with d1-dump.

## Rules for this repo

- **Independence.** The npm package stays independent of Capsomer (it ships its own themeable CSS); only the gallery uses Capsomer.

## Commands

- `npm run check`. `npm run test:browser` runs in CI.
