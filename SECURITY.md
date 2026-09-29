# Security policy

Abscissa turns data into HTML, so the kind of problem most likely to matter is
markup injection: caller data that escapes its attribute or text and becomes
markup or script in the page. Every caller-supplied string is escaped, and the
rendering tests check that no example output contains scripts or event
handler attributes.

## Supported versions

Security fixes are made on the latest release.

## Reporting a vulnerability

Please report privately through GitHub's
[private vulnerability reporting](https://github.com/DrDustinEdwards/abscissa/security/advisories/new)
rather than a public issue. Include the chart function, the options that
cause the problem and what they produce. You can expect an acknowledgement
within a week, and a fix or a plan within thirty days.
