// Smoke test, part 4 of 7: pinball, harder farther out, Simon, the memory slider, Snake's sides, 3D Tetris, Soma, Lights Out, Whack-a-mole, Pong, air
// hockey, squash, Nonograms and the flash cards.
//
//   node tests/part4.mjs            this part alone (LIBS_DIR, BASE_URL, SETTLE_MS and CHROMIUM_PATH as for npm test)
//   SHARD=4/7 node tests/smoke.mjs  the same, by the runner
//   npm test                        every part, then the course test
//
// Cut from tests/smoke.mjs (12 Nov 2026) as it stood: the checks and their comments are unchanged. What every part
// needs (the server, the browser, the page loaded, the failures and how a run ends) is tests/harness.mjs.

import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { begin, ROOT } from './harness.mjs';

let current = 'page load';
const T = await begin(4, () => current);
const { page, failures, cdp } = T;

try {
  // PINBALL (Oct 24: "how about pinball"): every board its own table at a level by its ring; the ball launched up the lane and
  // through the gate, never back down it; the ball never out of the cabinet in the steady player's games; a flipper's swing
  // throwing the ball, a bumper's kick, a drop bank down with the multiplier up, a lane lit and moved along by a flipper, the
  // ball save, the kickback, a tilt; par from the steady player, higher near the corner than far out; real input (a click
  // starting, the real Down launching, the real arrow flipping, real touches on each half and both, the tap that starts not
  // launching); game over with stars and a best, a click playing it again; a board no one plays moving; the pieces drawn.
  current = 'pinball';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'pinball')); await new Promise(ok => setTimeout(ok, 2500)); });
    const pb = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, K = D.consts, out = {};
      out.levels = [[0, 0], [10, 0], [40, 40]].map(([c, r]) => D.levelAt(D.boardIdx(c, r)));
      const key = T => JSON.stringify(T.segs.map(s => [s.a, s.b, s.kind]).concat(T.circs.map(c => [c.x, c.y, c.kind])));
      out.same = key(D.makeTable(77, 3)) === key(D.makeTable(77, 3)); out.differ = key(D.makeTable(77, 3)) !== key(D.makeTable(78, 3));
      out.dials = [1, 5].map(lv => { const T = D.makeTable(9, lv); return { g: T.g, fl: T.fl[0].len, save: T.D.save, kb: T.D.kb.join('') }; });
      const run = (T, S, sec, fn) => { for (let k = 0; k < sec / K.SUB; k++){ if (fn) fn(S); const e = D.sub(T, S, K.SUB); if (e) return e; } return null; };
      // the launch: up the lane, through the gate, into the playfield; it does not come back down the lane
      { const T = D.makeTable(5, 1), S = D.newState(T, true); D.toPlunger(S); S.pull = 1; D.launch(S, T);
        let inField = false, back = false;
        run(T, S, 4, S => { if (S.b.x < K.PW - 0.02 && S.b.y < 0.5) inField = true; if (inField && S.b.x > K.PW + 0.005 && S.b.y > 0.35) back = true; });
        out.launch = { inField, back }; }
      // the steady player's games: the ball never out of the cabinet
      { let esc = 0, steps = 0;
        for (const [idx, lv] of [[11, 1], [12, 3], [13, 5]]){ const T = D.makeTable(idx, lv), S = D.newState(T, true), B = D.botNew(idx); D.toPlunger(S);
          for (let k = 0; k < 40 / K.SUB; k++){ D.botStep(T, S, B, K.SUB); const e = D.sub(T, S, K.SUB); steps++;
            if (S.b && (S.b.x < -0.005 || S.b.x > K.W + 0.005 || S.b.y < -0.005)) esc++;
            if (e === 'drain') D.toPlunger(S); } }
        out.escapes = esc; out.steps = steps; }
      // a flipper's swing throws a ball resting on it
      { const T = D.makeTable(5, 1), S = D.newState(T, true), f = T.fl[0], c = Math.cos(f.rest), s = Math.sin(f.rest);
        S.b = { x: f.px + c * f.len * 0.6 + s * (K.R + 0.011), y: f.py + s * f.len * 0.6 - c * (K.R + 0.011), vx: 0, vy: 0 };
        D.setFlipper(S, 0, true); let vy = 0; run(T, S, 0.06, S => { vy = Math.min(vy, S.b.vy); }); out.flip = vy; }
      // (an era of its own: the first table near a number with the parts a check wants)
      const tableWith = (from, lv, ok) => { for (let i = from; i < from + 400; i++){ const T = D.makeTable(i, lv); if (ok(T)) return T; } return null; };
      // a bumper kicks the ball out faster than it came (not wood rail's passive ones)
      { const T = tableWith(5, 1, T => T.era.id !== 'wood' && !T.magnet && !T.mbank && !T.captive), S = D.newState(T, true), B = T.bumpers[0];
        S.b = { x: B.x - 0.06, y: B.y, vx: 0.5, vy: 0 }; T.g = 0; let after = 0; run(T, S, 0.25, S => { after = Math.hypot(S.b.vx, S.b.vy); }); T.g = T.D.g;
        out.bumper = { after, score: S.score }; }
      // the drop targets: each down by a hit, the bank down: 5000 and the multiplier up; up again after a moment
      { const T = tableWith(6, 2, T => T.drops.length >= 3), S = D.newState(T, true);
        for (const t of T.drops){ const mx = (t.a[0] + t.b[0]) / 2, my = (t.a[1] + t.b[1]) / 2, nx = t.ex ? 0 : (t.nx || 1), ny = t.ex ? 1 : 0;
          S.b = { x: mx + nx * 0.03, y: my + ny * 0.03, vx: -nx * 1.2, vy: -ny * 1.2 }; T.g = 0; run(T, S, 0.05); }
        T.g = T.D.g; out.drops = { down: S.drops.reduce((a, x) => a + x, 0), n: T.drops.length, mult: S.mult, score: S.score };
        S.b = null; run(T, S, 1.2); out.drops.reset = S.drops.reduce((a, x) => a + x, 0); }
      // a lane rolled through lights; a flipper press moves the lit lanes along
      { const T = D.makeTable(5, 1), S = D.newState(T, true), L = T.lanes[0];
        S.b = { x: L.x, y: L.y - 0.03, vx: 0, vy: 0.6 }; T.g = 0; run(T, S, 0.1); T.g = T.D.g;
        const lit = Array.from(S.lanes).join(''); D.setFlipper(S, 1, true); out.lanes = { lit, moved: Array.from(S.lanes).join('') }; }
      // the ball save at level 1, none at level 5; the kickback at level 1; three nudges tilt
      { const g = D.fresh(0, 0); D.GAMES.set('0_0', g); D.LIVE = { c: 0, r: 0 }; D.begin(g); const S = g.S, T = g.M.T;
        S.onPl = false; S.launchT = S.t; S.b = { x: K.XC, y: 1.03, vx: 0, vy: 1 }; g.last = performance.now() - 30; D.stepGame(g);
        out.save = { onPl: S.onPl, balls: g.balls, want: T.balls, lv: T.lv };
        const O = T.outs[0]; S.onPl = false; S.b = { x: (O.x0 + O.x1) / 2, y: O.y + 0.02, vx: 0, vy: 1 }; S.kb = [1, 1]; D.sub(T, S, K.SUB); D.sub(T, S, K.SUB);
        out.kick = { vy: S.b.vy, lit: S.kb.join('') };
        S.b = { x: K.XC, y: 0.5, vx: 0, vy: 0 }; S.onPl = false; D.nudge(g); D.nudge(g); D.nudge(g); D.setFlipper(S, 0, true); D.sub(T, S, K.SUB);
        out.tilt = { tilt: S.tilt, flipperDown: Math.abs(S.fl[0].phi - T.fl[0].rest) < 0.05 };
        const T5 = D.makeTable(13, 5); out.save5 = T5.D.save; D.GAMES.delete('0_0'); }
      // the board's pieces: two flippers (never a yaw of 0), the bumpers, the ball, the lamps; and its picture
      { const M = D.readyNow(D.tableFor(3, 0)), V = D.viewOf(M, null), its = D.itemsOf(V), n = k => its.filter(i => i.kind === k).length;
        out.drawn = { flippers: n('pbFlipper') - M.T.fl.length + 2, bumpers: n('pbBumper'), wantB: M.T.bumpers.length, lamps: n('pbLamp'), zeroYaw: its.filter(i => i.kind === 'pbFlipper' && !i.yaw).length };
        const cv = D.paint(M.T, 512); out.picture = cv ? [cv.width, cv.height] : null; }
      return out;
    });
    const pbOk = pb.levels.join() === '2,3,5' && pb.same && pb.differ && pb.dials[0].g < pb.dials[1].g && pb.dials[0].fl > pb.dials[1].fl && pb.dials[0].save > 0 && pb.dials[1].save === 0
      && pb.dials[0].kb === '11' && pb.dials[1].kb === '00' && pb.launch.inField && !pb.launch.back && pb.escapes === 0 && pb.flip < -1.5 && pb.bumper.after > 0.9 && pb.bumper.score >= 100
      && pb.drops.down === pb.drops.n && pb.drops.mult === 2 && pb.drops.score >= 5000 + 500 * pb.drops.n && pb.drops.reset === 0 && pb.lanes.lit[0] === '1' && pb.lanes.moved !== pb.lanes.lit
      && pb.save.onPl && pb.save.balls === pb.save.want && pb.kick.vy < -1 && pb.kick.lit === '01' && pb.tilt.tilt && pb.tilt.flipperDown && pb.save5 === 0
      && pb.drawn.flippers === 2 && pb.drawn.bumpers === pb.drawn.wantB && pb.drawn.lamps > 6 && !pb.drawn.zeroYaw && pb.picture && Math.abs(pb.picture[0] / pb.picture[1] - 0.56) < 0.01;
    if (!pbOk) failures.push(`[${current}] the tables and the ball: ${JSON.stringify(pb)}`);
    // par from the steady player: near the corner higher than far out
    const par = await page.evaluate(() => { const D = window.getFieldApp()._debug, mean = lv => { let s = 0; for (let i = 0; i < 4; i++){ const M = { T: D.makeTable(300 + i, lv), idx: 300 + i, lv }; D.finishJob(M); s += M.par; } return s / 4; };
      return { near: mean(1), far: mean(5) }; });
    if (!(par.near > par.far && par.far >= 1000)) failures.push(`[${current}] par by level: ${JSON.stringify(par)}`);
    // real input on the framed board
    const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
    const state = () => page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.gameAt(f.c, f.r);
      return { st: g.state, onPl: g.S.onPl, by: g.S.b ? g.S.b.y : null, fl: g.S.fl.map(F => F.on), score: g.S.score, balls: g.balls, c: f.c, r: f.r }; });
    await page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); D.GAMES.delete(f.c + '_' + f.r); });
    const mid = await aimAt(0.5, 0.5), left = await aimAt(0.25, 0.8), right = await aimAt(0.75, 0.8);
    await page.mouse.click(mid.x, mid.y); await page.waitForTimeout(500);
    const s0 = await state();
    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(700); await page.keyboard.up('ArrowDown'); await page.waitForTimeout(400);
    // (the game steps as its board is drawn, and a slow frame on CI left the ball launched but not yet moved at 400 ms: wait for it)
    // (and in a part of its own the page is fresh, every board's table still being made, and a frame can take seconds: up to 15 s)
    for (let k = 0; k < 75; k++){ const q = await state(); if (q.by == null || (!q.onPl && q.by < 0.9)) break; await page.waitForTimeout(200); }
    const s1 = await state();
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(200); const s2 = await state(); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(150);
    const s3 = await state();
    // (touches: each half its flipper, both at once; and the view stays where it was)
    const z0 = await page.evaluate(() => window.FIELD_WORLD.st.zoom);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: left.x, y: left.y, id: 1 }] }); await page.waitForTimeout(200); const t1 = await state();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: left.x, y: left.y, id: 1 }, { x: right.x, y: right.y, id: 2 }] }); await page.waitForTimeout(200); const t2 = await state();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200); const t3 = await state();
    const z1 = await page.evaluate(() => window.FIELD_WORLD.st.zoom);
    // (a new game by a real tap: the ball waits on the plunger, the tap's echo as a mouse press not launching it)
    await page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); D.gameAt(f.c, f.r).state = 'over'; D.gameAt(f.c, f.r).overAt = 0; D.GAMES.delete(f.c + '_' + f.r); });
    // (Nov 9: aimed afresh, not at the point worked out before the touches: on CI the view had moved and the tap missed the board, the game never began)
    const mid2 = await aimAt(0.5, 0.5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mid2.x, y: mid2.y, id: 3 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // (the field reads the tap and the game begins as a frame is drawn; on CI a frame took more than the 600 ms this waited: wait for it)
    // (and in a part of its own, on a fresh page, longer still; a tap that only reframed the board is tapped again)
    await page.waitForTimeout(600); for (let k = 0; k < 60; k++){ const q = await state(); if (q.st === 'play') break; await page.waitForTimeout(250);
      if (k > 0 && k % 8 === 0){ const m3 = await aimAt(0.5, 0.5); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: m3.x, y: m3.y, id: 4 + k }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } }
    const t4 = await state();
    // game over: stars and a best; a click after it plays the table again where it is (Oct 29: only you move to another board)
    const ov = await page.evaluate(async () => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.gameAt(f.c, f.r);
      g.balls = 1; g.S.score = 123450; g.S.onPl = false; g.S.launchT = -99; g.S.b = { x: 0.26, y: 1.05, vx: 0, vy: 1 }; g.last = performance.now() - 30; D.stepGame(g);
      // (CI once found the game over with its stars and the best not under this board's key, and said nothing more: the key and what the map held are kept in the failure)
      const key = g.M.mine ? 'm' + g.M.hash : g.M.idx + '@' + g.M.lv;
      return { st: g.state, stars: g.stars, best: D.BEST.get(key), par: g.M.par, key, mine: !!g.M.mine, held: [...D.BEST].slice(-4) }; });
    await page.waitForTimeout(1000);
    const bx0 = await page.evaluate(() => window.FIELD_WORLD.target.boardX);
    await page.mouse.click(mid.x, mid.y); await page.waitForTimeout(600);
    const nx = await page.evaluate(bx0 => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD;
      return { ...D.LIVE, flew: Math.abs(W.target.boardX - bx0) / W.spacing()[0], st: D.LIVE ? D.gameAt(D.LIVE.c, D.LIVE.r).state : null }; }, bx0);
    // a board no one plays: its recording moves on the page's clock
    const idle = await page.evaluate(async () => { const D = window.getFieldApp()._debug, M = D.tableFor(4, 4); D.finishJob(M);
      // (looked at for up to 3.5 s: a recording rests 2 s at the end of its loop, and holds still while a ball sits in the saucer
      //  or waits on the plunger, so 700 ms alone could fall wholly in one, as it did on CI once recordings began before a mission)
      let moved = false;
      for (let k = 0; k < 5 && !moved; k++){ const a = D.viewOf(M, null); await new Promise(ok => setTimeout(ok, 700)); const b = D.viewOf(M, null);
        moved = !!(a.b && b.b && Math.hypot(a.b.x - b.b.x, a.b.y - b.b.y) > 0.005) || a.phi.join() !== b.phi.join() || a.score !== b.score; }
      return { reel: !!(M.reel && M.reel.length), moved }; });
    const realOk = s0.st === 'play' && s0.onPl && !s1.onPl && s1.by < 0.9 && s2.fl[0] && !s2.fl[1] && !s3.fl[0] && t1.fl[0] && !t1.fl[1] && t2.fl.join() === 'true,true' && t3.fl.join() === 'false,false'
      && Math.abs(z1 - z0) < 1e-6 && t4.st === 'play' && t4.onPl && ov.st === 'over' && ov.stars === (123450 >= ov.par ? 3 : 123450 >= ov.par * 0.6 ? 2 : 1) && ov.best === 123450
      && nx && nx.c === s0.c && nx.flew < 0.1 && nx.st !== 'over' && idle.reel && idle.moved;
    if (!realOk) failures.push(`[${current}] real input: ${JSON.stringify({ s0, s1, s2, s3, t1, t2, t3, z0, z1, t4, ov, nx, idle })}`);
    await page.evaluate(() => localStorage.removeItem('pinball.best'));
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${current} (pars ${Math.round(par.near)} near, ${Math.round(par.far)} far; ${pb.steps} steps of the steady player, the ball never out)`);
  }
  // PINBALL: ERAS, RAMPS AND ORBITS, REMADE UNTIL IT FITS (Oct 25: "what are ways we could improve pinball, like more variety and
  // the further from the center, the more difficult, and more variety of styles", then "proceed"): every era among the first
  // boards, each with its own parts and balls; a ramp made by a hard shot (scored, out on its inlane), a weak one rolling back
  // out of its mouth, a second within the combo's time worth twice; an orbit round to the other side; a gobble hole taking a slow
  // ball; tables fitted to their level's band by the steady player, a ball lasting longer near the corner than far out; the
  // ramps and a ball on one drawn raised; and each era's picture.
  {
    current = 'pinball eras';
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, K = D.consts, out = {};
      const tableWith = (from, lv, ok) => { for (let i = from; i < from + 600; i++){ const T = D.makeTable(i, lv); if (ok(T)) return T; } return null; };
      const run = (T, S, sec, stop) => { for (let k = 0; k < sec / K.SUB; k++){ const e = D.sub(T, S, K.SUB); if (e) return e; if (stop && stop(S)) return 'stop'; } return null; };
      const eras = {}; for (let i = 0; i < 60; i++){ const T = D.makeTable(i, 2); const e = eras[T.era.id] = eras[T.era.id] || { n: 0, balls: T.balls, drops: 0, ramps: 0, orbits: 0, gobble: 0 };
        e.n++; e.drops += T.drops.length ? 1 : 0; e.ramps += T.ramps.filter(x => x.kind === 'ramp').length; e.orbits += T.orbit ? 1 : 0; e.gobble += T.gobble ? 1 : 0; }
      out.eras = eras;
      // a ramp: a hard shot rides it to its inlane, scored; a weak one rolls back out; a second soon after is a combo
      { const T = tableWith(40, 3, T => T.ramps.some(x => x.kind === 'ramp')), k = T.ramps.findIndex(x => x.kind === 'ramp'), Rp = T.ramps[k], M = Rp.M, S = D.newState(T, true);
        const shoot = v => { S.b = { x: M.x - M.dx * 0.03, y: M.y - M.dy * 0.03, vx: M.dx * v, vy: M.dy * v, z: 0 }; };
        shoot(3); let top = 0; run(T, S, 0.05); const rode = !!S.ride; run(T, S, 4, S => { top = Math.max(top, S.b.z || 0); return !S.ride; });
        out.ramp = { rode, top: +top.toFixed(3), score: S.score, at: [+(S.b.x - Rp.exit.x).toFixed(3), +(S.b.y - Rp.exit.y).toFixed(3)] };
        const s1 = S.score; shoot(3); run(T, S, 0.05); run(T, S, 4, S => !S.ride); out.ramp.combo = S.score - s1;
        const S2 = D.newState(T, true); S2.b = { x: M.x - M.dx * 0.03, y: M.y - M.dy * 0.03, vx: M.dx * 0.9, vy: M.dy * 0.9, z: 0 }; S2.t = 100;
        run(T, S2, 0.06); const rode2 = !!S2.ride; run(T, S2, 3, S => !S.ride);
        out.weak = { rode: rode2, score: S2.score, back: (S2.b.vx * M.dx + S2.b.vy * M.dy) < 0, near: Math.hypot(S2.b.x - M.x, S2.b.y - M.y) < 0.05 }; }
      // an orbit, from the left mouth round to the right
      { const T = tableWith(40, 2, T => T.orbit), Rp = T.ramps.find(x => x.kind === 'orbit'), M = Rp.M, S = D.newState(T, true);
        S.b = { x: M.x, y: M.y + 0.03, vx: 0, vy: -2, z: 0 }; run(T, S, 0.05); const rode = !!S.ride; run(T, S, 4, S => !S.ride);
        out.orbit = { rode, score: S.score, dx: +(S.b.x - Rp.exit.x).toFixed(3), down: S.b.vy > 0 }; }
      // a gobble hole takes a slow ball
      { const T = tableWith(40, 2, T => T.gobble), G = T.gobble, S = D.newState(T, true); S.b = { x: G.x - 0.03, y: G.y, vx: 0.6, vy: 0, z: 0 }; T.g = 0;
        out.gobble = { e: run(T, S, 0.3), score: S.score }; T.g = T.D.g; }
      // fitted: each table's life in its level's band (or the nearest of its tries), longer at level 1 than at level 5
      out.fit = [1, 3, 5].map(lv => { const L = []; for (let i = 0; i < 4; i++){ const G = D.fitGen(800 + i * 31, lv); let x; do { x = G.next(); } while (!x.done);
        const [lo, hi] = D.LIFE_BAND[lv - 1]; L.push({ life: +x.value.life.toFixed(1), used: x.value.used, inBand: x.value.life >= lo && x.value.life <= hi, reel: x.value.reel.length > 0 }); } return L; });
      // drawn: a ramp's pieces raised, a ball on a ramp raised; each era's picture
      { const T = tableWith(40, 3, T => T.ramps.some(x => x.kind === 'ramp')), Rp = T.ramps.find(x => x.kind === 'ramp');
        const M = { T, reel: null }, V = D.viewOf(M, null); const A = D.pathAt(Rp.P, Rp.P.L / 2); V.b = { x: A.x, y: A.y, z: D.rampZ(Rp, Rp.P.L / 2) };
        const its = D.itemsOf(V); out.drawn = { raised: its.filter(i => i.kind === 'pbBar' && i.lift > 0.03).length, ball: (its.find(i => i.kind === 'pbBall') || {}).lift || 0 }; }
      out.pictures = D.ERAS.map(E => { const T = tableWith(0, 2, T => T.era === E); const cv = T && D.paint(T, 256); return cv ? cv.width + 'x' + cv.height : null; });
      return out;
    });
    const E = r.eras, fitOk = r.fit.every(L => L.every(x => (x.inBand || x.used === 6) && x.reel)) && r.fit[0].reduce((a, x) => a + x.life, 0) > r.fit[2].reduce((a, x) => a + x.life, 0) * 2;
    const ok = E.wood && E.em && E.dmd && E.neon && E.wood.balls === 5 && E.em.balls === 5 && E.dmd.balls === 3 && E.neon.balls === 3 && E.wood.drops === 0 && E.wood.gobble === E.wood.n
      && E.wood.ramps === 0 && E.em.ramps === 0 && E.neon.ramps > E.neon.n && E.dmd.ramps >= E.dmd.n && E.neon.orbits === E.neon.n
      && r.ramp.rode && r.ramp.top > 0.04 && r.ramp.score >= 1500 && Math.abs(r.ramp.at[0]) < 0.03 && r.ramp.combo >= 3000
      && r.weak.rode && r.weak.score === 0 && r.weak.back && r.weak.near
      && r.orbit.rode && r.orbit.score >= 1000 && Math.abs(r.orbit.dx) < 0.03 && r.orbit.down && r.gobble.e === 'drain' && r.gobble.score >= 5000
      && fitOk && r.drawn.raised > 10 && r.drawn.ball > 0.04 && r.pictures.every(Boolean);
    if (!ok) failures.push(`[${current}] ${JSON.stringify(r)}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (${Object.entries(E).map(([k, v]) => k + ' ' + v.n).join(', ')} of 60; a ramp made for ${r.ramp.score}, a combo ${r.ramp.combo}, a weak shot back out; an orbit ${r.orbit.score}; gobbled ${r.gobble.score}; lives ${r.fit.map(L => L.map(x => x.life).join('/')).join(', ')} at levels 1, 3, 5)`);
  }
  // PINBALL: MULTIBALL, TOYS, THE UPPER FLIPPER, THEMES AND THE DISPLAY (Oct 25: "whats next for pinball", then "1,5,6,7,9"):
  // every theme among the first boards; a saucer's two locks and the third setting three balls going; locks in a ramp the same;
  // a jackpot on a ramp in multiball; a ball drained in multiball giving way to another; the lock lit only after a shot at level 3;
  // the upper flipper worked by its side's button and throwing a ball; the spinner, the rollovers, the captive ball, the magnet and
  // the moving bank each doing what it does; the display's words and dots, the reels rolling to the score, and a recording's frame.
  {
    current = 'pinball more';
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, K = D.consts, out = {};
      const tableWith = (from, lv, ok) => { for (let i = from; i < from + 2000; i++){ const T = D.makeTable(i, lv); if (ok(T)) return T; } return null; };
      const run = (T, S, sec, stop) => { for (let k = 0; k < sec / K.SUB; k++){ const e = D.sub(T, S, K.SUB); if (e) return e; if (stop && stop(S)) return 'stop'; } return null; };
      const themes = {}; for (let i = 0; i < 80; i++){ themes[D.eraOf(i).theme.id] = 1; } out.themes = Object.keys(themes).length;
      // the saucer's locks: two balls locked, a new one to the plunger each time; the third sets three going
      // (the balls let out are counted by their kicks: with no one at the flippers they soon drain)
      const kicks = (T, S, sec) => { let n = 0; for (let k = 0; k < sec / K.SUB; k++){ D.sub(T, S, K.SUB); n += S.ev.filter(e => e[0] === 'kick').length; S.ev.length = 0; } return n; };
      { const T = tableWith(50, 1, T => T.lockBy === 'saucer'), Q = T.saucer, S = D.newState(T, false), steps = [];
        for (let k = 0; k < 3; k++){ S.onPl = false; S.b = { x: Q.x, y: Q.y - 0.003, vx: 0, vy: 0.2, z: 0 }; run(T, S, 0.02); S.ev.length = 0; steps.push([S.locked, S.onPl, S.multi]); }
        out.saucerLock = { steps, multi: S.multi, balls: 1 + S.xb.length, out: kicks(T, S, 3) }; }
      // the ramp's locks
      { const T = tableWith(50, 1, T => T.lockBy === 'ramp'), Rp = T.ramps.find(x => x.kind === 'ramp'), M = Rp.M, S = D.newState(T, false), steps = [];
        for (let k = 0; k < 3; k++){ S.onPl = false; S.b = { x: M.x - M.dx * 0.03, y: M.y - M.dy * 0.03, vx: M.dx * 3, vy: M.dy * 3, z: 0 }; run(T, S, 0.05); run(T, S, 4, S => !S.ride); S.ev.length = 0; steps.push([S.locked, S.onPl, S.multi]); }
        out.rampLock = { steps, multi: S.multi, balls: 1 + S.xb.length, out: kicks(T, S, 2) }; }
      // a jackpot on a ramp in multiball, worth more the next time; a drained ball giving way to another
      { const T = tableWith(50, 2, T => T.ramps.some(x => x.kind === 'ramp') && T.lockBy), Rp = T.ramps.find(x => x.kind === 'ramp'), M = Rp.M, S = D.newState(T, true);
        D.startMulti(T, S, { x: 0.2, y: 0.5, vx: 0, vy: 0 }); S.xb.forEach(b => { b.hold = 1e9; b.kick = { x: 0.2, y: 0.5, vx: 0, vy: 0 }; });
        S.b = { x: M.x - M.dx * 0.03, y: M.y - M.dy * 0.03, vx: M.dx * 3, vy: M.dy * 3, z: 0 }; const s0 = S.score, j0 = S.jack; run(T, S, 0.05); run(T, S, 4, S => !S.ride);
        out.jackpot = { got: S.score - s0, j0, j1: S.jack };
        S.xb[0].hold = -1; S.xb[0].kick = null; S.xb[0].x = 0.2; S.xb[0].y = 0.3; const was = S.xb[0]; S.b = { x: K.XC, y: 1.05, vx: 0, vy: 1, z: 0 };
        const e = D.sub(T, S, K.SUB); out.drainMb = { e, took: S.b === was }; }
      // at level 3 the lock lights after a shot
      { const T = tableWith(50, 3, T => T.lockBy), S = D.newState(T, true); out.lit3 = [D.lockLit(T, S), (S.lockQ = 1, D.lockLit(T, S))]; }
      // the upper flipper: both of its side's flippers up; it throws a ball resting on it
      { const T = tableWith(50, 3, T => T.fl.length > 2), f = T.fl[2], S = D.newState(T, true), c = Math.cos(f.rest), sn = Math.sin(f.rest), sg = f.side ? -1 : 1;
        S.b = { x: f.px + c * f.len * 0.6 + sn * (K.R + 0.009) * sg, y: f.py + sn * f.len * 0.6 - c * (K.R + 0.009) * sg, vx: 0, vy: 0, z: 0 };
        D.setFlipper(S, f.side, true); const both = S.fl.filter(F => F.side === f.side).every(F => F.on); let vy = 0; run(T, S, 0.06, S => { vy = Math.min(vy, S.b.vy); });
        out.upper = { both, vy }; }
      // the spinner
      { const T = tableWith(50, 2, T => T.spinner), Sp = T.spinner, S = D.newState(T, true); S.b = { x: Sp.x, y: Sp.y + 0.03, vx: 0, vy: -2.5, z: 0 }; run(T, S, 0.03); const w = S.spinW; S.b = null; run(T, S, 2);
        out.spinner = { w, score: S.score }; }
      // the rollovers
      { const T = tableWith(50, 2, T => T.rolls), S = D.newState(T, true); T.g = 0;
        for (const q of T.rolls){ S.b = { x: q[0], y: q[1] - 0.03, vx: 0, vy: 0.8, z: 0 }; run(T, S, 0.08); } T.g = T.D.g; out.rolls = { score: S.score, left: S.rolls }; }
      // the captive ball, knocked up its channel to the target
      { const T = tableWith(50, 2, T => T.captive), C = T.captive, S = D.newState(T, true); S.b = { x: C.x, y: C.y1 + 0.04, vx: 0, vy: -3, z: 0 }; run(T, S, 0.6);
        out.captive = { score: S.score, hit: S.capT > 0 }; }
      // the magnet: on, it takes a slow ball near it, holds it and throws it
      { const T = tableWith(50, 2, T => T.magnet), Mg = T.magnet, S = D.newState(T, true); let t = 0; while (!D.magOn(Mg, t + 0.05)) t += 0.05; S.t = t; T.g = 0;
        S.b = { x: Mg.x + 0.02, y: Mg.y, vx: 0, vy: 0, z: 0 }; run(T, S, 0.6, S => S.b.mag >= 0); const held = S.b.mag >= 0; let top = 0; run(T, S, 1.0, S => { top = Math.max(top, Math.hypot(S.b.vx, S.b.vy)); }); T.g = T.D.g;
        out.magnet = { held, thrown: top, score: S.score }; }
      // the moving bank: somewhere else a quarter of its time later; a target hit
      { const T = tableWith(50, 2, T => T.mbank), B = T.mbank, S = D.newState(T, true); T.g = 0; const x0 = D.mbX(B, 1, 0), x1 = D.mbX(B, 1, B.P / 4);
        S.b = { x: x0, y: B.y + 0.03, vx: 0, vy: -1.5, z: 0 }; run(T, S, 0.05); T.g = T.D.g; out.mbank = { moved: Math.abs(x1 - x0), score: S.score }; }
      // the display: words and dots on the later eras, the reels on the older ones rolling to the score; a frame's numbers
      { const V = { msg: 3, t: 0, score: 0 }; out.words = [D.dispText(V), D.dispText({ msg: 0, t: 3, score: 1234567 }), D.dispText({ msg: 0, t: 0.5, score: 9, ballNo: 2 })];
        out.dots = D.dotsOf('12,345').length / 2;
        const Tn = tableWith(50, 2, T => T.era.id === 'neon' || T.era.id === 'dmd'), Mn = { T: Tn, reel: null, phase: 0 }, Vn = D.viewOf(Mn, null); Vn.bp = 400; Vn.score = 4321;
        out.dotItems = D.itemsOf(Vn).filter(i => i.kind === 'pbDot').length;
        const To = tableWith(50, 2, T => T.era.id === 'wood' || T.era.id === 'em'), Mo = { T: To, reel: null, phase: 0 }, Vo = D.viewOf(Mo, null); Vo.bp = 400; Vo.score = 3070;
        out.reelItems = D.itemsOf(Vo).filter(i => i.kind === 'pbReel').length;
        const H = { reel: null, reelAt: 0 }, Vr = { holder: H, score: 3070 }; D.reelsOf(Vr); for (let k = 0; k < 12; k++){ H.reelAt -= 0.2; D.reelsOf(Vr); } const R7 = Array.from(D.reelsOf(Vr)).map(x => Math.round(x)).join('');
        out.reels = R7;
        const fr = []; const S = D.newState(Tn, true); D.toPlunger(S); D.frameOf(Tn, S, fr); out.frame = fr.length; }
      return out;
    });
    const ok = r.themes === 5 && r.saucerLock.steps.map(x => x.join()).join('|') === '1,true,false|2,true,false|0,false,true' && r.saucerLock.multi && r.saucerLock.balls === 3 && r.saucerLock.out === 3
      && r.rampLock.steps.map(x => x.join()).join('|') === '1,true,false|2,true,false|0,false,true' && r.rampLock.multi && r.rampLock.balls === 3 && r.rampLock.out === 2
      && r.jackpot.got >= r.jackpot.j0 && r.jackpot.j1 === r.jackpot.j0 + 10000 && r.drainMb.e == null && r.drainMb.took
      && r.lit3.join() === 'false,true' && r.upper.both && r.upper.vy < -1 && r.spinner.w > 5 && r.spinner.score >= 100
      && r.rolls.score >= 1500 + 3000 && r.rolls.left === 0 && r.captive.hit && r.captive.score >= 2500 && r.magnet.held && r.magnet.thrown > 1 && r.magnet.score >= 500
      && r.mbank.moved > 0.03 && r.mbank.score >= 750 && r.words[0] === 'JACKPOT' && r.words[1] === '1,234,567' && r.words[2] === 'BALL 2' && r.dots > 20 && r.dotItems > 20
      && r.reelItems === 7 && r.reels === '0003070' && r.frame === 21;
    if (!ok) failures.push(`[${current}] ${JSON.stringify(r)}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (5 themes; locks ${r.saucerLock.steps.map(x => x[0]).join(',')} then three balls, from a saucer and a ramp; a jackpot of ${r.jackpot.got}; the upper flipper threw at ${(-r.upper.vy).toFixed(2)}; spinner ${r.spinner.score}, rollovers ${r.rolls.score}, captive ${r.captive.score}, magnet threw at ${r.magnet.thrown.toFixed(2)}, moving bank ${r.mbank.score}; the display '${r.words.join("', '")}', ${r.dotItems} dots lit, reels ${r.reels})`);
  }
  // PINBALL'S MISSIONS AND THE AIMING PLAYER (Oct 25: "whats next for pinball", then "5,1"): the saucer starts the board's next
  // mission (on a table with none, the top lanes all lit), its events count to its award, the second won pays twice, time runs out,
  // the ball's end ends it; recorded and read back, on the display and the clock's lamps; the steady player aiming makes more ramps
  // than flipping where it happens to, and a recording starts before the game's first mission or multiball.
  {
    current = 'pinball missions';
    const r = await page.evaluate(() => {
      const D = window.FIELD_APPS.find(a => a.id === 'pinball')._debug, K = D.consts, out = {};
      const tableWith = (from, lv, ok) => { for (let i = from; i < from + 2000; i++){ const T = D.makeTable(i, lv); if (ok(T)) return T; } return null; };
      const run = (T, S, sec) => { for (let k = 0; k < sec / K.SUB; k++) D.sub(T, S, K.SUB); };
      const kindOf = id => D.MIS.findIndex(m => m.id === id);
      // started by the saucer
      { const T = tableWith(50, 1, T => T.saucer && !T.lockBy), Q = T.saucer, S = D.newState(T, true); S.b = { x: Q.x, y: Q.y - 0.003, vx: 0, vy: 0.2, z: 0 }; run(T, S, 0.02);
        const M = S.mis; out.start = M ? { has: D.MIS[M.k].has(T), need: M.need === D.MIS[M.k].need[0], clock: Math.round(M.until - S.t) } : null;
        // won: the second pays twice
        const s0 = S.score; S.mis = { k: kindOf('ramps'), need: 2, got: 0, until: S.t + 30 }; D.ev(S, 'ramp'); const half = !!S.mis; D.ev(S, 'ramp');
        const p1 = S.score - s0; S.mis = { k: kindOf('pops'), need: 1, got: 0, until: S.t + 30 }; D.ev(S, 'bumper'); const p2 = S.score - s0 - p1;
        out.won = { half, p1, p2, msg: S.msg, award: D.MIS_AWARD };
        // time up, and the ball's end
        S.mis = { k: 0, need: 2, got: 0, until: S.t + 1 }; S.b = null; run(T, S, 1.2); out.lost = { gone: !S.mis, msg: S.msg };
        S.mis = { k: 0, need: 2, got: 0, until: S.t + 10 }; D.endBall(S); out.ended = !S.mis; }
      // started by the lanes on a table with no saucer
      { const T = tableWith(50, 1, T => !T.saucer), S = D.newState(T, true); T.g = 0; S.lanes.fill(1); S.lanes[0] = 0; const L = T.lanes[0];
        S.b = { x: L.x, y: L.y + 0.03, vx: 0, vy: -0.8, z: 0 }; run(T, S, 0.06); T.g = T.D.g; out.lanes = !!S.mis; }
      // recorded and read back; on the display and the clock's lamps (20 s of 28 left at level 2: four lit, the fifth blinking)
      { const T = tableWith(50, 2, T => T.era.id === 'dmd' || T.era.id === 'neon'), S = D.newState(T, true); D.toPlunger(S);
        S.mis = { k: kindOf('pops'), need: 15, got: 3, until: S.t + 20 }; const fr = []; D.frameOf(T, S, fr);
        const V = D.viewOf({ T, reel: Float32Array.from(fr), phase: 0 }, null); V.t = 0.5; V.bp = 400;
        out.rec = { mis: V.mis, text: D.dispText(V), lamps: D.itemsOf(V).filter(i => i.kind === 'pbLamp' && i.color === 0xffa030 && Math.abs(i.v - 0.733) < 0.002).length }; }
      // aiming: a ball on a flipper flown ahead goes up the table; the aiming player makes more ramps than one flipping where it happens to
      { const T = tableWith(50, 2, T => T.ramps.some(x => x.kind === 'ramp')), f = T.fl[0], S = D.newState(T, true), c = Math.cos(f.rest), sn = Math.sin(f.rest);
        const sh = D.shotNow(T, S, 0, { x: f.px + c * f.len * 0.5 + sn * (K.R + 0.01), y: f.py + sn * f.len * 0.5 - c * (K.R + 0.01), vx: 0.3, vy: 0.2 }); out.shot = sh && sh.a < 0;
        const ramps = { aim: 0, free: 0 };
        for (const mode of ['aim', 'free']) for (let i = 0; i < 16; i++){ const Ti = tableWith(300 + i * 23, 1 + i % 3, T => T.ramps.length > 0), Si = D.newState(Ti, false), B = D.botNew(i + 7);
          if (mode === 'free') B.noAim = true; D.toPlunger(Si);
          for (let k = 0; k < 60 / K.SUB; k++){ D.botStep(Ti, Si, B, K.SUB); if (D.sub(Ti, Si, K.SUB) === 'drain'){ D.endBall(Si); D.toPlunger(Si); }
            for (const [e] of Si.ev) if (e === 'ramp' || e === 'orbit') ramps[mode]++; Si.ev.length = 0; } }
        out.ramps = ramps; }
      // a recording from before the game's first mission or multiball
      { let F = null; for (let i = 0; i < 12 && !(F && F.recKind); i++){ const G = D.fitGen(40 + i * 7, 1); let x; do { x = G.next(); } while (!x.done); F = x.value; }
        const Rc = F.reel, n = Rc.length / 21; let first = -1;
        for (let k = 0; k < n && first < 0; k++) if (F.recKind === 2 ? Rc[k * 21 + 16] & 4 : Rc[k * 21 + 20]) first = k;
        out.window = { kind: F.recKind, first, len: +(n / 30).toFixed(1) }; }
      return out;
    });
    const ok = r.start && r.start.has && r.start.need && r.start.clock === 30 && r.won.half && r.won.p1 === r.won.award && r.won.p2 === 2 * r.won.award && r.won.msg === 11
      && r.lost.gone && r.lost.msg === 12 && r.ended && r.lanes
      && r.rec.mis && r.rec.mis.got === 3 && r.rec.mis.need === 15 && r.rec.mis.left === 20 && r.rec.text === '12 POPS 20' && (r.rec.lamps === 4 || r.rec.lamps === 5)
      && r.shot && r.ramps.aim > r.ramps.free * 1.2
      && r.window.kind > 0 && r.window.first > 0 && r.window.first <= 181 && r.window.len >= 15;
    if (!ok) failures.push(`[${current}] ${JSON.stringify(r)}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (started by the saucer with ${r.start && r.start.clock} s, won for ${r.won.p1} then ${r.won.p2}, time up, by the lanes; '${r.rec.text}' and ${r.rec.lamps} clock lamps; ramps and orbits aimed ${r.ramps.aim} against ${r.ramps.free}; a recording whose ${r.window.kind === 2 ? 'multiball' : 'mission'} starts ${(r.window.first / 30).toFixed(1)} s in)`);
  }
  // PINBALL: A TABLE OF YOUR OWN (Oct 25: "whats next for pinball", then "1"): a board's table made again from its plain spec is the
  // same table; the real dots open the editor on the framed board; Clear, then a real click laying a bumper where it fell and a real
  // drag moving it; a part too near another refused; a ramp a side; Check's steady player; the real ✓ keeping it in storage as the
  // board's own table, played; a shared copy onto another board; nonsense refused by cleanSpec.
  {
    current = 'pinball editor';
    const before = failures.length;
    const pe0 = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms));
      const A = window.FIELD_APPS.find(a => a.id === 'pinball'); if (window.getFieldApp() !== A){ window.setFieldApp(A); await wait(2500); }
      const D = A._debug; let worst = 0, same = true;
      for (let i = 0; i < 40; i++){ const T = D.makeTable(i * 13 + 5, 1 + i % 5, 0), T2 = D.makeTable(T.idx, T.lv, 0, false, D.cleanSpec(T.spec));
        if (T.segs.length !== T2.segs.length || T.circs.length !== T2.circs.length || T.ramps.length !== T2.ramps.length || T.fl.length !== T2.fl.length || T.drops.length !== T2.drops.length) same = false;
        else T.circs.forEach((c, k) => { worst = Math.max(worst, Math.hypot(c.x - T2.circs[k].x, c.y - T2.circs[k].y)); }); }
      if (!document.body.classList.contains('bb-collapsed')){ document.getElementById('bbHandle').click(); await wait(800); }
      return { same, worst };
    });
    await page.click('#bbHandle'); await page.waitForTimeout(900);
    const pe1 = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, E = D.ed(); if (!E.on) return { open: false };
      const tile = name => A.onStatTap(E.c, E.r, A.statTiles(E.c, E.r).findIndex(t => String(t.value).startsWith(name)));
      tile('Clear'); tile('Bumper'); return { open: true, bare: E.P.bumpers.length === 0 && E.P.ramps.length === 0 && !E.P.saucer, c: E.c, r: E.r }; });
    const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
    let pe2 = {};
    if (pe1.open){
      const W = 0.56, a = await aimAt(0.2 / W, 0.3), b = await aimAt(0.3 / W, 0.4);
      await page.mouse.click(a.x, a.y); await page.waitForTimeout(500);
      const laid = await page.evaluate(() => window.getFieldApp()._debug.ed().P.bumpers.map(q => q.slice()));
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      for (let k = 1; k <= 10; k++){ await page.mouse.move(a.x + (b.x - a.x) * k / 10, a.y + (b.y - a.y) * k / 10); await page.waitForTimeout(40); }
      await page.mouse.up(); await page.waitForTimeout(500);
      pe2 = await page.evaluate(laid => { const A = window.getFieldApp(), D = A._debug, E = D.ed(), K = D.consts, out = { laid };
        out.moved = E.P.bumpers.map(q => q.slice());
        const tile = name => A.onStatTap(E.c, E.r, A.statTiles(E.c, E.r).findIndex(t => String(t.value).startsWith(name)));
        out.refused = !!D.putPart(E.P, 'bumper', E.P.bumpers.length, E.P.bumpers[0][0] + 0.02, E.P.bumpers[0][1]).why;
        E.ateAt = 0;                                            // (the tap the field sends after a drag is eaten for 350 ms; these are not it)
        tile('Ramp'); D.edTap(E.c, E.r, 0.12 / K.W, 0.45); D.edTap(E.c, E.r, 0.17 / K.W, 0.5); D.edTap(E.c, E.r, 0.4 / K.W, 0.45);
        out.ramps = E.P.ramps.map(q => q.slice());
        tile('Saucer'); D.edTap(E.c, E.r, 0.27 / K.W, 0.56);
        out.built = { ramps: E.M.T.ramps.filter(x => x.kind === 'ramp').length, saucer: !!E.M.T.saucer, bumpers: E.M.T.bumpers.length };
        out.check = +D.edCheck(false).life.toFixed(1);
        return out; }, laid);
      await page.waitForFunction(() => !!document.querySelector('#bbQuick button[title^="Done"]'), null, { timeout: 5000 }).catch(() => {});
      await page.click('#bbQuick button[title^="Done"]').catch(() => {}); await page.waitForTimeout(700);
    }
    const pe3 = await page.evaluate(pe1 => { const D = window.getFieldApp()._debug, E = D.ed(), k = pe1.c + '_' + pe1.r, out = {};
      out.closed = !E.on; out.kept = D.MINE.has(k);
      const M = D.tableFor(pe1.c, pe1.r); out.mine = !!M && M.mine && M.T.mine && M.T.ramps.filter(x => x.kind === 'ramp').length === 2 && !!M.T.saucer;
      const d = D.cleanSpec(JSON.parse(localStorage.getItem('pinball.mine') || '{}')[k]); out.stored = !!d && JSON.stringify(d) === JSON.stringify(D.MINE.get(k));
      out.game = D.gameAt(pe1.c, pe1.r).M === M;
      D.takeTable(pe1.c + 3, pe1.r, JSON.parse(JSON.stringify(d))); out.shared = JSON.stringify(D.MINE.get((pe1.c + 3) + '_' + pe1.r)) === JSON.stringify(d);
      out.clean = D.cleanSpec(null) === null && D.cleanSpec({ era: 'x', lv: 9, bumpers: [[9, 9], 'a'], ramps: [[1, 0.4, 0.4], [1, 0.3, 0.3]] }).ramps.length === 1;
      D.MINE.delete(k); D.MINE.delete((pe1.c + 3) + '_' + pe1.r); D.MINE_M.clear(); D.GAMES.clear(); localStorage.removeItem('pinball.mine');
      return out; }, pe1);
    const ok = pe0.same && pe0.worst < 0.002 && pe1.open && pe1.bare && pe2.laid && pe2.laid.length === 1 && Math.hypot(pe2.laid[0][0] - 0.2, pe2.laid[0][1] - 0.3) < 0.02
      && pe2.moved.length === 1 && Math.hypot(pe2.moved[0][0] - 0.3, pe2.moved[0][1] - 0.4) < 0.03 && pe2.refused
      && pe2.ramps.length === 2 && pe2.ramps.some(q => q[0] < 0 && Math.abs(q[1] - 0.17) < 0.002) && pe2.ramps.some(q => q[0] > 0)
      && pe2.built.ramps === 2 && pe2.built.saucer && pe2.built.bumpers === 1 && pe2.check > 0
      && pe3.closed && pe3.kept && pe3.mine && pe3.stored && pe3.game && pe3.shared && pe3.clean;
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ pe0, pe1, pe2, pe3 })}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${current} (40 tables made again from their specs, ${pe0.worst.toFixed(4)} apart at most; the real dots opened it, a real click laid a bumper and a real drag moved it; a ramp a side; the steady player's ball ${pe2.check} s; the real ✓ kept it as the board's table; shared onto another)`);
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
        const setTo = w => { for (let k = 0; k < 4 && !item.label().toLowerCase().includes(w); k++) item.on(); return item.label().toLowerCase().includes(w); };
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
      if (r.why || r.lv.join() !== 'easy,normal,hard' || !(r.far > r.near) || !/^Difficulty: (Easy|Normal|Hard)$/.test(r.label)) bad.push(id + ' ' + JSON.stringify(r));
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
      // (a slow runner may take the first click as only selecting the board, or start the game a frame or two later: the game is
      // waited for, and the click given again if none came; on CI, in a part of its own, two clicks 3 s apart were not
      // enough on Oct 29, so four, 5 s apart, as patient as pinball's new game)
      let started = null;
      for (let k = 0; k < 4 && !started; k++){
        // (Nov 9: aimed afresh for each click, once the point has held still 300 ms: the camera may still have been settling from the flight, and a click on where the board WAS started nothing, on CI and on main alike)
        let at = await aimAt(0.5, 0.5);
        for (let j = 0; j < 20; j++){ await page.waitForTimeout(300); const at2 = await aimAt(0.5, 0.5); const still = Math.abs(at2.x - at.x) < 1 && Math.abs(at2.y - at.y) < 1; at = at2; if (still) break; }
        await page.mouse.click(at.x, at.y);
        await page.waitForFunction(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return !!g; }, key, { timeout: 5000 }).catch(() => {});
        started = await page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? g.state : null; }, key);
      }
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
    const ok3 = quick.score === 5 && quick.state !== 'over' && quick.corner === 'bg';
    if (!ok3) failures.push('[simon] quick taps on one pad: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} simon: five quick real touches on one pad are five presses (${quick.score}), a corner is the background's`);
    // the history slider (Nov 1: "the top of simon board should have a slider that lets the player pan through the current games history."):
    // a real drag along the far strip walks through the steps, lighting each step's pad and leaving the answer's clock still; a tap on a pad
    // is live again
    {
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
      await page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.fresh(f.c, f.r);
        D.GAMES.set(f.c + '_' + f.r, g); D.LIVE = { c: f.c, r: f.r }; g.n = 6; g.state = 'input'; g.i = 0; g.deadline = performance.now() / 1000 + 60; });
      await page.waitForTimeout(600);
      const a0 = await aimAt(0.5, 0.95), a1 = await aimAt(0.9, 0.95), a2 = await aimAt(0.1, 0.95);
      const look = async () => page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.GAMES.get(f.c + '_' + f.r);
        return { view: g.view, want: g.view >= 0 ? g.S.at(g.view) : null, n: g.n, dots: window.getFieldApp().cellItems(f.c, f.r).filter(i => i.kind === 'smDot').length, state: g.state }; });
      await page.mouse.move(a0.x, a0.y); await page.mouse.down();
      for (let k = 1; k <= 8; k++){ await page.mouse.move(a0.x + (a1.x - a0.x) * k / 8, a0.y + (a1.y - a0.y) * k / 8); await page.waitForTimeout(30); }
      await page.mouse.up(); await page.waitForTimeout(300);
      const right = await look();
      await page.mouse.move(a1.x, a1.y); await page.mouse.down();
      for (let k = 1; k <= 8; k++){ await page.mouse.move(a1.x + (a2.x - a1.x) * k / 8, a1.y + (a2.y - a1.y) * k / 8); await page.waitForTimeout(30); }
      await page.mouse.up(); await page.waitForTimeout(300);
      const left = await look();
      const pad = await aimAt(0.5 + 0.31 * Math.cos(-Math.PI / 2 + Math.PI / 4), 0.5 + 0.31 * Math.sin(-Math.PI / 2 + Math.PI / 4));
      await page.mouse.click(pad.x, pad.y); await page.waitForTimeout(300);
      const live = await look();
      const okSl = right.view === 5 && left.view === 0 && right.dots >= 6 && live.view === -1;
      // a real click in the margin (a corner) hides the slider, another shows it again (Nov 1: "toggle the bottom row visibility ...")
      // (the wrong pad above ended that game, and a tap on a game that is over begins another: a live one again for the margin)
      await page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.fresh(f.c, f.r);
        D.GAMES.set(f.c + '_' + f.r, g); D.LIVE = { c: f.c, r: f.r }; g.n = 6; g.state = 'input'; g.i = 0; g.deadline = performance.now() / 1000 + 600; });
      await page.waitForTimeout(600);
      const cor = await aimAt(0.97, 0.03);
      await page.mouse.click(cor.x, cor.y); await page.waitForTimeout(300);
      const hid = await look();
      await page.mouse.click(cor.x, cor.y); await page.waitForTimeout(300);
      const shown = await look();
      const okTg = hid.dots === 0 && shown.dots >= 6;
      if (!okSl || !okTg) failures.push('[simon slider] ' + JSON.stringify({ right, left, live, hid, shown }));
      console.log(`${okSl && okTg ? 'ok  ' : 'FAIL'} simon: a real drag along the bottom slider walked the history (the last of ${right.n} steps, then the first), a tap on a pad was live again, a click in the margin hid the slider and another showed it`);
    }
    // 2048's figures are centred on their tile (Nov 1: "center 2048 numbers, they are currently right aligned."): a 1 was a stroke at its
    // glyph's right, so "16", "128" and "1024" sat to the right of the middle (since Nov 7 the figures are glyphs of the page's font, ink centred in their slots: the ends are the ink's own)
    {
      const off = await page.evaluate(() => { const F = window.FIELD_APPS.find(a => a.id === '2048')._debug.figures, out = {};
        for (const e of [1, 4, 7, 10]){ const it = F(e, 0.5, 0.5), n = it.length, ends = it.map((i, k) => { const d = String(Math.pow(2, e))[k], hw = window.__boardType.inkHalf(d) * i.scale; return [i.u - hw, i.u + hw]; });
          out[Math.pow(2, e)] = (Math.min(...ends.map(x => x[0])) + Math.max(...ends.map(x => x[1]))) / 2 - 0.5; }
        return out; });
      const okFig = Object.values(off).every(d => Math.abs(d) < 1e-9);
      if (!okFig) failures.push('[2048 figures] ' + JSON.stringify(off));
      console.log(`${okFig ? 'ok  ' : 'FAIL'} 2048: the figures are centred on their tile (2, 16, 128, 1024)`);
    }
    // the crossing catches you only by touching a piece (Nov 1: "seems like it would be better to just ignore the cells ... cell based
    // contact conflates that."): a pawn left on its start square for a minute is never caught, however many pieces take aim past it, and
    // the game keeps no threats
    {
      const cr = await page.evaluate(() => { const D = window.FIELD_APPS.find(a => a.id === 'crossing')._debug, g = D.newGame(D.SIZE.easy, 'easy');
        g.state = 'play'; let caught = 0, dead = 0; for (let k = 0; k < 600; k++){ D.step(g, 0.1); if (g.dead > 0) dead++; }
        return { caught: g.caught || 0, dead, threats: 'threats' in g, row: g.row }; });
      const okCr = cr.caught === 0 && cr.dead === 0 && !cr.threats;
      if (!okCr) failures.push('[crossing] ' + JSON.stringify(cr));
      console.log(`${okCr ? 'ok  ' : 'FAIL'} crossing: only touching a piece catches you (a minute on the start square, nothing struck, no threats kept)`);
    }
    // a board no one plays lights its pads in turn
    const demo = await page.evaluate(async () => { const D = window.getFieldApp()._debug, S = D.seqOf(9, 9), seen = new Set();
      for (let k = 0; k < 40; k++){ seen.add(D.shownLit(S)); await new Promise(ok => setTimeout(ok, 60)); } return seen.size; });
    if (!ok1 || !ok2 || demo < 2) failures.push('[simon] ' + JSON.stringify({ r, real, demo }));
    console.log(`${ok1 && ok2 && demo >= 2 ? 'ok  ' : 'FAIL'} simon (pads ${r.pads.join('/')} by ring, three rounds played back then a wrong pad ends it at ${r.wrong.score}; a real click on the right pad took)`);
  }
  // MEMORY'S HISTORY SLIDER (Nov 1: "similar[ly], the memory game should let the user browse the games history. adjust the board size to
  // accomodate."): the cards stand in a margin one square wide all round, whose bottom row is a dot for each turn so far; a real drag along
  // it walks through the turns (the pairs made up to one, its two cards up), a tap on a card is live again
  {
    current = 'memory slider'; const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'memory')); await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); });
    const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
    const made = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); A.onReset(f.c, f.r);
      const g = D.games.get(f.c + '_' + f.r), byFace = new Map(); g.face.forEach((fc, i) => { if (fc >= 0) (byFace.get(fc) || byFace.set(fc, []).get(fc)).push(i); });
      const pairs = [...byFace.values()];
      for (const p of pairs.slice(0, 3)){ D.flip(g, p[0], 0); D.flip(g, p[1], 0); }
      D.flip(g, pairs[3][0], 0); D.flip(g, pairs[4][0], 0); g.wait = 0; D.settle(g);
      return { moves: g.moves.length, n: g.n }; });
    await page.waitForTimeout(600);
    const M = made.n + 2, look = () => page.evaluate(() => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.games.get(f.c + '_' + f.r);
      return { view: g.view, up: [...window.getFieldApp().cellItems(f.c, f.r).filter(i => i.piece)].length, dots: window.getFieldApp().cellItems(f.c, f.r).filter(i => i.kind === 'mmDot').length }; });
    const a0 = await aimAt(0.5, 1 - 0.5 / M), a1 = await aimAt(0.2, 1 - 0.5 / M), a2 = await aimAt(0.8, 1 - 0.5 / M);
    await page.mouse.move(a0.x, a0.y); await page.mouse.down();
    for (let k = 1; k <= 8; k++){ await page.mouse.move(a0.x + (a1.x - a0.x) * k / 8, a0.y + (a1.y - a0.y) * k / 8); await page.waitForTimeout(30); }
    await page.mouse.up(); await page.waitForTimeout(300);
    const first = await look();
    await page.mouse.move(a1.x, a1.y); await page.mouse.down();
    for (let k = 1; k <= 8; k++){ await page.mouse.move(a1.x + (a2.x - a1.x) * k / 8, a1.y + (a2.y - a1.y) * k / 8); await page.waitForTimeout(30); }
    await page.mouse.up(); await page.waitForTimeout(300);
    const last = await look();
    const card = await aimAt(1.5 / M, 1.5 / M);
    await page.mouse.click(card.x, card.y); await page.waitForTimeout(400);
    const live = await look();
    const ok = made.moves === 4 && first.view === 0 && first.up === 2 && last.view === 3 && last.dots >= 4 && live.view === -1;
    if (!ok) failures.push('[memory slider] ' + JSON.stringify({ made, first, last, live }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} memory: the cards in a margin with a dot a turn along the bottom, a real drag along it walked the turns (the first with its two cards up, then the last of ${made.moves}), a tap on a card was live again`);
  }
  // SNAKE STOPS AT A SIDE (Nov 1: "snake should not crash when hitting the sides. it should just stop."): a head heading off the board
  // stays alive where it is, its body unmoved, and goes on once it is turned
  {
    current = 'snake sides'; const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'snake')); await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); });
    const r = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      A.onReset(f.c, f.r); const g = D.games.get(f.c + '_' + f.r) || D.gameAt(f.c, f.r); g.state = 'play'; g.pause = 0;
      const sn = g.snakes[0]; sn.body.forEach((x, i) => { x.r = 0; x.c = 3 + i; x.pr = 0; x.pc = 3 + i; }); sn.dir = [-1, 0]; sn.queue = [];
      const at = () => JSON.stringify(sn.body.map(x => [x.r, x.c])), was = at();
      for (let k = 0; k < 40; k++) D.step(g, 0.2);
      const stopped = { alive: sn.alive, same: at() === was };
      sn.queue = [[0, -1]]; for (let k = 0; k < 10; k++) D.step(g, 0.2);       // (left, along the row: right would turn it back into its own neck)
      return { stopped, moved: at() !== was, alive: sn.alive }; });
    const ok = r.stopped.alive && r.stopped.same && r.moved && r.alive;
    if (!ok) failures.push('[snake sides] ' + JSON.stringify(r));
    console.log(`${ok ? 'ok  ' : 'FAIL'} snake: a head at a side stops where it is, alive, and goes on when turned`);
  }
  // 3D TETRIS (Oct 23: "any games that require 3d spatial rotation", then "2": Blockout): every orientation of every piece
  // found (24 for a chiral tetracube's mirror-free cousin L4, 8 for the tripod), a turn about each axis taking the top where
  // the screen says, a full layer clearing with everything above coming down, the pit by level, the bot clearing layers at
  // every level; then real input: a click starting a board, the real arrow keys sliding it, the real Q turning it, the real
  // Enter dropping it, a real click on the piece dropping it and elsewhere spinning it, a real drag sliding it, a real click on
  // the row's Tip tile, a turn drawn on its way (cubes with `rot`), and a board no one plays moving.
  {
    current = 'blockout';
    // (the endless game, as it was: the puzzles are checked after)
    await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.id === 'blockout'); window.setFieldApp(A); A._debug.setMode('endless'); });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      out.ori = ['I2', 'O4', 'T4', 'L4', 'I4', 'TRI', 'SCR', 'SCL', 'P5'].map(t => D.ORI[t].list.length).join();
      out.pits = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.LV[D.levelOf(c, r) - 1].P).join();
      // a tripod at the default heading: tip sends its up arm to the far side (−y), roll to the right (+x)
      const g = D.newGame(3); g.state = 'play';
      const put = () => { g.cur = { t: 'TRI', o: 0, x: 2, y: 2, z: 2, fx: 2, fy: 2, fz: 2 }; };
      const arms = () => { const C = D.cellsOf(g.cur), has = (x, y, z) => C.some(p => p[0] === x && p[1] === y && p[2] === z);
        const c = C.find(p => C.filter(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) === 1).length === 3);
        return [[1, 0, 0, '+x'], [-1, 0, 0, '-x'], [0, 1, 0, '+y'], [0, -1, 0, '-y'], [0, 0, 1, 'up'], [0, 0, -1, 'down']].filter(([a, b, z]) => has(c[0] + a, c[1] + b, c[2] + z)).map(a => a[3]).sort().join(); };
      put(); out.arms0 = arms(); D.ask(g, 'tip', 1); out.tip = arms(); put(); D.ask(g, 'roll', 1); out.roll = arms(); put(); D.ask(g, 'spin', 1); out.spin = arms();
      out.anim = !!g.anim;
      // a layer: fill the floor but one cell, drop an I2 standing... (a single cube's place: an I2 laid flat fills two)
      const h = D.newGame(1); h.state = 'play';
      for (let i = 0; i < 9; i++) if (i !== 7 && i !== 8) h.grid[i] = 1;
      h.grid[9 + 4] = 1;                              // a cube on the second layer, over the middle
      h.cur = { t: 'I2', o: 0, x: 1, y: 2, z: 4, fx: 1, fy: 2, fz: 4 };
      D.hardDrop(h);
      out.clear = { layers: h.layers, score: h.score, floorMid: h.grid[4], second: h.grid.slice(9, 18).reduce((a, b) => a + b, 0) };
      // the bot clears layers at every level
      out.bot = [1, 2, 3, 4, 5].map(lv => { const fr = D.bakeReel(321 + lv, lv); return fr[fr.length - 1].layers; });
      // a turn on its way is drawn turned
      const items = D.itemsOf(D.snap(g), g);
      out.drawn = { cubes: items.filter(i => i.kind === 'bkCube').length, turned: items.filter(i => i.kind === 'bkCube' && i.rot).length, ghost: items.filter(i => i.kind === 'bkGhost').length };
      return out;
    });
    const ok1 = r.ori === '3,3,12,24,3,8,12,12,24' && r.pits === '4,5,5,5' && r.arms0 === '+x,+y,up' && r.tip === '+x,-y,up' && r.roll === '+x,+y,down'
      && r.spin.split(',').length === 3 && r.anim && r.clear.layers === 1 && r.clear.score === 100 && r.clear.floorMid === 1 && r.clear.second === 0
      && r.bot.every(n => n >= 3) && r.drawn.turned === 4 && r.drawn.ghost === 4;
    if (!ok1) failures.push('[blockout] rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} blockout: orientations ${r.ori}, tip and roll as the screen says, a layer cleared, the bot clearing ${r.bot.join('/')} layers by level`);
    // real input on a framed board
    await page.evaluate(() => window.FIELD_APPS.find(a => a.id === 'blockout')._debug.fly(2, 1));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const rd = () => page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); return g ? { st: g.state, cur: g.cur && [g.cur.t, g.cur.o, g.cur.x, g.cur.y, g.cur.z], cubes: g.cubes, lv: g.lv, turns: g.turns || 0 } : null; }, fc);
    // the screen point of a piece's top cube, and of a floor corner (from the board's own units)
    const pts = () => page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r), W = window.FIELD_WORLD, T = W.target, bW = W.boardW();
      const SQ = 0.12, o = 0.5 - g.P * SQ / 2, pr = (u, lift, v) => { const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW, 0.02 + lift * bW, T.boardZ + (0.5 - v) * bW).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
      const [x, y, z] = D.cellsOf(g.cur).sort((a, b) => b[2] - a[2])[0];
      return { piece: pr(o + (x + 0.5) * SQ, (z + 1) * SQ, o + (y + 0.5) * SQ), corner: pr(o + 0.02, 0, o + g.P * SQ - 0.02), mid: pr(0.5, 0, 0.5) }; }, fc);
    const real = {};
    if (fc){
      // (an empty pit, as the menu's Start this board again leaves it: on the stack a board shows, a piece can land and lock
      //  in the middle of a check on a slow frame)
      await page.evaluate(([c, r]) => { const A = window.getFieldApp(); A.onReset(c, r); }, fc);
      let P = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; });
      await page.mouse.click(P[0], P[1]); await page.waitForTimeout(500);
      real.start = await rd();
      // keys: a slide that can go (left or right), a turn, the drop
      const s0 = await rd();
      await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
      let s1 = await rd();
      if (s1.cur[2] === s0.cur[2]){ await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); s1 = await rd(); }
      real.slid = s1.cur[2] !== s0.cur[2] && s1.cur[3] === s0.cur[3];
      await page.keyboard.press('q'); await page.waitForTimeout(150);
      const s2 = await rd(); real.turned = s2.turns > s1.turns;
      await page.keyboard.press('Enter'); await page.waitForTimeout(300);
      const s3 = await rd(); real.dropped = s3.cubes > s2.cubes;
      // a click on the floor's corner, away from the piece, spins; a click on the piece drops it
      P = await pts(); await page.mouse.click(P.corner[0], P.corner[1]); await page.waitForTimeout(300);
      const s4 = await rd(); real.spun = s4.turns > s3.turns && s4.cubes === s3.cubes;
      P = await pts(); await page.mouse.click(P.piece[0], P.piece[1]); await page.waitForTimeout(300);
      const s5 = await rd(); real.clickDrop = s5.cubes > s4.cubes;
      // a drag across the board slides it (one way or the other, as far as the pit lets it)
      P = await pts();
      const s6 = await rd();
      const drag = async dx => { await page.mouse.move(P.mid[0], P.mid[1]); await page.mouse.down(); for (let k = 1; k <= 10; k++){ await page.mouse.move(P.mid[0] + k * dx, P.mid[1]); await page.waitForTimeout(30); } await page.mouse.up(); await page.waitForTimeout(300); };
      let s6b = s6;
      await drag(12); let s7 = await rd();
      if (s7.cur[2] === s6b.cur[2] || s7.cubes !== s6b.cubes){ s6b = s7; await drag(-12); s7 = await rd(); }
      real.dragged = s7.cur[2] !== s6b.cur[2] && s7.cubes === s6b.cubes;
      // the row's Tip tile (the third), clicked
      await page.evaluate(() => { if (!window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); } }); await page.waitForTimeout(700);   // (the row is opened by hand: Oct 28)
      const tile = await page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_2' && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      if (tile){ await page.mouse.click(tile[0], tile[1]); await page.waitForTimeout(300); }
      const s8 = await rd(); real.tile = !!tile && s8.turns > s7.turns;
      // a board no one plays moves
      real.idle = await page.evaluate(async ([c, r]) => { const A = window.getFieldApp(), k = JSON.stringify(A.cellItems(c + 3, r).filter(i => i.kind === 'bkCube').map(i => [i.u.toFixed(3), i.v.toFixed(3), i.lift.toFixed(3)]));
        await new Promise(ok => setTimeout(ok, 1500)); return JSON.stringify(A.cellItems(c + 3, r).filter(i => i.kind === 'bkCube').map(i => [i.u.toFixed(3), i.v.toFixed(3), i.lift.toFixed(3)])) !== k; }, fc);
    }
    const ok2 = !!fc && real.start && real.start.st === 'play' && real.slid && real.turned && real.dropped && real.spun && real.clickDrop && real.dragged && real.tile && real.idle;
    if (!ok2) failures.push('[blockout] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} blockout: a real click starts, the real arrow, Q and Enter slide, turn and drop, real clicks spin and drop, a real drag slides, the real Tip tile tips, a board no one plays moves`);
  }
  // 3D TETRIS PUZZLES AND THE SEE-THROUGH STACK (Oct 23: "1,2" of what came next): every board its own pit, part-filled, and
  // the pieces to clear it with, dealt backwards so its own pieces always clear it; the same puzzle each time; par by level;
  // played with its own pieces through the real Enter it is cleared in par with three stars and a best, and a real click then
  // starts again; a puzzle run out of pieces is over; a board no one plays shows its pieces coming down and the
  // pit emptied; see-through: glass over the landing and over a hole, the hole marked, nothing of it with it off, and the
  // row's real See tile and the real V switching it.
  {
    current = 'blockout puzzles';
    await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.id === 'blockout'); window.setFieldApp(A); A._debug.setMode('puzzle'); });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = { bad: [], par: {} };
      for (let lv = 1; lv <= 5; lv++){
        const pars = [];
        for (let k = 0; k < 20; k++){
          const Z = D.makePuzzle(700 + k * 53, lv), Z2 = D.makePuzzle(700 + k * 53, lv);
          if (!Z){ out.bad.push([lv, k, 'none']); continue; }
          if (JSON.stringify([...Z.grid, Z.seq]) !== JSON.stringify([...Z2.grid, Z2.seq])) out.bad.push([lv, k, 'differs']);
          // every layer has a gap, and the solution clears every layer, nothing left
          const P2 = Z.P * Z.P; for (let z = 0; z < Z.L; z++){ let n = 0; for (let i = 0; i < P2; i++) n += Z.grid[z * P2 + i]; if (n === P2) out.bad.push([lv, k, 'full layer']); }
          const run = D.playSeq({ P: Z.P, H: Z.H, grid: Z.grid.slice() }, Z.seq);
          if (!run || run.layers !== Z.L || run.grid.some(v => v)) out.bad.push([lv, k, 'unsolved']);
          pars.push(Z.par);
        }
        out.par[lv] = pars.reduce((a, b) => a + b, 0) / pars.length;
      }
      out.stars = [D.starsOf(4, 4), D.starsOf(5, 4), D.starsOf(6, 4)].join();
      // out of pieces: every piece dropped in the corner
      const g = D.puzzleGame(5, 2, D.levelOf(5, 2)); g.state = 'play';
      for (let k = 0; k < 20 && g.state === 'play'; k++) D.hardDrop(g);
      out.outOf = g.state;
      // a board no one plays: pieces coming down, the pit emptied at the end
      const Z = D.puzzleOf(3, 9), T = 1.2 + Z.seq.length * 1.5 + 1.6, seen = new Set(), ph = (D.boardIdx(3, 9) * 0.6180339887 % 1) * T;
      let empty = false, falling = false;
      for (let t = 0; t < T; t += 0.1){ const s = D.shownPuzzle(Z, 3, 9, t - ph + 100 * T); seen.add(s.grid.reduce((a, b) => a + b, 0)); if (!s.grid.some(v => v)) empty = true; if (s.cur && s.cur.fz < Z.H) falling = true; }
      out.demo = { states: seen.size, empty, falling, n: Z.seq.length };
      // see-through: a floor with a hole in its middle, covered from above
      const h = D.newGame(3); h.state = 'play';
      for (let i = 0; i < 25; i++) h.grid[i] = 1; h.grid[12] = 0; h.grid[25 + 12] = 1;
      h.cur = { t: 'O4', o: 0, x: 0, y: 0, z: 5, fx: 0, fy: 0, fz: 5 };
      const kinds = () => D.itemsOf(D.snap(h), h).reduce((m, i) => (m[i.kind] = (m[i.kind] || 0) + 1, m), {});
      const was = D.SET.glass; D.SET.glass = true; out.on = kinds(); D.SET.glass = false; out.off = kinds(); D.SET.glass = was;
      return out;
    });
    const ok1 = !r.bad.length && r.par[1] < r.par[3] && r.par[3] < r.par[5] && r.stars === '3,2,1' && r.outOf === 'over'
      && r.demo.states >= r.demo.n && r.demo.empty && r.demo.falling && r.on.bkHole === 1 && r.on.bkGlass >= 1 && !r.off.bkHole && !r.off.bkGlass;
    if (!ok1) failures.push('[blockout puzzles] rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} blockout puzzles: 100 dealt, each cleared by its own pieces and the same twice, par ${[1, 2, 3, 4, 5].map(l => r.par[l]).join('/')} by level, out of pieces over, a board no one plays solving its own, see-through glass and holes`);
    // real input: a puzzle board solved with its own pieces by the real Enter, then a real click on it plays it again
    await page.evaluate(() => window.getFieldApp()._debug.fly(4, 2));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      await page.evaluate(([c, r]) => window.getFieldApp().onReset(c, r), fc);
      const mid = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; });
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(500);
      const st = () => page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); return g ? { st: g.state, used: g.used, par: g.puz && g.puz.par, layers: g.layers, live: D.LIVE } : null; }, fc);
      real.start = await st();
      // each piece turned and placed as its solution has it (the turning is checked above), then dropped by the real Enter
      for (let k = 0; k < 12; k++){
        const more = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); if (!g || g.state !== 'play' || !g.cur) return false;
          const q = g.puz.seq[g.used]; Object.assign(g.cur, { o: q.o, x: q.x, y: q.y, z: g.H }); return true; }, fc);
        if (!more) break;
        await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      }
      real.end = await st();
      const best = await page.evaluate(() => JSON.parse(localStorage.getItem('blockout.best') || '{}'));
      real.best = Object.keys(best).some(k => k.startsWith('p'));
      // see-through by the real V and the row's real See tile (while a game is played: start the board again)
      await page.evaluate(([c, r]) => { const A = window.getFieldApp(); A.onReset(c, r); A._debug.start(A._debug.games.get(c + '_' + r)); }, fc);
      await page.waitForTimeout(400);
      const g0 = await page.evaluate(() => window.getFieldApp()._debug.SET.glass);
      await page.keyboard.press('v'); await page.waitForTimeout(200);
      const g1 = await page.evaluate(() => window.getFieldApp()._debug.SET.glass);
      await page.evaluate(() => { if (!window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); } }); await page.waitForTimeout(700);   // (the row is opened by hand: Oct 28)
      const tile = await page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_7' && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      if (tile){ await page.mouse.click(tile[0], tile[1]); await page.waitForTimeout(300); }
      const g2 = await page.evaluate(() => window.getFieldApp()._debug.SET.glass);
      real.glass = [g0, g1, g2];
      // and a solved board, tapped, starts again where it is (Oct 29: only you move to another board)
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); g.state = 'done'; g.cur = null; }, fc);
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(800);
      real.next = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.games.get(L.c + '_' + L.r); return L && { c: L.c, r: L.r, st: g && g.state }; });
    }
    const ok2 = !!fc && real.start && real.start.st === 'play' && real.end && real.end.st === 'done' && real.end.used === real.end.par && real.best
      && real.glass[1] === !real.glass[0] && real.glass[2] === real.glass[0] && real.next && real.next.c === fc[0] && real.next.st !== 'done';
    if (!ok2) failures.push('[blockout puzzles] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} blockout puzzles: a real click starts one, its own pieces by the real Enter clear it in par with a best kept, the real V and See tile switch see-through, a real click on it cleared plays it again`);
  }
  // SOMA (Oct 23: "Soma or burr puzzles"): the seven pieces' orientations, the corner's board the cube and the solver filling it,
  // every board's own figure filled by the solver at every level, more pieces farther out, and a board no one plays building
  // its figure; then real input: the real arrow and E moving and turning the piece in hand, the real H putting the next piece
  // of a way where it goes and the real Enter placing it, a real click on a placed piece taking it back, the figure finished by
  // real H and Enter with stars and a best kept, and a real click on it then playing it again.
  {
    current = 'soma';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'soma')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = { bad: [] };
      out.ori = D.ORI.map(o => o.list.length).join();
      const C = D.makeFigure(0, 5); out.cube = !!(C.cube && C.sol && C.sol.length === 7 && C.fig.length === 27);
      out.k = {};
      for (let lv = 1; lv <= 5; lv++){
        for (let k = 0; k < 12; k++){ const F = D.makeFigure(200 + k * 41, lv); const s = F && D.solve(F, new Map());
          // (from level 3 a figure may be one that cannot be built: then the solver must find no way)
          if (!F || (F.impossible ? s : (!s || s.length !== F.types.length))) out.bad.push([lv, k]); else if (F.fig.reduce((a, b) => a + b, 0) !== F.types.reduce((a, t) => a + D.PIECES[t].length, 0)) out.bad.push([lv, k, 'cells']); }
        out.k[lv] = D.LV[lv - 1].k;
      }
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r)).join();
      const F = D.figureOf(3, 9), A = D.shownOf(F, 3, 9, 0), seen = new Set();
      for (let t = 0; t < 30; t += 0.25){ const V = D.shownOf(F, 3, 9, t); seen.add(V.placed.size + (V.falling ? 0.5 : 0)); }
      out.demo = seen.size;
      out.stars = [D.starsOf(0), D.starsOf(1), D.starsOf(3)].join();
      return out;
    });
    const ok1 = r.ori === '12,24,12,12,8,12,12' && r.cube && !r.bad.length && r.levels === '5,3,5,5' && r.demo >= 4 && r.stars === '3,2,1' && r.k[1] < r.k[5];
    if (!ok1) failures.push('[soma] rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} soma: orientations ${r.ori}, the cube on the corner filled, 60 figures filled by the solver, a board no one plays building its own`);
    await page.evaluate(() => window.getFieldApp()._debug.fly(3, 2));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      await page.evaluate(([c, r]) => window.getFieldApp().onReset(c, r), fc);
      const rd = () => page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); return g ? { st: g.state, placed: g.placed.size, cur: g.cur && [g.cur.i, g.cur.o, g.cur.x, g.cur.y], turns: g.turns, hints: g.hints, live: D.LIVE } : null; }, fc);
      const s0 = await rd();
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
      let s1 = await rd(); if (s1.cur[2] === s0.cur[2]){ await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150); s1 = await rd(); }
      real.slid = s1.cur[2] !== s0.cur[2];
      await page.keyboard.press('e'); await page.waitForTimeout(150);
      const s2 = await rd(); real.turned = s2.turns > s1.turns;
      await page.keyboard.press('h'); await page.waitForTimeout(150);
      await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const s3 = await rd(); real.placed = s3.placed === 1 && s3.hints === 1;
      // a real click on the top of the placed piece takes it back
      const pt = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r), W = window.FIELD_WORLD, T = W.target, bW = W.boardW();
        const [i, p] = [...g.placed][0], q = D.ORI[g.F.types[i]].list[p.o].map(([a, b, z]) => [p.x + a, p.y + b, p.z + z]).sort((a, b) => b[2] - a[2])[0];
        const SQ = 0.14, u0 = 0.5 - g.F.B[0] * SQ / 2, v0 = 0.5 - g.F.B[1] * SQ / 2;
        const v = new W.THREE.Vector3(T.boardX + (0.5 - (u0 + (q[0] + 0.5) * SQ)) * bW, 0.02 + (q[2] + 1) * SQ * bW, T.boardZ + (0.5 - (v0 + (q[1] + 0.5) * SQ)) * bW).project(W.camera);
        return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, fc);
      await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(400);
      const s4 = await rd(); real.takenBack = s4.placed === 0 && !!s4.cur;
      for (let k = 0; k < 12; k++){ const s = await rd(); if (!s || s.st !== 'play') break; await page.keyboard.press('h'); await page.waitForTimeout(120); await page.keyboard.press('Enter'); await page.waitForTimeout(180); }
      const s5 = await rd(); real.done = s5.st === 'done';
      real.best = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('soma.best') || '{}')).length > 0);
      const mid = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; });
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(800);
      real.next = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.games.get(L.c + '_' + L.r); return L && { c: L.c, r: L.r, st: g && g.state }; });
    }
    const ok2 = !!fc && real.slid && real.turned && real.placed && real.takenBack && real.done && real.best && real.next && real.next.c === fc[0] && real.next.st !== 'done';
    if (!ok2) failures.push('[soma] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} soma: the real arrow and E move and turn it, H and Enter place, a real click takes a piece back, filled with stars and a best, a real click plays it again`);
  }
  // SOMA'S COURSE AND ITS WAYS (Oct 23: "1,2" of what came next: the famous figures on the boards nearest the corner, and the
  // ways each can be filled counted): every one of the sixteen filled by the solver, all seven pieces, on boards 0–15; the
  // cube's ways counted to 240 (of 11,520 fillings) and a figure with no symmetry counting each filling once; then a course
  // board filled by the real H and Enter says a new way and its count, and filled again the same way says it was found.
  {
    current = 'soma course';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'soma')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {};
      out.course = D.COURSE.map((c, i) => { const F = D.courseFigure(i); return !!(F && F.types.length === 7 && F.fig.reduce((a, b) => a + b, 0) === 27 && D.solve(F, new Map())); });
      out.names = D.COURSE.map((c, i) => D.makeFigure(i, 5).name === c[0]).every(Boolean);
      const cube = D.countAll(D.courseFigure(0)); out.cube = [cube.n, cube.raw, cube.done];
      const tower = D.courseFigure(7), t = D.countAll(tower); out.tower = [D.symsOf(tower).length, t.n, t.raw];
      return out;
    });
    const ok1 = r.course.length === 16 && r.course.every(Boolean) && r.names && r.cube.join() === '240,11520,true' && r.tower[0] === 1 && r.tower[1] === r.tower[2] && r.tower[1] > 0;
    if (!ok1) failures.push('[soma course] rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} soma course: 16 figures of all seven filled, the cube's ${r.cube[0]} ways of ${r.cube[1]} fillings, a figure with no symmetry counted filling by filling`);
    // a course board (the steps: board 2 is (1, 0)): filled by the real H and Enter, a new way; again the same way, found before
    await page.evaluate(() => window.getFieldApp()._debug.fly(1, 0));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      const fill = async () => {
        await page.evaluate(([c, r]) => window.getFieldApp().onReset(c, r), fc);
        for (let k = 0; k < 12; k++){ const st = await page.evaluate(([c, r]) => { const g = window.getFieldApp()._debug.games.get(c + '_' + r); return g && g.state; }, fc); if (st !== 'play') break;
          await page.keyboard.press('h'); await page.waitForTimeout(100); await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
        return page.evaluate(([c, r]) => { const A = window.getFieldApp(), D = A._debug, g = D.games.get(c + '_' + r); return { st: g.state, newWay: g.newWay, name: g.F.name, title: A.cellTitle(c, r) }; }, fc);
      };
      await page.waitForFunction(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); const W = g && D.WAYS.get(g.F.idx + '@' + g.F.lv); return W && W.done; }, fc, { timeout: 30000 }).catch(() => {});
      real.first = await fill();
      real.again = await fill();
    }
    const ok2 = !!fc && real.first && real.first.st === 'done' && real.first.newWay === true && real.first.name === 'the steps' || false;
    const ok3 = ok2 && real.again.st === 'done' && real.again.newWay === false && /1 of \d+ ways/.test(real.again.title);
    if (!ok3) failures.push('[soma course] real input: ' + JSON.stringify({ fc, real }));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} soma course: a course board filled by the real H and Enter is a new way, and the same way again is found before (${real.again && real.again.title})`);
  }
  // SOMA: YOUR OWN FIGURE, YOUR WAYS, AND ONE YOU HAVE NOT FOUND (Oct 23: "whats next for soma", then "1,2"): the real ✎ opens
  // the editor on the framed board's figure; a real click takes a cube out of the layer (Check then refuses the count) and
  // another puts it back; the real ✓ keeps it in storage, read back as the page reads it, its title "your figure"; its share
  // link taken onto another board; then filled twice, two ways, the gallery shows each (its cubes all drawn, pulled apart) and
  // the real ▶ tile steps; "show me a way I have not found" builds one whose form is neither of the two, and a real click
  // gives the board back to be built.
  {
    current = 'soma figures and ways';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'soma')));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { localStorage.removeItem('soma.mine'); window.getFieldApp()._debug.fly(5, 3); });
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    const btn = re => page.evaluate(src => { const b = [...document.querySelectorAll('#bbQuick *')].find(e => new RegExp(src).test(e.title || '')); if (!b) return null; const R = b.getBoundingClientRect(); return [R.x + R.width / 2, R.y + R.height / 2]; }, re);
    const cellPt = (x, y, z) => page.evaluate(([x, y, z]) => { const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), B = D.ED.B, SQ = 0.14;
      const u = 0.5 - B[0] * SQ / 2 + (x + 0.5) * SQ, v = 0.5 - B[1] * SQ / 2 + (y + 0.5) * SQ;
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW, 0.02 + (z + 0.5) * SQ * bW, T.boardZ + (0.5 - v) * bW).project(W.camera);
      return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }, [x, y, z]);
    if (fc){
      await page.evaluate(([c, r]) => window.getFieldApp().onReset(c, r), fc);
      await page.waitForTimeout(500);
      await page.evaluate(() => { if (!window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); } }); await page.waitForTimeout(700);   // (✎ is in the row's band: the row opened by hand, Oct 28)
      const mk = await btn('^Make a figure'); if (mk){ await page.mouse.click(mk[0], mk[1]); await page.waitForTimeout(600); }
      const e0 = await page.evaluate(() => { const D = window.getFieldApp()._debug; return { on: D.ED.on, n: D.edCount(), need: D.edNeed(), first: [...D.ED.cells].find(k => k.endsWith(',0')) }; });
      real.opened = e0.on && e0.n === e0.need && e0.n > 0;
      if (e0.first){
        const [x, y] = e0.first.split(',').map(Number);
        let pt = await cellPt(x, y, 0); await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(500);
        real.out = await page.evaluate(k => { const D = window.getFieldApp()._debug; return { n: D.edCount(), gone: !D.ED.cells.has(k), check: D.edCheck() }; }, e0.first);
        await page.waitForTimeout(700);
        pt = await cellPt(x, y, 0); await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(500);
        real.back = await page.evaluate(() => window.getFieldApp()._debug.edCount());
      }
      const dn = await btn('^Done'); if (dn){ await page.mouse.click(dn[0], dn[1]); await page.waitForTimeout(800); }
      real.kept = await page.evaluate(([c, r]) => { const A = window.getFieldApp(), D = A._debug, o = JSON.parse(localStorage.getItem('soma.mine') || '{}'), k = Object.keys(o)[0];
        return { on: D.ED.on, keys: Object.keys(o).length, clean: !!(k && D.cleanFig(o[k])), solvable: !!(k && D.figOfData(+k, D.cleanFig(o[k]))), title: A.cellTitle(c, r) }; }, fc);
      // its share link, taken onto another board
      real.shared = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, F = D.figureOf(c, r);
        const d = { B: F.B, cells: Array.from(F.fig, v => v ? '1' : '0').join(''), types: F.types };
        const P = D.SHARE.dec(new URL(D.SHARE.link(window.getFieldApp(), d)).searchParams.get('setup'));
        const ok = D.takeFig(c + 4, r, P), G = D.figureOf(c + 4, r);
        return ok && G.mine && G.key === F.key; }, fc);
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.LIVE = { c, r }; D.fly(c, r); }, fc);
      await page.waitForTimeout(2500);
      // two ways found (the solver's first, then one not among the found), then the gallery
      real.ways = await page.evaluate(([c, r]) => { const A = window.getFieldApp(), D = A._debug, F = D.figureOf(c, r), out = [];
        for (let n = 0; n < 2; n++){
          A.onReset(c, r); const g = D.gameAt(c, r), have = D.FOUND.get(D.figKey(F)) || new Set();
          const gen = D.countGen(F, w => !have.has(w)); let s; do { s = gen.next(); } while (!s.done);
          if (!s.value || !s.value.sol) break;
          for (const q of s.value.sol){ D.takeUp(g, q.i); Object.assign(g.cur, { o: q.o, x: q.x, y: q.y, k: 0 }); g.cur.k = Math.max(0, D.fitsAt(g).indexOf(q.z)); D.place(g); }
          out.push(g.state === 'done' && g.newWay);
        }
        return { fresh: out, found: (D.FOUND.get(D.figKey(F)) || new Set()).size }; }, fc);
      await page.evaluate(([c, r]) => window.getFieldApp()._debug.galOpen(c, r), fc);
      await page.waitForTimeout(800);
      const g0 = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, F = D.figureOf(c, r); return { k: D.GAL.k, n: D.GAL.list.length, cubes: D.galItems().filter(i => i.kind === 'smCube').length, want: F.fig.reduce((a, b) => a + b, 0) }; }, fc);
      await page.evaluate(() => { if (!window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); } }); await page.waitForTimeout(700);   // (the row is opened by hand: Oct 28)
      const nx = await page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_2' && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      if (nx){ await page.mouse.click(nx[0], nx[1]); await page.waitForTimeout(400); }
      const g1 = await page.evaluate(() => window.getFieldApp()._debug.GAL.k);
      real.gallery = g0.n === 2 && g0.cubes === g0.want && g1 !== g0.k;
      real.galDetail = { g0, g1 };
      // a way not found: built on the board, its form not among the two; a real click then gives the board back
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.galClose(); D.showUnfound(c, r); }, fc);
      await page.waitForFunction(() => !!window.getFieldApp()._debug.DEMO, null, { timeout: 30000 }).catch(() => {});
      real.demo = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, M = D.DEMO; if (!M) return null; const F = D.figureOf(c, r);
        return { len: M.sol.length === F.types.length, notFound: !(D.FOUND.get(D.figKey(F)) || new Set()).has(M.way) }; }, fc);
      await page.waitForTimeout(800);
      const mid = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; });
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(500);
      real.ended = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); return !D.DEMO && !!g && g.state === 'play' && g.placed.size === 0; }, fc);
    }
    const ok = !!fc && real.opened && real.out && real.out.gone && real.out.check === false && real.back === real.out.n + 1
      && real.kept && !real.kept.on && real.kept.keys === 1 && real.kept.clean && real.kept.solvable && /your figure/.test(real.kept.title)
      && real.shared && real.ways && real.ways.fresh.join() === 'true,true' && real.ways.found === 2 && real.gallery && real.demo && real.demo.len && real.demo.notFound && real.ended;
    if (!ok) failures.push('[soma figures and ways] ' + JSON.stringify({ fc, real }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} soma: the real ✎ opens the editor, real clicks take a cube out and put it back, the real ✓ keeps it, shared onto another board; two ways in the gallery stepped by the real ▶; a way not found built and given back by a real click`);
  }
  // SOMA'S PIECE SETS AND BETTER HANDS (Oct 23: "whats next for soma", then "1,3"): the sets (Soma's 7, the 8 tetracubes, the 12
  // pentominoes, the 29 pentacubes, counted again by growing every polycube), each piece's mirror, every course figure of every
  // set filled and generated figures filled, each set's keys its own; then real input: a real two-finger twist turning the
  // piece in hand (the view kept), a real drag to a column where it does not fit ending where it does, and the glow on and off.
  {
    current = 'soma sets and hands';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'soma')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = { sets: {}, bad: [] };
      out.p4 = D.polycubes(4).length; out.p5 = D.polycubes(5).length;
      for (const id of Object.keys(D.SETS)){
        D.useSet(id, true);
        const o = { n: D.PIECES.length, mirror: D.MIRROR.join(','), course: 0 };
        for (let i = 0; i < D.COURSE.length; i++){ const F = D.courseFigure(i); if (F && F.types.reduce((a, t) => a + D.PIECES[t].length, 0) === F.fig.reduce((a, b) => a + b, 0)) o.course++; else out.bad.push(id + ' course ' + i); }
        o.courses = D.COURSE.length;
        for (let k = 0; k < 8; k++){ const F = D.makeFigure(400 + k * 53, 1 + k % 5); if (!F || !D.solve(F, new Map()) !== !!F.impossible) out.bad.push(id + ' gen ' + k); }
        o.key = D.figKey(D.makeFigure(400, 2));
        out.sets[id] = o;
      }
      D.useSet('soma', true);
      return out;
    });
    const S = r.sets, ok1 = !r.bad.length && r.p4 === 8 && r.p5 === 29 && S.soma.n === 7 && S.tetracubes.n === 8 && S.pentominoes.n === 12 && S.pentacubes.n === 29
      && S.soma.mirror === '0,1,2,3,4,6,5' && S.tetracubes.mirror === '0,1,2,3,4,5,7,6' && S.pentominoes.mirror === '0,1,2,3,4,5,6,7,8,9,10,11'
      && Object.values(S).every(o => o.course === o.courses && o.courses > 0) && S.soma.key === '400@2' && /^tetracubes:/.test(S.tetracubes.key);
    if (!ok1) failures.push('[soma sets] ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} soma sets: 7, 8, 12 and 29 pieces (8 tetracubes and 29 pentacubes grown cube by cube), mirrors paired, every course figure and generated figure filled, each set's keys its own`);
    await page.evaluate(() => window.getFieldApp()._debug.fly(3, 2));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      await page.evaluate(([c, r]) => window.getFieldApp().onReset(c, r), fc);
      await page.waitForTimeout(400);
      const st = () => page.evaluate(([c, r]) => { const W = window.FIELD_WORLD, D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r); return { turns: g.turns, o: g.cur && g.cur.o, yaw: W.st.yaw, x: g.cur && g.cur.x, y: g.cur && g.cur.y, fits: D.fitsAt(g).length }; }, fc);
      // (the drag first: after the touches the field takes no mouse for a while, as a phone's own mouse events follow its touches)
      // a column where the piece does not fit, with one it does fit within reach: a real drag there ends where it fits
      const plan = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.games.get(c + '_' + r), p = g.cur, B = g.F.B, x0 = p.x, y0 = p.y;
        let want = null;
        for (let y = -1; y <= B[1] && !want; y++) for (let x = -1; x <= B[0] && !want; x++){ p.x = x; p.y = y; if (!D.fitsAt(g).length){ const s = D.snapNear(g, x, y); if (s) want = { x, y, s }; } }
        p.x = x0; p.y = y0; return want && { ...want, x0, y0, SQ: D.sqOf(B) }; }, fc);
      if (plan){
        const proj = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW, 0.02, T.boardZ + (0.5 - v) * bW).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }, [u, v]);
        const a0 = await proj(0.5, 0.5), a1 = await proj(0.5 + (plan.x - plan.x0) * plan.SQ, 0.5 + (plan.y - plan.y0) * plan.SQ);
        await page.mouse.move(a0[0], a0[1]); await page.mouse.down();
        for (let k = 1; k <= 10; k++){ await page.mouse.move(a0[0] + (a1[0] - a0[0]) * k / 10, a0[1] + (a1[1] - a0[1]) * k / 10); await page.waitForTimeout(40); }
        await page.mouse.up(); await page.waitForTimeout(400);
        const t2 = await st();
        real.snap = t2.fits > 0 && t2.x === plan.s[0] && t2.y === plan.s[1];
        real.snapDetail = { plan, t2 };
      }
      const t0 = await st();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      // (Oct 24: "two finger rotate does not work for some applications, such as soma."): a twist turns the piece only when a
      // finger came down on it or its shadow; one begun elsewhere turns the view, as in every other game
      const twist = async (cx, cy) => { const pts = a => [0, 180].map((o, id) => ({ x: cx + 120 * Math.cos((a + o) * Math.PI / 180), y: cy + 120 * Math.sin((a + o) * Math.PI / 180), id }));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
        for (let k = 1; k <= 14; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(70 * k / 14) }); await page.waitForTimeout(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(500); };
      const onPiece = await page.evaluate(() => { const A = window.getFieldApp(), hits = [];
        for (let y = 100; y < 760; y += 10) for (let x = 100; x < 1180; x += 10) if (A.twistTurns([{ x, y }])) hits.push([x, y]);
        return hits.length ? hits.reduce((a, h) => [a[0] + h[0] / hits.length, a[1] + h[1] / hits.length], [0, 0]) : null; });
      // a middle for the off twist whose two fingers (120 px either side) are both off the piece, nearest the screen's middle
      // (on CI's screen the piece lay under the screen's middle itself)
      const offPiece = await page.evaluate(() => { const A = window.getFieldApp(), off = (x, y) => !A.twistTurns([{ x, y }]);
        let best = null;
        for (let y = 250; y <= 650; y += 25) for (let x = 340; x <= 940; x += 25){ if (!(off(x, y) && off(x + 120, y) && off(x - 120, y))) continue;
          const d = Math.hypot(x - 640, y - 450); if (!best || d < best.d) best = { x, y, d }; }
        return best && [best.x, best.y]; }), offFree = !!offPiece;
      if (onPiece) await twist(onPiece[0] - 120, onPiece[1]);   // the first finger lands on the piece
      const t1 = await st();
      if (offFree){ await twist(offPiece[0], offPiece[1]); await page.waitForTimeout(800); }
      const t3 = await st();
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      real.twist = !!onPiece && t1.turns === t0.turns + 1 && Math.abs(t1.yaw - t0.yaw) < 1e-6;
      real.twistView = offFree && t3.turns === t1.turns && Math.abs(t3.yaw - t1.yaw) > 20;
      real.twistDetail = { onPiece, offFree, t0, t1, t3 };
      real.glow = await page.evaluate(([c, r]) => { const A = window.getFieldApp(), D = A._debug, n = () => A.cellItems(c, r).filter(i => i.kind === 'smFit').length;
        const on = n(); D.SET.fits = false; const off = n(); D.SET.fits = true; return on > 0 && off === 0; }, fc);
    }
    const ok2 = !!fc && real.twist && real.twistView && real.snap && real.glow;
    if (!ok2) failures.push('[soma hands] ' + JSON.stringify({ fc, real }));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} soma hands: a real two-finger twist begun on the piece turns it and not the view, one begun off it turns the view, a real drag to a column it does not fit ends where it does, the glow on and off`);
  }
  // SOMA: DIFFICULTY FROM THE COUNT, AND CAN IT BE BUILT? (Oct 23: "whats next for soma", then "2,1"): the figure kept is the one
  // with the fewest ways of several (level 4's ways fewer on average than one made alone), its par from its pieces and ways, stars
  // for time; from level 3 some figures cannot be built, proved by the solver trying every way, a piece short of buildable; boards
  // no one plays stop a piece short from level 3; the title keeps the count back; then real input: the real N on a figure that
  // cannot be built takes it, and a real click on the row's ✗ on one that can costs a hint.
  {
    current = 'soma difficulty and can it be built';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'soma')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {};
      const avg = K => { const keep = D.PICK_K.slice(); D.PICK_K[3] = K; let s = 0, n = 0; for (let k = 0; k < 12; k++){ const F = D.makeFigure(5000 + k * 71, 4); if (!F.impossible){ s += F.waysExact ? F.waysN : 1000; n++; } } D.PICK_K.splice(0, 5, ...keep); return s / n; };
      out.one = avg(1); out.four = avg(4);
      out.par = [D.parFor(7, 1), D.parFor(7, 200), D.parFor(3, 2)];
      out.stars = [D.timeStars(30000, 60), D.timeStars(90000, 60), D.timeStars(200000, 60)].join();
      // a board that cannot be built, and one at its level that can
      let imp = null, ok = null;
      for (let c = 40; c < 140 && !(imp && ok); c++){ const lv = D.levelOf(c, 3); if (lv < 3) continue; const F = D.figureOf(c, 3); if (F.impossible && !imp) imp = [c, 3]; else if (!F.impossible && !ok && D.canSay(F)) ok = [c, 3]; }
      out.imp = imp; out.ok = ok;
      if (imp){ const F = D.figureOf(...imp), info = {}, s = D.solve(F, new Map(), 5e6, info), part = D.shownSol(F);
        const used = new Set(); let clash = false;
        for (const q of part) for (const c of D.ORI[F.types[q.i]].list[q.o].map(([a, b, z]) => [q.x + a, q.y + b, q.z + z])){ const i = (c[2] * F.B[1] + c[1]) * F.B[0] + c[0]; if (!F.fig[i] || used.has(i)) clash = true; used.add(i); }
        out.proof = !s && !info.capped; out.part = part.length === F.types.length - 1 && !clash;
        let most = 0; for (let t = 0; t < 40; t += 0.2) most = Math.max(most, D.shownOf(F, imp[0], imp[1], t).placed.size);
        out.shown = most === F.types.length - 1;
        out.title = window.getFieldApp().cellTitle(...imp); }
      return out;
    });
    const ok1 = r.four < r.one && r.par[0] > r.par[1] && r.par[1] > r.par[2] && r.stars === '3,2,1' && r.imp && r.ok && r.proof && r.part && r.shown && !/ways/.test(r.title);
    if (!ok1) failures.push('[soma difficulty] ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} soma difficulty: level 4's ways ${r.one && r.one.toFixed(0)} made alone, ${r.four && r.four.toFixed(0)} the fewest of four; pars ${r.par && r.par.join('/')} s; a figure that cannot be built proved so, shown a piece short, its count kept back`);
    const real = {};
    if (r.imp && r.ok){
      for (const [key, at] of [['imp', r.imp], ['ok', r.ok]]){
        await page.evaluate(([c, rr]) => window.getFieldApp()._debug.fly(c, rr), at);
        await page.waitForTimeout(3000);
        await page.evaluate(([c, rr]) => window.getFieldApp().onReset(c, rr), at);
        await page.waitForTimeout(400);
        if (key === 'imp'){ await page.keyboard.press('n'); await page.waitForTimeout(400); }
        else {
          const tiles = await page.evaluate(([c, rr]) => window.getFieldApp().statTiles(c, rr).length, at);
          await page.evaluate(() => { if (!window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); } }); await page.waitForTimeout(700);   // (the row is opened by hand: Oct 28)
          // (the tile is waited for, and for it to hold still: on a busy runner the row had not laid it out 700 ms after it opened, the click was skipped
          // and the hint never counted: CI, Nov 7. Where it was found is kept for the failure's message.)
          const where = n => page.evaluate(n => { const el = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_' + (n - 1) && t.style.display !== 'none'); if (!el) return null; const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, n);
          let t = null, tries = 0;
          for (; tries < 40; tries++){ const a = await where(tiles); await page.waitForTimeout(250); const b = await where(tiles); if (a && b && Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1){ t = b; break; } }
          // (Nov 9: if the click did not count a hint it is given again, once the tile has held still: on CI and on main the first click sometimes fell on a row still moving. A click that worked is not repeated, since a second would cost another hint)
          const hintsNow = () => page.evaluate(([c, rr]) => { const g = window.getFieldApp()._debug.games.get(c + '_' + rr); return g ? g.hints : -1; }, at);
          for (let again = 0; again < 3 && t; again++){
            await page.mouse.click(t[0], t[1]); await page.waitForTimeout(600);
            if ((await hintsNow()) >= 1) break;
            let t2 = null; for (let k = 0; k < 40 && !t2; k++){ const a = await where(tiles); await page.waitForTimeout(250); const b = await where(tiles); if (a && b && Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1) t2 = b; }
            if (t2) t = t2;
          }
          real.tile = { tiles, at: t, tries };
        }
        real[key] = await page.evaluate(([c, rr]) => { const A = window.getFieldApp(), g = A._debug.games.get(c + '_' + rr); return g && { st: g.state, said: !!g.said, hints: g.hints, title: A.cellTitle(c, rr) }; }, at);
      }
    }
    const ok2 = real.imp && real.imp.st === 'done' && real.imp.said && real.ok && real.ok.st === 'play' && real.ok.hints === 1;
    if (!ok2) failures.push('[soma can it be built] ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} soma can it be built: the real N on one that cannot be built takes it, a real click on ✗ on one that can costs a hint`);
  }
  // SOMA'S TILT IS FREE (Oct 29: "soma clamping of the tilt is to aggressive. I want to see all sides of the cube from the ground
  // level and from above."): it opens at 60°, may be tipped to nearly along the ground and to straight down, and the next game
  // has the field's own stops again (mini golf's floor 45°, nothing past 75°)
  {
    current = 'soma tilt';
    const before = failures.length;
    const t = await page.evaluate(async () => {
      const W = window.FIELD_WORLD, wait = ms => new Promise(ok => setTimeout(ok, ms)), out = {};
      // (a tilt is held to the stops once a frame is drawn, and mini golf's frames take seconds in the software renderer: ask, then
      //  wait until the number has moved, up to 15 s, and a moment more)
      const tilt = async (v, held = true) => { W.st.pitch = v; for (let k = 0; held && k < 60 && Math.abs(W.st.pitch - v) < 1e-6; k++) await wait(250); await wait(300); return W.st.pitch; };
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'soma')); await wait(5000);   // (the opening fit looks again for about three seconds, until a touch: a tilt set inside them was put back to 60° on CI)
      out.open = W.st.pitch;
      out.low = await tilt(0); out.high = await tilt(95); out.mid = await tilt(30, false);
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'minigolf')); await wait(5000);
      out.golfHigh = await tilt(95); out.golfLow = await tilt(0);
      return out; });
    if (!(Math.abs(t.open - 60) < 1 && t.low < 10 && t.high >= 88 && Math.abs(t.mid - 30) < 1 && t.golfHigh <= 75 && t.golfLow >= 44))
      failures.push(`[${current}] ${JSON.stringify(t)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} soma tilt (opens at ${Math.round(t.open)}°, tipped to ${t.low.toFixed(1)}° and ${t.high.toFixed(0)}°; mini golf kept to ${t.golfLow.toFixed(0)}–${t.golfHigh.toFixed(0)}°)`);
  }
  // THE TILT AN APP'S FLOOR LIFTED IS PUT BACK (Oct 23: 3D Tetris's floor of 68° stayed on every game after it, and mini golf
  // opened at 68° at its zoom ceiling): mini golf, then 3D Tetris (lifted to its floor), then mini golf again at its own tilt
  {
    current = 'tilt put back';
    const tilt = async id => { await page.evaluate(id => window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)), id); await page.waitForTimeout(1500); return page.evaluate(() => window.FIELD_WORLD.st.pitch); };
    // (Nov 1: 3D Tetris's tilt is free now, `pitchFloor`, so it lifts nothing; air raid's floor of 50° is the lift this checks)
    const p0 = await tilt('minigolf'), p1 = await tilt('airraid'), p2 = await tilt('minigolf');
    const ok = p1 >= 50 && Math.abs(p2 - p0) < 1e-6;
    if (!ok) failures.push(`[${current}] mini golf ${p0}°, air raid ${p1}°, mini golf again ${p2}°`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} the tilt an app's floor lifted is put back (mini golf ${p0}°, air raid ${p1}°, mini golf again ${p2}°)`);
  }
  // LIGHTS OUT (Oct 16: "what other simple games could we do", then "lights out, nonograms and whack a mole"): every board
  // its own pattern at a level by its ring, its par the fewest presses (checked here by light chasing, a different way to
  // the page's elimination); the way out puts it out; real clicks flip the right cross; five quick real touches on one
  // square are five presses; a board no one plays presses its own way out.
  {
    current = 'lightsout';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'lightsout')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      out.sizes = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.dealOf(c, r).n);
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      out.same = D.makeDeal(1234, 3).start.join('') === D.makeDeal(1234, 3).start.join('');
      out.differ = D.makeDeal(1234, 3).start.join('') !== D.makeDeal(1235, 3).start.join('');
      // the fewest presses by light chasing: every choice of the top row's presses, each row then pressed under the lights
      // left above it; the bottom row dark is a way out. Exact for any size, and nothing like the page's elimination.
      const chase = (n, L0) => { let best = Infinity;
        for (let m = 0; m < (1 << n); m++){ const L = L0.slice(); let w = 0;
          for (let x = 0; x < n; x++) if (m >> x & 1){ D.pressOn(L, n, x); w++; }
          for (let y = 1; y < n; y++) for (let x = 0; x < n; x++) if (L[(y - 1) * n + x]){ D.pressOn(L, n, y * n + x); w++; }
          if (!L.some(v => v)) best = Math.min(best, w); }
        return best; };
      out.bad = []; out.par = {}; out.ms = {};
      for (let lv = 1; lv <= 5; lv++){
        const pars = [], t0 = performance.now(), K = 15;
        for (let k = 0; k < K; k++){
          const S = D.makeDeal(500 + 37 * k + lv * 1000, lv), want = chase(S.n, S.start);
          const L = S.start.slice(); for (const i of S.sol) D.pressOn(L, S.n, i);
          if (S.par !== want || L.some(v => v) || S.sol.length !== S.par || S.n !== D.LV[lv - 1].n) out.bad.push({ lv, k, par: S.par, want, n: S.n });
          pars.push(S.par);
        }
        out.ms[lv] = +((performance.now() - t0) / K).toFixed(2);
        out.par[lv] = { mean: +(pars.reduce((a, b) => a + b, 0) / K).toFixed(1), min: Math.min(...pars), max: Math.max(...pars), inBand: pars.filter(p => p >= D.LV[lv - 1].lo && p <= D.LV[lv - 1].hi).length };
      }
      // a game played by its own way out: out, three stars; a hint is a press of a shortest way, one fewer after it
      const g = D.fresh(0, 0); D.GAMES.set('0_0', g);
      const h = D.hint(g), before = D.solveLO(g.n, g.L).length; D.press(g, h, true); const afterHint = D.solveLO(g.n, g.L).length;
      for (const i of D.solveLO(g.n, g.L)) D.press(g, i, true);
      out.played = { done: g.done, moves: g.moves, par: g.S.par, stars: D.starsOf(g.moves, g.S.par), hintStep: before - afterHint };
      out.stars = [D.starsOf(6, 6), D.starsOf(9, 6), D.starsOf(10, 6)].join();
      D.GAMES.delete('0_0');
      return out;
    });
    const ok1 = r.sizes.join() === '5,5,7,7' && r.levels.join() === '2,3,5,5' && r.same && r.differ && !r.bad.length
      && r.played.done && r.played.moves === r.played.par && r.played.stars === 3 && r.played.hintStep === 1 && r.stars === '3,2,1'
      && [1, 2, 3, 4, 5].every(lv => r.par[lv].inBand === 15) && r.par[1].mean < r.par[3].mean && r.par[3].mean < r.par[5].mean;
    if (!ok1) failures.push('[lightsout] rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} lightsout: par is the fewest presses on 75 boards (by light chasing), pars ${[1, 2, 3, 4, 5].map(l => r.par[l].mean).join('/')} by level, the way out puts it out`);
    // real clicks: fly to a board, click a square, and the cross about it (and nothing else) flips
    await page.evaluate(() => window.FIELD_APPS.find(a => a.id === 'lightsout')._debug.fly(3, 1));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const key = fc[0] + '_' + fc[1];
      // (the point of the framed board at (u, v), projected here, as Simon's check does)
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
      const flips = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.GAMES.delete(c + '_' + r); D.LIVE = { c, r }; return D.gameAt(c, r).n; }, fc);
      const n = flips, picks = [[1, 2], [0, 0], [n - 1, n - 2]];
      const got = [];
      for (const [x, y] of picks){
        const before = await page.evaluate(k => Array.from(window.getFieldApp()._debug.GAMES.get(k).L), key);
        const pt = await aimAt((x + 0.5) / n, (y + 0.5) / n);
        await page.mouse.click(pt.x, pt.y);
        await page.waitForTimeout(700);    // (more than a double-tap's reach apart, as a person's clicks on different squares)
        const after = await page.evaluate(k => Array.from(window.getFieldApp()._debug.GAMES.get(k).L), key);
        const changed = after.map((v, i) => v !== before[i] ? i : -1).filter(i => i >= 0).join();
        const want = await page.evaluate(([n, i]) => window.getFieldApp()._debug.crossOf(n, i).sort((a, b) => a - b).join(), [n, y * n + x]);
        got.push({ changed, want });
      }
      const moves = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).moves, key);
      real = { n, got, moves };
    }
    const ok2 = real && real.moves === 3 && real.got.every(g => g.changed === g.want);
    if (!ok2) failures.push('[lightsout] real clicks: ' + JSON.stringify({ fc, real }));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} lightsout: three real clicks flip the cross about each square clicked, corner and edge too`);
    // five quick real touches on one square are five presses, each a flip (Simon's lesson: a quick second tap on one spot
    // was read as a double-tap and never reached the game)
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
      const n = g.n, i = 1 * n + 1, start = g.S.start, seen = [];
      for (let k = 0; k < 5; k++){ await tap((1 + 0.5) / n, (1 + 0.5) / n, 200); seen.push(g.L.some((v, j) => v !== start[j]) ? 1 : 0); }
      const cross = D.crossOf(n, i), odd = Array.from(g.L).every((v, j) => v === (cross.includes(j) ? 1 - start[j] : start[j]));
      return { moves: g.moves, seen: seen.join(''), odd, noDbl: A.noDoubleTap() };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const ok3 = quick.moves === 5 && quick.seen === '10101' && quick.odd;
    if (!ok3) failures.push('[lightsout] quick taps on one square: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} lightsout: five quick real touches on one square are five presses (${quick.moves}), flipping it each time (${quick.seen})`);
    // a board no one plays presses its own way out, one square at a time
    const demo = await page.evaluate(async () => { const D = window.getFieldApp()._debug, S = D.dealOf(9, 9), seen = new Set();
      for (let k = 0; k < 40; k++){ seen.add(D.shownOf(S).m); await new Promise(ok => setTimeout(ok, 100)); } return seen.size; });
    if (demo < 3) failures.push('[lightsout] demo board did not move: ' + demo);
    console.log(`${demo >= 3 ? 'ok  ' : 'FAIL'} lightsout: a board no one plays presses its own way out (${demo} steps seen in 4 s)`);
  }
  // WHACK-A-MOLE (Oct 16: "what other simple games could we do", then "lights out, nonograms and whack a mole"): every board
  // its own round of pops, the same each time, at a level by its ring (more holes, shorter stays, a quicker pace farther out,
  // bombs and golden moles from level 3); a mole is a point, a gold one three, a bomb and an empty hole cost; the round ends
  // at its time and the score is kept as the board's best; real clicks reach the holes, five quick real touches on one hole
  // are five whacks; a board no one plays pops its own moles.
  {
    current = 'whackamole';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'whackamole')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      out.holes = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.roundOf(c, r).D.n);
      const sched = G => JSON.stringify(G.pops.map(p => [p.t.toFixed(3), p.i, p.up.toFixed(3), p.type]));
      const a = sched(D.roundAt(77, 3)); D.ROUNDS.clear(); const b = sched(D.roundAt(77, 3)), c = sched(D.roundAt(78, 3));
      out.same = a === b; out.differ = a !== c;
      // what grows with the level, over ten boards: pops in a round, the stays, the holes, bombs
      out.grow = [1, 2, 3, 4, 5].map(lv => { let pops = 0, up = 0, bombs = 0, par = 0, okPar = true;
        for (let k = 0; k < 10; k++){ const G = D.roundAt(500 + k * 13, lv); pops += G.pops.length; up += G.pops.reduce((s, p) => s + p.up, 0) / G.pops.length;
          bombs += G.pops.filter(p => p.type === 'bomb').length; par += G.par; if (!(G.par >= 1 && G.par <= G.pops.reduce((s, p) => s + Math.max(0, { mole: 1, gold: 3, bomb: 0 }[p.type]), 0))) okPar = false;
          for (let j = 1; j < G.pops.length; j++) if (G.pops[j].t < G.pops[j - 1].t) okPar = false; }
        return { n: D.LV[lv - 1].n, pops: pops / 10, up: +(up / 10).toFixed(3), bombs: bombs / 10, par: par / 10, okPar }; });
      // the rules on a round of our own: a mole (and a second whack on it while squashed, free), a gold one, an empty hole,
      // a bomb, the floor at nothing
      const g = D.fresh(0, 0); D.GAMES.set('0_0', g); D.LIVE = { c: 0, r: 0 };
      g.G = Object.assign({}, g.G, { pops: [{ t: 0, i: 0, up: 5, type: 'mole' }, { t: 0, i: 1, up: 5, type: 'gold' }, { t: 0, i: 2, up: 5, type: 'bomb' }, { t: 8, i: 0, up: 1, type: 'mole' }] });
      g.state = 'play'; g.t0 = D.clock() - 1;
      const seq = [D.tap(g, 0, true, 1), g.score, D.tap(g, 0, true, 1.05), g.score, D.tap(g, 1, true, 1.1), g.score, D.tap(g, 4, true, 1.2), g.score, D.tap(g, 2, true, 1.3), g.score,
                   D.tap(g, 0, true, 3), g.score, D.tap(g, 0, true, 8.5), g.score];
      out.rules = seq.join();
      out.cell = [D.holeAt(3, 0.01, 0.01), D.holeAt(3, 0.65, 0.34), D.holeAt(3, 0.99, 0.99), D.holeAt(5, 0.5, 0.5)].join();
      // the round ends at its time, and its score is the board's best
      const was = D.BEST.get(g.G.idx + '@' + g.G.lv);
      g.t0 = D.clock() - D.ROUND_T - 0.1; D.stepGame(g, true);
      out.end = { state: g.state, score: g.score, best: D.BEST.get(g.G.idx + '@' + g.G.lv), was };
      return out;
    });
    const gr = r.grow;
    const ok1 = r.levels.join() === '2,3,5,5' && r.holes.join() === '3,4,5,5' && r.same && r.differ
      && gr.every((x, k) => x.okPar && (k === 0 || (x.pops > gr[k - 1].pops && x.up < gr[k - 1].up && x.n >= gr[k - 1].n)))
      && gr[0].bombs === 0 && gr[1].bombs === 0 && gr[2].bombs > 0 && gr[4].bombs > gr[2].bombs
      && r.rules === 'mole,1,bonked,1,gold,4,miss,3,bomb,0,miss,0,mole,1' && r.cell === '0,4,8,12'
      && r.end.state === 'over' && r.end.best === 1;
    // real clicks: one on the framed board starts the count; in play a click on an up mole scores, one on an empty hole costs
    await page.evaluate(() => window.FIELD_APPS.find(a => a.id === 'whackamole')._debug.fly(3, 1));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const key = fc[0] + '_' + fc[1];
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.GAMES.delete(c + '_' + r); }, fc);
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
      const mid = await aimAt(0.5, 0.5);
      await page.mouse.click(mid.x, mid.y);
      await page.waitForTimeout(300);
      const started = await page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? g.state : null; }, key);
      await page.waitForFunction(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g && g.state === 'play'; }, key, { timeout: 15000 }).catch(() => {});
      // (two moles of our own, up for a minute, on the first two holes; the board's own pops taken away)
      const n = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k); if (!g) return 0;
        g.G = Object.assign({}, g.G, { pops: [{ t: 0, i: 0, up: 60, type: 'mole' }, { t: 0, i: 1, up: 60, type: 'mole' }] }); g.t0 = D.clock() - 0.5; g.score = 0; g.got = 0; g.missed = 0; return g.G.D.n; }, key);
      const scores = [];
      if (n){
        for (const i of [0, 1, n * n - 1]){
          const pt = await aimAt(((i % n) + 0.5) / n, (((i / n) | 0) + 0.5) / n);
          await page.mouse.click(pt.x, pt.y);
          await page.waitForTimeout(350);
          scores.push(await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).score, key));
        }
      }
      real = { started, n, scores };
    }
    const ok2 = real && real.started === 'count' && real.scores.join() === '1,2,1';
    // (Simon's lesson, Oct 15: "the simon buttons are very hard to push") five quick real touches on one hole, moles popping
    // there one after another, are five whacks: the field must not read every second one as a double-tap
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
      const n = g.G.D.n, i = Math.floor(n * n / 2);
      // (five moles in that hole, each up as soon as the last is whacked)
      g.G = Object.assign({}, g.G, { pops: [0, 1, 2, 3, 4].map(k => ({ t: k * 0.01, i, up: 60, type: 'mole' })) });
      g.state = 'play'; g.t0 = D.clock() - 1;
      const [u, v] = D.holeUV(n, i);
      for (let k = 0; k < 5; k++) await tap(u + 0.1 / n, v - 0.1 / n, 200);
      return { got: g.got, missed: g.missed, score: g.score, state: g.state, dbl: A.noDoubleTap() };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const ok3 = quick.got === 5 && quick.missed === 0 && quick.dbl;
    if (!ok3) failures.push('[whackamole] quick touches on one hole: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} whackamole: five quick real touches on one hole are five whacks (${quick.got}, ${quick.missed} missed)`);
    // a board no one plays pops its own moles on the page's clock
    // (watched until three layouts are seen, up to 8 s, Oct 17: a board rests 2.5 s between rounds, and a 3 s look that
    //  fell mostly in the rest saw two and failed on CI)
    const demo = await page.evaluate(async () => { const A = window.getFieldApp(), seen = new Set();
      for (let k = 0; k < 80 && seen.size < 3; k++){ seen.add(A.cellItems(9, 9).filter(x => x.kind === 'wmMole' || x.kind === 'wmBomb').map(x => x.u.toFixed(2) + x.v.toFixed(2)).join()); await new Promise(ok => setTimeout(ok, 100)); }
      return seen.size; });
    if (!ok1 || !ok2 || demo < 3) failures.push('[whackamole] ' + JSON.stringify({ r, real, demo }));
    console.log(`${ok1 && ok2 && demo >= 3 ? 'ok  ' : 'FAIL'} whackamole (holes ${r.holes.join('/')} by ring, pops ${gr.map(x => x.pops).join('/')} and par ${gr.map(x => x.par).join('/')} by level, the same round each time; real clicks on a mole scored and on an empty hole cost: ${real && real.scores.join(',')})`);
  }
  // PONG (Oct 27: "lets create a polished pong application. what do you suggest?", then "all. provide cusomtization options in
  // the bottom browser."): levels by ring; no ball through a paddle at any speed; the steady player winning near the corner and
  // losing far out; a board's recording played to its end for par; real input (a click starting, the real arrow and a real drag
  // moving the paddle, two real fingers each taking a paddle with the view still); a point and a match won with stars and a
  // best; power-ups taken; the row's settings changed by a real click on a tile; a board no one plays moving.
  {
    current = 'pong';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'pong')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      // (a paddle always under the ball's crossing, the ball far faster than any serve: never a point)
      const G = D.newMatch(5, 5, { ai0: null, ai1: null, power: false, serveT: 0 }); G.sp = 2.5;
      for (let i = 0; i < 60 * 240; i++){
        for (let k = 0; k < 2; k++){ let tx = D.consts.W / 2; for (const b of G.balls) if ((k === 0) === (b.vy > 0)) tx = D.landing(b.x, b.y, b.vx, b.vy, D.faceY(k)).x; G.pads[k].tx = tx; }
        D.tick(G);
      }
      out.tunnel = { score: G.score.join('-'), hits: G.hits };
      // the steady player's share of the points, by level
      out.share = [1, 5].map(lv => { let a = 0, b = 0; for (let s = 0; s < 4; s++){ const M = D.newMatch(300 + s, lv, { ai0: D.STEADY, power: false, serveT: 1, target: 5 });
        while (M.state !== 'over' && M.t < 600) D.tick(M); a += M.score[0]; b += M.score[1]; } return +(a / (a + b)).toFixed(2); });
      // a recording to its end: par
      const R = D.recOf(321, 2); D.recWork(R, 4000, true);
      out.rec = { done: R.done, par: R.par, frames: R.frames.length / 7, same: (() => { const S = D.recOf(321, 2); return S === R; })() };
      // power-ups taken in a match with them on
      const P = D.newMatch(9, 3, { power: true, ai0: D.STEADY }), got = new Set(); P.ev = (k, a) => { if (k === 'power') got.add(a.id); };
      while (P.state !== 'over' && P.t < 600) D.tick(P);
      out.powers = [...got].sort().join();
      return out;
    });
    const ok1 = r.levels.join() === '2,3,5,5' && r.tunnel.score === '0-0' && r.tunnel.hits > 1000 && r.share[0] > 0.7 && r.share[1] < 0.4
      && r.rec.done && r.rec.par >= 0 && r.rec.frames > 1000 && r.rec.same && r.powers.split(',').length >= 3;
    if (!ok1) failures.push('[pong] ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} pong: levels ${r.levels.join('/')} by ring, ${r.tunnel.hits} returns at speed and none through a paddle, the steady player's share ${r.share.join(' at level 1, ')} at level 5, a recording's par ${r.rec.par}, powers taken ${r.powers}`);
    // real input on a framed board
    await page.evaluate(() => window.getFieldApp()._debug.fly(2, 1));
    await page.waitForTimeout(500); await page.evaluate(() => window.__settle());
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      const key = fc[0] + '_' + fc[1];
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return [(pv.x + 1) / 2 * innerWidth, (1 - pv.y) / 2 * innerHeight]; }, [u, v]);
      const rd = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? { st: g.state, x: g.G.pads[0].x, x1: g.G.pads[1].x, sc: g.G.score.join('-') } : null; }, key);
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      const mid = await aimAt(0.5, 0.45);
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      real.start = (await rd()).st;
      // the real arrow
      // (from the middle, with no finger on it: a paddle already at its left end could not go further, Oct 27)
      await page.evaluate(k => { const P = window.getFieldApp()._debug.GAMES.get(k).G.pads[0]; P.x = 0.31; P.tx = null; P.v = 0; }, key);
      const a0 = (await rd()).x;
      await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(600); await page.keyboard.up('ArrowLeft');
      real.arrow = (await rd()).x < a0 - 0.05;
      // a real drag: the paddle under the finger
      const p0 = await aimAt(0.3, 0.9), p1 = await aimAt(0.75, 0.9);
      await page.mouse.move(p0[0], p0[1]); await page.mouse.down();
      for (let k = 1; k <= 10; k++){ await page.mouse.move(p0[0] + (p1[0] - p0[0]) * k / 10, p0[1]); await page.waitForTimeout(30); }
      await page.waitForTimeout(250);
      real.drag = +(await rd()).x.toFixed(3);
      await page.mouse.up();
      // a point and a match: the computer stands still in a corner; your paddle under the ball
      real.match = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k), G = g.G, pts = [];
        // (a fresh serve of your own first: a ball already past your paddle from the drag above gave the computer a point, Oct 27)
        G.state = 'serve'; G.server = 0; G.serveAt = G.t + G.serveT; G.rally = 0; G.balls = [];
        G.target = 3; G.score = [0, 0]; G.pads[1].ai = { react: 99, err: 0, v: 0, acc: 0, aim: 0 }; G.pads[1].think.next = 1e9; G.pads[1].think.T = 0.05; G.pads[1].x = 0.08;
        const ev = G.ev; G.ev = (kind, a, M) => { if (kind === 'point') pts.push(a.seat); ev && ev(kind, a, M); };
        // (the paddle held still under the ball, inside the walls: set to the ball's x by a wall, the game clamped it there and kept
        //  its speed, so it slid off and a ball running along the wall went past it, about one match in twenty, Oct 27)
        const W = D.consts.W;
        for (let i = 0; i < 60 * 200 && G.state !== 'over'; i++){ const b = G.balls[0], P = G.pads[0], hw = D.hwOf(G, 0); P.tx = b ? b.x : 0.31;
          if (b && b.vy > 0 && b.y > 0.7){ P.x = Math.max(hw, Math.min(W - hw, b.x)); P.v = 0; } D.tick(G); }
        return { pts: pts.join(), score: G.score.join('-') }; }, key);
      await page.waitForTimeout(600);
      real.over = await page.evaluate(([k, c, r]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k); return { st: g.state, best: D.BEST.get(g.idx + '@' + g.lv + '@' + D.SET.target) }; }, [key, ...fc]);
      // two players: a real finger on each half takes its paddle, and the view stays where it is
      await page.evaluate(() => window.getFieldApp()._debug.setting(3));
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      const cam0 = await page.evaluate(() => { const T = window.FIELD_WORLD.target; return [T.boardX, T.boardZ, window.FIELD_WORLD.camera.position.x, window.FIELD_WORLD.camera.position.z].map(v => +v.toFixed(4)).join(); });
      const n0 = await aimAt(0.6, 0.9), f0 = await aimAt(0.4, 0.1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: n0[0], y: n0[1], id: 1 }, { x: f0[0], y: f0[1], id: 2 }] });
      for (let k = 1; k <= 8; k++){
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: n0[0] - k * 10, y: n0[1], id: 1 }, { x: f0[0] + k * 10, y: f0[1], id: 2 }] });
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(300);
      const two = await rd();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const cam1 = await page.evaluate(() => { const T = window.FIELD_WORLD.target; return [T.boardX, T.boardZ, window.FIELD_WORLD.camera.position.x, window.FIELD_WORLD.camera.position.z].map(v => +v.toFixed(4)).join(); });
      real.two = { near: +two.x.toFixed(3), far: +two.x1.toFixed(3), still: cam0 === cam1 };
      await page.evaluate(() => window.getFieldApp()._debug.setting(3));
      // the row's settings: a real click on the Points tile
      if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ const h = await page.$('#bbHandle'); if (h) await h.click(); await page.waitForTimeout(600); }
      const t0 = await page.evaluate(() => window.getFieldApp()._debug.SET.target);
      // (Nov 9: the tile is clicked once it holds still, and again if the setting did not move: a click on the row while it was still sliding in changed nothing, 11 → 11, on CI and on main alike)
      const pTile = () => page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_2' && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      for (let tries = 0; tries < 4 && (await page.evaluate(() => window.getFieldApp()._debug.SET.target)) === t0; tries++){
        let tile = null;
        for (let k = 0; k < 40 && !tile; k++){ const a = await pTile(); if (a){ await page.waitForTimeout(250); const b = await pTile(); if (b && Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1) tile = b; } else await page.waitForTimeout(250); }
        if (tile){ await page.mouse.click(tile[0], tile[1]); await page.waitForTimeout(600); }
      }
      real.tile = { from: t0, to: await page.evaluate(() => window.getFieldApp()._debug.SET.target), stored: await page.evaluate(() => JSON.parse(localStorage.getItem('pong.settings') || '{}').target) };
      await page.evaluate(() => { const D = window.getFieldApp()._debug; while (D.SET.target !== 11) D.setting(2); });
      // a board no one plays moves
      real.idle = await page.evaluate(async ([c, r]) => { const A = window.getFieldApp(), s = () => JSON.stringify(A.cellItems(c + 3, r).filter(i => /^pg(Pad|PadGlow|Cap|Ball|Orb|Cube|Puck)$/.test(i.kind)).map(i => [i.u.toFixed(3), i.v.toFixed(3)]));
        // (its recording is made a little at a time, so on a fresh page it may not have begun: looked at for up to 12 s)
        for (let k = 0; k < 20; k++){ A.cellItems(c + 3, r); await new Promise(ok => setTimeout(ok, 50)); }
        for (let k = 0; k < 8; k++){ const a = s(); await new Promise(ok => setTimeout(ok, 1500)); if (s() !== a) return true; } return false; }, fc);
    }
    const ok2 = !!fc && real.start === 'play' && real.arrow && Math.abs(real.drag - 0.75 * 0.62) < 0.03 && real.match.pts === '0,0,0' && real.over.st === 'over' && real.over.best >= 2
      && real.two.near < 0.6 * 0.62 - 0.02 && real.two.far > 0.4 * 0.62 + 0.02 && real.two.still && real.tile.from === 11 && real.tile.to === 21 && real.tile.stored === 21 && real.idle;
    if (!ok2) failures.push('[pong] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} pong: a real click starts, the real arrow and a real drag move the paddle, a match won with ${real.over && real.over.best} stars, two real fingers take a paddle each with the view still, a real click on the Points tile, a board no one plays moves`);
  }
  // PONG: physics, themes and arenas (Oct 27: "whats next for pong", then "3,4,5"): the curved face reflecting, a hit stepping forward
  // faster, each theme's physics (the bounce, the puck slowing, air hockey's goals, the well), the eight themes painted and drawn,
  // the arenas by level (bumpers, walls, sliding walls, portals) doing what they say, matches with them ending, and a real drag up the
  // table stepping the paddle forward.
  {
    current = 'pong';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'pong')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, C = D.consts, out = {};
      // the curved face: straight on at an end, back at twice the lean; at the middle, an angled ball reflected, not sent straight
      const G = D.newMatch(1, 1, { ai0: null, ai1: null, face: 'curved', phys: null, serveT: 0 });
      G.pads[0].x = 0.31;
      const off = 0.05, o = off / (G.pads[0].hw0 + C.BR), b1 = { x: 0.31 + off, y: 0.9, vx: 0, vy: 0.8, s: 0, trail: [] };
      D.hit(G, b1, 0, b1.x, 0.9); out.curvedEnd = +(Math.atan2(b1.vx, -b1.vy) / (2 * o * C.CURVE_N)).toFixed(3);
      const b2 = { x: 0.31, y: 0.9, vx: 0.4, vy: 0.7, s: 0, trail: [] }; D.hit(G, b2, 0, 0.31, 0.9);
      const F = D.newMatch(1, 1, { ai0: null, ai1: null, face: 'flat', phys: null }), b3 = { x: 0.31, y: 0.9, vx: 0.4, vy: 0.7, s: 0, trail: [] }; F.pads[0].x = 0.31; D.hit(F, b3, 0, 0.31, 0.9);
      out.curvedMid = [+b2.vx.toFixed(3), +b3.vx.toFixed(3)];
      // stepping forward into it: faster than standing still
      const S = D.newMatch(1, 1, { ai0: null, ai1: null, phys: null }); S.pads[0].x = 0.31;
      const b4 = { x: 0.31, y: 0.9, vx: 0, vy: 0.8, s: 0, trail: [] }, b5 = { ...b4, trail: [] };
      D.hit(S, b4, 0, 0.31, 0.9); S.pads[0].vy = 1.2; D.hit(S, b5, 0, 0.31, 0.9);
      out.step = [+Math.hypot(b4.vx, b4.vy).toFixed(3), +Math.hypot(b5.vx, b5.vy).toFixed(3)];
      // a face stepping forward fast never lets a ball through: the near paddle steps in and out under every ball for a minute
      const T = D.newMatch(3, 5, { ai0: null, ai1: null, phys: null, serveT: 0 }); T.sp = 2; let through = 0;
      T.ev = (k, a) => { if (k === 'point') through++; };
      for (let i = 0; i < 60 * 120; i++){
        for (let k = 0; k < 2; k++){ let tx = C.W / 2; for (const b of T.balls) if ((k === 0) === (b.vy > 0)) tx = D.landing(b.x, b.y, b.vx, b.vy, D.faceY(k, T)).x; T.pads[k].tx = tx; }
        T.pads[0].dyT = (i % 40) < 20 ? C.REACH : 0; D.tick(T);
      }
      out.stepThrough = { points: through, hits: T.hits };
      // the bounce (table tennis): once on the receiver's half (the near half from the far serve, then the far), the ball up in between
      const B = D.newMatch(1, 1, { ai0: null, ai1: null, phys: 'table', serveT: 0 }), bo = []; let zmax = 0;
      B.ev = (k) => { if (k === 'bounce') bo.push(+B.balls[0].y.toFixed(2)); };
      for (let i = 0; i < 60 * 3 && B.balls.length < 2; i++){ B.pads[0].tx = B.balls[0] ? B.balls[0].x : 0.31; B.pads[1].tx = B.balls[0] ? B.balls[0].x : 0.31; D.tick(B); if (B.balls[0]) zmax = Math.max(zmax, B.balls[0].z); }
      out.bounce = { at: bo.slice(0, 3), zmax: +zmax.toFixed(3) };
      // the ice: a puck left alone slows to its floor
      const I = D.newMatch(1, 1, { ai0: null, ai1: null, phys: 'ice', serveT: 0 }); D.tick(I);
      const ib = I.balls[0]; ib.x = 0.31; ib.y = 0.5; ib.vx = 0.5; ib.vy = 0.05 * 0 + 0.3; const v0 = Math.hypot(ib.vx, ib.vy);
      for (let i = 0; i < 30; i++) D.tick(I);
      out.ice = [+v0.toFixed(3), +Math.hypot(ib.vx, ib.vy).toFixed(3), +(0.8 * I.sp).toFixed(3)];
      // air hockey: off the end beside the goal it comes back; in the mouth it scores
      const A = D.newMatch(1, 1, { ai0: null, ai1: null, phys: 'air', serveT: 0 }); D.tick(A); let pts = 0; A.ev = (k) => { if (k === 'point') pts++; };
      const ab = A.balls[0]; A.pads[0].x = 0.08; Object.assign(ab, { x: 0.52, y: 0.96, vx: 0, vy: 0.8 }); for (let i = 0; i < 6; i++) D.tick(A);
      out.airWall = { vy: +ab.vy.toFixed(2), pts };
      Object.assign(ab, { x: C.W / 2, y: 0.96, vx: 0, vy: 0.8 }); A.balls = [ab]; for (let i = 0; i < 12; i++) D.tick(A); out.airGoal = pts;
      // the well: a ball passing beside the middle is bent toward it
      const Wl = D.newMatch(1, 1, { ai0: null, ai1: null, phys: 'well', serveT: 0 }), P = D.newMatch(1, 1, { ai0: null, ai1: null, phys: null, serveT: 0 });
      for (const M of [Wl, P]){ D.tick(M); Object.assign(M.balls[0], { x: C.W / 2 + 0.08, y: 0.3, vx: 0, vy: 0.8, s: 0 }); for (let i = 0; i < 24; i++) D.tick(M); }
      out.well = [+Wl.balls[0].vx.toFixed(3), +P.balls[0].vx.toFixed(3)];
      // the arenas: what each level has, twins half a turn about the middle, and each piece doing its part
      out.kinds = [1, 2, 3, 4, 5].map(lv => { const c = {}; for (let i = 0; i < 30; i++) for (const q of D.arenaOf(2000 + i, lv)) c[q.kind] = (c[q.kind] || 0) + 1; return c; });
      const L2 = D.arenaOf(2001, 2); out.twins = L2.every(q => L2.some(p => p.kind === q.kind && Math.abs(p.x - (C.W - q.x)) < 1e-9 && Math.abs(p.y - (1 - q.y)) < 1e-9));
      const Ar = D.newMatch(1, 1, { ai0: null, ai1: null, phys: null, arena: false, serveT: 0 }); D.tick(Ar);
      const ball = Ar.balls[0], hitOf = (piece, x, y, vx, vy) => { Ar.arena = [piece]; Object.assign(ball, { x, y, vx, vy, portT: -9 }); D.arenaStep(Ar, ball); return ball; };
      const bb = hitOf({ kind: 'bump', x: 0.3, y: 0.4, r: 0.04 }, 0.3, 0.4 - 0.05, 0, 0.6); out.bump = +ball.vy.toFixed(2);
      hitOf({ kind: 'wall', x: 0.3, y: 0.4, w: 0.1, h: 0.014, r: 0.05 }, 0.3, 0.4 - 0.016, 0.1, 0.6); out.wall = +ball.vy.toFixed(2);
      hitOf({ kind: 'portal', x: 0.2, y: 0.35, x2: 0.42, y2: 0.65, r: 0.032 }, 0.205, 0.35, 0.1, 0.6); out.portal = [+ball.x.toFixed(3), +ball.y.toFixed(3), +ball.vy.toFixed(2)];
      const mv = { kind: 'mover', x0: 0.3, x: 0.3, y: 0.4, w: 0.1, h: 0.016, A: 0.1, per: 3, ph: 0, r: 0.15 }; out.mover = [+D.moverX(mv, 0).toFixed(3), +D.moverX(mv, 0.75).toFixed(3)];
      // matches with arenas end, at every level
      out.matches = [1, 3, 5].map(lv => { const M = D.newMatch(400 + lv, lv, { ai0: D.STEADY, power: false, arena: true, phys: null, serveT: 1, target: 5 }); while (M.state !== 'over' && M.t < 600) D.tick(M); return M.state + ' ' + M.score.join('-'); });
      // every theme paints and draws (its table, the paddles, the ball)
      out.themes = D.THEMES.map(t => { const cv = D.paint(t.id, 3, 128); const it = D.itemsOf({ balls: [{ x: 0.3, y: 0.5, z: 0.02, trail: [] }], pads: [{ x: 0.3, hw: 0.08, age: 0.05 }, { x: 0.3, hw: 0.075, age: 9 }], score: [3, 7], fx: [], count: 0, pw: null, shake: 0, t: 1, arena: D.arenaOf(9, 5), flash: {}, well: t.id === 'space' }, t.id, 400);
        return t.id + ':' + (cv && cv.width > 0 ? 'p' : '-') + it.length; });
      return out;
    });
    const k5 = r.kinds[4], k3 = r.kinds[2];
    const ok1 = Math.abs(r.curvedEnd - 1) < 0.02 && r.curvedMid[0] > 0.3 && Math.abs(r.curvedMid[1]) < 0.1 && r.step[1] > r.step[0] * 1.3
      && r.stepThrough.points === 0 && r.stepThrough.hits > 200 && r.bounce.at.length >= 2 && r.bounce.at[0] > 0.6 && r.bounce.at[1] < 0.4 && r.bounce.zmax > 0.03
      && r.ice[1] < r.ice[0] && r.ice[1] >= r.ice[2] - 1e-3 && r.airWall.vy < 0 && r.airWall.pts === 0 && r.airGoal === 1 && r.well[0] < -0.02 && Math.abs(r.well[1]) < 1e-6
      && r.kinds[0].bump && !r.kinds[0].wall && r.kinds[1].wall && (k3.mover || k3.bar) && r.kinds[3].portal && k5.portal && r.twins
      && r.bump < 0 && r.wall < 0 && Math.abs(r.portal[0] - 0.425) < 1e-3 && Math.abs(r.portal[1] - 0.65) < 1e-3 && r.portal[2] > 0 && Math.abs(r.mover[1] - 0.4) < 1e-3
      && r.matches.every(m => m.startsWith('over')) && r.themes.length === 8 && r.themes.every(t => /:p\d+$/.test(t));
    if (!ok1) failures.push('[pong] physics, themes and arenas: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} pong: the curved face (${r.curvedEnd} of twice its lean), a step forward ${r.step.join(' → ')}, none through a stepping face in ${r.stepThrough.hits} returns, the bounce at ${r.bounce.at.join('/')}, the puck slowing, air hockey's goals, the well, arenas by level (${JSON.stringify(r.kinds[4])} at level 5), matches with them ${r.matches.join(', ')}, eight themes drawn`);
    // a real drag up the table steps the near paddle forward
    await page.evaluate(() => window.getFieldApp()._debug.fly(3, 2));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let step = null;
    if (fc){
      const key = fc[0] + '_' + fc[1];
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return [(pv.x + 1) / 2 * innerWidth, (1 - pv.y) / 2 * innerHeight]; }, [u, v]);
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      const mid = await aimAt(0.5, 0.45); await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      const p0 = await aimAt(0.5, 0.95), p1 = await aimAt(0.5, 0.85), p2 = await aimAt(0.5, 0.62);
      await page.mouse.move(p0[0], p0[1]); await page.mouse.down();
      for (let k = 1; k <= 8; k++){ await page.mouse.move(p0[0], p0[1] + (p1[1] - p0[1]) * k / 8); await page.waitForTimeout(30); }
      await page.waitForTimeout(300);
      const dyIn = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).G.pads[0].dy, key);
      // (Oct 31: anywhere on his half) on up the table to the middle, the paddle follows, and let go it stays there
      for (let k = 1; k <= 8; k++){ await page.mouse.move(p1[0], p1[1] + (p2[1] - p1[1]) * k / 8); await page.waitForTimeout(30); }
      await page.waitForTimeout(900);
      const dyFar = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).G.pads[0].dy, key);
      await page.mouse.up(); await page.waitForTimeout(500);
      const dyOut = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).G.pads[0].dy, key);
      step = { dyIn: +dyIn.toFixed(3), dyFar: +dyFar.toFixed(3), dyOut: +dyOut.toFixed(3) };
    }
    const ok2 = !!step && step.dyIn > 0.05 && step.dyFar > 0.25 && Math.abs(step.dyOut - step.dyFar) < 0.03;
    if (!ok2) failures.push('[pong] a real drag stepping forward: ' + JSON.stringify(step));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} pong: a real drag up the table takes the paddle with it (${step && step.dyIn}, then ${step && step.dyFar} near the middle), and let go it stays`);
  }
  // AIR HOCKEY (Oct 27: "this is a cool game. what other games could we create like pong.", then "1"): levels by ring; a mallet's
  // swing passed into the puck; the rails, and goals only through a mouth; the puck never inside a mallet; matches ending at
  // every level with the steady player winning near the corner and losing far out; a recording's par; real input (a click
  // starting, a real drag putting the mallet under the finger, the real arrow), a goal and a match won with stars and a best, two
  // real fingers each taking a mallet with the view still, a real click on the Goals tile; a board no one plays moving.
  {
    current = 'airhockey';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'airhockey')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, C = D.consts, out = {};
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      // a still puck struck by a mallet moving at 1: off at about (1 + its bounce) of that, along the line of centres
      const G = D.newMatch(1, 1, { ai0: null, ai1: null }); const M = G.mal[0], p = G.puck;
      Object.assign(p, { x: 0.31, y: 0.7, vx: 0, vy: 0 }); Object.assign(M, { x: 0.31, y: 0.7 + M.r + C.PR - 0.001, vx: 0, vy: -1 });
      D.hitMallet(G, 0); out.strike = [+p.vx.toFixed(3), +p.vy.toFixed(3)];
      // the rail and the goals: beside the mouth it comes back, in the mouth it scores
      const A = D.newMatch(1, 1, { ai0: null, ai1: null }); let goals = 0; A.ev = k => { if (k === 'goal') goals++; };
      Object.assign(A.puck, { x: 0.08, y: 0.93, vx: 0, vy: 1 }); A.mal[0].x = 0.5; A.mal[0].y = 0.6; for (let i = 0; i < 10; i++) D.tick(A);
      out.rail = { vy: +A.puck.vy.toFixed(2), goals };
      Object.assign(A.puck, { x: C.W / 2, y: 0.93, vx: 0, vy: 1 }); for (let i = 0; i < 10; i++) D.tick(A); out.goal = goals;
      // matches: the steady player against the board's computer, the puck never inside a mallet
      let inside = 0;
      out.share = [1, 3, 5].map(lv => { let a = 0, b = 0, ended = 0;
        for (let s = 0; s < 3; s++){ const Mt = D.newMatch(300 + s, lv, { ai0: D.STEADY, seed: s, target: 5 });
          while (Mt.state !== 'over' && Mt.t < 600){ D.tick(Mt); for (const m of Mt.mal) if (Math.hypot(Mt.puck.x - m.x, Mt.puck.y - m.y) < m.r + C.PR - 0.004) inside++; }
          a += Mt.score[0]; b += Mt.score[1]; if (Mt.state === 'over') ended++; }
        return { share: +(a / Math.max(1, a + b)).toFixed(2), ended }; });
      out.inside = inside;
      const R = D.recOf(321, 2); D.recWork(R, 4000, true); out.rec = { done: R.done, par: R.par, frames: R.frames.length / 9 };
      out.themes = D.THEMES.map(t => { const cv = D.paint(t.id, 3, 128); return t.id + ':' + (cv && cv.width > 0 ? 'p' : '-'); }).join();
      return out;
    });
    const ok1 = r.levels.join() === '2,3,5,5' && r.strike[1] < -1.6 && r.strike[1] > -2 && Math.abs(r.strike[0]) < 0.05 && r.rail.vy < 0 && r.rail.goals === 0 && r.goal === 1
      && r.inside === 0 && r.share.every(s => s.ended === 3) && r.share[0].share > 0.7 && r.share[2].share < 0.4 && r.rec.done && r.rec.frames > 1000 && !/-/.test(r.themes);
    if (!ok1) failures.push('[airhockey] ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} airhockey: levels ${r.levels.join('/')}, a swing of 1 sends the puck off at ${-r.strike[1]}, the rail and a goal only in the mouth, the puck never inside a mallet, the steady player's share ${r.share.map(s => s.share).join(' / ')} at levels 1, 3, 5, par ${r.rec.par}, four themes painted`);
    await page.evaluate(() => window.getFieldApp()._debug.fly(2, 1));
    await page.waitForTimeout(500); await page.evaluate(() => window.__settle());
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      const key = fc[0] + '_' + fc[1];
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return [(pv.x + 1) / 2 * innerWidth, (1 - pv.y) / 2 * innerHeight]; }, [u, v]);
      const rd = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? { st: g.state, x: g.G.mal[0].x, y: g.G.mal[0].y, x1: g.G.mal[1].x, y1: g.G.mal[1].y } : null; }, key);
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      const mid = await aimAt(0.5, 0.45); await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      real.start = (await rd()).st;
      // a real drag: the mallet goes where the finger is, across and along
      const p0 = await aimAt(0.5, 0.9), p1 = await aimAt(0.25, 0.7);
      await page.mouse.move(p0[0], p0[1]); await page.mouse.down();
      for (let k = 1; k <= 10; k++){ await page.mouse.move(p0[0] + (p1[0] - p0[0]) * k / 10, p0[1] + (p1[1] - p0[1]) * k / 10); await page.waitForTimeout(30); }
      await page.waitForTimeout(250);
      const d = await rd(); real.drag = [+(d.x / 0.62).toFixed(2), +d.y.toFixed(2)];
      await page.mouse.up();
      const a0 = (await rd()).x; await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
      real.arrow = (await rd()).x > a0 + 0.05;
      // a goal and the match: the computer's mallet held in a corner, the puck sent straight at its goal
      real.match = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k), G = g.G;
        G.target = 3; G.score = [0, 0]; G.mal[1].ai = { react: 99, err: 0, v: 0, acc: 0, attack: 0, aimErr: 0, bank: 0 }; G.mal[1].think.next = 1e9; G.mal[1].T = [0.05, 0.05]; G.mal[1].x = 0.05; G.mal[1].y = 0.05;
        for (let i = 0; i < 60 * 60 && G.state !== 'over'; i++){ if (G.state === 'play' && (G.puck.vy > -0.5 || Math.hypot(G.puck.vx, G.puck.vy) < 0.2)) Object.assign(G.puck, { x: 0.31, y: 0.6, vx: 0, vy: -1.5 }); D.tick(G); }
        return G.score.join('-'); }, key);
      await page.waitForTimeout(600);
      real.over = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k); return { st: g.state, best: D.BEST.get(g.idx + '@' + g.lv + '@' + D.SET.target) }; }, key);
      // two players: a finger on each half takes its mallet, the view stays
      await page.evaluate(() => window.getFieldApp()._debug.setting('players'));
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      const cam = () => page.evaluate(() => { const W = window.FIELD_WORLD; return [W.target.boardX, W.target.boardZ, W.camera.position.x, W.camera.position.z].map(v => +v.toFixed(4)).join(); });
      const cam0 = await cam(), n0 = await aimAt(0.6, 0.85), f0 = await aimAt(0.4, 0.15);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: n0[0], y: n0[1], id: 1 }, { x: f0[0], y: f0[1], id: 2 }] });
      for (let k = 1; k <= 8; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: n0[0] - k * 10, y: n0[1], id: 1 }, { x: f0[0] + k * 10, y: f0[1], id: 2 }] }); await page.waitForTimeout(40); }
      await page.waitForTimeout(300);
      const two = await rd();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      real.two = { near: +(two.x / 0.62).toFixed(2), far: +(two.x1 / 0.62).toFixed(2), farY: +two.y1.toFixed(2), still: cam0 === await cam() };
      await page.evaluate(() => window.getFieldApp()._debug.setting('players'));
      if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ const h = await page.$('#bbHandle'); if (h) await h.click(); await page.waitForTimeout(600); }
      const t0 = await page.evaluate(() => window.getFieldApp()._debug.SET.target);
      // (the row has just opened and a slow frame on CI left its tile still sliding when it was clicked: found once at 7 → 7. The tile is clicked
      //  once it holds still, and once more if the click did not take)
      const tileAt = () => page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_2' && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      const target = () => page.evaluate(() => window.getFieldApp()._debug.SET.target);
      for (let tries = 0; tries < 3 && (await target()) === t0; tries++){
        let tile = null;
        for (let k = 0; k < 40 && !tile; k++){ const a = await tileAt(); if (a){ await page.waitForTimeout(250); const b = await tileAt(); if (b && Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1) tile = b; } else await page.waitForTimeout(250); }
        if (tile){ await page.mouse.click(tile[0], tile[1]); await page.waitForTimeout(600); }
      }
      real.tile = [t0, await target()];
      await page.evaluate(() => { const D = window.getFieldApp()._debug; while (D.SET.target !== 7) D.setting('target'); });
      real.idle = await page.evaluate(async ([c, r]) => { const A = window.getFieldApp(), s = () => JSON.stringify(A.cellItems(c + 3, r).filter(i => /^ahDisc/.test(i.kind)).map(i => [i.u.toFixed(3), i.v.toFixed(3)]));
        // asked again and again until it changes, up to 10 s: on CI the board's recording is worked out a few boards at a time
        const a = s(); for (let k = 0; k < 50; k++){ await new Promise(ok => setTimeout(ok, 200)); if (s() !== a) return true; } return false; }, fc);
    }
    const ok2 = !!fc && real.start === 'play' && Math.abs(real.drag[0] - 0.25) < 0.05 && Math.abs(real.drag[1] - 0.7) < 0.04 && real.arrow && real.match === '3-0' && real.over.st === 'over' && real.over.best >= 2
      && real.two.near < 0.55 && real.two.far > 0.45 && real.two.farY < 0.5 && real.two.still && real.tile[0] === 7 && real.tile[1] === 11 && real.idle;
    if (!ok2) failures.push('[airhockey] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} airhockey: a real click starts, a real drag puts the mallet under the finger (${real.drag}), the real arrow, a match won ${real.match} with ${real.over && real.over.best} stars, two real fingers a mallet each with the view still, a real click on the Goals tile, a board no one plays moves`);
  }
  // SQUASH (Oct 27: "this is a cool game. what other games could we create like pong.", then "2 -squash"; and "whats next for
  // squash", then "3,4,6,7"): levels by ring; a drive up the front wall at its height; the tin, a ball down before the wall and two
  // bounces each ending the rally the right way; the stroke's angle by where it meets you and its kind by how you move; a let and a
  // stroke, and the computer stepping off the striker's way; the guide's ring where the ball comes down, by level, and the ball lit
  // in reach; racquetball's ceiling, no tin and side-out scoring; fives' board and shorter reach; doubles with every seat hitting;
  // the drills (a target hit, a length scored and a short one called, the rally's other side, the clock, a drill's par); matches
  // ending at every level with the steady player winning near the corner and losing far out; a recording's par; real input (a click
  // starting, a real drag running the player under the finger, the real arrow, a real click serving), a match won with stars and a
  // best, two real fingers each taking a player with the view still, real clicks on the Points and Game tiles, a drill started by a
  // real click with the machine feeding; a board no one plays moving.
  {
    current = 'squash';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'squash')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, C = D.consts, out = {}, SQ = D.COURTS.squash, OFF = 'off';
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      // a drive straight up the court strikes the front wall at its height
      const b = { x: C.W / 2, y: 0.75, z: 0.05, vx: 0, vy: 0, vz: 0, roll: false }; const G0 = D.newMatch(1, 1, { seats: [null, null, OFF, OFF], game: 'squash' });
      D.shoot(G0, b, 0, 1.35, 0.12); let zf = null;
      for (let i = 0; i < 2000 && zf == null; i++) D.ballStep(b, 1 / 480, k => { if (k === 'front') zf = b.z; }, SQ);
      out.front = +(zf || 0).toFixed(3);
      // the rules: a rally from seat 0 with nobody near the ball
      const rally = (zw, down, game) => { const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF], game: game || 'squash' }), why = [];
        G.ev = (k, a) => { if (k === 'point') why.push(a.why + ':' + a.seat + (a.scored ? '' : '-'));
          if (k === 'let') why.push('let'); };
        Object.assign(G.pl[0], { x: 0.04, y: 0.97 }); Object.assign(G.pl[1], { x: C.W - 0.04, y: 0.97 });
        Object.assign(G, { state: 'play', to: 1, lastHit: 0, wall: false, bounces: 0, server: 0 });
        Object.assign(G.ball, { x: C.W / 2, y: 0.6, z: 0.06, roll: false });
        if (down){ Object.assign(G.ball, { vx: 0, vy: -0.4, vz: -0.5 }); } else D.shoot(G, G.ball, 0.1, 1.2, zw);
        for (let i = 0; i < 600 && G.state === 'play'; i++) D.tick(G);
        return why.join() + '|' + G.score.join('-'); };
      out.rules = { tin: rally(0.02), down: rally(0, true), notUp: rally(0.12), rbLow: rally(0.02, false, 'racquetball'), fivesTin: rally(0.065, false, 'fives') };
      // the stroke: off your right side to the right, off your left to the left; stepping in a drive, still a drop, back a lob
      const S = D.newMatch(1, 1, { seats: [null, null, OFF, OFF] }), M = S.pl[1]; Object.assign(S, { state: 'play', to: 1, wall: true });
      const sideOf = off => { Object.assign(M, { x: 0.3, y: 0.7, vx: 0, vy: 0 }); Object.assign(S.ball, { x: 0.3 + off * M.reach, y: 0.68, z: 0.05, roll: false }); D.hit(S, 1); return Math.sign(S.ball.vx); };
      out.angle = [sideOf(0.6), sideOf(-0.6)];
      out.shots = [[0, -0.6], [0, 0], [0, 0.6]].map(([vx, vy]) => D.shotOf({ vx, vy }));
      // a let and a stroke: the blue player against red on red's way to the ball, far from it and near it
      const block = (by) => { const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF] }); const ev = []; G.ev = k => ev.push(k);
        Object.assign(G, { state: 'play', to: 0, lastHit: 1, wall: true, server: 1 }); Object.assign(G.ball, { x: 0.3, y: by, z: 0.05 });
        Object.assign(G.pl[0], { x: 0.3, y: 0.8, vx: 0, vy: -0.5 }); Object.assign(G.pl[1], { x: 0.3, y: 0.74 });
        for (let i = 0; i < 20; i++) D.blockStep(G, 0.01);
        D.rallyEnd(G, 1, 'not up'); return (G.call && G.call.text) + ':' + G.score.join('-'); };
      out.block = [block(0.45), block(0.68)];
      // the computer off its turn steps off the striker's way
      { const G = D.newMatch(1, 3, {}); Object.assign(G, { state: 'play', to: 0, wall: true }); Object.assign(G.ball, { x: 0.3, y: 0.45, vx: 0, vy: 0.2, z: 0.1 });
        Object.assign(G.pl[0], { x: 0.3, y: 0.85 }); const T = D.clearOf(G, G.pl[1], [0.3, 0.65]); out.clear = +Math.abs(T[0] - 0.3).toFixed(3); }
      // the guide: where it comes down, foretold; shown by level; the ball lit in reach
      { const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF] }); Object.assign(G, { state: 'play', to: 0, lastHit: 1, wall: false });
        Object.assign(G.ball, { x: 0.3, y: 0.6, z: 0.06 }); D.shoot(G, G.ball, 0.15, 1.3, 0.12);
        const L = D.landing(G), bb = { ...G.ball }; let wall = false, at = null;
        for (let i = 0; i < 2000 && !at; i++) D.ballStep(bb, 1 / 120, k => { if (k === 'front') wall = true; else if (k === 'floor' && wall) at = [bb.x, bb.y]; }, SQ);
        out.land = L && at ? +Math.hypot(L.x - at[0], L.y - at[1]).toFixed(4) : -1; }
      out.guide = [1, 4, 5].map(lv => { const G = D.newMatch(1, lv, { seats: [null, D.LV[lv - 1], OFF, OFF] }); Object.assign(G, { state: 'play', to: 0, lastHit: 1, wall: false });
        Object.assign(G.ball, { x: 0.3, y: 0.6, z: 0.06 }); D.shoot(G, G.ball, 0.15, 1.3, 0.12);
        const a = !!D.liveView({ G }).guide; G.wall = true; G.hits++; const c = !!D.liveView({ G }).guide; return (a ? 'y' : 'n') + (c ? 'y' : 'n'); }).join();
      { const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF] }); Object.assign(G, { state: 'play', to: 0, wall: true }); Object.assign(G.pl[0], { x: 0.3, y: 0.7 });
        Object.assign(G.ball, { x: 0.33, y: 0.69, z: 0.05, vx: 0, vy: 0.01, vz: 0 }); const V = D.liveView({ G }); out.reachLit = !!V.inReach;
        const it = D.itemsOf(V, 'classic', 400); out.guideDrawn = it.filter(i => i.kind === 'sqRing').length; }
      // racquetball: the ceiling turns a high ball down, side-out scoring, won by one
      { const bb = { x: 0.3, y: 0.5, z: 0.4, vx: 0, vy: 0, vz: 1.5, roll: false }; let top = 0, ceil = 0;
        for (let i = 0; i < 240; i++){ D.ballStep(bb, 1 / 120, k => { if (k === 'ceil') ceil++; }, D.COURTS.racquetball); top = Math.max(top, bb.z); } out.ceil = [ceil, +top.toFixed(3)];
        const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF], game: 'racquetball' }); G.server = 0; D.point(G, 1, 'not up'); const a = G.score.join('-');
        G.server = 1; G.score = [10, 10]; D.point(G, 1, 'not up'); out.side = a + ',' + G.score.join('-') + ',' + G.winner; }
      out.fivesReach = +(D.newMatch(1, 1, { game: 'fives' }).pl[1].reach / D.newMatch(1, 1, { game: 'squash' }).pl[1].reach).toFixed(2);
      // doubles: a match ends with every seat having hit
      { const hits = [0, 0, 0, 0]; const G = D.newMatch(77, 1, { ai0: D.STEADY, fmt: 'd1', seed: 3, target: 5, game: 'squash', ev: (k, a) => { if (k === 'hit') hits[a.seat]++; } });
        while (G.state !== 'over') D.tick(G); out.doubles = { hits: hits.join(), on: G.pl.filter(p => !p.off).length, score: G.score.join('-'), t: Math.round(G.t) }; }
      // the drills
      { const G = D.newMatch(5, 1, { seats: [null, OFF, OFF, OFF], drill: true, drillKind: 'targets' }), T = G.drill.tgt;
        Object.assign(G, { state: 'play', to: 0, lastHit: 0, wall: false }); Object.assign(G.ball, { x: T.x, y: 0.3, z: T.z, vx: 0, vy: -2, vz: 0.3 });
        for (let i = 0; i < 30 && G.drill.score === 0; i++) D.tick(G); out.target = [G.drill.score, G.drill.tgt !== T]; }
      out.feeds = ['in', 'short'].map(w => { const G = D.newMatch(5, 1, { seats: [null, OFF, OFF, OFF], drill: true, drillKind: 'feeds' }); const Z = G.drill.DD;
        Object.assign(G, { state: 'play', to: 0, lastHit: 0, wall: true }); G.drill.ret = true; Object.assign(G.ball, { x: 0.3, y: w === 'in' ? Z.deep + 0.1 : Z.deep - 0.2, z: 0.004, vx: 0, vy: 0.05, vz: -0.3 });
        for (let i = 0; i < 10 && G.state === 'play'; i++) D.tick(G); return G.drill.score + ':' + (G.call ? G.call.text : ''); }).join();
      { const G = D.newMatch(5, 3, { seats: [null, OFF, OFF, OFF], drill: true, drillKind: 'rally' }); Object.assign(G, { state: 'play', to: 0, lastHit: 0, wall: false });
        const go = x => { Object.assign(G, { state: 'play', lastHit: 0, wall: false }); Object.assign(G.ball, { x, y: 0.2, z: 0.12, vx: 0, vy: -2, vz: 0 }); for (let i = 0; i < 12 && !G.wall; i++) D.tick(G); };
        go(0.15); go(0.5); const a = G.drill.streak; go(0.5); out.rally = [a, G.drill.streak, G.call && G.call.text]; }
      { const G = D.newMatch(9, 2, { ai0: D.STEADY, drill: true, drillKind: 'feeds' }); while (G.state !== 'over') D.tick(G); out.drillEnd = [G.state, Math.round(G.t), G.drill.feeds]; }
      // matches: the steady player against the board's computer
      out.share = [1, 3, 5].map(lv => { let a = 0, c = 0, ended = 0;
        for (let s = 0; s < 3; s++){ const Mt = D.newMatch(300 + s, lv, { ai0: D.STEADY, seed: s, target: 5, game: 'squash' });
          while (Mt.state !== 'over') D.tick(Mt);
          a += Mt.score[0]; c += Mt.score[1]; if (Mt.state === 'over' && Mt.t < 1500) ended++; }
        return { share: +(a / Math.max(1, a + c)).toFixed(2), ended }; });
      const R = D.recOf(321, 2); D.recWork(R, 4000, true); out.rec = { done: R.done, par: R.par, frames: R.frames.length / 17 };
      D.SET.mode = 'drill'; const RD = D.recOf(321, 2); D.recWork(RD, 4000, true); out.drillRec = { done: RD.done, par: RD.par, kind: RD.G.drill.kind }; D.SET.mode = 'match'; D.RECS.clear();
      out.themes = D.THEMES.map(t => ['squash', 'racquetball', 'fives'].map(g => { const cv = D.paint(t.id, 3, 128, g); return cv && cv.width > 0 ? 'p' : '-'; }).join('')).join();
      const items = D.itemsOf(D.liveView({ G: D.newMatch(5, 2, {}) }), 'classic', 400); out.kinds = [...new Set(items.map(i => i.kind))].sort().join();
      return out;
    });
    const ok1 = r.levels.join() === '2,3,5,5' && Math.abs(r.front - 0.12) < 0.012 && r.rules.tin === 'tin:1|0-1' && r.rules.down === 'down:1|0-1' && r.rules.notUp === 'not up:0|1-0'
      && /^down:1-\|0-0$/.test(r.rules.rbLow) === false && /tin:1/.test(r.rules.fivesTin) && !/tin/.test(r.rules.rbLow)
      && r.angle.join() === '1,-1' && r.shots.join() === 'drive,drop,lob' && r.block[0] === 'LET:0-0' && r.block[1] === 'STROKE:1-0' && r.clear > 0.05
      && r.land >= 0 && r.land < 0.01 && r.guide === 'yy,yn,nn' && r.reachLit && r.guideDrawn >= 2 && r.ceil[0] >= 1 && r.ceil[1] <= 0.5 + 0.02
      && r.side === '0-0,10-11,1' && r.fivesReach === 0.75 && r.doubles.on === 4 && r.doubles.hits.split(',').every(h => +h > 0)
      && r.target[0] === 1 && r.target[1] && r.feeds === '1:,0:SHORT' && r.rally[0] === 2 && r.rally[1] === 0 && r.rally[2] === 'OTHER SIDE' && r.drillEnd[0] === 'over' && r.drillEnd[1] >= 40 && r.drillEnd[1] <= 42 && r.drillEnd[2] >= 8
      && r.share.every(s => s.ended === 3) && r.share[0].share > 0.55 && r.share[2].share < 0.4
      && r.rec.done && r.rec.frames > 1000 && r.drillRec.done && r.drillRec.par >= 1 && !/-/.test(r.themes) && /sqBall/.test(r.kinds) && /sqBody/.test(r.kinds) && /sqBox/.test(r.kinds);
    if (!ok1) failures.push('[squash] ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} squash: levels ${r.levels.join('/')}, a drive strikes the front wall at ${r.front}, the tin, down and not up, the angle off each side and drive/drop/lob by how you move, a let (${r.block[0]}) and a stroke (${r.block[1]}), the computer stepping ${r.clear} off the striker's way, the landing foretold to ${r.land}, the guide by level ${r.guide}, racquetball's ceiling and side-out (${r.side}), fives' reach ${r.fivesReach}, doubles every seat hitting (${r.doubles.hits}, ${r.doubles.score}), a target, a length and a short (${r.feeds}), the rally's other side, a drill over at 40 s with ${r.drillEnd[2]} feeds, the steady player's share ${r.share.map(s => s.share).join(' / ')} at levels 1, 3, 5, par ${r.rec.par}, a ${r.drillRec.kind} drill's par ${r.drillRec.par}, every court painted`);
    await page.evaluate(() => window.getFieldApp()._debug.fly(2, 1));
    await page.waitForTimeout(500); await page.evaluate(() => window.__settle());
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      const key = fc[0] + '_' + fc[1];
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return [(pv.x + 1) / 2 * innerWidth, (1 - pv.y) / 2 * innerHeight]; }, [u, v]);
      const rd = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? { st: g.state, gs: g.G.state, x: g.G.pl[0].x, y: g.G.pl[0].y, x1: g.G.pl[1].x, y1: g.G.pl[1].y, to: g.G.to } : null; }, key);
      // (between rallies the players run free and no ball is in play: held there for the hands' checks)
      const hold = () => page.evaluate(k => { const G = window.getFieldApp()._debug.GAMES.get(k).G; G.state = 'point'; G.nextAt = 1e9; G.next = 0; }, key);
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      const mid = await aimAt(0.5, 0.45); await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      real.start = (await rd()).st;
      await hold();
      // a real drag: the player runs to where the finger is
      const p0 = await aimAt(0.5, 0.9), p1 = await aimAt(0.25, 0.7);
      await page.mouse.move(p0[0], p0[1]); await page.mouse.down();
      for (let k = 1; k <= 10; k++){ await page.mouse.move(p0[0] + (p1[0] - p0[0]) * k / 10, p0[1] + (p1[1] - p0[1]) * k / 10); await page.waitForTimeout(30); }
      await page.waitForTimeout(700);
      const d = await rd(); real.drag = [+(d.x / 0.66).toFixed(2), +d.y.toFixed(2)];
      await page.mouse.up();
      const a0 = (await rd()).x; await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
      real.arrow = (await rd()).x > a0 + 0.05;
      // your serve, waiting: a real click serves it
      await page.evaluate(k => { const D = window.getFieldApp()._debug, G = D.GAMES.get(k).G; D.setServe(G, 0); G.serveAt = G.t + 100; }, key);
      // (Nov 9: clicked again, up to four times, until it is served: on a busy runner the click was taken before the board was ready and the serve stayed waiting, on CI and on main alike)
      let sv = null;
      for (let k = 0; k < 4; k++){ await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(600); sv = await rd(); if (sv.gs === 'play' || sv.gs === 'point') break; }
      real.serve = sv.gs === 'play' || sv.gs === 'point' ? 'served' : sv.gs;
      // the match: the computer held in a back corner, your player put where each ball comes
      real.match = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k), G = g.G, P = G.pl[0], Q = G.pl[1];
        G.target = 3; G.score = [0, 0]; Q.ai = { react: 99, err: 0.03, v: 0, acc: 0, aim: 0, drop: 0, lob: 0 }; Q.think.next = 1e9;
        for (let i = 0; i < 60 * 400 && G.state !== 'over'; i++){
          Object.assign(Q, { x: 0.04, y: 0.97, vx: 0, vy: 0 }); Q.T = [0.04, 0.97];
          if (G.state === 'play' && G.to === 0 && G.wall && G.ball.z < 0.15) Object.assign(P, { x: G.ball.x - 0.3 * P.reach, y: G.ball.y + 0.01, vx: 0, vy: 0, tx: null, ty: null });
          D.tick(G); }
        return G.score.join('-'); }, key);
      await page.waitForTimeout(600);
      real.over = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k); return { st: g.state, best: D.BEST.get(g.idx + '@' + g.lv + '@' + D.SET.game + '@' + D.SET.target) }; }, key);
      // two people: each finger takes the player nearest it, the view stays
      await page.evaluate(() => window.getFieldApp()._debug.setting('players'));
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300); await hold();
      const cam = () => page.evaluate(() => { const W = window.FIELD_WORLD; return [W.target.boardX, W.target.boardZ, W.camera.position.x, W.camera.position.z].map(v => +v.toFixed(4)).join(); });
      const cam0 = await cam(), n0 = await aimAt(0.6, 0.85), f0 = await aimAt(0.35, 0.4);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: n0[0], y: n0[1], id: 1 }, { x: f0[0], y: f0[1], id: 2 }] });
      for (let k = 1; k <= 8; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: n0[0] + k * 6, y: n0[1], id: 1 }, { x: f0[0] - k * 6, y: f0[1], id: 2 }] }); await page.waitForTimeout(40); }
      await page.waitForTimeout(900);
      const two = await rd(), u1 = await page.evaluate(([x, y]) => window.getFieldApp()._debug.uvAt(x, y), [n0[0] + 48, n0[1]]), u2 = await page.evaluate(([x, y]) => window.getFieldApp()._debug.uvAt(x, y), [f0[0] - 48, f0[1]]);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const near = (px, py, u) => u && Math.hypot(px - u.u * 0.66, py - u.v) < 0.06;
      real.two = { a: near(two.x, two.y, u1) && near(two.x1, two.y1, u2) || near(two.x, two.y, u2) && near(two.x1, two.y1, u1), still: cam0 === await cam() };
      await page.evaluate(() => { const D = window.getFieldApp()._debug; while (D.SET.players !== 1) D.setting('players'); });
      if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ const h = await page.$('#bbHandle'); if (h) await h.click(); await page.waitForTimeout(600); }
      const tileAt = n => page.evaluate(n => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_' + n && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, n);
      const t0 = await page.evaluate(() => window.getFieldApp()._debug.SET.target);
      // (the row's tiles are laid out a few frames after it opens, and on a slow runner one click landed before they were: tried up to five
      //  times, a second apart, until the setting moves; a click that works the first time is taken once)
      for (let k = 0; k < 5; k++){
        const tile = await tileAt(3);
        if (tile){ await page.mouse.click(tile[0], tile[1]); await page.waitForTimeout(400); }
        if (await page.evaluate(() => window.getFieldApp()._debug.SET.target) !== t0) break;
        await page.waitForTimeout(1000);
      }
      real.tile = [t0, await page.evaluate(() => window.getFieldApp()._debug.SET.target)];
      await page.evaluate(() => { const D = window.getFieldApp()._debug; while (D.SET.target !== 0) D.setting('target'); });
      const gt = await tileAt(1);
      if (gt){ await page.mouse.click(gt[0], gt[1]); await page.waitForTimeout(400); }
      real.game = await page.evaluate(() => window.getFieldApp()._debug.SET.game);
      await page.evaluate(() => { const D = window.getFieldApp()._debug; while (D.SET.game !== 'squash') D.setting('game'); });
      // a drill: the Mode tile, a real click starting the framed board's drill, the machine feeding
      const mt = await tileAt(2);
      if (mt){ await page.mouse.click(mt[0], mt[1]); await page.waitForTimeout(400); }
      real.mode = await page.evaluate(() => window.getFieldApp()._debug.SET.mode);
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(2600);
      real.drill = await page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g && g.G.drill ? { kind: g.G.drill.kind, feeds: g.G.drill.feeds, left: Math.round(g.G.drill.left) } : null; }, key);
      await page.evaluate(k => { const D = window.getFieldApp()._debug; D.GAMES.delete(k); if (D.SET.mode !== 'match') D.setting('mode'); }, key);
      real.idle = await page.evaluate(async ([c, r]) => { const A = window.getFieldApp(), s = () => JSON.stringify(A.cellItems(c + 3, r).filter(i => /^sq(Body|Ball)/.test(i.kind)).map(i => [i.u.toFixed(3), i.v.toFixed(3)]));
        // asked again and again until it changes, up to 10 s: on CI the board's recording is worked out a few boards at a time
        const a = s(); for (let k = 0; k < 50; k++){ await new Promise(ok => setTimeout(ok, 200)); if (s() !== a) return true; } return false; }, fc);
    }
    const ok2 = !!fc && real.start === 'play' && Math.abs(real.drag[0] - 0.25) < 0.05 && Math.abs(real.drag[1] - 0.7) < 0.04 && real.arrow && real.serve === 'served'
      && /^3-[01]$/.test(real.match) && real.over.st === 'over' && real.over.best >= 2 && real.two.a && real.two.still && real.tile[0] === 0 && real.tile[1] === 5
      && real.game === 'racquetball' && real.mode === 'drill' && real.drill && real.drill.feeds >= 1 && real.idle;
    if (!ok2) failures.push('[squash] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} squash: a real click starts, a real drag runs the player under the finger (${real.drag}), the real arrow, a real click serves, a match won ${real.match} with ${real.over && real.over.best} stars, two real fingers a player each with the view still, real clicks on the Points, Game and Mode tiles, a ${real.drill && real.drill.kind} drill fed, a board no one plays moves`);
  }
  // SQUASH: THE SWING, THE SHOTS, THE STYLES (Oct 27: "whats next for squash", then "1,2,6", and "long press does not work
  // to show bottom browser"): a ball passing a person with Swing hands not hit until a swing, then hit, early and late sending it
  // either way and a mishit slower; a boast meeting the side wall before the front, a kill lower and faster than a drive; flicks
  // read as kill, lob and boast; every style on the boards near the corner and each playing its own shots; and real input: the real
  // Hands and Shot tiles, a real lift swinging, the real Enter swinging.
  {
    current = 'squash';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'squash')));
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, C = D.consts, OFF = 'off', out = {};
      // the swing
      const pass = swing => { const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF], hands: 'swing' }); const P = G.pl[0];
        Object.assign(G, { state: 'play', to: 0, lastHit: 1, wall: true, bounces: 0 }); Object.assign(P, { x: 0.3, y: 0.75 }); Object.assign(G.pl[1], { x: 0.6, y: 0.3 });
        Object.assign(G.ball, { x: 0.32, y: 0.6, z: 0.08, vx: 0, vy: 0.5, vz: 0.1, roll: false });
        let tm = null; G.ev = (k, a) => { if (k === 'hit') tm = a.tm; };
        for (let i = 0; i < 30 && !G.hits; i++){ if (swing && i === 12) P.swingAt = G.t; D.tick(G); }
        return { hits: G.hits, tm: tm == null ? null : +tm.toFixed(2) }; };
      out.swing = { none: pass(false), swung: pass(true) };
      const timed = tm => { const G = D.newMatch(1, 1, { seats: [null, null, OFF, OFF], hands: 'swing' }); const P = G.pl[0];
        Object.assign(G, { state: 'play', to: 0, wall: true }); Object.assign(P, { x: 0.3, y: 0.7, vx: 0, vy: -0.5 }); Object.assign(G.ball, { x: 0.3, y: 0.66, z: 0.06 });
        D.hit(G, 0, tm); return { vx: G.ball.vx, v: Math.hypot(G.ball.vx, G.ball.vy) }; };
      const early = timed(-0.6), late = timed(0.6), mid = timed(0), mis = timed(0.95);
      out.timing = { lateRight: late.vx > early.vx + 0.2, mishitSlower: mis.v < mid.v * 0.85 };
      // the shots
      const shotFrom = want => { const G = D.newMatch(1, 1, { seats: [null, D.LV[0], OFF, OFF] }); const M = G.pl[1];
        Object.assign(G, { state: 'play', to: 1, wall: true }); Object.assign(M, { x: 0.15, y: 0.7, vx: 0, vy: 0 }); M.want = want; Object.assign(G.ball, { x: 0.15, y: 0.66, z: 0.06 });
        D.hit(G, 1); const b = { ...G.ball }, seen = []; let zf = null;
        for (let i = 0; i < 4000 && zf == null; i++) D.ballStep(b, 1 / 480, k => { seen.push(k); if (k === 'front') zf = b.z; }, D.COURTS.squash);
        return { first: seen[0], zf: +(zf || 0).toFixed(3), v: +Math.hypot(G.ball.vx, G.ball.vy).toFixed(2) }; };
      const dr = shotFrom('drive'), bo = shotFrom('boast'), ki = shotFrom('kill');
      out.shots = { boastFirst: bo.first, killLower: ki.zf < dr.zf, killFaster: ki.v > dr.v, kz: ki.zf };
      const now = performance.now(), F = (dx, dy) => D.flickOf({ hist: [[now - 80, 0.3, 0.6], [now - 5, 0.3 + dx, 0.6 + dy]] });
      out.flick = [F(0, -0.2), F(0, 0.2), F(0.2, 0), F(0, -0.02)].map(x => x || 'none').join();
      // the styles
      const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(D.styleOf(i).id); out.styles = [seen.size, D.styleOf(0).id];
      const share = id => { const S = D.STYLES.find(s => s.id === id), n = {}; let all = 0;
        for (let m = 0; m < 2; m++){ const G = D.newMatch(500 + m, 3, { ai0: D.STEADY, seed: m, style: S, target: 5, game: 'squash', ev: (k, a) => { if (k === 'hit' && a.seat === 1){ n[a.shot] = (n[a.shot] || 0) + 1; all++; } } });
          while (G.state !== 'over') D.tick(G); }
        return x => (n[x] || 0) / Math.max(1, all); };
      const lob = share('lobber'), pow = share('power'), boa = share('boaster');
      out.styled = { lobber: +lob('lob').toFixed(2), power: +pow('lob').toFixed(2), boaster: +boa('boast').toFixed(2), boastOfPower: +pow('boast').toFixed(2) };
      return out;
    });
    const ok1 = r.swing.none.hits === 0 && r.swing.swung.hits === 1 && r.swing.swung.tm != null && r.timing.lateRight && r.timing.mishitSlower
      && r.shots.boastFirst === 'side' && r.shots.killLower && r.shots.killFaster && r.flick === 'kill,lob,boast,none' && r.styles[0] === 6 && r.styles[1] === 'all'
      && r.styled.lobber > r.styled.power + 0.1 && r.styled.boaster > r.styled.boastOfPower;
    if (!ok1) failures.push('[squash swing] ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} squash: no hit without a swing, a hit within one (at ${r.swing.swung.tm}), late and early either way, a mishit slower, a boast off the side wall first, a kill low (${r.shots.kz}) and fast, flicks ${r.flick}, ${r.styles[0]} styles, a lobber lobbing ${r.styled.lobber} against a power player's ${r.styled.power}, a boaster boasting ${r.styled.boaster}`);
    await page.evaluate(() => window.getFieldApp()._debug.fly(2, 1));
    await page.waitForTimeout(2500);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const real = {};
    if (fc){
      const key = fc[0] + '_' + fc[1];
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return [(pv.x + 1) / 2 * innerWidth, (1 - pv.y) / 2 * innerHeight]; }, [u, v]);
      if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ const h = await page.$('#bbHandle'); if (h) await h.click(); await page.waitForTimeout(600); }
      const tileAt = n => page.evaluate(n => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_' + n && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, n);
      // (the row is a ring, the first tile in the middle: a real slow drag brings the Hands and Shot tiles round to be clicked)
      for (let k = 0; k < 4; k++){
        const on = await page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_6' && t.style.display !== 'none'); if (!t) return false; const b = t.getBoundingClientRect(); return b.x > 20 && b.x + b.width < innerWidth - 20; });
        if (on) break;
        const t3 = await tileAt(3); if (!t3) break;
        await page.mouse.move(t3[0], t3[1]); await page.mouse.down();
        for (let j = 1; j <= 15; j++){ await page.mouse.move(t3[0] - j * 22, t3[1]); await page.waitForTimeout(25); }
        await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(500);
      }
      const ht = await tileAt(5); if (ht){ await page.mouse.click(ht[0], ht[1]); await page.waitForTimeout(400); }
      const st = await tileAt(6); if (st){ await page.mouse.click(st[0], st[1]); await page.waitForTimeout(400); }
      real.tiles = await page.evaluate(() => { const S = window.getFieldApp()._debug.SET; return [S.hands, S.shot]; });
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), key);
      const mid = await aimAt(0.5, 0.45); await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(300);
      // a rally under way, the ball high and far: a real finger lifted swings
      const rally = () => page.evaluate(k => { const G = window.getFieldApp()._debug.GAMES.get(k).G; Object.assign(G, { state: 'play', to: 0, wall: false, lastHit: 1 }); Object.assign(G.ball, { x: 0.5, y: 0.25, z: 0.45, vx: 0, vy: 0, vz: 0, roll: false }); G.pl[0].swingAt = -9; return G.t; }, key);
      await rally();
      const p0 = await aimAt(0.3, 0.8);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p0[0], y: p0[1], id: 7 }] });
      await page.waitForTimeout(80);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(250);
      real.lift = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).G.pl[0].swingAt > 0, key);
      await rally();
      await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      real.space = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).G.pl[0].swingAt > 0, key);
      await page.evaluate(k => { const D = window.getFieldApp()._debug; D.GAMES.delete(k); D.SET.hands = 'auto'; D.SET.shot = 'auto'; }, key);
    }
    const ok2 = !!fc && real.tiles[0] === 'swing' && real.tiles[1] === 'drive' && real.lift && real.space;
    if (!ok2) failures.push('[squash swing] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} squash: the real Hands and Shot tiles (${real.tiles}), a real finger lifted swings, the real Enter swings`);
  }
  // NONOGRAMS (Oct 16: "what other simple games could we do", then "lights out, nonograms and whack a mole"): every board its
  // own picture at a level by its ring (5×5 near the corner up to 12×12 far out), kept only with one answer the lines alone
  // find; real clicks fill exactly the squares clicked and the corner's marks switch to crosses; a real drag fills a row; the
  // whole picture filled by real clicks reads as solved and a click then starts it again; quick real taps on one square are each a tap;
  // a board no one plays fills itself in.
  {
    current = 'nonograms';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'nonograms')));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = { bad: [] }, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      out.sizes = [1, 2, 3, 4, 5].map(lv => D.makePuzzle(1234, lv).n);
      // (every sampled puzzle: its clues are its picture's, it has one answer, and the lines alone reach that answer)
      const t0 = performance.now();
      for (let lv = 1; lv <= 5; lv++) for (let k = 0; k < 12; k++){
        const idx = 50 + k * 97, P = D.makePuzzle(idx, lv), cl = D.cluesOf(P.sol, P.n), dens = P.sol.reduce((a, b) => a + b, 0) / (P.n * P.n);
        const cells = new Uint8Array(P.n * P.n), how = D.solveLines(P.rows, P.cols, P.n, cells).how;
        const ok = same(cl.rows, P.rows) && same(cl.cols, P.cols) && D.countSolutions(P.rows, P.cols, P.n, 1e5) === 1 && how === 'solved' && P.fair
          && [...cells].every((s, i) => (s === 1) === !!P.sol[i]) && dens > 0.4 && dens < 0.75 && P.n === D.LV[lv - 1].n && P.passes >= D.LV[lv - 1].minPasses;
        if (!ok) out.bad.push({ lv, idx, how, dens });
      }
      out.ms = Math.round(performance.now() - t0);
      out.two = D.countSolutions([[1], [1]], [[1], [1]], 2, 100);           // (a 2×2 diagonal: two answers)
      out.line = D.lineSolve([3, 1], 6, 0, 0);                              // (3 1 in six: the middle two of the three known)
      out.sameBoard = same([...D.makePuzzle(777, 3).sol], [...D.makePuzzle(777, 3).sol]);
      out.differ = !same([...D.makePuzzle(777, 3).sol], [...D.makePuzzle(778, 3).sol]);
      // the rules by hand: a wrong fill and its clearing is counted, a cross is not, and the picture filled reads as solved
      const g = D.fresh(0, 0); D.GAMES.set('0_0', g);
      const P = g.P, wrongAt = P.sol.indexOf(0);
      D.act(g, wrongAt, 'fill', true); D.act(g, wrongAt, 'fill', true); D.act(g, wrongAt, 'cross', true);
      out.cross = g.cells[wrongAt];
      let half = null;
      for (let i = 0; i < P.n * P.n; i++) if (P.sol[i]){ D.act(g, i, 'fill', true); if (!half) half = g.state; }
      out.solved = { half, state: g.state, wrong: g.wrong, stars: g.stars, crossesGone: g.cells[wrongAt] === 0 };
      D.GAMES.delete('0_0');
      return out;
    });
    const ok1 = r.levels.join() === '2,3,5,5' && r.sizes.join() === '5,6,8,10,12' && !r.bad.length && r.two === 2 && r.line && r.line[0] === 0b000110
      && r.sameBoard && r.differ && r.cross === 2 && r.solved.half === 'play' && r.solved.state === 'solved' && r.solved.wrong === 1 && r.solved.stars === 2 && r.solved.crossesGone;
    if (!ok1) failures.push('[nonograms] puzzles and rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} nonograms: sizes ${r.sizes.join('/')} by level, 60 sampled puzzles each with one answer the lines alone find (${r.ms} ms), a wrong fill costs a star`);
    // real clicks on the framed board
    await page.evaluate(() => window.getFieldApp()._debug.fly(3, 1));
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const key = fc[0] + '_' + fc[1];
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
      const info = await page.evaluate(([c, r, k]) => { const D = window.getFieldApp()._debug; D.MODE = 'fill'; const g = D.fresh(c, r); D.GAMES.set(k, g); D.LIVE = { c, r };
        const P = g.P; return { n: P.n, K: P.K, M: P.M, sol: [...P.sol], centres: [...P.sol.keys()].map(i => D.centreOf(P, i)) }; }, [...fc, key]);
      const cellsNow = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g ? { cells: [...g.cells], state: g.state, mode: window.getFieldApp()._debug.MODE } : null; }, key);
      const click = async i => { const p = await aimAt(...info.centres[i]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); };
      const filled = info.sol.map((s, i) => s ? i : -1).filter(i => i >= 0), empty = info.sol.map((s, i) => s ? -1 : i).filter(i => i >= 0);
      const three = [filled[0], filled[Math.floor(filled.length / 2)], filled[filled.length - 1]];
      for (const i of three) await click(i);
      const a = await cellsNow();
      const exact = a && a.cells.every((s, i) => s === (three.includes(i) ? 1 : 0));
      await click(three[0]);
      const b = await cellsNow();
      // the corner's cross mark, then a square crossed, then the fill mark again
      const K = info.K / info.M, cp = await aimAt(0.7 * K, 0.5 * K); await page.mouse.click(cp.x, cp.y); await page.waitForTimeout(350);
      const modeX = (await cellsNow()).mode;
      await click(empty[0]);
      const crossed = (await cellsNow()).cells[empty[0]];
      const fp = await aimAt(0.3 * K, 0.5 * K); await page.mouse.click(fp.x, fp.y); await page.waitForTimeout(350);
      const modeF = (await cellsNow()).mode;
      // a real drag along a row with no cross in it fills its blanks
      const n = info.n, before = (await cellsNow()).cells, row = [...Array(n).keys()].find(rr => before.slice(rr * n, rr * n + n).every(x => x === 0));
      const p0 = await aimAt(...info.centres[row * n]), p1 = await aimAt(...info.centres[row * n + n - 1]);
      await page.mouse.move(p0.x, p0.y); await page.mouse.down();
      for (let s = 1; s <= 12; s++){ await page.mouse.move(p0.x + (p1.x - p0.x) * s / 12, p0.y + (p1.y - p0.y) * s / 12); await page.waitForTimeout(40); }
      await page.mouse.up(); await page.waitForTimeout(400);
      const d = await cellsNow();
      const dragRow = d.cells.slice(row * n, row * n + n);
      // the whole picture by real clicks, from a blank board: solved, and a click then starts it again where it is (Oct 29)
      await page.evaluate(([c, r, k]) => { const D = window.getFieldApp()._debug; D.GAMES.set(k, D.fresh(c, r)); }, [...fc, key]);
      for (const i of filled) await click(i);
      const s = await cellsNow();
      await click(0);
      const next = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE; return L ? [L.c, L.r, D.GAMES.get(L.c + '_' + L.r).state] : null; });
      real = { exact, cleared: b.cells[three[0]] === 0 && b.cells[three[1]] === 1, modeX, crossed, modeF, dragRow, solved: s.state, next, from: fc };
    }
    const ok2 = real && real.exact && real.cleared && real.modeX === 'cross' && real.crossed === 2 && real.modeF === 'fill' && real.dragRow.every(x => x === 1)
      && real.solved === 'solved' && real.next && real.next.slice(0, 2).join() === real.from.join() && real.next[2] !== 'solved';
    if (!ok2) failures.push('[nonograms] real clicks: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} nonograms: real clicks fill exactly the squares clicked, the corner switches to crosses, a real drag fills a row, the picture by real clicks is solved and a click goes on`);
    // (Oct 15, Simon's lesson: "the simon buttons are very hard to push") quick real touches on one square are each a tap:
    // filled, cleared, filled, cleared, and the view never reframed
    await page.waitForTimeout(3000);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const quick = await page.evaluate(async () => {
      const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (u, v) => { const T = W.target, bW = W.boardW(), L = window.LAB || {}; const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0.02, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const tap = async (u, v, after) => { const p = S(u, v); ptr('pointerdown', p); const t = mk(p); fire('touchstart', t); ptr('pointerup', p); fire('touchend', t); await wait(after); };
      D.MODE = 'fill';
      const g = D.fresh(f.c, f.r); D.GAMES.set(f.c + '_' + f.r, g); D.LIVE = { c: f.c, r: f.r };
      const i = g.P.n + 1, [u, v] = D.centreOf(g.P, i), seen = [];
      for (let k = 0; k < 4; k++){ await tap(u, v, 200); seen.push(g.cells[i]); }
      const f2 = W.cellAt(W.target.boardX, W.target.boardZ);
      return { seen, still: !!f2 && f2.c === f.c && f2.r === f.r, noDbl: window.getFieldApp().noDoubleTap() };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const ok3 = quick.seen.join() === '1,0,1,0' && quick.still && quick.noDbl;
    if (!ok3) failures.push('[nonograms] quick taps on one square: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} nonograms: four quick real touches on one square are four taps (${quick.seen.join(', ')})`);
    // a board no one plays fills its picture in, square by square, shows it in colour and starts again: over one cycle of its
    // clock every stage is seen, and on the page's own clock it moves (sampled for a whole cycle: a few seconds can fall in the
    // picture's rest)
    const demo = await page.evaluate(async () => { const D = window.getFieldApp()._debug, P = D.puzzleFor(9, 9), T = D.cycleOf(P), seen = new Set();
      let pic = false, blank = false;
      for (let k = 0; k < 400; k++){ const V = D.shownView(P, 1000 + T * k / 400); seen.add(V.stamp); pic = pic || V.pic; blank = blank || (!V.pic && !V.cells.some(x => x)); }
      const live = new Set(), t0 = performance.now();
      while (performance.now() - t0 < (T + 1) * 1000){ live.add(D.shownView(P).stamp); await new Promise(ok => setTimeout(ok, 150)); }
      return { stages: seen.size, filled: P.sol.reduce((a, b) => a + b, 0), pic, blank, live: live.size }; });
    const ok4 = demo.stages >= demo.filled && demo.pic && demo.blank && demo.live >= 3;
    if (!ok4) failures.push('[nonograms] a board no one plays: ' + JSON.stringify(demo));
    console.log(`${ok4 ? 'ok  ' : 'FAIL'} nonograms: a board no one plays fills itself in (${demo.stages} stages a cycle, ${demo.live} seen live)`);
  }
  // FLASH CARDS (Oct 25: "how about flash card application?", then "Built-in decks" and "Spaced repetition"): the decks, a card a
  // board round the deck, the schedule (a new card learnt in steps and graduating, a known card's interval growing by its ease,
  // Again putting it back), the next card due and the nearest board holding it; and real input: a real click on the framed card
  // turning it over, a real click on Good along its near edge grading it with the view left where it is, the real N flying to the board of the next card, the real
  // Space and 3 doing the same, and a board no one studies turning its card over on its own.
  {
    current = 'flashcards';
    const bad = [];
    // (Oct 25, later: "dont type out the cards by hand. it must be loaded like json or epub.") No deck in the page: every board
    // says how to bring one; then decks come in through the real file picker: the repo's decks/capitals.tsv (Anki-style #deck
    // and #ask lines, a header), a CSV with quotes, an Anki export with HTML, and a flashcards JSON; a JSON that is not a deck
    // still goes to the JSON viewer.
    await page.evaluate(() => { const D = window.FIELD_APPS.find(a => a.id === 'flashcards')._debug; D.DECKS.splice(0); try { localStorage.removeItem('flashcards.decks'); localStorage.removeItem('flashcards.srs'); } catch {} for (const k in D.SRS) delete D.SRS[k]; });
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'flashcards')));
    await page.waitForTimeout(1500);
    const empty = await page.evaluate(() => { const A = window.getFieldApp(); return { title: A.cellTitle(0, 0), key: A.cellPhoto(0, 0, 400) }; });
    if (!/no deck yet/.test(empty.title) || empty.key !== 'fc:empty:h') bad.push('with no deck: ' + JSON.stringify(empty));
    const ddir = await mkdtemp(join(tmpdir(), 'decks-'));
    const csvF = join(ddir, 'my_words.csv'), ankiF = join(ddir, 'anki.txt'), jsonF = join(ddir, 'planets.json'), dataF = join(ddir, 'data.json');
    await writeFile(csvF, 'Question,Answer,Notes\n"Hello, world",Hola mundo,greeting\ncat,gato\n"say ""hi""",di hola\n');
    await writeFile(ankiF, '#separator:tab\n#html:true\n#deck:Anki words\ndog\t<b>perro</b><br>el perro\nhouse\tla&nbsp;casa\n');
    await writeFile(jsonF, JSON.stringify({ format: 'flashcards', name: 'Planets', ask: 'Planet number', cards: [['3', 'Earth'], { front: '4', back: 'Mars', note: 'the red one' }] }));
    await writeFile(dataF, JSON.stringify({ users: [{ id: 1 }, { id: 2 }] }));
    await page.setInputFiles('#importImageFile', [join(ROOT, 'decks', 'capitals.tsv'), csvF, ankiF, jsonF]);
    await page.waitForFunction(() => window.FIELD_APPS.find(a => a.id === 'flashcards')._debug.DECKS.length >= 4, null, { timeout: 15000 }).catch(() => {});
    const loaded = await page.evaluate(() => { const D = window.FIELD_APPS.find(a => a.id === 'flashcards')._debug;
      return { onApp: window.getFieldApp() === window.FIELD_APPS.find(a => a.id === 'flashcards'), decks: D.DECKS.map(d => [d.name, d.ask, d.cards.length, d.cards[0].join('/')]),
               kept: (JSON.parse(localStorage.getItem('flashcards.decks') || '[]')).length }; });
    const names = loaded.decks.map(d => d[0]).sort().join();
    if (names !== 'Anki words,Planets,World capitals,my words' || !loaded.onApp) bad.push('decks loaded: ' + JSON.stringify(loaded));
    const byName = Object.fromEntries(loaded.decks.map(d => [d[0], d]));
    if (byName['World capitals'] && (byName['World capitals'][1] !== 'Capital of' || byName['World capitals'][2] !== 53 || byName['World capitals'][3] !== 'France/Paris')) bad.push('capitals.tsv ' + JSON.stringify(byName['World capitals']));
    if (byName['my words'] && (byName['my words'][2] !== 3 || byName['my words'][3] !== 'Hello, world/Hola mundo/greeting')) bad.push('the CSV ' + JSON.stringify(byName['my words']));
    if (byName['Anki words'] && byName['Anki words'][3] !== 'dog/perro el perro') bad.push('the Anki export ' + JSON.stringify(byName['Anki words']));
    if (byName['Planets'] && (byName['Planets'][1] !== 'Planet number' || byName['Planets'][2] !== 2)) bad.push('the JSON deck ' + JSON.stringify(byName['Planets']));
    if (loaded.kept !== 4) bad.push(loaded.kept + ' decks kept in storage');
    await page.setInputFiles('#importImageFile', dataF);
    await page.waitForFunction(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._json && G._json.label === 'data.json'; }, null, { timeout: 15000 }).catch(() => {});
    const toViewer = await page.evaluate(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return !!(G._json && G._json.label === 'data.json'); });
    if (!toViewer) bad.push('a JSON that is not a deck did not open in the JSON viewer');
    // (Oct 25: "json is disabled in flashcard application": a phone greys out what the field's Open will not take.) The deck's own
    // picker takes any file (no accept), and a file with no name to go by is read by what it holds: a JSON deck saved as a download.
    const anyF = join(ddir, 'moons download');
    await writeFile(anyF, JSON.stringify({ format: 'flashcards', name: 'Moons', cards: [['Earth', 'the Moon'], ['Mars', 'Phobos and Deimos']] }));
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'flashcards')));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
      page.evaluate(() => { const A = window.getFieldApp(); A.menu[0].items.find(it => it.label === 'Open a deck…').on(); })]);
    const pickerAccept = chooser ? await chooser.element().evaluate(el => el.accept) : null;
    if (chooser) await chooser.setFiles(anyF);
    await page.waitForFunction(() => window.FIELD_APPS.find(a => a.id === 'flashcards')._debug.DECKS.some(d => d.name === 'Moons'), null, { timeout: 10000 }).catch(() => {});
    const moons = await page.evaluate(() => { const d = window.FIELD_APPS.find(a => a.id === 'flashcards')._debug.DECKS.find(d => d.name === 'Moons'); return d ? d.cards.length : 0; });
    if (!chooser || pickerAccept !== '' || moons !== 2) bad.push('the deck picker: ' + JSON.stringify({ chooser: !!chooser, accept: pickerAccept, moons }));
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'flashcards')));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      D.DECK = D.DECKS.findIndex(d => d.name === 'World capitals');
      const SK = D.deck().key, RC = k => D.SRS[SK].cards[D.cid(k)].slice();
      out.decks = [D.deck().cards.length];
      out.corner = D.cardOf(0, 0);
      out.round = [[0, 0], [1, 0], [5, 9]].map(([c, r]) => D.cardOf(c, r) === D.boardIdx(c, r) % D.deck().cards.length).every(Boolean);
      let t = 1e12; D.setNow(() => t);
      out.first = D.nextDue(-1);
      out.iv0 = D.intervals(5).join();
      D.grade(5, 2); out.s1 = D.stateOf(5); out.iv1 = D.intervals(5).join();
      t += 11 * 60e3; D.grade(5, 2); out.s2 = D.stateOf(5); const R1 = RC(5);
      t += R1[2] * 86400e3 + 1; out.s3 = D.stateOf(5); out.dueFirst = D.nextDue(-1);
      D.grade(5, 2); const R2 = RC(5);
      t += R2[2] * 86400e3 + 1; D.grade(5, 0); const R3 = RC(5);
      out.recs = [R1, R2, R3];
      out.board = D.boardFor(7, 3, 3); out.boardHolds = out.board && D.cardOf(out.board[0], out.board[1]) === 7;
      out.counts = D.counts();
      delete D.SRS[SK]; D.setNow(null);
      return out;
    });
    if (r.decks.join() !== '53') bad.push('decks ' + r.decks.join());
    if (r.corner !== 0 || !r.round) bad.push('cards by board: ' + JSON.stringify([r.corner, r.round]));
    if (r.first !== 0) bad.push('the first card due is ' + r.first);
    if (r.iv0 !== '1m,6m,10m,4d' || r.s1 !== 'learn' || r.iv1 !== '1m,15m,1d,4d' || r.s2 !== 'known' || r.s3 !== 'due' || r.dueFirst !== 5)
      bad.push('the steps: ' + JSON.stringify(r));
    const [R1, R2, R3] = r.recs;
    if (R1[0] !== 2 || R1[2] !== 1 || R2[2] !== 3 || R3[0] !== 1 || R3[6] !== 1 || !(R3[3] < R2[3])) bad.push('the schedule ' + JSON.stringify(r.recs));
    if (!r.boardHolds) bad.push('no board near holding card 7: ' + JSON.stringify(r.board));
    // real input on a framed card
    await page.evaluate(() => { tvf.fn.gotoCell(4, 2); });
    await page.waitForTimeout(3000);
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
    const state = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE; return { live: L, turned: L ? D.TURNED.has(L.c + '_' + L.r) : false, card: L ? D.cardOf(L.c, L.r) : -1, rec: (() => { const S = D.SRS[D.deck().key], o = {}; if (S) for (let k = 0; k < D.deck().cards.length; k++) if (S.cards[D.cid(k)]) o[k] = S.cards[D.cid(k)]; return o; })() }; });
    if (!fc) bad.push('no framed board');
    else {
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.LIVE = { c, r }; D.TURNED.clear(); }, fc);
      let pt = await aimAt(0.5, 0.45);
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(700);
      const s1 = await state();
      if (!s1.turned) bad.push('a real click did not turn the card over: ' + JSON.stringify(s1));
      const k1 = s1.card;
      pt = await aimAt(0.625, 0.9);              // (Good, the third of the four buttons along the near edge)
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(3000);
      const s2 = await state();
      const g1 = s2.rec[k1];
      if (!g1 || g1[0] !== 1 || g1[1] !== 1) bad.push('a real click on Good did not grade card ' + k1 + ': ' + JSON.stringify(g1));
      const want = await page.evaluate(k => window.getFieldApp()._debug.nextDue(k), k1);
      // (graded, the view stays where it is: Oct 29, "Only the user can move to a new board."; the real N flies to the next card)
      const at0 = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
      if (s2.card !== k1 || s2.turned || !at0 || at0.join() !== fc.join()) bad.push(`after grading the view moved or the card stayed turned: framed ${JSON.stringify(at0)} holds ${s2.card} (turned ${s2.turned}), was ${JSON.stringify(fc)}`);
      await page.keyboard.press('n'); await page.waitForTimeout(3000);
      const at = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
      const dk = await page.evaluate(([c, r]) => window.getFieldApp()._debug.cardOf(c, r), at || [0, 0]);
      if (!at || dk !== want) bad.push('the real N did not fly to the next card: framed ' + JSON.stringify(at) + ' holds ' + dk);
      // the real Space turns it, the real 3 grades it Good
      await page.keyboard.press('Space'); await page.waitForTimeout(400);
      const s3 = await state();
      await page.keyboard.press('3'); await page.waitForTimeout(1500);
      const s4 = await state();
      if (!s3.turned || !s4.rec[s3.card]) bad.push('Space then 3: ' + JSON.stringify({ turned: s3.turned, rec: s4.rec[s3.card] }));
      // the row: Show answer, the four grades, the counts
      const row = await page.evaluate(() => { const A = window.getFieldApp(), L = A._debug.LIVE; return (A.statTiles(L.c, L.r) || []).map(t => t.value.split(' ·')[0]).join(); });
      if (row !== 'Show answer,Again,Hard,Good,Easy,18,0,0') bad.push('the row ' + row);
      await page.evaluate(() => { const D = window.getFieldApp()._debug; delete D.SRS[D.deck().key]; try { localStorage.removeItem('flashcards.srs'); localStorage.removeItem('flashcards.decks'); } catch {} D.TURNED.clear(); });
    }
    // a board no one studies turns its card over now and then
    const idle = await page.evaluate(async () => { const D = window.getFieldApp()._debug, seen = new Set();
      for (let i = 0; i < 40; i++){ seen.add(D.viewOf(9, 9).back); await new Promise(r => setTimeout(r, 300)); } return [...seen].length; });
    if (idle < 2) bad.push('a board no one studies never turned over');
    if (bad.length) failures.push('[flashcards] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} flashcards: no deck till one is loaded, four decks through the real picker (the repo's TSV, a CSV, an Anki export, a JSON deck) and a plain JSON to the viewer, a card a board, the steps and the schedule (intervals ${r.recs.map(x => x[2]).join(', ')} days, ease ${r.recs.map(x => x[3]).join(', ')}), a real click turning a card and a real click on Good flying to the next, Space and 3, a board no one studies turning over`);
  }
} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
