# AI usage record

The Journal of Open Source Software asks authors to disclose the use of
generative AI in the software and the paper. This is Abscissa's record. It is
updated whenever AI tools are used on the project.

## Tools and models

| Tool | Model (id) | Maker | Used for |
|---|---|---|---|
| Claude Code (Anthropic's command-line coding agent) | Claude Opus 5.5 (`claude-opus-5-5`) | Anthropic | Writing the code, tests, documentation, design records, gallery and the paper draft; fixing review findings; one of the two reviews |
| A separate review session | Fable 5.1 (`claude-fable-5-1`) | Anthropic | One of the two reviews |

## What happened, in order

1. **2026-09-28: the brief.** Dustin Edwards posted a written brief with his
   design decisions: the purpose (one shared, accessible, server-rendered
   charts package for his sites, and research software for scientific
   figures), the technical foundation (Observable Plot on the server, D3 for
   networks), the chart types and the order of the scientific ones, the
   enhancement layer's features, the theming and color-checking requirements,
   the quality bar (strict TypeScript, the test suites, documentation,
   open-source hygiene, JOSS readiness), the licensing, and the instruction
   not to migrate existing sites yet. The design records mark these as
   "author's decisions".
2. **2026-09-28: the first version.** Claude Opus 5.5, run through Claude
   Code, wrote the code, tests, documentation, design records and gallery in a
   private repository, directed by that brief and by Dustin's follow-up
   decisions (the dustinedwards.info theme colors, keeping web analytics on
   the gallery, the code of conduct contact address, and hosting the gallery
   on Cloudflare). It also audited the chart code of the five existing sites
   and proposed the "implementation choices" recorded in `docs/design/`.
3. **2026-09-28: the first customer.** The interactive CV on
   dustinedwards.info fed back two rounds of API issues, fixed in
   0.1.0-alpha.4 and 0.1.0-alpha.5.
4. **2026-09-28: publication.** Dustin published 0.1.0-alpha.0 to npm at
   22:45 UTC and 0.1.0-alpha.5 at 23:15 UTC. The history was rewritten to
   the author's GitHub noreply address and the repository moved to a new,
   public repository the same day.
5. **After publication: two independent AI reviews.** With the repository
   already public and those versions already on npm, pull request #1 was
   reviewed at commit d4fe7b6 by two AI models, separately: Fable 5.1
   (`claude-fable-5-1`, Anthropic; findings A1 to A17) and Claude Opus 5.5
   (`claude-opus-5-5`, Anthropic; findings F1 to F23). The second review was
   by Claude Opus 5.5 because Grok Build, which had been planned, was
   unavailable. These are AI reviews, not human peer review.
6. **0.1.0-alpha.6: the review fixes.** Claude Opus 5.5, through Claude Code,
   fixed the findings in the order Dustin set, each with a regression test
   named for its finding. Three JOSS findings (F21, A17 and F23: development
   history, and the paper's state of the field and impact) are deferred.

## Who decided what

Dustin Edwards made the design decisions: those in the brief, and the
follow-ups listed above. The AI model proposed and wrote everything else, and
the design records distinguish the two.

## How AI output was checked

- Statistics and color formulas are tested against independently published
  values where they exist (WCAG contrast examples, Student's t tables, the
  CIEDE2000 test data of Sharma, Wu and Dalal), and otherwise against
  properties the model must have (grays unchanged by color vision
  simulation), not only against the implementation's own output.
- Accessibility is checked by axe-core in a real browser (including target
  size), and by browser tests of keyboard, pointer and tooltip behavior.
- Rendered output is stored and reviewed as a diff when it changes; hostile
  text is fed through every public function and the result parsed.
- The two AI reviews above found problems the tests had missed; each fix has a
  regression test named for its finding.

## What was not done with AI

No data in the examples or tests is presented as real measurement: example
datasets are labelled "Illustrative data" in their captions, and the genome
example cites its reference sequence.
