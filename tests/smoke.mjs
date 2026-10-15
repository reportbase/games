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
  /* WHERE TO CLICK FOR A SQUARE (Oct 13): projected from the square's middle, then, if the field would read that pixel as
     another square (a click once landed a row off), the nearest pixel it reads as this one. Returns { x, y, ok }. */
  // (and after a flight to a board, until a board is framed and the camera has stopped: a check that pressed the dots
  //  1.5 s after flying, mid-flight, opened its editor on the board left before, Oct 13)
  await page.evaluate(() => {
    // (still means unchanged at full precision over four looks a quarter second apart; with a board asked for, that board
    //  framed: a glide not yet begun, or creeping, passed a looser test and the click landed a row off, Oct 13)
    window.__settle = async (c, r) => {
      const W = window.FIELD_WORLD, t0 = performance.now(); let a = null, same = 0, there = false;
      for (let k = 0; k < (c == null ? 80 : 240) && same < 4; k++){       // (a flight across boards being recorded can take long on CI)
        await new Promise(ok => setTimeout(ok, 250));
        const p = W.camera.position, T = W.target, f = T.shown ? W.cellAt(T.boardX, T.boardZ) : null;
        there = !!f && (c == null || (f.c === c && f.r === r)); const q = p.x + ',' + p.y + ',' + p.z;
        same = (q === a && there) ? same + 1 : 0; a = q;
      }
      window.__lastSettle = { asked: c == null ? null : [c, r], there, ms: Math.round(performance.now() - t0) };
    };
    window.__still = () => window.__settle();
  });
  await page.evaluate(() => {
    window.__aim = (n, col, row, nh) => {
      nh = nh || n;
      const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - (col + 0.5) / n) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - (row + 0.5) / nh) * bW * (L.cellH || 1)).project(W.camera);
      const x0 = (pv.x + 1) / 2 * innerWidth, y0 = (1 - pv.y) / 2 * innerHeight;
      // (on the screen and on the canvas too: a square's projection off the screen still reads as that square, and a click
      //  there reached nothing, Oct 13)
      const hit = (x, y) => { if (!(x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)) return false; const el = document.elementFromPoint(x, y); if (!el || el.tagName !== 'CANVAS') return false;
        const q = W.uvAt(x, y); return !!q && Math.floor(q.u * n) === col && Math.floor(q.v * nh) === row; };
      if (hit(x0, y0)) return { x: x0, y: y0, ok: true };
      for (let R = 3; R <= 90; R += 3) for (let a = 0; a < 16; a++){ const x = x0 + R * Math.cos(a * Math.PI / 8), y = y0 + R * Math.sin(a * Math.PI / 8); if (hit(x, y)) return { x, y, ok: true }; }
      return { x: x0, y: y0, ok: false };
    };
  });
  const ids = await page.evaluate(() => window.FIELD_APPS.map(a => a.id || a.name));
  console.log(`page loaded, ${ids.length} apps`);

  for (const id of ids){
    current = id;
    const before = failures.length;
    await page.evaluate(id => window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === id)), id);
    await page.waitForTimeout(SETTLE_MS);
    const active = await page.evaluate(() => { const a = window.getFieldApp(); return a && (a.id || a.name); });
    if (active !== id) failures.push(`[${id}] switching did not take: the active app is ${active}`);
    // the three dots are on every game (Oct 9: "always show the triple dots on bottom")
    const dots = await page.evaluate(() => { const h = document.getElementById('bbHandle'), r = h && h.getBoundingClientRect(); return !!(h && getComputedStyle(h).display !== 'none' && r.width > 0 && r.bottom <= innerHeight + 1); });
    if (!dots) failures.push(`[${id}] the three dots are not showing`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${id}`);
  }

  // The turn rail across the top is as tall as the side rails are wide (Oct 10: "the top slider for rotation should be
  // the same height as the side sliders are wide.")
  {
    const rr = await page.evaluate(() => { const g = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect() : null; };
      const y = g('yawZone'), t = g('tiltZone'), h = g('thrustZone'); return y && t && h ? { yaw: y.height, tilt: t.width, thrust: h.width } : null; });
    if (!rr || Math.abs(rr.yaw - rr.tilt) > 0.5 || Math.abs(rr.yaw - rr.thrust) > 0.5) failures.push(`[rails] top rail height vs side rail width: ${JSON.stringify(rr)}`);
  }

  // THE FIELD RESTS WHEN NOTHING CHANGES (Oct 11: "proceed", on "Rest when still"): Sokoban framed and left alone, nothing
  // on any board moving, draws only now and then (a look twice a second); a finger on the screen wakes it to draw every
  // frame; and chess, which plays moves out on its boards itself, never rests. (Sokoban's boards play themselves, and since
  // every board in view is drawn every frame, Oct 12, they are seen to; so here each board's pieces are held as first asked,
  // which makes nothing move. Left as they are, the field draws every frame, as it should.)
  current = 'the field rests when still';
  {
    const before = failures.length;
    const rs = await page.evaluate(async () => {
      const R = window.fieldRest, wait = ms => new Promise(ok => setTimeout(ok, ms));
      const count = async ms => { const d0 = R.drawn, s0 = R.skipped; let f = 0, on = true; const t = () => { f++; if (on) requestAnimationFrame(t); }; requestAnimationFrame(t); await wait(ms); on = false; return { frames: f, drawn: R.drawn - d0, skipped: R.skipped - s0 }; };
      window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'sokoban')); await wait(1000);
      const moving = await count(1500);
      const A = window.getFieldApp(), orig = A.cellItems, kept = new Map();
      A.cellItems = function(c, r, bp){ const k = c + ',' + r; if (!kept.has(k)) kept.set(k, orig.call(this, c, r, bp)); return kept.get(k); };
      await wait(2500);
      const still = await count(2000);
      A.cellItems = orig;
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 }));
      const woke = await count(400);
      window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'field chess') || window.FIELD_APPS[0]); await wait(1500);
      const chess = await count(1500);
      return { moving, still, woke, chess };
    });
    if (!(rs.still.skipped > rs.still.frames * 0.6) || !(rs.moving.drawn >= rs.moving.frames * 0.7) || !(rs.woke.drawn >= rs.woke.frames * 0.7) || rs.chess.skipped)
      failures.push(`[${current}] ${JSON.stringify(rs)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (still: ${rs.still.drawn} of ${rs.still.frames} frames drawn)`);
  }

  // SOKOBAN, EVERY BOARD ITS OWN LEVEL (Oct 12: "what ideas from mini-golf can we extend to the other games." … "ok, proceed"):
  // a board keeps its level and its neighbours have others; the corner block keeps the worked-out levels; dealt levels
  // are levels 1 to 5 by the ring and the Difficulty, their pars (the fewest pushes, from dealing backwards) climb, a
  // forward solve finds the same par, each board's demo ends solved, and a solved board's tap goes on to the next board
  current = 'sokoban boards';
  {
    const before = failures.length;
    const sk = await page.evaluate(async () => {
      window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'sokoban')); await new Promise(ok => setTimeout(ok, 800));
      const A = window.getFieldApp(), D = A._debug, sig = L => Array.from(L.wall).join('') + '|' + L.boxes.join(',') + '|' + Array.from(L.goal).join('');
      const corner = D.boardLevel(0, 0, true), far = [[40, 3], [3, 40], [41, 3]].map(([c, r]) => D.boardLevel(c, r, true));
      const again = D.boardLevel(40, 3, true);
      const lv = [], opt = [], demo = [];
      for (let l = 1; l <= 5; l++){
        const pars = [];
        for (let k = 0; k < 6; k++){ const L = D.makeLevel(3000 + l * 97 + k * 13, l); pars.push(L.par);
          if (l <= 3 && k < 3){ const S = D.solve(L); opt.push(S ? S.pushes === L.par : 'none'); }
          if (k === 0){ const F = D.framesOf(L); demo.push(F[F.length - 1].done && !F[0].done); } }
        lv.push(pars.reduce((a, b) => a + b, 0) / pars.length);
      }
      const idx = D.boardIdx(40, 3), l0 = D.levelAt(idx);
      return { corner: !!corner.classic, same: sig(far[0]) === sig(again), differ: sig(far[0]) !== sig(far[1]) && sig(far[0]) !== sig(far[2]),
               level: far[0].level, l0, lv, opt, demo };
    });
    if (!sk.corner || !sk.same || !sk.differ || sk.level !== sk.l0 || !(sk.lv.every((p, i) => !i || p > sk.lv[i - 1])) || !sk.opt.every(x => x === true) || !sk.demo.every(Boolean))
      failures.push(`[${current}] ${JSON.stringify(sk)}`);
    // the Difficulty moves every dealt board a level; a solved board's tap goes on to the next board
    const sk2 = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, idx = D.boardIdx(40, 3), a = D.levelAt(idx);
      const item = A.menu[0].items[0]; item.on(); const b = D.levelAt(idx); item.on(); item.on();   // (round to where it was)
      const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onCellTap(f.c, f.r); const g = D.games.get(f.c + '_' + f.r);
      const L = g.L, path = L.sol ? null : L.pushes;
      g.player = L.player; g.boxes = L.boxes.slice(); g.solved = false; g.queue = [];
      if (L.sol) for (const ch of L.sol) D.step(g, 'URDL'.indexOf(ch));
      else for (const [at, e] of path){ const n = L.n, Dn = [-n, 1, n, -1]; for (const di of D.path(g, at - Dn[e]) || []) D.step(g, di); D.step(g, e); }
      const solved = g.solved;
      A.onCellTap(f.c, f.r); await new Promise(ok => setTimeout(ok, 1500));
      const f2 = W.cellAt(W.target.boardX, W.target.boardZ);
      return { a, b, solved, from: f, to: f2 };
    });
    if (sk2.b !== Math.min(5, sk2.a + 1) && !(sk2.a === 5 && sk2.b === 5) || !sk2.solved || !sk2.to || (sk2.to.c === sk2.from.c && sk2.to.r === sk2.from.r))
      failures.push(`[${current}] difficulty and the next board: ${JSON.stringify(sk2)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (pars by level ${sk.lv.map(p => p.toFixed(1)).join(', ')})`);
  }

  // LEVELS (Oct 13: "is there is anything we can do in the games project to help show how LOD works? maybe an application
  // devoted to the concept?", then "yes."): it opens looking out toward the horizon with several levels in view; a board's
  // level is the doubling of h/v past the corner; by v/h it draws far fewer triangles than None, and climbing takes in many
  // more boards for about the same count; the row's tiles change the way and the wireframe; leaving it puts the tilt back
  current = 'levels';
  {
    const before = failures.length;
    const pitch0 = await page.evaluate(() => window.FIELD_WORLD.st.pitch);
    await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.name === 'levels'); A._debug.setMode('vh'); window.setFieldApp(A); });
    // (until Levels has drawn: its first frame compiles new shaders, and the software renderer took 4 s over it here and longer
    //  on CI, so a look at a fixed time read the last game's camera and the counts of the app loop's visit, Oct 13)
    await page.evaluate(async () => {
      const A = window.getFieldApp(), W = window.FIELD_WORLD, wait = ms => new Promise(ok => setTimeout(ok, ms));
      for (let k = 0; k < 240; k++){ const R = A._debug.rings, v = W.camera.position.y; if (R && R.visible && v > 6 && Math.abs(R.scale.x - v) < 1e-6) break; await wait(250); }
      await window.__settle();
      const d = window.fieldRest.drawn; for (let k = 0; k < 120 && window.fieldRest.drawn < d + 3; k++) await wait(250);
    });
    const look = () => page.evaluate(() => { const A = window.getFieldApp(), S = A._debug.shown, c = window.FIELD_WORLD.camera.position;
      return { v: c.y, pitch: window.FIELD_WORLD.st.pitch, levels: S.n.filter(Boolean).length, boards: S.n.reduce((a, b) => a + (b || 0), 0), tris: S.t.reduce((a, b) => a + (b || 0), 0),
               rings: !!A._debug.rings && A._debug.rings.visible && Math.hypot(A._debug.rings.position.x - c.x, A._debug.rings.position.z - c.z) < 1e-6 && Math.abs(A._debug.rings.scale.x - c.y) < 1e-6 }; });
    const L0 = await look();
    const lv = await page.evaluate(() => { const D = window.getFieldApp()._debug; return [D.levelAt(0.5, 1), D.levelAt(1, 1), D.levelAt(1.5, 1), D.levelAt(3, 1), D.levelAt(5, 1), D.levelAt(10, 2)]; });
    /* (Oct 13: "don't clamp the tilt in levels. the object in each levels board is not centered. the object in each board should
       be unique, generated from the board Id.") The tilt floor is Levels' own, 2°; each board's body comes from its id, the same
       twice and not another board's; and every triangle faces out of the body (wound inward, the near side was culled and the
       inside of the far side showed, which looked hollow and off the middle) */
    /* (Oct 13: "small H gives good fidelity to nearby objects, large h gives good fidelity to far away objects. … reader has fixed
       number of addresses, so more proportional space means each object is given less level of detail.") H halved twice and
       doubled twice by the row's tiles: the near field's grain is finest at the small H and coarsest at the large one, the far
       field's the other way round, and the reader's addresses are shared out the same, 512 in all */
    const hd = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ), v = W.camera.position.y;
      const tile = name => A.onStatTap(f.c, f.r, A.statTiles(f.c, f.r).findIndex(t => t.value === name));
      const at = () => { const sh = D.shareOf(v * 2 ** D.hs), near = D.grainOf(0, v), far = D.grainOf(D.levelAt(D.farR * 0.75, v), v); return { hs: D.hs, near, far, total: Math.round(sh.n * (1 + sh.lv)) }; };
      const out = { mid: at() }; tile('H smaller'); tile('H smaller'); out.small = at(); tile('H larger'); tile('H larger'); tile('H larger'); tile('H larger'); out.large = at();
      D.setH(0); out.back = D.hs;
      // (Oct 14: "let the user change the leaves of levels … to change ihe image size": More leaves doubles the reader's
      //  addresses and every body is as fine or finer, Fewer halves them; and the boards have no colour of their own)
      out.leaves = { a0: D.ADDR, near0: D.grainOf(0, v) }; tile('More leaves'); tile('More leaves'); out.leaves.a2 = D.ADDR; out.leaves.near2 = D.grainOf(0, v);
      out.leaves.total2 = Math.round(D.shareOf(v).n * (1 + D.shareOf(v).lv)); tile('Fewer leaves'); tile('Fewer leaves'); tile('Fewer leaves'); out.leaves.a1 = D.ADDR; out.leaves.near1 = D.grainOf(0, v);
      D.setLeaves(0); out.leaves.back = D.ADDR; out.plain = A.cellFar && A.cellFar.light === A.cellFar.dark && A.cellFar.light === 0x06080c; return out; });
    const own = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, T = window.FIELD_WORLD.THREE;
      const i0 = D.boardIdx(0, 0), i1 = D.boardIdx(1, 0), i2 = D.boardIdx(0, 1), a = D.bodyOf(i0), b = D.bodyOf(i1), c = D.bodyOf(i2);
      const same = JSON.stringify(D.bodyOf(i0)) === JSON.stringify(a), differ = JSON.stringify(a) !== JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && i0 !== i1 && i1 !== i2;
      const Q = D.partsOf(i1, 0), I = D.topoOf(0).I, P = Q.P0.map((x, j) => x + Q.D[j]); let out = 0, all = 0;
      for (let t = 0; t < I.length; t += 3){ const p = k => [P[3 * I[k]], P[3 * I[k] + 1] - 0.5, P[3 * I[k] + 2]], A0 = p(t), B0 = p(t + 1), C0 = p(t + 2);
        const u = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]], v = [C0[0] - A0[0], C0[1] - A0[1], C0[2] - A0[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const m = [(A0[0] + B0[0] + C0[0]) / 3, (A0[1] + B0[1] + C0[1]) / 3, (A0[2] + B0[2] + C0[2]) / 3]; all++; if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0) out++; }
      /* (Oct 13: "why do object change color and shape. they should be invariant, locked by the id of the board.") Two boards'
         coarsest bodies are each their own lumps, not one plain ball; and every body drawn is in the one mesh (none a piece of
         the field's), in its board's own colour */
      const F1 = D.partsOf(i1, 3).P0, F2 = D.partsOf(i2, 3).P0, farOwn = F1.length === F2.length && F1.some((x, j) => Math.abs(x - F2[j]) > 1e-3);
      const W = window.FIELD_WORLD, Tg = W.target, f = W.cellAt(Tg.boardX, Tg.boardZ), at = W.itemAt; at.x = Tg.boardX; at.z = Tg.boardZ;
      const noItems = (A.cellItems(f.c, f.r, 500) || []).length === 0, oneMesh = !!D.bodies && D.list.length > 50 && D.bodies.visible === !D.wire && D.bodyLines.visible === D.wire
        // (Oct 14: "it crashes the computer at far horizon") the wire is lines of its own, each edge once, laid only as far as the
        //  bodies go (three's own wireframe was rebuilt from the whole buffer every time the index changed)
        && D.bodyLines.geometry.drawRange.count === D.list.reduce((a, e) => a + D.edgesOf(e.g).length, 0)
        && D.edgesOf(3).length / 2 < 2 * D.TRIS[3];   // (three made 3 lines a triangle)
      const meshWhy = { n: D.list.length, wire: D.wire, mesh: D.bodies && D.bodies.visible, lines: D.bodyLines && D.bodyLines.visible, drawn: D.bodyLines && D.bodyLines.geometry.drawRange.count,
                        want: D.list.reduce((a, e) => a + D.edgesOf(e.g).length, 0), e3: D.edgesOf(3).length / 2 };
      /* (Oct 13: "LOD does not snap, it is smooth between levels. between levels use the proportion part of the level.") The
         bands' weights move by small steps as the detail does, and the band a grain lets go is at nothing where the mesh steps
         down; and a board's detail across a level's edge (2H) moves by a hair, not a level */
      let jump = 0; for (let g = 0; g < 3.5; g += 0.01){ const a = D.bandWeights(g), b = D.bandWeights(g + 0.01); jump = Math.max(jump, ...a.map((x, j) => Math.abs(x - b[j]))); }
      const atStep = [1, 2, 3].every(g => D.bandWeights(g - 1e-6)[4 - g] < 1e-3);
      const v = W.camera.position.y, H = v * 2 ** D.hs, k1 = D.levelAt(2 * H * 0.999, v), k2 = D.levelAt(2 * H * 1.001, v);
      const edge = Math.abs(D.detailOf(k1, v, 2 * H * 0.999) - D.detailOf(k2, v, 2 * H * 1.001));
      return { floor: window.LAB.pitchMin, same, differ, out: out / all, farOwn, noItems, oneMesh, meshWhy, jump: +jump.toFixed(3), atStep, edge: +edge.toFixed(4), levels: [k1, k2] }; });
    // (None at the opening view: at the climbed one it is 3.4 million triangles, and the software renderer took more than 3 s
    //  a frame, which held up the checks after it)
    const tiles = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ);
      const names = A.statTiles(f.c, f.r).map(t => t.value);
      A.onStatTap(f.c, f.r, names.indexOf('None'));
      for (let k = 0; k < 80 && D.shown.n.filter(Boolean).length !== 1; k++) await new Promise(ok => setTimeout(ok, 250));
      const none = D.shown.t.reduce((a, b) => a + (b || 0), 0), noneLv = D.shown.n.filter(Boolean).length;
      A.onStatTap(f.c, f.r, names.indexOf('By v/h')); const w0 = D.wire; A.onStatTap(f.c, f.r, names.indexOf('Wireframe')); const w1 = D.wire; D.setWire(w0);
      for (let k = 0; k < 80 && D.shown.n.filter(Boolean).length < 2; k++) await new Promise(ok => setTimeout(ok, 250));
      return { names, none, noneLv, mode: D.mode, flipped: w1 === !w0 }; });
    /* (Oct 13: "the objects are not visible in the far horizon. when i select the board in the far horizon, I can see the object
       again.") Tilted to 6° at the opening height, the walk spends its tiles at 6,250 boards; the bodies go on past them (itemsPastTiles), up to
       Levels' own cap */
    const far = await page.evaluate(async p0 => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD; W.st.pitch = 6; window.fieldWake && window.fieldWake();
      for (let k = 0; k < 240 && !(D.list.length > 6250); k++){ if (W.st.pitch > 6.5){ W.st.pitch = 6; window.fieldWake && window.fieldWake(); } await new Promise(ok => setTimeout(ok, 250)); }   // (the opening fit, still to come, could tilt it back)
      const out = { bodies: D.list.length }; W.st.pitch = p0; window.fieldWake && window.fieldWake(); await new Promise(ok => setTimeout(ok, 1500)); return out; }, L0.pitch);
    for (let i = 0; i < 6; i++){ await page.mouse.move(640, 300); await page.mouse.wheel(0, -400); await page.waitForTimeout(400); }
    await page.waitForTimeout(3500);
    const L1 = await look();
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS[0]));
    await page.evaluate(() => window.__settle());
    const pitch1 = await page.evaluate(() => window.FIELD_WORLD.st.pitch), floor1 = await page.evaluate(() => window.LAB.pitchMin);
    if (L0.pitch > 36 || L0.levels < 3 || !L0.rings || JSON.stringify(lv) !== '[0,0,1,2,3,3]'
        || L1.boards < 3 * L0.boards || far.bodies <= 6250 || L1.tris > 4 * L0.tris || tiles.none < 15 * L0.tris || tiles.noneLv !== 1 || tiles.mode !== 'vh' || !tiles.flipped
        || !['None', 'By metres', 'By v/h', 'Wireframe'].every(n => tiles.names.includes(n)) || Math.abs(pitch1 - pitch0) > 1e-6
        || own.floor !== 2 || floor1 !== 35 || !own.same || !own.differ || own.out < 0.95 || !own.farOwn || !own.noItems || !own.oneMesh || own.jump > 0.02 || !own.atStep || own.edge > 0.01 || own.levels[0] === own.levels[1]
        || hd.small.hs !== -2 || hd.large.hs !== 2 || hd.back !== 0 || !(hd.small.near < hd.mid.near || hd.mid.near === 0) || !(hd.large.near > hd.mid.near)
        || !(hd.small.far > hd.large.far) || [hd.small, hd.mid, hd.large].some(x => x.total !== 512)
        || hd.leaves.a0 !== 512 || hd.leaves.a2 !== 2048 || hd.leaves.a1 !== 256 || hd.leaves.back !== 512 || hd.leaves.total2 !== 2048
        || !(hd.leaves.near2 <= hd.leaves.near0 && hd.leaves.near0 <= hd.leaves.near1 && hd.leaves.near2 < hd.leaves.near1) || !hd.plain)
      failures.push(`[${current}] ${JSON.stringify({ L0, lv, L1, far, tiles, pitch0, pitch1, own, floor1, hd })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (H near/far grains ${hd.small.near}/${hd.small.far}, ${hd.mid.near}/${hd.mid.far}, ${hd.large.near}/${hd.large.far}; by v/h: ${L0.boards} boards in ${L0.levels} levels, ${L0.tris} triangles; climbed: ${L1.boards} boards, ${L1.tris}; at 6°: ${far.bodies} bodies; None at the opening view: ${tiles.none})`);
  }

  // CHESS PLAYS ON WHILE THE VIEW MOVES (Oct 14: "turn animation back on for chess when the chess board is in motion.",
  // then "for all games except mini-golf"): a real drag pans the view and the animation clock chess
  // reads goes on at every look (the pan hold that held it was taken out)
  current = 'chess plays on while the view moves';
  {
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'field chess')); await new Promise(r => setTimeout(r, 2000)); });
    const at = () => page.evaluate(() => { const W = window.FIELD_WORLD; return { at: +window.fieldAnimTime().toFixed(1), cam: [W.st.camX, W.st.camZ, W.st.yaw, W.st.pitch, W.st.zoom].map(v => (+v).toFixed(4)).join(',') }; });
    const a0 = await at(), during = [];
    await page.mouse.move(200, 650); await page.mouse.down();
    for (let k = 1; k <= 6; k++){ await page.mouse.move(200 + 12 * k, 650 - 4 * k); await page.waitForTimeout(120); during.push(await at()); }
    await page.mouse.up(); await page.waitForTimeout(1500);
    const a1 = during[during.length - 1], ok = a1.at > a0.at && during.every((d, k) => k === 0 || d.at > during[k - 1].at) && during.some(d => d.cam !== a0.cam);
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ a0, during })}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (the clock ran ${(a1.at - a0.at).toFixed(0)} ms over the drag)`);
  }

  // CHESS: THE ROW IS A POSITION EDITOR (Oct 13: "lets use it in chess to create custom chess games instead of selecting a
  // board. similar to mini-golf"): the dots, clicked, open the editor on the framed board with its tiles; taps put pieces on
  // squares (a pawn on the last rank refused); without a king Done says why and stays; with kings Done puts the position on
  // the board as its own game and shuts the row; Escape leaves a board as it was
  current = 'chess position editor';
  {
    const before = failures.length;
    const ce = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms));
      const A = window.FIELD_APPS.find(a => a.name === 'field chess'); window.setFieldApp(A); await wait(2500);
      const D = A._debug, W = window.FIELD_WORLD;
      D.fly(3, 2); await window.__settle(3, 2);                               // (a board framed: the editor sets up the selected board)
      // (the row shut first: an earlier check may have left it open, and then the dots would shut it)
      const was = { shut: document.body.classList.contains('bb-collapsed'), shown: !!W.target.shown, vis: window.tvf.browser.visible, app: window.getFieldApp().name };
      if (!was.shut){ document.getElementById('bbHandle').click(); await wait(800); }
      document.getElementById('bbHandle').click(); await wait(800);
      if (!D.ed.on) return { was, nowShut: document.body.classList.contains('bb-collapsed'), vis: window.tvf.browser.visible, shown: !!W.target.shown, msg: D.ed.msg, busy: D.ed.busy };
      const on = D.ed.on, tiles = (A.statTiles() || []).length, keys = window.tvf.browser.keys.filter(k => String(k).startsWith('stat_')).length;
      const bw = W.boardW(), sq = (r, c) => ({ x: D.ed.bx - bw / 2 + (c + 0.5) * bw / 8, y: 0, z: D.ed.bz - bw / 2 + (r + 0.5) * bw / 8 });
      A.onStatTap(0, 0, 13);                                     // Clear
      if (D.ed.turn !== 'w') A.onStatTap(0, 0, 15);                // (White to move: the board's own turn came in with it)
      A.onStatTap(0, 0, 0); D.tap(sq(7, 4));                       // a white king alone
      const noKing = D.done(), stillOn = D.ed.on, why = D.ed.msg;
      A.onStatTap(0, 0, 1); D.tap(sq(7, 3));                       // a white queen
      A.onStatTap(0, 0, 6); D.tap(sq(0, 4));                       // the black king
      A.onStatTap(0, 0, 11); D.tap(sq(0, 0)); const pawnMsg = D.ed.msg, pawnOff = !!D.ed.bd && !D.ed.bd[0][0];
      const youW = D.ed.you === 'w';                               // (the side to move set White, you follow it)
      const key = D.ed.key, ok = D.done();
      const fenAtDone = D.userGames().get(key) && D.userGames().get(key).fen(); await wait(800);
      const stored = D.userGames().get(key), shut = document.body.classList.contains('bb-collapsed');
      // Escape leaves a board as it was
      const before2 = stored && stored.fen();
      D.start(); A.onStatTap(0, 0, 13);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
      const after2 = D.userGames().get(key);
      /* (Oct 14: "can I set the fen. with a string such as : rn1k3r/1b1q1ppp/p2P4/2B2p2/8/1QNBR3/PP3PPP/2R3K1 w - - 1 0", then
         "ok") the puzzle book's FEN, its move number 0 read as 1; a bare board given White to move; nonsense refused. The FEN…
         tile, through the prompt, puts it in the editor whole, and Done would play it as given (counts and all); a piece moved
         and the editor's own reading takes over */
      const PUZ = 'rn1k3r/1b1q1ppp/p2P4/2B2p2/8/1QNBR3/PP3PPP/2R3K1 w - - 1 0';
      const fenT = { puz: D.fenTidy(PUZ).fen, bare: D.fenTidy('"8/8/8/8/8/8/8/K6k"').fen, junk: !!D.fenTidy('hello').why, eight: !!D.fenTidy('8/8/8 w').why };
      D.start(); const p0 = window.prompt; window.prompt = () => '  ' + PUZ + ' ';
      const fi = A.statTiles().findIndex(t => t.value === 'FEN…'); A.onStatTap(0, 0, fi); window.prompt = p0;
      fenT.tile = fi; fenT.row0 = D.ed.bd[0].map(p => p || '.').join(''); fenT.check = D.check().g && D.check().g.fen(); fenT.turn = D.ed.turn;
      A.onStatTap(0, 0, 12); D.tap(sq(2, 0)); fenT.edited = D.fenNow();                 // (Erase on a6's pawn: the counts go)
      D.cancel();
      // (Oct 14: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1. did not work": with no board selected the menu's Set
      //  up from FEN… takes the board in the middle of the view, flies there, and plays the position on it)
      { const T = window.FIELD_WORLD.target; T.shown = false; window.prompt = () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1.';
        A.menu.flatMap(m => m.items).find(i => i.label === 'Set up from FEN…').on(); window.prompt = p0; await wait(1500);
        const k = D.cellKey(T.boardX, T.boardZ), g2 = D.userGames().get(k); fenT.menu = { shown: !!T.shown, fen: g2 && g2.fen(), off: !D.ed.on }; }
      /* (Oct 14: a list of board-only FENs, then "Yes" to Paste FENs…) one a line through the box: each good one on its own
         board (a board alone White to move, one White cannot be to move given Black), the rest listed by line with why, and
         only they left in the box */
      { const L = ['8/8/8/8/8/5K2/7Q/k7', '1. 8/8/8/8/8/2k5/8/K1q5', '7/8/8/8/8/8/8/K6k', 'o1N6/8/8/8/8/8/8/K6k', '', '8/8/8/8/8/8/1Q6/k6K w - - 0 1'].join('\n');
        const n0 = D.userGames().size, box = D.fenBox(); box.querySelector('textarea').value = L;
        [...box.querySelectorAll('button')].find(b => b.textContent === 'Put on boards').click(); await wait(800);
        const W2 = window.FIELD_WORLD, k = D.cellKey(W2.target.boardX, W2.target.boardZ), m = D.gameMeta(k);
        fenT.many = { put: D.userGames().size - n0, lab: box.firstChild.textContent, left: box.querySelector('textarea').value, first: m && m.fen, looks: D.looksLikeFens(L), notPgn: !D.looksLikeFens('[Event "x"]\n\n1. e4 e5') };
        box.hidden = true; }
      // (back to the board this check began on: the selected board is every game's, and these FEN steps move it on purpose, so
      //  the mini golf checks long after played another board's hole, one its straight putts could not sink: CI, Oct 14)
      D.fly(3, 2); await window.__settle(3, 2);
      return { on, tiles, keys, noKing, stillOn, why, pawnMsg, pawnOff, ok, youW, fen: fenAtDone, now: stored && stored.fen(), shut, escOff: !D.ed.on, kept: after2 && after2.fen() === before2, fenT };
    });
    const F = ce.fenT || {};
    if (F.puz !== 'rn1k3r/1b1q1ppp/p2P4/2B2p2/8/1QNBR3/PP3PPP/2R3K1 w - - 1 1' || F.bare !== '8/8/8/8/8/8/8/K6k w - - 0 1' || !F.junk || !F.eight
        || F.tile !== 18 || F.row0 !== 'rn.k...r' || F.check !== F.puz || F.turn !== 'w' || F.edited !== 'rn1k3r/1b1q1ppp/3P4/2B2p2/8/1QNBR3/PP3PPP/2R3K1 w - - 0 1'
        || !F.many || F.many.put !== 2 || !/Put 2 positions on boards; 3 refused/.test(F.many.lab) || !/line 3 .*Rank 8 \(7\) covers 7 squares/.test(F.many.lab)
        || !/line 4 .*"o" is not a piece letter/.test(F.many.lab) || !/line 6 .*in check/.test(F.many.lab) || F.many.left.split('\n').length !== 3
        || F.many.first !== '8/8/8/8/8/5K2/7Q/k7 w - - 0 1' || !F.many.looks || !F.many.notPgn
        || !F.menu || !F.menu.shown || F.menu.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' || !F.menu.off)
      failures.push(`[${current}] the FEN: ${JSON.stringify(F)}`);
    if (!ce.on || ce.tiles !== 19 || ce.keys !== 19 || ce.noKing !== false || !ce.stillOn || !/king/.test(ce.why) || !/pawn/i.test(ce.pawnMsg) || !ce.pawnOff
        || ce.ok !== true || !ce.youW || ce.fen !== '4k3/8/8/8/8/8/8/3QK3 w - - 0 1' || ce.now !== ce.fen || !ce.shut || !ce.escOff || !ce.kept)
      // (where the piece set loads, as on CI, the game then starts; you play White, so the engine waits: the position stays)
      failures.push(`[${current}] ${JSON.stringify(ce)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
  }

  // TOWER DEFENSE: THE ROW IS A MAP EDITOR (Oct 13: "tower defense", on what else could have chess's and mini golf's editor):
  // the dots open it on the framed board with its tiles; rocks and towers go on squares; a rock that would shut the exit off is
  // refused; the entrance moves to another edge and not into the middle; Done keeps the map on the board, shuts the row and
  // starts a game on it whose pieces come in at the new entrance and walk round the rocks; Escape leaves a board as it was;
  // the map survives a reload's storage check (cleanMap)
  current = 'tower defense map editor';
  {
    const before = failures.length;
    const td = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms));
      const A = window.FIELD_APPS.find(a => a.name === 'tower defense'); window.setFieldApp(A); await wait(2500);
      const D = A._debug, W0 = window.FIELD_WORLD, T0 = W0.target, home = T0.shown ? W0.cellAt(T0.boardX, T0.boardZ) : null;
      window.__tdHome = home;                                      // (flown back after: the boards' frame is every game's, and the later checks expect theirs)
      D.fly(4, 3); await window.__settle(4, 3);
      if (!document.body.classList.contains('bb-collapsed')){ document.getElementById('bbHandle').click(); await wait(800); await window.__settle(); }
      document.getElementById('bbHandle').click(); await wait(800);
      const E = D.ed(), W = window.FIELD_WORLD, fr = W.cellAt(W.target.boardX, W.target.boardZ);
      if (!E.on) return { open: false, live: D.live(), shut: document.body.classList.contains('bb-collapsed') };
      if (!fr || E.c !== fr.c || E.r !== fr.r){ const out = { open: true, onFramed: false, ed: [E.c, E.r], fr, settle: window.__lastSettle }; try { D.edCancel(); } catch {} return out; }   // (the board on the screen)
      const c = E.c, r = E.r, tiles = (A.statTiles(c, r) || []).length, keys = window.tvf.browser.keys.filter(k => String(k).startsWith('stat_')).length;
      const tile = name => A.onStatTap(c, r, A.statTiles(c, r).findIndex(t => t.value === name || String(t.value).startsWith(name)));
      tile('Clear');
      while (E.g.n !== 12) tile('Size');                          // a 12×12 floor
      const n = E.g.n, at = (row, col) => A.onCellTap(c, r, (col + 0.5) / n, (row + 0.5) / n);
      tile('Entrance'); at(5, 5); const midMsg = E.msg, midRefused = E.g.doors.entry !== 5 * n + 5;
      at(0, 3);                                                   // the entrance on the top edge
      tile('Exit'); at(11, 8);                                    // the exit on the bottom edge
      tile('Rock'); for (let col = 0; col < n - 1; col++) at(6, col);   // a wall of rocks across, open at the right
      const len1 = E.g.way.length;
      at(6, n - 1); const shutMsg = E.msg, open = E.g.towers[6 * n + n - 1] === 0;   // the last square would shut it: refused
      tile('Rook'); at(4, 2);
      tile('Gold'); const gold = E.g.gold;
      const key = E.key, ok = D.edDone(); await wait(800);
      const m = D.maps.get(key), g = D.gameAt(c, r), shut = document.body.classList.contains('bb-collapsed');
      // send a wave and let the first piece walk in
      A.onCellTap(c, r, (3 + 0.5) / n, 0.5 / n);
      for (let k = 0; k < 400 && !g.creeps.length; k++) D.step(g, 1 / 30, true);
      const first = g.creeps[0] ? { x: g.creeps[0].x, y: g.creeps[0].y } : null;
      let crossed = false;
      for (let k = 0; k < 30 * 40 && g.creeps.length; k++){ D.step(g, 1 / 30); for (const p of g.creeps){ const i = Math.round(p.y) * n + Math.round(p.x); if (Math.round(p.y) === 6 && g.towers[i] === 6) crossed = true; } }
      // Escape leaves a board as it was
      D.edOpen(); tile('Clear');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
      const kept = D.maps.get(key) && D.maps.get(key).cells === m.cells, escOff = !E.on;
      const stored = JSON.parse(localStorage.getItem('td.maps') || '{}')[key];
      return { open: true, tiles, keys, midRefused, midMsg, shutMsg, rockOpen: open, len1, ok, shut, gold, m, gn: g.n, ge: g.doors && g.doors.entry,
               rook: g.towers[4 * n + 2], first, crossed, kept, escOff, stored: !!stored && stored.cells === m.cells };
    });
    // a real click on a square of the framed board puts the tool there (not the editor's own functions)
    const rc = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, T = W.target;
      D.edOpen(); const E = D.ed(); A.onStatTap(E.c, E.r, 0);           // Rock in hand
      await window.__settle(E.c, E.r);   // (until the camera is still: shutting the row refits the view, and a click aimed mid-glide landed on the next board, Oct 13)
      const n = E.g.n;
      /* (the first empty square away from the edges that is on the canvas: twice on CI the one asked for fell above the screen,
         and once the Sokoban check's below it, in a view turned about, Oct 13) */
      const pick = () => { for (let row = 2; row < n - 2; row++) for (let col = 2; col < n - 2; col++){ const i = row * n + col; if (E.g.towers[i]) continue; const v = window.__aim(n, col, row); if (v.ok) return { ...v, i }; } return null; };
      let v = pick();
      if (!v){ D.fly(E.c, E.r); await window.__settle(E.c, E.r); v = pick(); }
      if (!v) return { aimed: false, n, view: { yaw: W.st.yaw, pitch: W.st.pitch, zoom: W.st.zoom } };
      return { x: v.x, y: v.y, aimed: v.ok, n, i: v.i, before: E.g.towers[v.i] };
    });
    // (where the click went, for a failure: in one full run it placed nothing, Oct 13)
    await page.evaluate(() => { const A = window.getFieldApp(); window.__tdTaps = []; const o = A.onCellTap; A.__tdTap = o;
      A.onCellTap = function(c, r, u, v){ window.__tdTaps.push([c, r, u == null ? null : +u.toFixed(3), v == null ? null : +v.toFixed(3)]); return o.apply(this, arguments); }; });
    if (rc.aimed) await page.mouse.click(rc.x, rc.y); await page.waitForTimeout(800);
    rc.taps = await page.evaluate(() => { const A = window.getFieldApp(); A.onCellTap = A.__tdTap; delete A.__tdTap; const W = window.FIELD_WORLD, T = W.target; return { taps: window.__tdTaps, ed: [A._debug.ed().c, A._debug.ed().r], framed: T.shown && W.cellAt(T.boardX, T.boardZ) }; });
    const rc2 = await page.evaluate(async i => { const D = window.getFieldApp()._debug, E = D.ed(); const v = i == null ? null : E.g && E.g.towers[i]; D.edCancel();
      const h = window.__tdHome; if (h){ D.fly(h.c, h.r); await new Promise(ok => setTimeout(ok, 1500)); } return v; }, rc.i);
    if (rc.before !== 0 || rc2 !== 6) failures.push(`[${current}] a real click: ${JSON.stringify({ rc, rc2 })}`);
    const n = 12;
    if (!td.open || td.tiles !== 13 || td.keys !== 13 || !td.midRefused || !/edge/.test(td.midMsg) || !/shut/.test(td.shutMsg) || !td.rockOpen
        || td.ok !== true || !td.shut || !td.m || td.m.n !== n || td.m.entry !== 3 || td.m.exit !== 11 * n + 8 || td.m.gold !== td.gold
        || td.gn !== n || td.ge !== 3 || td.rook !== 4 || !td.first || td.first.y >= 0 || Math.abs(td.first.x - 3) > 0.01 || td.crossed || !td.kept || !td.escOff || !td.stored)
      failures.push(`[${current}] ${JSON.stringify(td)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
  }

  // SOKOBAN: THE ROW IS A LEVEL EDITOR (Oct 13: "yes", on the Sokoban level editor): the dots open it on the framed board;
  // a 6×6 floor with the keeper, a crate and a spot in a row; Done refuses crates and spots that differ, Check finds a crate in
  // a corner off its spot hopeless; with it taken off, Done keeps the level with par 2, shuts the row and plays it; pushing
  // the crate home solves it at par; Escape keeps it; it is in storage; a real click lays a wall
  current = 'sokoban level editor';
  {
    const before = failures.length;
    const sk = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms));
      const A = window.FIELD_APPS.find(a => a.name === 'sokoban'); window.setFieldApp(A); await wait(2500);
      const D = A._debug, W = window.FIELD_WORLD, T0 = W.target, home = T0.shown ? W.cellAt(T0.boardX, T0.boardZ) : null;
      window.__skHome = home;                                      // (flown back after, as the tower defense check is)
      D.fly(5, 2); await window.__settle(5, 2);
      if (!document.body.classList.contains('bb-collapsed')){ document.getElementById('bbHandle').click(); await wait(800); await window.__settle(); }
      document.getElementById('bbHandle').click(); await wait(800);
      const E = D.ed(), fr = W.cellAt(W.target.boardX, W.target.boardZ);
      if (!E.on) return { open: false, shut: document.body.classList.contains('bb-collapsed') };
      if (!fr || E.c !== fr.c || E.r !== fr.r) return { open: true, onFramed: false, ed: [E.c, E.r], fr };
      const c = E.c, r = E.r, tiles = (A.statTiles(c, r) || []).length, keys = window.tvf.browser.keys.filter(k => String(k).startsWith('stat_')).length;
      const tile = name => A.onStatTap(c, r, A.statTiles(c, r).findIndex(t => t.value === name || String(t.value).startsWith(name)));
      tile('Clear');
      while (E.L.n !== 8) tile('Size');                           // a 6×6 floor (8 with its wall)
      const n = 8, V = 6, at = (row, col) => A.onCellTap(c, r, (col - 0.5) / V, (row - 0.5) / V), sq = (row, col) => row * n + col;
      tile('Keeper'); at(3, 1); tile('Crate'); at(3, 3);
      const noSpot = D.edDone(), whyCount = E.msg, stillOn = E.on;
      tile('Spot'); at(3, 5);
      tile('Crate'); at(1, 1); tile('Spot'); at(6, 6);
      tile('Check'); const hopeless = E.msg;
      tile('Crate'); at(1, 1); tile('Spot'); at(6, 6);             // taken off again
      tile('Check'); const checked = E.msg;
      const key = E.key, ok = D.edDone(); await wait(800);
      const L = D.mineLevel(key), g = D.gameAt(c, r), shut = document.body.classList.contains('bb-collapsed');
      for (let k = 0; k < 3; k++) D.step(g, 1);                    // right, right, right: two pushes
      const solved = g.solved, pushes = g.pushes;
      D.edOpen(); tile('Clear');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
      const escOff = !E.on;
      const stored = JSON.parse(localStorage.getItem('sokoban.levels') || '{}')[key];
      return { open: true, tiles, keys, noSpot, whyCount, stillOn, hopeless, checked, ok, shut, par: L && L.par, mine: L && L.mine,
               player: L && L.player === sq(3, 1), boxes: L && L.boxes.join(), want: String(sq(3, 3)), solved, pushes, escOff,
               cells: D.mine.get(key) && D.mine.get(key).cells, stored: stored && stored.cells };
    });
    // a real click on a square of the framed board lays the tool there
    const rc = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, T = W.target;
      D.edOpen(); const E = D.ed(); A.onStatTap(E.c, E.r, 0);           // Wall in hand
      await window.__settle(E.c, E.r);   // (until the camera is still: shutting the row refits the view, and a click aimed mid-glide landed on the next board, Oct 13)
      const n = E.L.n, V = n - 2, L0 = E.L;
      /* (the first empty square that is on the canvas: twice on CI the far row's square fell below the screen, at the foot of a
         view turned about, under the bottom row, Oct 13) */
      const free = i => !L0.wall[i] && L0.player !== i && !(L0.boxes || []).includes(i) && !(L0.goal && L0.goal[i]) && !((L0.goals || []).includes && (L0.goals || []).includes(i));
      const pick = () => { for (let row = 0; row < V; row++) for (let col = 0; col < V; col++){ const i = (row + 1) * n + col + 1; if (!free(i)) continue; const v = window.__aim(V, col, row); if (v.ok) return { ...v, i }; } return null; };
      let v = pick();
      if (!v){ D.fly(E.c, E.r); await window.__settle(E.c, E.r); v = pick(); }
      if (!v) return { aimed: false, n, view: { yaw: W.st.yaw, pitch: W.st.pitch, zoom: W.st.zoom } };
      return { x: v.x, y: v.y, aimed: v.ok, n, i: v.i, before: E.L.wall[v.i] };
    });
    if (rc.aimed) await page.mouse.click(rc.x, rc.y); await page.waitForTimeout(800);
    const rc2 = await page.evaluate(async i => { const D = window.getFieldApp()._debug, E = D.ed(); const v = i == null ? null : E.L && E.L.wall[i]; D.edCancel();
      const h = window.__skHome; if (h){ D.fly(h.c, h.r); await new Promise(ok => setTimeout(ok, 1500)); } return v; }, rc.i);
    if (rc.before !== 0 || rc2 !== 1) failures.push(`[${current}] a real click: ${JSON.stringify({ rc, rc2 })}`);
    if (!sk.open || sk.tiles !== 9 || sk.keys !== 9 || sk.noSpot !== false || !/as many/.test(sk.whyCount) || !sk.stillOn || !/no way/.test(sk.hopeless)
        || !/2 pushes/.test(sk.checked) || sk.ok !== true || !sk.shut || sk.par !== 2 || !sk.mine || !sk.player || sk.boxes !== sk.want
        || !sk.solved || sk.pushes !== 2 || !sk.escOff || !sk.cells || sk.stored !== sk.cells)
      failures.push(`[${current}] ${JSON.stringify(sk)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
  }

  // THE BOARD GAMES' POSITION EDITOR (Oct 13: "1,2", the first being a position editor for checkers, Reversi, Ataxx, Gomoku
  // and Go): in each, the dots open it on the framed board; a position the game would refuse is refused with its reason (and a
  // checkers man on a light square); a good one, with you on the side not to move, is put on the board and the computer
  // answers it; Escape leaves a board as it was; a real click puts a Reversi stone on its square
  // (these checks fly to boards of their own; the boards' frame is every game's, so it goes back after them, as the tower
  //  defense check's does: the mini golf checks later expect the board they had, Oct 13)
  const homeBefore = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target; return T.shown ? W.cellAt(T.boardX, T.boardZ) : null; });
  current = 'board games position editor';
  {
    const before = failures.length;
    const CASES = [
      { app: 'field reversi', n: 8, put: [[1, 27], [2, 28], [2, 36]], bad: [], badWhy: /Neither/ },
      { app: 'field gomoku', n: 15, put: [[1, 112]], turn: 2, bad: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], badWhy: /five in a row/ },
      { app: 'field ataxx', n: 7, put: [[1, 0], [2, 48]], bad: [], badWhy: /Neither/ },
      { app: 'field checkers', n: 8, put: [[1, 40], [2, 17]], bad: [[1, 40]], badWhy: /Each side/, light: 0 },
      { app: 'field go', n: 9, put: [[1, 40]], turn: 2, bad: [[2, 0], [1, 1], [1, 9]], badWhy: /no liberty/ },
    ];
    const out = [];
    for (const K of CASES){
      const r = await page.evaluate(async K => {
        const wait = ms => new Promise(ok => setTimeout(ok, ms));
        const A = window.FIELD_APPS.find(a => a.name === K.app); window.setFieldApp(A); await wait(2000);
        const D = A._edDebug, W = window.FIELD_WORLD;
        D.fly(6, 4); await window.__settle(6, 4);
        if (!document.body.classList.contains('bb-collapsed')){ document.getElementById('bbHandle').click(); await wait(700); await window.__settle(); }
        document.getElementById('bbHandle').click(); await wait(700);
        const E = D.ed(), fr = W.cellAt(W.target.boardX, W.target.boardZ);
        if (!E.on) return { app: K.app, open: false };
        if (!fr || E.c !== fr.c || E.r !== fr.r) return { app: K.app, onFramed: false, ed: [E.c, E.r], fr };
        const c = E.c, r = E.r, tiles = A.statTiles(c, r) || [];
        const tile = name => A.onStatTap(c, r, A.statTiles(c, r).findIndex(t => String(t.value).startsWith(name)));
        const pieceTile = code => A.onStatTap(c, r, E.G.pieces.findIndex(p => p[0] === code));
        const at = i => A.onCellTap(c, r, (i % E.n + 0.5) / E.n, (((i / E.n) | 0) + 0.5) / E.n);
        while (E.n !== K.n) tile('Size');
        tile('Clear');
        let light = null;
        if (K.light != null){ pieceTile(1); at(K.light); light = { msg: E.msg, empty: !E.cells[K.light] }; }
        for (const [v, i] of K.bad){ pieceTile(v); at(i); }
        const badOk = D.done(), badMsg = E.msg, stillOn = E.on;
        tile('Clear');
        for (const [v, i] of K.put){ pieceTile(v); at(i); }
        if ((K.turn || 1) !== E.turn) tile(E.turn === 1 ? 'Black to move' : 'White to move');
        tile('You');                                              // you the other side: the computer answers first
        const want = E.cells.slice(), you = E.you, turn = E.turn, key = E.key;
        const ok = D.done();
        const st0 = D.map.get(key), same = st0 && Array.from(st0.bd).every((x, i) => (x ? (typeof x === 'object' ? (x.red ? (x.k === 'k' ? 3 : 1) : (x.k === 'k' ? 4 : 2)) : x) : 0) === want[i]);
        await wait(400);
        const shut = document.body.classList.contains('bb-collapsed');
        let moved = false;
        for (let k = 0; k < 40 && !moved; k++){ await wait(150); const s1 = D.map.get(key); moved = !!s1 && Array.from(s1.bd).some((x, i) => (x ? (typeof x === 'object' ? (x.red ? (x.k === 'k' ? 3 : 1) : (x.k === 'k' ? 4 : 2)) : x) : 0) !== want[i]); }
        // Escape leaves the board as it was
        const kept = D.map.get(key);
        D.open(); tile('Clear');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
        const escOk = !E.on && D.map.get(key) === kept;
        return { app: K.app, open: true, tiles: tiles.length, light, badOk, badMsg, stillOn, ok, shut, same, you, turn, moved, escOk };
      }, K);
      out.push(r);
      if (!r.open || r.onFramed === false || r.badOk !== false || !K.badWhy.test(r.badMsg || '') || !r.stillOn || r.ok !== true || !r.shut || !r.same
          || r.you === r.turn || !r.moved || !r.escOk || (K.light != null && !(r.light && r.light.empty && /dark squares/.test(r.light.msg))))
        failures.push(`[${current}] ${JSON.stringify(r)}`);
    }
    // a real click on a Reversi square puts a stone there
    const rc = await page.evaluate(async () => {
      const A = window.FIELD_APPS.find(a => a.name === 'field reversi'); window.setFieldApp(A); await new Promise(ok => setTimeout(ok, 1500));
      const D = A._edDebug, W = window.FIELD_WORLD, T = W.target;
      D.fly(6, 4); await window.__settle(6, 4);
      D.open(); const E = D.ed(); A.onStatTap(E.c, E.r, 0); A.onStatTap(E.c, E.r, E.G.pieces.length + 1);   // Black in hand, a clear board
      await window.__settle();   // (until the camera is still: shutting the row refits the view, and a click aimed mid-glide landed on the next board, Oct 13)
      const n = E.n, bW = W.boardW(), L = window.LAB || {};
      const v = window.__aim(n, 2, 5);
      return { x: v.x, y: v.y, aimed: v.ok, n };
    });
    await page.mouse.click(rc.x, rc.y); await page.waitForTimeout(800);
    rc.got = await page.evaluate(n => { const D = window.getFieldApp()._edDebug, E = D.ed(); const v = E.cells && E.cells[5 * n + 2]; D.cancel(); return v; }, rc.n);
    if (rc.got !== 1) failures.push(`[${current}] a real click: ${JSON.stringify(rc)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (${out.map(o => o.app.replace('field ', '') + (o.moved ? ' answered' : '')).join(', ')})`);
  }

  // SHARE LINKS (Oct 13: "1,2", the second being share links for what the editors make): a Sokoban level, a tower defense map,
  // a Reversi position and a chess position are shared from their boards; each link, opened in a page of its own, puts the
  // same thing on the board framed there, ready to play; a Reversi link that is not a position is refused
  current = 'share links';
  {
    const before = failures.length;
    const urls = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms)), out = {};
      const use = async (name, c, r) => { const A = window.FIELD_APPS.find(a => a.name === name); window.setFieldApp(A); await wait(1500); const D = A._edDebug || A._debug; D.fly(c, r); await wait(1500); return { A, D }; };
      // a level and a map made for the purpose (the editors' own checks above made theirs on other boards)
      let { A, D } = await use('sokoban', 7, 3);
      D.edOpen(); let E = D.ed(); const tS = n => A.onStatTap(E.c, E.r, A.statTiles(E.c, E.r).findIndex(t => String(t.value).startsWith(n)));
      tS('Clear'); while (E.L.n !== 8) tS('Size');
      const sq = (row, col) => A.onCellTap(E.c, E.r, (col - 0.5) / 6, (row - 0.5) / 6);
      tS('Keeper'); sq(2, 1); tS('Crate'); sq(2, 3); tS('Spot'); sq(2, 4); D.edDone(); await wait(300);
      out.sokoban = { url: D.shareLevel(), cells: D.mine.get(E.key).cells };
      ({ A, D } = await use('tower defense', 7, 3));
      D.edOpen(); E = D.ed(); const tT = n => A.onStatTap(E.c, E.r, A.statTiles(E.c, E.r).findIndex(t => String(t.value).startsWith(n)));
      tT('Clear'); tT('Rock'); A.onCellTap(E.c, E.r, 5.5 / E.g.n, 5.5 / E.g.n); tT('Gold'); D.edDone(); await wait(300);
      const tk = E.key; out.td = { url: D.shareMap(), map: JSON.stringify(D.maps.get(tk)) };
      ({ A, D } = await use('field reversi', 7, 3));
      D.open(); E = D.ed(); const tR = n => A.onStatTap(E.c, E.r, A.statTiles(E.c, E.r).findIndex(t => String(t.value).startsWith(n)));
      tR('Start'); tR('You');                                     // the starting position, and you play White
      const rc = E.cells.slice(); out.reversi = { url: D.share(), cells: rc.join('') }; D.cancel();
      ({ A, D } = await use('field chess', 7, 3));
      const cu = D.share(), fen = JSON.parse(decodeURIComponent(escape(atob(new URL(cu).searchParams.get('setup').replace(/-/g, '+').replace(/_/g, '/'))))).fen;
      out.chess = { url: cu, fen };
      return out;
    });
    // the main page waits on a game that rests: chess (the last above) never does, and on CI's two cores its drawing every frame
    // in software kept every link page from loading in 90 s, while the puzzle makers' pages, opened with a resting game behind
    // them, loaded (Oct 13)
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'sokoban')));
    await page.waitForTimeout(1500);
    const open = async (url, check) => {
      // (a context of its own: its own process and its own storage, so the page takes the link and not what this one kept,
      //  and does not wait on this page's work; in the main page's context every link page timed out on CI, Oct 13)
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage();
      if (process.env.LIBS_DIR){
        const lib = f => readFile(join(process.env.LIBS_DIR, f));
        await pg.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.module\.min\.js/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('three/build/three.module.js') }));
        await pg.route(/cdn\.jsdelivr\.net\/npm\/chess\.js@1\.4\.0\/\+esm/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('chess.js/dist/esm/chess.js') }));
      }
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      const u = new URL(url), here = new URL('games.html', base); here.search = u.search;
      // (not 'load': it waits on every outside file, the CDNs and the engines, and on CI a second page took over 30 s to
      //  reach it, Oct 13; the script running and the games ready is what this needs)
      let got;
      try {
        await pg.goto(here.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await pg.waitForFunction(() => Array.isArray(window.FIELD_APPS) && window.getFieldApp && window.getFieldApp(), null, { timeout: 90000 });
        await pg.waitForTimeout(6000);
        got = await pg.evaluate(check);
      } catch (e){ got = { err: String(e).slice(0, 300) }; }
      await ctx.close();
      return { ...got, errs };
    };
    const res = {};
    res.sokoban = await open(urls.sokoban.url, () => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), k = f.c + '_' + f.r, m = A._debug.mine.get(k); return { app: A.name, cells: m && m.cells, par: A._debug.mineLevel(k) && A._debug.mineLevel(k).par }; });
    res.td = await open(urls.td.url, () => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), k = f.c + '_' + f.r, g = A._debug.games.get(k); return { app: A.name, map: JSON.stringify(A._debug.maps.get(k)), playing: g && g.state }; });
    res.reversi = await open(urls.reversi.url, () => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), st = A._edDebug.map.get(A._edDebug.keyOf(f.c, f.r)); return { app: A.name, cells: st && Array.from(st.hist[0].bd).join(''), human: st && st.human }; });
    const bad = urls.reversi.url.replace(/setup=[^&]+/, 'setup=' + Buffer.from(JSON.stringify({ n: 8, cells: [1, 2], turn: 1 })).toString('base64url'));
    res.bad = await open(bad, () => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return { app: A.name, msg: A._edDebug.ed().msg, own: A._edDebug.map.has(A._edDebug.keyOf(f.c, f.r)) }; });
    res.chess = await open(urls.chess.url, () => { const A = window.getFieldApp(), W = window.FIELD_WORLD, D = A._debug, k = D.cellKey(W.target.boardX, W.target.boardZ), g = D.userGames().get(k); return { app: A.name, fen: g && g.fen() }; });
    const R = res;
    if (!urls.sokoban.url || R.sokoban.cells !== urls.sokoban.cells || R.sokoban.par !== 1
        || !urls.td.url || R.td.map !== urls.td.map || R.td.playing !== 'play'
        || R.reversi.cells !== urls.reversi.cells || R.reversi.human !== 2
        || !/cannot be played/.test(R.bad.msg || '') || R.bad.own
        || !urls.chess.fen || R.chess.fen !== urls.chess.fen
        || Object.values(R).some(x => x.errs && x.errs.length))
      failures.push(`[${current}] ${JSON.stringify({ urls: Object.fromEntries(Object.entries(urls).map(([k, v]) => [k, { ...v, url: v.url && v.url.slice(0, 60) }])), res: R })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
  }

  // THE PUZZLE MAKERS (Oct 13: "ok, proceed", on puzzle makers for Unblock Me, Flow and Queens, the solver checking each):
  // in each the dots open the maker on the framed board; a hopeless puzzle is refused with its reason; a good one is kept,
  // shuts the row and is played; a real click lays a piece; Escape leaves a board as it was; each one's share link, opened in
  // a page of its own, puts the same puzzle on the board framed there
  current = 'puzzle makers';
  {
    const before = failures.length;
    const res = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms)), still = () => window.__settle();
      const out = {};
      const begin = async name => {
        const A = window.FIELD_APPS.find(a => a.name === name); window.setFieldApp(A); await wait(1500);
        const D = A._debug, W = window.FIELD_WORLD; D.fly(5, 4); await window.__settle(5, 4);
        if (!document.body.classList.contains('bb-collapsed')){ document.getElementById('bbHandle').click(); await wait(700); await window.__settle(); }
        document.getElementById('bbHandle').click(); await wait(700);
        const P = D.pz(), E = P.ed, fr = W.cellAt(W.target.boardX, W.target.boardZ);
        if (!E || E.c !== fr.c || E.r !== fr.r) return null;
        const c = E.c, r = E.r, tile = n => A.onStatTap(c, r, A.statTiles(c, r).findIndex(t => String(t.value).startsWith(n)));
        return { A, D, P, c, r, tile };
      };
      // Unblock Me
      let B = await begin('unblock me');
      if (!B) return { open: 'unblock' };
      { const { A, D, P, c, r, tile } = B;
        while (P.ed.d.n !== 6) tile('Size');
        const at = (row, col) => A.onCellTap(c, r, (col + 0.5) / 6, (row + 0.5) / 6);
        tile('Red block'); at(2, 0);
        tile('Across 2'); at(2, 3); tile('Check'); const hopeless = P.ed.msg; at(2, 3);
        tile('Down 2'); at(1, 3); tile('Check'); const fine = P.ed.msg;
        const ok = P.done(); await wait(400);
        const g = D.games.get(c + '_' + r);
        out.unblock = { hopeless, fine, ok, shut: document.body.classList.contains('bb-collapsed'), best: g && g.best, mine: !!P.mine(c + '_' + r), url: P.share() };
      }
      // Flow
      B = await begin('flow');
      if (!B) return { open: 'flow', out };
      { const { A, D, P, c, r, tile } = B;
        while (P.ed.d.n !== 6) tile('Size');
        tile('Clear');
        const put = (k, i) => { A.onStatTap(c, r, k); A.onCellTap(c, r, (i % 6 + 0.5) / 6, (((i / 6) | 0) + 0.5) / 6); };
        put(0, 2); tile('Check'); const half = P.ed.msg;
        put(0, 32); put(2, 12); put(2, 17); tile('Check'); const crossed = P.ed.msg;    // red down the middle, blue across it
        tile('Clear');
        const g0 = D.deal('easy'); g0.dots.forEach(([a, b], k) => { put(k, a); put(k, b); });
        tile('Check'); const fine = P.ed.msg;
        const ok = P.done(); await wait(400);
        const g = D.games.get(c + '_' + r);
        out.flow = { half, crossed, fine, ok, shut: document.body.classList.contains('bb-collapsed'), same: !!g && JSON.stringify(g.dots) === JSON.stringify(g0.dots), url: P.share() };
        // a real click lays a dot
        P.open(); A.onStatTap(c, r, 3); tile('Clear'); await still();
        const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {}, n = P.ed.d.n;
        const v = window.__aim(n, 1, 4);
        out.flowClick = { x: v.x, y: v.y, aimed: v.ok, i: 4 * n + 1 };
      }
      return out;
    });
    let click = null;
    if (res.flowClick){
      await page.mouse.click(res.flowClick.x, res.flowClick.y); await page.waitForTimeout(800);
      click = await page.evaluate(async i => { const P = window.getFieldApp()._debug.pz(), d = P.ed && P.ed.d, got = !!d && d.dots[3].includes(i);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise(ok => setTimeout(ok, 400));
        const f = window.FIELD_WORLD, k = P.ed ? null : true; return { got, escOff: !P.ed, kept: !!k }; }, res.flowClick.i);
    }
    // Eight queens
    const q = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms));
      const A = window.FIELD_APPS.find(a => a.name === 'eight queens'); window.setFieldApp(A); await wait(1500);
      const D = A._debug, W = window.FIELD_WORLD; D.fly(5, 4); await window.__settle(5, 4);
      if (!document.body.classList.contains('bb-collapsed')){ document.getElementById('bbHandle').click(); await wait(700); await window.__settle(); }
      document.getElementById('bbHandle').click(); await wait(700);
      const P = D.pz(), E = P.ed; if (!E) return { open: false };
      const c = E.c, r = E.r, tile = n => A.onStatTap(c, r, A.statTiles(c, r).findIndex(t => String(t.value).startsWith(n)));
      const at = i => A.onCellTap(c, r, (i % 8 + 0.5) / 8, (((i / 8) | 0) + 0.5) / 8);
      const sol = [0, 4, 7, 5, 2, 6, 1, 3].map((col, row) => row * 8 + col);
      tile('Clear'); tile('Clue queen');
      at(sol[0]); at(1); const attacked = P.ed.msg, refused = !P.ed.d.given.has(1);
      tile('Check'); const many = P.ed.msg;
      let k = 1; while (D.ways([...P.ed.d.given]) > 1 && k < 7) at(sol[k++]);
      tile('Check'); const one = P.ed.msg, clues = P.ed.d.given.size;
      const ok = P.done(); await wait(400);
      const key = c + '_' + r, s0 = D.games.get(key), n0 = s0 && s0.size;
      A.onCellTap(c, r, (sol[0] % 8 + 0.5) / 8, 0.5 / 8); const stays = D.games.get(key).has(sol[0]);
      return { attacked, refused, many, one, clues, ok, n0, stays, white: A.cellItems(c, r).filter(it => it.piece === 'Q').length, url: P.share() };
    });
    // the links, each opened in a page of its own
    // the main page waits on a game that rests: chess (the last above) never does, and on CI's two cores its drawing every frame
    // in software kept every link page from loading in 90 s, while the puzzle makers' pages, opened with a resting game behind
    // them, loaded (Oct 13)
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.name === 'sokoban')));
    await page.waitForTimeout(1500);
    const open = async (url, check) => {
      // (a context of its own: its own process and its own storage, so the page takes the link and not what this one kept,
      //  and does not wait on this page's work; in the main page's context every link page timed out on CI, Oct 13)
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage();
      if (process.env.LIBS_DIR){
        const lib = f => readFile(join(process.env.LIBS_DIR, f));
        await pg.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.module\.min\.js/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('three/build/three.module.js') }));
        await pg.route(/cdn\.jsdelivr\.net\/npm\/chess\.js@1\.4\.0\/\+esm/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('chess.js/dist/esm/chess.js') }));
      }
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      let got;
      try {
        const u = new URL(url), here = new URL('games.html', base); here.search = u.search;
        await pg.goto(here.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await pg.waitForFunction(() => Array.isArray(window.FIELD_APPS) && window.getFieldApp && window.getFieldApp(), null, { timeout: 90000 });
        await pg.waitForTimeout(6000);
        got = await pg.evaluate(check);
      } catch (e){ got = { err: String(e).slice(0, 300) }; }
      await ctx.close();
      return { ...got, errs };
    };
    const mineHere = () => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return { app: A.name, mine: JSON.stringify(A._debug.pz().mine(f.c + '_' + f.r) || null) }; };
    const links = {};
    if (res.unblock && res.unblock.url) links.unblock = await open(res.unblock.url, mineHere);
    if (res.flow && res.flow.url) links.flow = await open(res.flow.url, mineHere);
    if (q.url) links.queens = await open(q.url, mineHere);
    const dec = u => { try { return JSON.stringify(JSON.parse(Buffer.from(new URL(u).searchParams.get('setup'), 'base64url').toString())); } catch { return null; } };
    const U = res.unblock || {}, F = res.flow || {};
    if (res.open || !/no way out/.test(U.hopeless || '') || !/2 moves/.test(U.fine || '') || U.ok !== true || !U.shut || U.best !== 2 || !U.mine
        || !/only one dot/.test(F.half || '') || !/cannot be joined/.test(F.crossed || '') || !/can be solved/.test(F.fine || '') || F.ok !== true || !F.shut || !F.same
        || !click || !click.got || !click.escOff
        || !/attacks/.test(q.attacked || '') || !q.refused || !/ways to finish/.test(q.many || '') || !/Exactly one way/.test(q.one || '') || q.ok !== true || q.n0 !== q.clues || !q.stays || q.white !== q.clues
        || !links.unblock || links.unblock.mine !== dec(U.url) || !links.flow || links.flow.mine !== dec(F.url) || !links.queens || links.queens.mine !== dec(q.url)
        || Object.values(links).some(x => x.errs && x.errs.length))
      failures.push(`[${current}] ${JSON.stringify({ res: { ...res, unblock: { ...U, url: !!U.url }, flow: { ...F, url: !!F.url } }, click, q: { ...q, url: !!q.url }, links })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
  }

  await page.evaluate(async h => { if (!h) return; const A = window.FIELD_APPS.find(a => a._debug && a._debug.fly); window.setFieldApp(A); await new Promise(ok => setTimeout(ok, 1200)); A._debug.fly(h.c, h.r); await new Promise(ok => setTimeout(ok, 1500)); }, homeBefore);

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
    // (paths and gates: the shuttle and the orbit are paths since Oct 10, "everything should use path")
    const D = window.getFieldApp()._debug, res = [], KINDS = { path: ['propBumper', 'propRock', 'kicker', 'rockPlain'], gate: ['gateSeg'] }, ALL = [].concat(...Object.values(KINDS));
    for (const [k, H] of D.HOLES.entries()){
      if (H.gen != null) continue;                           // (the course's own holes; the generated ones are checked below)
      const kinds = Object.keys(KINDS).filter(n => (H.toys || []).some(T => T[n]));
      if (!kinds.length) continue;
      let c = 0, r = 0;
      search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k && !D.games.get(c + '_' + r)) break search;
      const sig = its => its.filter(i => ALL.includes(i.kind)).map(i => i.kind + i.u.toFixed(4) + i.v.toFixed(4) + i.lift.toFixed(4)).join();
      const a = D.cellItems(c, r);
      let moved = false;                                     // (a gate stands up or lies down a while: give it a few seconds)
      for (let q = 0; q < 10 && !moved; q++){ await new Promise(ok => setTimeout(ok, 400)); moved = sig(D.cellItems(c, r)) !== sig(a); }
      res.push({ name: H.name, kinds, drawn: kinds.every(n => a.some(i => KINDS[n].includes(i.kind))), moved,
                 water: a.some(i => /^(drop|foam|ripple|fountBowl|cliff)$/.test(i.kind)) });
    }
    return { res, flat: D.HOLES.filter(H => (H.land || []).length < 2).map(H => H.name), old: D.HOLES.filter(H => (H.toys || []).some(T => T.fountain || T.fall)).map(H => H.name) };
  });
  if (mv.res.length < 6) failures.push(`[${current}] only ${mv.res.length} holes have movers`);
  for (const w of mv.res) if (!w.drawn || !w.moved || w.water) failures.push(`[${current}] ${w.name} (${w.kinds}): drawn ${w.drawn}, moved ${w.moved}, water toys ${w.water}`);
  if (mv.old.length) failures.push(`[${current}] fountains or waterfalls are left on ${mv.old.join(', ')}`);
  if (mv.flat.length) failures.push(`[${current}] holes with one feature of ground or none: ${mv.flat.join(', ')}`);
  console.log(`${failures.length === before5 ? 'ok  ' : 'FAIL'} ${current} (${mv.res.map(w => w.name).join(', ')})`);
  // A hole for every board (Oct 9: "can you use the index to generate a unique board for each index?"): the same index
  // always makes the same hole, neighbouring indices make different ones, a board past the course shows the hole of its
  // own index, and a few hundred generated holes are all well formed
  // mini golf opens framed (Oct 9: "when loading mini-golf load default view, dont load the zoomed view and then sweep to
  // the default view."): switched to from another game, the view is at its default at once and does not glide
  {
    const sw = await page.evaluate(async () => {
      const apps = window.FIELD_APPS, golf = window.getFieldApp(), other = apps.find(a => a !== golf && a.name === 'field chess') || apps.find(a => a !== golf);
      window.setFieldApp(other); await new Promise(ok => setTimeout(ok, 300));
      window.FIELD_WORLD.st.zoom = 800;                      // (far out, as an overview)
      window.setFieldApp(golf);
      const zs = [];
      for (let q = 0; q < 16; q++){ zs.push(+window.FIELD_WORLD.st.zoom.toFixed(2)); await new Promise(ok => setTimeout(ok, 120)); }
      return { zs, back: window.getFieldApp() === golf };
    });
    const range = Math.max(...sw.zs) - Math.min(...sw.zs);
    if (!sw.back || range > 1 || sw.zs[0] > 400) failures.push(`[mini golf opens framed] zoom over the first 2 s: ${sw.zs.join(', ')}`);
    else console.log('ok   mini golf opens framed');
  }
  current = 'mini golf boards';
  const before10 = failures.length;
  const gb = await page.evaluate(() => {
    const D = window.getFieldApp()._debug, E = D.editor, J = o => JSON.stringify(o);
    const same = J(D.genSrc(5000)) === J(D.genSrc(5000)), names = new Set(), maps = new Set(), bad = [];
    for (let i = 22; i < 322; i++){ const s = D.genSrc(i), c = E.cleanSrc(s); names.add(s.name); maps.add(J([s.land, s.map, s.toys]));
      if (!c || J(c.land) !== J(s.land) || J(c.toys) !== J(s.toys) || J(c.map) !== J(s.map) || c.land.length < 3) bad.push(i); }
    const k1 = D.holeAt(5000), k2 = D.holeAt(5000), k3 = D.holeAt(5001);
    let c = 0, r = 0, found = null;
    search: for (r = 0; r < 60; r++) for (c = 0; c < 60; c++) if (D.boardIdx(c, r) >= 22){ found = { c, r }; break search; }
    const kb = found && D.holeOf(found.c, found.r);
    return { same, distinct: maps.size, names: names.size, bad: bad.slice(0, 5), k: [k1, k2, k3], board: found && { idx: D.boardIdx(found.c, found.r), gen: D.HOLES[kb].gen, num: D.HOLES[kb].num },
             course: D.holeOf(0, 0), wire: found ? D.cellItems(found.c, found.r).some(i => /^wire/.test(i.kind)) : null };
  });
  if (!gb.same || gb.distinct < 300 || gb.bad.length) failures.push(`[${current}] generated holes: same ${gb.same}, ${gb.distinct} of 300 different, ill-formed ${gb.bad.join(',')}`);
  if (gb.k[0] !== gb.k[1] || gb.k[0] === gb.k[2]) failures.push(`[${current}] holeAt kept ${JSON.stringify(gb.k)}`);
  if (!gb.board || gb.board.gen !== gb.board.idx || gb.board.num !== gb.board.idx + 1 || gb.course !== 0) failures.push(`[${current}] a board's hole: ${JSON.stringify(gb)}`);
  if (gb.wire !== false) failures.push(`[${current}] the wireframe is on by default (Oct 9: off unless turned on)`);
  // lighter on a field of thousands (Oct 9: "is getting heavy … we can resrict the tilt, clamp it"): mini golf's tilt floor
  // is 62° (50° until Oct 12). One look, or none (Oct 12: "they should never change from one thing to antoher" … "then don't show the objects
  // until they are in their final state"), then full drawing (Oct 12, later: "restore full drawing functionaility. no special
  // handeling."): a board at 400 px and at 200 px has the very pieces it has at 2000, kind for kind and as many
  const lod = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, k = D.HOLES.findIndex(H => H.name === 'the fences');
    let c = 0, r = 0; search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k && !D.games.get(c + '_' + r)) break search;
    const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
    const big = D.cellItems(c, r, 2000), mid = D.cellItems(c, r, 400), small = D.cellItems(c, r, 200), kinds = its => [...new Set(its.map(i => i.kind.replace(/\d+$/, '').replace(/^land[ML]$/, 'land').replace(/~$/, '')))].sort().join(',');   // (the ground's grains are one ground, and a piece's plain twin the piece: Oct 14)
    return { floor: window.LAB.pitchMin, appFloor: A.pitchMin, big: big.length, mid: mid.length, small: small.length, smallKinds: kinds(small), midKinds: kinds(mid), bigKinds: kinds(big),
             framedSmall: D.cellItems(f.c, f.r, 100).length }; });
  if (lod.floor !== 45 || lod.appFloor !== 45) failures.push(`[${current}] the tilt floor is ${lod.floor} (wanted 45 for mini golf: 62 from Oct 12, "clamp the tilt so that the horizon is reduced", lowered on Oct 14 once its pieces fade)`);
  if (lod.mid !== lod.big || lod.midKinds !== lod.bigKinds || lod.small !== lod.big || lod.smallKinds !== lod.bigKinds || !(lod.framedSmall > 20))
    failures.push(`[${current}] full drawing at every size: ${JSON.stringify(lod)}`);
  // guards round every cup and kinds of bumper (Oct 9: "there should different types of bumpers. each board should have
  // objects that have orbits. the orbits should try to protect the golf hole."): every cup two cells in from the sides and
  // the top, all four kinds of bumper turn up, and an old bumper without a kind is read as the classic.
  // (Oct 9, later: "golf holes are sometimes completely without protection. put barriers between the golfer opening shot and
  //  the golf hole. create a variety of strategies of golf hole protection, such as elevating them or putting them on the
  //  side of a bump, etc.": over 1000 generated holes every cup has a guard, every way of keeping one turns up, boulders
  //  going round are fewer than one in twenty, and no hole leaves the straight line from the tee to the cup open)
  const gd = await page.evaluate(() => {
    const D = window.getFieldApp()._debug, E = D.editor, edge = [], kinds = new Set(), st = {}, open = [], unguarded = [];
    // (every level in turn: since Oct 10 the corner's boards are gentler and leave out the guards of ground, and a pond, being
    //  water, is mostly kept for the higher levels)
    for (let i = 22; i < 1022; i++){ const s = D.genSrc(i, 1 + i % 5), j = s.map.findIndex(r => r.includes('O')), c = s.map[j].indexOf('O');
      if (!s.guard) unguarded.push(i); else st[s.guard] = (st[s.guard] || 0) + 1;
      if (s.open) open.push(i);
      if (c < 2 || c > D.NX - 3 || j < 2) edge.push(i);
      s.toys.forEach(T => { if (T.kick) kinds.add(T.kick[3]); }); }
    const course = D.HOLES.filter(H => H.gen == null && !H.custom).length;
    const old = E.cleanSrc({ map: Array(13).fill('........'), toys: [{ kick: [2, 3, 0.3] }, { kick: [4, 5, 0.3, 2] }, { orbit: [4, 6, 1, 0.4, 6] }] });
    return { st, open: open.slice(0, 6), unguarded: unguarded.slice(0, 6), course, edge: edge.slice(0, 6), kinds: [...kinds].sort(), old: old && old.toys.filter(T => T.kick).map(T => T.kick[3]), oldOrbit: old && old.toys.find(T => T.path), stillOrbit: old && old.toys.some(T => T.orbit || T.shuttle),
             tools: ['kick1', 'kick2', 'kick3', 'arm', 'swing'].every(t => E.TOOLS.some(x => x[0] === t)), cap: D.MAX_STROKES };
  });
  const STYLES = ['rocks', 'orbiters', 'sweep', 'cross', 'slide', 'gate', 'horseshoe', 'arc', 'scatter', 'apron', 'raised', 'crater', 'moat',
                  'mound', 'hillside', 'berm', 'turnstile', 'door', 'pond', 'wall', 'chicane', 'pegs', 'hook', 'sbend'];   // (the curved ones: Oct 10)
  // (the snail, the hardest, comes only at level 5, about one hole in a hundred: some in 800 of them)
  const snails = await page.evaluate(() => { const D = window.getFieldApp()._debug; let n = 0; for (let i = 22; i < 822; i++) if (D.genSrc(i, 5).guard === 'snail') n++; return n; });
  if (snails < 3) failures.push(`[${current}] snails at level 5: ${snails} in 800`);
  if (gd.unguarded.length || gd.open.length) failures.push(`[${current}] holes left open: no guard ${gd.unguarded.join(',')}, the tee's line clear ${gd.open.join(',')}`);
  // (a pond, water, is mostly kept for the higher levels by the guess: two or more will do; Oct 10. So with the S-bend, which
  //  comes about five times in a thousand (15 and 16 in 3000 before and after Oct 11's leaves), so five was a coin toss)
  if ((gd.st.rocks || 0) > 50 || STYLES.some(k => !(gd.st[k] >= (k === 'pond' || k === 'sbend' ? 2 : 5)))) failures.push(`[${current}] the ways of keeping a cup: ${JSON.stringify(gd.st)}`);
  if (gd.edge.length) failures.push(`[${current}] cups near the edge ${gd.edge.join(',')}`);
  // (an old orbit is read as a path round its circle since Oct 10: a boulder, from its start)
  if (!gd.oldOrbit || gd.stillOrbit || gd.oldOrbit.path.slice(-2).join() !== '0,0' || (gd.oldOrbit.path.length - 4) / 2 < 8) failures.push(`[${current}] an old orbit was not read as a path: ${JSON.stringify(gd.oldOrbit)}`);
  if (gd.kinds.join() !== '0,1,2,3' || (gd.old || []).join() !== '0,2' || !gd.tools) failures.push(`[${current}] bumper kinds: ${JSON.stringify(gd)}`);
  // the turnstile and the door (Oct 9: "add new objects to explore how this might be done"): a bar turning or swinging
  // knocks a ball lying in its way along with it, both are read from a link, and both are drawn on a board, turning
  const tu = await page.evaluate(async () => {
    const D = window.getFieldApp()._debug, E = D.editor, CW = D.CW, out = {};
    const src = E.cleanSrc({ map: [...Array(12).fill('........'), '...T....'].map((r, j) => j === 2 ? '...O....' : r), toys: [{ arm: [4, 6, 1.2, 4, 0, 2] }, { swing: [1, 9, 1.2, 0, 90, 3] }] });
    out.read = src && src.toys.map(T => Object.keys(T)[0] + ':' + Object.values(T)[0].length).join();
    const H = D.compileHole(JSON.parse(JSON.stringify(src)));
    for (const [name, x, y, vy] of [['arm', 4.6, 6.25, 0], ['swing', 1.6, 9.25, -0.3]]){   // (a door shut and still: the ball rolls into it)
      const g = { ball: { x: x * CW, y: y * CW, vx: 0, vy }, t: 0.001 };
      const hit = D.hitToys(g, H);
      out[name] = { hit: +hit.toFixed(3), vy: +g.ball.vy.toFixed(3) };
    }
    let c = 0, r = 0, k = -1;
    search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++){ k = D.holeOf(c, r); if ((D.HOLES[k].toys || []).some(T => T.arm)) break search; }
    const bars = () => D.cellItems(c, r, 2000).filter(i => i.kind === 'armBar').map(i => i.yaw.toFixed(3)).join();
    const a = bars(); await new Promise(ok => setTimeout(ok, 700));
    out.drawn = { found: (D.HOLES[k].toys || []).some(T => T.arm), bars: a.split(',').filter(Boolean).length, turned: bars() !== a };
    return out; });
  // (a door has seven numbers since Oct 11, the last its phase, filled in as nothing: movers kept apart)
  if (tu.read !== 'arm:6,swing:7' || !(tu.arm.hit > 0 && tu.arm.vy > 0) || !(tu.swing.hit > 0 && tu.swing.vy > 0) || !tu.drawn.found || !(tu.drawn.bars >= 2) || !tu.drawn.turned)
    failures.push(`[${current}] the turnstile and the door: ${JSON.stringify(tu)}`);
  // a board keeps its hole whatever the field's size, and names come round less (Oct 9): the index is made from the board's
  // column and row alone, every one its own, small near the corner; 300 boards have at least 270 names
  const bi = await page.evaluate(() => { const D = window.getFieldApp()._debug, seen = new Set(); let small = true;
    for (let r = 0; r < 40; r++) for (let c = 0; c < 40; c++){ const i = D.boardIdx(c, r); seen.add(i); if (c < 5 && r < 5 && i >= 25) small = false; }
    const N0 = window.FIELD_WORLD.st.N, a = D.boardIdx(3, 2); window.FIELD_WORLD.st.N = N0 * 4; const b2 = D.boardIdx(3, 2); window.FIELD_WORLD.st.N = N0;
    return { unique: seen.size, small, stable: a === b2 }; });
  if (bi.unique !== 1600 || !bi.small || !bi.stable) failures.push(`[${current}] board indices: ${JSON.stringify(bi)}`);
  if (gb.names < 270) failures.push(`[${current}] only ${gb.names} names in 300 boards`);
  console.log(`${failures.length === before10 ? 'ok  ' : 'FAIL'} ${current} (${gb.names} names in 300)`);

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
  // (mini golf's row is the editor's since Oct 10, "remove the game mode", so four stand-in tiles are lent it for this)
  await page.evaluate(() => { const A = window.getFieldApp(); A._statTiles0 = A.statTiles; A.statTiles = () => [1, 2, 3, 4].map(n => ({ label: 'T' + n, value: n }));
    try { window.refreshFieldBrowser && window.refreshFieldBrowser(); } catch {} });
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
  await page.evaluate(() => { const A = window.getFieldApp(); A.statTiles = A._statTiles0; delete A._statTiles0; try { window.refreshFieldBrowser && window.refreshFieldBrowser(); } catch {} });
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
    // (a hold and let go toggles the bottom row, and mini golf's row is its editor, Oct 10: whether the hold's timer fires
    //  before the release depends on how long the frames take, so on CI it opened the editor and the tap below moved the
    //  editor there instead of teeing off; the editor is shut again here, Oct 12)
    await page.evaluate(() => { const E = window.getFieldApp()._debug.editor; if (E.ED.on) E.editStop(true); });
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
      const D = window.getFieldApp()._debug, CW = D.CW, isl = D.HOLES.find(H => H.name === 'the island'), box = D.HOLES.find(H => H.name === 'the bunkers');
      return {
        corner: D.groundAt(isl, 1.06 * CW, 1.06 * CW), mid: D.groundAt(isl, 3.5 * CW, 1.5 * CW),
        sandCorner: D.groundAt(box, 1.04 * CW, 2.04 * CW), sandMid: D.groundAt(box, 2.5 * CW, 3.5 * CW),
        skate: D.HOLES.filter(H => (H.land || []).some(f => f.bowl || f.pipe || f.dish || f.trough)).map(H => H.name),
      };
    });
    if (r.corner !== '.' || r.mid !== '~') failures.push(`[${current}] the island's moat: corner ${r.corner}, middle ${r.mid} (wanted grass at the rounded corner, water in the middle)`);
    if (r.sandCorner !== '.' || r.sandMid !== 's') failures.push(`[${current}] the bunkers' sand: corner ${r.sandCorner}, middle ${r.sandMid}`);
    if (r.skate.length < 4) failures.push(`[${current}] skate-park holes: ${r.skate.join(', ')}`);
    // NO PAINTED WATER OR SAND (Oct 11: "then water, grass and sand are not needed. remove them."): no paint for them in the
    // editor; the course and the generated holes have none in their cells (their water and sand are shapes); an old hole with
    // painted water ringing round an island, planks over it, and sand reads as lakes and a bunker, the cells grass and the
    // planks kept; the rapids' bridge lies flat just over its water, with no water across its ends
    const np = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, E = D.editor, CW = D.CW;
      const paints = E.TOOLS.filter(t => ['.', 's', '~'].includes(t[0])).map(t => t[1]);
      const painted = s => s.map.some(r => /[~s]/.test(r));
      const course = [...D.HOLES.slice(0, 22), ...E.HOLE_SRC].filter(painted).map(H => H.name);
      let gen = 0; for (let i = 22; i < 322; i++) if (painted(D.genSrc(i, 1 + i % 5))) gen++;
      const old = E.cleanSrc({ map: ['........', '.~~~~~~.', '.~~O.~~.', '.~~..~~.', '.~~==~~.', '........', '........', '.sss....', '.sss....', '........', '........', '........', '...T....'] });
      const lakes = old.land.filter(f => f.lake).length, sands = old.land.filter(f => f.sand).length, cells = old.map.join('');
      const H = D.HOLES[E.addHole(old)], g = (x, y) => D.groundAt(H, x * CW, y * CW);
      const read = { water: g(1.5, 2.5), top: g(3.5, 1.5), right: g(6.5, 3), island: g(3.5, 3.2), plank: g(3.5, 4.5), end: g(3.5, 5.03), sand: g(2, 8), grass: g(6, 8) };
      const rp = D.HOLES.find(H => H.name === 'the rapids'), deck = [5.03, 5.5, 6.5, 7.5, 7.97].map(y => D.hOf(rp, 3.5 * CW, y * CW)), lv = E.shapesOf(rp).lake[0].level;
      const ends = [4.97, 4.9, 8.03, 8.1].flatMap(y => [3.05, 3.5, 3.95].map(x => D.groundAt(rp, x * CW, y * CW))).filter(c => c === '~').length;
      return { paints, course, gen, lakes, sands, cells: { water: cells.includes('~'), sand: cells.includes('s'), planks: cells.split('=').length - 1 }, read,
               flat: Math.max(...deck) - Math.min(...deck), over: Math.min(...deck) - lv, ends };
    });
    if (np.paints.length || np.course.length || np.gen || np.lakes < 2 || np.sands !== 1 || np.cells.water || np.cells.sand || np.cells.planks !== 2
        || np.read.water !== '~' || np.read.top !== '~' || np.read.right !== '~' || np.read.island !== '.' || np.read.plank !== '=' || np.read.end === '~' || np.read.sand !== 's' || np.read.grass !== '.'
        || !(np.flat < 0.002) || !(np.over > 0.003 && np.over < 0.012) || np.ends)
      failures.push(`[${current}] no painted water or sand: ${JSON.stringify(np)}`);
    // WINDING STREAMS (Oct 11: "4", a stream that meanders down the hole): a generated stream is a lake winding across the
    // board (its bank swings more than a cell up and down on most), its planks over water with dry ground at both their ends,
    // the tee and the cup clear of it
    const ws = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, E = D.editor, CW = D.CW; let n = 0, winding = 0, under = 0, dry = 0, clear = Infinity;
      for (let idx = 22; idx < 2000 && n < 40; idx++){ const H = D.HOLES[D.holeAt(idx)];
        const st = E.shapesOf(H).lake.find(s => s.B.box[0] < -0.2 * CW && s.B.box[2] > D.WD + 0.2 * CW); if (!st) continue; n++;
        const rows = H.map.map((r, j) => r.split('=').length > 2 && (j + 1) * CW > st.B.box[1] - 0.5 * CW && j * CW < st.B.box[3] + 0.5 * CW ? j : -1).filter(j => j >= 0);
        if (!rows.length) continue;
        const j0 = Math.min(...rows), j1 = Math.max(...rows) + 1, cols = [...H.map[j0]].map((c, i) => c === '=' ? i : -1).filter(i => i >= 0);
        if (cols.some(i => { for (let y = j0; y < j1; y += 0.05) if (E.blobIn(st.B, (i + 0.5) * CW, y * CW)) return true; return false; })) under++;
        let wet = false; for (const i of cols) for (const f of [0.05, 0.5, 0.95]) for (const y of [j0 - 0.25, j0 - 0.05, j1 + 0.05, j1 + 0.25]) if (D.groundAt(H, (i + f) * CW, y * CW) === '~') wet = true;
        if (!wet) dry++;
        let lo = Infinity, hi = -Infinity;
        for (let x = 0.3; x < 7.7; x += 0.2) for (let y = 1.5; y < 12; y += 0.02) if (E.blobIn(st.B, x * CW, y * CW)){ lo = Math.min(lo, y); hi = Math.max(hi, y); break; }
        if (hi - lo > 1) winding++;
        for (const p of [H.tee, H.cup]) for (let q = 0; q < st.B.M; q++) clear = Math.min(clear, Math.hypot(st.B.pts[2 * q] - p.x, st.B.pts[2 * q + 1] - p.y) / CW);
      }
      return { n, winding, under, dry, clear: +clear.toFixed(2) }; });
    if (ws.n < 30 || ws.winding < ws.n * 0.7 || ws.under !== ws.n || ws.dry !== ws.n || !(ws.clear > 1))
      failures.push(`[${current}] winding streams: ${JSON.stringify(ws)}`);
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
  // The toys carry on when a board is tapped (Oct 10: "when i click a board, dont reset the animation. just continue where
  // its at currently."): a board no one plays runs its toys on the page's clock; the game a tap starts takes its clock
  // from there, not from nought
  current = 'mini golf toys carry on';
  const beforeT = failures.length;
  {
    const tc = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      let spot = null; for (let dc = -3; dc <= 3 && !spot; dc++) for (let dr = -3; dr <= 3 && !spot; dr++){ const c = f.c + dc, r = f.r + dr; if (c >= 0 && r >= 0 && !D.games.get(c + '_' + r)) spot = [c, r]; }
      if (!spot) return { none: true };
      const now = performance.now() / 1000; A.onCellTap(spot[0], spot[1], 0.5, 0.5);
      const g = D.games.get(spot[0] + '_' + spot[1]); return { t: g && g.t, now, lag: g ? Math.abs(g.t - now) : null }; });
    if (tc.none || !(tc.lag < 1)) failures.push(`[${current}] a tapped board's toys' clock: ${JSON.stringify(tc)}`);
  }
  console.log(`${failures.length === beforeT ? 'ok  ' : 'FAIL'} ${current}`);

  // Crossing tracks (Oct 10: "seems like the golfe game could be more creative with orbits of the generated games. it gets
  // interesting with a variety of crossing paths that create complicated paths to golf hole."): of 200 generated holes,
  // at least four in ten carry a weave, of at least five patterns, and in every one two movers' tracks come within a
  // rider's width of each other (they cross)
  current = 'mini golf weaves';
  const beforeW = failures.length;
  {
    const wv = await page.evaluate(() => { const D = window.getFieldApp()._debug, kinds = {}; let n = 0, apart = [];
      const track = T => { const k = Object.keys(T)[0], v = T[k], out = [];
        if (k === 'orbit') for (let q = 0; q < 48; q++) out.push([v[0] + v[2] * Math.cos(q / 48 * 6.283), v[1] + v[2] * Math.sin(q / 48 * 6.283)]);
        else if (k === 'shuttle') for (let q = 0; q <= 24; q++) out.push([v[0] + (v[2] - v[0]) * q / 24, v[1] + (v[3] - v[1]) * q / 24]);
        else if (k === 'path'){ const m = (v.length - 4) >> 1; for (let q = 0; q < m; q++){ const a = q, b = (q + 1) % m; for (let s = 0; s < 6; s++) out.push([v[2 * a] + (v[2 * b] - v[2 * a]) * s / 6, v[2 * a + 1] + (v[2 * b + 1] - v[2 * a + 1]) * s / 6]); } }
        return out; };
      for (let i = 22; i < 222; i++){ const s = D.genSrc(i, 3); if (!s.weave) continue;   // (level 3, the generator as it was: the levels, Oct 10)
        n++; kinds[s.weave] = (kinds[s.weave] || 0) + 1;
        const ts = s.toys.filter(T => T.path).map(track); let best = Infinity;
        for (let a = 0; a < ts.length; a++) for (let b = a + 1; b < ts.length; b++) for (const p of ts[a]) for (const q of ts[b]) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1]));
        if (!(best < 0.35)) apart.push([i, s.weave, +best.toFixed(2)]); }
      return { n, kinds, apart: apart.slice(0, 5), nApart: apart.length }; });
    if (wv.n < 80 || Object.keys(wv.kinds).length < 5 || wv.nApart) failures.push(`[${current}] ${JSON.stringify(wv)}`);
  }
  console.log(`${failures.length === beforeW ? 'ok  ' : 'FAIL'} ${current}`);

  // THE LEVELS (Oct 10: "Now we way to adjust the difficulty, what do you suggest" … "ok, proceed"): a generated hole's level
  // comes from its board's ring (doubling out from the corner) and the menu's Difficulty (kept in this browser), and the
  // level's dials show in what is made: more riders, more often a weave, wider bridges low down
  current = 'mini golf levels';
  const beforeL = failures.length;
  {
    const lv = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor;
      const rings = [0, 30, 49, 300, 1000, 5000].map(i => E.ringLevel(i));
      const item = () => A.menu[0].items.find(i => typeof i.label === 'function' && /^Difficulty/.test(i.label()));
      const lab0 = item().label(), k0 = D.holeAt(17 * 17), l0 = D.HOLES[k0].level;
      item().on(); const lab1 = item().label(), stored = localStorage.getItem('golf.level'), k1 = D.holeAt(17 * 17), l1 = D.HOLES[k1].level;
      item().on(); item().on(); item().on(); const lab2 = item().label(), l2 = D.HOLES[D.holeAt(17 * 17)].level;
      const avg = (L, f) => { let s = 0; for (let i = 0; i < 30; i++) s += f(D.genSrc(500 + i * 41, L)); return s / 30; };
      const riders = [1, 3, 5].map(L => +avg(L, s => s.toys.filter(T => T.path).length).toFixed(2));
      const weaves = [1, 3, 5].map(L => +avg(L, s => s.weave ? 1 : 0).toFixed(2));
      // (a stream is a lake across the board since Oct 11, its planks the row's '=')
      const across = s => (s.land || []).some(f => f.lake && Math.min(...f.lake.filter((_, q) => q % 2 === 0)) < 0 && Math.max(...f.lake.filter((_, q) => q % 2 === 0)) > D.NX);
      let bridge = 9; for (let i = 0; i < 200; i++){ const s = D.genSrc(500 + i * 13, 1); const row = across(s) && s.map.find(r => r.includes('=')); if (row) bridge = Math.min(bridge, row.split('=').length - 1); }
      // (Oct 10, later: "what happens when the diffuculty mode changes, I dont notice any difference."): the board left of the
      // corner, across the wrap, is the first ring, not the farthest; every step of the setting moves the corner's boards a
      // level; the course's movers follow the setting; a generated hole's flag is its level's colour
      const wrap = E.ringOf(D.boardIdx(9999, 0)), corner = [0, 1, 2, 3].map(v => { E.setLevel(v); return E.levelAt(30); });
      const sec = () => { const T = D.HOLES.slice(0, 22).flatMap(H => H.toys).find(T => T.path); return T && T.path[T.path.length - 3]; };
      E.setLevel(1); const sN = sec(); E.setLevel(3); const sX = sec(); E.setLevel(0); const sE = sec(); E.setLevel(1);
      let c = 0, r = 0; search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.boardIdx(c, r) >= 22) break search;
      // (and the level as dots on the flag: Oct 10, later, "make the flag a little wider and show the dificulty as dots on the flag")
      const its = D.cellItems(c, r, 2000), kb = D.holeOf(c, r), flag = its.find(i => i.kind === 'pennant'), dots = its.find(i => /^flagDots/.test(i.kind));
      const fl = flag && flag.color === E.LEVEL_FLAG[D.HOLES[kb].level - 1] && dots && dots.kind === 'flagDots' + D.HOLES[kb].level
        && !D.cellItems(0, 0, 2000).some(i => /^flagDots/.test(i.kind));   // (the course's holes have no level, and no dots)
      return { rings, lab0, lab1, lab2, stored, l0, l1, l2, other: k1 !== k0, riders, weaves, bridge, wrap, corner, sec: [sE, sN, sX], fl };
    });
    if (lv.rings.join() !== '1,1,2,3,4,5' || lv.lab0 !== 'Difficulty: Normal' || lv.lab1 !== 'Difficulty: Hard' || lv.lab2 !== 'Difficulty: Normal' || lv.stored !== 'hard'
        || lv.l0 !== 4 || lv.l1 !== 5 || lv.l2 !== 4 || !lv.other || !(lv.riders[0] < lv.riders[1] && lv.riders[1] < lv.riders[2]) || !(lv.weaves[0] < lv.weaves[2]) || lv.bridge < 3
        || lv.wrap !== 1 || lv.corner.join() !== '1,2,3,4' || !(Math.abs(lv.sec[0]) > Math.abs(lv.sec[1]) && Math.abs(lv.sec[1]) > Math.abs(lv.sec[2])) || !lv.fl)
      failures.push(`[${current}] ${JSON.stringify(lv)}`);
    // (Oct 10, later: "if wireframe is off, don't show the orbit path."): a board with a path draws no dotted track while
    // Wireframe is off, and draws it with Wireframe on
    const tr = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, item = A.menu[0].items.find(i => typeof i.label === 'function' && /^Wireframe/.test(i.label()));
      let c = 0, r = 0; search: for (r = 0; r < 60; r++) for (c = 0; c < 60; c++) if (D.HOLES[D.holeOf(c, r)].toys.some(T => T.path)) break search;
      const dots = () => D.cellItems(c, r, 2000).filter(i => i.kind === 'ghost' && i.color === 0xd8efd0).length;
      const off = dots(); item.on(); const on = dots(); item.on(); return { off, on, wire: item.label() }; });
    if (tr.off !== 0 || !(tr.on > 8) || tr.wire !== 'Wireframe: off') failures.push(`[${current}] the movers' tracks and Wireframe: ${JSON.stringify(tr)}`);
  }
  // RATED AS YOU PLAY, AND THE SCORECARD (Oct 10: "6,4,2,3", 4 being "rate each hole quietly while you play it, then show
  // its stars and par at the end of the round"): a round started on a generated board rates its hole in the background;
  // a hole sunk once rated carries its stars into the message and onto the card; the scorecard lists every hole of the
  // round with its par, strokes and stars, and closes by a real click on Close and by Escape
  {
    const sc = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor;
      let c = 0, r = 0; search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.boardIdx(c, r) >= 22) break search;
      const g = D.startRound(c, r), job = E.bgRating(), k = g.hole;
      E.stopRating();
      D.HOLES[k].rated = { mean: 3.1, sd: 1, sunk: 1, stars: 3 };
      const g2 = D.holeGame({ start: k, card: [] }, k); g2.strokes = 2; E.sink(g2);
      const card = g2.R.card[0];
      E.openCardBox({ card: [card, { hole: 0, par: 3, strokes: 4, name: 'the meadow', num: 1, stars: 0 }] });
      const box = document.getElementById('golfCardBox'), rows = box ? box.querySelectorAll('.golfCardRow').length : 0, text = box ? box.textContent : '';
      return { job: !!job && job.k === k, stars: card && card.stars, name: card && card.name === D.HOLES[k].name, rows, head: /Round over — 6 strokes, par/.test(text), shown: text.includes('★★★☆☆') }; });
    await page.click('#golfCardBox button').catch(() => {});
    const closed = await page.evaluate(() => !document.getElementById('golfCardBox'));
    await page.evaluate(() => window.getFieldApp()._debug.editor.openCardBox({ card: [] }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const esc = await page.evaluate(() => !document.getElementById('golfCardBox'));
    if (!sc.job || sc.stars !== 3 || !sc.name || sc.rows !== 3 || !sc.head || !sc.shown || !closed || !esc) failures.push(`[${current}] rated as you play, and the scorecard: ${JSON.stringify({ ...sc, closed, esc })}`);
  }
  console.log(`${failures.length === beforeL ? 'ok  ' : 'FAIL'} ${current}`);

  // EVERY BOARD IN VIEW, IN FULL, EVERY FRAME (Oct 12: "restore full drawing functionaility. no special handeling. only thing
  // is dont draw non-visible boards and no animation when panning or resizing."): with the view still, every frame drawn asks
  // every board on the screen for its pieces, each at its own size (framed in this window the nearer neighbours are over
  // 600 px across), and no board wholly off the screen is asked
  current = 'every board in view drawn in full';
  {
    const before = failures.length;
    const dc = await page.evaluate(async () => {
      const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), fk = f.c + ',' + f.r, orig = A.cellItems, R = window.fieldRest;
      const wait = ms => new Promise(ok => setTimeout(ok, ms)), calls = new Map(), bps = [], off = new Set();
      const cam = W.camera, [sx, sz] = W.spacing(), T = W.THREE, bW = W.boardW();
      const seen = (c, r) => { const cell = W.cellAt(W.target.boardX, W.target.boardZ);   // (the board's centre from the framed one, by the spacing)
        const GS = Math.max(1, Math.round(Math.sqrt(W.st.N))), d = v => ((v % GS) + GS + Math.floor(GS / 2)) % GS - Math.floor(GS / 2);   // (the field wraps: the nearer way round)
        const cx = W.target.boardX + d(c - cell.c) * sx, cz = W.target.boardZ + d(r - cell.r) * sz;
        cam.updateMatrixWorld(); const F = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        return F.intersectsBox(new T.Box3(new T.Vector3(cx - 0.8 * bW, -0.2 * bW, cz - 0.8 * bW), new T.Vector3(cx + 0.8 * bW, 1.2 * bW, cz + 0.8 * bW))); };
      A.cellItems = function(c, r, bp){ const k = c + ',' + r; calls.set(k, (calls.get(k) || 0) + 1); if (k !== fk){ bps.push(bp); if (!seen(c, r)) off.add(k); } return orig.call(this, c, r, bp); };
      window.dispatchEvent(new Event('click')); await wait(400); calls.clear(); bps.length = 0; off.clear();
      const d0 = R.drawn, t0 = performance.now(); await wait(2500); while (R.drawn - d0 < 3 && performance.now() - t0 < 20000) await wait(250);   // (a software renderer may take seconds a frame)
      const drawn = R.drawn - d0;
      A.cellItems = orig;
      const others = [...calls].filter(([k]) => k !== fk).map(([, n]) => n);
      return { drawn, framed: calls.get(fk) || 0, boards: calls.size, othersMin: others.length ? Math.min(...others) : 0, othersMax: Math.max(0, ...others), bpMax: bps.length ? Math.max(...bps) : 0, off: [...off].slice(0, 6), offN: off.size };
    });
    // (the wrapped field's spacing may not match a far board's place, so a few at the screen's corners are let off)
    if (!(dc.drawn >= 3) || !(dc.othersMax >= dc.drawn * 0.8) || !(dc.bpMax >= 600) || dc.offN > 2)
      failures.push(`[${current}] ${JSON.stringify(dc)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (${dc.boards} boards asked over ${dc.drawn} frames drawn, each up to ${dc.othersMax} times, the largest at ${Math.round(dc.bpMax)} px, ${dc.offN} off the screen)`);
    // LIGHTER (Oct 12: "its heavy, and its not as fast as all the other games." … "yes, proceed"): a framed field of holes drew
    // 958,000 triangles, bumpers and boulders at 9,408 each, every brick's back and underside, the ground at eight rows a
    // cell; now 540,000 in the same view, and it must stay under 700,000
    const tris = await page.evaluate(() => { let t = 0; window.FIELD_WORLD.scene.traverse(o => { if (o.isMesh && o.visible){ const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; t += n * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(t); });
    if (!(tris < 700000)) failures.push(`[${current}] a framed field of holes draws ${tris} triangles (under 700,000 wanted)`);
    console.log(`     (${(tris / 1000).toFixed(0)}k triangles framed)`);
    // THE GROUND'S GRAINS (Oct 14: "could mini-golf and chess beneifit from better LOD handeling of this application." … "yes"):
    // each grain carries the next coarser one's surface at its own points, exactly (at a weight of 1 it is that grain on the
    // screen, positions and colours alike), the grain and weight follow the board's size, and the weights reach the GPU
    const gg = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, T = window.FIELD_WORLD.THREE, H = D.HOLES[30], R = D.GROUND_ROWS, out = { d: [] };
      for (const [a, b] of [[0, 1], [1, 2]]){
        const F = D.groundGeo(T, H, R[a]), C = D.groundGeo(T, H, R[b]), fx = Math.round(R[a] * D.WD), cx = Math.round(R[b] * D.WD), r = fx / cx;
        const P2 = F.attributes.pos2.array, C2 = F.attributes.col2.array, CP = C.attributes.position.array, CC = C.attributes.color.array; let d = 0;
        for (let j = 0; j <= R[b]; j++) for (let i = 0; i <= cx; i++){ const fo = (j * r * (fx + 1) + i * r) * 3, co = (j * (cx + 1) + i) * 3;
          for (let q = 0; q < 3; q++) d = Math.max(d, Math.abs(P2[fo + q] - CP[co + q]), Math.abs(C2[fo + q] - CC[co + q])); }
        out.d.push(d);
      }
      out.last = !D.groundGeo(T, H, R[2]).attributes.pos2;
      // (the pieces: a clad piece's every point fades into its core box, a bumper's onto its coarser build exactly, Oct 14)
      const cg = D.cladGeo(T, 'stone', 1, 0.88, 1, -0.6, 0.25, 11), cp = cg.attributes.pos2.array; let outside = 0;
      for (let i = 0; i < cp.length; i += 3) if (Math.abs(cp[i]) > 0.5 + 1e-6 || cp[i + 1] < -0.6 - 1e-6 || cp[i + 1] > 0.28 + 1e-6 || Math.abs(cp[i + 2]) > 0.5 + 1e-6) outside++;
      out.clad = { outside, plain: D.cladPlain(T, 'stone', 1, 0.88, 1, -0.6).attributes.position.count / 3 };
      const PF = D.propGeo('bumper'), PC = D.propGeo('bumper', true);
      if (PF && PF.attributes.pos2){ const fp = PF.attributes.pos2.array, pc = PC.attributes.position.array, fn = 16 * 33 + 2, cn = 8 * 17 + 2; let d = 0;
        for (let q = 0; q < PF.attributes.position.count / fn; q++) for (let k = 0; k <= 32; k += 2) for (let r = 0; r < 3; r++) d = Math.max(d, Math.abs(fp[(q * fn + k) * 3 + r] - pc[(q * cn + k / 2) * 3 + r]));
        out.prop = d; }
      out.pieces = [800, 360, 200].map(bp => { const g = D.pieceGrain(bp); return g.plain ? 'plain' : +g.w.toFixed(2); });
      out.grains = [3000, 480, 360, 240, 120, 40].map(bp => { const g = D.groundGrain(bp); return [g.g, +g.w.toFixed(2)]; });
      let morphMeshes = 0; window.FIELD_WORLD.scene.traverse(o => { if (o.isInstancedMesh && o.visible && o.count && o.geometry.attributes.instMorph) morphMeshes++; });
      out.morphMeshes = morphMeshes; return out; });
    const gOk = gg.d.every(d => d < 1e-6) && gg.last && JSON.stringify(gg.grains.map(x => x[0])) === '[0,0,0,1,1,2]'
      && gg.grains[0][1] === 0 && gg.grains[2][1] > 0 && gg.grains[2][1] < 1 && gg.morphMeshes > 0
      && gg.clad.outside === 0 && gg.clad.plain === 10 && (gg.prop == null || gg.prop < 1e-6) && gg.pieces[0] === 0 && gg.pieces[1] > 0 && gg.pieces[1] < 1 && gg.pieces[2] === 'plain';
    if (!gOk) failures.push(`[${current}] the ground's grains: ${JSON.stringify(gg)}`);
    console.log(`${gOk ? 'ok  ' : 'FAIL'} the ground's and the pieces' grains (a grain at weight 1 is the next within ${Math.max(...gg.d)}; a bumper within ${gg.prop}; ${gg.morphMeshes} kinds morphing)`);
    // CHESS'S PIECES FADE (Oct 14: "ok", on chess after mini golf): a rung carries the next coarser one at its points, exactly
    // where their grids share points; the level drawn does not jump at any rung's boundary; and the rungs are the ones they were
    // (floor of the level), so the triangles are too. A studio file stands in for the pieces, which the sandbox cannot fetch.
    const cf = await page.evaluate(async () => {
      const L = window.fieldLOD, C = L.parseTVF3D(await (await fetch('res/rock.tvf3d')).text());
      const F = L.buildFieldGeometry(64, C), G = L.buildFieldGeometry(32, C), laid = L.fieldMorph(F, G, 64, 32);
      const f = L.fieldGridOf(64), c = L.fieldGridOf(32), parts = F.attributes.position.count / f.n, P2 = F.attributes.pos2.array, GP = G.attributes.position.array; let d = 0;
      for (let p = 0; p < parts; p++) for (let k = 0; k <= 136; k += 17) for (let r = 0; r < 3; r++) d = Math.max(d, Math.abs(P2[(p * f.n + k) * 3 + r] - GP[(p * c.n + k * 72 / 136) * 3 + r]));
      const look = bp => { const K = L.rungFor(0, 0, bp, 64); return Math.log2(K) - L.rungW; };
      let jump = 0; for (let k = 1; k <= 6; k++){ const b = 32 * 2 ** (k - 1); jump = Math.max(jump, Math.abs(look(b * 1.0001) - look(b * 0.9999))); }
      const rungs = [20, 40, 100, 300, 900, 3000].map(bp => L.rungFor(0, 0, bp, 64));
      return { laid, d, jump, rungs, parts }; });
    const cOk = cf.laid && cf.d < 1e-6 && cf.jump < 0.01 && JSON.stringify(cf.rungs) === '[1,2,4,16,32,64]';
    if (!cOk) failures.push(`[${current}] chess's pieces fading: ${JSON.stringify(cf)}`);
    console.log(`${cOk ? 'ok  ' : 'FAIL'} chess's pieces fade between rungs (exact within ${cf.d}, a jump of ${cf.jump.toFixed(4)} rungs at most)`);
    // FLAT PIECES' GRAINS (Oct 14: "2,5"): a kit disc or ring carries the next coarser polygon at its points exactly (each of
    // its corners on the coarser one's, the rest on its sides), and the field takes 48 sides to 12 to 6 as it shrinks
    const fg = await page.evaluate(() => { const T = window.FIELD_WORLD.THREE, K = window.FieldKit, L = window.fieldLOD, out = {};
      for (const [name, g, c] of [['disc', K.disc(T, 0.3, 0.004, 48), K.disc(T, 0.3, 0.004, 12)], ['disc12', K.disc(T, 0.3, 0.004, 12), K.disc(T, 0.3, 0.004, 6)], ['ring', K.ring(T, 0.1, 0.2, 0.006, 48), K.ring(T, 0.1, 0.2, 0.006, 12)]]){
        if (!L.flatMorph(g)){ out[name] = 'no morph'; continue; }
        const S = g.userData.flat.seg, cs = c.userData.flat.seg, per = S / cs, P = g.attributes.position, P2 = g.attributes.pos2, C = c.attributes.position, ring = name === 'ring';
        let d = 0, side = 0;
        for (let v = ring ? 0 : 1; v < P.count; v++){
          const row = ring ? Math.floor(v / (S + 1)) : 0, i = ring ? v - row * (S + 1) : v - 1, R = ring ? (row ? 0.2 : 0.1) : 0.3;
          // (off a corner, on the coarser polygon's side: at the apothem's distance along its middle)
          const a = Math.atan2(-P2.getZ(v), P2.getX(v)), j = Math.floor(i / per), mid = (j + 0.5) * 2 * Math.PI / cs;
          side = Math.max(side, Math.abs(Math.hypot(P2.getX(v), P2.getZ(v)) * Math.cos(a - mid) - R * Math.cos(Math.PI / cs)));
          if (i % per) continue;
          const cv = ring ? row * (cs + 1) + i / per : 1 + i / per;
          d = Math.max(d, Math.hypot(P2.getX(v) - C.getX(cv), P2.getY(v) - C.getY(cv), P2.getZ(v) - C.getZ(cv)), Math.hypot(P.getX(v) - C.getX(cv), P.getZ(v) - C.getZ(cv)));
        }
        out[name] = +Math.max(d, side).toExponential(1);
      }
      out.grains = [60, 17, 10, 6, 2].map(px => { const G = L.flatGrain(px, 48); return G.seg + ':' + G.w.toFixed(2); });
      out.trail = L.flatGrain(60, 12).seg;
      return out; });
    const fOk = [fg.disc, fg.disc12, fg.ring].every(d => typeof d === 'number' && d < 1e-6) && JSON.stringify(fg.grains) === '["48:0.00","48:0.50","12:0.00","12:0.42","6:0.00"]' && fg.trail === 12;
    if (!fOk) failures.push(`[${current}] flat pieces' grains: ${JSON.stringify(fg)}`);
    console.log(`${fOk ? 'ok  ' : 'FAIL'} flat pieces fade 48 → 12 → 6 sides (exact within ${Math.max(fg.disc, fg.disc12, fg.ring)})`);
    // and the pools grow as they are filled (Oct 11, "Smaller piece pools"): some pool has grown past its first 256 and
    // holds more than that, and all of them together hold under a million (4.2 million were set aside before)
    const pools = await page.evaluate(() => { let slots = 0, grown = 0; window.FIELD_WORLD.scene.traverse(o => { if (o.isInstancedMesh){ slots += o.instanceMatrix.count; if (o.instanceMatrix.count > 256 && o.count > 256) grown++; } }); return { slots, grown }; });
    if (!(pools.grown >= 1) || !(pools.slots < 1e6)) failures.push(`[${current}] pools that grow: ${JSON.stringify(pools)}`);
  }
  // MINI GOLF PLAYS ON WHILE THE VIEW MOVES (Oct 12: "don't stop it during panning."; and since Oct 14 every game does): with
  // a round going on the selected board, a real drag elsewhere pans the view, and the round's clock and the board's asks
  // go on through it
  current = 'mini golf plays on while the view moves';
  {
    const before = failures.length;
    await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      for (const k of [...D.games.keys()]) D.games.delete(k); A.onCellTap(f.c, f.r);
      const orig = A.cellItems; window.__ph = { f, n: 0, orig }; A.cellItems = function(c, r, bp){ if (c === f.c && r === f.r) window.__ph.n++; return orig.call(this, c, r, bp); }; });
    await page.waitForTimeout(800);
    const sample = () => page.evaluate(() => { const D = window.getFieldApp()._debug, g = [...D.games.values()].find(g => g.state === 'play'), W = window.FIELD_WORLD;
      return { n: window.__ph.n, gt: g ? +g.t.toFixed(4) : null, at: +window.fieldAnimTime().toFixed(1), cam: [W.st.camX, W.st.camZ, W.st.yaw, W.st.pitch, W.st.zoom].map(v => (+v).toFixed(4)).join(',') }; });
    // (the view as it was, to put back after: a turned view sent the editor's real touches across the board, Oct 12)
    const view0 = await page.evaluate(() => { const W = window.FIELD_WORLD; return { st: { camX: W.st.camX, camZ: W.st.camZ, yaw: W.st.yaw, pitch: W.st.pitch, zoom: W.st.zoom },
      target: Object.fromEntries(Object.entries(W.target).filter(([, v]) => v === null || typeof v !== 'object' && typeof v !== 'function')) }; });
    const g0 = await sample(), during = [];
    await page.mouse.move(200, 650); await page.mouse.down();
    for (let k = 1; k <= 6; k++){ await page.mouse.move(200 + 12 * k, 650 - 4 * k); await page.waitForTimeout(120); during.push(await sample()); }
    await page.mouse.up();
    await page.waitForTimeout(2000);                         // (its glide spent before the view is put back: CI, Oct 12)
    const g1 = during[during.length - 1];
    if (!(g1.gt > g0.gt) || !(g1.n > g0.n) || !(g1.at > g0.at) || !during.some(d => d.cam !== g0.cam)) failures.push(`[${current}] ${JSON.stringify({ g0, during })}`);
    await page.evaluate(v => { const W = window.FIELD_WORLD; window.getFieldApp().cellItems = window.__ph.orig; Object.assign(W.target, v.target); Object.assign(W.st, v.st); }, view0);
    await page.waitForTimeout(1500);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (the round's clock ran ${(g1.gt - g0.gt).toFixed(2)} s over the drag)`);
  }
  // MINI GOLF'S CEILING (Oct 14: "pinching zooms in to far show to many mini-golf boards, clamp zoom in mini-golf to keep the
  // boards from getting to small."): the real wheel, turned out far past it, leaves the eye at its zoomMaxH, four board
  // spacings up, and turned back in, it comes down at once
  current = 'mini golf zoom ceiling';
  {
    const view0 = await page.evaluate(() => { const W = window.FIELD_WORLD; return { camX: W.st.camX, camZ: W.st.camZ, yaw: W.st.yaw, pitch: W.st.pitch, zoom: W.st.zoom }; });
    for (let i = 0; i < 12; i++){ await page.mouse.move(640, 300); await page.mouse.wheel(0, -600); await page.waitForTimeout(150); }
    await page.waitForTimeout(1500);
    const hi = await page.evaluate(() => { const W = window.FIELD_WORLD; return { up: W.camera.position.y / W.spacing()[0], zoom: W.st.zoom, cap: window.getFieldApp().zoomMaxH }; });
    await page.mouse.wheel(0, 300); await page.waitForTimeout(1200);
    const lo = await page.evaluate(() => window.FIELD_WORLD.st.zoom);
    await page.evaluate(v => { const W = window.FIELD_WORLD; W.target.zoom = null; Object.assign(W.st, v); }, view0);
    await page.waitForTimeout(800);
    const ok = hi.cap === 4 && hi.up <= 4.02 && hi.up > 3.5 && lo < hi.zoom - 5;
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ hi, lo })}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (the wheel stopped ${hi.up.toFixed(2)} board spacings up)`);
  }
  // MOVERS KEEP APART (Oct 11: "the objects respect the golfball, but not each other. Objecs float into each other, where the
  // golfball bounce away", "Keep them apart"): on the course and 120 generated holes, watched for half a minute from the
  // start and again an hour on, no rider comes onto another, onto a bar, a bumper, a boulder or a fence, and no bar onto a
  // thing; a door's and a windmill's phase is kept by cleaning and moves them
  current = 'mini golf movers keep apart';
  {
    const before = failures.length;
    const ka = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, E = D.editor, CW = D.CW, ARM = CW * 0.11;
      const seg = (px, py, s) => { const ux = s[2] - s[0], uy = s[3] - s[1], f = Math.max(0, Math.min(1, ((px - s[0]) * ux + (py - s[1]) * uy) / (ux * ux + uy * uy || 1e-12))); return Math.hypot(s[0] + ux * f - px, s[1] + uy * f - py); };
      const gap = (a, b) => a.c && b.c ? Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) - a.c[2] - b.c[2] : a.c ? seg(a.c[0], a.c[1], b.s) - a.c[2] - b.h : b.c ? seg(b.c[0], b.c[1], a.s) - b.c[2] - a.h
        : Math.min(seg(a.s[0], a.s[1], b.s), seg(a.s[2], a.s[3], b.s), seg(b.s[0], b.s[1], a.s), seg(b.s[2], b.s[3], a.s)) - a.h - b.h;
      const bad = [], kinds = {};
      const look = (H, name) => {
        const mv = [], st = [];
        (H.toys || []).forEach((T, j) => { const k = Object.keys(T)[0], v = T[k];
          if (k === 'path') mv.push({ j, k: 'rider', at: t => { const S = D.toyAt(T, t), n = (v.length - 4) >> 1; return [{ c: [S.x, S.y, v[2 * n]] }]; } });
          else if (k === 'arm' || k === 'swing') mv.push({ j, k, at: t => { const S = D.toyAt(T, t), nb = k === 'arm' ? v[5] : 1; return Array.from({ length: nb }, (_, q) => { const a = S.a + q * 2 * Math.PI / nb; return { s: [v[0], v[1], v[0] + v[2] * Math.cos(a), v[1] + v[2] * Math.sin(a)], h: ARM }; }); } });
          else if (k === 'mill') mv.push({ j, k, at: t => { const S = D.toyAt(T, t); return [S.a, S.a + Math.PI / 2].map(a => ({ s: [v[0] - v[2] * Math.cos(a), v[1] - v[2] * Math.sin(a), v[0] + v[2] * Math.cos(a), v[1] + v[2] * Math.sin(a)], h: 0.011 })); } });
          else if (k === 'gate') mv.push({ j, k, at: t => D.toyAt(T, t).up >= 0.5 ? [{ s: v.slice(0, 4), h: CW * 0.14 }] : [] });
          else if (k === 'kick' || k === 'rock') st.push({ j, k, els: [{ c: [v[0], v[1], v[2]] }] });
          else if (k === 'fence') st.push({ j, k, els: [{ s: v.slice(0, 4), h: CW * 0.12 }] });
        });
        if (!mv.length) return 0;
        for (const t0 of [0, 3600]) for (let t = t0; t < t0 + 30; t += 0.05){
          const now = mv.map(M => M.at(t));
          for (let a = 0; a < mv.length; a++){
            for (let b = a + 1; b < mv.length; b++) for (const x of now[a]) for (const y of now[b]) if (gap(x, y) < -0.01 * CW){ const key = mv[a].k + '/' + mv[b].k; kinds[key] = (kinds[key] || 0) + 1; if (bad.length < 6) bad.push(name + ' ' + key + ' t ' + t.toFixed(2)); return 1; }
            for (const S of st) for (const x of now[a]) for (const y of S.els) if (gap(x, y) < -0.01 * CW){ const key = mv[a].k + '/' + S.k; kinds[key] = (kinds[key] || 0) + 1; if (bad.length < 6) bad.push(name + ' ' + key + ' t ' + t.toFixed(2)); return 1; }
          }
        }
        return 0;
      };
      let n = 0;
      D.HOLES.forEach((H, k) => { if (H.gen == null && !H.custom){ n++; look(H, 'course ' + H.name); } });
      for (let i = 22; i < 142; i++){ const k = E.addHole(E.cleanSrc(D.genSrc(i, 1 + i % 5))); n++; look(D.HOLES[k], 'gen ' + i); }
      // a door's and a windmill's phase: kept by cleaning, and it moves them
      const c = E.cleanSrc({ map: Array(13).fill('........'), toys: [{ swing: [4, 6, 1.2, 0, 90, 3, 0.25] }, { mill: [4, 9, 1.2, 1.234567, 1.5] }] });
      const sw = c && c.toys.find(T => T.swing), ml = c && c.toys.find(T => T.mill);
      const phase = !!(sw && sw.swing[6] === 0.25 && ml && ml.mill[4] === 1.5 && ml.mill[3] === 1.234567
        && Math.abs(D.toyAt({ swing: [0, 0, 1, 0, Math.PI / 2, 3, 0.25] }, 0).a - Math.PI / 4) < 1e-9 && Math.abs(D.toyAt({ mill: [0, 0, 1, 1, 1.5] }, 0).a - 1.5) < 1e-9);
      return { n, bad, kinds, phase };
    });
    if (ka.bad.length || !ka.phase) failures.push(`[${current}] ${JSON.stringify(ka)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (${ka.n} holes)`);
  }
  // HOLES NO ONE COULD FINISH, MADE AGAIN (Oct 11: "proceed", on "Catch the near-unplayable holes"): a generated hole rated as
  // sunk in fewer than half its rounds is remembered and its board given the hole of its next eight attempts, in its own slot
  // (number, level and board kept); one sunk in half or more, or a course hole, is left alone; one being played is not swapped
  // until no one is; after three it is left as it is
  current = 'mini golf holes no one could finish';
  {
    const before = failures.length;
    const rm = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, E = D.editor, idx = 98765, k = D.holeAt(idx), H0 = D.HOLES[k], lv = H0.level, gk = idx * 8 + lv;
      const nameAt = n => E.cleanSrc(D.genSrc(idx, lv, 8 * n)).name, out = { first: H0.name === nameAt(0) };
      out.fair = E.vetRated(k, { sunk: 0.5 }) === false && D.HOLES[k] === H0 && !E.REMADE[gk];
      out.course = E.vetRated(0, { sunk: 0 }) === false;
      out.bad = E.vetRated(k, { sunk: 0.125 }) === true && E.REMADE[gk] === 1;
      const H1 = D.HOLES[k];
      out.remade = H1 !== H0 && H1.remadeN === 1 && H1.name === nameAt(1) && H1.gen === idx && H1.num === idx + 1 && H1.level === lv && D.holeAt(idx) === k;
      D.games.set('smoke-busy', D.holeGame({ start: k, card: [] }, k));
      out.busy = E.vetRated(k, { sunk: 0 }) === true && E.REMADE[gk] === 2 && D.HOLES[k] === H1 && D.holeAt(idx) === k && D.HOLES[k] === H1;
      D.games.delete('smoke-busy');
      out.later = D.holeAt(idx) === k && D.HOLES[k].remadeN === 2 && D.HOLES[k].name === nameAt(2);
      out.third = E.vetRated(k, { sunk: 0 }) === true && D.HOLES[k].remadeN === 3 && E.vetRated(k, { sunk: 0 }) === false && E.REMADE[gk] === 3;
      out.kept = JSON.parse(localStorage.getItem('golf.remade') || '{}')[gk] === 3;
      return out;
    });
    if (Object.values(rm).some(v => !v)) failures.push(`[${current}] ${JSON.stringify(rm)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current}`);
  }
  // THE BEST LINE, AND ITS GHOST (Oct 11: "proceed", on "Shots saved as curves: your best line on a hole is kept as a curve,
  // so you can replay it, share it, or race it as a ghost ball on your next try"): a real touch's putt starts the hole's
  // recording; a hole played to the cup keeps its line, a few points a stroke; the same putts played again at the same
  // moment of the toys' clock have the ghost on the ball all the way; Watch dots the line and plays its ball; with the
  // ghost off a race shows none; a link carries the hole and the line, and one claiming nothing sensible is refused
  current = 'mini golf best line and its ghost';
  {
    const before = failures.length;
    await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      for (const k of [...D.games.keys()]) D.games.delete(k); A.onCellTap(f.c, f.r); });
    await page.waitForTimeout(300);
    const S0 = await scr();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(S0.mid) });
    await page.waitForTimeout(200);
    for (let k = 1; k <= 8; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at({ x: S0.mid.x, y: S0.mid.y + 7 * k }) }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const bl = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, L = D.line, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), out = {};
      const g0 = [...D.games.values()].find(g => g.state === 'play');
      out.touched = !!(g0 && g0.strokes === 1 && g0.rec && g0.rec.t0 != null);
      const fresh = () => { for (const k of [...D.games.keys()]) D.games.delete(k); A.onCellTap(f.c, f.r); return D.games.values().next().value; };
      // (each step the board drawn too, as the race below does: drawing the board in play steps it by nothing, which still runs a
      //  collision pass, so a race drawn and a play not drawn parted on holes with bumpers, 7 cells on CI, Oct 13)
      const roll = g => { let n = 0; while (g.state === 'play' && g.moving && n < 3000){ D.step(g, 1 / 60); n++; g.last = 0; D.cellItems(f.c, f.r, 2000); } };
      // played to the cup with straight putts, the moment kept so it can be played again
      let g = fresh(); const H = D.HOLES[g.hole], t = g.t, pulls = [];
      for (let s = 0; s < 10 && g.state === 'play'; s++){
        const dx = H.cup.x - g.ball.x, dy = H.cup.y - g.ball.y, d = Math.hypot(dx, dy), p = Math.min(1, 0.12 + d * 0.9);
        pulls.push({ x: -dx / d * 0.4 * p, y: -dy / d * 0.4 * p }); g.pull = { ...pulls[pulls.length - 1] }; D.putt(g); roll(g);
      }
      const o = L.lineOfHole(g.hole), ln = o && L.lineDecode(o.p);
      out.kept = !!(g.state === 'sunk' && o && ln && o.s === g.strokes && ln.length / 3 >= 2 * o.s && ln.length / 3 <= 40 * o.s && JSON.stringify(o).length < 4000
        && JSON.parse(localStorage.getItem('golf.ghosts') || '{}')[L.lineKey(g.hole)]);
      out.points = ln && ln.length / 3; out.strokes = o && o.s;
      // the same putts again: the ghost rides on the ball
      g = fresh(); g.t = t; let worst = 0, seen = 0;
      for (const q of pulls){ if (g.state !== 'play') break; g.pull = { ...q }; D.putt(g);
        let n = 0; while (g.state === 'play' && g.moving && n < 3000){ D.step(g, 1 / 60); n++; g.last = 0;
          const its = D.cellItems(f.c, f.r, 2000), gb = its.find(i => i.kind === 'ghostBall'), b = its.find(i => i.kind === 'ball');
          if (gb && b){ seen++; worst = Math.max(worst, Math.hypot(gb.u - b.u, gb.v - b.v) * D.WD / D.CW); } } }
      out.race = seen > 30 && worst < 0.045; out.worst = +worst.toFixed(4); out.seen = seen;
      // Watch: the line dotted and its ball, from now
      g = fresh(); out.watch = L.watchLine() === true && g.watch != null;
      for (let n = 0; n < 20; n++) D.step(g, 1 / 60); g.last = 0;
      let its = D.cellItems(f.c, f.r, 2000);
      out.watched = its.filter(i => i.kind === 'ghost').length > 10 && its.filter(i => i.kind === 'ghostBall').length === 1;
      // the ghost off: none in a race
      L.GHOST.on = false; g = fresh(); g.pull = { ...pulls[0] }; D.putt(g); for (let n = 0; n < 10; n++) D.step(g, 1 / 60); g.last = 0;
      its = D.cellItems(f.c, f.r, 2000); out.off = !its.some(i => i.kind === 'ghostBall'); L.GHOST.on = true;
      its = D.cellItems(f.c, f.r, 2000); out.on = its.some(i => i.kind === 'ghostBall');
      // the link: the hole and the line, on a hole of its own with the same key; nonsense refused
      const url = L.lineLink(g.hole); if (!url){ out.noLine = g.hole; return out; }   // (no line kept: reported, not thrown)
      const q = new URL(url).searchParams.get('line'), k2 = L.takeLineLink(q);
      out.link = k2 != null && D.HOLES[k2].custom && L.lineKey(k2) === L.lineKey(g.hole) && !L.GHOSTS[L.lineKey(g.hole)].shared;
      const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const pay = JSON.parse(decodeURIComponent(escape(atob(q.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - q.length % 4) % 4)))));
      out.refused = L.takeLineLink(enc({ ...pay, line: { ...pay.line, s: 0 } })) === null && L.takeLineLink(enc({ ...pay, line: { ...pay.line, p: [5, 'x', 2] } })) === null;
      // a shared line better than yours becomes the line to race, marked shared
      // (one stroke and half the time: yours may have sunk in one, and then only a quicker line is better, Oct 13)
      const k3 = L.takeLineLink(enc({ ...pay, line: { ...pay.line, s: 1, ms: Math.max(1, Math.floor((pay.line.ms || 2) / 2)) } }));
      out.shared = k3 != null && L.GHOSTS[L.lineKey(k3)].shared === true && L.GHOSTS[L.lineKey(k3)].s === 1;
      return out;
    });
    if (['touched', 'kept', 'race', 'watch', 'watched', 'off', 'on', 'link', 'refused', 'shared'].some(k => !bl[k])) failures.push(`[${current}] ${JSON.stringify(bl)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (${bl.strokes} strokes kept as ${bl.points} points; the ghost within ${bl.worst} of a cell over ${bl.seen} frames)`);
  }

  // The hole editor (Oct 8: "yes, build the editor"): a new hole on the selected board, painted with a real drag after
  // choosing a tool on the bar, things placed, undo, Check sets the par, Save keeps it, Share's link opens the page on it.
  current = 'hole editor';
  const before9 = failures.length;
  {
    await page.evaluate(() => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); A.onCellTap(f.c, f.r); });
    const st0 = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const n = A._debug.HOLES.length, ok = E.editStart(null), tiles = A.statTiles(f.c, f.r) || [];
      return { ok, n, k: E.ED.k, tiles: tiles.length, want: E.TOOLS.length + E.ACTS.length, own: !!document.getElementById('golfEditBar') }; });
    if (!st0.ok || st0.tiles !== st0.want || st0.k !== st0.n || st0.own) failures.push(`[${current}] editStart: ${JSON.stringify(st0)}`);
    // the editor's tools are the bottom panel's tiles: click one that is in view and it is taken up
    const findTile = () => { const st = document.getElementById('boardBrowser'), E = window.getFieldApp()._debug.editor;
      if (!st || st.hidden) return null;
      const ts = [...st.querySelectorAll('*')].filter(t => t.parentElement === st && t._key && /^stat_\d+$/.test(t._key) && t.style.display !== 'none').map(t => ({ i: +t._key.slice(5), r: t.getBoundingClientRect() }))
        .filter(t => t.i >= 0 && t.i < E.TOOLS.length && t.r.width > 10 && t.r.left > 0 && t.r.right < innerWidth && t.r.top > 0 && t.r.bottom < innerHeight);
      const t = ts[0]; return t ? { i: t.i, x: t.r.left + t.r.width / 2, y: t.r.top + t.r.height / 2, tool: E.TOOLS[t.i][0] } : null; };
    // (the row slides up when it opens, a frame at a time; mini golf in software rendering can take seconds a frame, as on
    //  CI, where 10 s was not always enough: Oct 9)
    await page.waitForFunction(findTile, null, { timeout: 30000, polling: 200 }).catch(() => {});
    await page.waitForTimeout(400);
    const tile = await page.evaluate(findTile);
    const why = tile ? null : await page.evaluate(() => { const st = document.getElementById('boardBrowser'); return st ? { hidden: st.hidden, rect: st.getBoundingClientRect().toJSON(), keys: [...st.children].filter(t => t._key).map(t => t._key + ':' + t.style.display).slice(0, 12) } : 'no strip'; });
    if (!tile) failures.push(`[${current}] no tool tile in view on the bottom panel: ${JSON.stringify(why)}`);
    else {
      const before = await page.evaluate(() => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), b = window.tvf.browser;
        return { tool: A._debug.editor.ED.tool, on: A._debug.editor.ED.on, shut: document.body.classList.contains('bb-collapsed'), keys: b.keys.length, visible: b.visible, mode: b.mode, tiles: (A.statTiles(f.c, f.r) || []).length }; });
      await page.mouse.click(tile.x, tile.y); await page.waitForTimeout(300);
      const inHand = await page.evaluate(() => window.getFieldApp()._debug.editor.ED.tool);
      if (inHand !== tile.tool) failures.push(`[${current}] clicking the ${tile.tool} tile left ${inHand} in hand ${JSON.stringify(before)}`);
    }
    // the row stays up while painting; take up Wall (by its tile) and drag across the middle of the hole with the mouse
    // (unless it is in hand already: the first tile is Wall since Oct 11, and a second tap on it would put it down)
    await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      if (E.ED.tool !== '#') A.onStatTap(f.c, f.r, E.TOOLS.findIndex(t => t[0] === '#')); });
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
      tap('rock', 0.25, 0.2); tap('bowl', 0.7, 0.35);   // (a bowl: Hill went on Oct 9)
      tap('pipe', 0.2, 0.8); tap('pipe', 0.8, 0.3);
      const toys = ED.src.toys.length, land = ED.src.land.length, k = ED.k;
      const kinds = D.cellItems(f.c, f.r).map(i => i.kind);
      tap('kick', 0.6, 0.6); E.editAction('undo');
      const afterUndo = ED.src.toys.length;
      const r = await E.editAction('check');
      const autoSaved = JSON.parse(localStorage.getItem('golf.myholes') || '[]').some(h => JSON.stringify(h.toys) === JSON.stringify(ED.src.toys));
      E.editAction('save');
      const link = E.shareLink(ED.src), back = E.readLink(new URL(link).searchParams.get('hole'));
      const evil = E.cleanSrc({ name: '<img src=x onerror=alert(1)>', par: 99, map: Array(13).fill('########ZZZ'), toys: [{ rock: ['x', 1, 2] }, { nope: [1] }], land: 'no' });
      return { toys, land, k, hasLand: kinds.includes('land' + k), hasRock: kinds.some(x => /rock/i.test(x)), afterUndo, autoSaved, check: r, par: ED.src.par, msg: ED.msg,
               stored: JSON.parse(localStorage.getItem('golf.myholes') || '[]').length, same: JSON.stringify(back) === JSON.stringify(E.cleanSrc(ED.src)), link,
               evil: evil && { par: evil.par, toys: evil.toys.length, land: evil.land.length, rows: evil.map.every(r => r.length === 8 && /^[.#s~=TO]+$/.test(r)), T: evil.map.join('').split('T').length - 1, O: evil.map.join('').split('O').length - 1 } };
    });
    if (st2.toys !== 2 || st2.land !== 1) failures.push(`[${current}] after a boulder, a hill and a pipe: ${st2.toys} things, ${st2.land} ground`);
    if (!st2.hasLand || !st2.hasRock) failures.push(`[${current}] the board does not draw the edited hole (land ${st2.hasLand}, boulder ${st2.hasRock})`);
    if (st2.afterUndo !== 2) failures.push(`[${current}] undo left ${st2.afterUndo} things`);
    if (!st2.check || !st2.check.sunk || !(st2.check.stars >= 1 && st2.check.stars <= 5) || st2.par !== st2.check.par) failures.push(`[${current}] Check (a rating since Oct 10): ${JSON.stringify(st2.check)}, par ${st2.par}, "${st2.msg}"`);
    if (st2.stored < 1) failures.push(`[${current}] Save kept nothing`);
    if (!st2.autoSaved) failures.push(`[${current}] the edited hole was not saved as it changed (Oct 9: saved as you go)`);
    if (!st2.same) failures.push(`[${current}] the share link does not carry the hole back`);
    if (!st2.evil || st2.evil.par !== 9 || st2.evil.toys !== 0 || st2.evil.land !== 0 || !st2.evil.rows || st2.evil.T !== 1 || st2.evil.O !== 1) failures.push(`[${current}] a bad link was not cleaned: ${JSON.stringify(st2.evil)}`);
    // a fence by two taps, and Material: the hole is rebuilt in stone
    const st2b = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      ED.tool = 'fence'; A.onCellTap(f.c, f.r, 0.2, 0.6); A.onCellTap(f.c, f.r, 0.6, 0.62);
      const fences = ED.src.toys.filter(T => T.fence).length, m0 = ED.src.fence;
      A.onStatTap(f.c, f.r, E.TOOLS.length + E.ACTS.findIndex(a => a[0] === 'mat'));
      const kinds = D.cellItems(f.c, f.r).map(i => i.kind);
      return { fences, m0, m1: ED.src.fence, stoneWall: kinds.some(k => /_stone$/.test(k)), stays: A.statsStay() }; });
    if (st2b.fences !== 1 || st2b.m0 !== 'wood' || st2b.m1 !== 'stone' || !st2b.stoneWall || !st2b.stays) failures.push(`[${current}] fence and material: ${JSON.stringify(st2b)}`);
    // shaping the ground (Oct 8): a plateau by a drag, a ramp by a tap, Select a terrace-less piece and drag it, Higher,
    // Delete, Level; and the tool tiles as wide as their widest name
    const sh = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), act = a => (E.ACTS.some(x => x[0] === a) ? A.onStatTap(f.c, f.r, E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a)) : E.editAction(a));
      const H0 = () => D.HOLES[ED.k], hAt = (cx, cy) => D.rawH(H0(), cx * D.CW, cy * D.CW);
      const n0 = ED.src.land.length;
      tool('plat');                                       // a drag from (1, 2) to (4, 4) in cells, through onPan
      for (const [cx, cy] of [[1, 2], [2, 3], [3, 3.5], [4, 4]]) A.onPan(1, 1, { c: f.c, r: f.r, u: cx / D.NX, v: cy / D.NY });
      A.onPanEnd();
      const plat = ED.src.land.find(g => g.plateau), raised = hAt(2.5, 3) - hAt(6.5, 9);
      tool('ramp'); A.onCellTap(f.c, f.r, 6 / D.NX, 9 / D.NY);
      const ramp = ED.src.land.find(g => g.ramp);
      // (a tap on ground takes the grass first since Oct 9; a second tap on the same spot takes the plateau under it)
      tool('select'); ED.lastTap = null; A.onCellTap(f.c, f.r, 3.5 / D.NX, 3.5 / D.NY); A.onCellTap(f.c, f.r, 3.5 / D.NX, 3.5 / D.NY);
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
    // the green sits in the ground (Oct 8: "could it not be below the ground?"): a plateau laid with its edge through the
    // cup leaves the cup no higher than the lowest ground round its rim, not on a pad at the plateau's height
    const cupLow = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const H0 = D.HOLES[ED.k], cx = H0.cup.x / D.CW, cy = H0.cup.y / D.CW;
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'plat')); A.onCellTap(f.c, f.r, (cx - 1) / D.NX, cy / D.NY);
      const H = D.HOLES[ED.k], at = D.hOf(H, H.cup.x, H.cup.y);
      let low = Infinity, high = -Infinity;
      for (let q = 0; q < 12; q++){ const h = D.rawH(H, H.cup.x + 0.05 * Math.cos(q * Math.PI / 6), H.cup.y + 0.05 * Math.sin(q * Math.PI / 6)); low = Math.min(low, h); high = Math.max(high, h); }
      ED.src.land = ED.src.land.filter(g => !g.plateau);
      return { at, low, high }; });
    if (!(cupLow.high - cupLow.low > 0.01) || !(cupLow.at <= cupLow.low + 1e-6)) failures.push(`[${current}] the cup sits in the ground: ${JSON.stringify(cupLow)}`);
    const wide = await page.evaluate(() => { const st = document.getElementById('boardBrowser'), A = window.getFieldApp(), E = A._debug.editor;
      const ts = [...st.querySelectorAll('*')].filter(t => t.parentElement === st && t._key && /^stat_\d+$/.test(t._key) && t.style.display !== 'none');
      const c = document.createElement('canvas').getContext('2d'); c.font = '700 17px -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif';
      const need = Math.max(...E.TOOLS.map(t => c.measureText(t[1]).width));
      return { w: ts.length ? Math.min(...ts.map(t => parseFloat(t.style.width))) : 0, need }; });
    if (!(wide.w >= wide.need)) failures.push(`[${current}] tool tiles ${wide.w}px wide for names needing ${wide.need.toFixed(0)}px`);
    // the editor goes where you tap (Oct 8: "i should be able to add features to any board"): a tap on another board moves
    // the editor there with the tool kept, and a tap back returns to the first hole, edited in place
    const anyB = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const key0 = ED.key, k0 = ED.k; ED.tool = 'kick';
      A.onCellTap(f.c + 1, f.r, 0.5, 0.5);
      const moved = { on: ED.on, key: ED.key, tool: ED.tool, k: ED.k, toys: ED.src.toys.length };
      // the next tap places a bumper on that board (on grass clear of its things: a tap on one now selects it, Oct 9)
      let at = [0.5, 0.5]; search: for (let y = 1.5; y < D.NY - 1; y++) for (let x = 1.5; x < D.NX - 1; x++)
        if (ED.src.map[Math.floor(y)][Math.floor(x)] === '.' && !E.pickAll(x, y).some(c => c.type === 'toy')){ at = [x / D.NX, y / D.NY]; break search; }
      A.onCellTap(f.c + 1, f.r, at[0], at[1]);
      const placed = ED.src.toys.length - moved.toys;
      A.onCellTap(f.c, f.r, 0.5, 0.5);
      return { key0, moved, placed, back: ED.key === key0, sameHole: ED.k === k0 }; });
    if (!anyB.moved.on || anyB.moved.key === anyB.key0 || anyB.moved.tool !== 'kick' || anyB.placed !== 1 || !anyB.back || !anyB.sameHole)
      failures.push(`[${current}] editing another board: ${JSON.stringify(anyB)}`);
    // Bowl and Half-pipe sink into the ground (Oct 9: "why did they elevate the boards?"): where one is placed the ground
    // goes down, and the ground away from it stays where it was
    const sunkB = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t));
      const hAt = (cx, cy) => D.hOf(D.HOLES[ED.k], cx * D.CW, cy * D.CW);
      const out = {};
      for (const [t, cx, cy] of [['bowl', 4, 4], ['hpipe', 2, 9]]){
        const n0 = ED.src.land.length, mid0 = hAt(cx, cy), far0 = hAt(cx < 4 ? 7 : 1, cy < 6 ? 11 : 1);
        tool(t); A.onCellTap(f.c, f.r, cx / D.NX, cy / D.NY);
        out[t] = { added: ED.src.land.length - n0, kind: Object.keys(ED.src.land[ED.src.land.length - 1] || {})[0], drop: mid0 - hAt(cx, cy), farMoved: Math.abs(hAt(cx < 4 ? 7 : 1, cy < 6 ? 11 : 1) - far0) };
        ED.src.land.pop();
      }
      return out; });
    for (const [t, want] of [['bowl', 'dish'], ['hpipe', 'trough']]){ const r = sunkB[t];
      if (!r || r.added !== 1 || r.kind !== want || !(r.drop > 0.01) || !(r.farMoved < 1e-6)) failures.push(`[${current}] ${t} sinks into the ground: ${JSON.stringify(r)}`); }
    // the movers (Oct 9): since Oct 10 ("remove the shuttle and orbit. everything should use path") a path drawn by a drag
    // along a track and back, a round path laid by a tap, a gate by a tap; no Shuttle or Orbit tile; then Redo puts back
    // what Undo took
    const mv = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), act = a => (E.ACTS.some(x => x[0] === a) ? A.onStatTap(f.c, f.r, E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a)) : E.editAction(a));
      const n0 = ED.src.toys.length;
      tool('path'); for (const [cx, cy] of [[1.5, 6.5], [3, 6.5], [5, 6.5], [3, 6.8]]) A.onPan(1, 1, { c: f.c, r: f.r, u: cx / D.NX, v: cy / D.NY }); A.onPanEnd();
      tool('path'); A.onCellTap(f.c, f.r, 4 / D.NX, 3 / D.NY);
      tool('gate'); A.onCellTap(f.c, f.r, 4 / D.NX, 10 / D.NY);
      const kinds = ED.src.toys.slice(n0).map(T => Object.keys(T)[0]), p0 = (ED.src.toys.slice(n0).find(T => T.path) || {}).path;
      const xs = p0 ? p0.slice(0, p0.length - 4).filter((_, q) => q % 2 === 0) : [0];
      const noOld = !E.TOOLS.some(x => x[0] === 'shuttle' || x[0] === 'orbit');
      act('undo'); const afterUndo = ED.src.toys.length; act('redo'); const afterRedo = ED.src.toys.length;
      return { kinds, track: +(Math.max(...xs) - Math.min(...xs)).toFixed(2), noOld, n0, afterUndo, afterRedo }; });
    if (mv.kinds.join() !== 'path,path,gate' || !(mv.track > 2) || !mv.noOld || mv.afterUndo !== mv.n0 + 2 || mv.afterRedo !== mv.n0 + 3)
      failures.push(`[${current}] movers in the editor: ${JSON.stringify(mv)}`);
    // a turnstile placed by a tap and a door by a drag from its hinge (Oct 9), then both undone again
    const td = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), act = a => (E.ACTS.some(x => x[0] === a) ? A.onStatTap(f.c, f.r, E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a)) : E.editAction(a));
      const n0 = ED.src.toys.length;
      // (on grass clear of things: a tap on a thing selects it since Oct 9)
      let at = [2, 8]; search: for (let y = 2.5; y < D.NY - 1; y += 0.5) for (let x = 1; x < D.NX - 1; x += 0.5) if (!ED.src.toys.some(T => E.pickAll(x, y).some(c => c.type === 'toy'))){ at = [x, y]; break search; }
      tool('arm'); A.onCellTap(f.c, f.r, at[0] / D.NX, at[1] / D.NY);
      tool('swing'); for (const [cx, cy] of [[5, 8], [5.6, 8], [6.4, 8]]) A.onPan(1, 1, { c: f.c, r: f.r, u: cx / D.NX, v: cy / D.NY }); A.onPanEnd();
      const added = ED.src.toys.slice(n0), items = D.cellItems(f.c, f.r).filter(i => i.kind === 'armBar').length;
      act('undo'); act('undo');
      return { kinds: added.map(T => Object.keys(T)[0]).join(), door: (added.find(T => T.swing) || {}).swing, items, back: ED.src.toys.length === n0 }; });
    if (td.kinds !== 'arm,swing' || !td.door || !(td.door[2] > 1) || !(td.items >= 3) || !td.back) failures.push(`[${current}] turnstile and door in the editor: ${JSON.stringify(td)}`);
    // the quick buttons (Oct 9): icon buttons at the top right of the bottom pane; a real click on Undo takes the gate away
    await page.waitForFunction(() => document.querySelectorAll('#bbQuick button').length === 6, null, { timeout: 20000 }).catch(() => {});
    const qb = await page.evaluate(() => { const bs = [...document.querySelectorAll('#bbQuick button')], u = bs.find(b => b.title === 'Undo'), r = u && u.getBoundingClientRect();
      return { n: bs.length, text: bs.map(b => b.textContent).join(''), titles: bs.map(b => b.title), at: r && { x: r.x + r.width / 2, y: r.y + r.height / 2, right: innerWidth - r.right, w: r.width } }; });
    let qbUndo = -1;
    if (qb.at){ const before = await page.evaluate(() => window.getFieldApp()._debug.editor.ED.src.toys.length);
      await page.mouse.click(qb.at.x, qb.at.y); await page.waitForTimeout(300);
      qbUndo = before - await page.evaluate(() => window.getFieldApp()._debug.editor.ED.src.toys.length);
      if (qbUndo !== 1) qb.dbg = await page.evaluate(at => { const E = window.getFieldApp()._debug.editor, el = document.elementFromPoint(at.x, at.y); return { el: el && (el.id || el.tagName) + '/' + (el.parentElement && el.parentElement.id), on: E.ED.on, undo: E.ED.undo.length, redo: (E.ED.redo || []).length, shut: document.body.classList.contains('bb-collapsed') }; }, qb.at); }
    if (qb.n !== 6 || !qb.at || qb.at.right > 220 || qb.at.w > 40 || /[a-z]/i.test(qb.text) || qbUndo !== 1) failures.push(`[${current}] quick buttons: ${JSON.stringify(qb)}, undo took ${qbUndo}`);
    // select and move in place (Oct 9: "editing the boards is clumsy. lets make it better, like the draw project … I want
    // to edit the boards as much as possible in place"): what is placed is selected; Select takes a thing by a tap and a
    // drag moves it, snapped to the half cells; a second tap on the same spot takes what is under it; the bar beside the
    // selection changes a bumper's kind, a mover's speed, duplicates and deletes; undo keeps the selection; the tee is
    // dragged cell by cell; and a real click on the bar's Delete takes the thing away
    const sm = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), tap = (x, y) => A.onCellTap(f.c, f.r, x / D.NX, y / D.NY);
      const drag = pts => { for (const [x, y] of pts) A.onPan(1, 1, { c: f.c, r: f.r, u: x / D.NX, v: y / D.NY }); A.onPanEnd(); };
      const out = {};
      ED.src.toys = ED.src.toys.filter(T => !T.kick); ED.src.land = ED.src.land.filter(g => !g.bump);
      tool('kick'); tap(1.5, 5.5);
      out.placed = !ED.pick && !!ED.src.toys[ED.src.toys.length - 1].kick;   // (laid and let go of, Oct 9)
      tap(1.5, 5.5); out.acts = E.selActs().map(a => a.key).join();         // (a tap takes it)
      A.onQuickAct(f.c, f.r, 'select'); out.tool = ED.tool;
      tap(6.5, 11.5); out.letGo = !(ED.pick && ED.pick.type === 'toy');
      tap(1.5, 5.5); const i = ED.pick && ED.pick.i;
      drag([[1.5, 5.5], [2.2, 6.2], [3.1, 7.2], [3.9, 7.6]]);
      const k = ED.src.toys[i] && ED.src.toys[i].kick; out.moved = k && [k[0], k[1]]; out.still = samePickI(ED.pick, i);
      function samePickI(p, n){ return !!p && p.type === 'toy' && p.i === n; }
      out.undos = ED.undo.length;
      E.editAction('undo'); out.undone = ED.src.toys[i] && ED.src.toys[i].kick.slice(0, 2); out.keptPick = samePickI(ED.pick, i);
      E.editAction('redo');
      // a hill under the bumper: a second tap on the same spot takes the hill
      ED.src.land.push({ bump: [k[0], k[1], 1.4, 0.03] });
      ED.lastTap = null; tap(k[0], k[1]); const first = ED.pick && ED.pick.type; tap(k[0], k[1]); out.cycle = first + ">" + (ED.pick && ED.pick.type);
      ED.lastTap = null; tap(k[0], k[1]);
      E.selAct('kind'); out.kind = ED.src.toys[i].kick[3];
      E.selAct('dup'); out.dup = ED.src.toys.filter(T => T.kick).length; out.dupPicked = ED.pick && ED.pick.i !== i;
      E.selAct('del'); out.afterDel = ED.src.toys.filter(T => T.kick).length;
      tool('gate'); { let at = [4, 3]; search: for (let y = 2.5; y < D.NY - 1; y += 0.5) for (let x = 1; x < D.NX - 1; x += 0.5) if (!E.pickAll(x, y).some(c => c.type === 'toy' || c.type === 'T' || c.type === 'O')){ at = [x, y]; break search; } tap(at[0], at[1]); ED.pick = { type: 'toy', i: ED.src.toys.length - 1 }; } const sh = ED.src.toys[ED.pick.i].gate[4]; E.selAct('faster'); out.faster = ED.src.toys[ED.pick.i].gate[4] < sh;
      E.selAct('del');
      tool('select'); const t0 = ED.src.map.findIndex(r => r.includes('T')), ti = ED.src.map[t0].indexOf('T');
      const ni = ti > 3 ? ti - 2 : ti + 2, nj = Math.max(1, t0 - 1);
      ED.src.map = ED.src.map.map((r, j) => j === nj ? r.slice(0, ni) + '.' + r.slice(ni + 1) : r);
      drag([[ti + 0.5, t0 + 0.5], [(ti + ni) / 2 + 0.5, (t0 + nj) / 2 + 0.5], [ni + 0.5, nj + 0.5]]);
      out.tee = ED.src.map[nj][ni] === 'T' && ED.src.map.join('').split('T').length === 2;
      tap(k[0], k[1]); out.barFor = ED.pick && ED.pick.type;
      return out; });
    if (!sm.placed || !/kind/.test(sm.acts) || !/dup/.test(sm.acts) || sm.tool !== 'select' || !sm.letGo || !sm.moved || Math.abs(sm.moved[0] - 4) > 0.01 || Math.abs(sm.moved[1] - 7.5) > 0.01
        || !sm.still || !sm.undone || sm.undone[0] !== 1.5 || !sm.keptPick || !/^toy>(land|dot|toy)$/.test(sm.cycle) || sm.kind !== 1 || sm.dup !== 2 || !sm.dupPicked || sm.afterDel !== 1 || !sm.faster || !sm.tee || sm.barFor !== 'toy')
      failures.push(`[${current}] select and move: ${JSON.stringify(sm)}`);
    // the dots lift the grass (Oct 9: "the grass has dots on them, can we use them to pull up and down to change the
    // grass."): a press on a dot and a drag up the screen raises the ground there by the dot's height exactly, the ground
    // between dots following smoothly; Higher on the bar adds to it, Level this dot takes it back, a link carries the
    // dots and a link with a wrong number of them is read without
    const dl = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onQuickAct(f.c, f.r, 'select');
      let c = null; search: for (let j = 2; j < D.NY - 1; j++) for (let i = 1; i < D.NX; i++){ const p = E.pickAll(i, j); if (p[0] && p[0].type === 'dot' && !p.some(q => q.type === 'land')){ c = [i, j]; break search; } }
      if (!c) return { none: true };
      const H0 = () => D.HOLES[ED.k], at = () => D.rawH(H0(), c[0] * D.CW, c[1] * D.CW), mid = () => D.rawH(H0(), (c[0] + 0.5) * D.CW, c[1] * D.CW);
      const h0 = at(), m0 = mid();
      // (taken by a small box round it: since Oct 10 only the box takes dots)
      A.onQuickAct(f.c, f.r, 'box'); for (const [x, y] of [[c[0] - 0.4, c[1] - 0.4], [c[0] + 0.4, c[1] + 0.4]]) A.onPan(0, 0, { c: f.c, r: f.r, u: x / D.NX, v: y / D.NY }); A.onPanEnd();
      for (let q = 0; q < 5; q++) A.onPan(0, -20, { c: f.c, r: f.r, u: (c[0] + 0.01) / D.NX, v: (c[1] + 0.01) / D.NY });
      A.onPanEnd();
      const idx = c[1] * D.LIFT_W + c[0], lift = ED.src.lift && ED.src.lift[idx], rose = at() - h0, half = mid() - m0, pick = ED.pick && ED.pick.type;
      const acts = E.selActs().map(a => a.key).join();
      E.selAct('higher'); const higher = ED.src.lift[idx];
      const link = E.readLink(new URL(E.shareLink(ED.src)).searchParams.get('hole')), carried = !!link && JSON.stringify(link.lift) === JSON.stringify(ED.src.lift);
      const bad = E.cleanSrc({ map: Array(13).fill('........'), lift: [1, 2, 3] });
      E.selAct('flat'); const back = { lift: ED.src.lift, at: at() - h0 };
      return { c, lift, rose, half, pick, acts, higher, carried, badLift: bad && bad.lift, back };
    });
    if (dl.none || !(dl.lift > 0.035 && dl.lift < 0.045) || Math.abs(dl.rose - dl.lift) > 1e-6 || !(dl.half > 0.005 && dl.half < dl.rose) || dl.pick !== 'dot'
        || !/flat/.test(dl.acts) || Math.abs(dl.higher - dl.lift - 0.01) > 1e-6 || !dl.carried || dl.badLift !== undefined || dl.back.lift !== undefined || Math.abs(dl.back.at) > 1e-6)
      failures.push(`[${current}] the dots lift the grass: ${JSON.stringify(dl)}`);
    // (Oct 9: "selecting the grass is clumsy. sometimes it works but generally not."): a real mouse pressed on a selected dot and
    // moved up the screen pulls that dot up, though it pressed beside the dot and the first move the field passes on is far off it
    const scr = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      A.onQuickAct(null, null, 'select'); ED.pick = null;
      // (a dot with room above it on the screen to drag into: at mini golf's steeper tilt, Oct 12, the far rows sit at its top)
      const proj = (i, j) => new W.THREE.Vector3(T.boardX + (0.5 - i / D.NX) * bW * (L.cellW || 1), 0.02, T.boardZ + (0.5 - j / D.NY) * bW * (L.cellH || 1)).project(W.camera);
      let c = null; search: for (let j = 3; j < D.NY - 2; j++) for (let i = 2; i < D.NX - 1; i++){ const p = E.pickAll(i, j); if (p[0] && p[0].type === 'dot' && !p.some(q => q.type !== 'dot') && (1 - proj(i, j).y) / 2 * innerHeight > 150){ c = [i, j]; break search; } }
      if (!c) return null;
      const v = proj(c[0], c[1]);
      ED.pick = { type: 'dot', i: c[1] * D.LIFT_W + c[0] }; ED.dots = [ED.pick.i]; ED.box = { x0: c[0] - 0.45, x1: c[0] + 0.45, y0: c[1] - 0.45, y1: c[1] + 0.45 };   // (boxed first: only the box takes dots, Oct 10)
      return { c, idx: c[1] * D.LIFT_W + c[0], x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, h0: (ED.src.lift && ED.src.lift[c[1] * D.LIFT_W + c[0]]) || 0 }; });
    if (!scr) failures.push(`[${current}] no clear dot to pull`);
    else {
      // (a fingertip lands a little off the dot and its first move is quick: pressed 6 px aside, then 24 px up at once)
      await page.mouse.move(scr.x + 6, scr.y + 3); await page.mouse.down();
      await page.mouse.move(scr.x + 6, scr.y - 21); await page.waitForTimeout(30);
      for (let q = 1; q <= 6; q++){ await page.mouse.move(scr.x + 6, scr.y - 21 - 8 * q); await page.waitForTimeout(30); }
      await page.mouse.up(); await page.waitForTimeout(300);
      const after = await page.evaluate(i => { const ED = window.getFieldApp()._debug.editor.ED; return { lift: (ED.src.lift && ED.src.lift[i]) || 0, pick: ED.pick }; }, scr.idx);
      if (!(after.lift - scr.h0 > 0.01) || !after.pick || after.pick.type !== 'dot' || after.pick.i !== scr.idx) failures.push(`[${current}] a real drag up from a dot: ${JSON.stringify({ scr, after })}`);
    }
    // (Oct 9: "remove hallow and hill edit options. taping an object should select it allow it to be moved. taping the grass
    // should allow me to edit it again."): no Hill or Hollow tool; with Wall in hand a tap on a boulder selects it and takes
    // up Select, and a drag from it moves it; a tap on the grass then takes the grass (a dot), even where ground of the
    // hole's own lies
    const ob = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), tap = (x, y) => A.onCellTap(f.c, f.r, x / D.NX, y / D.NY);
      const noHill = !E.TOOLS.some(t => t[0] === 'up' || t[0] === 'down');
      ED.src.toys.push({ rock: [4.5, 9.5, 0.45] }); const ri = ED.src.toys.length - 1;
      ED.src.land.push({ plateau: [0.6, 6.2, 3.4, 8.8, 0.04] });
      tool('#'); tap(4.6, 9.5);
      const took = { tool: ED.tool, pick: ED.pick && ED.pick.type, i: ED.pick && ED.pick.i, wall: ED.src.map[9][4] === '#' };
      for (const [x, y] of [[4.6, 9.5], [5.2, 10], [5.6, 10.5]]) A.onPan(1, 1, { c: f.c, r: f.r, u: x / D.NX, v: y / D.NY }); A.onPanEnd();
      const moved = ED.src.toys[ri] && ED.src.toys[ri].rock.slice(0, 2);
      let gp = null; for (let y = 6.5; y < 8.6 && !gp; y += 0.25) for (let x = 0.9; x < 3.2 && !gp; x += 0.25) if (!E.pickAll(x, y).some(c => c.type !== 'dot' && c.type !== 'land')) gp = [x, y];
      ED.lastTap = null; if (gp) tap(gp[0], gp[1]); const grass = gp ? ED.pick && ED.pick.type : 'no clear spot';
      ED.src.land.pop(); ED.src.toys.splice(ri, 1); ED.pick = null;
      return { noHill, took, ri, moved, grass }; });
    if (!ob.noHill || ob.took.tool !== 'select' || ob.took.pick !== 'toy' || ob.took.i !== ob.ri || ob.took.wall || !ob.moved || !(ob.moved[0] > 5.2) || ob.grass !== null)
      failures.push(`[${current}] a tap takes an object, a tap on grass the grass: ${JSON.stringify(ob)}`);
    // one at a time (Oct 9: "the user must select the item in the bottom object browser every time they want lay it on
    // board. the board resets to default where I can again change the height of the grass."): a boulder laid puts the
    // tool down (Select, the boulder selected); the next tap on grass lays nothing and takes the grass; a gate drawn by a
    // drag does the same; Wall, a paint, stays in hand
    const once = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), tap = (x, y) => A.onCellTap(f.c, f.r, x / D.NX, y / D.NY);
      const clear = []; for (let y = 2.5; y < D.NY - 1 && clear.length < 3; y += 1) for (let x = 1.5; x < D.NX - 1 && clear.length < 3; x += 1)
        if (!E.pickAll(x, y).some(c => c.type !== 'dot') && !clear.some(([a, b]) => Math.hypot(a - x, b - y) < 2)) clear.push([x, y]);
      if (clear.length < 3) return { none: true };
      const n0 = ED.src.toys.length;
      tool('rock'); tap(...clear[0]);
      const after1 = { tool: ED.tool, pick: ED.pick ? ED.pick.type : null, n: ED.src.toys.length - n0 };   // (let go of, Oct 9)
      tap(...clear[1]); const after2 = { n: ED.src.toys.length - n0, pick: ED.pick && ED.pick.type };
      tool('gate'); for (const [x, y] of [[clear[2][0] - 1, clear[2][1]], [clear[2][0], clear[2][1]], [clear[2][0] + 1, clear[2][1]]]) A.onPan(1, 1, { c: f.c, r: f.r, u: x / D.NX, v: y / D.NY }); A.onPanEnd();
      const gate = { tool: ED.tool, n: ED.src.toys.length - n0 };
      tool('#'); const wallStays = ED.tool; tool('select');   // (Wall since Oct 11, when the Sand paint went)
      ED.src.toys.splice(n0); ED.pick = null;
      return { after1, after2, gate, wallStays };
    });
    if (once.none || once.after1.tool !== 'select' || once.after1.pick !== null || once.after1.n !== 1 || once.after2.n !== 1 || once.after2.pick !== null || once.gate.tool !== 'select' || once.gate.n !== 2 || once.wallStays !== '#')
      failures.push(`[${current}] one at a time: ${JSON.stringify(once)}`);
    // many dots at once, by the box only (Oct 9: "how do I select and move multiple points at once?" … "selection box works
    // badly. it selects only one point at a time. I only want the selection box to select multiple items."): a tap on a
    // second dot takes it alone, not with the first; a drag from grass that starts right beside a dot (within a fingertip)
    // draws a box over four dots, not a pull on the one; Box (⬚) does the same; Higher raises them all; no bar on the page
    const md = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tap = (x, y) => A.onCellTap(f.c, f.r, x / D.NX, y / D.NY), act = a => (E.ACTS.some(x => x[0] === a) ? A.onStatTap(f.c, f.r, E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a)) : E.editAction(a));
      const drag = pts => { for (const [x, y] of pts) A.onPan(1, 1, { c: f.c, r: f.r, u: x / D.NX, v: y / D.NY }); A.onPanEnd(); };
      const lift = i => (ED.src.lift && ED.src.lift[i]) || 0, W8 = D.LIFT_W;
      A.onQuickAct(f.c, f.r, 'select'); delete ED.src.lift;
      const clear = (i, j) => { const p = E.pickAll(i, j); return p[0] && p[0].type === 'dot' && !p.some(q => q.type !== 'dot'); };
      let c = null; search: for (let j = 3; j < D.NY - 3; j++) for (let i = 1; i < D.NX - 2; i++) if (clear(i, j) && clear(i + 1, j) && clear(i, j + 1) && clear(i + 1, j + 1) && clear(i + 0.5, j + 0.5)){ c = [i, j]; break search; }
      if (!c) return { none: true };
      const [i, j] = c, four = [j * W8 + i, j * W8 + i + 1, (j + 1) * W8 + i, (j + 1) * W8 + i + 1];
      tap(i, j); tap(i + 1, j); const tapped = E.selDots().join();
      A.onQuickAct(f.c, f.r, 'select');
      drag([[i - 0.1, j - 0.05], [i + 0.6, j + 0.5], [i + 1.2, j + 1.2]]);
      const dragged = E.selDots().slice().sort((x, y) => x - y).join(), pulled = four.some(n => lift(n));
      tap(D.NX - 0.5, 0.5); tap(D.NX - 0.5, 0.5); A.onQuickAct(f.c, f.r, 'select');
      A.onQuickAct(f.c, f.r, 'box'); const boxTool = ED.tool;
      drag([[i - 0.2, j - 0.2], [i + 0.6, j + 0.5], [i + 1.2, j + 1.2]]);
      const boxed = E.selDots().length, back = ED.tool;
      const before = four.map(lift); act('higher'); const after = four.map(lift);
      return { c, tapped, wantOne: String(j * W8 + i + 1), dragged, want: four.join(), pulled, boxTool, boxed, back, rise: after.map((h, n) => +(h - before[n]).toFixed(3)), bar: !!document.getElementById('golfSelBar') }; });
    if (md.none || md.tapped !== '' || md.dragged !== md.want || md.pulled || md.boxTool !== 'box' || md.boxed !== 4 || md.back !== 'select'
        || md.rise.some(r => r !== 0.01) || md.bar) failures.push(`[${current}] many dots at once: ${JSON.stringify(md)}`);
    // the selection box (Oct 9: "use a selection box to select points. clicking away from the selection box or escape
    // closes it."): a drag from bare grass draws a box that stays, its dots selected; a drag inside it raises them all; a
    // tap away closes it, and so does Escape
    const sb = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tap = (x, y) => A.onCellTap(f.c, f.r, x / D.NX, y / D.NY), drag = pts => { for (const [x, y] of pts) A.onPan(0, -25, { c: f.c, r: f.r, u: x / D.NX, v: y / D.NY }); A.onPanEnd(); };
      const lift = i => (ED.src.lift && ED.src.lift[i]) || 0;
      A.onQuickAct(f.c, f.r, 'select');
      const bare = (x, y) => { const p = E.pickAll(x, y); return p.length === 1 && p[0].type === 'dot' && p[0].d === -0.02; };
      let c = null; search: for (let j = 2; j < D.NY - 3; j++) for (let i = 0; i < D.NX - 3; i++) if (bare(i + 0.5, j + 0.5)){ c = [i, j]; break search; }
      if (!c) return { none: true };
      const [i, j] = c;
      drag([[i + 0.5, j + 0.5], [i + 1.5, j + 1], [i + 2.5, j + 1.5]]);
      const box = !!ED.box, n = E.selDots().length, want = [(j + 1) * D.LIFT_W + i + 1, (j + 1) * D.LIFT_W + i + 2];
      const h0 = want.map(lift);
      drag([[i + 1.5, j + 1], [i + 1.5, j + 0.9]]);
      const rose = want.map((d, k) => +(lift(d) - h0[k]).toFixed(4)), still = !!ED.box;
      tap(i + 1.5, j + 1); const tapInside = !!ED.box;
      tap(Math.min(D.NX - 0.5, i + 5.5), Math.min(D.NY - 0.5, j + 5.5)); const afterAway = { box: !!ED.box, dots: E.selDots().length };
      drag([[i + 0.5, j + 0.5], [i + 2.5, j + 1.5]]); const again = !!ED.box;
      return { c, box, n, rose, still, tapInside, afterAway, again };
    });
    if (!sb.none) await page.keyboard.press('Escape');
    const esc = await page.evaluate(() => { const ED = window.getFieldApp()._debug.editor.ED; return { box: !!ED.box, pick: ED.pick }; });
    if (sb.none || !sb.box || sb.n !== 2 || !(sb.rose[0] > 0.01) || sb.rose[0] !== sb.rose[1] || !sb.still || !sb.tapInside || sb.afterAway.box || sb.afterAway.dots || !sb.again || esc.box || esc.pick)
      failures.push(`[${current}] the selection box: ${JSON.stringify({ sb, esc })}`);
    // REAL TOUCHES (Oct 10: "why have you not fixed the selection problem? ive asked 4 times now."): touch events sent
    // to the canvas the way a phone sends them, tap then drag, not the editor's own functions (which is how the earlier
    // checks passed while the phone did not). A tap on the grass takes no dot; a drag from that same spot draws the box
    // over several dots and pulls none; a drag inside the box raises them all alike; a tap away closes it; a bumper laid,
    // tapped and dragged moves; and the Wall tile tapped again puts Wall down (Oct 10: "when I select wall, I can't
    // deselect it"), as Escape does
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const rt = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (x, y) => { const T = W.target, bW = W.boardW(), L = window.LAB; const v = new W.THREE.Vector3(T.boardX + (0.5 - x / D.NX) * bW * L.cellW, 0.02, T.boardZ + (0.5 - y / D.NY) * bW * L.cellH).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const cv = document.querySelector("canvas"), wait = ms => new Promise(ok => setTimeout(ok, ms)), GAP = 300;
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      // (a tap's press and lift go together: this software renderer can take a second a frame, which would stretch a
      //  tap past the long press; a phone's frame is a sixtieth of that)
      // (as a phone does: a pointer event before each touch, which the page counts to drop a tap's echoed click)
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const gest = async pts => { ptr('pointerdown', pts[0]); let t = mk(pts[0]); fire('touchstart', t); for (let q = 1; q < pts.length; q++){ await wait(16); t = mk(pts[q]); fire('touchmove', t); } if (pts.length > 1) await wait(16); ptr('pointerup', pts[pts.length - 1]); fire('touchend', t); await wait(GAP); };
      const tap = (x, y) => gest([S(x, y)]);
      const drag = (a, b, n = 12) => { const p = S(...a), q = S(...b), pts = []; for (let k = 0; k <= n; k++) pts.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); return gest(pts); };
      const lifted = () => (ED.src.lift || []).filter(v => v).length;
      const taps = [], oTap = A.onCellTap; A.onCellTap = function(c, r, u, v){ taps.push([+(+u).toFixed(2), +(+v).toFixed(2), ED.tool]); return oTap.call(this, c, r, u, v); };
      const evs = []; for (const ty of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown']) window.addEventListener(ty, () => evs.push(ty[0] + ty.slice(-2)), true);
      A.onQuickAct(f.c, f.r, 'select'); delete ED.src.lift; ED.src.toys = ED.src.toys.filter(T => T.kick || T.rock || T.fence); ED.src.land = []; E.editAction('level');
      let c = null; const bare = (x, y) => !E.pickAll(x, y).some(q => q.type !== 'dot');
      search: for (let j = 3; j < D.NY - 4; j++) for (let i = 1; i < D.NX - 3; i++) if ([[0, 0], [1, 1], [2, 2], [2, 0], [0, 2], [1, 3]].every(([a, b]) => bare(i + a + 0.5, j + b + 0.5))){ c = [i + 0.5, j + 0.5]; break search; }
      if (!c) return { none: true };
      await tap(...c); const afterTap = { pick: ED.pick, lifted: lifted() };
      await drag(c, [c[0] + 2, c[1] + 2]); const box = { open: !!ED.box, dots: E.selDots().length, lifted: lifted() };
      await drag([c[0] + 1, c[1] + 1.2], [c[0] + 1, c[1] - 0.8]);
      const raised = (ED.src.lift || []).filter(v => v), alike = raised.length === box.dots && raised.every(v => v === raised[0]) && raised[0] > 0;
      await tap(c[0] + 2.5, c[1] + 3.2); const away = { box: !!ED.box, dots: E.selDots().length };
      let spot = null; for (let j = 1; j < D.NY - 1 && !spot; j++) for (let i = 1; i < D.NX - 2 && !spot; i++){ const x = i + 0.5, y = j + 0.5;
        if (ED.src.map[j][i] === '.' && ED.src.map[j][i + 1] === '.' && bare(x, y) && bare(x + 1.5, y) && (y > c[1] + 3 || y < c[1] - 1)) spot = [x, y]; }
      if (!spot) return { none: 'no spot for a bumper' };
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'kick')); await tap(...spot); const n = ED.src.toys.length;
      const laid = ED.src.toys[n - 1].kick && { tool: ED.tool, pick: ED.pick };
      await tap(...spot); const tapped = ED.pick && ED.pick.type === 'toy' && ED.pick.i === n - 1;
      await drag(spot, [spot[0] + 1.5, spot[1]]); const moved = ED.src.toys[n - 1].kick ? ED.src.toys[n - 1].kick[0] - spot[0] : 0;
      const wallI = E.TOOLS.findIndex(x => x[0] === '#');
      A.onStatTap(f.c, f.r, wallI); const wallOn = ED.tool; A.onStatTap(f.c, f.r, wallI); const wallOff = ED.tool;
      A.onStatTap(f.c, f.r, wallI); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const escOff = ED.tool, stillOn = ED.on;
      ED.src.toys.splice(n - 1, 1); delete ED.src.lift;
      A.onCellTap = oTap;
      return { c, afterTap, box, alike, away, laid, tapped, moved, wallOn, wallOff, escOff, stillOn, taps, evs: evs.join(' ') };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    if (rt.none || rt.afterTap.pick !== null || rt.afterTap.lifted || !rt.box.open || !(rt.box.dots >= 4) || rt.box.lifted || !rt.alike || rt.away.box || rt.away.dots
        || !rt.laid || rt.laid.tool !== 'select' || rt.laid.pick !== null || !rt.tapped || !(rt.moved > 1) || rt.wallOn !== '#' || rt.wallOff !== 'select' || rt.escOff !== 'select' || !rt.stillOn)
      failures.push(`[${current}] real touches: ${JSON.stringify(rt)}`);
    // THE PATH, DRAWN IN PLACE (Oct 10: "could we just use a shape from draw.html to create orbits?" … "drawing the orbits in
    // place and moving the leaves would be best."), by real touches: the Path tile, a loop drawn round with a finger,
    // laid down as leaves and left selected; a leaf dragged moves that leaf alone; the rider goes round on the clock; the
    // loop survives a cleanSrc and a .golf file; a tap with Path lays a round loop of eight
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const pa = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (x, y) => { const T = W.target, bW = W.boardW(), L = window.LAB; const v = new W.THREE.Vector3(T.boardX + (0.5 - x / D.NX) * bW * L.cellW, 0.02, T.boardZ + (0.5 - y / D.NY) * bW * L.cellH).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const gest = async pts => { ptr('pointerdown', pts[0]); let t = mk(pts[0]); fire('touchstart', t); for (let q = 1; q < pts.length; q++){ await wait(16); t = mk(pts[q]); fire('touchmove', t); } await wait(16); ptr('pointerup', pts[pts.length - 1]); fire('touchend', t); await wait(300); };
      A.onQuickAct(f.c, f.r, 'select'); ED.src.toys = []; ED.src.land = []; delete ED.src.lift; E.editAction('level');
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'path')); const tool = ED.tool;
      const cx = 4, cy = 6.5, R = 2, loop = []; for (let q = 0; q <= 28; q++){ const a = q / 28 * 2 * Math.PI * 0.97; loop.push(S(cx + R * Math.cos(a), cy + R * Math.sin(a))); }
      await gest(loop);
      const paths = ED.src.toys.filter(T => T.path), P = paths[0] && paths[0].path, n = P ? (P.length - 4) / 2 : 0;
      const radii = []; for (let q = 0; q < n; q++) radii.push(Math.hypot(P[2 * q] - cx, P[2 * q + 1] - cy));
      const drawn = { paths: paths.length, n, rMin: Math.min(...radii), rMax: Math.max(...radii), tool: ED.tool, sel: ED.pick && ED.pick.type === 'toy' && !!ED.src.toys[ED.pick.i].path };
      // a leaf dragged a cell further out, by a finger from the leaf itself
      const i0 = ED.pick ? ED.pick.i : 0, before = ED.src.toys[i0].path.slice(), lx = before[0], ly = before[1], ux = (lx - cx) / R, uy = (ly - cy) / R;
      const pts = []; for (let k = 0; k <= 10; k++) pts.push(S(lx + ux * k / 10, ly + uy * k / 10));
      await gest(pts);
      const after = ED.src.toys[i0].path, moved = Math.hypot(after[0] - lx, after[1] - ly), others = after.slice(2, 2 * n).every((v, q) => Math.abs(v - before[q + 2]) < 1e-9);
      // the rider goes round on the clock, and the loop is kept by cleanSrc and written to a .golf file
      const H = D.HOLES[ED.k], T = H.toys.find(T => T.path), a0 = T && D.toyAt(T, 0), a1 = T && D.toyAt(T, 1.5);
      const went = a0 && a1 ? Math.hypot(a1.x - a0.x, a1.y - a0.y) : 0;
      const kept = JSON.stringify(E.cleanSrc(ED.src).toys) === JSON.stringify(ED.src.toys), inFile = E.holesText([ED.src]).includes('"path"');
      const back = E.readHoles(E.holesText([ED.src]))[0], fileSame = back && JSON.stringify(back.toys) === JSON.stringify(ED.src.toys);
      // a tap with Path lays a round loop of eight leaves
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'path')); A.onCellTap(f.c, f.r, 4 / D.NX, 3 / D.NY);
      const last = ED.src.toys[ED.src.toys.length - 1], tapN = last && last.path ? (last.path.length - 4) / 2 : 0;
      // a tap inside a loop moves its rider on (Oct 10: "clicking inside the shape would move to the next object"), by
      // real taps: an orbit round (4, 9.5) and the path round (4, 3), each tapped inside five times, round to a boulder;
      // a tap on a bumper standing inside the orbit takes the bumper and leaves the rider be
      // (the round one a path too since Oct 10: "everything should use path")
      ED.src.toys = [{ path: last.path.slice() }, E.pathify({ orbit: [4, 9.5, 1.8, 0.4, 6, 0, 0] })]; A.onQuickAct(f.c, f.r, 'select');
      const riders = { orbit: [], path: [] }, rd = i => ED.src.toys[i].path[ED.src.toys[i].path.length - 1];
      for (let q = 0; q < 5; q++){ await gest([S(4.6, 9.3)]); riders.orbit.push(rd(1)); }
      for (let q = 0; q < 5; q++){ await gest([S(4, 3.3)]); const v = ED.src.toys[0].path; riders.path.push(v[v.length - 1]); }
      const named = (await gest([S(4.6, 9.3)]), ED.pick && ED.pick.type === 'toy' ? ED.pick.i : null);
      ED.src.toys.push({ kick: [3.3, 9.6, 0.3, 0] }); E.editRefresh && E.editRefresh(true);
      const k0 = rd(1); await gest([S(3.3, 9.6)]);
      const onBumper = { pick: ED.pick && ED.pick.i, rider: rd(1) === k0 };
      E.editAction('undo'); const undone = ED.src.toys.length === 3 ? rd(1) : null;
      ED.src.toys = []; E.editAction('level');
      return { tool, drawn, moved: +moved.toFixed(2), others, went: +went.toFixed(4), kept, inFile, fileSame, tapN, riders, named, onBumper, k0, undone };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    if (pa.tool !== 'path' || pa.drawn.paths !== 1 || pa.drawn.n < 5 || pa.drawn.n > 16 || pa.drawn.rMin < 1.4 || pa.drawn.rMax > 2.6 || pa.drawn.tool !== 'select' || !pa.drawn.sel
        || !(pa.moved > 0.6) || !pa.others || !(pa.went > 0.01) || !pa.kept || !pa.inFile || !pa.fileSame || pa.tapN !== 8
        || pa.riders.orbit.join() !== '1,2,3,4,0' || pa.riders.path.join() !== '1,2,3,4,0' || pa.named !== 1
        || pa.onBumper.pick !== 2 || !pa.onBumper.rider)
      failures.push(`[${current}] the path drawn in place: ${JSON.stringify(pa)}`);
    // PATHS ARE TVF CURVES (Oct 10: "games project should take advantage of tvf, totally suprising that you go to the trouble
    // of creating tvf and then not use it."): a round path rebuilt by draw's kernel is a true circle (Catmull-Rom was not)
    // and passes through every leaf; a path written as .tvf reads back the same; a .tvf from draw (a 40-leaf ellipse in
    // draw's own coordinates), opened through the field's Open input, becomes a path fitted into the board, drawn on it
    const tv = await page.evaluate(() => { const E = window.getFieldApp()._debug.editor, P = E.pathify({ orbit: [4, 6.5, 1.5, 0.36, 6, 0, 0] }).path, L = E.loopOf(P), n = (P.length - 4) / 2;
      let rMin = 9, rMax = 0; for (let m = 0; m < L.M; m++){ const r = Math.hypot(L.pts[2 * m] - 4, L.pts[2 * m + 1] - 6.5); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); }
      let off = 0; for (let q = 0; q < n; q++){ let d = 9; for (let m = 0; m < L.M; m++) d = Math.min(d, Math.hypot(L.pts[2 * m] - P[2 * q], L.pts[2 * m + 1] - P[2 * q + 1])); off = Math.max(off, d); }
      const text = E.pathToTvf(P, 'test'), back = E.tvfToPaths(text)[0];
      return { round: +(rMax - rMin).toFixed(4), off: +off.toFixed(3), head: text.split('\n')[0], same: !!back && JSON.stringify(back.path.slice(0, 2 * n)) === JSON.stringify(P.slice(0, 2 * n)), lib: typeof window.TVF_CURVE.core.reconstruct === 'function' }; });
    const ellipse = ['TVF 40 1 2', '#meta type:curve', '#meta closed:true', '#meta channels:xy', '#meta range:1',
      '0 ' + Array.from({ length: 40 }, (_, q) => (300 + 100 * Math.cos((q + 0.5) / 40 * 2 * Math.PI)).toFixed(3)).join(' '),
      '0 ' + Array.from({ length: 40 }, (_, q) => (200 + 60 * Math.sin((q + 0.5) / 40 * 2 * Math.PI)).toFixed(3)).join(' ')].join('\n') + '\n';
    const n0tv = await page.evaluate(() => { const E = window.getFieldApp()._debug.editor; return E.ED.on ? E.ED.src.toys.length : -1; });
    await page.setInputFiles('#importImageFile', { name: 'shape.tvf', mimeType: 'text/plain', buffer: Buffer.from(ellipse) });
    // (a curve from draw is asked about since Oct 11: a lake, a bunker, a green or a path; Path, clicked)
    await page.waitForSelector('#golfTvfBox .golfTvfKind[data-kind="path"]', { timeout: 15000 }).catch(() => {});
    await page.click('#golfTvfBox .golfTvfKind[data-kind="path"]').catch(() => {});
    await page.waitForTimeout(1500);
    const tvIn = await page.evaluate(n0 => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, T = ED.src.toys[ED.src.toys.length - 1], v = T && T.path;
      if (!v) return { none: true, on: ED.on, n: ED.src.toys.length };
      const n = (v.length - 4) / 2, xs = v.slice(0, 2 * n).filter((_, q) => q % 2 === 0), ys = v.slice(0, 2 * n).filter((_, q) => q % 2 === 1);
      const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), drawn = D.cellItems(f.c, f.r).some(i => /^(propRock|rockPlain)$/.test(i.kind));
      return { on: ED.on, added: ED.src.toys.length - n0, n, w: +(Math.max(...xs) - Math.min(...xs)).toFixed(2), h: +(Math.max(...ys) - Math.min(...ys)).toFixed(2),
               cx: +((Math.max(...xs) + Math.min(...xs)) / 2).toFixed(2), cy: +((Math.max(...ys) + Math.min(...ys)) / 2).toFixed(2), drawn, sel: ED.pick && ED.pick.i === ED.src.toys.length - 1 }; }, n0tv);
    await page.evaluate(() => { const E = window.getFieldApp()._debug.editor; E.ED.src.toys = E.ED.src.toys.filter(T => !T.path); });
    if (!tv.lib || tv.round > 0.01 || tv.off > 0.03 || !/^TVF \d+ 1 2$/.test(tv.head) || !tv.same || tvIn.none || tvIn.added !== 1 || tvIn.n !== 40 || Math.abs(tvIn.w - 5) > 0.2
        || Math.abs(tvIn.h - 3) > 0.2 || Math.abs(tvIn.cx - 4) > 0.2 || Math.abs(tvIn.cy - 6.5) > 0.2 || !tvIn.drawn || !tvIn.sel)
      failures.push(`[${current}] paths as TVF curves: ${JSON.stringify({ tv, tvIn })}`);
    // LAKES, BUNKERS AND GREENS AS .tvf (Oct 11, "proceed": a curve from draw opened as a lake, a bunker or a green, and a
    // shape saved back out): the ellipse from draw, opened through the field's Open input, asks what it should be; Lake,
    // clicked, lays a lake of 32 leaves fitted 4 cells across in the middle of the board, selected, and the menu offers to save
    // it; a lake, bunker or green saved here opens again as what it was, where it was, without asking (a green its height);
    // Escape closes the box unanswered
    await page.setInputFiles('#importImageFile', { name: 'pond.tvf', mimeType: 'text/plain', buffer: Buffer.from(ellipse) });
    await page.waitForSelector('#golfTvfBox .golfTvfKind[data-kind="lake"]', { timeout: 15000 }).catch(() => {});
    const asked = await page.evaluate(() => { const b = document.getElementById('golfTvfBox'); return b ? [...b.querySelectorAll('.golfTvfKind')].map(x => x.dataset.kind).join(',') : null; });
    await page.click('#golfTvfBox .golfTvfKind[data-kind="lake"]').catch(() => {});
    await page.waitForTimeout(1500);
    const shTv = await page.evaluate(() => { const E = window.getFieldApp()._debug.editor, ED = E.ED, f = ED.src.land[ED.src.land.length - 1], v = f && f.lake;
      if (!v) return { none: true, box: !!document.getElementById('golfTvfBox') };
      const xs = v.filter((_, q) => q % 2 === 0), ys = v.filter((_, q) => q % 2 === 1);
      const out = { box: !!document.getElementById('golfTvfBox'), n: xs.length, w: +(Math.max(...xs) - Math.min(...xs)).toFixed(2), cx: +((Math.max(...xs) + Math.min(...xs)) / 2).toFixed(2),
        cy: +((Math.max(...ys) + Math.min(...ys)) / 2).toFixed(2), sel: !!ED.pick && ED.pick.type === 'land' && ED.pick.i === ED.src.land.length - 1,
        save: E.editorMenu().some(i => i.label === 'Save this lake as .tvf'), open: E.editorMenu().some(i => i.label === 'Open a .tvf curve') };
      // saved and opened again: each kind as it was, where it was, no box
      const n0 = ED.src.land.length, J = o => JSON.stringify(o), back = {};
      for (const [key, val] of [['lake', v], ['sand', [5, 2, 7, 2.2, 6.8, 4, 5.1, 3.8]], ['green', [1, 1, 3, 1, 3, 3.5, 1, 3.5, 0.07]]]){
        const text = E.shapeToTvf(key, val, 'test ' + key); E.takeTvf(text, 'test.tvf');
        const g = ED.src.land[ED.src.land.length - 1]; back[key] = !!g && J(g[key]) === J(val) && !document.getElementById('golfTvfBox'); }
      out.back = back; out.kindLine = E.shapeToTvf('green', [1, 1, 3, 1, 3, 3.5, 0.07], 'g').includes('#meta kind:green');
      ED.src.land = ED.src.land.slice(0, n0 - 1);
      return out; });
    await page.setInputFiles('#importImageFile', { name: 'again.tvf', mimeType: 'text/plain', buffer: Buffer.from(ellipse) });
    await page.waitForSelector('#golfTvfBox', { timeout: 15000 }).catch(() => {});
    const tvfEscOpen = await page.evaluate(() => !!document.getElementById('golfTvfBox'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const tvfEsc = await page.evaluate(() => ({ box: !!document.getElementById('golfTvfBox'), on: window.getFieldApp()._debug.editor.ED.on }));
    if (asked !== 'lake,sand,green,planter,path' || shTv.none || shTv.box || shTv.n !== 32 || Math.abs(shTv.w - 4) > 0.15 || Math.abs(shTv.cx - 4) > 0.2 || Math.abs(shTv.cy - 6.5) > 0.2
        || !shTv.sel || !shTv.save || !shTv.open || !shTv.back.lake || !shTv.back.sand || !shTv.back.green || !shTv.kindLine || !tvfEscOpen || tvfEsc.box || !tvfEsc.on)
      failures.push(`[${current}] lakes, bunkers and greens as .tvf: ${JSON.stringify({ asked, shTv, tvfEscOpen, tvfEsc })}`);
    // CURVED FENCES, AND LEAVES ADDED AND TAKEN AWAY (Oct 10: "6,4,2,3", 2 curved fences as TVF curves, 3 "a tap on the loop
    // between two leaves adds one, a double-tap on a leaf removes it"), by real touches: a curved fence drawn with its tool
    // runs through its leaves from end to end, is drawn in fence pieces and kept in files; a tap on its line adds a leaf
    // and two quick taps on a leaf take it away, on a path's loop as on a fence; a ball putted at a fence across the board
    // does not get through it
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const cf = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (x, y) => { const T = W.target, bW = W.boardW(), L = window.LAB; const v = new W.THREE.Vector3(T.boardX + (0.5 - x / D.NX) * bW * L.cellW, 0.02, T.boardZ + (0.5 - y / D.NY) * bW * L.cellH).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const gest = async (pts, after = 300) => { ptr('pointerdown', pts[0]); let t = mk(pts[0]); fire('touchstart', t); for (let q = 1; q < pts.length; q++){ await wait(16); t = mk(pts[q]); fire('touchmove', t); } await wait(16); ptr('pointerup', pts[pts.length - 1]); fire('touchend', t); await wait(after); };
      A.onQuickAct(f.c, f.r, 'select'); ED.src.toys = []; ED.src.land = []; delete ED.src.lift; E.editAction('level');
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'curve')); const tool = ED.tool;
      const line = []; for (let q = 0; q <= 24; q++) line.push(S(1.2 + 5.6 * q / 24, 7 - 1.5 * Math.sin(Math.PI * q / 24)));
      await gest(line);
      const ci = ED.src.toys.findIndex(T => T.curve), v0 = ci >= 0 ? ED.src.toys[ci].curve : null, n0 = v0 ? v0.length / 2 : 0;
      const ends = v0 ? [+Math.hypot(v0[0] - 1.2, v0[1] - 7).toFixed(2), +Math.hypot(v0[v0.length - 2] - 6.8, v0[v0.length - 1] - 7).toFixed(2)] : null;
      const through = v0 ? +Math.max(...Array.from({ length: n0 }, (_, q) => E.curveNear(v0, v0[2 * q], v0[2 * q + 1]).d)).toFixed(4) : 9;
      const sel = !!(ED.pick && ED.src.toys[ED.pick.i] && ED.src.toys[ED.pick.i].curve);
      const pieces = D.cellItems(f.c, f.r, 2000).filter(i => /^fence_/.test(i.kind)).length;
      const kept = JSON.stringify(E.cleanSrc(ED.src).toys) === JSON.stringify(ED.src.toys), inFile = E.holesText([ED.src]).includes('"curve"');
      // a tap on the fence's line halfway between its first two leaves, then two quick taps on the leaf it made
      const C = v0 && E.curveOf(v0), mx = C ? C.pts[8] : 0, my = C ? C.pts[9] : 0;
      await gest([S(mx, my)]); const nAdd = ED.src.toys[ci].curve.length / 2, added = ED.src.toys[ci].curve.slice(2, 4);
      await gest([S(added[0], added[1])], 40); await gest([S(added[0], added[1])]); const nDel = ED.src.toys[ci].curve.length / 2;
      // the same on a path's loop: a tap with Path lays a round loop of eight round (4, 3); a tap on the loop between its
      // first two leaves (at 22.5° and 67.5°) adds one; two quick taps on it take it away
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'path')); A.onCellTap(f.c, f.r, 4 / D.NX, 3 / D.NY);
      const pi = ED.src.toys.findIndex(T => T.path), pN0 = (ED.src.toys[pi].path.length - 4) / 2, pSel = ED.pick && ED.pick.i === pi;
      await gest([S(4 + 1.3 * Math.cos(Math.PI / 4), 3 + 1.3 * Math.sin(Math.PI / 4))]); const pN1 = (ED.src.toys[pi].path.length - 4) / 2, pl = ED.src.toys[pi].path.slice(2, 4);
      await gest([S(pl[0], pl[1])], 40); await gest([S(pl[0], pl[1])]); const pN2 = (ED.src.toys[pi].path.length - 4) / 2;
      // a ball putted straight up the board at a fence right across it stays below the fence
      const k = E.addHole(E.cleanSrc({ name: 'fence test', par: 3, land: [], toys: [{ curve: [0.2, 6.5, 2, 6.1, 4, 6.7, 6, 6.1, 7.8, 6.5] }],
        map: ['........', '........', '...O....', '........', '........', '........', '........', '........', '........', '........', '........', '........', '...T....'] }));
      const g = D.holeGame({ start: k, card: [], single: true }, k); g.pull = { x: 0, y: 0.4 }; D.putt(g);
      let minY = 9; for (let q = 0; q < 1200 && g.state === 'play' && (g.moving || q < 2); q++){ D.step(g, 1 / 120); minY = Math.min(minY, g.ball.y / D.CW); }
      ED.src.toys = []; E.editRefresh && E.editRefresh(true);
      return { tool, n0, ends, through, sel, pieces, kept, inFile, nAdd, nDel, pN0, pSel, pN1, pN2, minY: +minY.toFixed(2) };
    });
    // LAKES, SAND AND GREENS AS TVF SHAPES (Oct 10: "yes, lakes, sand and greens could use tvf."), by real touches: a lake drawn
    // with its tool is a closed shape of leaves, selected; a tap on its line adds a leaf, two quick taps on a leaf take it
    // away; a tap with Bunker lays a round bunker; in play a point inside the lake is water and inside the bunker sand, a
    // ball putted into the lake costs a stroke, and a green stands its height above the grass round it
    const shp = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (x, y) => { const T = W.target, bW = W.boardW(), L = window.LAB; const v = new W.THREE.Vector3(T.boardX + (0.5 - x / D.NX) * bW * L.cellW, 0.02, T.boardZ + (0.5 - y / D.NY) * bW * L.cellH).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const gest = async (pts, after = 300) => { ptr('pointerdown', pts[0]); let t = mk(pts[0]); fire('touchstart', t); for (let q = 1; q < pts.length; q++){ await wait(16); t = mk(pts[q]); fire('touchmove', t); } await wait(16); ptr('pointerup', pts[pts.length - 1]); fire('touchend', t); await wait(after); };
      A.onQuickAct(f.c, f.r, 'select'); ED.src.toys = []; ED.src.land = []; delete ED.src.lift; E.editAction('level');
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'lake')); const tool = ED.tool;
      const loop = []; for (let q = 0; q <= 28; q++){ const a = q / 28 * 2 * Math.PI * 0.97; loop.push(S(4 + 2 * Math.cos(a), 6.5 + 1.5 * Math.sin(a))); }
      await gest(loop);
      const li = ED.src.land.findIndex(x => x.lake), v0 = li >= 0 ? ED.src.land[li].lake : null, n0 = v0 ? v0.length / 2 : 0;
      const sel = !!(ED.pick && ED.pick.type === 'land' && ED.pick.i === li);
      // a tap on its line between its first two leaves (the loop's point between them), then two quick taps on the new leaf
      const B = v0 && E.blobOf(v0, n0), mq = B ? Math.round(B.M / n0) : 0, mx = B ? B.pts[2 * mq] : 0, my = B ? B.pts[2 * mq + 1] : 0;
      await gest([S(mx, my)]); const nAdd = ED.src.land[li].lake.length / 2, nl = ED.src.land[li].lake.slice(2, 4);
      await gest([S(nl[0], nl[1])], 40); await gest([S(nl[0], nl[1])]); const nDel = ED.src.land[li].lake.length / 2;
      // a tap with Bunker, away from the lake
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'bunker')); A.onCellTap(f.c, f.r, 4 / D.NX, 2.5 / D.NY);
      const bunker = !!ED.src.land.find(x => x.sand);
      const kept = JSON.stringify(E.cleanSrc(ED.src).land) === JSON.stringify(ED.src.land), inFile = E.holesText([ED.src]).includes('"lake"');
      ED.src.land = []; E.editRefresh && E.editRefresh(true);
      // in play: water, sand, a green's height, and a stroke lost to the lake
      const k = E.addHole(E.cleanSrc({ name: 'shapes', par: 3, toys: [], land: [{ lake: [2.5, 6, 5.5, 6, 5.5, 8, 2.5, 8] }, { sand: [5, 2, 7, 2, 7, 4, 5, 4] }, { green: [1, 1, 3, 1, 3, 4, 1, 4, 0.06] }],
        map: ['........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '........', '...O....', '...T....'].map((r, j) => j === 11 ? '........' : j === 2 ? '....O...' : r) }));
      const H = D.HOLES[k], CW = D.CW, at = (x, y) => D.groundAt(H, x * CW, y * CW);
      const ground = { lake: at(4, 7), sand: at(6, 3), grass: at(4, 10), shore: at(4, 9.2) };
      const lift = +(D.rawH(H, 2 * CW, 2.5 * CW) - D.rawH(H, 5 * CW, 10 * CW)).toFixed(3);
      const g = D.holeGame({ start: k, card: [], single: true }, k); g.pull = { x: 0, y: 0.4 }; D.putt(g);
      for (let q = 0; q < 1500 && g.state === 'play' && (g.moving || q < 2); q++) D.step(g, 1 / 120);
      const blocked = D.cellBlocked(H, 4, 7) && !D.cellBlocked(H, 4, 10);
      return { tool, n0, sel, nAdd, nDel, bunker, kept, inFile, ground, lift, strokes: g.strokes, back: Math.abs(g.ball.y / CW - 12.5) < 0.6, blocked };
    });
    if (shp.tool !== 'lake' || !(shp.n0 >= 8 && shp.n0 <= 24) || !shp.sel || shp.nAdd !== shp.n0 + 1 || shp.nDel !== shp.n0 || !shp.bunker || !shp.kept || !shp.inFile
        || shp.ground.lake !== '~' || shp.ground.sand !== 's' || shp.ground.grass !== '.' || shp.ground.shore !== '.' || !(shp.lift > 0.04) || shp.strokes !== 2 || !shp.back || !shp.blocked)
      failures.push(`[${current}] lakes, sand and greens as shapes: ${JSON.stringify(shp)}`);
    // PLANTERS (Oct 11: "#6", closed curved walls the ball banks off), by real touches: a planter drawn with its tool is a
    // closed shape of leaves, selected, walled on the board; a tap with Planter lays a kidney; a leaf of it dragged moves
    // that leaf alone; it is kept by cleaning and files; in play a ball shot hard at a star never gets inside it and comes
    // back off it, and the players' way round goes round it
    const pl = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (x, y) => { const T = W.target, bW = W.boardW(), L = window.LAB; const v = new W.THREE.Vector3(T.boardX + (0.5 - x / D.NX) * bW * L.cellW, 0.02, T.boardZ + (0.5 - y / D.NY) * bW * L.cellH).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const gest = async (pts, after = 300) => { ptr('pointerdown', pts[0]); let t = mk(pts[0]); fire('touchstart', t); for (let q = 1; q < pts.length; q++){ await wait(16); t = mk(pts[q]); fire('touchmove', t); } await wait(16); ptr('pointerup', pts[pts.length - 1]); fire('touchend', t); await wait(after); };
      A.onQuickAct(f.c, f.r, 'select'); ED.src.toys = []; ED.src.land = []; delete ED.src.lift; E.editAction('level');
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'planter')); const tool = ED.tool;
      const loop = []; for (let q = 0; q <= 28; q++){ const a = q / 28 * 2 * Math.PI * 0.97; loop.push(S(4 + 1.6 * Math.cos(a), 6.5 + 1.1 * Math.sin(a))); }
      await gest(loop);
      const pi = ED.src.toys.findIndex(x => x.planter), n0 = pi >= 0 ? ED.src.toys[pi].planter.length / 2 : 0, sel = !!(ED.pick && ED.pick.type === 'toy' && ED.pick.i === pi);
      const walls = D.cellItems(f.c, f.r).filter(i => /^planterWall_/.test(i.kind)).length;
      // a tap with Planter lays a kidney, selected; its first leaf dragged half a cell right moves that leaf alone
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === 'planter')); A.onCellTap(f.c, f.r, 4 / D.NX, 9.6 / D.NY);
      const ki = ED.src.toys.length - 1, kv = ED.src.toys[ki] && ED.src.toys[ki].planter, kSel = !!(ED.pick && ED.pick.i === ki), kn = kv ? kv.length / 2 : 0;
      let leafMoved = null;
      if (kv){ const [lx, ly] = [kv[0], kv[1]], drag = []; for (let q = 0; q <= 8; q++) drag.push(S(lx + 0.5 * q / 8, ly)); await gest(drag);
        // (the finger's first few pixels go to telling a drag from a tap, so the leaf goes most of the way, not all of it)
        const nv = ED.src.toys[ki].planter; leafMoved = nv[0] - lx > 0.2 && nv[0] - lx < 0.6 && Math.abs(nv[1] - ly) < 0.1 && nv.slice(2).every((x, q) => Math.abs(x - kv[q + 2]) < 1e-9); }
      const kept = JSON.stringify(E.cleanSrc(ED.src).toys) === JSON.stringify(ED.src.toys), inFile = E.holesText([ED.src]).includes('"planter"');
      ED.src.toys = []; E.editRefresh && E.editRefresh(true);
      // in play: a star in the middle, the ball shot hard straight at it from the tee and every way about
      const star = []; for (let q = 0; q < 15; q++){ const a = (q + 0.5) / 15 * 2 * Math.PI, rr = 1 + 0.3 * Math.cos(5 * a); star.push(+(4 + rr * Math.cos(a)).toFixed(2), +(6.5 + rr * Math.sin(a)).toFixed(2)); }
      const k = E.addHole(E.cleanSrc({ name: 'planter test', par: 3, land: [], toys: [{ planter: star }], map: ['........', '........', '...O....', '........', '........', '........', '........', '........', '........', '........', '........', '........', '...T....'] }));
      const H = D.HOLES[k], B = E.blobOf(H.toys[0].planter, 15), CW = D.CW; let inside = 0, minY = 99;
      for (let a = -0.4; a <= 0.41; a += 0.1){ const g = D.holeGame({ start: k, card: [], single: true }, k); g.pull = { x: Math.sin(a) * 0.45, y: Math.cos(a) * 0.45 }; D.putt(g);
        for (let q = 0; q < 2400 && g.state === 'play' && (g.moving || q < 2); q++){ D.step(g, 1 / 120); if (E.blobIn(B, g.ball.x, g.ball.y)) inside++; if (Math.abs(a) < 0.01) minY = Math.min(minY, g.ball.y / CW); } }
      return { tool, n0, sel, walls, kn, kSel, leafMoved, kept, inFile, inside, minY: +minY.toFixed(2), blocked: D.cellBlocked(H, 4, 6) && !D.cellBlocked(H, 1, 6) };
    });
    // and on generated holes: some have planters, kept off the tee, the cup and everything else
    const plGen = await page.evaluate(() => { const D = window.getFieldApp()._debug, E = D.editor; let n = 0, bad = [];
      for (let i = 22; i < 322; i++){ const s = D.genSrc(i, 1 + i % 5), at = ch => { for (let j = 0; j < 13; j++){ const c = s.map[j].indexOf(ch); if (c >= 0) return [c + 0.5, j + 0.5]; } };
        const T = at('T'), O = at('O');
        for (const P of s.toys.filter(U => U.planter)){ n++; const B = E.blobOf(P.planter, P.planter.length >> 1);
          for (let m = 0; m < B.M; m++){ const x = B.pts[2 * m], y = B.pts[2 * m + 1]; if (Math.hypot(x - T[0], y - T[1]) < 1.3 || Math.hypot(x - O[0], y - O[1]) < 1.5) { bad.push(i); break; } }
          for (const U of s.toys) if (U !== P){ const k = Object.keys(U)[0], v = U[k];
            const pts = k === 'path' ? (L => Array.from({ length: L.M }, (_, q) => [L.pts[2 * q], L.pts[2 * q + 1]]))(E.loopOf(v)) : k === 'curve' ? (C => Array.from({ length: C.m }, (_, q) => [C.pts[2 * q], C.pts[2 * q + 1]]))(E.curveOf(v)) : [[v[0], v[1]]];
            if (pts.some(([x, y]) => E.blobIn(B, x, y))) bad.push(i + k); } } }
      return { n, bad: [...new Set(bad)].slice(0, 6) }; });
    if (pl.tool !== 'planter' || !(pl.n0 >= 8 && pl.n0 <= 24) || !pl.sel || !(pl.walls >= 8) || pl.kn !== 12 || !pl.kSel || !pl.leafMoved || !pl.kept || !pl.inFile
        || pl.inside || !(pl.minY > 7.6) || !pl.blocked || plGen.n < 40 || plGen.bad.length)
      failures.push(`[${current}] planters: ${JSON.stringify({ pl, plGen })}`);
    // CURVED RIDGES, GULLIES AND RAMPS (Oct 11: "proceed on 5"), by real touches: a line drawn with Ridge is a curved ridge
    // of leaves, selected, the ground raised along it and not beside it; a tap with Gully lays an arc of five sunk below the
    // grass; a leaf of it dragged moves that leaf alone; the menu's Higher raises it; a tap with Ramp lays a curved ramp
    // that rises from its first leaf to its last; all are kept by cleaning and files; and generated holes have them
    const cr = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), CW = D.CW;
      const S = (x, y) => { const T = W.target, bW = W.boardW(), L = window.LAB; const v = new W.THREE.Vector3(T.boardX + (0.5 - x / D.NX) * bW * L.cellW, 0.02, T.boardZ + (0.5 - y / D.NY) * bW * L.cellH).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const gest = async (pts, after = 300) => { ptr('pointerdown', pts[0]); let t = mk(pts[0]); fire('touchstart', t); for (let q = 1; q < pts.length; q++){ await wait(16); t = mk(pts[q]); fire('touchmove', t); } await wait(16); ptr('pointerup', pts[pts.length - 1]); fire('touchend', t); await wait(after); };
      const tile = k => A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === k)), H = () => D.HOLES[ED.k], h = (x, y) => D.rawH(H(), x * CW, y * CW);
      A.onQuickAct(f.c, f.r, 'select'); ED.src.toys = []; ED.src.land = []; delete ED.src.lift; E.editAction('level');
      tile('crest'); const tool = ED.tool, line = [];
      for (let q = 0; q <= 24; q++){ const t = q / 24; line.push(S(1.5 + 5 * t, 6.5 - 1.5 * Math.sin(Math.PI * t))); }
      await gest(line);
      const ri = ED.src.land.findIndex(x => x.crest), rv = ri >= 0 ? ED.src.land[ri].crest : null, n0 = rv ? (rv.length - 2) / 2 : 0;
      const sel = !!(ED.pick && ED.pick.type === 'land' && ED.pick.i === ri), rise = +(h(4, 5) - h(4, 7.5)).toFixed(3);
      // a tap with Gully: an arc of five, sunk, selected; its first leaf dragged half a cell right moves that leaf alone
      tile('gully'); A.onCellTap(f.c, f.r, 4 / D.NX, 9.6 / D.NY);
      const gi = ED.src.land.length - 1, gv = ED.src.land[gi] && ED.src.land[gi].crest, gn = gv ? (gv.length - 2) / 2 : 0, gSel = !!(ED.pick && ED.pick.i === gi);
      const sunk = gv ? +(h(gv[4], gv[5]) - h(4, 12)).toFixed(3) : null;
      let leafMoved = null;
      if (gv){ const [lx, ly] = [gv[0], gv[1]], drag = []; for (let q = 0; q <= 8; q++) drag.push(S(lx + 0.5 * q / 8, ly)); await gest(drag);
        // (a short drag, as on a phone, under the 16 px a tap may go: the press is not read as a tap on the line as well)
        const nv = ED.src.land[gi].crest; leafMoved = [+(nv[0] - lx).toFixed(2), +(nv[1] - ly).toFixed(2), nv.slice(2).every((x, q) => Math.abs(x - gv[q + 2]) < 1e-9)]; }
      // the menu's Higher and Lower, with it selected
      const g0 = ED.src.land[gi].crest.slice(-1)[0], mi = E.editorMenu().find(x => x.label === 'Higher'); if (mi) mi.on();
      const higher = +(ED.src.land[gi].crest.slice(-1)[0] - g0).toFixed(3), name = E.editorMenu().some(x => /^Delete curved gully$/.test(x.label));
      // a tap with Ramp: a curved ramp rising from its first leaf to its last
      tile('incline'); A.onCellTap(f.c, f.r, 2 / D.NX, 9 / D.NY);
      const ii = ED.src.land.length - 1, iv = ED.src.land[ii] && ED.src.land[ii].incline, inN = iv ? (iv.length - 2) / 2 : 0;
      const climb = iv ? [0, 2, 4].map(q => { const a = Math.min(q, inN - 1) * 2; return +h(iv[a] + (q === 0 ? 0.3 * (iv[2] - iv[0]) : 0), iv[a + 1] + (q === 0 ? 0.3 * (iv[3] - iv[1]) : 0)).toFixed(3); }) : null;
      const kept = JSON.stringify(E.cleanSrc(ED.src).land) === JSON.stringify(ED.src.land), txt = E.holesText([ED.src]), inFile = txt.includes('"crest"') && txt.includes('"incline"');
      ED.src.land = []; E.editRefresh && E.editRefresh(true);
      return { tool, n0, sel, rise, gn, gSel, sunk, leafMoved, higher, name, inN, climb, kept, inFile };
    });
    const crGen = await page.evaluate(() => { const D = window.getFieldApp()._debug; const n = { crest: 0, gully: 0, incline: 0 };
      for (let i = 22; i < 322; i++) for (const f of D.genSrc(i, 1 + i % 5).land){ if (f.crest) n[f.crest[f.crest.length - 1] < 0 ? 'gully' : 'crest']++; if (f.incline) n.incline++; }
      return n; });
    if (cr.tool !== 'crest' || !(cr.n0 >= 3 && cr.n0 <= 16) || !cr.sel || !(cr.rise > 0.03) || cr.gn !== 5 || !cr.gSel || !(cr.sunk < -0.02) || !cr.leafMoved || !(cr.leafMoved[0] > 0.2 && cr.leafMoved[0] < 0.6 && Math.abs(cr.leafMoved[1]) < 0.1 && cr.leafMoved[2])
        || cr.higher !== 0.01 || !cr.name || !(cr.inN >= 3) || !cr.climb || !(cr.climb[1] > cr.climb[0] + 0.01 && cr.climb[2] > cr.climb[1] + 0.01) || !cr.kept || !cr.inFile
        || crGen.crest < 20 || crGen.gully < 10 || crGen.incline < 10)
      failures.push(`[${current}] curved ridges, gullies and ramps: ${JSON.stringify({ cr, crGen })}`);
    // a roll stops after ROLL_MAX (Oct 11): a putt just struck stops at once once it has rolled that long, and not before
    const roll = await page.evaluate(() => { const D = window.getFieldApp()._debug, k = D.HOLES.findIndex(H => H.gen == null && !H.custom);
      const g = D.holeGame({ start: k, card: [], single: true }, k); g.pull = { x: 0, y: 0.45 }; D.putt(g); D.step(g, 1 / 120); const early = g.moving;
      g.rollT = 14.99; D.step(g, 1 / 30); return { early, rollT: typeof g.rollT, late: g.moving }; });
    if (!roll.early || roll.rollT !== 'number' || roll.late) failures.push(`[${current}] a roll stops after ROLL_MAX: ${JSON.stringify(roll)}`);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    // SMOOTHER AND ROUGHER (Oct 11: "proceed on 2"): with a closed curve selected, the quick buttons ◯ and ✺ (and the menu)
    // make its outline smoother or rougher, clicked for real: Smoother takes a wobbly bunker's wiggles down and leaves its
    // place and leaf count; Undo puts it back; a round lake gets no smoother, and Rougher gives it coves, the same each
    // time and never crossing itself however often it is pressed; a planter, a path and a green keep what follows their
    // leaves; a bumper selected brings no such buttons
    // (a tap selects it, as a finger would, and the quick buttons follow the selection)
    const srPrep = async (js, want) => { await page.evaluate(js); await page.waitForFunction(n => document.querySelectorAll('#bbQuick button[title="Smoother"]').length === n, want, { timeout: 5000 }).catch(() => {}); };
    const srBtn = t => page.locator(`#bbQuick button[title="${t}"]`);
    const srClick = async t => { await srBtn(t).click(); await page.waitForTimeout(120); };
    await srPrep(() => { const E = window.getFieldApp()._debug.editor, ED = E.ED, wob = [];
      for (let q = 0; q < 16; q++){ const a = (q + 0.5) / 16 * 2 * Math.PI, r = 1.3 + 0.28 * Math.cos(5 * a) + 0.12 * Math.cos(7 * a + 1); wob.push(+(4 + r * Math.cos(a)).toFixed(2), +(6.5 + 0.8 * r * Math.sin(a)).toFixed(2)); }
      window.getFieldApp().onQuickAct(0, 0, 'select'); ED.src.toys = []; ED.src.land = [{ sand: wob }]; const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); ED.pick = null; A.onCellTap(f.c, f.r, 4 / A._debug.NX, 6.5 / A._debug.NY); window.__wob = wob; }, 1);
    const sr = { buttons: await srBtn('Smoother').count() + await srBtn('Rougher').count() };
    const srRead = () => page.evaluate(() => { const E = window.getFieldApp()._debug.editor, ED = E.ED, f = ED.src.land[0], k = Object.keys(f)[0], v = f[k], n = k === 'green' ? (v.length - 1) >> 1 : v.length >> 1;
      let x = 0, y = 0; for (let q = 0; q < n; q++){ x += v[2 * q]; y += v[2 * q + 1]; } return { w: +E.wiggleOf(v, n).toFixed(3), n, c: [+(x / n).toFixed(3), +(y / n).toFixed(3)], v: v.join(' '), msg: ED.msg }; });
    const w0 = await srRead();
    sr.menu = await page.evaluate(() => window.getFieldApp()._debug.editor.editorMenu().filter(m => /^(Smoother|Rougher)$/.test(m.label)).length);
    if (sr.buttons === 2){ await srClick('Smoother'); const w1 = await srRead(); sr.smooth = [w0.w, w1.w]; sr.kept = w1.n === 16 && Math.hypot(w1.c[0] - w0.c[0], w1.c[1] - w0.c[1]) < 0.02;
      await page.evaluate(() => window.getFieldApp()._debug.editor.editAction('undo')); sr.undone = (await srRead()).v === w0.v; }
    await srPrep(() => { const ED = window.getFieldApp()._debug.editor.ED, lake = [];
      for (let q = 0; q < 12; q++){ const a = (q + 0.5) / 12 * 2 * Math.PI; lake.push(+(4 + 1.6 * Math.cos(a)).toFixed(2), +(6.5 + 1.36 * Math.sin(a)).toFixed(2)); }
      ED.src.land = [{ lake }]; const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); ED.pick = null; A.onCellTap(f.c, f.r, 4 / A._debug.NX, 6.5 / A._debug.NY); window.__lake = lake.slice(); }, 1);
    if (sr.buttons === 2){ const l0 = await srRead(); await srClick('Smoother'); sr.roundSame = (await srRead()).v === l0.v;
      await srClick('Rougher'); const l1 = await srRead(); sr.coves = l1.w;
      sr.same = await page.evaluate(v => { const E = window.getFieldApp()._debug.editor; return E.reshaped('lake', window.__lake, 12, true).join(' ') === v; }, l1.v);
      for (let i = 0; i < 11; i++) await srClick('Rougher');
      sr.crossed = await page.evaluate(() => { const E = window.getFieldApp()._debug.editor, v = E.ED.src.land[0].lake, xs = [], ys = []; for (let q = 0; q < 12; q++){ xs.push(v[2 * q]); ys.push(v[2 * q + 1]); } return E.crossesItself(xs, ys); });
      sr.rough = (await srRead()).w; }
    sr.tails = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, ED = E.ED, star = [], loop = [], gr = [];
      for (let q = 0; q < 15; q++){ const a = (q + 0.5) / 15 * 2 * Math.PI, rr = 1 + 0.3 * Math.cos(5 * a); star.push(+(4 + rr * Math.cos(a)).toFixed(2), +(6.5 + rr * Math.sin(a)).toFixed(2)); }
      for (let q = 0; q < 10; q++){ const a = (q + 0.5) / 10 * 2 * Math.PI, rr = 1.5 + 0.3 * Math.cos(3 * a); loop.push(+(4 + rr * Math.cos(a)).toFixed(2), +(6.5 + rr * Math.sin(a)).toFixed(2)); gr.push(+(4 + rr * Math.cos(a)).toFixed(2), +(9 + rr * 0.7 * Math.sin(a)).toFixed(2)); }
      ED.src.toys = [{ planter: star }, { path: [...loop, 0.33, 6, 0.25, 1] }]; ED.src.land = [{ green: [...gr, 0.05] }];
      const go = (type, i) => { ED.pick = { type, i }; E.editAction('smoother'); };
      go('toy', 0); go('toy', 1); go('land', 0);
      const p = ED.src.toys[1].path, g = ED.src.land[0].green;
      return { planter: E.wiggleOf(ED.src.toys[0].planter, 15) < E.wiggleOf(star, 15), path: p.length === 24 && p.slice(20).join() === '0.33,6,0.25,1' && p.slice(0, 20).join() !== loop.join(), green: g.length === 21 && g[20] === 0.05 && g.slice(0, 20).join() !== gr.join() }; });
    await srPrep(() => { const ED = window.getFieldApp()._debug.editor.ED; ED.src.toys = [{ kick: [4, 4, 0.3, 0] }]; ED.src.land = []; const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); ED.pick = null; A.onCellTap(f.c, f.r, 4 / A._debug.NX, 4 / A._debug.NY); }, 0);
    sr.bumper = await srBtn('Smoother').count();
    await page.evaluate(() => { const ED = window.getFieldApp()._debug.editor.ED; ED.src.toys = []; ED.pick = null; });
    if (sr.buttons !== 2 || sr.menu !== 2 || !sr.smooth || !(sr.smooth[1] < sr.smooth[0] * 0.8) || !sr.kept || !sr.undone || !sr.roundSame || !(sr.coves > 0.05) || !sr.same
        || sr.crossed !== false || !(sr.rough > sr.coves) || !sr.tails.planter || !sr.tails.path || !sr.tails.green || sr.bumper !== 0)
      failures.push(`[${current}] smoother and rougher: ${JSON.stringify(sr)}`);
    // movers kept apart in the editor (Oct 11): two loops drawn crossing are put on one beat and never meet; a bumper laid on
    // a track is ringed in red and left where it is; Keep movers apart, in the menu, moves it off and nothing is ringed
    const ke = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED;
      const circ = (cx, cy, r, n) => { const v = []; for (let q = 0; q < n; q++){ const a = (q + 0.5) / n * 2 * Math.PI; v.push(+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)); } return v; };
      ED.src.toys = [{ path: [...circ(3.2, 6.5, 1.5, 8), 0.35, 5, 0, 1] }, { path: [...circ(4.8, 6.5, 1.5, 8), 0.35, -7.3, 0.5, 0] }]; ED.src.land = []; ED.pick = null;
      E.editRefresh(true);
      const P = ED.src.toys.map(T => T.path), per = P.map(v => v[17]);
      let minGap = Infinity; for (let t = 0; t < 90; t += 0.02){ const a = D.toyAt({ path: P[0] }, t), b = D.toyAt({ path: P[1] }, t); minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y) - 0.7); }
      const meets0 = (ED.meets || []).length;
      ED.src.toys.push({ kick: [3.2, 5, 0.3, 0] }); E.editRefresh(true);
      const ringed = (ED.meets || []).length, stayed = !!ED.src.toys[2] && ED.src.toys[2].kick[0] === 3.2 && ED.src.toys[2].kick[1] === 5;
      const item = E.editorMenu().find(m => m.label === 'Keep movers apart'); if (item) item.on();
      const k2 = ED.src.toys.find(T => T.kick), moved = !!k2 && (k2.kick[0] !== 3.2 || k2.kick[1] !== 5), after = (ED.meets || []).length;
      ED.src.toys = []; ED.meets = []; E.editRefresh(true);
      return { per, minGap: +minGap.toFixed(3), meets0, ringed, stayed, item: !!item, moved, after };
    });
    const ratio = Math.abs(ke.per[1] / ke.per[0]), onBeat = [1, 1.5, 2, 3, 4, 6].some(m => Math.abs(ratio - m) < 1e-3 || Math.abs(ratio - 1 / m) < 1e-3);
    if (!onBeat || !(ke.minGap > 0) || ke.meets0 || !(ke.ringed >= 1) || !ke.stayed || !ke.item || !ke.moved || ke.after)
      failures.push(`[${current}] movers kept apart in the editor: ${JSON.stringify(ke)}`);
    if (cf.tool !== 'curve' || !(cf.n0 >= 4 && cf.n0 <= 8) || !cf.ends || cf.ends.some(e => e > 0.6) || cf.through > 0.001 || !cf.sel || !(cf.pieces >= 8) || !cf.kept || !cf.inFile
        || cf.nAdd !== cf.n0 + 1 || cf.nDel !== cf.n0 || cf.pN0 !== 8 || !cf.pSel || cf.pN1 !== 9 || cf.pN2 !== 8 || !(cf.minY > 6))
      failures.push(`[${current}] curved fences and leaves: ${JSON.stringify(cf)}`);
    // the tiles (Oct 10: "remove the in hand, paint, editing anything on the top line of the button. when the object is
    // selected, change the color of the button to selected. the buttons should toggle on/off thats it. remove the
    // following buttons: par, check, save, share, done, tee, cup, ramp, bowl, half-pipe, select, higher, lower, name.")
    const tl = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tiles = () => A.statTiles(f.c, f.r) || [], names = tiles().map(t => t.value);
      const gone = ['Par', 'Check', 'Save', 'Share', 'Done', 'Tee', 'Cup', 'Ramp', 'Bowl', 'Half-pipe', 'Select', 'Higher', 'Lower', 'Name'].filter(n => names.includes(n));
      const labels = tiles().filter(t => t.label).length;
      const wi = E.TOOLS.findIndex(x => x[0] === '#');
      E.ED.tool = 'select'; A.onStatTap(f.c, f.r, wi); const on = tiles()[wi].bg, lit = tiles().filter(t => t.bg).length;
      A.onStatTap(f.c, f.r, wi); const off = tiles()[wi].bg, tool = E.ED.tool;
      return { gone, labels, on, lit, off, tool }; });
    if (tl.gone.length || tl.labels || !tl.on || tl.lit !== 1 || tl.off || tl.tool !== 'select') failures.push(`[${current}] the tiles: ${JSON.stringify(tl)}`);
    // Copy, Paste and Delete in the menu (Oct 10: "add copy, paste delete . the three should copy/paste/delete the complete
    // board not the object", then "add copy,paste,delete to the menu. if no object is selected, copy the board. if an
    // object is selected, copy the object. add undo,redo to the menu. remove copy,paste,delete,undo,redo from the menu."):
    // none of the five is a tile now; with nothing selected they act on the board, with a thing selected on the thing;
    // Undo and Redo are in the menu too
    const cp = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tiles = A.statTiles(f.c, f.r) || [], names = tiles.map(t => t.value);
      const menu = l => E.editorMenu().find(i => i.label.startsWith(l)), run = l => { const i = menu(l); if (i && !i.disabled) i.on(); return !!i; };
      const textOnly = tiles.filter(t => !t.glyph).length, gone = ['Undo', 'Redo', 'Copy', 'Paste', 'Delete'].filter(n => names.includes(n)), first = names[0];
      const body = s => { const { name, ...rest } = s; return JSON.stringify(E.cleanSrc(rest)); };
      ED.pick = null; ED.src.toys.push({ rock: [2, 6, 0.4] }); ED.src.lift = Array.from({ length: 9 * 14 }, (_, i) => i === 40 ? 0.05 : 0);
      const name = ED.src.name, was = body(ED.src), labels = E.editorMenu().map(i => i.label);
      run('Copy the board');
      run('Delete the board'); const cleared = !ED.src.toys.length && !ED.src.land.length && !ED.src.lift && ED.src.name === name;
      run('Paste the board'); const pasted = body(ED.src) === was && ED.src.name === name;
      run('Undo'); const undone = !ED.src.toys.length;
      run('Redo'); const redone = body(ED.src) === was;
      // a thing selected: Copy and Paste make a second one beside it, selected; Delete takes the selected one only
      ED.pick = { type: 'toy', i: ED.src.toys.findIndex(T => T.rock) }; const objLabel = menu('Copy ').label;
      run('Copy '); const n0 = ED.src.toys.length; run('Paste');
      const second = ED.src.toys.length === n0 + 1 && !!ED.src.toys[n0].rock && ED.pick && ED.pick.i === n0 && ED.src.toys[n0].rock[0] !== 2;
      run('Delete '); const delOne = ED.src.toys.length === n0 && !!ED.src.lift;
      const stored = !!localStorage.getItem('golf.clip');
      return { textOnly, gone, first, cleared, pasted, undone, redone, objLabel, second, delOne, stored, labels: labels.slice(0, 7) }; });
    if (cp.textOnly || cp.gone.length || cp.first !== 'Wall' || !cp.cleared || !cp.pasted || !cp.undone || !cp.redone || cp.objLabel !== 'Copy boulder'
        || !cp.second || !cp.delOne || !cp.stored || !['Undo', 'Redo', 'Copy the board', 'Paste', 'Delete the board'].every(l => cp.labels.some(x => x.startsWith(l))))
      failures.push(`[${current}] copy, paste, delete in the menu: ${JSON.stringify(cp)}`);
    // HARDER AND EASIER (the levels, Oct 10: "Now we way to adjust the difficulty, what do you suggest" … "ok, proceed"):
    // the two tiles, tapped, make every mover faster and its rider bigger and the ground steeper, and back again; the menu's
    // Rate this hole, while editing, rates it and sets its par
    const hd = await page.evaluate(async () => { const A = window.getFieldApp(), E = A._debug.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      ED.pick = null; ED.src.toys = [E.pathify({ orbit: [4, 7, 1.4, 0.36, 6, 0, 0] })]; ED.src.land = [{ bump: [4, 4, 1.5, 0.04] }]; E.editRefresh && E.editRefresh(true);
      const names = (A.statTiles(f.c, f.r) || []).map(t => t.value), hi = names.indexOf('Harder'), lo = names.indexOf('Easier');
      const read = () => { const v = ED.src.toys[0].path, n = (v.length - 4) / 2; return { r: v[2 * n], sec: v[2 * n + 1], h: ED.src.land[0].bump[3] }; };
      const a = read(); A.onStatTap(f.c, f.r, hi); const b = read(), msg = ED.msg; A.onStatTap(f.c, f.r, lo); const c = read();
      const rate = window.getFieldApp().menu[0].items.find(i => i.label === 'Rate this hole');
      const r = rate ? await rate.on() : null;
      return { hi, lo, a, b, c, msg, rated: r && { stars: r.stars, par: r.par }, par: ED.src.par, rmsg: ED.msg }; });
    if (hd.hi < 0 || hd.lo < 0 || !(hd.b.sec < hd.a.sec && hd.b.r > hd.a.r && hd.b.h > hd.a.h) || Math.abs(hd.c.sec - hd.a.sec) > 0.05 || Math.abs(hd.c.h - hd.a.h) > 0.002
        || !hd.rated || !(hd.rated.stars >= 1) || hd.par !== hd.rated.par || !/★/.test(hd.rmsg))
      failures.push(`[${current}] Harder, Easier and Rate this hole: ${JSON.stringify(hd)}`);
    // Done (its tile): the editor's tiles go and the hole is played
    await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      E.editAction('done'); });   // (its tile went on Oct 10; Done is a quick button)
    await page.waitForFunction(() => document.body.classList.contains('bb-collapsed'), null, { timeout: 15000 }).catch(() => {});
    const st3 = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const g = [...D.games.values()].find(g => g.hole === E.ED.k), t = A.statTiles(f.c, f.r) || []; return { on: E.ED.on, tiles: t.length, state: g && g.state, single: g && g.R.single, shut: document.body.classList.contains('bb-collapsed') }; });
    if (st3.on || st3.tiles || st3.state !== 'play' || !st3.single || !st3.shut) failures.push(`[${current}] Done: ${JSON.stringify(st3)}`);
    // THE ROW IS THE EDITOR (Oct 10: "the bottom browser in the golf application should turn edit mode on when it displayed
    // and turned off when not displayed. remove the game mode of the bottom browser."): the dots, clicked, open the row
    // and the editor with it; clicked again they shut both; no playing tiles or buttons are ever in the row
    await page.waitForTimeout(800);                           // (the pane slides shut first; the dots ride on it)
    // (the dots are clicked only once they stay where they are and nothing covers them: the pane slides a frame at a time,
    //  and a software renderer under load, as on CI, can take seconds a frame, so a fixed wait was sometimes too short and
    //  the click fell on the board: Oct 11; and 15 s was still too short once every board drew its full pieces: Oct 12)
    const dotsReady = async () => {
      await page.evaluate(() => { window._dotsAt = null; });
      await page.waitForFunction(() => { const h = document.getElementById('bbHandle'); if (!h) return false;
        const r = h.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, el = r.width > 0 ? document.elementFromPoint(x, y) : null, k = x.toFixed(1) + ',' + y.toFixed(1);
        const ok = !!el && (el === h || h.contains(el)) && window._dotsAt === k; window._dotsAt = k; return ok; }, null, { timeout: 60000, polling: 250 }).catch(() => {});
      return page.evaluate(() => { const r = document.getElementById('bbHandle').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    };
    const dotsXY = await dotsReady();
    const pre = await page.evaluate(at => { const el = document.elementFromPoint(at.x, at.y), b = window.tvf.browser, E = window.getFieldApp()._debug.editor; return { at, el: el && (el.id || el.tagName), on: E.ED.on, shut: document.body.classList.contains('bb-collapsed'), vis: b.visible, vw: innerWidth, vh: innerHeight }; }, dotsXY);
    await page.mouse.click(dotsXY.x, dotsXY.y);
    await page.waitForFunction(() => !document.body.classList.contains('bb-collapsed'), null, { timeout: 15000 }).catch(() => {});
    const rowOn = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      return { on: E.ED.on, open: !document.body.classList.contains('bb-collapsed'), tiles: (A.statTiles(f.c, f.r) || []).length, first: ((A.statTiles(f.c, f.r) || [])[0] || {}).value }; });
    await page.waitForTimeout(800);
    const dotsXY2 = await dotsReady();
    await page.mouse.click(dotsXY2.x, dotsXY2.y);
    await page.waitForFunction(() => document.body.classList.contains('bb-collapsed'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const rowOff = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = A._debug.games.get(f.c + '_' + f.r);
      return { on: E.ED.on, shut: document.body.classList.contains('bb-collapsed'), tiles: (A.statTiles(f.c, f.r) || []).length, quick: (A.quickActs(f.c, f.r) || []).length, state: g && g.state }; });
    if (!rowOn.on) rowOn.dbg = await page.evaluate(at => { const el = document.elementFromPoint(at.x, at.y), b = window.tvf.browser; return { el: el && (el.id || el.tagName), visible: b.visible, mode: b.mode }; }, dotsXY);
    if (!rowOn.on || !rowOn.open || rowOn.first !== 'Wall' || rowOff.on || !rowOff.shut || rowOff.tiles || rowOff.quick || rowOff.state !== 'play')
      failures.push(`[${current}] the row is the editor: ${JSON.stringify({ pre, rowOn, rowOff })}`);
    // Escape (Oct 9: "don't change the zoom level with escape, instead cancel the edit mode."): in the editor it leaves the
    // editor and the view stays where it was; out of it, it does nothing to the view either
    await page.waitForTimeout(2500);                          // (the view settled first)
    const escZ = await page.evaluate(() => { const E = window.getFieldApp()._debug.editor, W = window.FIELD_WORLD;
      E.editStart(E.ED.k); return { on: E.ED.on, zoom: W.st.zoom, target: W.target.zoom }; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const escZ2 = await page.evaluate(() => ({ on: window.getFieldApp()._debug.editor.ED.on, zoom: window.FIELD_WORLD.st.zoom, target: window.FIELD_WORLD.target.zoom }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const escZ3 = await page.evaluate(() => window.FIELD_WORLD.st.zoom);
    // (the view may still be finishing a settle of its own: Escape must set no flight of its own, nor move it far)
    if (!escZ.on || escZ2.on || escZ2.target !== escZ.target || Math.abs(escZ2.zoom - escZ.zoom) > 5 || Math.abs(escZ3 - escZ.zoom) > 5) failures.push(`[${current}] Escape: ${JSON.stringify({ escZ, escZ2, escZ3 })}`);
    // no buttons while the pane is shut (Oct 9: "dont show any buttons when the bottom panel is not visible"): the dots shut
    // it and the buttons go; the dots open it and they are back
    const qVis = () => page.evaluate(() => { const q = document.getElementById('bbQuick'); return !!(q && q.offsetParent && q.getBoundingClientRect().width > 0); });
    // (the dots found again before each click, as they ride on the pane, and each change waited for, not a fixed half second)
    const isShut = shut => page.waitForFunction(w => document.body.classList.contains('bb-collapsed') === w, shut, { timeout: 15000 }).catch(() => {});
    const quickIs = vis => page.waitForFunction(w => { const q = document.getElementById('bbQuick'); return !!(q && q.offsetParent && q.getBoundingClientRect().width > 0) === w; }, vis, { timeout: 15000, polling: 200 }).catch(() => {});
    let dotsAt = await dotsReady();
    const shut0 = await page.evaluate(() => document.body.classList.contains('bb-collapsed'));
    if (shut0){ await page.mouse.click(dotsAt.x, dotsAt.y); await isShut(false); dotsAt = await dotsReady(); }
    await quickIs(true); const openVis = await qVis();
    await page.mouse.click(dotsAt.x, dotsAt.y); await isShut(true); await quickIs(false);
    const shutNow = await page.evaluate(() => document.body.classList.contains('bb-collapsed')), shutVis = await qVis();
    dotsAt = await dotsReady(); await page.mouse.click(dotsAt.x, dotsAt.y); await isShut(false);
    if (!openVis || !shutNow || shutVis) failures.push(`[${current}] quick buttons with the pane open ${openVis}, shut ${shutNow} and still showing ${shutVis}`);
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
    // holes saved to a text file and opened again (Oct 10: "I meant to save them to a text file" … "how does chess handle
    // this?" … "yes"): Save My holes downloads a .golf file laid out to be read; the same file, renamed and opened through
    // the field's own Open input, joins My holes and is played; opened twice it is not added twice
    const [gdl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.evaluate(() => window.getFieldApp()._debug.editor.exportMine())]);
    const golfText = await readFile(await gdl.path(), 'utf8');
    let golf = null; try { golf = JSON.parse(golfText); } catch {}
    const rowLines = golfText.split('\n').filter(l => /^\s+"[.#s~=TO]{8}",?$/.test(l)).length;
    if (!golf || golf.format !== 'minigolf' || golf.v !== 1 || !Array.isArray(golf.holes) || golf.holes.length !== st4.mine || rowLines !== 13 * st4.mine || !/\.golf$/.test(gdl.suggestedFilename()))
      failures.push(`[${current}] Save My holes: ${JSON.stringify({ name: gdl.suggestedFilename(), format: golf && golf.format, holes: golf && golf.holes && golf.holes.length, mine: st4.mine, rowLines })}`);
    else {
      const h = golf.holes[0]; h.name = 'from a file'; h.toys = [...(h.toys || []), { rock: [1.5, 6.5, 0.4] }];
      const buffer = Buffer.from(JSON.stringify({ format: 'minigolf', v: 1, holes: [h] }, null, 1));
      const openIt = async () => { await page.setInputFiles('#importImageFile', { name: 'mine.golf', mimeType: 'application/json', buffer }); await page.waitForTimeout(1500); };
      await openIt();
      const fo = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
        const g = D.games.get(f.c + '_' + f.r); return { app: A.name, mine: E.MINE.length, has: E.MINE.filter(m => m.name === 'from a file').length, playing: g && D.HOLES[g.hole].name }; });
      await openIt();
      const fo2 = await page.evaluate(() => window.getFieldApp()._debug.editor.MINE.length);
      const rd = await page.evaluate(() => { const E = window.getFieldApp()._debug.editor, one = E.MINE[0];
        return { bare: E.readHoles(JSON.stringify(one)).length, list: E.readHoles(JSON.stringify([one, one])).length, link: E.readHoles('look: ' + E.shareLink(one)).length, junk: E.readHoles('nonsense').length }; });
      if (fo.app !== 'mini golf' || fo.mine !== st4.mine + 1 || fo.has !== 1 || fo.playing !== 'from a file' || fo2 !== fo.mine || rd.bare !== 1 || rd.list !== 2 || rd.link !== 1 || rd.junk !== 0)
        failures.push(`[${current}] open holes from a file: ${JSON.stringify({ fo, fo2, rd })}`);
    }
    // My holes, one menu item and a list (Oct 10: "what is all that menu noise, ive got 50 items in the menu to various golf
    // holes?" … "yes"): the menu has no item per hole; the list plays and deletes by real clicks; a course hole edited twice
    // is one copy; exact copies kept in storage are merged when the page loads
    const mh = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onCellTap(f.c, f.r, 0.5, 0.5);
      const n0 = E.MINE.length;
      E.editStart(5); E.editAction('mat'); const k1 = E.ED.k, f1 = E.ED.src.fence; E.editStop(true);
      const n1 = E.MINE.length;
      E.editStart(5); const k2 = E.ED.k, mat = E.ED.src.fence; E.editAction('mat'); E.editStop(true);
      const n2 = E.MINE.length, items = E.editorMenu().map(i => i.label);
      return { n0, n1, n2, k1, k2, mat, f1, items, perHole: items.filter(l => /^(Play|Delete): /.test(l)).length, my: items.filter(l => /^My holes \(\d+\)/.test(l)).length }; });
    if (mh.n1 !== mh.n0 + 1 || mh.n2 !== mh.n1 || mh.k1 !== mh.k2 || mh.mat !== mh.f1 || mh.perHole || mh.my !== 1)
      failures.push(`[${current}] My holes in the menu, and one copy a hole: ${JSON.stringify(mh)}`);
    // Play in the list flies to the hole's own board (Oct 10: "my holes dialog does not let me move to the hole"): the copy
    // of hole 5 was made on the framed board; fly two boards away, open the list, press its Play, and the view is back
    const home = await page.evaluate(() => { const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), E = window.getFieldApp()._debug.editor;
      const i = E.MINE.findIndex(m => m.from && m.at && m.at[0] === f.c && m.at[1] === f.r);
      E.fly(f.c + 2, f.r + 1); return { c: f.c, r: f.r, i, name: i >= 0 ? E.MINE[i].name : null }; });
    await page.waitForTimeout(1500);
    const away = await page.evaluate(() => { const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return [f.c, f.r]; });
    await page.evaluate(() => window.getFieldApp()._debug.editor.openMineBox());
    if (home.i >= 0) await page.locator('#golfMineBox .golfMineRow').nth(home.i).getByRole('button', { name: 'Play' }).click();
    await page.waitForTimeout(1500);
    const back = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.games.get(f.c + '_' + f.r);
      return { at: [f.c, f.r], name: g && D.HOLES[g.hole].name, open: !!document.getElementById('golfMineBox') }; });
    if (home.i < 0 || (away[0] === home.c && away[1] === home.r) || back.at[0] !== home.c || back.at[1] !== home.r || back.name !== home.name || back.open)
      failures.push(`[${current}] Play flies to the hole: ${JSON.stringify({ home, away, back })}`);
    await page.evaluate(() => window.getFieldApp()._debug.editor.openMineBox());
    const rows0 = await page.locator('#golfMineBox .golfMineRow').count();
    await page.locator('#golfMineBox .golfMineRow').last().getByRole('button', { name: 'Delete' }).click();
    const rows1 = await page.locator('#golfMineBox .golfMineRow').count();
    await page.locator('#golfMineBox .golfMineRow').first().getByRole('button', { name: 'Play' }).click();
    const played = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.games.get(f.c + '_' + f.r);
      return { open: !!document.getElementById('golfMineBox'), name: g && D.HOLES[g.hole].name, first: D.editor.MINE[0].name }; });
    await page.evaluate(() => window.getFieldApp()._debug.editor.openMineBox());
    await page.keyboard.press('Escape'); const escShut = !(await page.evaluate(() => !!document.getElementById('golfMineBox')));
    await page.evaluate(() => window.getFieldApp()._debug.editor.openMineBox());
    await page.locator('#golfMineBox').getByRole('button', { name: 'Delete all' }).click();
    await page.locator('#confirmBox').getByRole('button', { name: 'Delete all' }).click();
    const left = await page.evaluate(() => window.getFieldApp()._debug.editor.MINE.length);
    if (rows0 < 2 || rows1 !== rows0 - 1 || played.open || played.name !== played.first || !escShut || left !== 0)
      failures.push(`[${current}] the My holes list: ${JSON.stringify({ rows0, rows1, played, escShut, left })}`);
    // exact copies in storage are kept once after a reload
    await page.evaluate(() => { const h = { name: 'twin', par: 3, map: Array.from({ length: 13 }, (_, j) => j === 1 ? '...O....' : j === 11 ? '...T....' : '........') };
      localStorage.setItem('golf.myholes', JSON.stringify([h, h, h, { ...h, name: 'other' }])); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.getFieldApp && window.getFieldApp() && window.getFieldApp().name === 'mini golf', null, { timeout: 60000 });
    const merged = await page.evaluate(() => ({ mine: window.getFieldApp()._debug.editor.MINE.map(m => m.name), stored: JSON.parse(localStorage.getItem('golf.myholes')).length }));
    if (merged.mine.join('|') !== 'twin|other' || merged.stored !== 2) failures.push(`[${current}] copies merged on load: ${JSON.stringify(merged)}`);
  }
  console.log(`${failures.length === before9 ? 'ok  ' : 'FAIL'} ${current}`);
  // TILT MAZE (Oct 14: "what are more games like mini-golf we could create", then "tilt maze"): every board its own maze, its
  // size by level; the steady player finishes each; its marble never goes through a wall; the real arrow key rolls the marble;
  // a hole drops it back to the start; the ring finishes it with stars and a best kept; a tap then goes on to the next board;
  // a board no one plays shows the player's run moving
  current = 'tilt maze';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'tiltmaze')); await new Promise(ok => setTimeout(ok, 3000)); });   // (no __settle: the hole editor's check before this reloads the page, which drops the helpers)
    const tm = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, out = { sizes: [], ok: 0, runs: 0, through: 0 };
      for (let lv = 1; lv <= 5; lv++){ out.sizes.push(D.makeMaze(500 + lv, lv, 0).m);
        for (let i = 0; i < 6; i++){ const L = D.makeMaze(2000 + i * 31 + lv, lv, 0), R = D.playRun(L); out.runs++; if (R.ok) out.ok++;
          // (the same player again, its cell at every step: it only ever goes to a cell its own opens onto)
          const [x0, y0] = D.centre(L, L.start), b = { x: x0, y: y0, vx: 0, vy: 0 }; let k = D.cellOf(L, b.x, b.y);
          for (let n = 0; n < 240 * 40; n++){ if (n % 4 === 0) b.tilt = D.botTilt(L, b); const ev = D.stepBall(L, b, b.tilt[0], b.tilt[1], 1 / 240), k2 = D.cellOf(L, b.x, b.y);
            if (k2 !== k && !D.nbrs(L, k).includes(k2)) out.through++; k = k2; if (ev === 'goal' || ev === 'fall') break; } } }
      const a = D.makeMaze(7, 3, 0), b2 = D.makeMaze(8, 3, 0); out.differ = a.E.join('') + a.S.join('') !== b2.E.join('') + b2.S.join('');
      return out; });
    // the real arrow key, on the framed board
    const f = await page.evaluate(() => { const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); A._debug.GAMES.clear(); A.onCellTap(f.c, f.r); const g = A._debug.gameAt(f.c, f.r); return { c: f.c, r: f.r, x: g.b.x, y: g.b.y }; });
    await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(300);
    const live = await page.evaluate(async f => { const A = window.getFieldApp(), D = A._debug, g = D.gameAt(f.c, f.r), out = { moved: Math.hypot(g.b.x - f.x, g.b.y - f.y), state: g.state, t: g.t };
      // a hole: the marble set on one drops, and is back at the start a moment later
      const L = g.M.L;
      if (L.holes.length){ g.state = 'play'; g.b = { x: L.holes[0].x, y: L.holes[0].y, vx: 0, vy: 0 }; g.last = performance.now() - 16; D.stepGame(g); out.fell = g.state === 'falling';
        for (let w = 0; w < 30 && g.state === 'falling'; w++) await new Promise(ok => setTimeout(ok, 200)); const [sx, sy] = D.centre(L, L.start);   // (the drop is 0.6 s of the game's own time, a few frames)
        out.back = Math.hypot(g.b.x - sx, g.b.y - sy) < 0.05 && g.falls === 1; }
      else { out.fell = out.back = true; }
      // the ring: through, with stars and a best kept
      const [gx, gy] = D.centre(L, L.goal); g.state = 'play'; g.b = { x: gx, y: gy, vx: 0, vy: 0 }; g.last = performance.now() - 16; D.stepGame(g);
      out.done = g.state === 'done'; out.stars = g.stars; out.best = D.BEST.has(L.idx + '@' + L.lv);
      A.onCellTap(f.c, f.r); out.next = D.LIVE && (D.LIVE.c !== f.c || D.LIVE.r !== f.r);
      // a board no one plays: the player's run, moving
      const c2 = f.c + 2, r2 = f.r + 1; D.mazeFor(c2, r2); const at = () => { const its = A.cellItems(c2, r2), m = its.find(i => i.kind === 'tmMarble'); return m ? [m.u, m.v] : null; };
      const p0 = at(); await new Promise(ok => setTimeout(ok, 700)); const p1 = at(); out.shown = !!(p0 && p1 && Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) > 1e-4);
      out.walls = A.cellItems(c2, r2).filter(i => i.kind === 'tmWall').length;
      return out; }, f);
    if (JSON.stringify(tm.sizes) !== '[5,6,7,8,10]' || tm.ok !== tm.runs || tm.through !== 0 || !tm.differ
        || !(live.moved > 0.02) || live.state !== 'play' || !(live.t > 0) || !live.fell || !live.back || !live.done || !(live.stars >= 1 && live.stars <= 3) || !live.best || !live.next || !live.shown || !(live.walls > 8))
      failures.push(`[${current}] ${JSON.stringify({ tm, live })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (${tm.ok} of ${tm.runs} mazes finished by the steady player; the arrow keys rolled it ${live.moved.toFixed(3)})`);
  }
  // HARDER FARTHER OUT (Oct 15: "games that have a difficulty setting should switch to being more difficult as the boards
  // move away from the center."): every game with a Difficulty plays each board at its own level, the setting at the
  // corner block, a step harder from ring 7 and another from ring 31. On Easy: board (0, 0) easy, (10, 0) normal, (40, 40)
  // hard; a game started at (40, 40) is really harder than one at (0, 0), by what the game's difficulty changes.
  {
    current = 'harder farther out';
    const SPEC = { checkers: 's:depth', reversi: 's:picker', gomoku: 's:picker', connectfour: 's:picker', linesofaction: 's:picker', ataxx: 's:picker',
      flow: 'n', netslide: 'n', rolltheball: 'n', unblockme: 'n', minesweeper: 'n', memory: 'n', pipes: 'n', infinityloop: 'n', pipemania: 'n', towerdefense: 'n',
      tron: 'lv', missilecommand: 'lv', asteroids: 'lv', bomberman: 'lv', invaders: 'lv', pacman: 'ghost', tetris: 'fall', tiles: 'base',
      defender: 'warn', breakout: 'speed', crossing: 'n', snake: 'n' };
    const bad = [];
    for (const [id, how] of Object.entries(SPEC)){
      const r = await page.evaluate(async ([id, how]) => {
        const A = window.FIELD_APPS.find(a => a.id === id); if (!A) return { why: 'no app' };
        window.setFieldApp(A); await new Promise(ok => setTimeout(ok, 400));
        const find = m => { for (const x of (m || [])){ if (x && typeof x.label === 'function' && /^Difficulty/.test(x.label())) return x; const y = x && find(x.items); if (y) return y; } return null; };
        const item = find(A.menu); if (!item) return { why: 'no Difficulty item' };
        const setTo = w => { for (let k = 0; k < 4 && !item.label().includes(w); k++) item.on(); return item.label().includes(w); };
        if (!setTo('easy')) return { why: 'the item never says easy: ' + item.label() };
        const label = item.label(), D = A._debug || {};
        if (typeof D.levelOf !== 'function') return { why: 'no _debug.levelOf' };
        const real = (c, r) => {
          A.onReset && A.onReset(c, r);
          if (/^(lv|ghost|fall|base|n|warn|speed)$/.test(how) && !/^(flow|netslide|rolltheball|unblockme|minesweeper|memory|pipes|infinityloop|pipemania|towerdefense)$/.test(id)) { A.onFramed && A.onFramed(c, r); A.onCellTap && A.onCellTap(c, r, 0.5, 0.5); }
          const g = D.games && D.games.get(c + '_' + r), PICK = { loose: 0, 'one-ply': 1, 'two-ply': 2 };
          if (how === 's:depth') return D.strengthOf(c, r).depth;
          if (how === 's:picker') return PICK[D.strengthOf(c, r).picker];
          if (!g) return null;
          if (how === 'n') return g.n;
          if (how === 'lv') return ['easy', 'normal', 'hard'].indexOf(g.lv);
          if (how === 'ghost') return -g.ghosts[0].T;
          if (how === 'fall') return -D.fallEvery(g);
          if (how === 'base') return g.base;
          if (how === 'warn') return -D.D(g).warn;
          if (how === 'speed') return D.speedOf(g);
        };
        const lv = [D.levelOf(0, 0), D.levelOf(10, 0), D.levelOf(40, 40)];
        const near = real(0, 0), far = real(40, 40);
        setTo('normal');
        return { label, lv, near, far };
      }, [id, how]);
      if (r.why || r.lv.join() !== 'easy,normal,hard' || !(r.far > r.near) || !/at the corner/.test(r.label)) bad.push(id + ' ' + JSON.stringify(r));
    }
    if (bad.length) failures.push('[harder farther out] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} harder farther out (${Object.keys(SPEC).length} games: the corner as set, ring 7 a step harder, ring 40 hard, a far game really harder)`);
  }
  // SIMON (Oct 15: "Are you familiar with the game called simon?", then "Yes"): every board its own sequence at a level by its
  // ring (four pads near the corner, more and quicker farther out); a round played back right goes on to the next, a wrong
  // pad ends it; real clicks on a pad reach it; a board no one plays lights its own sequence.
  {
    current = 'simon';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'simon')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      out.pads = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.seqOf(c, r).D.pads);
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      const a = D.seqOf(5, 2), b = D.seqOf(5, 2), cc = D.seqOf(6, 2);
      out.same = [0, 1, 2, 3, 4, 5].map(k => a.at(k)).join() === [0, 1, 2, 3, 4, 5].map(k => b.at(k)).join();
      out.differ = [...Array(12).keys()].map(k => a.at(k)).join() !== [...Array(12).keys()].map(k => cc.at(k)).join();
      // a game played back by the sequence itself: three rounds right, then a wrong pad
      const g = D.fresh(0, 0); D.GAMES.set('0_0', g); D.LIVE = { c: 0, r: 0 }; D.begin(g); g.t0 = performance.now() / 1000 - 999;
      const settle = () => { for (let k = 0; k < 3; k++){ D.stepGame(g, true); } };
      const rounds = [];
      for (let round = 0; round < 3; round++){
        g.state = 'show'; g.t0 = performance.now() / 1000 - 999; settle();
        rounds.push(g.state);
        for (let k = 0; k < g.n; k++) D.press(g, g.S.at(k), true);
      }
      out.afterThree = { state: g.state, score: g.score, n: g.n };
      g.state = 'show'; g.t0 = performance.now() / 1000 - 999; settle();
      D.press(g, (g.S.at(0) + 1) % g.S.D.pads, true);
      out.wrong = { state: g.state, score: g.score, miss: g.miss, want: g.S.at(0) };
      out.rounds = rounds;
      out.hub = D.padAt(g.S.D, 0.5, 0.5); out.pad0 = D.padAt(g.S.D, 0.72, 0.28); out.pad2 = D.padAt(g.S.D, 0.28, 0.72);
      return out;
    });
    const ok1 = r.pads.join() === '4,6,8,8' && r.levels.join() === '2,3,5,5' && r.same && r.differ && r.rounds.join() === 'input,input,input'
      && r.afterThree.score === 3 && r.afterThree.n === 4 && r.wrong.state === 'over' && r.wrong.score === 3 && r.wrong.miss === r.wrong.want
      && r.hub === 'hub' && r.pad0 === 0 && r.pad2 === 2;
    // real clicks: one on the framed board starts it; when it waits for us, a click on the right pad is taken
    await page.evaluate(() => window.FIELD_APPS.find(a => a.id === 'simon')._debug.fly(3, 1));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const [c, rr] = fc, key = c + '_' + rr;
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.GAMES.delete(c + '_' + r); }, fc);
      // (the point of the framed board at (u, v), projected here: the page was loaded again since the shared helpers were set,
      //  by the hole editor's check, and they went with it)
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
      const mid = await aimAt(0.5, 0.5);
      await page.mouse.click(mid.x, mid.y);
      await page.waitForTimeout(400);
      const started = await page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? g.state : null; }, key);
      // wait for the playback to end (a step is well under a second at any level)
      await page.waitForFunction(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g && g.state === 'input'; }, key, { timeout: 15000 }).catch(() => {});
      const want = await page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? { p: g.S.at(0), P: g.S.D.pads, state: g.state } : null; }, key);
      if (want && want.state === 'input'){
        const a = -Math.PI / 2 + (want.p + 0.5) * 2 * Math.PI / want.P, u = 0.5 + 0.31 * Math.cos(a), v = 0.5 + 0.31 * Math.sin(a);
        const pt = await aimAt(u, v);
        await page.mouse.click(pt.x, pt.y);
        await page.waitForTimeout(400);
      }
      const after = await page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? { state: g.state, score: g.score } : null; }, key);
      real = { started, want, after };
    }
    const ok2 = real && real.started === 'show' && real.after && real.after.score === 1 && (real.after.state === 'pause' || real.after.state === 'show');
    // (Oct 15: "the simon buttons are very hard to push") five quick real touches on one pad, as a sequence with a pad over and
    // over asks, are five presses: the field read every second one as a double-tap and the game never saw it
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const quick = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (u, v) => { const T = W.target, bW = W.boardW(), L = window.LAB || {}; const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0.02, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const tap = async (u, v, after) => { const p = S(u, v); ptr('pointerdown', p); const t = mk(p); fire('touchstart', t); ptr('pointerup', p); fire('touchend', t); await wait(after); };
      const g = D.fresh(f.c, f.r); D.GAMES.set(f.c + '_' + f.r, g); D.LIVE = { c: f.c, r: f.r };
      g.S = Object.assign({}, g.S, { at: () => 0 }); g.n = 5; g.state = 'input'; g.i = 0; g.deadline = performance.now() / 1000 + 60;
      const a = -Math.PI / 2 + Math.PI / g.S.D.pads, u = 0.5 + 0.31 * Math.cos(a), v = 0.5 + 0.31 * Math.sin(a);
      for (let k = 0; k < 5; k++) await tap(u, v, 200);
      return { score: g.score, state: g.state, corner: D.padAt(g.S.D, 0.97, 0.03) };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const ok3 = quick.score === 5 && quick.state !== 'over' && quick.corner === 0;
    if (!ok3) failures.push('[simon] quick taps on one pad: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} simon: five quick real touches on one pad are five presses (${quick.score}), a corner is its pad's`);
    // a board no one plays lights its pads in turn
    const demo = await page.evaluate(async () => { const D = window.getFieldApp()._debug, S = D.seqOf(9, 9), seen = new Set();
      for (let k = 0; k < 40; k++){ seen.add(D.shownLit(S)); await new Promise(ok => setTimeout(ok, 60)); } return seen.size; });
    if (!ok1 || !ok2 || demo < 2) failures.push('[simon] ' + JSON.stringify({ r, real, demo }));
    console.log(`${ok1 && ok2 && demo >= 2 ? 'ok  ' : 'FAIL'} simon (pads ${r.pads.join('/')} by ring, three rounds played back then a wrong pad ends it at ${r.wrong.score}; a real click on the right pad took)`);
  }
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
