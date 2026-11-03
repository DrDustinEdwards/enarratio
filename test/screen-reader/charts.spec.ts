/**
 * B29: what NVDA (Windows, Chrome) and VoiceOver (macOS, WebKit) say for a bar, a line and a map
 * chart in the gallery, scripts on. For each chart the reader moves from its heading into the
 * figure and must hear the drawing's name (its alt) and the overview sentence; from the first
 * point the next key must announce "2 of N" and the previous key the first point, "1 of N";
 * the "Show data" table must be announced as a table. JAWS, TalkBack and iOS VoiceOver are not
 * covered: no runner has them (docs/design/0032).
 *
 * Phrases are compared without spaces, case or punctuation, across the whole log, since each
 * reader writes and splits them its own way (NVDA reads an overview as two phrases); the spoken
 * log is printed on failure.
 */
import { type ScreenReaderPlaywright, screenReaderTest as test } from "@guidepup/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

const CHARTS = [
  { id: "stacked-bar", kind: "bar" },
  { id: "line", kind: "line" },
  { id: "dot-map", kind: "map" },
] as const;

// Every phrase the reader speaks, not only what follows a Guidepup command: focusing the points
// and the arrow keys are page events, and the reader's answer to them is what is checked.
test.use({ screenReaderStartOptions: { capture: true } });

const squash = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

async function heard(screenReader: ScreenReaderPlaywright): Promise<string[]> {
  return (await screenReader.spokenPhraseLog()).map(String);
}

async function expectHeard(
  screenReader: ScreenReaderPlaywright,
  phrase: string,
  what: string,
): Promise<void> {
  const log = await heard(screenReader);
  expect(
    squash(log.join(" ")).includes(squash(phrase)),
    `${what}: "${phrase}" in\n${log.join("\n")}`,
  ).toBe(true);
}

/** Moves the reader on until it has said `phrase`, at most `max` moves. */
async function readUntil(
  screenReader: ScreenReaderPlaywright,
  phrase: string,
  max: number,
): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (squash((await heard(screenReader)).join(" ")).includes(squash(phrase))) return;
    await screenReader.next();
    await pause(300);
  }
}

/** The page's facts for one chart, read from the DOM the reader is reading. */
async function facts(section: Locator) {
  const figure = section.locator("figure.enarratio").first();
  const point = figure.locator('[tabindex="0"][aria-label]').first();
  return {
    heading: (await section.locator("h2").first().getAttribute("id")) ?? "",
    alt: ((await figure.locator('svg[role="img"]').first().getAttribute("aria-label")) ?? "").slice(
      0,
      40,
    ),
    overview: ((await figure.locator(".enarratio-overview").first().textContent()) ?? "").trim(),
    first: (await point.getAttribute("aria-label")) ?? "",
  };
}

async function openGallery(page: Page): Promise<void> {
  await page.goto("/index.html", { waitUntil: "load" });
  // The gallery enhances a chart as it nears the viewport: scroll each one in first.
  for (const { id } of CHARTS) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.locator(`#${id} figure[data-enarratio-enhanced]`).first().waitFor();
  }
}

for (const { id, kind } of CHARTS) {
  test(`a ${kind} chart (#${id}) reads its name, overview, points and table`, async ({
    page,
    screenReader,
  }) => {
    await openGallery(page);
    await screenReader.navigateToWebContent();
    const section = page.locator(`#${id}`);
    const f = await facts(section);
    expect(f.first, "the chart has a focusable point").toMatch(/\d+ of \d+$/);

    // From the heading into the figure: the drawing's name and the overview sentence.
    await page.locator(`#${f.heading}`).evaluate((h) => {
      h.setAttribute("tabindex", "-1");
      (h as HTMLElement).focus();
    });
    await pause(1000);
    await screenReader.clearSpokenPhraseLog();
    await readUntil(screenReader, f.alt, 15);
    await expectHeard(screenReader, f.alt, "the drawing's name");
    await expectHeard(screenReader, f.overview, "the overview");

    // Into the points, by the reader's own keys (Guidepup logs what follows its commands): from
    // the first point, the next key must say "2 of N" and the previous key the first point again.
    await section.locator('figure [tabindex="0"][aria-label]').first().focus();
    await pause(1000);
    const total = f.first.match(/of (\d+)$/)?.[1];
    await screenReader.clearSpokenPhraseLog();
    await screenReader.press("ArrowRight");
    await pause(1000);
    await expectHeard(screenReader, `2 of ${total}`, "the next point");
    await screenReader.clearSpokenPhraseLog();
    await screenReader.press("ArrowLeft");
    await pause(1000);
    await expectHeard(screenReader, f.first, "the first point");

    // The data table behind "Show data".
    await screenReader.clearSpokenPhraseLog();
    const summary = section.locator("details.enarratio-data summary").first();
    await summary.focus();
    await pause(500);
    await screenReader.press("Enter");
    await pause(1000);
    await readUntil(screenReader, "table", 6);
    await expectHeard(screenReader, "table", "the data table");
  });
}
