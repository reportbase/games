// Smoke test: load games.html in headless Chromium, switch to every app in
// window.FIELD_APPS, and fail if the page throws an uncaught error anywhere.
//
//   npm test                       serves the repo itself on a free port
//   BASE_URL=http://host/ npm test test an already-running server instead
//
//   LIBS_DIR=path/node_modules npm test
//                                  serve three.js and chess.js from local npm
//                                  copies (three@0.128.0, chess.js@1.4.0), for
//                                  a sandbox where the CDNs are blocked
//
// Console errors (a CDN hiccup, the coach's sign-in check) are printed but do
// not fail the run; uncaught exceptions do.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SETTLE_MS = Number(process.env.SETTLE_MS || 1500);   // time each app gets to run
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
                '.wasm': 'application/wasm', '.json': 'application/json' };

function serve(){
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path || 'index.html'));
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

const server = process.env.BASE_URL ? null : await serve();
const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}/`;

const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
if (process.env.LIBS_DIR){
  const lib = f => readFile(join(process.env.LIBS_DIR, f));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.module\.min\.js/, async r =>
    r.fulfill({ contentType: 'text/javascript', body: await lib('three/build/three.module.js') }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/chess\.js@1\.4\.0\/\+esm/, async r =>
    r.fulfill({ contentType: 'text/javascript', body: await lib('chess.js/dist/esm/chess.js') }));
}

let current = 'page load';
const failures = [];
page.on('pageerror', e => failures.push(`[${current}] ${e.message}`));
page.on('console', m => { if (m.type() === 'error') console.log(`  console (${current}): ${m.text().slice(0, 200)}`); });

let code = 0;
try {
  await page.goto(new URL('games.html', base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => Array.isArray(window.FIELD_APPS) && window.FIELD_APPS.length > 0
                                   && typeof window.setFieldApp === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(SETTLE_MS);
  const ids = await page.evaluate(() => window.FIELD_APPS.map(a => a.id || a.name));
  console.log(`page loaded, ${ids.length} apps`);

  for (const id of ids){
    current = id;
    const before = failures.length;
    await page.evaluate(id => window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === id)), id);
    await page.waitForTimeout(SETTLE_MS);
    const active = await page.evaluate(() => { const a = window.getFieldApp(); return a && (a.id || a.name); });
    if (active !== id) failures.push(`[${id}] switching did not take: the active app is ${active}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${id}`);
  }

  // A chess piece of several parts, as the 3d studio exports it, dropped in
  // through the same door as a dragged file. Two cylinders: a wide base and a
  // narrow column standing on it. The test checks the file reads as two
  // parts, that the piece geometry holds both (and sits where the matrices
  // put it), and that a file named after no piece is refused, not guessed.
  current = 'multi-part piece';
  const before = failures.length;
  const got = await page.evaluate(async () => {
    const field = r => 'TVF3D 2 2\nAa ' + r + ' 0\nAa 0 0\nAb 0 0\nAb 0 0\n';
    const text = 'TVF3D-PARTS 2\n'
      + 'PART base 1 0 0 0  0 0.2 0 0  0 0 1 0\n' + field(0.4)
      + 'PART column 1 0 0 0  0 0.8 0 0.2  0 0 1 0\n' + field(0.15);
    const P = window.__pieces;
    const C = P.parseTVF3D(text);
    const g = P.buildFieldGeometry(8, C);
    const one = P.buildFieldGeometry(8, C.parts[0].C);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const ok = await window.loadPieceFiles([new File([text], 'my_knight.tvf3d')]);
    const no = await window.loadPieceFiles([new File([text], 'thing.tvf3d')]);
    return { parts: C.parts.length, names: C.parts.map(p => p.name).join(','),
             verts: g.attributes.position.count, oneVerts: one.attributes.position.count,
             minY: bb.min.y, maxY: bb.max.y, maxX: bb.max.x,
             loaded: ok.done.length, knightParts: (P.FIELDS.n && P.FIELDS.n.parts || []).length,
             refused: no.bad.length };
  });
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  if (got.parts !== 2 || got.names !== 'base,column') failures.push(`[${current}] parsed ${got.parts} parts (${got.names})`);
  if (got.verts !== 2 * got.oneVerts) failures.push(`[${current}] geometry has ${got.verts} vertices, expected ${2 * got.oneVerts}`);
  if (!near(got.minY, 0) || !near(got.maxY, 1) || !near(got.maxX, 0.4))
    failures.push(`[${current}] piece spans y ${got.minY}..${got.maxY}, x to ${got.maxX}; expected 0..1 and 0.4`);
  if (got.loaded !== 1 || got.knightParts !== 2) failures.push(`[${current}] dropping my_knight.tvf3d did not replace the knight`);
  if (got.refused !== 1) failures.push(`[${current}] a file named after no piece was not refused`);
  await page.waitForTimeout(SETTLE_MS);         // let the board rebuild with it
  console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

if (failures.length){
  console.error(`\n${failures.length} failure(s):\n` + failures.map(f => '  ' + f).join('\n'));
  code = 1;
} else {
  console.log('\nall apps loaded without errors');
}
await browser.close();
server?.close();
process.exit(code);
