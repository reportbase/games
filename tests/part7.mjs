// Smoke test, part 7 of 7: curling, bowling, bumper pool, the marble run, playing with the row shut, Bejeweled, air hockey's corners, Asteroids, the Difficulty and
// the board lock, Invaders, Board War and Simon's songs.
//
//   node tests/part7.mjs            this part alone (LIBS_DIR, BASE_URL, SETTLE_MS and CHROMIUM_PATH as for npm test)
//   SHARD=7/7 node tests/smoke.mjs  the same, by the runner
//   npm test                        every part, then the course test
//
// Cut from tests/smoke.mjs (12 Nov 2026) as it stood: the checks and their comments are unchanged. What every part
// needs (the server, the browser, the page loaded, the failures and how a run ends) is tests/harness.mjs.

import { begin, onClock, drawn, frame } from './harness.mjs';

let current = 'page load';
const T = await begin(7, () => current);
const { page, failures } = T;

try {
  // CURLING ON THE POOL TABLE (Nov 25: "lets do the same thing for curling that we did for bowling.   use the pool engine."): the first stone at the
  // hack; an end's score on stones made up; four ends of balls made up, scored, the scorer first next end, a win; in shots a lone stone's weight to
  // the button, the tip's side curling it either way, a takeout putting a stone out, a stone short of the hog line out; the computer's stone; the
  // real Enter; a board no one plays
  current = 'curling';
  {
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'curling')));
    await drawn(page, 1500); await page.evaluate(() => window.__settle && window.__settle());
    const cu = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {}, T = D.CU_TEE, st = (n, x, z) => ({ n, x, z, r: D.CU_R, y: 0, vx: 0, vz: 0, sunk: false });
      const B = D.rackCu(3); out.rack = B.length === 1 && B[0].cue && B[0].n === 26 && B[0].x === D.CU_HACK[0] && B[0].z === D.CU_HACK[1];
      out.score = [D.cuEndScore([st(26, T + 0.3, 0), st(27, T + 1, 0), st(30, T + 0.8, 0)]), D.cuEndScore([st(30, T, 0.2), st(31, T + 0.5, 0), st(26, T + 1.2, 0), st(32, T + 2, 0)]), D.cuEndScore([st(26, T - 4, 0)])].map(e => e.side + ':' + e.pts).join(' ');
      const L = D.LIVE, k = L && L.c + '_' + L.r; if (!k) return { ...out, none: true };
      out.name = A.name; out.start = (() => { const g = D.GAMES.get(k) || D.gameAt(L.c, L.r); return [g.balls.length, g.nine.turn, /^Curling/.test(D.cuTitle(g))].join(); })();
      const fresh = () => { D.GAMES.delete(k); return D.gameAt(L.c, L.r); };
      // a stone made up: the delivered one comes to rest at (x, z), having met another if `met`
      const throwTo = (h, x, z) => { const s = { first: null, contacts: [], cushions: [], sunk: [], final: h.balls.map(b => b.cue ? { ...b, x, z } : { ...b }) }; h.anim = { s }; D.cuFinish(h, s); };
      let h = fresh(); const ends = [];
      for (let e = 0; e < D.CU_ENDS; e++){ for (let j = 0; j < 2 * D.CU_STONES; j++){ const t = h.nine.turn; if (h.nine.over) break;
          if (e === 0 && t === 0) throwTo(h, T + 0.25 * h.nine.thrown[0], 0.6 * (h.nine.thrown[0] - 1.5)); else throwTo(h, 9.6, 0); }   // (the computer's, and the later ends', past the back line: out)
        ends.push([h.nine.pts.join('-'), h.nine.first, h.nine.end, h.balls.length].join(':')); }
      out.ends = ends.join(' '); out.over = [h.nine.over, h.nine.stars, /you won/.test(D.cuTitle(h))].join();
      h = fresh(); const P = D.matchPlan(D.MATCH.curl, h, 3); out.plan = isFinite(P.score) && isFinite(P.a) && P.p >= 1;
      fresh();
      return out;
    });
    // shots through the match's own strike (the tip's side as the curl), from the page's own debug
    const sh = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, T = D.CU_TEE, out = {}, p = D.cuPowFor(T - D.CU_HACK[0]);
      const strike = (B, a, pw, tip) => { const st = D.strike(a, tip, pw); return D.simCu(B, st.dir, st.speed, st.w, st.vy); };
      const stone = () => [{ ...D.rackCu(0)[0] }];
      const s0 = strike(stone(), 0, p, 0), f0 = s0.final[0]; out.draw = [Math.abs(f0.x - T) < 0.6, Math.abs(f0.z) < 0.2].join();
      const sl = strike(stone(), 0, p, 0.4), sr = strike(stone(), 0, p, -0.4); out.curl = [Math.abs(sl.final[0].z) > 0.3, Math.abs(sr.final[0].z) > 0.3, Math.sign(sl.final[0].z) === -Math.sign(sr.final[0].z)].join();
      const tgt = { ...D.rackCu(0)[0], n: 30, cue: false, x: T, z: 0 }, B2 = [stone()[0], tgt], s2 = strike(B2, 0, Math.min(60, p * 1.9), 0); out.takeout = D.cuOut(B2, s2).includes(30);
      const s3 = strike(stone(), 0, p * 0.5, 0); out.hog = D.cuOut(stone(), s3).includes(26);
      return out;
    });
    const g1 = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.GAMES.get(L.c + '_' + L.r);
      return g ? { shots: g.shots, anim: !!g.anim, moves: g.nine.moves.length, over: g.nine.over, turn: g.nine.turn } : null; });
    await page.keyboard.press('Enter'); await drawn(page, 300);
    const went = await g1();
    for (let k = 0; k < 120 && (await g1()).anim; k++) await frame(page, 300);
    const after = await g1();
    const rec = await page.evaluate(() => { const D = window.getFieldApp()._debug, R = D.nineRecSoon(40, true);
      const at = k => JSON.stringify(Array.from(R.s.frames[Math.floor(k * (R.s.frames.length - 1))]).map(v => isNaN(v) ? null : +v.toFixed(2)));
      return { shots: R.shots, over: R.over, moves: at(0) !== at(1), again: D.nineRecSoon(40) === R, kind: R.S.kind }; });
    const ok = cu && !cu.none && cu.rack && cu.name === 'Curling' && cu.start === '1,0,true' && cu.score === '0:1 1:2 -1:0'
      && cu.ends === '4-0:0:2:1 4-0:0:3:1 4-0:0:4:1 4-0:0:5:0' && cu.over === '1,3,true' && cu.plan
      && sh.draw === 'true,true' && sh.curl === 'true,true,true' && sh.takeout && sh.hog
      && went && went.shots === 1 && after && !after.anim && after.moves === 1 && after.turn === 1
      && rec.kind === 'curl' && rec.shots >= 8 && rec.moves && rec.again;
    if (!ok) failures.push('[curling] ' + JSON.stringify({ cu, sh, went, after, rec }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} curling on the pool table (the stone at the hack; an end scored by the stones nearest the button; four ends to a win; a lone stone's weight to the button, the tip's side curling it either way, a takeout and the hog line; the computer's stone; the real Enter threw; a board no one plays threw ${rec.shots} stones${rec.over ? ', to a win' : ''})`);
  }

  // BOWLING ON THE POOL TABLE (Nov 25: "Let's rewrite it to use the pool engine and camera.   The pins should be pool balls but otherwise follow bowling
  // rules.", then "remove the cushions, of the ball goes off the board it falls in a ditch", then "Make the balls slighty bigger.", then "Leave the balls
  // in the ditch.   Let the player hit the cue ball from the ditch. … The balls in the ditch block other balls from going in the ditch.", then "The balls
  // can move in the ditch lateraly.  Make this a two player game, first player to clear his balls wins", then "Add the full rack of balls."): the rack, the solids and the stripes one each
  // on every pair of mirrored spots; on balls made up, the turn kept by clearing one's own, passed otherwise, all five cleared a win; in a shot, a ball
  // off the side on the ditch's middle line, a ball in the ditch knocked along it and staying on its line, one keeping another out; the computer's
  // ball; the real Enter bowling; a board no one plays bowling
  current = 'bowling';
  {
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'bowling')));
    await drawn(page, 1500); await page.evaluate(() => window.__settle && window.__settle());
    const bw = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {}, LX = 20, LZ = 10, oz = LZ / 2 + D.BWL_DW / 2, ox = LX / 2 + D.BWL_DW / 2, G = D.BWL_GRP;
      const B = D.rackB(7), sp = b => D.BWL_SPOT[b.spot], at = s => B.find(b => b.spot === s), grp = b => G[0].includes(b.n) ? 0 : G[1].includes(b.n) ? 1 : -1;
      out.rack = B.length === 16 && B[0].cue && B.every(b => b.r === D.BWL_R) && B.slice(1).every(b => b.x === sp(b)[0] && b.z === sp(b)[1] && Math.abs(b.x) < LX / 2 - b.r)
        && [...D.BWL_PAIRS, D.BWL_MID].every(([p, q]) => grp(at(p)) + grp(at(q)) === 1 && grp(at(p)) >= 0) && at(D.BWL_EIGHT).n === 8
        && JSON.stringify(D.rackB(7)) === JSON.stringify(B);
      const L = D.LIVE, k = L && L.c + '_' + L.r; if (!k) return { ...out, none: true };
      out.name = A.name; out.start = (() => { const g = D.GAMES.get(k) || D.gameAt(L.c, L.r); return [g.balls.length, g.nine.hand, g.nine.turn, /^Bowling/.test(D.bwlTitle(g))].join(); })();
      const fresh = () => { D.GAMES.delete(k); return D.gameAt(L.c, L.r); };
      // a ball made up: the balls in `ditch` (and the white, if `wd`) in the ditch
      const play = (h, ditch, wd = false) => { const s = { first: { n: 1, rails: 0 }, sunk: [], contacts: [], cushions: [],
        final: h.balls.map(b => b.cue ? { ...b, x: -2, z: wd ? oz : 0, ditch: wd } : ditch.includes(b.n) ? { ...b, z: -oz, ditch: true, rail: [1, 0], rp: -oz } : { ...b }) };
        h.anim = { s }; D.bwlFinish(h, s); return [h.nine.turn, D.bwlCleared(h.balls).join('/'), h.nine.over].join(';'); };
      let h = fresh(); out.turns = [play(h, [3]), play(h, [3, 11]), play(h, [3, 11]), play(h, [3, 11, 1, 2, 4, 5, 6, 7]), play(h, [3, 11, 1, 2, 4, 5, 6, 7, 8])].join(' ');
      out.stars = [h.nine.stars, /you won/.test(D.bwlTitle(h))].join();
      h = fresh(); out.lost = [play(h, [9]), play(h, [9, 8])].join(' ');
      // the ditch in a shot
      { const B0 = D.rackB(0), sd = D.simB(B0, Math.PI / 3, 40, [0, 0, 0], 0), w0 = sd.final[0];
        out.fell = w0.ditch && !w0.sunk && (Math.abs(Math.abs(w0.z) - oz) < 1e-6 || Math.abs(Math.abs(w0.x) - ox) < 1e-6);
        // a ball in the ditch, the white rolled along the ditch at it: knocked along, on its line
        const p = { ...B0[1], x: -6, z: oz, ditch: true, rail: [1, 0], rp: oz };
        const B1 = [{ ...B0[0], x: -9, z: oz, ditch: true }, p], s1 = D.simB(B1, 0, 20, [0, 0, 0], 0), f1 = s1.final[1];
        out.along = [f1.x > -4, Math.abs(f1.z - oz) < 1e-9, f1.ditch].join();
        // the white from the table, glancing it: it rolls along, still on its line
        const B2 = [{ ...B0[0], x: -7.5, z: 2 }, p], s2 = D.simB(B2, Math.atan2(oz - 2, -6 + 0.9 * D.BWL_R - -7.5), 24, [0, 0, 0], 0), f2 = s2.final[1];
        out.glance = [Math.abs(f2.x + 6) > 0.3, Math.abs(f2.z - oz) < 1e-9].join();
        // square at it: the white kept out; the ditch empty, it falls in
        const B3 = [{ ...B0[0], x: -6, z: 0 }, p], s3 = D.simB(B3, Math.PI / 2, 14, [0, 0, 0], 0), s4 = D.simB([B3[0]], Math.PI / 2, 14, [0, 0, 0], 0);
        out.block = [!(s3.final[0].ditch && s3.final[0].z > 0), s4.final[0].ditch && s4.final[0].z > 0].join(); }   // (kept out on that side: square at it, it rebounds back across)
      h = fresh(); const P = D.matchPlan(D.MATCH.bowl, h, 4); out.plan = isFinite(P.score) && isFinite(P.a) && P.p >= 2;
      fresh();
      return out;
    });
    const g1 = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.GAMES.get(L.c + '_' + L.r);
      return g ? { shots: g.shots, anim: !!g.anim, moves: g.nine.moves.length, over: g.nine.over } : null; });
    await page.keyboard.press('Enter'); await drawn(page, 300);
    const went = await g1();
    for (let k = 0; k < 120 && (await g1()).anim; k++) await frame(page, 300);
    const after = await g1();
    const rec = await page.evaluate(() => { const D = window.getFieldApp()._debug, R = D.nineRecSoon(40, true);
      const at = k => JSON.stringify(Array.from(R.s.frames[Math.floor(k * (R.s.frames.length - 1))]).map(v => isNaN(v) ? null : +v.toFixed(2)));
      return { shots: R.shots, over: R.over, moves: at(0) !== at(1), again: D.nineRecSoon(40) === R, kind: R.S.kind }; });
    const ok = bw && !bw.none && bw.rack && bw.name === 'Bowling' && bw.start === '16,true,0,true'
      && bw.turns === '0;1/0;0 1;1/1;0 0;1/1;0 0;7/1;0 0;7/1;1' && bw.stars === '3,true' && bw.lost === '1;0/1;0 1;0/1;1'
      && bw.fell && bw.along === 'true,true,true' && bw.glance === 'true,true' && bw.block === 'true,true' && bw.plan
      && went && went.shots === 1 && after && !after.anim && after.moves === 1
      && rec.kind === 'bowl' && rec.shots >= 3 && rec.moves && rec.again;
    if (!ok) failures.push('[bowling] ' + JSON.stringify({ bw, went, after, rec }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} bowling on the pool table (the full rack, the solids and the stripes racked fairly and the 8 in the middle; the turn kept by clearing one's own, passed otherwise, all seven then the 8 a win, the 8 too soon a loss; a ball off the side on the ditch's line, one in it knocked along it, one keeping another out; the real Enter bowled; a board no one plays bowled ${rec.shots} balls${rec.over ? ', to a win' : ''})`);
  }

  // BUMPER POOL (Nov 25: "Then create a bumper pool game."): the rack (five a side, no white, the marked one struck first); on balls made up a ball
  // before its marked one brought back and the turn passed, one in its own pocket keeping the turn, one in the wrong pocket brought back, all five a
  // win; in shots a ball off a bumper that does not move, a ball between the guards into its pocket; a press picking a ball only once the marked
  // one is in; the computer's shot; the real Enter; a board no one plays
  current = 'bumper pool';
  {
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'bumperpool')));
    await drawn(page, 1500); await page.evaluate(() => window.__settle && window.__settle());
    const bp = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {};
      const B = D.rackBp(); out.rack = B.length === 10 && !B.some(b => b.n === 0) && B.filter(b => b.cue).map(b => b.n).join() === '16'
        && B.every(b => b.x === D.BP_START[b.n][0] && b.z === D.BP_START[b.n][1]);
      const L = D.LIVE, k = L && L.c + '_' + L.r; if (!k) return { ...out, none: true };
      out.name = A.name; out.start = (() => { const g = D.GAMES.get(k) || D.gameAt(L.c, L.r); return [g.balls.length, g.nine.turn, g.balls.find(b => b.cue).n, /^Bumper pool/.test(D.bpTitle(g))].join(); })();
      const fresh = () => { D.GAMES.delete(k); return D.gameAt(L.c, L.r); };
      const play = (h, ins) => { const s = { first: null, contacts: [], cushions: [], sunk: ins.map(([n, p], i) => ({ n, pocket: p, t: i })),
        final: h.balls.map(b => ins.some(q => q[0] === b.n) ? { ...b, sunk: true } : { ...b }) };
        h.anim = { s }; D.bpFinish(h, s); return [h.nine.turn, D.bpIn(h.balls).join('/'), h.nine.over].join(';'); };
      let h = fresh();
      const s17 = h.balls.find(b => b.n === 17); s17.x += 1;   // (moved, so its coming back shows)
      out.turns = [play(h, [[17, 1]]), play(h, [[21, 0]]), play(h, [[22, 1]]), play(h, [[16, 1], [17, 1]]), play(h, [[18, 1], [19, 1], [20, 1]])].join(' ');
      const b17 = (() => { const h2 = fresh(); h2.balls.find(b => b.n === 17).x += 1; play(h2, [[17, 1]]); const b = h2.balls.find(q => q.n === 17); return !b.sunk && b.x === D.BP_START[17][0] && b.z === D.BP_START[17][1]; })();
      out.back = b17; out.stars = [h.nine.stars, /you won/.test(D.bpTitle(h))].join();
      // in shots: off a bumper, the bumper still; between the guards into the pocket
      { const red = (x, z) => ({ ...D.rackBp()[0], x, z, cue: true }), s1 = D.simBp([red(-3, 0)], 0, 10, [0, 0, 0], 0), f1 = s1.final[0];
        out.post = [f1.x < -1.5 - 0.6, s1.cushions.length > 0, s1.frames[0].length === 2].join();
        const s2 = D.simBp([red(6.0, 0)], 0, 6, [0, 0, 0], 0); out.pot = [s2.final[0].sunk, s2.sunk.length && s2.sunk[0].pocket].join(); }
      // picking: only the marked one until it is in, then any of yours
      { h = fresh(); const b17 = h.balls.find(b => b.n === 17), uv = D.uvOf(b17.x, b17.z);
        const before = D.pickAt(h, uv[0], uv[1]); h.balls.find(b => b.n === 16).sunk = true; const after = D.pickAt(h, uv[0], uv[1]);
        out.pick = [before, after, h.balls.find(b => b.cue).n].join(); }
      h = fresh(); const P = D.matchPlan(D.MATCH.bumper, h, 3); out.plan = isFinite(P.score) && isFinite(P.a) && P.p >= 2;
      fresh();
      return out;
    });
    const g1 = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.GAMES.get(L.c + '_' + L.r);
      return g ? { shots: g.shots, anim: !!g.anim, moves: g.nine.moves.length, over: g.nine.over } : null; });
    await page.keyboard.press('Enter'); await drawn(page, 300);
    const went = await g1();
    for (let k = 0; k < 120 && (await g1()).anim; k++) await frame(page, 300);
    const after = await g1();
    const rec = await page.evaluate(() => { const D = window.getFieldApp()._debug, R = D.nineRecSoon(40, true);
      const at = k => JSON.stringify(Array.from(R.s.frames[Math.floor(k * (R.s.frames.length - 1))]).map(v => isNaN(v) ? null : +v.toFixed(2)));
      return { shots: R.shots, over: R.over, moves: at(0) !== at(1), again: D.nineRecSoon(40) === R, kind: R.S.kind }; });
    const ok = bp && !bp.none && bp.rack && bp.name === 'Bumper pool' && bp.start === '10,0,16,true'
      && bp.turns === '1;0/0;0 1;0/1;0 0;0/1;0 0;2/1;0 0;5/1;1' && bp.back && bp.stars === '3,true'
      && bp.post === 'true,true,true' && bp.pot === 'true,1' && bp.pick === 'false,true,17' && bp.plan
      && went && went.shots === 1 && after && !after.anim && after.moves === 1
      && rec.kind === 'bumper' && rec.shots >= 3 && rec.moves && rec.again;
    if (!ok) failures.push('[bumper pool] ' + JSON.stringify({ bp, went, after, rec }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} bumper pool (five a side, the marked one first; a ball before its marked one brought back, one in its own pocket keeping the turn, one in the wrong pocket brought back, all five a win; off a bumper that stays, between the guards into the pocket; a press picking a ball once the marked one is in; the real Enter shot; a board no one plays shot ${rec.shots} balls${rec.over ? ', to a win' : ''})`);
  }


  // MARBLE RUN (Oct 28: "2,   3 curling, bowling, marble run"): levels by ring; puzzles made at levels 1, 3 and 5, every made way
  // running the marble to the cup in the game's own physics, par growing; a piece taken out and the marble falls; a piece laid
  // beside the chute turned and raised to join it; and real input: a real click laying a straight under the chute, a real click
  // again turning it, the made way run to the cup; and a board no one plays running its marble
  current = 'marble run';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'marblerun')); await new Promise(ok => setTimeout(ok, 2500)); });
    const mr = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {}, GS = Math.round(Math.sqrt(window.FIELD_ST.N));
      out.levels = [D.levelOf(0, 0), D.levelOf(7, 0), D.levelOf(40, 3), D.levelOf(GS - 80, 2)];
      out.made = [1, 3, 5].map(lv => { let ok = 0, par = 0; for (let k = 0; k < 10; k++){ const P = D.makePuzzle(700 + k * 31, lv); if (!P) continue; const pcs = new Map(P.sol); pcs.set(D.ck(P.start.i, P.start.j), P.startPiece); if (D.runSim(P, pcs).ok){ ok++; par += P.par; } } return { ok, par: +(par / Math.max(1, ok)).toFixed(1) }; });
      const P = D.makePuzzle(777, 3), pcs = new Map(P.sol); pcs.set(D.ck(P.start.i, P.start.j), P.startPiece);
      const miss = new Map(pcs); miss.delete([...P.sol.keys()][1]); out.missing = D.runSim(P, miss).ok;
      const F = D.fitsAt(P, new Map(), P.start.i, P.start.j + 1, 's')[0].pc; out.fit = [F.rot, F.z, P.H];
      return out;
    });
    const L = mr.levels;
    if (!(L[0] < L[2] && L[2] <= L[3]) || mr.made.some(m => m.ok < 10) || !(mr.made[0].par < mr.made[2].par) || mr.missing || mr.fit[0] !== 0 || mr.fit[1] !== mr.fit[2])
      failures.push(`[${current}] ${JSON.stringify(mr)}`);
    // real input on the framed board: the cell under the chute, a straight laid there by a real click, turned by another
    await page.evaluate(() => window.__settle());
    const cellXY = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, f = D.LIVE, g = D.gameAt(f.c, f.r), P = g.P, W = window.FIELD_WORLD, T = W.target, bW = W.boardW();
      g.tool = 's'; g.chosen = true; const i = P.start.i, j = P.start.j + 1, u = (i + 0.5) / P.n, v = (j + 0.5) / P.n;
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW, 0, T.boardZ + (0.5 - v) * bW).project(W.camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, k: D.ck(i, j), H: P.H, blocked: P.rocks.has(D.ck(i, j)) || P.given.has(D.ck(i, j)) }; });
    const pieceAt = () => page.evaluate(k => { const D = window.getFieldApp()._debug, f = D.LIVE, g = D.GAMES.get(f.c + '_' + f.r); const pc = g.placed.get(k) || g.P.given.get(k); return pc ? { ...pc, mine: g.placed.has(k) } : null; }, cellXY.k);
    await page.mouse.click(cellXY.x, cellXY.y); await drawn(page, 500);
    const live = { laid: await pieceAt() };
    await page.mouse.click(cellXY.x, cellXY.y); await drawn(page, 500);
    live.turned = await pieceAt();
    live.run = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, f = D.LIVE, g = D.GAMES.get(f.c + '_' + f.r);
      A.menu[0].items.find(i => i.label === 'Show the way').on(); D.onTile(f.c, f.r, 0);
      for (let k = 0; k < 120 && g.state === 'run'; k++) await new Promise(ok => { setTimeout(ok, 60000); requestAnimationFrame(() => setTimeout(ok, 250)); }); return { state: g.state, why: g.run && g.run.why }; });
    live.shown = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, f = D.LIVE, c = f.c + 2, r = f.r; D.puzzleOf(D.boardIdx(c, r), D.levelOf(c, r), true);
      const look = () => JSON.stringify(A.cellItems(c, r, 400).filter(i => i.kind === 'mrMarble').map(i => [i.u.toFixed(3), i.v.toFixed(3)]));
      const seen = new Set(); for (let k = 0; k < 12; k++){ seen.add(look()); await new Promise(ok => setTimeout(ok, 300)); } return seen.size; });
    const laidOk = cellXY.blocked || (live.laid && live.laid.mine && live.laid.t === 's' && live.laid.z === cellXY.H && live.turned && (live.turned.rot !== live.laid.rot || live.turned.z !== live.laid.z));
    if (!laidOk || live.run.state !== 'won' || live.shown < 4) failures.push(`[${current}] real input: ${JSON.stringify({ cellXY, live })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} marble run (levels ${L.join('/')}; made ways run to the cup ${mr.made.map(m => m.ok + '/10').join(', ')} at levels 1, 3, 5, par ${mr.made.map(m => m.par).join('/')}; a piece out and it fell; beside the chute a straight laid turned ${mr.fit[0]} and raised to ${mr.fit[1]}; a real click laid one, another turned it, the made way ran to the cup; a board no one plays showed ${live.shown} looks)`);
  }

  // PLAYED WITH THE ROW SHUT (Oct 28: "you should not need to have the bottom browser open to play games. that is only for advanced
  // users.", then "Mostly getstures, but some buttons if needed."): the row never opens by itself; bowling bowled by a real swipe of
  // the ball (dragged along the line first, where you stand moving); curling's weight set by a real drag of the stone up the sheet
  // and its curl by the play pad's real button; marble run built by real taps alone (the stock's best piece laid, a tap again the
  // next way) and run by a real tap on the chute; and the play pads of 3D Tetris (tip), the tanks (the next shell)
  // (the next weapon), each by a real click
  current = 'played with the row shut';
  {
    const before = failures.length, out = {};
    const at = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, L = window.LAB || {}, bW = W.boardW();
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, [u, v]);
    const shut = () => page.evaluate(() => !window.tvf.bottomRow.visible);
    const swipe = async (pts, ms) => { await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down(); for (const q of pts.slice(1)){ await page.mouse.move(q.x, q.y); await page.waitForTimeout(ms); } await page.mouse.up(); };
    const go = async id => { await page.evaluate(async id => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)); if (window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(false); window.tvf.fn.syncBrowserVisibility(); }
      await new Promise(ok => setTimeout(ok, 2000)); }, id); await page.evaluate(() => window.__settle()); };
    const pad = key => page.evaluate(k => { const b = document.querySelector('#playPad button[data-key="' + k + '"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, key);
    let p, a, b, pts;   // (bowling was played here with the row shut by a swipe up its lane; since Nov 25 it is a pool game, its pad and keys pool's)
    // (curling was played here with the row shut by a drag of its stone; since Nov 25 it is a pool game, its pad and keys pool's)
    // marble run, taps alone
    await go('marblerun');
    const mr = await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE; D.GAMES.delete(f.c + '_' + f.r); const g = D.gameAt(f.c, f.r), P = g.P;
      // (an empty square next to the made way's first piece of yours: under the chute, or the next along it)
      const own = [...P.sol.keys()].find(k => !P.given.has(k)); const [i, j] = own.split(',').map(Number); return { i, j, n: P.n, start: P.start, k: own }; });
    const cell = (i, j) => at((i + 0.5) / mr.n, (j + 0.5) / mr.n);
    const piece = () => page.evaluate(k => { const D = window.getFieldApp()._debug, f = D.LIVE, g = D.GAMES.get(f.c + '_' + f.r); const pc = g.placed.get(k); return pc ? pc.t + pc.rot + '/' + pc.z : null; }, mr.k);
    p = await cell(mr.i, mr.j); await page.mouse.click(p.x, p.y); await drawn(page, 500);
    const m1 = await piece(); await page.mouse.click(p.x, p.y); await drawn(page, 500); const m2 = await piece();
    p = await cell(mr.start.i, mr.start.j); await page.mouse.click(p.x, p.y); await drawn(page, 500);
    out.mr = { laid: m1, next: m2, ran: await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = D.GAMES.get(f.c + '_' + f.r); return g.state; }) };
    // 3D Tetris: tip by the pad
    await go('blockout');
    p = await at(0.5, 0.5); await page.mouse.click(p.x, p.y); await drawn(page, 1200);
    const turns = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.games.get(f.c + '_' + f.r); return g ? g.turns : null; });
    for (let w = 0; w < 10 && !(await pad('tip')); w++) await frame(page, 250);
    const t0 = await turns(), pt = await pad('tip'); if (pt){ await page.mouse.click(pt[0], pt[1]); await drawn(page, 500); }
    out.bk = [t0, await turns()]; out.bkShut = await shut();
    // the tanks: the next shell by the pad
    await go('tanks');
    await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE; if (f) D.GAMES.delete(f.c + '_' + f.r); });
    p = await at(0.5, 0.3); await page.mouse.click(p.x, p.y);
    const wid = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.GAMES.get(f.c + '_' + f.r); return g ? g.wid[0] : null; });
    for (let w = 0; w < 20 && !(await pad('weapon')); w++) await frame(page, 250);
    const w0 = await wid(), pw = await pad('weapon'); if (pw){ await page.mouse.click(pw[0], pw[1]); await drawn(page, 500); }
    out.tk = [w0, await wid()];
    const ok = true
      && out.mr.laid && out.mr.next !== out.mr.laid && out.mr.ran !== 'build'
      && out.bk[1] > (out.bk[0] || 0) && out.bkShut && out.tk[0] !== out.tk[1] && out.tk[1] != null;
    if (!ok) failures.push(`[${current}] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} played with the row shut (marble run: real taps laid ${out.mr.laid} then ${out.mr.next}, a tap on the chute ${out.mr.ran}; 3D Tetris's Tip, the tanks' next shell by real clicks on the pad)`);
  }
  // BEJEWELED (Oct 28: "in bejeweld application, the pieces should all be small raised circles like the white one, but with
  // different colors. also, when sliding pieces, highlight the selected cells."; then "whats next for bejeweld", "1,2,5,6": special
  // gems, every board its own goal in so many moves, the feel, the board's size and colours): every kind the pearl; the levels by
  // ring and every board a goal with a par its steady player makes; four in a line a flame, an L a star, five a hypercube, each
  // going off; and real input: a real drag lighting both squares and making a flame, real clicks swapping a hypercube, a goal made
  // with stars and a best, a real click starting it again, a board out of moves, the real Size tile, and boards no one plays moving
  current = 'bejeweled';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'bejeweled')); const D = window.getFieldApp()._debug;
      D.SET.mode = 'goals'; D.SET.size = 8; D.SET.colours = 0; D.games.clear(); D.SHOWS.clear(); D.SPECS.clear();
      await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); });
    const o = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, T = window.FIELD_WORLD.THREE, out = {};
      out.shapes = new Set([0, 1, 2, 3, 4, 5, 6].map(k => A.itemGeometries['gem' + k](T).attributes.position.count)).size;
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      out.pars = [1, 3, 5].map(lv => { const S = D.specOf(4000 + lv, lv), P = D.parFor(S, Infinity); return [S.goal.kind, P.par, P.limit]; });
      // the specials, in the steady player's copies of a board laid by hand: a checker of four colours, so nothing lines up
      const S = D.specOf(7, 1), lay = f => { const g = D.newGame(S, 1, 'goals', true), n = g.n;
        g.ice = new Uint8Array(n * n); for (let i = 0; i < n * n; i++) g.b[i] = { k: (i % 2) + ((i / n | 0) % 2) * 2, sp: 0, fr: (i / n) | 0, fc: 0, t0: -9, how: 'fall' };
        f(g, n, (c, r, k, sp) => { g.b[r * n + c] = { k, sp: sp || 0, fr: r, fc: 0, t0: -9, how: 'fall' }; }); return g; };
      const count = (g, sp) => g.b.filter(x => x && x.sp === sp).length;
      let g = lay((g, n, put) => { put(0, 4, 5); put(1, 4, 5); put(3, 4, 5); put(2, 3, 5); }); D.simMove(g, 3 * g.n + 2, 4 * g.n + 2); out.flame = count(g, D.FLAME);
      g = lay((g, n, put) => { put(0, 4, 5); put(1, 4, 5); put(3, 4, 5); put(4, 4, 5); put(2, 3, 5); }); D.simMove(g, 3 * g.n + 2, 4 * g.n + 2); out.hyper = count(g, D.HYPER);
      g = lay((g, n, put) => { put(0, 4, 6); put(1, 4, 6); put(3, 4, 6); put(2, 5, 6); put(2, 6, 6); put(2, 3, 6); }); D.simMove(g, 3 * g.n + 2, 4 * g.n + 2); out.star = count(g, D.STAR);
      // a flame going off takes its 3 × 3: a flame at (4, 4) in a line of three made by a swap
      g = lay((g, n, put) => { put(2, 4, 5); put(3, 4, 5); put(4, 4, 5, D.FLAME); }); const was = g.got.col.reduce((a, b) => a + b, 0);
      g.swapped = null; D.act(g, 'check'); out.flameTook = g.got.col.reduce((a, b) => a + b, 0) - was;
      return out;
    });
    const bPt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW();
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW, 0, T.boardZ + (0.5 - v) * bW).project(W.camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, [u, v]);
    const cellPt = (c, r) => bPt((c + 0.5) / 8, (r + 0.5) / 8);
    let q = await bPt(0.5, 0.5); await page.mouse.click(q.x, q.y); await drawn(page, 1500);
    // the live board laid by hand: a drag of (2, 3) down to (2, 4) makes four in a line
    const layLive = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = D.games.get(L.c + '_' + L.r), n = g.n;
      g.ice = new Uint8Array(n * n); g.after = null; g.until = 0; g.state = 'play'; g.sel = -1; g.drag = null;
      for (let i = 0; i < n * n; i++) g.b[i] = { k: (i % 2) + ((i / n | 0) % 2) * 2, sp: 0, fr: (i / n) | 0, fc: 0, t0: -9, how: 'fall' };
      return !!g; });
    const live = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.games.get(L.c + '_' + L.r); if (!g) return null;
      const grid = D.gridOf(g, false); return { moves: g.moves, flames: g.b.filter(x => x && x.sp === D.FLAME).length, lit: D.litOf(g), sel: grid.colors.filter(c => c === 0xa9c6ec).length,
        state: g.state, stars: g.stars, limit: g.limit, n: g.n, col1: g.got.col[1], at: [L.c, L.r], busy: !!g.after || g.t < g.until }; });
    await layLive();
    await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = D.games.get(L.c + '_' + L.r), n = g.n, put = (c, r, k) => { g.b[r * n + c] = { k, sp: 0, fr: r, fc: 0, t0: -9, how: 'fall' }; };
      put(0, 4, 5); put(1, 4, 5); put(3, 4, 5); put(2, 3, 5); });
    const a = await cellPt(2, 3), b = await cellPt(2, 4.3);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + (b.x - a.x) * 0.3, a.y + (b.y - a.y) * 0.3, { steps: 3 }); await page.waitForTimeout(300);
    const mid = await live();
    await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    for (let w = 0; w < 80 && (await live()).busy; w++) await frame(page, 250);
    const flamed = await live();
    // two real clicks swap a hypercube with a colour: every gem of it goes
    await layLive();
    const ones = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = D.games.get(L.c + '_' + L.r), n = g.n;
      g.b[5 * n + 5] = { k: D.HYPER_K, sp: D.HYPER, fr: 5, fc: 0, t0: -9, how: 'fall' }; g.b[5 * n + 6] = { k: 1, sp: 0, fr: 5, fc: 0, t0: -9, how: 'fall' }; g.sel = -1; return g.b.filter(x => x && x.k === 1).length; });
    for (const [c, r] of [[5, 5], [6, 5]]){ const p = await cellPt(c, r); await page.mouse.click(p.x, p.y); await frame(page, 450); }
    for (let w = 0; w < 80 && (await live()).busy; w++) await frame(page, 250);
    const hyp = await live();
    // a goal made: the next match makes it, stars and a best kept; a real click after starts the board again where it is (Oct 29)
    await layLive();
    await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = D.games.get(L.c + '_' + L.r), n = g.n, put = (c, r, k) => { g.b[r * n + c] = { k, sp: 0, fr: r, fc: 0, t0: -9, how: 'fall' }; };
      g.S = { ...g.S, goal: { kind: 'score', n: 10 } }; put(0, 6, 5); put(1, 6, 5); put(2, 5, 5); });
    let p1 = await cellPt(2, 5), p2 = await cellPt(2, 6);
    await page.mouse.click(p1.x, p1.y); await page.waitForTimeout(350); await page.mouse.click(p2.x, p2.y);
    for (let w = 0; w < 80 && (await live()).state === 'play'; w++) await frame(page, 250);
    const won = await live();
    const best = await page.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('bejeweled.best') || '{}')).length; } catch { return -1; } });
    await drawn(page, 1000);
    q = await bPt(0.5, 0.5); await page.mouse.click(q.x, q.y); await drawn(page, 1800);
    const next = await live() || { at: await page.evaluate(() => { const L = window.getFieldApp()._debug.LIVE; return L && [L.c, L.r]; }) };
    // out of moves: a limit of one more, a goal not made
    await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE; D.games.delete(L.c + '_' + L.r); });
    q = await bPt(0.5, 0.5); await page.mouse.click(q.x, q.y); await drawn(page, 800);
    await layLive();
    await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = D.games.get(L.c + '_' + L.r), n = g.n, put = (c, r, k) => { g.b[r * n + c] = { k, sp: 0, fr: r, fc: 0, t0: -9, how: 'fall' }; };
      g.S = { ...g.S, goal: { kind: 'score', n: 1e9 } }; g.limit = g.moves + 1; g.sel = -1; put(0, 6, 5); put(1, 6, 5); put(2, 5, 5); });
    p1 = await cellPt(2, 5); p2 = await cellPt(2, 6);
    await page.mouse.click(p1.x, p1.y); await page.waitForTimeout(350); await page.mouse.click(p2.x, p2.y);
    for (let w = 0; w < 80 && (await live()).state === 'play'; w++) await frame(page, 250);
    const lost = await live();
    // the real Size tile: a board of 9
    if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ const h = await page.$('#bbHandle'); if (h) await h.click(); await drawn(page, 600); }
    const tileAt = n => page.evaluate(n => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_' + n && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, n);
    let st = null; for (let w = 0; w < 30; w++){ st = await tileAt(2); if (st && st[1] < (await page.evaluate(() => innerHeight)) - 20) break; await frame(page, 200); }   // (the row slides up)
    if (st){ await page.mouse.click(st[0], st[1]); await drawn(page, 600); }
    const size = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE; return [D.SET.size, D.showAt(L.c + 1, L.r).n]; });
    if (await page.evaluate(() => window.tvf.bottomRow.visible)){ await page.evaluate(() => document.getElementById('bbHandle').click());   // (the dots are hidden while the row is open, Nov 1: shut through the element itself)
      await drawn(page, 400); }
    await page.evaluate(() => { const D = window.getFieldApp()._debug; D.SET.size = 8; try { localStorage.setItem('bejeweled.settings', JSON.stringify(D.SET)); } catch {} D.games.clear(); D.SHOWS.clear(); });
    // a board no one plays moves
    const sig = () => page.evaluate(() => { const A = window.getFieldApp(), L = A._debug.LIVE; return JSON.stringify(A.cellItems(L.c + 2, L.r).filter(i => /^gem|^bj/.test(i.kind)).map(i => [i.kind, +i.u.toFixed(3), +i.v.toFixed(3)])); });
    let moved = false; const s0 = await sig(); for (let w = 0; w < 25 && !moved; w++){ await frame(page, 300); moved = (await sig()) !== s0; }
    const ok = o.shapes === 1 && o.levels[0] < o.levels[3] && o.pars.every(([, par, lim]) => par >= 1 && lim > par) && o.flame === 1 && o.hyper === 1 && o.star === 1 && o.flameTook >= 9
      && mid && mid.lit.join() === '26,34' && mid.sel === 2 && flamed.moves === 1 && flamed.flames >= 1
      && hyp.col1 >= ones && won.state === 'won' && won.stars >= 1 && best >= 1 && next.at && next.at[0] === won.at[0] && next.at[1] === won.at[1] && next.state !== 'won'
      && lost.state === 'lost' && size[0] === 9 && size[1] === 9 && moved;
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ o, mid, flamed, ones, hyp, won, best, next, lost, size, moved })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} bejeweled (every kind the pearl; levels ${o.levels.join('/')}; pars ${o.pars.map(p => p.join(' ')).join(', ')}; a flame, a star and a hypercube made, a flame taking ${o.flameTook}; a real drag lit ${mid && mid.lit} and made a flame; real clicks swapped a hypercube, ${hyp.col1} of a colour gone; a goal made ${won.stars}★, a real click on to ${next.at}; out of moves ${lost.state}; the real Size tile ${size.join('/')}; a board no one plays moving)`);
  }
  // AIR HOCKEY'S ROUNDED CORNERS (Oct 29: "balls get stuck in the corners in air hockey"): a puck pressed into a corner by a mallet
  // slides out along the arc, one sent along a rail comes round the corner, and over two computer matches the puck is hardly in one
  current = 'air hockey corners';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'airhockey')); await new Promise(ok => setTimeout(ok, 1500)); });
    const o = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {};
      let G = D.newMatch(5, 1, { seed: 1 }); const p = G.puck, M = G.mal[0];
      Object.assign(p, { x: 0.03, y: 0.97, vx: 0, vy: 0 }); M.x = 0.1; M.y = 0.9; M.ai = null;
      let t = 0; for (; t < 60 * 8; t++){ M.tx = 0; M.ty = 1; D.tick(G); if (p.x > 0.12 || p.y < 0.88) break; }
      out.pressed = +(t / 60).toFixed(2);
      G = D.newMatch(5, 1, { seed: 2 }); const q = G.puck; G.mal.forEach((m, k) => { m.ai = null; m.tx = null; m.dx = 0; m.dy = 0; m.x = 0.31; m.y = k ? 0.2 : 0.8; });
      Object.assign(q, { x: 0.024, y: 0.75, vx: 0, vy: 0.6 }); for (let k = 0; k < 120; k++) D.tick(G);
      out.round = q.x > 0.15;
      let corner = 0, total = 0, longest = 0, run = 0;
      for (let s = 0; s < 2; s++){ G = D.newMatch(40 + s, 3, { ai0: D.STEADY, seed: s });
        for (let k = 0; k < 60 * 150 && G.state !== 'over'; k++){ D.tick(G); const b = G.puck; total++;
          if (G.state === 'play' && D.cornerAt(b.x, b.y)){ corner++; run++; longest = Math.max(longest, run); } else run = 0; } }
      out.share = +(corner / total).toFixed(4); out.longest = +(longest / 60).toFixed(2);
      return out;
    });
    if (!(o.pressed < 2 && o.round && o.share < 0.03 && o.longest < 1.5)) failures.push(`[${current}] ${JSON.stringify(o)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} air hockey corners (a pressed puck out in ${o.pressed} s, one along the rail round the corner, the puck in a corner ${o.share} of two matches, ${o.longest} s at most)`);
  }
  // ASTEROIDS: CLEARED BOARDS STAY CLEARED, ENDLESS SHIPS (Oct 29: "asteroids - dont reset the board, once a board is cleared keep it
  // cleared.    continuos lives don't end game after 3 deaths."): a real click starting, four ships lost and still playing, the last
  // rock gone and no new wave, the board empty when left and when played again, another board's rocks still there
  current = 'asteroids cleared and endless';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'asteroids')); await new Promise(ok => setTimeout(ok, 2000)); await window.__settle(); });
    await page.mouse.click(640, 400); await drawn(page, 1200);
    const o = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, L = D.LIVE, g = L && D.games.get(L.c + '_' + L.r), out = { started: !!g && g.state === 'play' };
      if (!g) return out;
      D.CLEARED.delete(L.c + '_' + L.r);
      // (counted from where it was: a rock can take a ship in the moment after the click, which made five on CI, Oct 29)
      const lost0 = g.lost || 0; for (let k = 0; k < 4; k++) D.lose(g);
      out.losses = [g.state, g.lost - lost0];
      g.rocks.length = 0; g.ufo = null;
      for (let k = 0; k < 300; k++) D.step(g, 1 / 60);
      out.cleared = [D.CLEARED.has(L.c + '_' + L.r), g.rocks.length];
      D.games.delete(L.c + '_' + L.r); const was = D.LIVE; D.LIVE = null;
      out.shown = D.shown(L.c, L.r).rocks.length;
      const g2 = D.gameAt(L.c, L.r); D.start(g2); for (let k = 0; k < 300; k++) D.step(g2, 1 / 60);
      out.again = g2.rocks.length;
      // (another board played the same way has its rocks, or its next wave: its picture alone, a reel frame by the clock, can fall
      //  between two waves with none, which failed once on CI, Oct 29)
      // (a board of an earlier check may have been left cleared, and a wave comes a moment after the last one: the most rocks it had
      //  in six seconds, from a board that is not cleared, Oct 29)
      D.CLEARED.delete((L.c + 3) + '_' + L.r);
      const g3 = D.newGame(); g3.at = [L.c + 3, L.r]; g3.lv = 'normal'; D.start(g3);   // (a game of its own, not the board's reel adopted at a frame the clock picks: it sat between waves on CI twice, Oct 31)
       out.other = 0; for (let k = 0; k < 720; k++){   // (twelve seconds: six gave a board with no rock on CI, Oct 31)
       D.step(g3, 1 / 60); out.other = Math.max(out.other, g3.rocks.length); }
      D.games.delete((L.c + 3) + '_' + L.r); D.CLEARED.delete((L.c + 3) + '_' + L.r);
      D.LIVE = was; D.CLEARED.delete(L.c + '_' + L.r); try { localStorage.removeItem('asteroids.cleared'); } catch {}
      return out;
    });
    if (!(o.started && o.losses[0] === 'play' && o.losses[1] === 4 && o.cleared[0] && o.cleared[1] === 0 && o.shown === 0 && o.again === 0 && o.other > 0))
      failures.push(`[${current}] ${JSON.stringify(o)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} asteroids cleared and endless (a real click started; four ships lost, still ${o.losses && o.losses[0]}; cleared and no new wave; empty when left and played again; another board ${o.other} rocks)`);
  }
  // ASTEROIDS' SETTINGS ROW (Oct 29: "what are cusomization options", then "1,2,3,4,5,6"): rocks a wave by the setting, the start
  // wave, the shield, triple shot and arcade drift always as set, saucers and gems off, the look's outlines drawn, and the real
  // Look tile clicked in the row
  current = 'asteroids settings';
  {
    const before = failures.length;
    const o = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {}, keep = { ...D.SET };
      const count = rocks => { D.SET.rocks = rocks; const h = D.newGame(); h.lv = 'normal'; D.nextWave(h); return h.rocks.length; };
      out.counts = ['fewer', 'normal', 'more'].map(count); D.SET.rocks = 'normal';
      const g = D.newGame(); g.at = [9001, 3]; g.lv = 'normal';
      D.SET.wave = 5; D.start(g); for (let k = 0; k < 200; k++) D.step(g, 1 / 60); out.wave = g.wave;
      D.SET.shield = true; g.ship.safe = 0; const l0 = g.lost || 0; g.rocks.push({ x: g.ship.x, y: g.ship.y, vx: 0, vy: 0, size: 3, k: 0 }); D.step(g, 1 / 60); out.shield = (g.lost || 0) === l0; D.SET.shield = false;
      D.SET.triple = true; g.shots = []; g.cool = 0; g.ship.alive = true;   // (a rock may have taken the ship in the 200 steps before: CI, Oct 31)
      D.fire(g); out.triple = g.shots.length; D.SET.triple = false;
      D.SET.drift = 'arcade'; Object.assign(g.ship, { vx: 0.3, vy: 0, alive: true }); g.rocks = []; for (let k = 0; k < 60; k++) D.step(g, 1 / 60); out.arcade = Math.hypot(g.ship.vx, g.ship.vy); D.SET.drift = 'classic';
      D.SET.saucers = false; D.SET.gems = false; const h = D.newGame(); h.lv = 'normal'; h.state = 'play'; h.ufoIn = 0; D.nextWave(h); for (let k = 0; k < 600; k++) D.step(h, 1 / 60); out.ufo = !!h.ufo;
      D.SET.look = 'vector'; const items = D.asItems(D.snap(h)); out.vector = items.some(i => /^vrock/.test(i.kind)) && !items.some(i => /^rock\d/.test(i.kind));
      Object.assign(D.SET, keep, { look: '3d' });
      return out;
    });
    if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ const h = await page.$('#bbHandle'); if (h) await h.click(); }
    const tileAt = n => page.evaluate(n => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_' + n && t.style.display !== 'none'); if (!t) return null; const b = t.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, n);
    let lt = null; for (let w = 0; w < 30; w++){ lt = await tileAt(1); if (lt && lt[1] < (await page.evaluate(() => innerHeight)) - 20) break; await frame(page, 200); }
    if (lt){ await page.mouse.click(lt[0], lt[1]); await drawn(page, 500); }
    const look = await page.evaluate(() => window.getFieldApp()._debug.SET.look);
    await page.evaluate(() => { const D = window.getFieldApp()._debug; D.SET.look = '3d'; try { localStorage.removeItem('asteroids.settings'); } catch {} });
    if (await page.evaluate(() => window.tvf.bottomRow.visible)){ await page.evaluate(() => document.getElementById('bbHandle').click());   // (the dots are hidden while the row is open, Nov 1: shut through the element itself)
      await drawn(page, 400); }
    if (!(o.counts.join() === '2,4,6' && o.wave === 5 && o.shield && o.triple === 3 && o.arcade < 0.03 && !o.ufo && o.vector && look === 'vector'))
      failures.push(`[${current}] ${JSON.stringify({ o, look })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} asteroids settings (rocks ${o.counts}, start at wave ${o.wave}, the shield, ${o.triple} shots, arcade drift stopping, no saucer, the outlines; the real Look tile to ${look})`);
  }
  // OFF ITS DEFAULT POSITION, A DOUBLE TAP PUTS IT BACK (Oct 28: "If a board is not in the default position than let double click
  // put it in the default position."): in Lights Out (whose quick second taps are moves) and in Pong and pinball (which take
  // every press before the field), a game under way, the view zoomed by the real wheel, a real touch double tap on the board
  // puts it back where the 0 key does; at its default position the field reads it as such (framedAsDefault)
  current = 'double tap off default';
  {
    const before = failures.length, out = {};
    for (const id of ['lightsout', 'pong', 'pinball']){
      await page.evaluate(async id => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)); await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); }, id);
      const mid = () => page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target; const p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; });
      const fd = () => page.evaluate(() => window.tvf.fn.framedAsDefault());
      const r = { at: await fd() };
      let m = await mid(); await page.mouse.click(m.x, m.y); await drawn(page, 1500);       // (starts the board's game)
      r.kept = await page.evaluate(() => { const a = window.getFieldApp(); return !!(a.noDoubleTap && a.noDoubleTap()); });
      await page.mouse.move(m.x, m.y); for (let k = 0; k < 6; k++){ await page.mouse.wheel(0, 200); await page.waitForTimeout(150); }
      await drawn(page, 1500);
      r.moved = await fd();
      m = await mid();
      // (the view at rest first, as the double-tap check above waits: a tap while it coasts is the brake; both taps' events made
      //  before either is sent)
      await page.evaluate(async ([x, y]) => { const cv = document.querySelector('canvas'), S = window.tvf.state, T = window.FIELD_WORLD.target, wait = ms => new Promise(ok => setTimeout(ok, ms));
        for (let k = 0; k < 80 && (T.active || S.heldPanRate); k++) await wait(250);
        const tap = () => { const t = new Touch({ identifier: 7, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
          const te = (type) => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] });
          const pe = (type) => new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y });
          return [pe('pointerdown'), te('touchstart'), pe('pointerup'), te('touchend')]; };
        for (const e of [...tap(), ...tap()]) cv.dispatchEvent(e);
        await wait(300); for (let k = 0; k < 120 && T.active; k++) await wait(250); await wait(600); }, [m.x, m.y]);
      r.back = await fd();
      out[id] = r;
    }
    if (!Object.values(out).every(r => r.at && r.kept && !r.moved && r.back)) failures.push(`[${current}] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} double tap off default (Lights Out, Pong and pinball, a game under way and the view zoomed by the real wheel: a real double tap put the board back where the 0 key does)`);
  }
  {
    /* BOARDS COLOURED BY DIFFICULTY (Oct 29: "boards should be colored by difficulty"): a game with levels has its steps by ring
       (the field asks the app, `__diff`), a game with none (chess) has no tint, the near boards have a mat each, and the fabric has the steps. */
    current = 'difficulty colours'; const before = failures.length;
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(ok => setTimeout(ok, ms)), out = {};
      for (const id of ['lightsout', 'chess', 'minigolf']){
        window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === id)); await wait(2500);
        out[id] = { on: window.__diff.on, thr: window.__diff.thr.slice(0, 3), val: window.__diff.val.slice() };
      }
      const U = window.__fieldFabric.material.uniforms;
      out.fabric = { on: U.uDiffOn.value, thr: U.uDiffThr.value.toArray().slice(0, 3), gs: U.uDiffGS.value };
      return out;
    });
    const ok = r.lightsout.on && r.minigolf.on && !r.chess.on && r.lightsout.thr.join() === '7,15,31' && r.minigolf.thr.join() === '7,15,31'
      && r.fabric.on === 1 && r.fabric.thr.join() === '7,15,31' && r.fabric.gs >= 1;
    if (!ok) failures.push(`[${current}] ${JSON.stringify(r)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} difficulty colours (the steps at rings 7, 15 and 31 for Lights Out and mini golf, none for chess, the fabric given them)`);
  }
  {
    /* THE BOARD LOCK and THE DIFFICULTY FLIGHT (Oct 31: "double clicking a board should lock the board in position and set the board so
       it does not pan." and "difficulty setting in the menu should move to a board with that difficulty setting."): a real double
       tap frames the board and locks it, a real drag then moves nothing, a double tap on the square board lets it go and a drag pans
       again; and each step of the Difficulty item flies to the nearest board of its colour (1, 3, 5). */
    current = 'board lock and difficulty flight'; const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'checkers')); await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); });
    const camX = () => page.evaluate(() => [window.FIELD_WORLD.st.camX, window.FIELD_WORLD.st.camZ]);
    const mid = () => page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target; const p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; });
    const dbl = async ([x, y]) => page.evaluate(async ([x, y]) => { const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms)), T = window.FIELD_WORLD.target, S = window.tvf.state;
      for (let k = 0; k < 80 && (T.active || S.heldPanRate); k++) await wait(250);
      const tap = () => { const t = new Touch({ identifier: 7, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
        const te = type => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] });
        const pe = type => new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y });
        return [pe('pointerdown'), te('touchstart'), pe('pointerup'), te('touchend')]; };
      for (const e of [...tap(), ...tap()]) cv.dispatchEvent(e);
      await wait(300); for (let k = 0; k < 120 && T.active; k++) await wait(250); await wait(600); }, [x, y]);
    const drag = async () => { const m = await mid(); await page.mouse.move(m.x, m.y); await page.mouse.down(); for (let k = 1; k <= 8; k++){ await page.mouse.move(m.x + 18 * k, m.y + 6 * k); await page.waitForTimeout(40); } await page.mouse.up(); await frame(page, 500); };
    const out = {};
    // (Nov 1: "double click still not reseting games when the board is in default view. Add a confirmation dialog": in its default view a
    //  double tap on the board asks to start the game over, so the lock is taken from a double in any other view, here a wheel's zoom
    //  away, and let go by the menu's Unlock the board)
    const off = async () => { const m0 = await mid(); await page.mouse.move(m0.x, m0.y); await page.mouse.wheel(0, 500); await drawn(page, 1200); await page.evaluate(() => window.__settle()); };
    await off();
    let m = await mid(); await dbl([m.x, m.y]);
    out.locked = await page.evaluate(() => window.__boardLock());
    const c0 = await camX(); await drag(); const c1 = await camX();
    out.heldStill = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) < 1e-6;
    await page.evaluate(() => document.getElementById('bBoardLock').click());
    out.unlocked = await page.evaluate(() => !window.__boardLock());
    const c2 = await camX(); await drag(); const c3 = await camX();
    out.pansAgain = Math.hypot(c3[0] - c2[0], c3[1] - c2[1]) > 1e-3;
    // a locked board holds only against a drag on it (Nov 1: "don't block panning of non-selected boards."): locked again, a drag that
    // starts on another board (out at the screen's edge) pans the view and lets the lock go
    await off(); m = await mid(); await dbl([m.x, m.y]);
    out.relocked = await page.evaluate(() => window.__boardLock());
    const c4 = await camX();
    { const x0 = 40, y0 = Math.round((await page.evaluate(() => innerHeight)) * 0.45); await page.mouse.move(x0, y0); await page.mouse.down();
      for (let k = 1; k <= 8; k++){ await page.mouse.move(x0 + 18 * k, y0 + 6 * k); await page.waitForTimeout(40); } await page.mouse.up(); await frame(page, 300); }
    const c5 = await camX();
    out.otherPans = Math.hypot(c5[0] - c4[0], c5[1] - c4[1]) > 1e-3 && await page.evaluate(() => !window.__boardLock());
    // TWO FINGERS AND THE WHEEL ARE NEVER LOCKED (Nov 4: "two finger panning and wheel should always work, don't lock them down."): locked
    // again, a trackpad's two-finger scroll over the locked board still pans the view, and the lock stays
    await off(); m = await mid(); await dbl([m.x, m.y]);
    out.relocked2 = await page.evaluate(() => window.__boardLock());
    const c6 = await camX();
    await page.evaluate(([x, y]) => { const cv = document.querySelector('canvas'); for (let k = 0; k < 8; k++) cv.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaX: 14.5 + k * 0.25, deltaY: 6.25, deltaMode: 0 })); }, [m.x, m.y]);
    await drawn(page, 400);
    const c7 = await camX();
    out.padPans = Math.hypot(c7[0] - c6[0], c7[1] - c6[1]) > 1e-3 && await page.evaluate(() => window.__boardLock());
    await page.evaluate(() => window.__boardLockSet(false));
    // the Difficulty item: each step on a game with levels goes to a board of its colour
    out.fly = await page.evaluate(async () => {
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'lightsout')); const wait = ms => new Promise(ok => setTimeout(ok, ms)); await wait(2500); await window.__settle();
      const A = window.getFieldApp(), item = A.menu[0].items.find(i => /^Difficulty/.test(typeof i.label === 'function' ? i.label() : i.label)), W = window.FIELD_WORLD, T = W.target, rows = [];
      for (let k = 0; k < 3; k++){
        item.on(); const lab = typeof item.label === 'function' ? item.label() : item.label; await wait(400);
        for (let j = 0; j < 80 && T.active; j++) await wait(250);
        const f = W.cellAt(T.boardX, T.boardZ), want = /easy/i.test(lab) ? 1 : /hard/i.test(lab) ? 5 : 3;
        rows.push({ lab: lab.slice(0, 20), want, got: A._debug.levelOf(f.c, f.r) });
      }
      item.on(); item.on(); item.on();   // (round to where it began)
      return rows; });
    if (!(out.locked && out.heldStill && out.unlocked && out.pansAgain && out.relocked && out.otherPans && out.relocked2 && out.padPans && out.fly.every(r => r.want === r.got))) failures.push(`[${current}] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} board lock and difficulty flight (a real double tap locked the board and a real drag moved nothing, another let it go and the drag panned, and locked again a drag from another board panned and let the lock go; the Difficulty item went to levels ${out.fly.map(r => r.got).join('/')})`);
  }
  {
    /* TWO-FINGER ROTATION ON A TRACKPAD (Oct 31: "the two finger rotation works on touch devices, not on touch pads on portable computers"): a
       pad sends wheel events, not touches, and Chrome sends no rotation: Alt with a two-finger sideways scroll turns the view about its
       middle (WebKit's gesture rotation, which a test cannot send, goes the same way). */
    current = 'trackpad rotation'; const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'checkers')); await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); });
    const yaw = () => page.evaluate(() => window.FIELD_WORLD.st.yaw);
    const y0 = await yaw();
    await page.mouse.move(640, 400); await page.keyboard.down('Alt');
    for (let k = 0; k < 8; k++){ await page.mouse.wheel(12.5, 0); await page.waitForTimeout(30); }
    await page.keyboard.up('Alt'); await drawn(page, 300);
    const y1 = await yaw();
    const turned = Math.abs(y1 - y0) > 10 && Math.abs(y1 - y0) < 60;
    if (!turned) failures.push(`[${current}] yaw ${y0} -> ${y1}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} trackpad rotation (Alt with a two-finger sideways scroll turned the view ${(y1 - y0).toFixed(1)} degrees)`);
  }
  // INVADERS (Nov 6: "Invaders let the user move forward.  Add difficulty menu setting.   Less difficult smaller board and slower."):
  // the formation 7, 9 or 11 across by level, easy marching slower, and the ship going forward under ky with its shots from there.
  current = 'invaders';
  {
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'invaders')); await new Promise(ok => setTimeout(ok, 1500)); });
    const iv = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {};
      out.cols = ['easy', 'normal', 'hard'].map(l => D.newGame(l).f.cols);
      out.sizes = ['easy', 'normal', 'hard'].map(l => D.newGame(l).n);
      out.lives = ['easy', 'normal', 'hard'].map(l => D.newGame(l).lives);
      // a dozen formations in all, each non-empty at every width; every board its own to begin with; a power-up falling from kills
      out.shapes = new Set(Array.from({ length: 12 }, (_, i) => D.newGame('normal', i).f.shape)).size;
      out.nonEmpty = ['easy', 'normal', 'hard'].every(l => Array.from({ length: 12 }, (_, i) => D.newGame(l, i).f.inv.length).every(n => n >= 8));
      out.fromCorner = [D.gameAt(0, 0).f.shape, D.gameAt(1, 0).f.shape, D.gameAt(2, 0).f.shape];
      out.n = ['easy', 'normal', 'hard'].map(l => D.newGame(l).f.inv.length);
      const g = D.newGame('normal'); g.state = 'play'; g.lv = 'normal';
      const y0 = g.ship.y; for (let i = 0; i < 30; i++) D.step(g, 1 / 30, { kx: 0, ky: -1, fire: false });
      const y1 = g.ship.y; D.fire(g); out.shotFromShip = g.shots.length === 1 && g.shots[0].y < y1;
      for (let i = 0; i < 90; i++) D.step(g, 1 / 30, { kx: 0, ky: 1, fire: false });
      out.y = [y0, y1, g.ship.y];
      return out;
    });
    const ok = iv.cols.join() === '7,9,11' && iv.sizes.join() === '16,20,24' && iv.lives.join() === '5,3,2' && iv.shapes === 12 && iv.nonEmpty && new Set(iv.fromCorner).size > 1 && iv.n[0] < iv.n[1] && iv.n[1] < iv.n[2] && iv.shotFromShip && iv.y[1] < iv.y[0] - 0.2 && iv.y[2] === iv.y[0];
    if (!ok) failures.push('[invaders forward] ' + JSON.stringify(iv));
    console.log(`${ok ? 'ok  ' : 'FAIL'} invaders: a smaller formation when easy, the ship going forward and back, its shots from where it is`);
  }

    // BOARD WAR, on mini golf's ground (Nov 8: "I was thinking more like combining missle command and mini-golf terrain and walls."): every board a mini golf
    // hole's hills and walls in its owner's colour, the keep on the cup, high arcs coming down where aimed, flat shots stopped by what stands in their way
    // BOARD WAR (Nov 8: "create a game where boards are at war with each other.   when a board is defeated, it joins the side that defeated it.   create
    // various types of missel launchers to lauch missles at each other."): the sides by block, each launcher's range, damage, volley and reload, a board
    // at no hit points joining the side whose missile took it (kept in storage), the warhead's splash, the war going on by itself, the pieces, and real input
    current = 'boardwar';
    // (the war opens on mini golf's Medium boards unless its own Board size says otherwise, Nov 10; these checks are written on the Small ones, 8 × 13)
    await page.evaluate(() => { localStorage.setItem('boardwar.size', JSON.stringify('small')); window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'boardwar')); });
    await drawn(page, 1500);
    const bw = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {}, K = D.KINDS, key = (c, r) => D.wrapc(c) * 10000 + D.wrapc(r);
      D.applySize();   // (the Small boards, 8 × 13, for sure: a slow runner had not yet switched golf's size by now)
      D.newWar(); D.setGoal(0); D.SIM.quiet = true; D.SIM.ideal = true; D.LIVE = { c: 0, r: 0 };   // (a free war: these checks take boards; ideal: no scatter and nothing in the way, so each kind's damage is exact)
      // the sides: the corner's block yours, all four across the field, the same each time
      const own = () => { const a = []; for (let c = 0; c < 40; c++) for (let r = 0; r < 40; r++) a.push(D.ownerOf(c, r)); return a.join(''); };
      const a1 = own(); out.sides = [0, 1, 2, 3].every(s => a1.includes(String(s))) && own() === a1 && [0, 1, 2, 3, 4].every(c => [0, 1, 2, 3, 4].every(r => D.ownerOf(c, r) === D.SIDE));
      // the kinds: a mortar's reach, a rocket battery's volley of four, a cruise missile, a cluster's six, a warhead; each takes exactly its damage
      D.capture(1, 0, (D.SIDE + 1) % 4); D.capture(2, 0, (D.SIDE + 1) % 4); D.capture(2, 1, (D.SIDE + 1) % 4); D.capture(3, 0, (D.SIDE + 2) % 4);
      const hit = [];
      for (let k = 0; k < 5; k++){
        D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t }); D.rearm(0, 0);
        const n = D.launch(0, 0, k, 1, 0, 0);
        D.advance(K[k].fly * 1.12 + (K[k].n - 1) * K[k].gap + 0.25);
        hit.push([n, Math.round(100 - D.hpOf(1, 0))]);
      }
      out.hit = hit.map(h => h.join(':')).join();
      out.want = K.map(x => x.n + ':' + x.n * x.dmg).join();
      // the range (a mortar will not reach two boards), a friend refused, the reload (no second shot at once, one after its time)
      D.rearm(0, 0); out.far = D.launch(0, 0, 0, 3, 0, 0) + ',' + D.launch(0, 0, 0, 2, 0, 0);
      D.rearm(0, 0); out.friend = D.launch(0, 0, 0, 0, 1, 0);
      D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t }); D.rearm(0, 0); D.MIS.length = 0;
      const first = D.launch(0, 0, 0, 1, 0, 0), second = D.launch(0, 0, 0, 1, 0, 0); D.advance(K[0].reload + 0.1); const third = D.launch(0, 0, 0, 1, 0, 0);
      out.reload = [first, second, third].join();
      D.advance(3); D.MIS.length = 0;
      // the warhead's splash: the boards round the one it strikes take 12 (the hostile ones; a friend's is left)
      D.capture(2, 0, (D.SIDE + 1) % 4); D.HP.set(key(2, 0), { hp: 100, hit: D.SIM.t }); D.HP.set(key(2, 1), { hp: 100, hit: D.SIM.t }); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t }); D.HP.set(key(0, 0), { hp: 100, hit: D.SIM.t });
      D.rearm(0, 0); D.launch(0, 0, 4, 1, 0, 0); D.advance(K[4].fly * 1.12 + 0.25);
      out.splash = [D.hpOf(1, 0), D.hpOf(2, 0), D.hpOf(2, 1), D.hpOf(0, 0)].map(Math.round).join();
      // a board at no hit points joins the side whose missile finished it, with 40 back, kept in storage; the ring in its new colours is drawn
      D.capture(1, 0, (D.SIDE + 1) % 4); D.HP.set(key(1, 0), { hp: 5, hit: D.SIM.t }); D.rearm(0, 0); D.launch(0, 0, 0, 1, 0, 0); D.advance(K[0].fly * 1.12 + 0.25);
      out.taken = [D.ownerOf(1, 0) === D.SIDE, Math.round(D.hpOf(1, 0)), JSON.parse(localStorage.getItem('boardwar.own'))[key(1, 0)] === D.SIDE, D.FX.some(e => e.cap === D.SIDE && e.c === 1)].join();
      // the pieces: the keep, the five launchers, reload bars, hit points; a missile over the board it left, then over the board it falls on
      const kinds = it => it.map(x => x.kind);
      const ks = kinds(D.itemsOf(0, 0));
      out.pieces = ['bwmortar', 'bwrockets', 'bwcruise', 'bwcluster', 'bwwarhead'].every(k => ks.includes(k)) && ks.some(k => /^bwKeep/.test(k)) && ks.filter(k => k === 'bwBar').length >= 11;
      D.capture(1, 0, (D.SIDE + 1) % 4); D.rearm(0, 0); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t });
      D.launch(0, 0, 2, 1, 0, 0); const m = D.MIS[D.MIS.length - 1];
      D.advance(m.dur * 0.2); const early = [kinds(D.itemsOf(0, 0)).includes('bwShell'), kinds(D.itemsOf(1, 0)).includes('bwShell')];
      D.advance(m.dur * 0.5); const late = [kinds(D.itemsOf(0, 0)).includes('bwShell'), kinds(D.itemsOf(1, 0)).includes('bwShell')];
      out.flight = early.join() + '|' + late.join();
      D.advance(5); D.MIS.length = 0;
      // the ground is mini golf's: a golf hole's ground and rails under every board, none of its flag, ball or scoreboard, the keep on the cup, the
      // launchers on ground that is free; a high arc comes down where it was aimed, a flat shot stops at the first wall, fence, boulder or rise in its way
      D.SIM.ideal = false;
      const g0 = D.itemsOf(0, 0).map(x => x.kind);
      out.golf = [g0.some(k => /^land/.test(k)), g0.some(k => /^rail[VH]_/.test(k)), !g0.some(k => /^(cup|pole|pennant|ball|plate)$/.test(k))].join();
      let stopped = 0, clear = 0, highStopped = 0, rain = 0, offKeep = 0;
      for (let b = 1; b < 120; b++){      // (a flat shot gets through the ring only now and then, 3 of 195 on 39 boards: more boards, so the chance of none is nil)
        const tc = b % 7 + 20, tr = Math.floor(b / 7) + 20, side = D.SIDE;
        for (const k of [1, 2, 0, 4]){
          D.MIS.length = 0; D.capture(tc + 1, tr, side); D.capture(tc, tr, (side + 1) % 4); D.rearm(tc + 1, tr);
          D.launch(tc + 1, tr, k, tc, tr, 0);
          for (const m of D.MIS){ if (K[k].flat){ if (m.stopped) stopped++; else clear++; } else { if (m.stopped) highStopped++; rain++; } if (m.f < 0.99) offKeep++; }
        }
      }
      D.MIS.length = 0;
      out.shield = [stopped > 3, clear >= 1, highStopped === 0, rain > 20, offKeep > 0].join();
      // the launchers (Nov 8: "move the missle launchers behind walls and hills so they are protected. and move them around the board strategically, not just
      // at the bottom. the missle launchers should take damege and can be destroyed."): spread over boards and covered more than a row at the bottom would be,
      // hit by a burst near them, a wreck at no hit points that cannot fire, built again at half after a minute
      let spreadV = 0, covered = 0, nb = 0, bottom = 0;
      for (let b = 0; b < 30; b++){
        const T = D.terrOf(D.holeFor(30 + b % 6, 30 + Math.floor(b / 6))), vs = T.pads.map(p => p.y);
        spreadV += Math.max(...vs) - Math.min(...vs); covered += T.shields.reduce((x, y) => x + y, 0) / 5; nb++; bottom += vs.filter(y => y > 0.8).length / 5;
      }
      out.placed = [spreadV / nb > 0.3, covered / nb > 0.2, bottom / nb < 0.5].join();
      D.SIM.ideal = true; D.newWar(); D.capture(1, 0, (D.SIDE + 1) % 4); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t }); D.LHP.delete(key(1, 0));   // (a board taken has its launchers at half: these at full)
      const lh = () => Math.round(D.lhpOf(1, 0).hp[2]);
      D.rearm(0, 0); D.launch(0, 0, 2, 1, 0, 0, 2); D.advance(K[2].fly * 1.12 + 0.25);                // (a cruise missile aimed at its cruise launcher: 26 × 1.5 = 39 of 40)
      const hit1 = lh(); D.rearm(0, 0); D.launch(0, 0, 2, 1, 0, 0, 2); D.advance(K[2].fly * 1.12 + 0.25);
      const dead = lh(), wreck = D.itemsOf(1, 0).some(x => x.kind === 'bwRubble');
      D.LHP.set(key(1, 0), { hp: [40, 40, 0, 40, 60], at: [0, 0, D.SIM.t, 0, 0] }); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t });
      D.capture(0, 0, (D.SIDE + 2) % 4);
      const refused = D.launch(1, 0, 2, 0, 0, 0);                                                  // (a wreck does not fire)
      D.advance(D.REBUILD + 1); const rebuilt = lh();
      out.launchers = [hit1, dead, wreck, refused, rebuilt].join();
      D.SIM.ideal = false; D.MIS.length = 0;
      // the castle (Nov 8: "do more construction to build up a castle with walls and a moat, and build them on top of hills and down in valleys. be creative."): a curtain
      // wall of ten sides with a gate, a tower at each corner, a moat and a drawbridge round the keep, a watchtower on the highest free ground and a sunken ward in the lowest,
      // each on the ground under it; the curtain falls as the board is hurt and stands again as it heals, and its walls and towers stand in the way of a flat shot
      let cs = 0, hillHigh = 0, valleyLow = 0, nc = 0;
      for (let b = 0; b < 24; b++){
        const H = D.holeFor(40 + b % 6, 40 + Math.floor(b / 6)), T = D.terrOf(H), C = T.castle;
        if (C.towers.filter(t => t[4] === 'corner').length === 10 && C.walls.filter(w => w[5] >= 0).length === 9 && C.gate && C.moat.length > 12) cs++;
        if (C.hills && C.hills.length && C.ward){ nc++; if (Math.min(...C.hills.map(q => q.h)) >= C.ward.h) hillHigh++; valleyLow++; }
      }
      const full = D.itemsOf(0, 0).filter(x => /^(bwWall|bwPalisade)/.test(x.kind)).length, rub0 = D.itemsOf(0, 0).filter(x => x.kind === 'bwRubble').length;
      D.HP.set(key(0, 0), { hp: 30, hit: D.SIM.t + 1000 });
      const hurtI = D.itemsOf(0, 0), walls1 = hurtI.filter(x => /^(bwWall|bwPalisade)/.test(x.kind)).length, rub1 = hurtI.filter(x => x.kind === 'bwRubble').length;
      const kinds0 = new Set(D.itemsOf(0, 0).map(x => x.kind));
      // (Nov 8: "make the castles more detailed. Each color faction should have a different type of castle.": each side's castle its own walls, towers, roofs and keep)
      const TT0 = D.terrOf(D.holeFor(0, 0)), per = [0, 1, 2, 3].map(sd => { const o = []; D.castleItems(o, TT0, D.SIDES[sd], 1, 0, D.WDx, sd); return new Set(o.map(x => x.kind)); });
      const sig = per.map(x => [...x].filter(k => /^bw(Wall|Palisade|Tower|Keep|Minaret|Spire|Dome|WoodRoof)/.test(k) && k !== 'bwWall').sort().join('+'));
      const castleKinds = new Set(sig).size === 4 && per[0].has('bwWallM') && per[0].has('bwKeepSq') && per[1].has('bwKeepFr') && per[1].has('bwSpire') && per[2].has('bwPalisade') && per[2].has('bwKeepWood') && per[3].has('bwWallS') && per[3].has('bwMinaret') && per[3].has('bwKeepDome');
      out.castle = [cs >= 22, nc > 12 && hillHigh === nc, full >= 10, walls1 < full && rub1 > rub0, ['bwWater', 'bwBridge', 'bwGateTop', 'bwHouse'].every(k => kinds0.has(k)) && [...kinds0].some(k => /^bwKeep/.test(k)) && [...kinds0].some(k => /^bwTower/.test(k) || k === 'bwMinaret'), castleKinds].join();
      D.HP.delete(key(0, 0));
      // the war goes on without you: two minutes with the computer's boards firing, boards changing hands
      D.newWar(); D.SIM.quiet = false; D.LIVE = { c: 0, r: 0 }; const was = D.STATS.shots; D.advance(120);
      out.war = [D.STATS.shots - was > 100, D.OWN.size > 10, D.STATS.won + D.STATS.lost > 10].join();
      D.SIM.quiet = true; D.MIS.length = 0;
      return out;
    });
    const bwOk = bw.sides && bw.hit === bw.want && bw.far === '0,0' && bw.friend === 0 && bw.reload === '1,0,1' && bw.splash === '45,88,88,100'
      && bw.taken === 'true,40,true,true' && bw.pieces && bw.flight === 'true,false|false,true' && bw.war === 'true,true,true' && bw.golf === 'true,true,true' && bw.shield === 'true,true,true,true,true' && bw.placed === 'true,true,true' && bw.castle === 'true,true,true,true,true,true' && bw.launchers === '1,0,true,0,20';
    if (!bwOk) failures.push('[boardwar] ' + JSON.stringify(bw));
    console.log(`${bwOk ? 'ok  ' : 'FAIL'} board war (sides by block, damage by kind ${bw.hit}, a board taken joins the taker's side: ${bw.taken}, the war going on: ${bw.war})`);
    // real input: a click on the third launcher takes the cruise missile, a click toward a hostile board fires it there
    await page.evaluate(() => { const D = window.getFieldApp()._debug; D.newWar(); D.SIM.quiet = true; D.capture(D.wrapc(-1), 0, (D.SIDE + 1) % 4); D.rearm(0, 0); D.MIS.length = 0; D.fly(0, 0); });
    await drawn(page, 3000); await page.evaluate(() => window.__settle && window.__settle());   // (and the camera at rest after the flight, 12 Nov 2026)
    const bwr = await (async () => {
      const f = await page.evaluate(() => { const W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ); return f ? [f.c, f.r] : null; });
      if (!f || f[0] !== 0 || f[1] !== 0) return { framed: f };
      const aimAt = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [u, v]);
      const pad = await page.evaluate(() => { const D = window.getFieldApp()._debug; return D.padOf(0, 0, 2); });
      const slot = await aimAt(pad.u, pad.v); await page.mouse.click(slot.x, slot.y); await drawn(page, 400);
      const sel = await page.evaluate(() => window.getFieldApp()._debug.SEL);
      const toward = await aimAt(0.9, 0.4); await page.mouse.click(toward.x, toward.y); await drawn(page, 400);
      const fired = await page.evaluate(() => { const D = window.getFieldApp()._debug; return D.MIS.map(m => [m.k, m.from.join('_'), m.to.join('_')].join(':')); });
      return { framed: f, sel, fired };
    })();
    const bwrOk = bwr.sel === 2 && bwr.fired && bwr.fired.length === 1 && bwr.fired[0] === '2:0_0:9999_0';
    if (!bwrOk) failures.push('[boardwar real input] ' + JSON.stringify(bwr));
    console.log(`${bwrOk ? 'ok  ' : 'FAIL'} board war: a real click on the third launcher takes it (${bwr.sel}) and a real click toward the hostile board fires it there (${bwr.fired && bwr.fired.join()})`);
    // BOARD WAR's goal and minimap (Nov 8: "where could we take this game?" … "proceed"): taking boards counts toward the goal, a victory is kept once and said in a
    // box, losing the home block is a defeat, a new war clears it, and the minimap shows the owners round the view and flies where it is tapped
    const bwg = await page.evaluate(async () => {
      const D = window.getFieldApp()._debug, out = {}, S = D.SIDE, foe = (S + 1) % 4;
      D.newWar(); D.SIM.quiet = true; D.LIVE = { c: 0, r: 0 };
      D.setGoal(1);                                              // (take 10 boards)
      out.start = JSON.stringify(D.realm()) + ',' + D.RESULT;
      const far = []; for (let c = 20; far.length < 12; c++) if (D.regionSide(c, 20) !== S) far.push(c);   // (boards that began hostile)
      for (let i = 0; i < 9; i++) D.capture(far[i], 20, S);      // nine taken
      const nine = D.realm().took, none = D.RESULT;
      D.capture(far[9], 20, S);
      out.won = [nine, none, D.RESULT && D.RESULT.r, !!document.getElementById('confirmBox')].join();
      document.getElementById('confirmBox')?.remove();
      const keep = JSON.stringify(D.RESULT); D.capture(far[10], 20, S); out.once = keep === JSON.stringify(D.RESULT);
      D.newWar(); out.cleared = D.RESULT === null;
      D.setGoal(1);                                              // (lose the home block: all 25 boards to the foe)
      for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) D.capture(c, r, foe);
      out.lost = D.RESULT && D.RESULT.r + ':' + D.realm().home;
      document.getElementById('confirmBox')?.remove();
      D.newWar(); D.setGoal(0);                                  // (a free war never ends)
      for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) D.capture(c, r, foe);
      out.free = D.RESULT === null;
      D.newWar(); D.setGoal(1);
      D.mapShow(true); D.mapDraw();
      const m = document.getElementById('warMap');
      out.map = !!m && m.querySelector('canvas').width === 183 && /home 25\/25/.test(m.textContent);
      D.mapShow(false); out.gone = !document.getElementById('warMap');
      D.SIM.quiet = false; D.newWar();
      return out;
    });
    const bwgOk = /^\{"home":25,"took":0\},null$/.test(bwg.start) && bwg.won === '9,,won,true' && bwg.once && bwg.cleared && bwg.lost === 'lost:0' && bwg.free && bwg.map && bwg.gone;
    if (!bwgOk) failures.push('[boardwar goal] ' + JSON.stringify(bwg));
    console.log(`${bwgOk ? 'ok  ' : 'FAIL'} board war: a goal of ten boards won on the tenth (said once in a box), the home block lost is a defeat, a free war never ends, the minimap drawn and gone (${JSON.stringify(bwg)})`);
    // BOARD WAR's doctrines (Nov 8: "proceed" on the plan): four sides, four ways of choosing; the same shots, only the choosing differs
    const bwd = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {}, X = D.DOCTRINES;
      const list = [{ c: 1, r: 0, hp: 90, dist: 1 }, { c: 2, r: 0, hp: 20, dist: 2.2 }, { c: 3, r: 0, hp: 60, dist: 1.4 }];
      out.n = X.length;
      out.weak = D.chooseFor(0, list).c;                       // Red: the weakest by hit points and distance (20 + 26 beats 90 + 12 and 60 + 17)
      out.near = D.chooseFor(2, list).c;                       // Green: the nearest, whatever its hit points
      out.rates = X[0].rate < X[1].rate && X[1].rate < X[2].rate;
      out.snipe = X[1].aimL > X[3].aimL && X[3].aimL > X[2].aimL && X[2].aimL > X[0].aimL;
      out.hoard = X[3].warhead > X[0].warhead && X[3].warhead >= 80;
      out.pick = X.map(d => d.pick).join();
      return out;
    });
    const bwdOk = bwd.n === 4 && bwd.weak === 2 && bwd.near === 1 && bwd.rates && bwd.snipe && bwd.hoard && bwd.pick === 'weakest,weakest,nearest,weakest';
    if (!bwdOk) failures.push('[boardwar doctrines] ' + JSON.stringify(bwd));
    console.log(`${bwdOk ? 'ok  ' : 'FAIL'} board war: four doctrines, Red the weakest and fastest, Green the nearest and slowest, Blue aiming at launchers most, Gold keeping warheads for the strong (${JSON.stringify(bwd)})`);
    // BOARD WAR'S SUPPLIES AND UPGRADES (Nov 8: "What's next" … "Proceed"): your side's boards near the one in view bring supplies a second, a level of a launcher kind costs 30 × level²,
    // adds a quarter to its damage and takes an eighth off its reload for your side only, three levels at most, and a new war starts them over
    const bwu = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {};
      D.newWar(); D.SIM.ideal = true; D.LIVE = { c: 0, r: 0 };
      out.zero = [D.getSupply(), D.UPG.join()];
      const s0 = D.getSupply(); D.advance(10); out.gain = D.getSupply() - s0;
      out.cost = [D.upCost(0), D.upCost(4)];
      out.broke = D.upgrade(0);
      D.setSupply(5000);
      const side = D.SIDE; let f = null;
      for (let c = 0; c < 8 && !f; c++) for (let r = 0; r < 8 && !f; r++) if (D.ownerOf(c, r) === side) for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (D.ownerOf(c + a, r + b) !== side){ f = [c, r, c + a, r + b]; break; }
      const shot = () => { D.RDY.clear(); D.MIS.length = 0; D.rdyOf(f[0], f[1]).fill(0); D.launch(f[0], f[1], 0, f[2], f[3], 0, -1); return [D.MIS[0].dmg, D.rdyOf(f[0], f[1])[0] - D.SIM.t]; };
      const a = shot(); out.up1 = D.upgrade(0); out.spent = 5000 - D.getSupply(); const b = shot();
      out.dmg = [a[0], b[0]]; out.reload = [+a[1].toFixed(3), +b[1].toFixed(3)];
      D.upgrade(0); D.upgrade(0); out.max = [D.UPG[0], D.upgrade(0), D.getSupply() < 5000 - 30 - 120 - 270 + 1e-6 && D.getSupply() > 5000 - 30 - 120 - 270 - 1];
      D.newWar(); out.reset = [D.getSupply(), D.UPG.join()];
      D.SIM.ideal = false;
      return out;
    });
    const bwuOk = bwu.zero[0] === 0 && bwu.zero[1] === '0,0,0,0,0' && bwu.gain > 3 && bwu.cost[0] === 30 && bwu.cost[1] === 30 && bwu.broke === false && bwu.up1 === true && bwu.spent === 30
      && bwu.dmg[0] === 10 && Math.abs(bwu.dmg[1] - 12.5) < 1e-9 && Math.abs(bwu.reload[0] - 1.6) < 1e-6 && Math.abs(bwu.reload[1] - 1.408) < 1e-6
      && bwu.max[0] === 3 && bwu.max[1] === false && bwu.max[2] && bwu.reset[0] === 0 && bwu.reset[1] === '0,0,0,0,0';
    if (!bwuOk) failures.push('[boardwar supplies] ' + JSON.stringify(bwu));
    console.log(`${bwuOk ? 'ok  ' : 'FAIL'} board war: supplies from your side's boards, a level for 30 × level² (the first 30), a mortar's damage 10 → 12.5 and reload 1.6 → 1.408 s for your side, three levels at most, a new war starting over`);
    // BOARD WAR: THE WAR ESCALATES, A RAM, WIND (Nov 9: "1,2,3"): the computer's sides upgrade with the war's age (not in the ideal case), taking a board beside ones you hold pays supplies and
    // hit points, a ram costs supplies and breaks on the keep 8 s later, the wind pushes and is not always the same (a playground: loose bounds)
    const bwn = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {}, GS = 10000, key = (c, r) => ((c % GS + GS) % GS) * GS + ((r % GS + GS) % GS), e = (D.SIDE + 1) % 4;
      D.newWar(); D.SIM.quiet = true; D.SIM.ideal = false; D.LIVE = { c: 0, r: 0 };
      const w0 = D.getWar0(); D.SIM.t = w0; out.up0 = D.upOf(e, 0); D.SIM.t = w0 + 250; out.up1 = D.upOf(e, 0); D.SIM.t = w0 + 5000; out.up9 = D.upOf(e, 0); D.SIM.ideal = true; out.upI = D.upOf(e, 0); out.mine = D.upOf(D.SIDE, 0); D.SIM.ideal = false;
      D.setSupply(0); D.capture(1, 0, e); D.capture(1, 0, D.SIDE); out.chain = [D.getSupply(), Math.round(D.HP.get(key(1, 0)).hp)];
      D.newWar(); D.LIVE = { c: 0, r: 0 }; D.capture(1, 0, e); D.setSupply(10); out.broke = D.ram(); D.setSupply(60); out.rammed = D.ram(); out.sup = D.getSupply();
      const tg = D.MIS[0].to; D.HP.set(key(tg[0], tg[1]), { hp: 100, hit: D.SIM.t + 1e6 }); D.advance(9); out.hp = Math.round(D.HP.get(key(tg[0], tg[1])).hp);
      out.wind = [D.windAt(0).w, D.windAt(50).w];
      // the computer's rams: a computer board among hostile ones sends a ram on its own within a couple of minutes of a war
      D.newWar(); D.SIM.quiet = false; D.SIM.ideal = false; D.LIVE = { c: 0, r: 0 }; D.MIS.length = 0;
      let ramsSeen = 0, enemyRam = false; for (let i = 0; i < 1200; i++){ D.advance(0.1); for (const m of D.MIS) if (m.ram && !m.seen){ m.seen = true; ramsSeen++; if (m.side !== D.SIDE) enemyRam = true; } }
      out.aiRam = [ramsSeen > 0, enemyRam];
      D.SIM.quiet = true; D.newWar();
      return out;
    });
    const bwnOk = bwn.aiRam.join() === 'true,true' && bwn.up0 === 0 && bwn.up1 === 1 && bwn.up9 === 3 && bwn.upI === 0 && bwn.mine === 0 && bwn.chain[0] > 0 && bwn.chain[1] > 40 && bwn.broke === 0 && bwn.rammed === 1 && bwn.sup === 35 && bwn.hp === 55 && Math.abs(bwn.wind[0] - bwn.wind[1]) > 0.1;
    if (!bwnOk) failures.push('[boardwar escalates, ram, wind] ' + JSON.stringify(bwn));
    console.log(`${bwnOk ? 'ok  ' : 'FAIL'} board war: the computer's sides upgrade with the war's age (${bwn.up0}, ${bwn.up1}, ${bwn.up9}), a capture beside your boards pays (${bwn.chain}), a ram costs 25 and breaks the keep for 45 (hit points ${bwn.hp}), the wind swells and fades`);
    // BOARD WAR: TECHNOLOGY AND CONSTRUCTION GROW WITH TIME, AND START OVER WHEN A BOARD IS DESTROYED (Nov 9: "a board in war should get more technology and future construction as time goes on. the go back to
    // the baseline at when they are destroyed."): a step every 90 s to four, none in the ideal case, a capture back to zero, launchers 10% harder and 6% quicker a step, 5% less damage taken a step, more built
    const bwt = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, A = window.getFieldApp(), out = {}, GS = 10000, key = (c, r) => ((c % GS + GS) % GS) * GS + ((r % GS + GS) % GS), e = (D.SIDE + 1) % 4;
      D.newWar(); D.SIM.quiet = true; D.SIM.ideal = false; D.LIVE = { c: 0, r: 0 };
      const w = D.getWar0(), at = dt => { D.SIM.t = w + dt; return D.techOf(0, 0); };
      out.steps = [at(0), at(89), at(90), at(185), at(280), at(400), at(99999)]; D.SIM.ideal = true; out.ideal = D.techOf(0, 0); D.SIM.ideal = false;
      const count = () => { const it = A.cellItems(0, 0, 600); return [it.length, it.filter(i => i.kind === 'bwFlag').length]; };
      D.SIM.t = w; out.built0 = count(); D.SIM.t = w + 400; out.built4 = count();
      // a board taken is back at the baseline, its neighbour untouched
      D.capture(1, 0, e); out.afterCap = [D.techOf(1, 0), D.techOf(0, 0)]; D.SIM.t = w + 1000; out.later = [D.techOf(1, 0), D.techOf(0, 0)];
      // launchers: damage and reload by the firing board's tech (the mortar, level 0 upgrades)
      const fire = tc => { D.SIM.t = w + tc; D.rearm(0, 0); D.MIS.length = 0; const before = D.SIM.t; D.launch(0, 0, 0, 1, 0); return [D.MIS[0].base, +(D.rdyOf(0, 0)[0] - before).toFixed(4)]; };
      D.SINCE.set(key(1, 0), w + 1000 - 1);                                        // (the neighbour at baseline for the shot's target; the firing board old)
      out.fireOld = fire(1000); D.SINCE.set(key(0, 0), w + 1000); out.fireNew = fire(1000);
      // damage taken
      D.SINCE.set(key(1, 0), w); D.SIM.t = w + 400; D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t + 1e6 }); D.hurt(1, 0, 20, D.SIDE); out.armour = Math.round(D.HP.get(key(1, 0)).hp);
      D.SINCE.set(key(1, 0), D.SIM.t); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t + 1e6 }); D.hurt(1, 0, 20, D.SIDE); out.bare = Math.round(D.HP.get(key(1, 0)).hp);
      D.newWar(); out.reset = [D.SINCE.size, at(0)];
      return out;
    });
    const bwtOk = bwt.steps.join() === '0,0,1,2,3,4,4' && bwt.ideal === 0 && bwt.built4[0] > bwt.built0[0] && bwt.built4[1] > bwt.built0[1]
      && bwt.afterCap.join() === '0,4' && bwt.later[0] === 4 && Math.abs(bwt.fireOld[0] - 14) < 1e-9 && Math.abs(bwt.fireNew[0] - 10) < 1e-9
      && Math.abs(bwt.fireOld[1] - 1.6 * 0.76) < 1e-3 && Math.abs(bwt.fireNew[1] - 1.6) < 1e-3 && bwt.armour === 84 && bwt.bare === 80 && bwt.reset.join() === '0,0';
    if (!bwtOk) failures.push('[boardwar technology] ' + JSON.stringify(bwt));
    console.log(`${bwtOk ? 'ok  ' : 'FAIL'} board war: technology a step every 90 s to four (${bwt.steps}), more built at four (${bwt.built0} → ${bwt.built4}), a captured board back to ${bwt.afterCap[0]} while its neighbour stays at ${bwt.afterCap[1]}, a mortar at four ${bwt.fireOld} against ${bwt.fireNew}, 20 damage leaving ${bwt.armour} against ${bwt.bare}`);
    // BOARD WAR: TROOPS (Nov 10: "make the boards bigger in board war.   replace the moving bumpers with troops moving around.   use the margins between the boards to
    // move troops to other boards to fight."): no bumper or boulder rides a loop (golf tags them `rider`, the war leaves them out), every board draws its garrison of four on
    // patrol, a squad sent to a hostile board beside it walks out through the board's edge into the margin between the boards, along it and in at the target's edge, two squads
    // against a garrison of one take the board (the survivors its garrison), a friend's board takes a squad into its garrison, and the war's own boards are Medium (13 × 21)
    // unless the menu says otherwise, golf's size put back when another game comes forward
    const bwq = await page.evaluate(async () => {
      const A = window.getFieldApp(), D = A._debug, out = {}, W = window.FIELD_WORLD, PU = W.spacing()[0] / (W.boardW() * (window.LAB.cellW || 1)), key = (c, r) => D.wrapc(c) * 10000 + D.wrapc(r);
      D.applySize(); D.newWar(); D.SIM.quiet = true; D.SIM.ideal = false; D.LIVE = { c: 0, r: 0 };
      const e = (D.SIDE + 1) % 4;
      out.pitch = +PU.toFixed(3);
      out.riders = 0; out.drawn = [];
      for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++){ const it = A.cellItems(c, r, 600); out.riders += it.filter(i => i.rider).length; out.drawn.push(it.filter(i => i.kind === 'bwTroop').length === D.garOf(c, r)); }
      out.drawn = out.drawn.every(Boolean);
      D.capture(1, 0, e); D.garSet(1, 0, 1); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t });
      D.garSet(0, 0, 4); const n1 = D.sendTroops(0, 0, { c: 1, r: 0 }, D.SIDE, 3);
      out.sent = [n1, D.garOf(0, 0), D.TROOPS.length].join();
      const rt = D.TROOPS[0].rt; out.lane = rt.pts.some(p => p[0] < 0 && p[0] > 1 - PU);
      let margin = 0; for (let i = 0; i < 200; i++){ D.advance(0.2); for (const list of D.troopBoards().values()) for (const x of list) if (x.moving && x.u < 0 && x.u > 1 - PU) margin++; if (D.TROOPS.every(t => t.arrived)) break; }
      out.margin = margin > 0;
      for (let q = 0; q < 3; q++){ D.garSet(0, 0, 4); D.sendTroops(0, 0, { c: 1, r: 0 }, D.SIDE, 3); }   // (three more squads: one fight is chance, 38 in 40, and the garrison grows back while it goes on)
      for (let i = 0; i < 300 && D.ownerOf(1, 0) !== D.SIDE; i++) D.advance(0.5);
      out.taken = [D.ownerOf(1, 0) === D.SIDE, D.garOf(1, 0) >= 1, D.TROOPS.filter(t => t.arrived && t.tc === 1 && t.tr === 0).length].join();
      // a friend's board takes a squad into its garrison
      D.garSet(1, 0, 1); D.garSet(0, 0, 4); D.sendTroops(0, 0, { c: 1, r: 0 }, D.SIDE, 3); D.advance(40);
      out.joined = D.garOf(1, 0);
      // medium: the war's own choice
      localStorage.setItem('boardwar.size', JSON.stringify('medium')); D.applySize();
      return out;
    });
    await drawn(page, 800);
    const bwm = await page.evaluate(async () => {
      const g = () => window.FIELD_APPS.find(a => a.id === 'minigolf'), out = {};
      out.medium = [g()._size, Math.abs(window.getFieldApp()._debug.WDx - 13 / 21) < 1e-9];
      window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'chess'));
      await new Promise(ok => setTimeout(ok, 600));
      out.back = g()._size;
      localStorage.setItem('boardwar.size', JSON.stringify('small'));
      return out;
    });
    const bwqOk = bwq.pitch > 1.1 && bwq.pitch < 1.12 && bwq.riders === 0 && bwq.drawn && bwq.sent === '3,1,3' && bwq.lane && bwq.margin && bwq.taken.startsWith('true,true') && bwq.joined >= 3
      && bwm.medium.join() === 'medium,true' && bwm.back === 'small';
    if (!bwqOk) failures.push('[boardwar troops] ' + JSON.stringify({ bwq, bwm }));
    console.log(`${bwqOk ? 'ok  ' : 'FAIL'} board war: no bumpers riding loops (${bwq.riders}), a garrison of four drawn on every board, a squad out through the edge, along the margin and in (${bwq.lane}, ${bwq.margin}), two squads take a garrison of one (${bwq.taken}), a friend's board takes one in (${bwq.joined}), Medium boards (${bwm.medium}) and golf's size back (${bwm.back})`);
    await page.evaluate(() => { localStorage.setItem('boardwar.size', JSON.stringify('small')); window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'boardwar')); });
    await drawn(page, 800);
    // BOARD WAR: CASTLES PAY, REPAIR, FLAK (Nov 9: "1,2,5" of the playground ideas): income falls to 0.4 of full with every board's walls gone, repair costs by the damage and puts
    // hit points and launchers back, flak brings down some high arcs (a playground: loose bounds)
    const bwrf = await page.evaluate(() => {
  const D = window.getFieldApp()._debug, out = {}, GS = window.FIELD_WORLD.gridSize ? window.FIELD_WORLD.gridSize() : 10000, key = (c, r) => ((c % GS + GS) % GS) * GS + ((r % GS + GS) % GS);
  D.newWar(); D.SIM.ideal = true; D.SIM.quiet = true; D.LIVE = { c: 0, r: 0 };
  const full = D.income();
  for (let dc = -5; dc <= 5; dc++) for (let dr = -5; dr <= 5; dr++) D.HP.set(key(dc, dr), { hp: 0.001, hit: D.SIM.t + 1e6 });
  out.income = [full, D.income()];
  D.HP.clear(); D.setSupply(0);
  out.nothing = [D.repairCost(0, 0), D.repair(0, 0)];
  D.HP.set(key(0, 0), { hp: 20, hit: D.SIM.t + 1e6 }); D.LHP.set(key(0, 0), { hp: [0, 40, 40, 40, 60], at: [D.SIM.t, 0, 0, 0, 0] });
  out.cost = D.repairCost(0, 0); out.broke = D.repair(0, 0); D.setSupply(100); out.ok = D.repair(0, 0); out.after = [D.repairCost(0, 0), Math.round(D.getSupply())];
  // flak: real (not ideal) mortar volleys at a hostile board
  D.SIM.ideal = false; D.newWar(); D.capture(1, 0, (D.SIDE + 1) % 4); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t });
  let hits = 0, shot = 0; D.FLAK.clear();
  for (let i = 0; i < 40; i++){ D.FLAK.clear(); D.HP.set(key(1, 0), { hp: 100, hit: D.SIM.t + 1e6 }); D.rearm(0, 0); D.MIS.length = 0; D.launch(0, 0, 0, 1, 0, 0); D.advance(3); shot++; if (D.HP.get(key(1, 0)).hp < 100) hits++; }
  out.flak = [shot, hits];
  return out;
});
    const bwrfOk = Math.abs(bwrf.income[0] - 1.6) < 0.05 && bwrf.income[1] < bwrf.income[0] * 0.45 && bwrf.income[1] > bwrf.income[0] * 0.35 && bwrf.nothing[0] === 0 && bwrf.nothing[1] === false
      && bwrf.cost > 0 && bwrf.broke === false && bwrf.ok === true && bwrf.after[0] === 0 && bwrf.flak[1] > 2 && bwrf.flak[1] < bwrf.flak[0] - 2;
    if (!bwrfOk) failures.push('[boardwar repair, flak] ' + JSON.stringify(bwrf));
    console.log(`${bwrfOk ? 'ok  ' : 'FAIL'} board war: walls whole pay full income (${bwrf.income.map(x => x.toFixed(2)).join(' → ')} with none), repair costs ${bwrf.cost} and mends, flak lets ${bwrf.flak[1]} of ${bwrf.flak[0]} mortar shots through`);
    await page.evaluate(() => { const D = window.getFieldApp()._debug; D.SIM.quiet = false; D.newWar(); });
    // SIMON'S SONGS (Nov 8: "can you add buttons to pre-set songs?", then "can you add more songs?"): twelve tunes, a pad a distinct note lowest first and sounding at its own pitch, a button a song
    // in the bottom row beginning that tune on the framed board, each round playing one more note, the whole song played back winning (kept as the best), a wrong pad losing
    current = 'simon';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'simon')));
    await drawn(page, 1500);
    const sg = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, out = {}, hz = m => 440 * Math.pow(2, (m - 69) / 12);
      D.LIVE = { c: 0, r: 0 };
      out.n = D.SONGS.length;
      out.pads = D.SONGS.map((_, k) => D.songSeq(0, 0, k).D.pads).join();
      out.pitch = D.SONGS.every((s, k) => { const S = D.songSeq(0, 0, k); return s.notes.every((m, i) => Math.abs(S.freq[S.at(i)] - hz(m)) < 1e-6) && S.len === s.notes.length; });
      out.tiles = A.statTiles(0, 0).map(t => t.value).join('|');
      D.playSong(0, 0, 0);
      let g = D.gameAt(0, 0), S = g.S;
      out.began = [g.state, S.name, D.SONG].join();
      const mid = [];
      for (let n = 1; n <= S.len; n++){
        g.state = 'input'; g.n = n; g.i = 0; g.deadline = Infinity;
        for (let i = 0; i < n; i++) D.press(g, S.at(i), true);
        if (n === 3) mid.push(g.state + ':' + g.n);
      }
      out.mid = mid.join(); out.end = [g.state, g.won === true, g.score, D.BEST.get('s0')].join();
      out.title = A.cellTitle(0, 0);
      D.playSong(0, 0, 1); g = D.gameAt(0, 0); g.state = 'input'; g.n = 2; g.i = 0; g.deadline = Infinity;
      D.press(g, g.S.at(0), true); D.press(g, (g.S.at(1) + 1) % 4, true);
      out.wrong = [g.state, !!g.won].join();
      out.own = (D.playSong(0, 0, -1), D.SONG + ',' + (D.gameAt(0, 0).S.song == null));
      D.GAMES.clear(); return out;
    });
    const sgOk = sg.n === 12 && sg.pads === '6,4,6,6,8,6,6,4,4,6,4,4' && sg.pitch && /^Own\|Twinkle\|Mary/.test(sg.tiles) && sg.began === 'show,Twinkle,0' && sg.mid === 'pause:4' && sg.end === 'over,true,14,14'
      && /you played it/.test(sg.title) && sg.wrong === 'over,false' && sg.own === '-1,true';
    if (!sgOk) failures.push('[simon songs] ' + JSON.stringify(sg));
    console.log(`${sgOk ? 'ok  ' : 'FAIL'} simon songs: twelve tunes (pads ${sg.pads}) at their own pitches, a button a song, round n playing n notes, the whole of Twinkle played back won (${JSON.stringify(sg.end)}), a wrong pad lost`);

  // (CURLING FROM BEHIND THE STONE and THE PULL BAR IN CURLING were checked here until Nov 25, when curling became a pool game: its view and
  // its shot are pool's, checked with pool's)

} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
