// Product Shot for Mac: one window onto getproductshot.com.
//
// Everything the editor does still happens in the page, so this file only
// decides what loads in the window, what goes to the browser, and what the
// menu bar says. `policy.mjs` holds those decisions.

import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOME, navigationTarget, popupTarget, userAgent } from "./policy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const smokeTest = process.argv.includes("--smoke-test");

let win = null;

function openExternal(url) {
  shell.openExternal(url).catch((error) => console.error("[desktop] could not open", url, error));
}

function createWindow() {
  win = new BrowserWindow({
    backgroundColor: "#eaf1fa",
    height: 900,
    // Below 1067px the site switches to its phone layout. The window stays
    // above that, so the Mac app is always the desktop editor.
    minHeight: 640,
    minWidth: 1100,
    show: false,
    title: "Product Shot",
    width: 1440,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const contents = win.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    if (popupTarget(url) === "external") openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const target = navigationTarget(contents.getURL(), url);
    if (target === "app") return;
    event.preventDefault();
    if (target === "external") openExternal(url);
  });

  // Redirects are checked too: a checkout return is a chain of them.
  contents.on("will-redirect", (event, url) => {
    if (navigationTarget(contents.getURL(), url) === "block") event.preventDefault();
  });

  // No connection, or the site is down. -3 is a navigation the page aborted
  // on purpose, which is not a failure.
  contents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    console.error(`[desktop] could not load ${url} (${code})`);
    if (smokeTest) app.exit(1);
    win.loadFile(path.join(here, "offline.html"));
  });

  win.once("ready-to-show", () => {
    if (!smokeTest) win.show();
  });

  win.on("closed", () => {
    win = null;
  });

  win.loadURL(HOME);
  return win;
}

// Runs on the build machine before a DMG is made: the app must start, reach
// the site, render the editor and be able to encode the H.264 that MP4 export
// uses. Exits 0 or 1 and never shows a window.
async function runSmokeTest(window) {
  const fail = (why) => {
    console.error(`[smoke] FAIL: ${why}`);
    app.exit(1);
  };
  setTimeout(() => fail("timed out"), 60_000);

  await new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  const result = await window.webContents.executeJavaScript(`(async () => {
    const started = Date.now();
    while (document.querySelectorAll("#root *").length < 100 && Date.now() - started < 30000) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const nodes = document.querySelectorAll("#root *").length;
    let encoded = 0;
    let encoderError = null;
    try {
      const encoder = new VideoEncoder({
        output: () => { encoded += 1; },
        error: (e) => { encoderError = String(e); },
      });
      const config = {
        codec: "avc1.640028", width: 1280, height: 720, bitrate: 4000000,
        framerate: 60, latencyMode: "quality", alpha: "discard", avc: { format: "avc" },
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (!support.supported) throw new Error("H.264 High not supported");
      encoder.configure(support.config);
      const canvas = new OffscreenCanvas(1280, 720);
      const ctx = canvas.getContext("2d");
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = "hsl(" + i * 40 + ", 80%, 50%)";
        ctx.fillRect(0, 0, 1280, 720);
        const frame = new VideoFrame(canvas, { timestamp: i * 16666 });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
      }
      await encoder.flush();
      encoder.close();
    } catch (e) {
      encoderError = encoderError || String(e);
    }
    return { encoded, encoderError, nodes, ua: navigator.userAgent, url: location.href };
  })()`);

  console.log("[smoke]", JSON.stringify(result));
  if (!result.url.startsWith(HOME)) return fail(`ended on ${result.url}`);
  if (result.nodes < 100) return fail(`the editor did not render (${result.nodes} nodes)`);
  if (!result.ua.includes("ProductShotDesktop/")) return fail("user agent token missing");
  if (result.encoderError || result.encoded === 0) {
    return fail(`H.264 encode failed: ${result.encoderError || "no chunks"}`);
  }
  console.log("[smoke] OK");
  app.exit(0);
}

function buildMenu() {
  const goHome = () => win?.loadURL(HOME);
  const history = () => win?.webContents.navigationHistory;
  return Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "History",
      submenu: [
        { accelerator: "CmdOrCtrl+[", click: () => history()?.canGoBack() && history().goBack(), label: "Back" },
        { accelerator: "CmdOrCtrl+]", click: () => history()?.canGoForward() && history().goForward(), label: "Forward" },
        { type: "separator" },
        { accelerator: "CmdOrCtrl+Shift+H", click: goHome, label: "Editor" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { click: () => openExternal("https://getproductshot.com/support"), label: "Product Shot Support" },
        { click: () => openExternal("mailto:support@getproductshot.com"), label: "Email Support" },
      ],
    },
  ]);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    app.userAgentFallback = userAgent(app.userAgentFallback, app.getVersion());
    Menu.setApplicationMenu(buildMenu());
    const window = createWindow();
    if (smokeTest) runSmokeTest(window);
  });

  // A Mac app stays running with no window; the dock icon brings one back.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (!win) createWindow();
  });
}
