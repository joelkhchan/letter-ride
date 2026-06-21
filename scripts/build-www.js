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
