# Releasing Enarratio

A release is staged on npm by GitHub Actions and goes live only when a maintainer approves it.
No npm token is stored: the workflow `.github/workflows/release.yml` signs in to npm with
trusted publishing (OIDC), npm attaches a provenance statement that links the package to the
commit and workflow that built it, and `npm stage publish` holds the version until it is
approved with 2FA.

npm's documentation, read 2026-10-10:

- Trusted publishing: https://docs.npmjs.com/trusted-publishers
- Staged publishing: https://docs.npmjs.com/staged-publishing
- The `npm stage` command: https://docs.npmjs.com/cli/v11/commands/npm-stage
- Provenance: https://docs.npmjs.com/generating-provenance-statements
- Revoking tokens: https://docs.npmjs.com/revoking-access-tokens

## One-time setup on npmjs.com

Do A shortly before the first release made this way: npm expires a new trusted publisher that has
not been used within 2 days, and it then has to be deleted and added again.

**A. Add the trusted publisher.**

1. Sign in at https://www.npmjs.com and open the `enarratio` package.
2. Click **Settings**.
3. In **Trusted Publisher**, under **Select your publisher**, click **GitHub Actions**.
4. Fill in:
   - **Organization or user:** `DrDustinEdwards`
   - **Repository:** `enarratio`
   - **Workflow filename:** `release.yml` (the file name only, with `.yml`)
   - **Environment name:** leave empty
   - **Allowed actions:** staged publishing only. Leave `npm publish` and `npm dist-tag`
     unticked, so CI can never put a version live without your approval.
5. Save. npm does not check these values when you save; a typo shows up only as a failed release.

**B. Turn off token publishing,** after the first staged release has worked:

1. On the package's **Settings** page, open **Publishing access**.
2. Select **Require two-factor authentication and disallow tokens**.
3. Click **Update Package Settings**.

Trusted publishing keeps working: it does not use a token. Publishing by hand from your own
terminal with your passkey keeps working too.

**C. Revoke npm tokens that are no longer needed,** after B:

1. On npmjs.com, click your avatar, then **Access Tokens**.
2. Delete every token that can publish `enarratio`, above all any granular token with
   "bypass 2FA" and any classic Automation or Publish token. A read-only token used elsewhere
   can stay.
3. On GitHub, open the repository's **Settings > Secrets and variables > Actions** and delete
   any `NPM_TOKEN` secret if one exists. No workflow on `main` reads one.

## Each release

1. **Prepare the release in a pull request.** Set the version in `package.json` and
   `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`), move the `[Unreleased]`
   entries in `CHANGELOG.md` under the new version and date. Merge it once CI is green.
2. **The merge makes the tag.** The Release workflow sees the new version on `main`, tags that
   commit `vX.Y.Z`, publishes a GitHub release with the version's CHANGELOG section, and stages
   the package. Nobody pushes a tag. (A version that merged before this existed is released with
   **Actions > Release > Run workflow** on `main`. A hand-pushed `vX.Y.Z` tag still works too.)
3. **Watch the Release workflow.** Click **Actions**, then **Release**. It checks that the
   tag matches `package.json` and is on `main`, runs the typecheck, lint, tests, build and size
   check, and stages the package. A red run stages nothing.
4. **Review and approve on npm.** Sign in at https://www.npmjs.com and open the
   **Staged Packages** tab. Open the `enarratio` version, look over its files, and click
   **Approve**. npm asks for 2FA (your passkey). From a terminal instead:
   `npm stage list enarratio`, `npm stage download <stage-id>` to inspect the tarball, then
   `npm stage approve <stage-id>`.
5. **Check it is live.** The package page shows the new version under the `next` tag and a
   provenance section naming this repository and `release.yml`.
6. **Start the consumer bumps.** A tag the workflow made starts no other workflow, and a hand-pushed
   tag ran **bump-consumers** before the version was live, so either way start it now. Click **Actions**, then **bump-consumers**, then **Run workflow**, untick
   **dry_run**, and run it.

## When something goes wrong

- **The Release workflow fails with "Unable to authenticate" (ENEEDAUTH).** The trusted
  publisher settings in A do not match: check the user, repository and workflow filename
  exactly, case included.
- **The staged version is wrong.** Reject it on the Staged Packages tab, or with
  `npm stage reject <stage-id>`. Fix it in a pull request and release the next version.
- **The tag does not match `package.json`.** Delete the tag on GitHub (**Releases**, or
  **Tags**), fix the version in a pull request, and tag again.

The dist-tag comes from `publishConfig.tag` in `package.json` (`next` until 1.0) and is fixed
once a version is staged.
