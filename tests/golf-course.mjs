// Can every hole of the mini golf course be played? (Oct 7: the golden course.) A plain player tries, in the page's own
// physics: at each stroke it tries 72 headings at 5 strengths from where the ball lies, keeps the putt that sinks it or else
// the one that ends nearest the cup by the way round (walls and water in the way, pipes taken), and goes on; a hole passes if
// it is sunk within par + 3. It is not a good player, so this says only that no hole is impossible or absurd; its strokes
// against par are printed, to show which holes are hard.
//
//   node tests/golf-course.mjs
//   LIBS_DIR=path/node_modules node tests/golf-course.mjs     three.js and chess.js from local copies
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
const server = await new Promise(ok => { const s = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try { const body = await readFile(join(ROOT, path || 'index.html')); res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
if (process.env.LIBS_DIR){
  const lib = f => readFile(join(process.env.LIBS_DIR, f));
  await page.route(/three\.module\.min\.js/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('three/build/three.module.js') }));
  await page.route(/chess\.js@1\.4\.0/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('chess.js/dist/esm/chess.js') }));
}
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/games.html?app=minigolf`, { waitUntil: 'load' });
await page.waitForFunction(() => window.getFieldApp && window.getFieldApp() && window.getFieldApp().name === 'mini golf', null, { timeout: 60000 });
const report = await page.evaluate(() => {
  const D = window.getFieldApp()._debug, { HOLES, NX, NY, CW } = D, out = [];
  for (let k = 0; k < HOLES.length; k++){
    const H = HOLES[k];
    // the way round to the cup, cell by cell: walls and water block, pipes carry
    const dist = new Map(), key = (i, j) => i + ',' + j, ci = Math.floor(H.cup.x / CW), cj = Math.floor(H.cup.y / CW), q = [[ci, cj]];
    dist.set(key(ci, cj), 0);
    const pipes = (H.toys || []).filter(T => T.pipe).map(T => T.pipe);
    while (q.length){ const [i, j] = q.shift(), d = dist.get(key(i, j));
      const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
      for (const p of pipes) if (Math.floor(p[2] / CW) === i && Math.floor(p[3] / CW) === j) nb.push([Math.floor(p[0] / CW), Math.floor(p[1] / CW)]);   // backwards: in at the mouth, out here
      for (const [a, b] of nb){ if (a < 0 || b < 0 || a >= NX || b >= NY || '#~'.includes(H.map[b][a]) || dist.has(key(a, b))) continue; dist.set(key(a, b), d + 1); q.push([a, b]); } }
    const score = b => { const d = dist.get(key(Math.floor(b.x / CW), Math.floor(b.y / CW))); return (d == null ? 99 : d) + Math.hypot(b.x - H.cup.x, b.y - H.cup.y) / CW * 0.3; };
    const clone = g => JSON.parse(JSON.stringify({ ...g, R: { start: k, card: [] } }));
    let g = D.holeGame({ start: k, card: [] }, k), strokes = 0, sunk = false;
    g.t = 0;
    const play = (g0, a, p) => {
      const g1 = clone(g0); g1.pull = { x: -Math.cos(a) * 0.4 * p, y: -Math.sin(a) * 0.4 * p };
      if (!D.putt(g1)) return null;
      for (let n = 0; n < 2400 && g1.state === 'play' && (g1.moving || n < 2); n++) D.step(g1, 1 / 120);
      return g1;
    };
    for (; strokes < H.par + 3 && !sunk; strokes++){
      let best = null, bs = Infinity;
      for (let ai = 0; ai < 72 && !sunk; ai++) for (const p of [0.22, 0.4, 0.58, 0.78, 1]){
        const g1 = play(g, ai / 72 * 2 * Math.PI, p); if (!g1) continue;
        if (g1.state === 'sunk'){ sunk = true; best = g1; break; }
        const s = score(g1.ball); if (s < bs){ bs = s; best = g1; }
      }
      if (best) g = best;
    }
    out.push({ hole: k + 1, name: H.name, par: H.par, strokes, sunk });
  }
  return out;
});
let bad = 0;
for (const r of report){ const ok = r.sunk && r.strokes <= r.par + 3; if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(r.hole).padStart(2)} ${r.name.padEnd(16)} par ${r.par}: ${r.sunk ? r.strokes + ' strokes' : 'not sunk in ' + r.strokes}`); }
if (errors.length){ bad++; console.log('uncaught: ' + errors.join(' · ')); }
await browser.close(); server.close();
console.log(bad ? `\n${bad} hole(s) failed` : '\nevery hole can be played');
process.exit(bad ? 1 : 0);
