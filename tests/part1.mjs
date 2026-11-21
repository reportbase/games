// Smoke test, part 1 of 7: every app switched to in turn, the phone, the field resting when still, Sokoban's boards, levels by ring, chess playing on while
// the view moves, Home and its chip.
//
//   node tests/part1.mjs            this part alone (LIBS_DIR, BASE_URL, SETTLE_MS and CHROMIUM_PATH as for npm test)
//   SHARD=1/7 node tests/smoke.mjs  the same, by the runner
//   npm test                        every part, then the course test
//
// Cut from tests/smoke.mjs (12 Nov 2026) as it stood: the checks and their comments are unchanged. What every part
// needs (the server, the browser, the page loaded, the failures and how a run ends) is tests/harness.mjs.

import { devices } from 'playwright';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { begin, ROOT, SETTLE_MS, timeLimit, drawn, frame } from './harness.mjs';

let current = 'page load';
const T = await begin(1, () => current);
const { base, browser, page, failures, ids } = T;

try {
  for (const id of ids){
    current = id;
    const before = failures.length;
    await page.evaluate(id => window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === id)), id);
    await drawn(page, SETTLE_MS);
    const active = await page.evaluate(() => { const a = window.getFieldApp(); return a && (a.id || a.name); });
    if (active !== id) failures.push(`[${id}] switching did not take: the active app is ${active}`);
    // the three dots are on every game that has a row (Oct 9: "always show the triple dots on bottom"), and only there (Nov 7: "if an applicaiton does not have a bottom browser, remove the bottom button.")
    const dots = await page.evaluate(() => { const h = document.getElementById('bbHandle'), r = h && h.getBoundingClientRect(), a = window.getFieldApp(), has = !!(a.nativePieces || a._record || a.statTiles || a.statsFirst || a.quickActs || (a._list && a._list.length)), shown = !!(h && h.style.display !== 'none'); return has ? shown : !shown; });   // (the app's own say: an open row hides the dots by the sheet, in place of the file's name)
    if (!dots) failures.push(`[${id}] the three dots are showing where there is no row, or missing where there is one`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${id}`);
  }

  // The turn rail across the top is as tall as the side rails are wide (Oct 10: "the top slider for rotation should be
  // the same height as the side sliders are wide.")
  {
    const rr = await page.evaluate(() => { const g = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect() : null; };
      const y = g('yawZone'), t = g('tiltZone'), h = g('thrustZone'); return y && t && h ? { yaw: y.height, tilt: t.width, thrust: h.width } : null; });
    if (!rr || Math.abs(rr.yaw - rr.tilt) > 0.5 || Math.abs(rr.yaw - rr.thrust) > 0.5) failures.push(`[rails] top rail height vs side rail width: ${JSON.stringify(rr)}`);
    // THE TILT RAIL PACKED IN THE MIDDLE TOO, WITH A READOUT (Nov 2: "the left scroll bar for tilt should be similary compressed, add a tilt readout."):
    // a short strip centred on the left edge, and a readout that says the angle the view is tipped at.
    { const tr = await page.evaluate(() => { const e = document.getElementById('tiltZone'), r = document.getElementById('tiltRead'); if (!e || !r) return null; const b = e.getBoundingClientRect();
        return { h: b.height, mid: b.top + b.height / 2, vh: innerHeight, txt: r.textContent, pitch: window.tvf.state.pitch }; });
      if (!tr || tr.h > Math.min(241, tr.vh * 0.61) || Math.abs(tr.mid - tr.vh / 2) > 1) failures.push(`[rails] the tilt rail is not a short strip in the middle: ${JSON.stringify(tr)}`);
      else if (tr.txt !== Math.round(tr.pitch) + '\u00b0') failures.push(`[rails] the tilt readout does not say the tilt: ${JSON.stringify(tr)}`); }
    // THE TURN RAIL PACKED IN THE MIDDLE TOO (Nov 2: "the scroll bar should be similarly compressed."): a short strip centred on the screen.
    { const yr = await page.evaluate(() => { const e = document.getElementById('yawZone'); if (!e) return null; const b = e.getBoundingClientRect(); return { w: b.width, mid: b.left + b.width / 2, vw: innerWidth }; });
      if (!yr || yr.w > Math.min(241, yr.vw * 0.61) || Math.abs(yr.mid - yr.vw / 2) > 1) failures.push(`[rails] the turn rail is not a short strip in the middle: ${JSON.stringify(yr)}`); }
    // THE COMPASS'S ANGLES PACKED IN THE MIDDLE (Nov 2: "the top rotation angles should be show just in the center, not spread over the complete
    // screen. I want the angles to be tighly packed in the center."): every heading mark on show sits in the middle third of the screen.
    { await drawn(page, 600);
      const cr = await page.evaluate(() => { const els = [...document.querySelectorAll('#compass .cm')].filter(e => e.style.display !== 'none'); return { n: els.length, xs: els.map(e => parseFloat(e.style.left) / innerWidth) }; });
      if (!cr.n || cr.xs.some(x => x < 1 / 3 || x > 2 / 3)) failures.push(`[rails] compass marks not packed in the middle: ${JSON.stringify(cr)}`); }
    // THE RIGHT RAIL IS A SCROLL BAR FOR WHERE YOU ARE (Oct 25: "the right scroll bar for speed lever should be more like a normal
    // scroll bar to move the current position. it should follow the auto motion for the direction of movement."): a real drag of
    // its thumb a quarter of the rail up moves the view a quarter of the 50-board window ahead along the way of motion, and the
    // thumb is in the middle once let go; a real press on the track near the bottom moves it back; Space's auto motion
    // carries the thumb up the rail as it steps.
    {
      // (on checkers, then back to the app before it: left on checkers, whose computer players keep every board busy, the main page
      //  starved the phone's page of the checks after this and its load timed out on CI)
      const prevApp = await page.evaluate(async () => { const was = window.FIELD_APPS.indexOf(window.getFieldApp()); window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'checkers')); await new Promise(ok => setTimeout(ok, 2000)); return was; });
      const box = await page.evaluate(() => { const r = document.getElementById('thrustZone').getBoundingClientRect(), t = document.getElementById('railThumb');
        return { x: r.x + r.width / 2, y: r.y, h: r.height, ty: r.y + parseFloat(t.style.top) + parseFloat(t.style.height) / 2 }; });
      const at = () => page.evaluate(() => { const R = window.__posRail, S = window.FIELD_WORLD.st, el = document.getElementById('railThumb');
        return { s: S.camX * R.dx + S.camZ * R.dz, top: parseFloat(el.style.top), mid: (document.getElementById('thrustZone').clientHeight - parseFloat(el.style.height)) / 2,
                 board: Math.hypot(R.dx * window.FIELD_WORLD.spacing()[0], R.dz * window.FIELD_WORLD.spacing()[1]) }; });
      const a0 = await at();
      await page.mouse.move(box.x, box.ty); await page.mouse.down();
      for (let k = 1; k <= 10; k++){ await page.mouse.move(box.x, box.ty - box.h * 0.25 * k / 10); await page.waitForTimeout(30); }
      await page.mouse.up(); await drawn(page, 400);
      const a1 = await at();
      await page.mouse.click(box.x, box.y + box.h * 0.9); await drawn(page, 400);
      const a2 = await at();
      await page.mouse.move(640, 400); await page.keyboard.press('Space');
      await drawn(page, 3500);
      const a3 = await at();
      await page.keyboard.press('Escape'); await drawn(page, 300);
      await page.evaluate(async i => { if (i >= 0) window.setFieldApp(window.FIELD_APPS[i]); await new Promise(ok => setTimeout(ok, 1500)); }, prevApp);
      const ahead = (a1.s - a0.s) / a1.board, back = (a2.s - a1.s) / a1.board;
      if (!(ahead > 11 && ahead < 14) || Math.abs(a1.top - a1.mid) > 3 || !(Math.abs(back) < 0.5) || !(a3.top < a2.top - 3))
        failures.push(`[position rail] ${JSON.stringify({ a0, a1, a2, a3, ahead, back })}`);
      else console.log(`ok   position rail: a real drag of the thumb a quarter up moved ${ahead.toFixed(1)} boards ahead, a press low on the track (a tap: Oct 31) moved ${back.toFixed(2)} boards, and auto motion carried the thumb up ${(a2.top - a3.top).toFixed(0)} px`);
    }
  }

  // BIGGER ON A TOUCH SCREEN (Oct 17: "why is the button and menu so small in mobile, but not desktop.", then "yes"): with a
  // mouse the menu button stays 40 px and the menu's rows 11 px words; on a phone (a context with a finger for a pointer)
  // the button is 48 px, the rows at least 44 px tall with 15 px words, and the menu opens below the bigger button.
  {
    const sizes = p => p.evaluate(() => { const b = document.getElementById('menuBtn').getBoundingClientRect(), m = document.getElementById('menu');
      const was = m.hidden; m.hidden = false; const i = m.querySelector('button'), ir = i.getBoundingClientRect(), mr = m.getBoundingClientRect();
      const out = { btn: Math.round(b.height), row: Math.round(ir.height), font: getComputedStyle(i).fontSize, below: mr.top >= b.bottom, inside: mr.left >= 0 && mr.right <= innerWidth };
      m.hidden = was; return out; });
    const desk = await sizes(page);
    if (desk.btn !== 40 || desk.font !== '11px') failures.push(`[touch sizes] with a mouse the menu changed: ${JSON.stringify(desk)}`);
    const ctx = await browser.newContext(devices['iPhone 14']), phone = await ctx.newPage(); await timeLimit(phone);
    if (process.env.LIBS_DIR){
      const lib = f => readFile(join(process.env.LIBS_DIR, f));
      await phone.route(/three\.module\.min\.js/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('three/build/three.module.js') }));
      await phone.route(/chess\.js@1\.4\.0/, async r => r.fulfill({ contentType: 'text/javascript', body: await lib('chess.js/dist/esm/chess.js') }));
    }
    phone.on('pageerror', e => failures.push(`[touch sizes, phone] ${e.message}`));
    await phone.goto(new URL('games.html?app=checkers', base).href, { waitUntil: 'load' });
    await phone.waitForFunction(() => document.querySelector('#menu button'), null, { timeout: 60000 });
    const mob = await sizes(phone);
    await ctx.close();
    if (mob.btn !== 48 || mob.row < 44 || mob.font !== '15px' || !mob.below || !mob.inside) failures.push(`[touch sizes] on a phone: ${JSON.stringify(mob)} (want a 48 px button, rows of 44 px or more with 15 px words, the menu below it and on the screen)`);
    else console.log(`ok   touch sizes: a mouse keeps the 40 px button and 11 px menu; a phone gets ${mob.btn} px and ${mob.row} px rows of ${mob.font}`);
  }

  // THE SYSTEM'S TEXT SIZE (Oct 24: "font size is way to small. its not respecting system font size."): every size of text is in
  // rem, so the root's size, which the browser's and the phone's text size set, carries it: at 150% the menu's words, the menu
  // button's glyph and a notice are half again as big; and no text is left in pixels in the page's own styles.
  {
    const fs = await page.evaluate(async () => { const px = sel => { const e = document.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
      const take = () => ({ menu: px('#menu button'), btn: px('#menuBtn') });
      const a = take(); document.documentElement.style.fontSize = '150%'; await new Promise(ok => setTimeout(ok, 100)); const b = take(); document.documentElement.style.fontSize = '';
      let left = 0; for (const sh of document.styleSheets){ let rules; try { rules = sh.cssRules; } catch { continue; } for (const r of rules) if (r.style && /px/.test(r.style.fontSize || '')) left++; }
      return { a, b, left };
    });
    if (!(Math.abs(fs.b.menu / fs.a.menu - 1.5) < 0.01 && Math.abs(fs.b.btn / fs.a.btn - 1.5) < 0.01 && fs.left === 0)) failures.push(`[system text size] ${JSON.stringify(fs)}`);
    else console.log(`ok   system text size: at 150% the menu's words ${fs.a.menu} → ${fs.b.menu} px, the button's ${fs.a.btn} → ${fs.b.btn} px; no text in px`);
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
  // forward solve finds the same par, each board's demo ends solved, and a solved board's tap plays it again where it is (Oct 29: only you move to another board)
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
    // the Difficulty moves every dealt board a level; a solved board's tap starts it again and the view stays
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
      const f2 = W.cellAt(W.target.boardX, W.target.boardZ), g2 = D.games.get(f.c + '_' + f.r);
      return { a, b, solved, from: f, to: f2, again: !!g2 && !g2.solved };
    });
    if (sk2.b !== Math.min(5, sk2.a + 1) && !(sk2.a === 5 && sk2.b === 5) || !sk2.solved || !sk2.again || !sk2.to || sk2.to.c !== sk2.from.c || sk2.to.r !== sk2.from.r)
      failures.push(`[${current}] difficulty and playing it again: ${JSON.stringify(sk2)}`);
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
    await drawn(page, 3500);
    const L1 = await look();
    /* (Oct 17: "Let's create a new lab that recovers 3d shapes" … "in levels application"; wander plans/rsh-plan.md) One reader at a
       body's centre reads the sweep's own directions, the same for every body, the census a unit sphere; three readers inside,
       directions only, place every point exactly in |AB|, and scaling the world moves nothing; Recover on, a tap shows the clouds */
    const rec = await page.evaluate(() => { const D = window.getFieldApp()._debug, a = D.recover(0), b = D.recover(7), k = D.recover(7, 1e3);
      let cross = 0, kk = 0; for (let i = 0; i < a.N; i++) for (let j = 0; j < 3; j++){ cross = Math.max(cross, Math.abs(a.reads[i][j] - b.reads[i][j])); if (k.rec[i] && b.rec[i]) kk = Math.max(kk, Math.abs(k.rec[i][j] - b.rec[i][j])); }
      const L = D.list[0], [c, r] = L.key.split('_').map(Number); D.recoverOn = true; window.getFieldApp().onCellTap(c, r);
      const G = D.recoverGroup, shown = !!(G && G.parent && G.children.length === 4); D.recoverOn = false;
      return { rd: Math.max(a.rdErr, b.rdErr), cross, vh: a.vh, both: a.both, rec: Math.max(a.recErr, b.recErr), fewest: Math.min(a.fewest, b.fewest), kk, shown }; });
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
        || !(hd.leaves.near2 <= hd.leaves.near0 && hd.leaves.near0 <= hd.leaves.near1 && hd.leaves.near2 < hd.leaves.near1) || !hd.plain
        || rec.rd > 1e-12 || rec.cross > 1e-12 || Math.abs(rec.vh - 0.5) > 0.01 || Math.abs(rec.both - 1 / 3) > 0.01 || rec.rec > 1e-9 || rec.fewest < 2 || rec.kk > 1e-9 || !rec.shown)
      failures.push(`[${current}] ${JSON.stringify({ L0, lv, L1, far, tiles, pitch0, pitch1, own, floor1, hd, rec })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (H near/far grains ${hd.small.near}/${hd.small.far}, ${hd.mid.near}/${hd.mid.far}, ${hd.large.near}/${hd.large.far}; by v/h: ${L0.boards} boards in ${L0.levels} levels, ${L0.tris} triangles; climbed: ${L1.boards} boards, ${L1.tris}; at 6°: ${far.bodies} bodies; None at the opening view: ${tiles.none}; recovered from directions to ${rec.rec.toExponential(0)})`);
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
    await page.mouse.up(); await drawn(page, 1500);
    const a1 = during[during.length - 1], ok = a1.at > a0.at && during.every((d, k) => k === 0 || d.at > during[k - 1].at) && during.some(d => d.cam !== a0.cam);
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ a0, during })}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (the clock ran ${(a1.at - a0.at).toFixed(0)} ms over the drag)`);
  }
  // NO HOME, AND A CLICK SELECTS (Nov 21: "1) remove the home page with all the applications and the home button. 2) single click should select a board
  // but not move to that board.   clicking a selected board sets it as the default board in the center.    remove the double click hander to change the
  // default board."): no app is Home and no chip stands in the corner, the page reopens the game last in, and the dots show only where a row has something;
  // a real click on another board selects it with the view unmoved, a click on a third moves the selection, and a click on the selected board frames it.
  {
    current = 'no home, a click selects';
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms)), res = { dots: {} };
      res.none = !window.FIELD_APPS.some(a => a.id === 'home' || a.isHome) && !document.getElementById('homeBtn');
      document.getElementById('appBtn').click(); await wait(300);
      const rows = [...document.querySelectorAll('#appPicker .ap-row')]; res.rows = rows.length; res.apps = window.FIELD_APPS.length; res.first = rows[0] ? rows[0].textContent.trim() : '';
      document.getElementById('appBtn').click(); await wait(200);
      for (const id of ['chess', 'tetris', 'sudoku', 'hashi', 'minigolf', 'pinball', 'gallery']){
        window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)); await wait(500);
        res.dots[id] = document.getElementById('bbHandle').style.display !== 'none';
      }
      // the page reopens the game last in
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'checkers')); await wait(300);
      const name = window.getFieldApp().name;
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'chess')); await wait(300);
      localStorage.setItem('tvf.field.app.v1', name);
      res.named = window.__restoreLastApp('chess') === null && window.getFieldApp().id === 'chess';
      const got = window.__restoreLastApp(null); res.reopened = !!got && got.id === 'checkers' && window.getFieldApp() === got;
      return res;
    });
    await drawn(page, 800);
    await page.evaluate(() => { const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return window.__settle(f.c, f.r); });
    const where = () => page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, [sx, sz] = W.spacing(), P = window.__picked();
      return { f: [Math.round(T.boardX / sx), Math.round(T.boardZ / sz)], cam: [W.st.camX, W.st.camZ, W.st.zoom].map(v => +v.toFixed(4)).join(), pick: P && [P.gx, P.gz] }; });
    const scr = (dc, dr) => page.evaluate(([dc, dr]) => { const W = window.FIELD_WORLD, T = W.target, [sx, sz] = W.spacing();
      const p = new W.THREE.Vector3(T.boardX + dc * sx, 0, T.boardZ + dr * sz).project(W.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, [dc, dr]);
    const w0 = await where();
    const pa = await scr(0.72, 0), pb = await scr(-0.72, 0);        // (on the neighbours' near sides: their middles are off the screen at the default fit)
    await page.mouse.click(pa.x, pa.y); await drawn(page, 700);
    const w1 = await where();                                      // (selected where it stands)
    await page.mouse.click(pb.x, pb.y); await drawn(page, 700);
    const w2 = await where();                                      // (the selection moved)
    await page.mouse.click(pb.x, pb.y); await drawn(page, 400);
    await page.evaluate(() => window.__settle());
    const w3 = await where();                                      // (brought in)
    const D = r.dots, ok = r.none && r.rows === r.apps && !/^Home/.test(r.first) && !D.tetris && !D.sudoku && !D.hashi && D.chess && D.minigolf && D.pinball && D.gallery
      && r.named && r.reopened
      && w1.pick && w1.pick.join() === [w0.f[0] + 1, w0.f[1]].join() && w1.f.join() === w0.f.join() && w1.cam === w0.cam
      && w2.pick && w2.pick.join() === [w0.f[0] - 1, w0.f[1]].join() && w2.f.join() === w0.f.join() && w2.cam === w0.cam
      && !w3.pick && w3.f.join() === [w0.f[0] - 1, w0.f[1]].join();
    if (!ok) failures.push('[no home, a click selects] ' + JSON.stringify({ r, w0, w1, w2, w3 }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} no Home (${r.rows} apps in the picker, the first ${r.first}; the last game reopened), a click selects ${JSON.stringify(w1.pick)} then ${JSON.stringify(w2.pick)} with the view unmoved, and a click on the selected board brings it in (${JSON.stringify(w3.f)})`);
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'chess'))); await drawn(page, 400);
  }
  // THE ONE SANS (Nov 7: "the fonts look very nice on the home page.  can you use that font in all applications?"): every place that draws words
  // names UI_SANS, the stack the page's text and Home's names are set in; no canvas or style sets its own generic sans, Arial or Helvetica Neue
  // any more. And what is drawn: while the flash cards, Sudoku and Hashi are shown, every canvas font that was set is that stack.
  {
    const src = await readFile(join(ROOT, 'games.html'), 'utf8');
    const stray = (src.match(/'px (Arial, )?sans-serif'|"Helvetica Neue"|system-ui,sans-serif|BlinkMacSystemFont,Helvetica/g) || []);
    const def = (src.match(/const UI_SANS = '([^']*)'/) || [])[1] || '';
    const seen = await page.evaluate(async () => {
      const m = new Set(), d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', { configurable: true, get(){ return d.get.call(this); }, set(v){ m.add(String(v).replace(/^.*?\d+(\.\d+)?px\s*/, '')); d.set.call(this, v); } });
      // (a letter's picture is painted by hand, so a slow frame cannot leave this with nothing to read; the apps shown after it add what they draw)
      try { const T = window.__boardType; T.geo(window.FIELD_WORLD.THREE, 'Q'); T.width('Qq7', 1); } catch {}
      for (const id of ['flashcards', 'sudoku', 'hashi']){ window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)); await new Promise(ok => setTimeout(ok, 1200)); }
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', d);
      return [...m]; });
    const okF = !stray.length && /apple-system/.test(def) && /Segoe UI/.test(def) && seen.length > 0 && seen.every(f => f === def);
    if (!okF) failures.push('[one sans] ' + JSON.stringify({ stray, def, seen }));
    console.log(`${okF ? 'ok  ' : 'FAIL'} one sans: no canvas or style sets its own generic sans, and the words the flash cards, Sudoku and Hashi draw are all in ${def.split(',')[0]}…`);
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'chess'))); await drawn(page, 400);
  }
  // THE LETTERS (Nov 7: "why cant you use the same font from home page on mini-golf and elsewhere?"): a board's numbers and words are BOARD_KIT.type's
  // letters, each a quad wearing its glyph in that font. Every digit's ink, read back from the picture it wears, is centred in its slot (the lone 1
  // the old segments sat at the right edge of) and about 0.8 of a digit's height, narrower than its slot; a line lays them 0.62 apart; the pieces are
  // see-through; and the games that had segments now ask for letters (Sudoku's squares and mini golf's plate are read in their own checks).
  {
    const r = await page.evaluate(() => { const T = window.__boardType, THREE = window.FIELD_WORLD.THREE, out = { off: [], cap: [], wide: [], kinds: [] };
      for (const ch of '0123456789'){ const g = T.geo(THREE, ch), cv = g.userData.map.image, w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
        let lo = w, hi = -1, top = h, bot = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40){ lo = Math.min(lo, x); hi = Math.max(hi, x); top = Math.min(top, y); bot = Math.max(bot, y); }
        out.off.push(Math.abs(((lo + hi) / 2 - (w - 1) / 2) / 160)); out.cap.push((bot - top + 1) / 160); out.wide.push((hi - lo + 1) / 160);
        out.glyph = out.glyph !== false && !!g.userData.glyph && !!g.userData.unlit && g.attributes.uv.count === 6; }
      const row = []; T.put(row, '10', { u: 0.5, v: 0.5, h: 0.1, color: 0xffffff, align: 'center' });
      out.kinds = row.map(i => i.kind).join(); out.pitch = +(row[1].u - row[0].u).toFixed(4); out.width = +T.width('10', 0.1).toFixed(4); out.mid = +((row[0].u + row[1].u) / 2).toFixed(4);
      return out; });
    const okL = Math.max(...r.off) < 0.012 && r.cap.every(c => c > 0.6 && c < 0.9) && r.wide.every(w => w < 0.58) && r.glyph && r.kinds === 'tg49,tg48' && r.pitch === 0.062 && r.width === 0.124 && r.mid === 0.5;
    if (!okL) failures.push('[letters] ' + JSON.stringify(r));
    console.log(`${okL ? 'ok  ' : 'FAIL'} letters: every digit's ink centred in its slot (off by ${Math.max(...r.off).toFixed(3)} of a digit at most), ${Math.min(...r.cap).toFixed(2)}–${Math.max(...r.cap).toFixed(2)} tall and under ${Math.max(...r.wide).toFixed(2)} wide, laid ${r.pitch} apart at height 0.1`);
  }
} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
