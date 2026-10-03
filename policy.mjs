// What the Mac app lets load in its own window, and what it hands to the
// browser instead. Kept apart from Electron so it can be tested in plain Node.
//
// The app is a window onto the live site rather than a copy of it. That keeps
// the production origin, so sign-in, the Dodo checkout return and the
// `traffic = 'visitor'` rule all keep working, and a push to `main` updates the
// app as well as the site.

export const HOME = "https://getproductshot.com/";

// Appended to the user agent. The site reads it to hide what cannot work in
// the app (Google sign-in, the Chrome extension, the Mac app download itself).
// `src/lib/desktopApp.js` carries the same string; a test holds them together.
export const USER_AGENT_TOKEN = "ProductShotDesktop";

const SITE_HOSTS = new Set(["getproductshot.com", "www.getproductshot.com"]);

// Hosts the editor itself sends the window to: Supabase for auth and the
// billing functions, Dodo for checkout. Anything else linked from the site is
// somebody else's page and opens in the browser.
const APP_HOST_SUFFIXES = [".supabase.co", ".dodopayments.com"];

export function userAgent(base, version) {
  return `${base} ${USER_AGENT_TOKEN}/${version}`;
}

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isSite(url) {
  const parsed = parse(url);
  return Boolean(parsed && parsed.protocol === "https:" && SITE_HOSTS.has(parsed.hostname));
}

function isAppHost(parsed) {
  return SITE_HOSTS.has(parsed.hostname)
    || APP_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix));
}

// A top-level navigation in the app window: "app" keeps it in the window,
// "external" hands it to the default browser, "block" drops it.
//
// From the site, only the hosts above stay in. Once the window has left for
// checkout, every https page stays in, because a card payment can pass through
// a bank's own 3-D Secure page before it returns, and sending that page to the
// browser would strand the payment in a different app.
export function navigationTarget(fromUrl, toUrl) {
  const to = parse(toUrl);
  if (!to) return "block";
  if (to.protocol === "mailto:") return "external";
  if (to.protocol !== "https:") return "block";

  const from = parse(fromUrl);
  // The offline page is a local file; its only way out is Retry, to the site.
  if (!from || from.protocol === "file:") return isSite(toUrl) ? "app" : "block";
  if (!isSite(fromUrl)) return "app";
  return isAppHost(to) ? "app" : "external";
}

// window.open and target="_blank". The editor has a single window, so a new
// one is always somebody else's page: help links, attributions, the store.
export function popupTarget(url) {
  const parsed = parse(url);
  if (!parsed) return "block";
  if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:") {
    return "external";
  }
  return "block";
}
