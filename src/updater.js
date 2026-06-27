// src/updater.js — over-the-air self-update (Android only; a no-op in a browser / on the web).
//
// Self-hosted via GitHub Releases: the build-apk workflow publishes the web bundle (bundle.zip) and a
// manifest (latest.json) to a fixed "ota" release, and bakes www/ota.json into each build carrying that
// build's monotonic version + the manifest URL. On launch we compare the running bundle's baked version
// to the manifest; if the manifest is newer we download + apply it via @capgo/capacitor-updater.
//
// The plugin is NATIVE, so on-device it's reachable as the runtime global
// window.Capacitor.Plugins.CapacitorUpdater — no bundler needed, so this stays a no-build app.
// notifyAppReady() confirms the running bundle is healthy; a bad bundle that never calls it is
// auto-rolled-back by the plugin to the previous good one.

export async function initUpdater() {
  const Updater = window.Capacitor?.Plugins?.CapacitorUpdater;
  if (!Updater) return;                                   // browser / non-native: nothing to update
  try { await Updater.notifyAppReady(); } catch { /* older plugin / already acknowledged */ }

  let cfg;
  try {
    cfg = await (await fetch('./ota.json', { cache: 'no-store' })).json();    // baked into the bundle by CI
  } catch { return; }                                     // no ota.json (e.g. a plain dev build) → skip
  if (!cfg?.manifestUrl) return;

  try {
    const remote = await (await fetch(cfg.manifestUrl, { cache: 'no-store' })).json();   // { version, url }
    if (!remote?.url || !(Number(remote.version) > Number(cfg.bundleVersion || 0))) return;  // up to date / offline
    const bundle = await Updater.download({ url: remote.url, version: String(remote.version) });
    await Updater.set(bundle);                            // apply now → reloads the webview into the new bundle
  } catch { /* offline, fetch error, or download failed → keep running the current bundle */ }
}
