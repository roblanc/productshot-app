// Renders build/icon.svg to the 1024px PNG electron-builder turns into the
// .icns. Run after changing the mark: `node build/render-icon.mjs`. Uses the
// Playwright install of the main project, which is the only browser around.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { chromium } = await import("../../node_modules/playwright/index.mjs");
const svg = readFileSync(fileURLToPath(new URL("icon.svg", import.meta.url)), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { height: 1024, width: 1024 } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.locator("svg").screenshot({
  omitBackground: true,
  path: fileURLToPath(new URL("icon.png", import.meta.url)),
});
await browser.close();
