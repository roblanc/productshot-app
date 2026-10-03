import assert from "node:assert/strict";
import test from "node:test";
import { HOME, navigationTarget, popupTarget, userAgent } from "../policy.mjs";

const DODO = "https://checkout.dodopayments.com/buy/pdt_123";
const FUNCTION = "https://gsgextlyupemaoxcoqqv.supabase.co/functions/v1/dodo-checkout?return=1";

test("the editor's own pages stay in the window", () => {
  assert.equal(navigationTarget(HOME, "https://getproductshot.com/about"), "app");
  assert.equal(navigationTarget(HOME, "https://www.getproductshot.com/pricing"), "app");
});

test("checkout leaves for Dodo and comes back through Supabase, all in the window", () => {
  assert.equal(navigationTarget(HOME, DODO), "app");
  assert.equal(navigationTarget(DODO, "https://acs.examplebank.com/3ds/challenge"), "app");
  assert.equal(navigationTarget("https://acs.examplebank.com/3ds/challenge", FUNCTION), "app");
  assert.equal(navigationTarget(FUNCTION, "https://getproductshot.com/?checkout=success"), "app");
});

test("somebody else's page linked from the editor opens in the browser", () => {
  assert.equal(navigationTarget(HOME, "https://chromewebstore.google.com/detail/x"), "external");
  assert.equal(navigationTarget(HOME, "https://unsplash.com/@someone"), "external");
  assert.equal(navigationTarget(HOME, "mailto:support@getproductshot.com"), "external");
});

test("nothing but https loads in the window", () => {
  assert.equal(navigationTarget(HOME, "http://getproductshot.com/"), "block");
  assert.equal(navigationTarget(HOME, "file:///etc/passwd"), "block");
  assert.equal(navigationTarget(HOME, "javascript:alert(1)"), "block");
  assert.equal(navigationTarget(HOME, "not a url"), "block");
});

test("the offline page can only go back to the site", () => {
  const offline = "file:///Applications/Product%20Shot.app/Contents/Resources/app.asar/offline.html";
  assert.equal(navigationTarget(offline, HOME), "app");
  assert.equal(navigationTarget(offline, "https://example.com/"), "block");
});

test("new windows always open in the browser", () => {
  assert.equal(popupTarget("https://getproductshot.com/support"), "external");
  assert.equal(popupTarget("https://unsplash.com/"), "external");
  assert.equal(popupTarget("mailto:support@getproductshot.com"), "external");
  assert.equal(popupTarget("file:///tmp/x"), "block");
  assert.equal(popupTarget("about:blank"), "block");
});

test("the user agent keeps the browser's and adds the app's", () => {
  assert.equal(userAgent("Mozilla/5.0 Chrome/140", "1.2.3"), "Mozilla/5.0 Chrome/140 ProductShotDesktop/1.2.3");
});
