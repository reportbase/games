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
    // the three dots are on every game (Oct 9: "always show the triple dots on bottom")
    const dots = await page.evaluate(() => { const h = document.getElementById('bbHandle'), r = h && h.getBoundingClientRect(); return !!(h && getComputedStyle(h).display !== 'none' && r.width > 0 && r.bottom <= innerHeight + 1); });
    if (!dots) failures.push(`[${id}] the three dots are not showing`);
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
      if (H.gen != null) continue;                           // (the course's own holes; the generated ones are checked below)
      const kinds = Object.keys(KINDS).filter(n => (H.toys || []).some(T => T[n]));
      if (!kinds.length) continue;
      let c = 0, r = 0;
      search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k && !D.games.get(c + '_' + r)) break search;
      const sig = its => its.filter(i => Object.values(KINDS).includes(i.kind)).map(i => i.kind + i.u.toFixed(4) + i.v.toFixed(4) + i.lift.toFixed(4)).join();
      const a = D.cellItems(c, r);
      let moved = false;                                     // (a gate stands up or lies down a while: give it a few seconds)
      for (let q = 0; q < 10 && !moved; q++){ await new Promise(ok => setTimeout(ok, 400)); moved = sig(D.cellItems(c, r)) !== sig(a); }
      // (an orbit may be a bumper going round, drawn as a bumper: Oct 9)
      res.push({ name: H.name, kinds, drawn: kinds.every(n => a.some(i => i.kind === KINDS[n] || (n === 'orbit' && i.kind === 'propBumper'))), moved,
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
  // is 50°, and a board small on screen is drawn with far fewer pieces: coarse ground, a plain rail, no number, no models
  const lod = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, k = D.HOLES.findIndex(H => H.name === 'the fences');
    let c = 0, r = 0; search: for (r = 0; r < 40; r++) for (c = 0; c < 40; c++) if (D.holeOf(c, r) === k) break search;
    const big = D.cellItems(c, r, 2000), small = D.cellItems(c, r, 200), kinds = its => [...new Set(its.map(i => i.kind.replace(/\d+$/, '')))];
    return { floor: window.LAB.pitchMin, appFloor: A.pitchMin, big: big.length, small: small.length, smallKinds: kinds(small), bigKinds: kinds(big) }; });
  if (lod.floor !== 50 || lod.appFloor !== 50) failures.push(`[${current}] the tilt floor is ${lod.floor} (wanted 50 for mini golf)`);
  if (!(lod.small < lod.big / 2) || !lod.smallKinds.includes('landL') || lod.smallKinds.some(k => /^(railV_|railH_|propBumper|propRock|segH|segV)/.test(k)))
    failures.push(`[${current}] a small board's pieces: ${JSON.stringify(lod)}`);
  // guards round every cup and kinds of bumper (Oct 9: "there should different types of bumpers. each board should have
  // objects that have orbits. the orbits should try to protect the golf hole."): every cup two cells in from the sides and
  // the top, all four kinds of bumper turn up, and an old bumper without a kind is read as the classic.
  // (Oct 9, later: "golf holes are sometimes completely without protection. put barriers between the golfer opening shot and
  //  the golf hole. create a variety of strategies of golf hole protection, such as elevating them or putting them on the
  //  side of a bump, etc.": over 1000 generated holes every cup has a guard, every way of keeping one turns up, boulders
  //  going round are fewer than one in twenty, and no hole leaves the straight line from the tee to the cup open)
  const gd = await page.evaluate(() => {
    const D = window.getFieldApp()._debug, E = D.editor, edge = [], kinds = new Set(), st = {}, open = [], unguarded = [];
    for (let i = 22; i < 1022; i++){ const s = D.genSrc(i), j = s.map.findIndex(r => r.includes('O')), c = s.map[j].indexOf('O');
      if (!s.guard) unguarded.push(i); else st[s.guard] = (st[s.guard] || 0) + 1;
      if (s.open) open.push(i);
      if (c < 2 || c > D.NX - 3 || j < 2) edge.push(i);
      s.toys.forEach(T => { if (T.kick) kinds.add(T.kick[3]); }); }
    const course = D.HOLES.filter(H => H.gen == null && !H.custom).length;
    const old = E.cleanSrc({ map: Array(13).fill('........'), toys: [{ kick: [2, 3, 0.3] }, { kick: [4, 5, 0.3, 2] }, { orbit: [4, 6, 1, 0.4, 6] }] });
    return { st, open: open.slice(0, 6), unguarded: unguarded.slice(0, 6), course, edge: edge.slice(0, 6), kinds: [...kinds].sort(), old: old && old.toys.filter(T => T.kick).map(T => T.kick[3]), oldOrbit: old && old.toys.find(T => T.orbit),
             tools: ['kick1', 'kick2', 'kick3', 'arm', 'swing'].every(t => E.TOOLS.some(x => x[0] === t)), cap: D.MAX_STROKES };
  });
  const STYLES = ['rocks', 'orbiters', 'sweep', 'cross', 'slide', 'gate', 'horseshoe', 'arc', 'scatter', 'apron', 'raised', 'crater', 'moat',
                  'mound', 'hillside', 'berm', 'turnstile', 'door', 'pond', 'wall', 'chicane', 'pegs'];
  if (gd.unguarded.length || gd.open.length) failures.push(`[${current}] holes left open: no guard ${gd.unguarded.join(',')}, the tee's line clear ${gd.open.join(',')}`);
  if ((gd.st.rocks || 0) > 50 || STYLES.some(k => !(gd.st[k] >= 5))) failures.push(`[${current}] the ways of keeping a cup: ${JSON.stringify(gd.st)}`);
  if (gd.edge.length) failures.push(`[${current}] cups near the edge ${gd.edge.join(',')}`);
  if (!gd.oldOrbit || gd.oldOrbit.orbit[6] !== 0 || gd.oldOrbit.orbit[5] !== 0) failures.push(`[${current}] an old orbit was not read: ${JSON.stringify(gd.oldOrbit)}`);
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
  if (tu.read !== 'arm:6,swing:6' || !(tu.arm.hit > 0 && tu.arm.vy > 0) || !(tu.swing.hit > 0 && tu.swing.vy > 0) || !tu.drawn.found || !(tu.drawn.bars >= 2) || !tu.drawn.turned)
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
      await page.mouse.click(tile.x, tile.y); await page.waitForTimeout(300);
      const inHand = await page.evaluate(() => window.getFieldApp()._debug.editor.ED.tool);
      if (inHand !== tile.tool) failures.push(`[${current}] clicking the ${tile.tool} tile left ${inHand} in hand`);
    }
    // the row stays up while painting; take up Wall (by its tile) and drag across the middle of the hole with the mouse
    await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onStatTap(f.c, f.r, E.TOOLS.findIndex(t => t[0] === '#')); });
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
    if (!st2.check || !st2.check.sunk || st2.par !== Math.max(2, Math.min(6, st2.check.strokes + 1))) failures.push(`[${current}] Check: ${JSON.stringify(st2.check)}, par ${st2.par}, "${st2.msg}"`);
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
    // the movers (Oct 9): a shuttle drawn by a drag along its track, a boulder going round placed by a tap, a gate by a tap;
    // then Redo puts back what Undo took
    const mv = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tool = t => (E.TOOLS.some(x => x[0] === t) ? A.onStatTap(f.c, f.r, E.TOOLS.findIndex(x => x[0] === t)) : (E.ED.tool = t)), act = a => (E.ACTS.some(x => x[0] === a) ? A.onStatTap(f.c, f.r, E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a)) : E.editAction(a));
      const n0 = ED.src.toys.length;
      tool('shuttle'); for (const [cx, cy] of [[1.5, 6.5], [3, 6.5], [5, 6.5]]) A.onPan(1, 1, { c: f.c, r: f.r, u: cx / D.NX, v: cy / D.NY }); A.onPanEnd();
      tool('orbit'); A.onCellTap(f.c, f.r, 4 / D.NX, 3 / D.NY);
      tool('gate'); A.onCellTap(f.c, f.r, 4 / D.NX, 10 / D.NY);
      const kinds = ED.src.toys.slice(n0).map(T => Object.keys(T)[0]), sh = (ED.src.toys.find(T => T.shuttle) || {}).shuttle;
      const items = D.cellItems(f.c, f.r).map(i => i.kind);
      act('undo'); const afterUndo = ED.src.toys.length; act('redo'); const afterRedo = ED.src.toys.length;
      return { kinds, track: sh ? +(sh[2] - sh[0]).toFixed(2) : 0, drawn: items.filter(k => /^(orbit|gate|shuttle)/.test(k)).length, n0, afterUndo, afterRedo }; });
    if (mv.kinds.join() !== 'shuttle,orbit,gate' || !(mv.track > 3) || mv.afterUndo !== mv.n0 + 2 || mv.afterRedo !== mv.n0 + 3)
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
      qbUndo = before - await page.evaluate(() => window.getFieldApp()._debug.editor.ED.src.toys.length); }
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
      tool('shuttle'); { let at = [4, 3]; search: for (let y = 2.5; y < D.NY - 1; y += 0.5) for (let x = 1; x < D.NX - 1; x += 0.5) if (!E.pickAll(x, y).some(c => c.type === 'toy' || c.type === 'T' || c.type === 'O')){ at = [x, y]; break search; } tap(at[0], at[1]); ED.pick = { type: 'toy', i: ED.src.toys.length - 1 }; } const sh = ED.src.toys[ED.pick.i].shuttle[5]; E.selAct('faster'); out.faster = ED.src.toys[ED.pick.i].shuttle[5] < sh;
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
      let c = null; search: for (let j = 3; j < D.NY - 2; j++) for (let i = 2; i < D.NX - 1; i++){ const p = E.pickAll(i, j); if (p[0] && p[0].type === 'dot' && !p.some(q => q.type !== 'dot')){ c = [i, j]; break search; } }
      if (!c) return null;
      const v = new W.THREE.Vector3(T.boardX + (0.5 - c[0] / D.NX) * bW * (L.cellW || 1), 0.02, T.boardZ + (0.5 - c[1] / D.NY) * bW * (L.cellH || 1)).project(W.camera);
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
      tool('s'); const sandStays = ED.tool; tool('select');
      ED.src.toys.splice(n0); ED.pick = null;
      return { after1, after2, gate, sandStays };
    });
    if (once.none || once.after1.tool !== 'select' || once.after1.pick !== null || once.after1.n !== 1 || once.after2.n !== 1 || once.after2.pick !== null || once.gate.tool !== 'select' || once.gate.n !== 2 || once.sandStays !== 's')
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
    // the board's Copy, Paste and Delete (Oct 10: "add copy, paste delete . the three should copy/paste/delete the complete
    // board not the object. remove the delete object button. remove the middle button that is only text."), by their tiles
    const cp = await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, ED = E.ED, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const tiles = A.statTiles(f.c, f.r) || [], names = tiles.map(t => t.value), at = a => E.TOOLS.length + E.ACTS.findIndex(x => x[0] === a);
      const textOnly = tiles.filter(t => !t.glyph).length, delObj = E.ACTS.some(x => x[0] === 'del'), first = names[0];
      const body = s => { const { name, ...rest } = s; return JSON.stringify(E.cleanSrc(rest)); };
      ED.src.toys.push({ rock: [2, 6, 0.4] }); ED.src.lift = Array.from({ length: 9 * 14 }, (_, i) => i === 40 ? 0.05 : 0);
      const name = ED.src.name, was = body(ED.src);
      A.onStatTap(f.c, f.r, at('copy'));
      A.onStatTap(f.c, f.r, at('clear')); const cleared = !ED.src.toys.length && !ED.src.land.length && !ED.src.lift && ED.src.name === name;
      A.onStatTap(f.c, f.r, at('paste')); const pasted = body(ED.src) === was && ED.src.name === name;
      A.onStatTap(f.c, f.r, at('undo')); const undone = !ED.src.toys.length;
      A.onStatTap(f.c, f.r, at('redo')); const redone = body(ED.src) === was;
      const stored = !!localStorage.getItem('golf.clip');
      return { textOnly, delObj, first, cleared, pasted, undone, redone, stored, names: names.slice(-7) }; });
    if (cp.textOnly || cp.delObj || cp.first !== 'Grass' || !cp.cleared || !cp.pasted || !cp.undone || !cp.redone || !cp.stored ||
        !['Copy', 'Paste', 'Delete'].every(n => cp.names.includes(n))) failures.push(`[${current}] copy, paste, delete the board: ${JSON.stringify(cp)}`);
    // Done (its tile): the editor's tiles go and the hole is played
    await page.evaluate(() => { const A = window.getFieldApp(), E = A._debug.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      E.editAction('done'); });   // (its tile went on Oct 10; Done is a quick button)
    const st3 = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.editor, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const g = [...D.games.values()].find(g => g.hole === E.ED.k), t = A.statTiles(f.c, f.r) || []; return { on: E.ED.on, first: t[0] && t[0].label, state: g && g.state, single: g && g.R.single }; });
    if (st3.on || st3.first !== 'Hole' || st3.state !== 'play' || !st3.single) failures.push(`[${current}] Done: ${JSON.stringify(st3)}`);
    await page.waitForFunction(() => document.querySelectorAll('#bbQuick button').length === 2, null, { timeout: 20000 }).catch(() => {});
    const qp = await page.evaluate(() => [...document.querySelectorAll('#bbQuick button')].map(b => b.title));
    if (qp.join('|') !== 'Start this hole again|Edit this hole') failures.push(`[${current}] quick buttons while playing: ${JSON.stringify(qp)}`);
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
    const dotsAt = await page.evaluate(() => { const r = document.getElementById('bbHandle').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const shut0 = await page.evaluate(() => document.body.classList.contains('bb-collapsed'));
    if (shut0){ await page.mouse.click(dotsAt.x, dotsAt.y); await page.waitForTimeout(500); }
    const openVis = await qVis();
    await page.mouse.click(dotsAt.x, dotsAt.y); await page.waitForTimeout(500);
    const shutNow = await page.evaluate(() => document.body.classList.contains('bb-collapsed')), shutVis = await qVis();
    await page.mouse.click(dotsAt.x, dotsAt.y); await page.waitForTimeout(500);
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
