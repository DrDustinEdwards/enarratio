/**
 * The screen reader run (B29): NVDA with Chrome on Windows and VoiceOver with WebKit, Safari's
 * engine, on macOS, each driven by Guidepup on a GitHub runner (.github/workflows/screen-readers.yml).
 * It walks the built gallery (site/dist), served here. withGuidepup runs the tests one at a time in
 * a headed browser, as a screen reader needs.
 */
import { withGuidepup } from "@guidepup/playwright";
import { devices } from "@playwright/test";

const PORT = 4174;

export default withGuidepup({
  testDir: ".",
  testMatch: "*.spec.ts",
  reportSlowTests: null,
  timeout: 5 * 60 * 1000,
  retries: 2,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    // Run from this folder, the config's.
    command: `node serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
  },
  projects: [
    { name: "nvda-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "voiceover-webkit", use: { ...devices["Desktop Safari"] } },
  ],
  reporter: process.env["CI"] ? [["github"], ["list"]] : "list",
});
