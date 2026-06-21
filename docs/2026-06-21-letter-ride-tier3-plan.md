# Letter Ride — Tier 3 (Android Delivery via Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Package the (proven-fun) web game as an installable Android APK via Capacitor — scaffolding everything that is version-controllable and deterministic, and documenting the toolchain-dependent final build the author runs on their Mac.

**Scope honesty:** the AI build agent **cannot produce or run the APK** — that requires JDK + Android Studio/SDK + a device/emulator on the author's machine. Tier 3 therefore delivers: (1) committed Capacitor config + deps + a `www`-assembly script, (2) a thorough `BUILD-ANDROID.md` with exact commands + prerequisites, (3) confirmation the dictionary asset path is WebView-compatible. The generated `android/` project and the APK are produced by the author running the documented one-time steps; they are **not** verified by the build agent.

**Architecture:** Capacitor wraps the existing static web app in a native WebView. `webDir` points at a `www/` directory assembled from `index.html` + `src/` + `assets/` by a tiny Node copy script (`npm run cap:copy`) — this keeps the "no bundler" principle (it's a file copy, not a transpile) while avoiding shipping `node_modules/`/`docs/` into the APK. `localStorage` works in the WebView, so save/resume + MetaState persist on-device.

**Tech Stack:** Capacitor 6.x (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`), JDK 17, Android SDK (via Android Studio).

## Global Constraints

- **No bundler / no transpile.** The `www`-assembly is a plain file copy. The game code ships as the same ES modules served in dev.
- **Asset path:** `dictionary.loadFromFile('assets/enable1.txt')` is a *relative* path; under Capacitor it resolves against the WebView document origin (`www/index.html`), so `www/assets/enable1.txt` must exist. The copy script guarantees it. No code change.
- **Determinism / save:** localStorage persists in the Android WebView — `'letterRide.run'` + `'letterRide.meta'` survive app restarts. No change needed.
- **Gitignore:** `www/` and `android/` are generated — keep them git-ignored (Task 0's `.gitignore` already ignores `android/`; add `www/`).
- **The build agent does NOT run `npm install`, `npx cap add android`, or the Gradle build** — those are documented for the author (toolchain-dependent, heavy, unverifiable headlessly).

## File Structure (Tier 3)

| File | Responsibility | New/Mod |
|---|---|---|
| `package.json` | + Capacitor deps + `cap:copy`/`cap:sync` scripts. | Mod |
| `capacitor.config.json` | appId/appName/webDir. | New |
| `scripts/build-www.js` | Assemble `www/` from index.html + src/ + assets/. | New |
| `.gitignore` | + `www/`. | Mod |
| `BUILD-ANDROID.md` | Prerequisites + exact build/install commands. | New |
| `www/`, `android/` | Generated (git-ignored). | — |

---

### Task 22: Capacitor scaffolding + build doc

**Files:** Modify `package.json`, `.gitignore`; create `capacitor.config.json`, `scripts/build-www.js`, `BUILD-ANDROID.md`.
**No unit tests** (config + docs + a copy script). Verification = `node scripts/build-www.js` produces a correct `www/`, and `npm test` still passes (unchanged). The native build is the author's documented step.

- [ ] **Step 1: `package.json`** — add Capacitor deps + scripts (keep existing `test`, `serve`, `analyze`):

```json
{
  "name": "letter-ride",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "serve": "npx --yes serve .",
    "analyze": "node scripts/analyze-builds.js",
    "cap:copy": "node scripts/build-www.js",
    "cap:sync": "npm run cap:copy && npx cap sync"
  },
  "dependencies": {
    "@capacitor/core": "^6.1.0",
    "@capacitor/android": "^6.1.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.1.0"
  }
}
```

- [ ] **Step 2: `capacitor.config.json`** (committed):

```json
{
  "appId": "com.letterride.game",
  "appName": "Letter Ride",
  "webDir": "www"
}
```

- [ ] **Step 3: `scripts/build-www.js`** — assemble `www/` (pure Node fs, no deps):

```javascript
// scripts/build-www.js — assemble the Capacitor webDir from the static game files.
// Copies index.html + src/ + assets/ into www/. Run via `npm run cap:copy`.
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const www = new URL('../www/', import.meta.url);

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
cpSync(new URL('../index.html', import.meta.url), new URL('../www/index.html', import.meta.url));
cpSync(new URL('../src/', import.meta.url), new URL('../www/src/', import.meta.url), { recursive: true });
cpSync(new URL('../assets/', import.meta.url), new URL('../www/assets/', import.meta.url), { recursive: true });

const dict = new URL('../www/assets/enable1.txt', import.meta.url);
if (!existsSync(dict)) { console.error('ERROR: www/assets/enable1.txt missing — dictionary not copied'); process.exit(1); }
console.log('www/ assembled: index.html + src/ + assets/ (dictionary present)');
```

- [ ] **Step 4: `.gitignore`** — add `www/` (a generated dir) below the existing entries.

- [ ] **Step 5: `BUILD-ANDROID.md`** — the author's one-time toolchain steps:

```markdown
# Building the Letter Ride Android APK

The game is a static web app wrapped by Capacitor. These steps run on **your Mac**
(the AI build agent scaffolded the config but cannot run the native toolchain).

## Prerequisites (one-time)
- **JDK 17** (`brew install openjdk@17`)
- **Android Studio** (includes the Android SDK + an emulator). Open it once and let it install the SDK.
- A physical Android phone with **USB debugging** on, or an emulator (AVD) created in Android Studio.

## First build
```bash
npm install                 # installs Capacitor (one time)
npm run cap:copy            # assembles www/ from index.html + src/ + assets/
npx cap add android         # one-time: generates the android/ native project
npm run cap:sync            # copies www/ into the native project (re-run after any code change)
npx cap open android        # opens Android Studio
```
In Android Studio: select your device/emulator and press **Run** (▶). The app installs and launches.

## APK file (without Android Studio)
```bash
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
# install on a connected device: adb install app/build/outputs/apk/debug/app-debug.apk
```

## After changing game code
```bash
npm run cap:sync            # re-copies www/ into android/, then `npx cap open android` + Run
```

## Notes
- `localStorage` persists in the WebView, so your in-progress run (`letterRide.run`) and
  meta-progression (`letterRide.meta`) survive app restarts — same as the web version.
- The ~2 MB ENABLE dictionary is bundled in the APK (it's in `www/assets/`).
- `www/` and `android/` are git-ignored (generated). Only the config + scripts are committed.
```

- [ ] **Step 6: Verify (agent-runnable parts only)** — run `node scripts/build-www.js`; confirm it prints success and `www/assets/enable1.txt` exists and `www/index.html` + `www/src/` are present. Run `npm test` — still green (no logic changed). Do NOT run `npm install`/`npx cap`/Gradle (author's toolchain step).

- [ ] **Step 7: Commit** — `git add package.json capacitor.config.json scripts/build-www.js .gitignore BUILD-ANDROID.md && git commit -m "feat: Capacitor Android scaffolding + build doc (www assembly, config, prerequisites)"` (do NOT commit `www/` — it's git-ignored).

> **🛑 TIER 3 GATE (author).** On your Mac: install the prerequisites, run the documented first-build, and confirm the APK installs and the game plays on-device (meta-shop → run → shop → save/resume across app restarts). This is the only tier whose deliverable the build agent could not verify end-to-end.

---

## Self-Review (plan author)

- **Spec coverage (design §10 Tier 3 + §11 Capacitor):** webDir assembly → `build-www.js`; config → `capacitor.config.json`; dictionary asset path → confirmed relative, copied into `www/assets/` (Step 3 guard); localStorage persistence → noted (no change needed); deps + scripts → `package.json`; build steps → `BUILD-ANDROID.md`.
- **Honesty:** the plan explicitly states the APK build is the author's toolchain step and unverified by the agent; the agent verifies only the `www` assembly + that tests still pass.
- **No-bundler principle kept:** `cap:copy` is a file copy, not a transpile; the shipped code is the same ES modules.
- **Placeholder scan:** all files have complete content; the one "manual" step (the native build) is documented with exact commands + prerequisites, not hand-waved.
