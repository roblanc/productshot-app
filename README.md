# Product Shot for Mac

A small Electron app that opens https://getproductshot.com in its own window.
It is not a second copy of the editor: the page is the live site, so every
push to `main` updates the app too, and the app itself only changes when this
folder does.

Why a window onto the site rather than a bundled copy: sign-in links, the Dodo
checkout return and the `traffic = 'visitor'` rule in `export_events` are all
tied to the production origin. A bundled copy would run on `file://` and break
all three.

| File | What it does |
| --- | --- |
| `main.mjs` | The window, the menu bar, the offline fallback and `--smoke-test` |
| `policy.mjs` | What loads in the window and what opens in the browser. Pure, tested in `test/` |
| `offline.html` | Shown when the site cannot be reached; retries when the connection returns |
| `build/icon.svg` | The Dock icon. `node build/render-icon.mjs` turns it into `build/icon.png` |
| `scripts/make-dmg.sh` | Signs ad hoc, checks both architectures, runs the smoke test, writes `dist/ProductShot.dmg` |
| `scripts/release.sh` | Publishes this folder and tags it, which starts the build |
| `.github/workflows/release.yml` | The build. It runs in the public repo, not this one |

## What the site does differently inside the app

The app adds `ProductShotDesktop/<version>` to its user agent, and
`src/lib/desktopApp.js` reads it:

- Sign-in opens the email code from the start (`AuthPage.tsx`). The link in the
  email opens the default browser, which is a separate app.
- Google and GitHub sign-in are hidden. Google refuses embedded web views.
- The Chrome extension button is hidden. Its captures open in Chrome.
- The "Mac app" offer in the top bar is hidden.

## Releasing

The DMG is about 100 MB. Cloudflare Pages refuses files over 25 MB, and release
files on the private repo cannot be downloaded without signing in. So the build
and the file live in the **public** repo `roblanc/productshot-app`, on its
`desktop` branch. That repo's default branch is `gh-pages`, which
`npm run deploy` force-pushes, so nothing else may live there.

1. Bump `version` in `desktop/package.json` and commit.
2. `bash desktop/scripts/release.sh`
3. Watch https://github.com/roblanc/productshot-app/actions. A green run creates
   the release `desktop-v<version>` with `ProductShot.dmg` attached and marks it
   latest.

The download link on `/mac` is
`https://github.com/roblanc/productshot-app/releases/latest/download/ProductShot.dmg`,
so it follows the newest release and never needs editing.
`tests/desktop-app.test.mjs` fails if the link, the workflow and the script stop
naming the same file.

The build runs on a GitHub macOS machine, because `codesign` and `hdiutil` are
Apple's tools. It fails without publishing anything unless:

- the binary contains both `arm64` and `x86_64`,
- the signature verifies,
- the smoke test passes. The smoke test starts the app, reaches the site,
  renders the editor and encodes H.264, which MP4 export depends on.

## Locally

```bash
cd desktop
npm install
node node_modules/electron/install.js   # newer npm skips Electron's install script
npm test                                # the navigation rules
npm start                               # opens the app (needs a display)
npm run smoke                           # the same check the build runs
```

On Linux, `xvfb-run -a ./node_modules/electron/dist/electron . --smoke-test --no-sandbox`
runs the smoke test without a screen. `npx electron-builder --linux dir` packs it
the way a release does, inside an asar archive.

## Signing (not done yet)

The app is signed **ad hoc**. That is the least an Apple Silicon Mac will run.
A downloaded copy still shows "Apple could not verify…" the first time, and the
person has to click **Open Anyway** in System Settings → Privacy & Security.
`/mac` explains that step.

To remove that step, you need:

1. The Apple Developer Program ($99/year), and a **Developer ID Application**
   certificate exported as a `.p12`.
2. These secrets on `roblanc/productshot-app`. Set them in GitHub yourself; never
   paste them into a chat:
   - `CSC_LINK`: the `.p12` as base64.
   - `CSC_KEY_PASSWORD`
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`
3. Workflow changes:
   - In `package.json`, set `mac.identity` back to automatic, add
     `hardenedRuntime: true` and `notarize: true`.
   - Pass the five secrets to the build step as environment variables.
   - Drop the ad hoc `codesign` line from `make-dmg.sh`, or electron-builder's
     signature is overwritten.
4. Change the Open Anyway section of `/mac` once a signed build is the latest.
