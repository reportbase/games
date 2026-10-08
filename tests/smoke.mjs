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
  // Mini golf's movers (Oct 8: "remove the water fall and water fountain. lets try moving obsticals instead."): shuttles,
  // orbits and gates are drawn and move with the clock, no fountain or waterfall is left, and every hole still has more
  // than one feature of ground.
  current = 'mini golf movers';
  const before5 = failures.length;
  const mv = await page.evaluate(async () => {
    const D = window.getFieldApp()._debug, res = [], KINDS = { shuttle: 'propBumper', orbit: 'propRock', gate: 'gateSeg' };
    for (const [k, H] of D.HOLES.entries()){
      const kinds = Object.keys(KINDS).filter(n => (H.toys || []).some(T => T[n]));
      if (!kinds.length) continue;
      let c = 0, r = 0;
      search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k && !D.games.get(c + '_' + r)) break search;
      const sig = its => its.filter(i => Object.values(KINDS).includes(i.kind)).map(i => i.kind + i.u.toFixed(4) + i.v.toFixed(4) + i.lift.toFixed(4)).join();
      const a = D.cellItems(c, r);
      let moved = false;                                     // (a gate stands up or lies down a while: give it a few seconds)
      for (let q = 0; q < 10 && !moved; q++){ await new Promise(ok => setTimeout(ok, 400)); moved = sig(D.cellItems(c, r)) !== sig(a); }
      res.push({ name: H.name, kinds, drawn: kinds.every(n => a.some(i => i.kind === KINDS[n])), moved,
                 water: a.some(i => /^(drop|foam|ripple|fountBowl|cliff)$/.test(i.kind)) });
    }
    return { res, flat: D.HOLES.filter(H => (H.land || []).length < 2).map(H => H.name), old: D.HOLES.filter(H => (H.toys || []).some(T => T.fountain || T.fall)).map(H => H.name) };
  });
  if (mv.res.length < 6) failures.push(`[${current}] only ${mv.res.length} holes have movers`);
  for (const w of mv.res) if (!w.drawn || !w.moved || w.water) failures.push(`[${current}] ${w.name} (${w.kinds}): drawn ${w.drawn}, moved ${w.moved}, water toys ${w.water}`);
  if (mv.old.length) failures.push(`[${current}] fountains or waterfalls are left on ${mv.old.join(', ')}`);
  if (mv.flat.length) failures.push(`[${current}] holes with one feature of ground or none: ${mv.flat.join(', ')}`);
  console.log(`${failures.length === before5 ? 'ok  ' : 'FAIL'} ${current} (${mv.res.map(w => w.name).join(', ')})`);

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
  console.log(`${failures.length === before4 ? 'ok  ' : 'FAIL'} ${current}`);

  // The bottom row: when every tile fits there is no fisheye, the tiles stand in one even row, in order, centred (Oct 8:
  // "if all subpanels can fit on the bottom panel dont use fisheye and center them. this applies to all applications.")
  current = 'bottom row centred';
  const before6 = failures.length;
  await page.waitForTimeout(600);
  const row = await page.evaluate(() => {
    const st = document.getElementById('boardBrowser');
    if (!st || st.hidden) return null;
    const ts = [...st.querySelectorAll('*')].filter(t => t.parentElement === st && t.style.left && t.style.display !== 'none');
    return { W: st.clientWidth, xs: ts.map(t => parseFloat(t.style.left)).sort((a, b) => a - b) };
  });
  if (!row || row.xs.length !== 4) failures.push(`[${current}] mini golf's row shows ${row ? row.xs.length : 'no'} tiles, expected its 4 numbers`);
  else {
    const gaps = row.xs.slice(1).map((x, i) => x - row.xs[i]), mid = (row.xs[0] + row.xs[row.xs.length - 1]) / 2;
    if (Math.max(...gaps) - Math.min(...gaps) > 1 || Math.abs(mid - row.W / 2) > 1) failures.push(`[${current}] tiles at ${row.xs.map(x => x.toFixed(0)).join(', ')} in ${row.W}: not one even row, centred`);
  }
  console.log(`${failures.length === before6 ? 'ok  ' : 'FAIL'} ${current}`);

  // The first tap on a board you are not on selects it and, in mini golf, tees off (Oct 8: "the first tap should select
  // the board, not the second" / "remove the long press to select board")
  current = 'first tap tees off';
  const before7 = failures.length;
  {
    const N = await page.evaluate(() => {                         // a neighbour well in view (an earlier twist may have turned it)
      const W = window.FIELD_WORLD, T = W.target, [sx, sz] = W.spacing(), f = W.cellAt(T.boardX, T.boardZ);
      for (const [dx, dz] of [[-sx, 0], [sx, 0], [0, sz], [0, -sz]]){
        const v = new W.THREE.Vector3(T.boardX + dx, 0.02, T.boardZ + dz).project(W.camera), x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
        if (x > 80 && x < innerWidth - 80 && y > 80 && y < innerHeight * 0.7) return { x, y, from: f, to: W.cellAt(T.boardX + dx, T.boardZ + dz) };
      }
      return null;
    });
    if (!N) failures.push(`[${current}] no neighbouring board in view`);
    else {
    const playing = () => page.evaluate(to => { const g = window.getFieldApp()._debug.games.get(to.c + '_' + to.r); return g ? g.state : null; }, N.to);
    const held = async () => { await page.waitForTimeout(400); return page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target; return W.cellAt(T.boardX, T.boardZ); }); };
    // a hold and let go no longer moves you (the mouse: a headless touch tap arrives seconds long, so taps are clicks here)
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.mouse.move(N.x, N.y); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
    let now = await held();
    if (!now || now.c !== N.from.c || now.r !== N.from.r) failures.push(`[${current}] a long press went to ${JSON.stringify(now)}`);
    const before = await playing();
    await page.waitForTimeout(700);                                // (not a double with the release above)
    await page.mouse.click(N.x, N.y);
    now = await held();
    const after = await playing();
    if (!now || now.c !== N.to.c || now.r !== N.to.r) failures.push(`[${current}] one tap on ${JSON.stringify(N.to)} left us on ${JSON.stringify(now)}`);
    if (before === 'play' || after !== 'play') failures.push(`[${current}] the round on the tapped hole: ${before} → ${after}, expected it to start on the first tap`);
    }
  }
  console.log(`${failures.length === before7 ? 'ok  ' : 'FAIL'} ${current}`);

  // Round ponds and bunkers, and the skate park (Oct 8)
  current = 'mini golf shapes';
  const before8 = failures.length;
  {
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, CW = D.CW, isl = D.HOLES.find(H => H.name === 'the island'), box = D.HOLES.find(H => H.name === 'the boulders');
      return {
        corner: D.groundAt(isl, 1.06 * CW, 1.06 * CW), mid: D.groundAt(isl, 3.5 * CW, 1.5 * CW),
        sandCorner: D.groundAt(box, 1.04 * CW, 2.04 * CW), sandMid: D.groundAt(box, 2.5 * CW, 3.5 * CW),
        skate: D.HOLES.filter(H => (H.land || []).some(f => f.bowl || f.pipe)).map(H => H.name),
      };
    });
    if (r.corner !== '.' || r.mid !== '~') failures.push(`[${current}] the island's moat: corner ${r.corner}, middle ${r.mid} (wanted grass at the rounded corner, water in the middle)`);
    if (r.sandCorner !== '.' || r.sandMid !== 's') failures.push(`[${current}] the boulders' bunker: corner ${r.sandCorner}, middle ${r.sandMid}`);
    if (r.skate.length < 4) failures.push(`[${current}] skate-park holes: ${r.skate.join(', ')}`);
    // fences, not bushes (Oct 8): every hole one of wood, stone or brick, all three used, fences drawn in their hole's
    // material, walls and rail too; and every cup clear of the rail by a quarter of its width
    const fe = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, P = { RT: D.CW * 0.2, R: 0.042 };
      const mats = D.HOLES.map(H => H.fence), left = D.HOLES.filter(H => (H.toys || []).some(T => T.bush || T.tree)).map(H => H.name);
      const k = D.HOLES.findIndex(H => H.name === 'the fences');
      let c = 0, r = 0; search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k && !D.games.get(c + '_' + r)) break search;
      const kinds = [...new Set(D.cellItems(c, r).map(i => i.kind))], m = D.HOLES[k].fence;
      const close = D.HOLES.filter(H => { const g = P.RT + P.R * 1.5 - 1e-9; return H.cup.x < g || H.cup.y < g || H.cup.x > D.WD - g || H.cup.y > 1 - g; }).map(H => H.name);
      const old = D.editor.cleanSrc({ map: Array(13).fill('........'), toys: [{ tree: [2, 3, 0.26] }, { bush: [4, 6, 0.4] }] });
      return { mats, left, kinds, m, close, oldToys: old && old.toys.length };
    });
    if (fe.left.length) failures.push(`[${current}] bushes or trees left on ${fe.left.join(', ')}`);
    if (!fe.mats.every(m => ['wood', 'stone', 'brick'].includes(m)) || new Set(fe.mats).size !== 3) failures.push(`[${current}] the holes' materials: ${fe.mats.join(',')}`);
    if (!['fence_', 'wall_', 'railV_', 'railH_'].every(p => fe.kinds.includes(p + fe.m)) && !['fence_', 'railV_', 'railH_'].every(p => fe.kinds.includes(p + fe.m))) failures.push(`[${current}] the fences hole (${fe.m}) draws ${fe.kinds.join(',')}`);
    if (fe.close.length) failures.push(`[${current}] cups against the rail: ${fe.close.join(', ')}`);
    if (fe.oldToys !== 2) failures.push(`[${current}] an old link's tree and bush were dropped`);
  }
  console.log(`${failures.length === before8 ? 'ok  ' : 'FAIL'} ${current}`);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  // The hole editor (Oct 8: "yes, build the editor"): a new hole on the selected board, painted with a real drag after
  // choosing a tool on the bar, things placed, undo, Check sets the par, Save keeps it, Share's link opens the page on it.
  current = 'hole editor';
  const before9 = failures.length;
  {
    await page.evaluate(() => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); A.onCellTap(f.c, f.r); });
    const st0 = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const n = A._debug.HOLES.length, ok = E.editStart(null), tiles = A.statTiles(f.c, f.r) || [];
      return { ok, n, k: E.ED.k, tiles: tiles.length, want: 1 + E.TOOLS.length + E.ACTS.length, own: !!document.getElementById('golfEditBar') }; });
    if (!st0.ok || st0.tiles !== st0.want || st0.k !== st0.n || st0.own) failures.push(`[${current}] editStart: ${JSON.stringify(st0)}`);
    // the editor's tools are the bottom panel's tiles: click one that is in view and it is taken up
    const findTile = () => { const st = document.getElementById('boardBrowser'), E = window.getFieldApp()._debug.editor;
      if (!st || st.hidden) return null;
      const ts = [...st.querySelectorAll('*')].filter(t => t.parentElement === st && t._key && /^stat_\d+$/.test(t._key) && t.style.display !== 'none').map(t => ({ i: +t._key.slice(5), r: t.getBoundingClientRect() }))
        .filter(t => t.i >= 1 && t.i <= E.TOOLS.length && t.r.width > 10 && t.r.left > 0 && t.r.right < innerWidth && t.r.top > 0 && t.r.bottom < innerHeight);
      const t = ts[0]; return t ? { i: t.i, x: t.r.left + t.r.width / 2, y: t.r.top + t.r.height / 2, tool: E.TOOLS[t.i - 1][0] } : null; };
    await page.waitForFunction(findTile, null, { timeout: 10000, polling: 200 }).catch(() => {});   // (the row slides up when it opens)
    await page.waitForTimeout(400);
    const tile = await page.evaluate(findTile);
    const why = tile ? null : await page.evaluate(() => { const st = document.getElementById('boardBrowser'); return st ? { hidden: st.hidden, rect: st.getBoundingClientRect().toJSON(), keys: [...st.children].filter(t => t._key).map(t => t._key + ':' + t.style.display).slice(0, 12) } : 'no strip'; });
    if (!tile) failures.push(`[${current}] no tool tile in view on the bottom panel: ${JSON.stringify(why)}`);
    else {
      await page.mouse.click(tile.x, tile.y); await page.waitForTimeout(300);
      const inHand = await page.evaluate(() => window.getFieldApp()._debug.editor.ED.tool);
      if (inHand !== tile.tool) failures.push(`[${current}] clicking the ${tile.tool} tile left ${inHand} in hand`);
    }
    // the row stays up while painting; take up Wall (by its tile) and drag across the middle of the hole with the mouse
    await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onStatTap(f.c, f.r, 1 + E.TOOLS.findIndex(t => t[0] === '#')); });
    const P = await page.evaluate(() => {
      const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB, bWX = bW * L.cellW;
      const S = dx => { const v = new W.THREE.Vector3(T.boardX + dx * bWX, 0.05, T.boardZ).project(W.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
      return { a: S(0.3), b: S(-0.3) };
    });
    await page.mouse.move(P.a.x, P.a.y); await page.mouse.down();
    for (let q = 1; q <= 12; q++){ await page.mouse.move(P.a.x + (P.b.x - P.a.x) * q / 12, P.a.y + (P.b.y - P.a.y) * q / 12); await page.waitForTimeout(20); }
    await page.mouse.up(); await page.waitForTimeout(300);
    const st1 = await page.evaluate(() => { const D = window.getFieldApp()._debug, E = D.editor; return { walls: E.ED.src.map.join('').split('#').length - 1, holeWalls: D.HOLES[E.ED.k].map.join('').split('#').length - 1 }; });
    if (st1.walls < 3 || st1.holeWalls !== st1.walls) failures.push(`[${current}] a drag with Wall painted ${st1.walls} walls (the hole on the board has ${st1.holeWalls})`);
    const st2 = await page.evaluate(async () => {
      const D = window.getFieldApp()._debug, E = D.editor, ED = E.ED, A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tap = (tool, u, v) => { ED.tool = tool; A.onCellTap(f.c, f.r, u, v); };
      tap('rock', 0.25, 0.2); tap('up', 0.7, 0.35); tap('pipe', 0.2, 0.8); tap('pipe', 0.8, 0.3);
      const toys = ED.src.toys.length, land = ED.src.land.length, k = ED.k;
      const kinds = D.cellItems(f.c, f.r).map(i => i.kind);
      tap('kick', 0.6, 0.6); E.editAction('undo');
      const afterUndo = ED.src.toys.length;
      const r = await E.editAction('check');
      E.editAction('save');
      const link = E.shareLink(ED.src), back = E.readLink(new URL(link).searchParams.get('hole'));
      const evil = E.cleanSrc({ name: '<img src=x onerror=alert(1)>', par: 99, map: Array(13).fill('########ZZZ'), toys: [{ rock: ['x', 1, 2] }, { nope: [1] }], land: 'no' });
      return { toys, land, k, hasLand: kinds.includes('land' + k), hasRock: kinds.some(x => /rock/i.test(x)), afterUndo, check: r, par: ED.src.par, msg: ED.msg,
               stored: JSON.parse(localStorage.getItem('golf.myholes') || '[]').length, same: JSON.stringify(back) === JSON.stringify(E.cleanSrc(ED.src)), link,
               evil: evil && { par: evil.par, toys: evil.toys.length, land: evil.land.length, rows: evil.map.every(r => r.length === 8 && /^[.#s~=TO]+$/.test(r)), T: evil.map.join('').split('T').length - 1, O: evil.map.join('').split('O').length - 1 } };
    });
    if (st2.toys !== 2 || st2.land !== 1) failures.push(`[${current}] after a boulder, a hill and a pipe: ${st2.toys} things, ${st2.land} ground`);
    if (!st2.hasLand || !st2.hasRock) failures.push(`[${current}] the board does not draw the edited hole (land ${st2.hasLand}, boulder ${st2.hasRock})`);
    if (st2.afterUndo !== 2) failures.push(`[${current}] undo left ${st2.afterUndo} things`);
    if (!st2.check || !st2.check.sunk || st2.par !== Math.max(2, Math.min(6, st2.check.strokes + 1))) failures.push(`[${current}] Check: ${JSON.stringify(st2.check)}, par ${st2.par}, "${st2.msg}"`);
    if (st2.stored < 1) failures.push(`[${current}] Save kept nothing`);
    if (!st2.same) failures.push(`[${current}] the share link does not carry the hole back`);
    if (!st2.evil || st2.evil.par !== 9 || st2.evil.toys !== 0 || st2.evil.land !== 0 || !st2.evil.rows || st2.evil.T !== 1 || st2.evil.O !== 1) failures.push(`[${current}] a bad link was not cleaned: ${JSON.stringify(st2.evil)}`);
    // a fence by two taps, and Material: the hole is rebuilt in stone
    const st2b = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      ED.tool = 'fence'; A.onCellTap(f.c, f.r, 0.2, 0.6); A.onCellTap(f.c, f.r, 0.6, 0.62);
      const fences = ED.src.toys.filter(T => T.fence).length, m0 = ED.src.fence;
      A.onStatTap(f.c, f.r, 1 + E.TOOLS.length + E.ACTS.findIndex(a => a[0] === 'mat'));
      const kinds = D.cellItems(f.c, f.r).map(i => i.kind);
      return { fences, m0, m1: ED.src.fence, stoneWall: kinds.some(k => /_stone$/.test(k)), stays: A.statsStay() }; });
    if (st2b.fences !== 1 || st2b.m0 !== 'wood' || st2b.m1 !== 'stone' || !st2b.stoneWall || !st2b.stays) failures.push(`[${current}] fence and material: ${JSON.stringify(st2b)}`);
    // shaping the ground (Oct 8): a plateau by a drag, a ramp by a tap, Select a terrace-less piece and drag it, Higher,
    // Delete, Level; and the tool tiles as wide as their widest name
    const sh = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => A.onStatTap(f.c, f.r, 1 + E.TOOLS.findIndex(x => x[0] === t)), act = a => A.onStatTap(f.c, f.r, 1 + E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a));
      const H0 = () => D.HOLES[ED.k], hAt = (cx, cy) => D.rawH(H0(), cx * D.CW, cy * D.CW);
      const n0 = ED.src.land.length;
      tool('plat');                                       // a drag from (1, 2) to (4, 4) in cells, through onPan
      for (const [cx, cy] of [[1, 2], [2, 3], [3, 3.5], [4, 4]]) A.onPan(1, 1, { c: f.c, r: f.r, u: cx / D.NX, v: cy / D.NY });
      A.onPanEnd();
      const plat = ED.src.land.find(g => g.plateau), raised = hAt(2.5, 3) - hAt(6.5, 9);
      tool('ramp'); A.onCellTap(f.c, f.r, 6 / D.NX, 9 / D.NY);
      const ramp = ED.src.land.find(g => g.ramp);
      tool('select'); A.onCellTap(f.c, f.r, 2.5 / D.NX, 3 / D.NY);
      const selKind = ED.sel != null && Object.keys(ED.src.land[ED.sel])[0];
      const before = ED.src.land[ED.sel].plateau.slice();
      for (const [cx, cy] of [[2.5, 3], [3.5, 4], [4.5, 5]]) A.onPan(1, 1, { c: f.c, r: f.r, u: cx / D.NX, v: cy / D.NY });
      A.onPanEnd();
      const moved = ED.src.land[ED.sel].plateau[0] - before[0];
      const h0 = ED.src.land[ED.sel].plateau[4]; act('higher'); const h1 = ED.src.land[ED.sel].plateau[4];
      ED.src.land.push({ tilt: [0.03, 0] }); act('level'); const tilts = ED.src.land.filter(g => g.tilt).length;
      act('del'); const left = ED.src.land.filter(g => g.plateau).length;
      return { n0, plat: !!plat, raised, ramp: !!ramp, selKind, moved, h0, h1, tilts, left };
    });
    if (!sh.plat || !(sh.raised > 0.02) || !sh.ramp) failures.push(`[${current}] plateau and ramp: ${JSON.stringify(sh)}`);
    if (sh.selKind !== 'plateau' || !(sh.moved > 1.5) || !(sh.h1 > sh.h0) || sh.tilts !== 0 || sh.left !== 0) failures.push(`[${current}] select, move, higher, level, delete: ${JSON.stringify(sh)}`);
    const wide = await page.evaluate(() => { const st = document.getElementById('boardBrowser'), A = window.getFieldApp(), E = A._debug.editor;
      const ts = [...st.querySelectorAll('*')].filter(t => t.parentElement === st && t._key && /^stat_\d+$/.test(t._key) && t.style.display !== 'none');
      const c = document.createElement('canvas').getContext('2d'); c.font = '700 17px -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif';
      const need = Math.max(...E.TOOLS.map(t => c.measureText(t[1]).width));
      return { w: ts.length ? Math.min(...ts.map(t => parseFloat(t.style.width))) : 0, need }; });
    if (!(wide.w >= wide.need)) failures.push(`[${current}] tool tiles ${wide.w}px wide for names needing ${wide.need.toFixed(0)}px`);
    // Done (its tile): the editor's tiles go and the hole is played
    await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onStatTap(f.c, f.r, 1 + E.TOOLS.length + E.ACTS.findIndex(a => a[0] === 'done')); });
    const st3 = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const g = [...D.games.values()].find(g => g.hole === E.ED.k), t = A.statTiles(f.c, f.r) || []; return { on: E.ED.on, first: t[0] && t[0].label, state: g && g.state, single: g && g.R.single }; });
    if (st3.on || st3.first !== 'Hole' || st3.state !== 'play' || !st3.single) failures.push(`[${current}] Done: ${JSON.stringify(st3)}`);
    // the share link opens the page on the hole
    await page.goto(st2.link.replace(/^https?:\/\/[^/]+\//, base), { waitUntil: 'load' });
    await page.waitForFunction(() => window.getFieldApp && window.getFieldApp() && window.getFieldApp().name === 'mini golf', null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    const st4 = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onCellTap(f.c, f.r, 0.5, 0.5);                            // the first tap on a board
      const g = D.games.get(f.c + '_' + f.r);
      return { hole: g && g.hole, built: D.editor.BUILT, name: g && D.HOLES[g.hole].name, mine: D.editor.MINE.length}; });
    if (!(st4.hole >= st4.built) || st4.name !== 'my hole') failures.push(`[${current}] the shared link opened ${JSON.stringify(st4)}`);
    if (st4.mine < 1) failures.push(`[${current}] My holes did not survive the reload`);
  }
  console.log(`${failures.length === before9 ? 'ok  ' : 'FAIL'} ${current}`);
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
