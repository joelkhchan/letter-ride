# Letter Ride - Android APK + auto-update

Builds an installable `.apk` **in the cloud** (GitHub Actions - no Android Studio or SDK on your
Mac), and the app **updates itself over-the-air** afterwards. The game is pure web/JS, so once the
APK is on your phone, every push refreshes the game on launch without re-installing.

## How updates reach your phone

- **First install only:** push -> the workflow builds an APK -> you sideload it once.
- **Every change after that:** push -> the workflow republishes the web bundle to the `ota` GitHub
  Release -> on next launch the app sees the newer version, downloads it, and reloads into it. No
  re-install. (You only re-sideload a fresh APK for *native* changes: a new Capacitor plugin, a
  Capacitor version bump, the orientation/colour config, or the app id.)

## One-time setup

1. **Create the GitHub repo and push** (from this folder):
   ```bash
   git add -A && git commit -m "chore: Android APK build + OTA self-update"
   gh repo create letter-ride --private --source=. --push
   ```
   (Private is fine - the workflow's `GITHUB_TOKEN` still publishes the OTA release.)

2. **Set a stable signing key** so rebuilt APKs install over the old app and keep your saved run +
   Meta. Run these yourself (the key never leaves your machine / your repo secrets):
   ```bash
   keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey \
     -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=Android Debug,O=Android,C=US"
   base64 -i debug.keystore | gh secret set DEBUG_KEYSTORE_B64
   rm debug.keystore
   ```
   (Skip this and it still builds, but with an ephemeral key - a later reinstall then won't upgrade
   in place. The OTA path is unaffected either way.)

3. The push triggers the **Build Android APK + publish OTA bundle** workflow automatically.

## Get + install the first APK

- Watch it: `gh run watch` (or the repo's **Actions** tab). ~3-5 min.
- Download the artifact when green:
  ```bash
  gh run download -n letter-ride-apk
  ```
  You get `app-debug.apk`. Transfer it to the phone (USB / Drive / email), tap it, allow installs
  from that source. It runs fully offline (the dictionary + assets are bundled).

## Shipping a change

Just push:
```bash
git add -A && git commit -m "tweak" && git push
```
The workflow rebuilds the APK artifact **and** republishes the OTA bundle. Open the app on your
phone and it pulls the update on launch. (Or trigger the workflow manually from the Actions tab.)

## How it's wired

- `capacitor.config.json` - app id/name, `webDir: www`, navy `backgroundColor`, `CapacitorUpdater`
  in manual mode (`autoUpdate: false` - the app controls the check).
- `npm run cap:copy` (`scripts/build-www.js`) - assembles `www/` (index.html + src/ + assets/,
  verifies the dictionary is present).
- `src/updater.js` - on launch (Android only; a no-op in a browser) reads the bundle's baked
  `ota.json`, compares its version to the `ota` release's `latest.json`, and downloads + applies a
  newer bundle via `@capgo/capacitor-updater`. `notifyAppReady()` guards against a bad bundle (the
  plugin auto-rolls-back if a new bundle never reports healthy).
- `.github/workflows/build-apk.yml` - Node + JDK 17 + Android SDK -> `cap:copy` -> bake `ota.json`
  (repo + run number) -> `cap add/sync android` -> portrait lock -> stable signing -> `assembleDebug`
  -> upload APK artifact -> zip `www/` and publish `bundle.zip` + `latest.json` to the `ota` release.
- `android/`, `node_modules/`, `www/` are generated fresh in CI (git-ignored), so the repo stays small.

> Do **not** delete the `ota` GitHub Release - it's the live update channel your installed app polls.

## App icon (optional)

No custom icon yet, so the build uses Capacitor's default. To brand it: drop a 1024x1024
`resources/icon.png` (deep navy `#0d182e` + gold), commit, and push - the workflow generates the
Android icon set automatically.
