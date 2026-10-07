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

  // Mini golf's windmill, from the 3d studio (res/windmill.tvf3d beside the page): it loads, its
  // sails are fitted to the toy's arm (reach 1, the item scaled by the arm), they turn with the
  // clock while the tower stands, and the old blades are gone. Then a windmill dropped in
  // replaces it for the session, and one without sails is refused.
  current = 'mini golf windmill';
  const before2 = failures.length;
  await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'mini golf')));
  await page.waitForFunction(() => window.__props.propC('windmill') && window.__props.PROPS.windmill.state === 'ready', null, { timeout: 20000 })
    .catch(() => failures.push(`[${current}] res/windmill.tvf3d did not load`));
  const mill = await page.evaluate(async () => {
    const D = window.getFieldApp()._debug, k = D.HOLES.findIndex(H => (H.toys || []).some(T => T.mill));
    let c = 0, r = 0;
    search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k) break search;
    const kinds = its => its.map(i => i.kind);
    const a = D.cellItems(c, r);
    await new Promise(ok => setTimeout(ok, 400));
    const b = D.cellItems(c, r), M = D.millGeos();
    const box = g => { g.computeBoundingBox(); return g.boundingBox; };
    const P = M.sails.attributes.position.array; let reach = 0;
    for (let i = 0; i < P.length; i += 3) reach = Math.max(reach, Math.hypot(P[i], P[i + 2]));
    const sailA = a.find(i => i.kind === 'millSails'), sailB = b.find(i => i.kind === 'millSails');
    const arm = D.HOLES[k].toys.find(T => T.mill).mill[2];
    const plain = 'TVF3D 2 2\nAa 0.3 0\nAa 0 0\nAb 0 0\nAb 0 0\n';
    const two = 'TVF3D-PARTS 2\nPART tower 1 0 0 0  0 1 0 0  0 0 1 0\n' + plain + 'PART sail_1 1 0 0 0.5  0 0.3 0 0  0 0 0.1 0\n' + plain;
    const ok = await window.loadPieceFiles([new File([two], 'my_windmill.tvf3d')]);
    const local = window.__props.PROPS.windmill.state, swapped = D.millGeos() !== M;
    const no = await window.loadPieceFiles([new File(['TVF3D-PARTS 1\nPART tower 1 0 0 0  0 1 0 0  0 0 1 0\n' + plain], 'windmill2.tvf3d')]);
    // every side face turned out: a one-sided material culls faces turned in (Oct 7, the hole)
    const facing = g => { const P = g.attributes.position.array, I = g.index.array; let out = 0, inn = 0;
      for (let q = 0; q < I.length; q += 3){ const [a, b, c] = [I[q] * 3, I[q + 1] * 3, I[q + 2] * 3];
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        const nx = uy * vz - uz * vy, nz = ux * vy - uy * vx, cx = (P[a] + P[b] + P[c]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
        if (Math.hypot(cx, cz) < 0.05 || Math.abs(nx) + Math.abs(nz) < 1e-12) continue;
        if (nx * cx + nz * cz > 0) out++; else inn++; }
      return { out, inn }; };
    const towerFacing = facing(M.tower);
    return { towerFacing, WD: D.WD, hole: k, kinds: kinds(a), blades: kinds(a).filter(x => x === 'blade' || x === 'hub').length,
             yawA: sailA && sailA.yaw, yawB: sailB && sailB.yaw, scale: sailA && sailA.scale, arm, reach,
             towerTop: box(M.tower).max.y, sailTop: box(M.sails).max.y, parts: M.C.parts.length,
             dropped: ok.done.length, local, swapped, refused: no.bad.length };
  });
  if (!mill.kinds.includes('millSails') || !mill.kinds.includes('millTower') || mill.blades)
    failures.push(`[${current}] hole ${mill.hole + 1} drew ${mill.kinds.join(',')}`);
  if (Math.abs(mill.reach - 1) > 1e-3 || Math.abs(mill.scale * mill.WD - mill.arm) > 1e-9) failures.push(`[${current}] sails reach ${mill.reach}, scale ${mill.scale} (in board widths of ${mill.WD}) for an arm of ${mill.arm}`);
  if (!(mill.yawA != null && mill.yawB != null && mill.yawA !== mill.yawB)) failures.push(`[${current}] the sails did not turn: ${mill.yawA} → ${mill.yawB}`);
  if (!(mill.towerTop > mill.sailTop * 2)) failures.push(`[${current}] the tower (${mill.towerTop}) does not stand over the sails (${mill.sailTop})`);
  if (mill.dropped !== 1 || mill.local !== 'local' || !mill.swapped) failures.push(`[${current}] dropping my_windmill.tvf3d did not replace the windmill`);
  if (mill.towerFacing.inn > mill.towerFacing.out * 0.2) failures.push(`[${current}] the tower's faces turn inward (${mill.towerFacing.inn} in, ${mill.towerFacing.out} out): a one-sided material shows a hole`);
  if (mill.refused !== 1) failures.push(`[${current}] a windmill without sails was not refused`);
  console.log(`${failures.length === before2 ? 'ok  ' : 'FAIL'} ${current} (${mill.parts} parts)`);
  // Two-finger twist turns the view, in every app (Oct 7), but only past a dead zone a panning hand
  // never crosses: a 6° roll turns nothing, a 60° twist turns about 48°, clockwise for clockwise, about
  // the ground at the middle of the screen (where the camera looks stays put).
  current = 'two-finger twist';
  const before3 = failures.length;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const look = () => page.evaluate(() => { const s = window.FIELD_ST;
    return { yaw: s.yaw, x: s.camX, z: s.camZ }; });
  const twist = async deg => {
    const cx = 640, cy = 400, R = 120, pts = a => [0, 180].map((o, id) => ({ x: cx + R * Math.cos((a + o) * Math.PI / 180), y: cy + R * Math.sin((a + o) * Math.PI / 180), id }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
    for (let k = 1; k <= 12; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(deg * k / 12) }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
  };
  for (const name of ['field checkers', 'mini golf']){
    await page.evaluate(n => window.setFieldApp(window.FIELD_APPS.find(a => a.name === n)), name);
    // let the switch's framing finish turning the view first
    for (let k = 0, y = null; k < 40; k++){ await page.waitForTimeout(250); const n = (await look()).yaw; if (n === y && !(await page.evaluate(() => window.FIELD_TARGET.active))) break; y = n; }
    const a = await look(); await twist(6); const b = await look();
    if (Math.abs(b.yaw - a.yaw) > 1e-6) failures.push(`[${current}] ${name}: a 6° roll turned the view ${b.yaw - a.yaw}°`);
    await twist(60); const c = await look();
    const turned = ((c.yaw - b.yaw) % 360 + 540) % 360 - 180;
    if (Math.abs(turned - 48) > 3) failures.push(`[${current}] ${name}: a 60° clockwise twist turned the view ${turned}°, expected about +48°`);
  }
  console.log(`${failures.length === before3 ? 'ok  ' : 'FAIL'} ${current}`);

  // Mini golf: a press held just past the rail (a finger on a ball lying against it) still aims and
  // putts, rather than tilting the view (Oct 7: "long press does not work when the ball is next to the
  // outer margin").
  current = 'mini golf press past the rail';
  const before4 = failures.length;
  const scr = () => page.evaluate(() => {
    const W = window.FIELD_WORLD, T = W.target, cam = W.camera, bW = W.boardW(), L = window.LAB || {};
    const P = (x, z) => { const v = new W.THREE.Vector3(x, 0.02, z).project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
    return { mid: P(T.boardX, T.boardZ), out: P(T.boardX + bW * (L.cellW || 1) * 0.54, T.boardZ), shown: !!T.shown };
  });
  const golf = () => page.evaluate(() => { const g = [...window.getFieldApp()._debug.games.values()].find(g => g.state === 'play');
    return { strokes: g ? g.strokes : null, moving: g ? !!g.moving : null, pitch: window.FIELD_ST.pitch }; });
  const at = q => [{ x: q.x, y: q.y, id: 0 }];
  let S = await scr();
  await page.evaluate(() => { const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); window.getFieldApp().onCellTap(f.c, f.r); });
  await page.waitForTimeout(300);
  S = await scr();
  const g0 = await golf();
  if (!S.shown || g0.strokes == null) failures.push(`[${current}] starting a round on the framed hole failed (${JSON.stringify({ S, g0, n: await page.evaluate(() => [...window.getFieldApp()._debug.games.values()].map(g => g.state)) })})`);
  else {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(S.out) });
    await page.waitForTimeout(900);                                  // past the long press
    for (let k = 1; k <= 8; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at({ x: S.out.x + 8 * k, y: S.out.y + 6 * k }) }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const g1 = await golf();
    if (g1.strokes !== g0.strokes + 1) failures.push(`[${current}] a held press past the rail did not putt (strokes ${g0.strokes} → ${g1.strokes})`);
    if (Math.abs(g1.pitch - g0.pitch) > 1e-6) failures.push(`[${current}] it tilted the view instead (${g0.pitch} → ${g1.pitch})`);
  }
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  console.log(`${failures.length === before4 ? 'ok  ' : 'FAIL'} ${current}`);
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
