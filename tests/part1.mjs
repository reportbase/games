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
import { begin, ROOT, SETTLE_MS, timeLimit } from './harness.mjs';

let current = 'page load';
const T = await begin(1, () => current);
const { base, browser, page, failures, ids } = T;

try {
  for (const id of ids){
    current = id;
    const before = failures.length;
    await page.evaluate(id => window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === id)), id);
    await page.waitForTimeout(SETTLE_MS);
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
    { await page.waitForTimeout(600);
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
      await page.mouse.up(); await page.waitForTimeout(400);
      const a1 = await at();
      await page.mouse.click(box.x, box.y + box.h * 0.9); await page.waitForTimeout(400);
      const a2 = await at();
      await page.mouse.move(640, 400); await page.keyboard.press('Space');
      await page.waitForTimeout(3500);
      const a3 = await at();
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
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
    await page.waitForTimeout(3500);
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
    await page.mouse.up(); await page.waitForTimeout(1500);
    const a1 = during[during.length - 1], ok = a1.at > a0.at && during.every((d, k) => k === 0 || d.at > during[k - 1].at) && during.some(d => d.cam !== a0.cam);
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ a0, during })}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (the clock ran ${(a1.at - a0.at).toFixed(0)} ms over the drag)`);
  }
  // HOME (Nov 7: "how about a home page, that shows all games as a board"): the page's opening app, every game one board in a block eight across, each a
  // picture (its own icon, its name along the foot), Home first in the application picker, the page opening on Home framed on the game last in, and a
  // tap on a board opening that game on its first board.
  {
    current = 'home';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'home')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = { bad: [] };
      const games = window.FIELD_APPS.filter(a => a.id !== 'home').map(a => a.id).sort(), ord = D.order();
      out.every = ord.length === games.length && JSON.stringify(ord.map(o => o.id).sort()) === JSON.stringify(games) && new Set(ord.map(o => o.title)).size === ord.length;
      // (Nov 7: "the home page should be sorted by game title": plain alphabetical, so 2048 comes before 3D Tetris; `numeric` had 3D Tetris first)
      out.sorted = ord.every((o, i) => !i || ord[i - 1].title.localeCompare(o.title, 'en', { sensitivity: 'base' }) <= 0) && ord[0].title === '2048' && ord[1].title === '3D Tetris';
      // the block (Nov 7: "arranged like photo gallary, where the pages are arranged left to right and top to bottom", then "all boards should have a game,
      // don't leave empty boards. see photo gallary."): reading across, a game once on its own board in the order the list is, and the block repeating over the
      // whole field, so no board is bare. The field numbers a board's column and row UP the screen's left and far side, so the reading place (gc across, gr down)
      // is the board (−gc, −gr) from the corner, wrapped; the block's side divides the field's, so the repeat has no seam at the wrap.
      // (Nov 8: "home page is not correct. all boards should go across both horizontally and vertically. photo gallery gets this correct.": the gallery's rule, game i
      // where −(row + col) mod N = i, folded through a signed distance from the corner, so every row and every column runs through all the games in order)
      const G = 10000, N = ord.length, at = (gc, gr) => [(G - gc % G + G) % G, (G - gr % G + G) % G], md = v => ((v % N) + N) % N;
      out.side = D.COLS === N;
      for (let gr = -70; gr < 70; gr += 3) for (let gc = -70; gc < 70; gc += 3){
        const [c, r] = at(gc, gr), id = D.idAt(c, r), want = ord[md(gr + gc)].id;
        if (id !== want && !out.slotBad) out.slotBad = [gc, gr, id, want];
      }
      const row = [], col = [];
      for (let i = 0; i < N; i++){ row.push(D.idAt(G - i, 5)); col.push(D.idAt(7, G - i)); }
      out.placed = new Set(row).size === N && new Set(col).size === N;    // (a whole row and a whole column each hold every game once)
      out.dup = row.concat(col).some(id => !id);
      for (const o of ord) if (D.slotOf(o.id).join() !== (G - o.k) % G + ',0' || D.idAt(...D.slotOf(o.id)) !== o.id) out.slotBad = o.id;
      out.wrap = D.idAt(0, 0) === ord[0].id && D.idAt(9999, 0) === ord[1].id && D.idAt(0, 9999) === ord[1].id && D.idAt(9998, 9999) === ord[3].id && D.idAt(9999, 1) === ord[0].id;
      out.names = ['airhockey', 'whackamole', 'pacman', 'blockout', 'chess'].map(id => D.titleOf(D.appById(id))).join('|');
      // the pictures: a key by game and by size, painted (the game's own board and a name), and none past the block
      const picks = ['chess', 'tetris', 'hashi', 'tiltmaze', 'pinball', 'levels', 'minigolf', 'sudoku'], pix = {};
      for (const id of picks){
        const [c, r] = D.slotOf(id), kh = A.cellPhoto(c, r, 400), kl = A.cellPhoto(c, r, 100), ch = A.photoCanvas(kh), cl = A.photoCanvas(kl);
        const px = ch.getContext('2d').getImageData(0, 0, ch.width, ch.height).data, cols = new Set(), foot = new Set();
        for (let y = 0; y < ch.height; y += 6) for (let x = 0; x < ch.width; x += 6){ const i = (y * ch.width + x) * 4, key = (px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4); cols.add(key); if (y > ch.height * 0.88) foot.add(key); }
        pix[id] = { ok: /:h$/.test(kh) && /:l$/.test(kl) && ch.width === 512 && cl.width === 256 && cols.size > 12 && foot.size > 3, colours: cols.size, foot: foot.size };
        if (!pix[id].ok) out.bad.push(id);
      }
      out.pictures = picks.length + ' ' + out.bad.length;
      // a picture is the same pixels every time it is made (the same request's "flashes"): a game's icon is drawn once and kept, so a board whose texture was
      // let go and made again, or that crossed the size where its picture goes sharper, comes back as the picture it was, even for the games whose own icon
      // shows what is happening now; the small picture is made once and kept, and Home says what the field needs to draw it without a flash
      const sig = id => { const cv = D.paint({ id }, true), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; };
      out.stable = ['pinball', 'minigolf', 'tetris', 'sudoku', 'tiltmaze', 'chess'].every(id => sig(id) === sig(id)) && D.iconOf(D.appById('pinball')) === D.iconOf(D.appById('pinball'));
      { const [c, r] = D.slotOf('hashi'), kl = A.cellPhoto(c, r, 100); out.kept = A.photoCanvas(kl) === A.photoCanvas(kl); }
      out.flags = A.photoFullAtOnce === true && A.photoUrgentPx === 0 && A.photoHolesOk === true;
      // every board has a game: a picture asked for anywhere, and a colour of its own where it is too small for one
      out.none = ['1,0', '0,1', '5000,5000', '1234,8765', '9999,9999'].every(q => { const [c, r] = q.split(',').map(Number); return A.cellPhoto(c, r, 400) !== null && A.cellPhoto(c, r, 100) !== null; })
        && new Set([0, 1, 2, 3, 4, 5, 6, 7].map(c => A.cellGrid(c, 0).colors[0])).size === 8;
      // the far field's texture is the same block: its repeat is the block's side and each of its cells the colour of the board it stands for
      { const cv = document.createElement('canvas'); cv.width = cv.height = 4; const x = cv.getContext('2d'); let bad = 0;
        for (const [i, j] of [[0, 0], [1, 0], [0, 1], [3, 5], [7, 7], [6, 2]]){
          x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4); A.fabricCellAt(x, { x: 0, y: 0, w: 4, h: 4 }, i, j);
          const d = x.getImageData(1, 1, 1, 1).data, h = A.cellGrid(i, j).colors[0];
          if (Math.abs(d[0] - (h >> 16 & 255)) > 1 || Math.abs(d[1] - (h >> 8 & 255)) > 1 || Math.abs(d[2] - (h & 255)) > 1) bad++;
        }
        out.fabric = A.fabricRepeat === D.COLS && bad === 0; }
      // the page's start: the game last in is where Home arrives, and Home is not remembered as the last game
      localStorage.setItem('tvf.field.app.v1', 'mini golf');
      D.forgetView();                              // (a first visit: no kept view, so Home arrives framed on the last game)
      out.named = window.__restoreLastApp('chess') === null;
      const got = window.__restoreLastApp(null);
      out.opened = got && got.name === 'home' && window.getFieldApp() === got && localStorage.getItem('tvf.field.app.v1') === 'mini golf' && D.LAST === null;
      out.golfSlot = D.slotOf('minigolf');
      return out;
    });
    await page.waitForTimeout(800);
    const f1 = await page.evaluate(() => { const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return f && [f.c, f.r]; });
    // the application picker: Home first, and from a game Home brings the view to the board of the game just left
    await page.evaluate(() => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'chess')); window.FIELD_APPS.find(a => a.id === 'home')._debug.forgetView(); }); await page.waitForTimeout(800);
    const pick = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms));
      document.getElementById('appBtn').click(); await wait(300);
      const rows = [...document.querySelectorAll('#appPicker .ap-row')], first = rows[0] && rows[0].textContent.trim(), n = rows.length;
      const home = rows.find(x => /^Home/.test(x.textContent.trim())); home.click(); await wait(1200);
      const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), slot = A._debug.slotOf('chess');
      return { first, n, app: A.name, f: f && [f.c, f.r], slot, apps: window.FIELD_APPS.length, thumb: !!document.querySelector('#appPicker') };
    });
    // the block as it is seen (Home framed on Chess by the picker above): the game before it in the list is on its left, the next on its right, the
    // game a row before above it and the next row's below, in the screen's own terms
    const seenAs = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, [sx, sz] = W.spacing(), T = W.target, G = 10000, ord = D.order();
      const near = (v, s, ref) => { let g = v; while (g * s - ref > G * s / 2) g -= G; while (g * s - ref < -G * s / 2) g += G; return g * s; };
      const scr = id => { const [c, r] = D.slotOf(id), p = new W.THREE.Vector3(near(c, sx, T.boardX), 0, near(r, sz, T.boardZ)).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
      const k = ord.findIndex(o => o.id === 'chess'), at = i => scr(ord[i].id), L = at(k - 1), M = at(k), R = at(k + 1);   // (the board above chess holds the game before it and the board below the game after it, as the gallery's rows and columns run)
      const [c0, r0] = D.slotOf('chess'), above = D.idAt(c0, r0 + 1), below = D.idAt(c0, r0 - 1), left = D.idAt(c0 + 1, r0), right = D.idAt(c0 - 1, r0);
      return { L, M, R, ok: L[0] < M[0] && M[0] < R[0] && Math.abs(L[1] - M[1]) < 60 && Math.abs(R[1] - M[1]) < 60 && above === ord[k - 1].id && below === ord[k + 1].id && left === ord[k - 1].id && right === ord[k + 1].id };
    });
    // and none of it a hole in the ground: with the corner framed (bare field on two sides) and while the view moves, no board counts as one the fabric must cover
    const holes = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, [c, r] = D.slotOf(D.order()[0].id); D.fly(c, r); await new Promise(ok => setTimeout(ok, 1800));
      const out = { max: 0, decl: 0 }; for (let k = 0; k < 12; k++){ const p = window.tvf.photos; out.max = Math.max(out.max, p.holes); out.decl = Math.max(out.decl, p.declined); await new Promise(ok => setTimeout(ok, 120)); }
      return out;
    });
    // a tap on a board opens that game on its first board: a real click on the framed board
    const target = 'tetris';
    await page.evaluate(id => { const D = window.getFieldApp()._debug, [c, r] = D.slotOf(id); D.fly(c, r); }, target);
    const tc = await page.evaluate(id => window.getFieldApp()._debug.slotOf(id), target);
    await page.evaluate(([c, r]) => window.__settle(c, r), tc);
    const aimOnce = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      const x = (pv.x + 1) / 2 * innerWidth, y = (1 - pv.y) / 2 * innerHeight, q = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? W.uvAt(x, y) : null;
      return { x, y, ok: !!q && Math.abs(q.u - u) < 0.03 && Math.abs(q.v - v) < 0.03 }; }, [u, v]);
    const aimAt = async (u, v) => { let p = null; for (let k = 0; k < 120; k++){ p = await aimOnce(u, v); if (p.ok){ await page.waitForTimeout(300); const p2 = await aimOnce(u, v); if (p2.ok && Math.abs(p2.x - p.x) < 1 && Math.abs(p2.y - p.y) < 1) return p2; } await page.waitForTimeout(500); } return p; };
    const pt = await aimAt(0.5, 0.45);
    await page.mouse.click(pt.x, pt.y);
    const tap = await page.evaluate(async id => { for (let k = 0; k < 60; k++){ const A = window.getFieldApp(); if (A.id === id) break; await new Promise(ok => setTimeout(ok, 100)); }
      const A = window.getFieldApp(), W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return { app: A.id, f: f && [f.c, f.r], last: localStorage.getItem('tvf.field.app.v1'), name: A.name }; }, target);
    // …and a double tap on any board does the same (the field frames it, then the game opens): the model's call, since the field's double tap is tested on its own
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'home'))); await page.waitForTimeout(600);
    const dbl = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, [c, r] = D.slotOf('sudoku'); A.startOnDouble(c, r); await new Promise(ok => setTimeout(ok, 500));
      const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return { app: window.getFieldApp().id, f: f && [f.c, f.r] }; });
    const ok = r.every && r.sorted && r.side && !r.dup && !r.slotBad && r.placed && r.wrap && r.fabric && r.names === 'Air hockey|Whack-a-mole|Pac-Man|3D Tetris|Chess' && !r.bad.length && r.none
      && r.stable && r.kept && r.flags && seenAs.ok && holes.max === 0 && holes.decl === 0
      && r.named && r.opened && f1 && f1.join() === r.golfSlot.join()
      && pick.first === 'Home' && pick.n === pick.apps && pick.app === 'home' && pick.f && pick.f.join() === pick.slot.join() && !pick.thumb
      && tap.app === 'tetris' && tap.f && tap.f.join() === '0,0' && tap.last === tap.name && dbl.app === 'sudoku' && dbl.f && dbl.f.join() === '0,0';
    if (!ok) failures.push('[home] ' + JSON.stringify({ r, f1, pick, seenAs, holes, tap, dbl }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} home: ${r.every ? 'every' : 'not every'} game, one board each in a block eight across read left to right and top to bottom, sorted by title, the block repeating over the field so no board is bare, the far field's texture the same block (${r.pictures} pictures, the same pixels each time, no board a hole), Home first in the picker and the page's start framed on the game last in, a real tap and a double tap opening a game on its first board`);
  }
  // THE HOME CHIP, AND NO DOTS WITHOUT A ROW (Nov 7: "if an applicaiton does not have a bottom browser, remove the bottom button.   Add a button for home in the upper
  // left."): a chip in the upper left on every app but Home that opens Home where it was left (position, turn, tilt and zoom, kept in localStorage), and the three dots only on apps that put something
  // in the row (a game's moves, tiles, quick buttons or prints): none on Home, Tetris, Sudoku or Hashi, some on chess, mini golf, pinball and the gallery.
  {
    current = 'home chip and dots';
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms)), vis = id => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; };
      const res = { dots: {}, chip: {} };
      for (const id of ['home', 'chess', 'tetris', 'sudoku', 'hashi', 'minigolf', 'pinball', 'gallery']){
        window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)); await wait(500);
        res.dots[id] = document.getElementById('bbHandle').style.display !== 'none'; res.chip[id] = vis('homeBtn');   // (the dots by the app's own say: an open row hides them by the sheet)
      }
      // (Nov 7: "save the position, [tilt] and rotation of home so it returns in the same position."): Home is left somewhere of its own choosing, a game opened, and
      // the chip brings it back to that place, turn, tilt and zoom, not to the board of the game left
      const H0 = window.FIELD_APPS.find(a => a.id === 'home'), W = window.FIELD_WORLD;
      window.setFieldApp(H0); await wait(600); H0._debug.forgetView();
      H0._debug.fly(9990, 3); await window.__settle(9990, 3); W.st.yaw = 25; W.st.pitch = 40; await wait(1500);
      const keys = ['camX', 'camZ', 'yaw', 'pitch', 'zoom'], was = keys.map(k => W.st[k]);
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'sudoku')); await wait(600);
      const b = document.getElementById('homeBtn').getBoundingClientRect(); res.corner = b.x < 40 && b.y < 40 && b.width >= 36;
      document.getElementById('homeBtn').click(); await wait(1500);
      const H = window.getFieldApp();
      res.was = was; res.now = keys.map(k => W.st[k]);
      res.back = H.isHome && keys.every((k, i) => Math.abs(W.st[k] - was[i]) < 1e-3 * Math.max(1, Math.abs(was[i])));
      res.kept = !!localStorage.getItem('home.view');
      return res;
    });
    const D = r.dots, C = r.chip, ok = !D.home && !D.tetris && !D.sudoku && !D.hashi && D.chess && D.minigolf && D.pinball && D.gallery && !C.home && C.chess && C.tetris && C.sudoku && C.minigolf && C.gallery && r.corner && r.back && r.kept;
    if (!ok) failures.push('[home chip] ' + JSON.stringify(r));
    console.log(`${ok ? 'ok  ' : 'FAIL'} home chip: in the upper left on every app but Home and taking the view back to the game just left; the three dots only where the app has a row (not Home, Tetris, Sudoku, Hashi)`);
  }
  // THE ONE SANS (Nov 7: "the fonts look very nice on the home page.  can you use that font in all applications?"): every place that draws words
  // names UI_SANS, the stack the page's text and Home's names are set in; no canvas or style sets its own generic sans, Arial or Helvetica Neue
  // any more. And what is drawn: while Home, the flash cards, Sudoku and Hashi are shown, every canvas font that was set is that stack.
  {
    const src = await readFile(join(ROOT, 'games.html'), 'utf8');
    const stray = (src.match(/'px (Arial, )?sans-serif'|"Helvetica Neue"|system-ui,sans-serif|BlinkMacSystemFont,Helvetica/g) || []);
    const def = (src.match(/const UI_SANS = '([^']*)'/) || [])[1] || '';
    const seen = await page.evaluate(async () => {
      const m = new Set(), d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', { configurable: true, get(){ return d.get.call(this); }, set(v){ m.add(String(v).replace(/^.*?\d+(\.\d+)?px\s*/, '')); d.set.call(this, v); } });
      // (Home's own pictures are painted by hand, so a slow frame cannot leave this with nothing to read; the apps shown after it add what they draw)
      const H = window.FIELD_APPS.find(a => a.id === 'home')._debug; for (const id of ['sudoku', 'hashi', 'flashcards']) H.paint({ id }, false);
      for (const id of ['home', 'flashcards', 'sudoku', 'hashi']){ window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)); await new Promise(ok => setTimeout(ok, 1200)); }
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', d);
      return [...m]; });
    const okF = !stray.length && /apple-system/.test(def) && /Segoe UI/.test(def) && seen.length > 0 && seen.every(f => f === def);
    if (!okF) failures.push('[one sans] ' + JSON.stringify({ stray, def, seen }));
    console.log(`${okF ? 'ok  ' : 'FAIL'} one sans: no canvas or style sets its own generic sans, and the words Home, the flash cards, Sudoku and Hashi draw are all in ${def.split(',')[0]}…`);
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'chess'))); await page.waitForTimeout(400);
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
