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

// Auto-capture uncaught client-side errors + unhandled promise rejections so a crash or back-end
// exception during a playtest lands in the same log (not only the browser console).
if (DEV) {
  try {
    window.addEventListener('error', (e) => logEvent('error', {
      message: String((e && (e.message || (e.error && e.error.message))) || 'error'),
      source: e && e.filename, line: e && e.lineno, col: e && e.colno,
      stack: e && e.error && e.error.stack ? String(e.error.stack).slice(0, 600) : undefined,
    }));
    window.addEventListener('unhandledrejection', (e) => logEvent('error', {
      kind: 'unhandledrejection',
      message: String((e && e.reason && (e.reason.message || e.reason)) || 'rejection'),
      stack: e && e.reason && e.reason.stack ? String(e.reason.stack).slice(0, 600) : undefined,
    }));
  } catch {}
}
