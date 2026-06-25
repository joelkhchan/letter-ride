// src/playlog.js — DEV playtest logging. Fire-and-forget POST of structured gameplay events to the
// dev server's /log endpoint (scripts/dev-server.js), which appends them to logs/playtest-*.jsonl
// for review. Active ONLY on localhost, so the shipped APK / a plain static host never posts.
// Presentation-only, never imported by logic modules; failures are swallowed.

const DEV = (() => {
  try { return ['localhost', '127.0.0.1'].includes(location.hostname); } catch { return false; }
})();

let _seq = 0;
const _session = (() => {
  try { return new Date().toISOString().slice(11, 19).replace(/:/g, '') + '-' + Math.random().toString(36).slice(2, 6); }
  catch { return 'sess'; }
})();

// Log a structured event. `type` is the event kind; `data` is event-specific fields.
export function logEvent(type, data = {}) {
  if (!DEV) return;
  try {
    const body = JSON.stringify({ ts: new Date().toISOString(), seq: _seq++, session: _session, type, ...data });
    fetch('/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {}
}
