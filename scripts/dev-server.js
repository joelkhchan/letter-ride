// scripts/dev-server.js — DEV-ONLY static server + playtest logger. Run via `npm run playtest`.
// Serves the repo (so the game loads) AND accepts POST /log, appending each JSON event to
// logs/playtest-<timestamp>.jsonl. The in-game logger (src/playlog.js) posts here; Claude reads
// the log file to review a playtest. NOT part of the shipped app — purely a local dev harness.
import { createServer } from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 63500;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.map': 'application/json',
};

const LOGDIR = join(ROOT, 'logs');
await mkdir(LOGDIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOGFILE = join(LOGDIR, `playtest-${stamp}.jsonl`);

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try { await appendFile(LOGFILE, body.trim() + '\n'); } catch {}
      res.writeHead(204, cors); res.end();
    });
    return;
  }

  // static file serving (path-traversal guarded)
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = normalize(join(ROOT, p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const data = await readFile(fp);
    res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Letter Ride playtest server on http://localhost:${PORT}`);
  console.log(`logging events to ${LOGFILE}`);
});
