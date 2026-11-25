/**
 * Cookie consent, and the only reason the analytics tags are allowed to exist.
 *
 * Google Analytics, Microsoft Clarity and the Gravity conversion pixel all used
 * to be inline blocks in the <head> of every page: they ran on load, set their
 * cookies, fingerprinted the device, and started a session replay before the
 * visitor had been asked anything. Declaring that in a privacy policy is not
 * consent, and this product's audience is in the EU.
 *
 * So neither tag is in the markup any more. Nothing analytics-related loads
 * until `analytics` consent is stored, and a refusal is stored too — the point
 * of asking is to stop asking.
 *
 * The rules this has to satisfy, and where each one lives:
 *
 *   - No non-essential tracker before consent. `boot()` is the only caller of
 *     `loadAnalytics`, and it only calls it on a stored "granted".
 *   - Refusing is as easy as accepting. Two buttons, same size, same weight,
 *     same row, neither one styled as the answer we would prefer.
 *   - The choice can be changed. `window.productShotConsent.reopen()`, linked
 *     from the privacy policy.
 *   - No dark pattern on dismissal. There is no X. Closing without answering
 *     would be a non-answer treated as a refusal, and a banner that reappears
 *     forever is worse for the visitor than one that waits for two clicks.
 */
(function () {
  "use strict";

  var KEY = "productshot:consent";
  var GA_ID = "G-SNYYRJJ9PY";
  var CLARITY_ID = "y8s8ty8g47";
  var GRAVITY_ID = "ab907785-49bc-4492-9985-bdc9fd8f46e6";

  // A browser that refuses storage gets the banner every visit and no
  // analytics, which is the safe end of both failures.
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw !== "granted" && raw !== "denied") return null;
      return raw;
    } catch (error) {
      return null;
    }
  }

  function write(value) {
    try {
      window.localStorage.setItem(KEY, value);
    } catch (error) {
      // Nothing to do. The visitor's answer holds for this page either way.
    }
  }

  var loaded = false;

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;

    var ga = document.createElement("script");
    ga.async = true;
    ga.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(ga);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);

    // Microsoft's own snippet, with the queue it installs so calls made before
    // the file arrives are not lost.
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);

    // Gravity, the conversion pixel. It spent one deploy in the <head> of all
    // five pages, ahead of this gate; it lives here now, under the same rule as
    // the other two — it does not exist until the answer is yes.
    //
    // The config has to be set before the file evaluates. The pixel reads
    // `Object.assign({}, DEFAULT_CONFIG, window.GRAVITY_PIXEL_CONFIG || {})`
    // once, at load. The third argument to `gravity("init", ...)` is not a way
    // in: its handler reads `publisherId` and `autoCaptureClicks` and silently
    // ignores everything else, so a setting passed there looks applied and is
    // not. That was checked by reading `processCommand`, not assumed.
    //
    // Three of its defaults are turned off:
    //
    //   enableFingerprinting    — device fingerprinting, on by default.
    //   captureAdvertiserUserId — on by default.
    //   sanitizeUrls            — trims URLs to origin + pathname, but only on
    //                             the paths that call `sanitizeUrl()`. Measured,
    //                             not assumed: of the nine places the pixel sets
    //                             `page_url`, two are wrapped and the landing
    //                             ones (`_landingCtx.href`, `location.href`) are
    //                             raw. A URL with `?utm_source=…` still arrives
    //                             whole. It is set because a partial trim beats
    //                             none, not because it closes the hole.
    //
    // What actually keeps a Stripe `session_id` out of it is the gate, not this
    // config: the pixel loads on a human click, and `AppRoot` strips `checkout`
    // and `session_id` from the URL on mount, long before anyone can answer.
    // Ungated in the <head>, as it shipped for one deploy, that ordering did not
    // hold.
    //
    // Merged under anything already set, so a future page can still override.
    window.GRAVITY_PIXEL_CONFIG = Object.assign(
      {
        captureAdvertiserUserId: false,
        enableFingerprinting: false,
        sanitizeUrls: true,
      },
      window.GRAVITY_PIXEL_CONFIG || {},
    );

    // The vendor's snippet, unchanged apart from being called rather than pasted.
    (function (w, d, t, u, n, a, m) {
      w["GravityPixelObject"] = n;
      w[n] = w[n] || function () { (w[n].q = w[n].q || []).push(arguments); };
      w[n].l = 1 * new Date();
      a = d.createElement(t);
      m = d.getElementsByTagName(t)[0];
      a.async = 1; a.src = u; m.parentNode.insertBefore(a, m);
    })(window, document, "script", "https://code.trygravity.ai/gr-pix.js", "gravity");
    window.gravity("init", GRAVITY_ID);
  }

  var banner = null;

  function dismiss() {
    if (!banner) return;
    banner.parentNode.removeChild(banner);
    banner = null;
  }

  function answer(value) {
    write(value);
    dismiss();
    if (value === "granted") loadAnalytics();
  }

  function styles() {
    if (document.getElementById("ps-consent-style")) return;
    var style = document.createElement("style");
    style.id = "ps-consent-style";
    // Self-contained on purpose: this loads on the editor and on five static
    // pages, each with its own stylesheet and its own idea of what a button
    // looks like. Nothing here reads a variable that might not be defined.
    style.textContent = [
      ".ps-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;",
      "margin:0 auto;max-width:560px;padding:18px 20px;border-radius:16px;",
      "border:1px solid rgba(255,255,255,.14);background:#17151a;color:#f3f1ee;",
      "box-shadow:0 18px 48px rgba(0,0,0,.45);",
      "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13.5px;line-height:1.55;",
      "animation:ps-consent-in 260ms cubic-bezier(.16,1,.3,1) both}",
      "@keyframes ps-consent-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){.ps-consent{animation:none}}",
      ".ps-consent p{margin:0 0 14px}",
      ".ps-consent a{color:#8ab4ff;text-decoration:underline}",
      ".ps-consent-row{display:flex;gap:10px;flex-wrap:wrap}",
      // Same padding, same radius, same font-weight on both. The only
      // difference is colour, and it is not a difference in prominence.
      ".ps-consent button{flex:1 1 140px;padding:10px 16px;border-radius:999px;",
      "border:1px solid rgba(255,255,255,.22);background:transparent;color:#f3f1ee;",
      "font:inherit;font-weight:600;cursor:pointer}",
      ".ps-consent button:hover{border-color:rgba(255,255,255,.45)}",
      ".ps-consent button:focus-visible{outline:2px solid #8ab4ff;outline-offset:2px}",
      ".ps-consent button.ps-accept{background:#f3f1ee;color:#17151a;border-color:#f3f1ee}",
    ].join("");
    document.head.appendChild(style);
  }

  function show() {
    if (banner) return;
    styles();

    banner = document.createElement("div");
    banner.className = "ps-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Cookies");

    var text = document.createElement("p");
    text.innerHTML =
      "We would like to use Google Analytics and Microsoft Clarity to see which " +
      "parts of the editor people struggle with. They set cookies. Your " +
      "screenshots are never recorded &mdash; see our " +
      '<a href="/privacy">privacy policy</a>.';

    var row = document.createElement("div");
    row.className = "ps-consent-row";

    var reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Reject";
    reject.addEventListener("click", function () { answer("denied"); });

    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "ps-accept";
    accept.textContent = "Accept";
    accept.addEventListener("click", function () { answer("granted"); });

    // Reject first in the DOM as well as on screen, so the keyboard reaches it
    // first too.
    row.appendChild(reject);
    row.appendChild(accept);
    banner.appendChild(text);
    banner.appendChild(row);
    document.body.appendChild(banner);
  }

  function boot() {
    var stored = read();
    if (stored === "granted") loadAnalytics();
    else if (stored === null) show();
  }

  // Asked from the privacy policy, so a visitor can change their mind. Clearing
  // the stored answer first means the banner treats it as a fresh question.
  window.productShotConsent = {
    reopen: function () {
      try {
        window.localStorage.removeItem(KEY);
      } catch (error) {
        // The banner still opens; only the memory of it is lost.
      }
      show();
    },
    status: read,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
