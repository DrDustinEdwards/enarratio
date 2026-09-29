# 0010. The rename from Abscissa to Enarratio

Status: accepted, 2026-09-29. Amends 0008.

## Decision

**Author's decision** (Dustin Edwards, 2026-09-29): the project is renamed
from Abscissa to Enarratio, once and for all. Enarratio is the Roman
grammarian's reading aloud and explanation of a text, which is what the
toolkit does for a figure: it draws it on the server and explains it to
people, screen readers and AI agents. Nothing outside depended on Abscissa
yet, so the rename is clean, with redirects rather than duplicates.

## What changed

- **The npm package** is `enarratio`. 0.1.0-alpha.7 was the alpha.6 code
  under the new name, published first so the name could not be taken;
  0.1.0-alpha.8 renames everything inside the code. The `abscissa` package is
  unpublished.
- **Names in the code and the markup**: the `data-abscissa-*` attributes, the
  `abscissa` CSS classes and custom properties, and the `abscissa:select` and
  `abscissa:brush` events are now `enarratio` in each place. A page that
  styled or listened for the old names needs the new ones; the CHANGELOG
  lists them.
- **The repository** is `DrDustinEdwards/enarratio`. GitHub redirects the old
  address.
- **The gallery** is at `enarratio.dustinedwards.info`. The old hostname,
  `abscissa.dustinedwards.info`, stays attached to the same Worker, which
  answers it with a 301 to the same path on the new one (amends 0008).
- **The contact address** in the code of conduct is
  `enarratio@dustinedwards.info`.
- **The older design records** use the new name. This is the one exception to
  the rule that an old record is not rewritten: only the name changed in
  them, and every decision they record stands as written.

## Where the old name remains, and why

- **The CHANGELOG's entries for 0.1.0-alpha.0 to alpha.7**: they record the
  names those releases shipped with.
- **The gallery Worker's name**, `abscissa-gallery`: a new name would deploy
  a second Worker beside the first and leave the old hostname attached to the
  first. Renaming a Worker is a change in the Cloudflare dashboard, outside
  the repository.
- **The old hostname in `wrangler.jsonc` and `worker/index.ts`**, and in the
  test of its redirect, because the Worker has to recognize it to redirect it.
- **This record**, which has to name what was renamed.
