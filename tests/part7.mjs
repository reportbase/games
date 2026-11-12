// Smoke test, part 7 of 7: curling, bowling, the marble run, playing with the row shut, Bejeweled, air hockey's corners, Asteroids, the Difficulty and
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
  // CURLING (Oct 28: "2,   3 curling, bowling, marble run"): levels by ring; the ice (a draw solved to the button, the curl the way
  // it turns, sweeping farther and straighter, a takeout moving the stone it strikes, the hog line); an end's score; games between
  // the steady player and the computer ending, the steady player doing better at level 1 than at 5; and real input: a click
  // starting, a real click putting the broom where it fell, the real Enter throwing, a real press held sweeping, the computer
  // answering; and a board no one plays moving through its recorded end
  current = 'curling';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'curling')); await new Promise(ok => setTimeout(ok, 2500)); });
    const cu = await page.evaluate(() => {
      const A = window.getFieldApp(), D = A._debug, K = D.consts, out = {}, GS = Math.round(Math.sqrt(window.FIELD_ST.N));
      out.levels = [D.levelOf(0, 0), D.levelOf(7, 0), D.levelOf(40, 3), D.levelOf(GS - 80, 2)];
      const ice = D.iceOf(9, 3), alone = shot => D.throwSim([], 0, shot, ice).st;
      const s = D.solveDraw(K.W / 2, K.TEE, 1, ice), d = alone(s); out.draw = +Math.hypot(d.x - K.W / 2, d.y - K.TEE).toFixed(4);
      const straight = alone({ bx: K.W / 2, by: K.TEE, w: 0.72, curl: 0 }), right = alone({ bx: K.W / 2, by: K.TEE, w: 0.72, curl: 1 }), left = alone({ bx: K.W / 2, by: K.TEE, w: 0.72, curl: -1 });
      out.curl = [+(right.x - straight.x).toFixed(3), +(left.x - straight.x).toFixed(3)];
      const swept = D.throwSim([], 0, { bx: K.W / 2, by: K.TEE, w: 0.72, curl: 1 }, ice, { sweep: () => 1 }).st;
      out.sweep = { farther: +(right.y - swept.y).toFixed(3), straighter: +((right.x - straight.x) - (swept.x - straight.x)).toFixed(3) };
      const guard = [{ x: K.W / 2, y: K.TEE, vx: 0, vy: 0, s: 0, team: 1, rot: 0, out: false, hit: false, live: false }];
      const hit = D.throwSim(guard, 0, D.solveHit(K.W / 2, K.TEE, 1, 2.2, ice), ice).S[0]; out.takeout = hit.out || Math.hypot(hit.x - K.W / 2, hit.y - K.TEE) > 0.1;
      out.hog = alone({ bx: K.W / 2, by: K.TEE, w: 0.3, curl: 0 }).out;
      const S = [[0, 0.003], [0, 0.03], [1, 0.05], [0, 0.07], [1, 0.4]].map(([team, dy]) => ({ x: K.W / 2, y: K.TEE + dy, team, out: false }));
      const e = D.endScore(S); out.score = e.team + ':' + e.n;
      out.games = [1, 5].map(lv => { let a = 0, b = 0; for (let k = 0; k < 2; k++){ const G = D.newMatch(300 + k, lv, { ai0: D.STEADY, ends: 2, seed: k }); let n = 0; while (G.state !== 'over' && n < 200000){ D.tick(G, false); n++; } if (G.state !== 'over') return null; a += G.score[0]; b += G.score[1]; } return [a, b]; });
      return out;
    });
    const L = cu.levels;
    const shareOk = cu.games[0] && cu.games[1] && cu.games[0][0] - cu.games[0][1] > cu.games[1][0] - cu.games[1][1];
    if (!(L[0] < L[2] && L[2] <= L[3]) || cu.draw > 0.006 || !(cu.curl[0] > 0.01 && cu.curl[1] < -0.01) || !(cu.sweep.farther > 0.03 && cu.sweep.straighter > 0.003)
        || !cu.takeout || !cu.hog || cu.score !== '0:2' || !shareOk)
      failures.push(`[${current}] ${JSON.stringify(cu)}`);
    // real input: a click starts, a click puts the broom, Enter throws, a press held sweeps, the computer answers
    const at = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, L = window.LAB || {}, bW = W.boardW();
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, [u, v]);
    const gs = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.GAMES.get(f.c + '_' + f.r); return g && { state: g.state, G: g.G && { state: g.G.state, thrown: g.G.thrown, bx: g.G.shot.bx, sweep: g.G.sweepK, t: g.G.t } }; });
    await page.evaluate(() => window.__settle());
    let p = await at(0.5, 0.6); await page.mouse.click(p.x, p.y); await drawn(page, 600);
    const live = { started: await gs() };
    p = await at(0.4, 0.25); await page.mouse.click(p.x, p.y); await drawn(page, 600);
    live.aimed = await gs();
    await page.keyboard.press('Enter');
    // (a press counts as sweeping only once the stone runs: on a slow first frame the press came before the throw)
    for (let w = 0; w < 40 && (await gs()).G.state !== 'throw'; w++) await frame(page, 150);
    p = await at(0.5, 0.6); await page.mouse.move(p.x, p.y); await page.mouse.down();
    // (a press that did not take, on a slow runner, is pressed again while the stone still runs)
    for (let w = 0; w < 40 && !((await gs()).G.sweep > 0); w++){ await frame(page, 150);
      if (w % 6 === 5 && (await gs()).G.state === 'throw'){ await page.mouse.up(); await drawn(page, 100); p = await at(0.5, 0.6); await page.mouse.move(p.x, p.y); await page.mouse.down(); } }
    live.swept = await gs(); await page.mouse.up();
    /* THE ANSWER IS WAITED FOR ON THE GAME'S CLOCK (12 Nov 2026: "1,2,3,4,5,6", the first "Games: fix the flaky checks and move to
       the newer browser"; part 7 failed here once on CI with Playwright 1.63.0, `answered` read as state 'rest', one stone thrown).
       Your stone runs out, rests, and the computer throws, all in ticks of the game's own time, a quarter of a second of it a
       frame at most (`stepGame`); this waited 30 s on the wall, which slow frames used up with the stone only just at rest. It is
       given a minute of the game's time (`G.t`), five of the wall's at most. */
    live.answered = await onClock(page, gs, s => s.G.thrown >= 2, 60, s => s.G.t);
    // a board no one plays: its recorded end, moving on the page's clock
    live.shown = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, f = D.LIVE, c = f.c + 2, r = f.r;
      const M = D.recOf(D.boardIdx(c, r), D.levelOf(c, r)); for (let k = 0; k < 30 && !M.done; k++) D.recWork(M);
      const look = () => JSON.stringify(A.cellItems(c, r, 400).filter(i => i.kind === 'cuStone').map(i => [i.u.toFixed(3), i.v.toFixed(3)]));
      const seen = new Set(); for (let k = 0; k < 16; k++){ seen.add(look()); await new Promise(ok => setTimeout(ok, 400)); } return { done: M.done, looks: seen.size }; });
    if (!live.started || live.started.state !== 'play' || live.started.G.state !== 'aim' || !live.aimed || Math.abs(live.aimed.G.bx - 0.4 * 0.42) > 0.02
        || !(live.swept && live.swept.G.state === 'throw' && live.swept.G.sweep > 0) || !(live.answered && live.answered.G.thrown >= 2) || !live.shown.done || live.shown.looks < 3)
      failures.push(`[${current}] real input: ${JSON.stringify(live)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} curling (levels ${L.join('/')}; a draw to ${cu.draw} of the button, curling ${cu.curl.join('/')}, sweeping ${cu.sweep.farther} farther and ${cu.sweep.straighter} straighter, a takeout, the hog line, an end scored ${cu.score}; the steady player ${cu.games.map(g => g && g.join('-')).join(' at level 1, ')} at level 5; a real click started, a real click put the broom, the real Enter threw, a real press swept, the computer answered; a board no one plays showed ${live.shown.looks} looks)`);
  }

  // BOWLING (Oct 28: "2,   3 curling, bowling, marble run"): levels by ring; the scoring (300, all spares 190, all fours 80, the tenth's
  // bonus balls); a hooking ball crossing the head pin's line left of a straight one; a gutter ball taking nothing; the steady
  // player's first balls taking pins and its games ending, better at level 1 than at 5; and real input: a click starting, a real
  // click aiming, the real Enter bowling and the ball counted; a board no one plays moving through its recorded game
  current = 'bowling';
  {
    const before = failures.length;
    // (ten frames: spares are the default since Oct 28, checked after this)
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'bowling')); window.getFieldApp()._debug.setMode('game'); await new Promise(ok => setTimeout(ok, 2500)); });
    const bw = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, K = D.consts, out = {}, GS = Math.round(Math.sqrt(window.FIELD_ST.N));
      out.levels = [D.levelOf(0, 0), D.levelOf(7, 0), D.levelOf(40, 3), D.levelOf(GS - 80, 2)];
      out.score = [D.scoreOf(Array(12).fill(10)).total, D.scoreOf([...Array(20).fill(0).map((_, i) => i % 2 ? 1 : 9), 9]).total, D.scoreOf(Array(20).fill(4)).total,
                   D.scoreOf([...Array(18).fill(0), 10, 10, 10]).total, D.scoreOf([...Array(18).fill(0), 7, 3, 5]).total, D.scoreOf([...Array(18).fill(0), 7, 2]).total];
      const lane = D.laneOf(11, 3), shot = h => D.bowlSim([], { sx: K.CX + 0.05, tx: K.CX + 0.05, ty: K.ARROWS, v: 0.6, h }, lane, { untilY: K.HEAD }).B.x;
      out.hook = +(shot(0) - shot(0.6)).toFixed(3);
      const g = D.bowlSim(D.rack(), { sx: K.CX - 0.1, tx: K.CX - 0.2, ty: K.ARROWS, v: 0.6, h: 0 }, lane); out.gutter = { gutter: g.B.gutter, down: g.down };
      let firsts = 0; for (let k = 0; k < 10; k++){ const L = D.laneOf(200 + k, 1); firsts += D.bowlSim(D.rack(), D.pick(D.rack(), L, true), L).down; } out.firsts = firsts / 10;
      out.games = [1, 5].map(lv => { let sum = 0; for (let k = 0; k < 3; k++){ const G = D.newGame(400 + k, lv, { ai: D.STEADY, seed: k }); let n = 0; while (G.state !== 'over' && n < 120000){ D.tick(G); n++; } if (G.state !== 'over') return null; sum += D.scoreOf(G.rolls).total; } return Math.round(sum / 3); });
      return out;
    });
    const L = bw.levels;
    if (!(L[0] < L[2] && L[2] <= L[3]) || bw.score.join() !== '300,190,80,30,15,9' || !(bw.hook > 0.02) || !bw.gutter.gutter || bw.gutter.down !== 0
        || !(bw.firsts >= 5) || !(bw.games[0] && bw.games[1] && bw.games[0] > bw.games[1]))
      failures.push(`[${current}] ${JSON.stringify(bw)}`);
    const at = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, L = window.LAB || {}, bW = W.boardW();
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, [u, v]);
    const gs = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.GAMES.get(f.c + '_' + f.r); return g && { state: g.state, G: g.G && { state: g.G.state, rolls: g.G.rolls.length, tx: g.G.shot.tx } }; });
    await page.evaluate(() => window.__settle());
    let p = await at(0.5, 0.6); await page.mouse.click(p.x, p.y); await drawn(page, 600);
    const live = { started: await gs() };
    p = await at(0.42, 0.4); await page.mouse.click(p.x, p.y); await drawn(page, 600);
    live.aimed = await gs();
    await page.keyboard.press('Enter');
    for (let w = 0; w < 60 && (await gs()).G.rolls < 1; w++) await frame(page, 250);
    live.bowled = await gs();
    live.shown = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, f = D.LIVE, c = f.c + 2, r = f.r;
      const M = D.recOf(D.boardIdx(c, r), D.levelOf(c, r)); for (let k = 0; k < 40 && !M.done; k++) D.recWork(M);
      const look = () => JSON.stringify(A.cellItems(c, r, 400).filter(i => /^bw(Pin|Ball)/.test(i.kind)).map(i => [i.kind, i.u.toFixed(3), i.v.toFixed(3)]));
      const seen = new Set(); for (let k = 0; k < 48 && seen.size < 3; k++){ seen.add(look()); await new Promise(ok => setTimeout(ok, 250)); } return { done: M.done, par: M.par, looks: seen.size }; });   // (a whole game's loop: 6 s could fall in its still parts)
    if (!live.started || live.started.state !== 'play' || live.started.G.state !== 'aim' || !live.aimed || Math.abs(live.aimed.G.tx - 0.42 * 0.36) > 0.02
        || !(live.bowled && live.bowled.G.rolls >= 1) || !live.shown.done || !(live.shown.par > 0) || live.shown.looks < 3)
      failures.push(`[${current}] real input: ${JSON.stringify(live)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} bowling (levels ${L.join('/')}; scores ${bw.score.join(', ')}; a hook ${bw.hook} across the head pin's line; a gutter ball took ${bw.gutter.down}; the steady player's first balls ${bw.firsts} pins, games ${bw.games.join(' at level 1, ')} at level 5; a real click started, a real click aimed, the real Enter bowled; a board no one plays showed ${live.shown.looks} looks, par ${live.shown.par})`);
  }
  // BOWLING'S SPARES (Oct 28: "could the ideas of trick shot be applied to bowling?", then "1,2,5"): every corner leave and generated
  // leaves at levels 1, 3 and 5 made by their own found shot, par rising with the level; a miss setting the leave up again and
  // counting a try; and real input: a real click starting the framed lane's leave, the real Enter bowling and the try counted, the
  // shot shown and bowled making it; the editor: the real ✎ opening it, real clicks laying pins, Check's par, the real ✓ keeping it
  // in storage, a shared copy on another lane, nonsense refused; a board no one plays showing its leave made
  current = 'bowling spares';
  {
    const before = failures.length;
    const sp = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {};
      D.setMode('spares');
      out.course = D.COURSE.map((_, i) => { const J = D.leaveNow(D.leaveJob(i, 2)); return !!(J.res.s && D.clearsAll(D.leavePins(J.res.xy), J.res.s, J.lane)); }).filter(x => x).length;
      out.pars = [1, 3, 5].map(lv => { let n = 0, sum = 0; for (let b = 0; b < 4; b++){ const J = D.leaveNow(D.leaveJob(700 + b * 13, lv)); if (J.res.s && D.clearsAll(D.leavePins(J.res.xy), J.res.s, J.lane)){ n++; sum += J.res.par; } } return n === 4 ? sum / 4 : null; });
      const J = D.leaveNow(D.leaveJob(4, 2)), G = D.newGame(4, 2, { leave: J.res }); G.shot = { ...J.res.s, tx: J.res.s.tx + 0.08 }; D.bowlNow(G);
      for (let n = 0; n < 6000 && (G.state === 'roll' || G.state === 'rest'); n++) D.tick(G);
      out.miss = { state: G.state, tries: G.tries, up: G.pins.length === J.res.xy.length && G.pins.every(p => !p.down) };
      out.clean = [D.cleanLeave({ xy: [[0, 0]] }), D.cleanLeave({ xy: 'x' }), D.cleanLeave({ xy: [[0.18, 0.2], [0.18, 0.2]] }), !!D.cleanLeave({ xy: [[0.18, 0.2]] })];
      return out;
    });
    if (sp.course !== 15 || !(sp.pars[0] && sp.pars[1] && sp.pars[2] && sp.pars[0] < sp.pars[1] && sp.pars[1] < sp.pars[2]) || sp.miss.state !== 'aim' || sp.miss.tries !== 1 || !sp.miss.up
        || sp.clean.slice(0, 3).some(x => x) || !sp.clean[3])
      failures.push(`[${current}] ${JSON.stringify(sp)}`);
    const at = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, L = window.LAB || {}, bW = W.boardW();
      const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, [u, v]);
    const gs = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.GAMES.get(f.c + '_' + f.r); return g && { state: g.state, G: g.G && { state: g.G.state, tries: g.G.tries, spare: !!g.G.spare } }; });
    const live = {};
    await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE; if (f) D.GAMES.delete(f.c + '_' + f.r); });
    await page.evaluate(() => window.__settle());
    let p = await at(0.5, 0.6); await page.mouse.click(p.x, p.y);
    for (let w = 0; w < 20 && !((await gs()) || {}).G; w++) await frame(page, 250);
    live.started = await gs();
    await page.keyboard.press('Enter');
    for (let w = 0; w < 60 && ((await gs()).G.tries || 0) < 1 && (await gs()).state !== 'over'; w++) await frame(page, 250);
    live.tried = await gs();
    if (live.tried && live.tried.state !== 'over'){
      await page.evaluate(() => window.getFieldApp().menu[0].items.find(i => i.label === 'Show me the shot').on());
      await page.waitForTimeout(300); await page.keyboard.press('Enter');
      for (let w = 0; w < 60 && (await gs()).state !== 'over'; w++) await frame(page, 250);
    }
    live.made = await gs();
    // the editor, by the real ✎
    await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE; D.GAMES.delete(f.c + '_' + f.r); });
    if (!(await page.evaluate(() => window.tvf.bottomRow.visible))){ await page.click('#bbHandle'); await drawn(page, 800); }
    const pen = await page.evaluate(() => { try { bbRefreshNow(); } catch {} const b = [...document.querySelectorAll('#bbQuick button')].find(b => b.textContent.includes('✎')); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    if (pen){ await page.mouse.click(pen[0], pen[1]); await drawn(page, 800); }
    live.opened = await page.evaluate(() => window.getFieldApp()._debug.ed().on);
    await page.evaluate(() => window.getFieldApp()._debug.edTile(4));             // (Clear)
    for (const [u, v] of [[0.5, 0.25], [0.3, 0.2]]){ p = await at(u, v); await page.mouse.click(p.x, p.y); await frame(page, 700); }
    live.laid = await page.evaluate(() => window.getFieldApp()._debug.ed().xy.length);
    live.check = await page.evaluate(() => { const r = window.getFieldApp()._debug.edCheck(false); return r.why || r.par; });
    const tick = await page.evaluate(() => { try { bbRefreshNow(); } catch {} const b = [...document.querySelectorAll('#bbQuick button')].filter(b => b.textContent.trim() === '✓').pop(); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    if (tick){ await page.mouse.click(tick[0], tick[1]); await drawn(page, 800); }
    live.kept = await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, st = JSON.parse(localStorage.getItem('bowling.mine') || '{}')[f.c + '_' + f.r];
      return { off: !D.ed().on, stored: st ? st.xy.length : 0, title: window.getFieldApp().cellTitle(f.c, f.r) }; });
    live.shared = await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, d = D.MINE.get(f.c + '_' + f.r); D.takeLeave(f.c + 3, f.r, { xy: d.xy }); const J = D.jobFor(f.c + 3, f.r); D.leaveNow(J);
      return { mine: !!J.mine, n: J.res.xy.length, made: !!(J.res.s && D.clearsAll(D.leavePins(J.res.xy), J.res.s, J.lane)) }; });
    // (a board with no game on it and a shot found: on CI the board beside had stood still, a game or no shot there)
    live.shown = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, f = D.LIVE, r = f.r + 2; let c = f.c + 5;
      for (let k = 0; k < 12; k++, c++){ if (D.GAMES.has(c + '_' + r)) continue; const J = D.leaveNow(D.jobFor(c, r)); if (J.rec) break; }
      const look = () => JSON.stringify(A.cellItems(c, r, 400).filter(i => /^bw(Pin|Ball)/.test(i.kind)).map(i => [i.kind, i.u.toFixed(3), i.v.toFixed(3)]));
      // (a whole loop sampled: up to 7 s of the ball and pins, a second standing, a second and a half held and the rest, so 6 s
      //  could fall in the still parts alone, as it did on CI)
      const seen = new Set(); for (let k = 0; k < 48 && seen.size < 3; k++){ seen.add(look()); await new Promise(ok => setTimeout(ok, 250)); } return seen.size; });
    if (!live.started || live.started.state !== 'play' || !live.started.G.spare || !live.tried || !(live.tried.G.tries >= 1 || live.tried.state === 'over') || !live.made || live.made.state !== 'over'
        || !live.opened || live.laid !== 2 || !(live.check >= 1) || !live.kept.off || live.kept.stored !== 2 || !/your leave/.test(live.kept.title)
        || !live.shared.mine || live.shared.n !== 2 || !live.shared.made || live.shown < 3)
      failures.push(`[${current}] real input: ${JSON.stringify(live)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} bowling spares (all ${sp.course} corner leaves made by their own shot; generated pars ${sp.pars.join(', ')} at levels 1, 3, 5; a miss set the leave up again as try ${sp.miss.tries + 1}; a real click started the lane's leave, the real Enter bowled, the shot shown made it; the real ✎ opened the editor, real clicks laid ${live.laid} pins, par ${live.check}, the real ✓ kept it, a shared copy made on another lane; a board no one plays showed ${live.shown} looks)`);
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
    // bowling, spares
    await go('bowling');
    await page.evaluate(() => { const D = window.getFieldApp()._debug; D.setMode('spares'); const f = D.LIVE; if (f) D.GAMES.delete(f.c + '_' + f.r); });
    let p = await at(0.5, 0.6); await page.mouse.click(p.x, p.y);
    const bs = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.GAMES.get(f.c + '_' + f.r); return g && g.G && { st: g.G.state, tries: g.G.tries, sx: g.G.shot.sx, v: g.G.shot.v, h: g.G.shot.h, over: g.state === 'over' }; });
    for (let w = 0; w < 20 && !(await bs()); w++) await frame(page, 250);
    out.bwShut = await shut();
    const K = await page.evaluate(() => window.getFieldApp()._debug.consts), b0 = await bs(), y0 = K.FOUL - K.BR - 0.004;
    let a = await at(b0.sx / K.W, y0), b = await at((b0.sx + 0.035) / K.W, y0), pts = [];
    for (let k = 0; k <= 8; k++) pts.push({ x: a.x + (b.x - a.x) * k / 8, y: a.y + (b.y - a.y) * k / 8 });
    await swipe(pts, 30); await drawn(page, 500);
    const b1 = await bs(); out.bwStand = +(b1.sx - b0.sx).toFixed(3);
    pts = []; for (let k = 0; k <= 10; k++){ const t = k / 10; pts.push(await at((b1.sx + 0.03 * Math.sin(Math.PI * t)) / K.W, y0 - 0.4 * t)); }
    await swipe(pts, 10);
    for (let w = 0; w < 60; w++){ const q = await bs(); if (q.tries > 0 || q.over) break; await frame(page, 250); }
    const b2 = await bs(); out.bwSwipe = { tries: b2.tries, over: b2.over, h: +b2.h.toFixed(2) };
    // curling
    await go('curling');
    await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE; if (f) D.GAMES.delete(f.c + '_' + f.r); });
    p = await at(0.5, 0.6); await page.mouse.click(p.x, p.y);
    const cs = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = f && D.GAMES.get(f.c + '_' + f.r); return g && g.G && { st: g.G.state, w: g.G.shot.w, curl: g.G.shot.curl }; });
    for (let w = 0; w < 20 && !((await cs()) || {}).st; w++) await frame(page, 250);
    const c0 = await cs();
    a = await at(0.5, 0.93); b = await at(0.5, 0.3); pts = []; for (let k = 0; k <= 10; k++) pts.push({ x: a.x + (b.x - a.x) * k / 10, y: a.y + (b.y - a.y) * k / 10 });
    await swipe(pts, 30); await drawn(page, 500);
    const c1 = await cs(); out.cuWeight = [+c0.w.toFixed(3), +c1.w.toFixed(3)];
    for (let w = 0; w < 10 && !(await pad('curl')); w++) await frame(page, 250);
    const pc = await pad('curl'); if (pc){ await page.mouse.click(pc[0], pc[1]); await drawn(page, 400); }
    out.cuCurl = [c1.curl, (await cs()).curl]; out.cuShut = await shut();
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
    const ok = out.bwShut && out.bwStand > 0.015 && (out.bwSwipe.tries >= 1 || out.bwSwipe.over) && out.bwSwipe.h > 0.2
      && out.cuWeight[1] !== out.cuWeight[0] && out.cuCurl[0] === -out.cuCurl[1] && out.cuShut
      && out.mr.laid && out.mr.next !== out.mr.laid && out.mr.ran !== 'build'
      && out.bk[1] > (out.bk[0] || 0) && out.bkShut && out.tk[0] !== out.tk[1] && out.tk[1] != null;
    if (!ok) failures.push(`[${current}] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} played with the row shut (bowling: the row shut, a drag along the line stood ${out.bwStand} over, a real swipe bowled with hook ${out.bwSwipe.h}; curling: a drag of the stone set the weight ${out.cuWeight.join(' → ')}, the pad's button turned the curl; marble run: real taps laid ${out.mr.laid} then ${out.mr.next}, a tap on the chute ${out.mr.ran}; 3D Tetris's Tip, the tanks' next shell by real clicks on the pad)`);
  }
  // BOWLING'S OIL AND BALLS (Oct 28: "whats next for bowling", then "1,2"): house shots near the corner and sport patterns far out;
  // a house shot holding a ball missed wide nearer the pocket than a flat one; the four balls (plastic all but straight, urethane
  // turning earliest, pearl latest); a game's balls wearing the lane (the frame-1 line hooking sooner after) and a spare's not;
  // the lane's picture painted again as it wears; and real input: the play pad's ball button and the real B changing the ball
  current = 'bowling oil and balls';
  {
    const before = failures.length;
    await page.evaluate(async () => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'bowling')); window.getFieldApp()._debug.setMode('game'); await new Promise(ok => setTimeout(ok, 2500)); await window.__settle(); });
    const o = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, K = D.consts, out = {};
      let h1 = 0, h5 = 0; for (let k = 0; k < 40; k++){ if (D.laneOf(1000 + k, 1).pat.house) h1++; if (D.laneOf(1000 + k, 5).pat.house) h5++; } out.house = [h1, h5];
      const at = (lane, s) => D.bowlSim([], s, lane, { untilY: K.HEAD }).B.x;
      const mk = id => { const L = D.laneOf(11, 2); L.pat = D.PATTERNS[id]; L.oil = D.ftY(L.pat.ft); L.crown = L.pat.crown; return L; };
      out.miss = ['house', 'chameleon'].map(id => { const L = mk(id), s = D.pick(D.rack(), L, true); return +Math.abs(at(L, { ...s, tx: s.tx + 0.015 }) - at(L, s)).toFixed(4); });
      const L = mk('house'), turn = (b, y) => { const xAt = P => { for (let q = 0; q + 3 < P.length; q += 2) if (P[q + 1] >= y && P[q + 3] < y) return P[q]; return NaN; };
        const s = { sx: K.CX + 0.05, tx: K.CX + 0.05, ty: K.ARROWS, v: 0.6, b }; return xAt(D.bowlSim([], { ...s, h: 0.6 }, L, { path: true }).path) - xAt(D.bowlSim([], { ...s, h: 0 }, L, { path: true }).path); };
      out.turn = D.BALLS.map((b, i) => [+turn(i, 0.55).toFixed(4), +turn(i, 0.35).toFixed(4)]);
      const G = D.newGame(500, 3, { ai: D.STEADY, seed: 1 }), s0 = D.pick(D.rack(), G.lane, true), x0 = at(G.lane, s0);
      let n = 0; while (G.state !== 'over' && n < 200000){ D.tick(G); n++; }
      out.wear = { max: +Math.max(...G.lane.wear).toFixed(3), moved: +(at(G.lane, s0) - x0).toFixed(4), balls: G.wearV };
      const S = D.newGame(5, 3, { leave: { xy: D.spotsOf([10]) } }); out.spareWear = !!S.lane.wear;
      return out;
    });
    // (the picture: a game started on the framed lane, its key changing once a ball has worn it)
    const pic = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ), g = D.gameAt(f.c, f.r);
      D.LIVE = { c: f.c, r: f.r }; D.begin(g); const k0 = A.cellPhoto(f.c, f.r, 400);
      g.G.shot = D.pick(g.G.pins, g.G.lane, true); D.bowlNow(g.G); let n = 0; while (g.G.state === 'roll' && n < 20000){ D.tick(g.G); n++; }
      const k1 = A.cellPhoto(f.c, f.r, 400); return { k0, k1, cv: !!A.photoCanvas(k1) }; });
    // real input: the pad's ball button, then the real B
    const live = {};
    await page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = D.gameAt(f.c, f.r); for (let n = 0; g.G.state !== 'aim' && n < 20000; n++) D.tick(g.G); try { bbRefreshNow(); } catch {} });
    await drawn(page, 900);
    const pb = await page.evaluate(() => { const b = document.querySelector('#playPad button[data-key="ball"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const ball = () => page.evaluate(() => { const D = window.getFieldApp()._debug, f = D.LIVE, g = D.GAMES.get(f.c + '_' + f.r); return [D.SET.ball, g && g.G && g.G.shot.b]; });
    live.b0 = await ball();
    if (pb){ await page.mouse.click(pb[0], pb[1]); await drawn(page, 500); }
    live.pad = await ball();
    await page.keyboard.press('b'); await drawn(page, 400);
    live.key = await ball();
    await page.evaluate(() => { const D = window.getFieldApp()._debug; D.SET.ball = 0; });
    const T = o.turn;
    if (!(o.house[0] === 40 && o.house[1] === 0) || !(o.miss[0] < o.miss[1]) || !(Math.abs(T[3][1]) < 0.2 * Math.abs(T[0][1])) || !(Math.abs(T[2][0]) > Math.abs(T[0][0])) || !(Math.abs(T[1][0]) < Math.abs(T[0][0]))
        || !(o.wear.max > 0.05 && o.wear.moved < -0.01) || o.spareWear || !(pic.k0 !== pic.k1 && pic.cv)
        || !pb || live.pad[0] !== (live.b0[0] + 1) % 4 || live.pad[1] !== live.pad[0] || live.key[0] !== (live.pad[0] + 1) % 4)
      failures.push(`[${current}] ${JSON.stringify({ o, pic, live, pb })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} bowling oil and balls (house shots ${o.house[0]}/40 at level 1, ${o.house[1]}/40 at level 5; a miss off the house shot ${o.miss[0]} against ${o.miss[1]} off a flat one; the balls' turn at mid-lane and the pins ${JSON.stringify(T)}; a game wore ${o.wear.max} and moved the frame-1 line ${o.wear.moved}; the picture painted again; the real pad's ball button and B)`);
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
} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
