// src/updater.js — over-the-air self-update (Android only; a no-op in a browser / on the web).
//
// Self-hosted via GitHub Releases: the build-apk workflow publishes the web bundle (bundle.zip) and a
// manifest (latest.json) to a fixed "ota" release, and bakes www/ota.json into each build carrying that
// build's monotonic version + the manifest URL. We compare the running bundle's baked version to the
// manifest; if the manifest is newer we download + apply it via @capgo/capacitor-updater.
//
// The plugin is NATIVE, so on-device it's reachable as the runtime global
// window.Capacitor.Plugins.CapacitorUpdater — no bundler needed, so this stays a no-build app.
// notifyAppReady() confirms the running bundle is healthy; a bad bundle that never calls it is
// auto-rolled-back by the plugin to the previous good one.
//
// IMPORTANT (cold-start gap): Android keeps the WebView alive, so resuming the app from the background
// does NOT reload the page — module-load code runs only on a true cold start. We therefore re-run the
// check on foreground (visibilitychange + Capacitor appStateChange) so a backgrounded app still updates.
//
// Diagnostics: every step records into a persisted state object (see updaterState()), surfaced in
// Settings → Developer. The previous version swallowed all errors silently; now the failing step and
// its message survive even a rollback reload, so an on-device failure is visible.

const SAVE_KEY = 'letterRide.updater';

// In-memory diagnostic state, mirrored to localStorage so it survives a reload / capgo rollback.
const state = {
  status: 'idle',        // idle | unsupported | checking | up-to-date | downloading | applying | offline | error
  trigger: null,         // what kicked off the last check: launch | resume | manual
  currentVersion: null,  // baked bundleVersion of the running bundle
  remoteVersion: null,   // version from the manifest
  manifestUrl: null,
  lastCheck: null,       // human-readable timestamp of the last check
  lastError: null,       // message of the last caught failure (null when healthy)
};

function persist() { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private mode */ } }
function setState(patch) { Object.assign(state, patch); persist(); }

// A read-only snapshot for the diagnostics UI. Restores the last persisted snapshot the first time so
// the panel shows the previous launch's result (e.g. a download error that triggered a rollback).
let restored = false;
export function updaterState() {
  if (!restored) {
    restored = true;
    try { Object.assign(state, JSON.parse(window.localStorage.getItem(SAVE_KEY) || '{}')); } catch { /* ignore */ }
  }
  return { ...state, supported: !!window.Capacitor?.Plugins?.CapacitorUpdater };
}

let inFlight = false;

async function checkForUpdate(Updater, trigger) {
  if (inFlight) return;                                   // a check is already running; don't stack them
  inFlight = true;
  setState({ status: 'checking', trigger, lastError: null, lastCheck: new Date().toLocaleString() });
  try {
    let cfg;
    try {
      cfg = await (await fetch('./ota.json', { cache: 'no-store' })).json();   // baked into the bundle by CI
    } catch (e) {
      setState({ status: 'error', lastError: `ota.json unreadable: ${e?.message || e}` });   // plain dev build → no ota.json
      return;
    }
    setState({ currentVersion: cfg?.bundleVersion ?? null, manifestUrl: cfg?.manifestUrl ?? null });
    if (!cfg?.manifestUrl) { setState({ status: 'error', lastError: 'ota.json has no manifestUrl' }); return; }

    let remote;
    try {
      remote = await (await fetch(cfg.manifestUrl, { cache: 'no-store' })).json();   // { version, url }
    } catch (e) {
      setState({ status: 'offline', lastError: `manifest fetch failed: ${e?.message || e}` });
      return;
    }
    setState({ remoteVersion: remote?.version ?? null });
    if (!remote?.url) { setState({ status: 'error', lastError: 'manifest has no url' }); return; }
    if (!(Number(remote.version) > Number(cfg.bundleVersion || 0))) { setState({ status: 'up-to-date' }); return; }

    try {
      setState({ status: 'downloading' });
      const bundle = await Updater.download({ url: remote.url, version: String(remote.version) });
      setState({ status: 'applying' });
      await Updater.set(bundle);                          // apply now → reloads the webview into the new bundle
    } catch (e) {
      setState({ status: 'error', lastError: `download/apply failed: ${e?.message || e}` });   // keep running current bundle
    }
  } finally {
    inFlight = false;
  }
}

export async function initUpdater() {
  const Updater = window.Capacitor?.Plugins?.CapacitorUpdater;
  if (!Updater) { setState({ status: 'unsupported' }); return; }   // browser / non-native: nothing to update
  try { await Updater.notifyAppReady(); } catch { /* older plugin / already acknowledged */ }

  await checkForUpdate(Updater, 'launch');

  // Re-check when the app returns to the foreground. Android keeps the WebView alive across
  // background/resume, so without this the launch-only check above never fires again and a
  // backgrounded app would sit on a stale bundle until it is fully killed and cold-started.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate(Updater, 'resume');
  });
  try {
    window.Capacitor?.Plugins?.App?.addListener?.('appStateChange', ({ isActive }) => {
      if (isActive) checkForUpdate(Updater, 'resume');
    });
  } catch { /* @capacitor/app not present → visibilitychange already covers it */ }
}

// Manual "check now" for the Settings → Developer diagnostics panel.
export async function checkNow() {
  const Updater = window.Capacitor?.Plugins?.CapacitorUpdater;
  if (!Updater) { setState({ status: 'unsupported' }); return updaterState(); }
  await checkForUpdate(Updater, 'manual');
  return updaterState();
}
