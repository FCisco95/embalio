// LIVE-ONLY: requires the AdsPower desktop app running with the given profile
// already authenticated on x.com. Cannot be exercised in unit tests; verify
// manually once AdsPower is installed. See handoff for tuning notes.

import { chromium } from "playwright-core";
import { AdsPowerClient } from "./adspower";

export async function postTweetViaAdsPower(
  adspowerUserId: string,
  text: string,
  client = new AdsPowerClient(),
): Promise<{ url: string }> {
  const { wsEndpoint } = await client.start(adspowerUserId);
  try {
    const browser = await chromium.connectOverCDP(wsEndpoint);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://x.com/compose/post", { waitUntil: "domcontentloaded" });
    // X's compose textarea has a stable test id; fall back to the first textbox.
    const editor = page.locator('[data-testid="tweetTextarea_0"]').or(page.getByRole("textbox").first());
    await editor.click();
    await editor.fill(text);
    // Post (Ctrl+Enter is X's submit shortcut)
    await page.keyboard.press("Control+Enter");
    // Wait for navigation to the posted status; best-effort URL capture.
    await page
      .waitForURL(/\/status\/\d+/, { timeout: 30000 })
      .catch(() => console.warn("postTweetViaAdsPower: timed out waiting for /status/ URL; post may be unconfirmed"));
    const url = page.url();
    // Drop the Playwright/CDP wire; client.stop() (finally) shuts the AdsPower browser.
    await browser.close().catch(() => {});
    return { url };
  } finally {
    await client.stop(adspowerUserId);
  }
}
