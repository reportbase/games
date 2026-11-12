// Smoke test, part 5 of 7: the tanks, trick shots, Sudoku, Missile Command's look, Hashi and the game lab.
//
//   node tests/part5.mjs            this part alone (LIBS_DIR, BASE_URL, SETTLE_MS and CHROMIUM_PATH as for npm test)
//   SHARD=5/7 node tests/smoke.mjs  the same, by the runner
//   npm test                        every part, then the course test
//
// Cut from tests/smoke.mjs (12 Nov 2026) as it stood: the checks and their comments are unchanged. What every part
// needs (the server, the browser, the page loaded, the failures and how a run ends) is tests/harness.mjs.

import { begin, onClock, drawn, frame } from './harness.mjs';

let current = 'page load';
const T = await begin(5, () => current);
const { page, failures, cdp } = T;

try {
  // TANKS (Oct 20: "what tank games could we build", then "1", the artillery duel; Oct 21: weapons, more tanks, two players on
  // one device, driving): every board its own ground at a level by its ring; the computer's steady aim hits; a burst digs and
  // hurts; every weapon does its own thing; duels of two, three and four tanks end; real taps and drags aim and a tap on the tank fires, the computer
  // answers, a real key drives; a weapon chosen from the row is spent; two players pass turns past a computer's tank; a steady
  // shot wins with stars; a board no one plays shows its duel; the picture, the effects, the tanks upright, the sounds.
  {
    await page.evaluate(() => { window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'tanks')); window.getFieldApp()._debug.setMode(2, 1); });
    await drawn(page, 2000);
    current = 'tanks';
    const before = failures.length;
    const rules = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, out = {};
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      const a = D.terrainOf(77, 3, 2), b = D.terrainOf(77, 3, 2), c = D.terrainOf(78, 3, 2);
      out.same = a.H0.join() === b.H0.join() && a.xs.join() === b.xs.join(); out.differ = a.H0.join() !== c.H0.join();
      out.hills = [1, 5].map(lv => { let n = 0; for (let i = 0; i < 40; i++) if (D.terrainOf(300 + i, lv, 2).hill) n++; return n; });
      // the computer with steady hands: every one of 20 boards' first shot finds the other tank
      let hits = 0; for (let i = 0; i < 20; i++){ const T = D.terrainOf(900 + i, 1 + i % 5, 2); if (D.aimFor(T.H0, T.xs, 1, (i % 3 - 1) * 0.1, 0).m === 0) hits++; } out.hits = hits;
      // a burst: the ground dug where it lands, a tank at its middle hurt the most
      const T = D.terrainOf(5, 2, 2), S = { H: T.H0.slice(), xs: T.xs, hp: [100, 100] }, x = T.xs[1], y0 = D.surfAt(S.H, x);
      const dmg = D.blastAt(S, x, y0 - 0.012); out.dug = D.surfAt(S.H, x) - y0; out.dmg = dmg;
      const S2 = { H: T.H0.slice(), xs: T.xs, hp: [100, 100] }; out.farDmg = D.blastAt(S2, D.ASP / 2, D.surfAt(S2.H, D.ASP / 2));
      // every board's own duel ends, with two, three and four tanks
      out.duels = []; out.ended = true;
      for (const n of [2, 3, 4]) for (let i = 0; i < 3; i++){ const G = D.duelOf(D.terrainOf(4000 + i * 13 + n, 1 + (i + n) % 5, n)), left = G.S.hp.filter(h => h > 0).length;
        out.duels.push(n + ':' + G.turns.length); if (!(left <= 1 || G.turns.length >= 40)) out.ended = false; }
      // the weapons, each fired a little short at the same tank
      const W = D.terrainOf(1234, 3, 2), base = () => ({ lv: 3, n: 2, H: W.H0.slice(), xs: W.xs.slice(), hp: [100, 100], fuel: [100, 100], ammo: [[], []], wind: 0 });
      const aim = D.aimFor(W.H0, W.xs, 0, 0, 1), shot = D.WEAPONS.map((w, i) => { const S = base(), rec = D.simShot(S, 0, aim.a, aim.p * 0.93, i, 99);
        let dug = 0, raised = 0; for (let k = 0; k < S.H.length; k++){ dug += Math.max(0, S.H[k] - W.H0[k]); raised += Math.max(0, W.H0[k] - S.H[k]); }
        return { id: w.id, blasts: rec.ev.filter(e => e.k === 'blast').length, digs: rec.ev.filter(e => e.k === 'dig').length, tracks: rec.tracks.length, end: rec.end, dug, raised }; });
      const by = Object.fromEntries(shot.map(s => [s.id, s]));
      out.weapons = { big: by.big.dug > 2 * by.shell.dug, cluster: by.cluster.blasts >= 4 && by.cluster.tracks >= 5, dirt: by.dirt.raised > 0.5 && by.dirt.dug === 0,
                      roller: by.roller.end > by.shell.end + 0.1 && by.roller.blasts === 1, digger: by.digger.digs >= 3 && by.digger.dug > by.shell.dug };
      // the shot shown before it is fired: the whole flight at level 1, landing where the shot lands; a quarter of it at level 5
      out.preview = [1, 5].map(lv => { const T = D.terrainOf(4242, lv, 2), g = { T, S: { H: T.H0.slice(), xs: T.xs.slice(), hp: [100, 100], wind: 0.05 }, a: [50, 130], p: [0.7, 0.7], turn: 0, turns: [] };
        const P = D.previewOf(g), e = D.simLand(g.S.H, g.S.xs, 0, 50, 0.7, 0.05, [true, true]), n = P.length / 2;
        return { n, land: Math.hypot(P[P.length - 2] - e.x, P[P.length - 1] - e.y), whole: g._pv.whole }; });
      return out; });
    // real input on the framed board: a tap aims there and fires; the computer answers; a drag from your tank fires on letting go
    await page.evaluate(() => window.getFieldApp()._debug.fly(2, 1));
    // (on a fresh page a frame can take a second or more, so the camera can sit still before its flight has begun and the
    //  settle passes early: wait until the board's middle is near the middle of the screen, then settle)
    for (let k = 0; k < 160; k++){ if (await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera);
      return Math.abs(p.x) < 0.3 && Math.abs(p.y) < 0.4; })) break; await drawn(page, 250); }
    await page.evaluate(() => window.__settle());
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    // (a point of the board in its own x and y, projected here: across the width u is x / ASP)
    const at = (x, y) => page.evaluate(([x, y]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {}, u = x / window.getFieldApp()._debug.ASP;
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - y) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [x, y]);
    const gs = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return g && { state: g.state, turn: g.turn, turns: g.turns.length, a: g.a[0], p: g.p[0], hp: g.S.hp.slice(), x: g.S.xs[0], fuel: g.S.fuel[0], wid: g.wid[0], big: g.S.ammo[0][1], t: g.t }; }, fc[0] + '_' + fc[1]);
    /* WAITS ARE COUNTED ON THE GAME'S OWN CLOCK (12 Nov 2026: "1,2,3,4,5,6", the first "Games: fix the flaky checks and move to
       the newer browser"). A game here moves only when a frame is drawn, a quarter of a second of its time a frame at most
       (`stepGame`), so a turn of a second and a half is six frames or more and the computer's answer a dozen. The waits were
       seconds on the wall (20 for the answer), and with Playwright 1.63.0's Chromium the first frames that show a shot take
       seconds each in the software renderer (measured in a sandbox: 11 s, 6 s and 4 s for the first three, the page's own
       thread idle the while, then under a second; a second shot's frames all under two): 20 s on, the game's clock stood at
       half a second and the turn had not ended, on CI every time. So a wait is given seconds of the game's clock (`g.t`), and
       stops early only when five minutes on the wall have gone with the clock short of that. */
    const until = (ok, secs) => onClock(page, gs, ok, secs);
    const waitAim = () => until(s => s.state === 'over' || (s.state === 'aim' && s.turn === 0), 30);
    const live = {};
    if (fc){
      const tank = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.GAMES.delete(c + '_' + r); D.LIVE = { c, r }; const g = D.gameAt(c, r); return [g.S.xs[0], D.surfAt(g.S.H, g.S.xs[0])]; }, fc);
      // a tap aims (and fires nothing); a tap on your own tank fires
      const tx = tank[0] + 0.45, ty = 0.3, pt = await at(tx, ty); await page.mouse.click(pt.x, pt.y);
      // (the software renderer can take a second a frame, so the tap lands when it lands: wait for it before reading)
      for (let w = 0; w < 40 && (await gs()).a === 45; w++){ await frame(page, 250); if (w === 20) await page.mouse.click(pt.x, pt.y); }
      live.aimed = await gs(); live.want = Math.atan2(tank[1] - 0.022 - ty, tx - tank[0]) * 180 / Math.PI;
      live.arc = await page.evaluate(k => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k), V = D.viewOf(...k.split('_').map(Number)); return V.preview ? V.preview.length / 2 : 0; }, fc[0] + '_' + fc[1]);
      const pk = await at(tank[0], tank[1] - 0.022); await page.mouse.click(pk.x, pk.y);
      for (let w = 0; w < 40 && !((await gs()).turns >= 1); w++) await frame(page, 250);
      live.tap = await gs();
      live.answered = await waitAim();
      // a real key drives (D, held), on fuel
      // (the tank moves when a frame steps the game with the key held: two seconds of the game's clock for it)
      const x0 = (await gs()).x; await page.keyboard.down('d');
      await until(s => s.x > x0 + 0.01, 2);
      await page.keyboard.up('d'); await drawn(page, 100);
      live.drove = await gs(); live.x0 = x0;
      // a real drag anywhere on the board aims and fires nothing; then the real Enter key fires
      const a0 = (await gs()).a, p0 = await at(live.drove.x + 0.5, 0.45), p1 = await at(live.drove.x + 0.4, 0.3), p2 = await at(live.drove.x + 0.3, 0.2);
      await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p1.x, p1.y, { steps: 6 }); await page.mouse.move(p2.x, p2.y, { steps: 6 });
      await page.mouse.up();
      for (let w = 0; w < 40 && Math.abs((await gs()).a - a0) < 0.5; w++) await frame(page, 250);
      await drawn(page, 600);
      live.dragged = await gs(); live.a0 = a0;
      await page.keyboard.press('Enter');
      for (let w = 0; w < 40 && !((await gs()).turns >= 3); w++) await frame(page, 250);
      live.entered = await gs();
      // the row's Big shell, then a shot: one fewer left
      live.chose = await page.evaluate(async ([c, r]) => { const A = window.getFieldApp(), D = A._debug, g = D.GAMES.get(c + '_' + r);
        // (your tank kept whole while it waits, as the win's wait below keeps it: the computer's answer to the Enter shot put you
        //  out from 81 on CI, Oct 28, and with the game over there was no win left to play)
        // (and waited for on the game's clock, as above: the Enter shot's turn and the computer's answer)
        for (let w = 0, t0 = g.t; w < 1200 && g.t - t0 < 30 && !(g.state === 'aim' && g.turn === 0) && g.state !== 'over'; w++){ g.S.hp[0] = 100; await new Promise(ok => setTimeout(ok, 250)); }
        if (g.state === 'over') return { over: true };
        // (the row's ◀ a degree up, − two in a hundred of the power down, then Big shell and the row's Fire)
        const ready = g.state + g.turn, tiles = A.statTiles(c, r), a = g.a[0], p = g.p[0];
        A.onStatTap(c, r, 1); A.onStatTap(c, r, 3); const nudged = [+(g.a[0] - Math.round(a)).toFixed(3), +(g.p[0] - p).toFixed(3)];
        A.onStatTap(c, r, D.AIM_TILES + 1); const wid = g.wid[0]; A.onStatTap(c, r, 0);
        return { ready, tiles: tiles && tiles.length, fire: tiles && tiles[0].value, wid, big: g.S.ammo[0][1], nudged, fired: g.state === 'play' }; }, fc);
      // a win: the others all but out, your steady shots, through with stars and a best kept
      live.win = await page.evaluate(async ([c, r]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(c + '_' + r);
        g.S.hp.forEach((h, k) => { if (k) g.S.hp[k] = Math.min(h, 1) || 0; });
        for (let n = 0; n < 6 && g.state !== 'over'; n++){
          // (your tank kept whole while it waits: the computer's answer to the big shell before this could be a big shell too, and
          //  put you out before a steady shot was fired, on CI, Oct 21)
          // (both waits on the game's clock, as above)
          for (let w = 0, t0 = g.t; w < 1200 && g.t - t0 < 30 && !(g.state === 'aim' && g.turn === 0) && g.state !== 'over'; w++){ g.S.hp[0] = 100; await new Promise(ok => setTimeout(ok, 250)); }
          if (g.state === 'over') break;
          g.S.hp[0] = 100; const b = D.aimFor(g.S.H, g.S.xs, 0, g.S.wind, 1); g.a[0] = b.a; g.p[0] = b.p; g.wid[0] = 0; D.fire(g);
          for (let w = 0, t0 = g.t; w < 3000 && g.t - t0 < 30 && g.state === 'play'; w++) await new Promise(ok => setTimeout(ok, 100));
        }
        return { state: g.state, won: g.won, stars: g.stars, best: D.BEST.get(g.T.idx + '@' + g.T.lv) === g.S.hp[0] }; }, fc);
    }
    // three tanks, two players: Player 1 left, the computer's between, Player 2 right; after Player 1 and the computer, it is
    // Player 2's turn and the controls are theirs
    const two = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug; D.setMode(3, 2);
      const c = 9990, r = 9; D.LIVE = { c, r }; const g = D.gameAt(c, r), out = { seats: g.seats.join(), names: g.names.join(), n: g.S.xs.length };
      const step = () => { g.lastT = performance.now() - 100; D.stepGame(g); };
      const b = D.aimFor(g.S.H, g.S.xs, 0, g.S.wind, 1); g.a[0] = b.a; g.p[0] = b.p * 0.6; D.fire(g);
      for (let n = 0; n < 400 && !(g.state === 'aim' && g.turn === 2) && g.state !== 'over'; n++) step();
      out.turn = g.turn; out.mine = D.myTurn(g); out.whoFired = g.turns.map(t => t.who).join();
      if (out.mine){ D.aimAt(g, g.S.xs[2] - 0.3, 0.3); D.fire(g); out.p2 = g.turns[g.turns.length - 1].who; }
      D.GAMES.delete(c + '_' + r); D.setMode(2, 1); return out; });
    // a board no one plays: its own duel, moving on the page's clock
    const shown = await page.evaluate(async fc => { const A = window.getFieldApp(), D = A._debug, c2 = fc[0] + 3, r2 = fc[1] + 1; D.GAMES.delete(c2 + '_' + r2);
      const T = D.terrainAt(c2, r2), Dl = D.duelOf(T); Dl.start = performance.now() / 1000 - 3; D.DUELS.set((T.idx * 8 + T.lv) * 8 + T.n, Dl);
      const look = () => JSON.stringify(A.cellItems(c2, r2).filter(i => i.kind !== 'tkBox' || i.yaw).map(i => [i.kind, i.u.toFixed(4), i.v.toFixed(4), i.yaw || 0]));
      const seen = new Set(); for (let w = 0; w < 8; w++){ seen.add(look()); await new Promise(ok => setTimeout(ok, 500)); }
      let shells = 0, blasts = 0; for (let t = 0; t < Dl.len; t += 0.1){ const V = D.shownOf(Dl, t); if (V.shells.length) shells++; if (V.fx.some(e => e.k === 'blast' && V.t - e.t0 >= 0 && V.t - e.t0 < 0.5)) blasts++; }
      return { looks: seen.size, shells, blasts }; }, fc || [0, 0]);
    /* THE LOOK (Oct 20: "how can we make this with perfect graphics", then "yes"): the sky and the ground are a picture a board,
       the right way round (the earth at the near edge, the sky at the far), painted again when a burst digs and sharper for a
       board large on the screen; a burst sets off its fireball, clods and smoke; the clouds go with the wind; the tanks lie
       along the slope under them, never asking for a yaw of 0, the right-hand one mirrored to face left; the sounds. */
    const looks = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, out = {};
      let T = null; for (let i = 0; i < 40 && !T; i++){ const t = D.terrainOf(600 + i, 3, 2); if (D.PALETTES[t.pal].name === 'day') T = t; }
      const cv = D.paint(T, T.H0, [], 256), cx = cv.getContext('2d'), P = D.PALETTES[T.pal], w = cv.width, h = cv.height;
      const px = (u, v) => Array.from(cx.getImageData(Math.round((w - 1) * (1 - u)), Math.round((h - 1) * (1 - v)), 1, 1).data).slice(0, 3);
      const near = (q, hex) => Math.hypot(q[0] - parseInt(hex.slice(1, 3), 16), q[1] - parseInt(hex.slice(3, 5), 16), q[2] - parseInt(hex.slice(5, 7), 16));
      out.earth = Math.round(near(px(0.5, 0.985), P.deep)); out.sky = Math.min(...[0.03, 0.5, 0.97].map(u => Math.round(near(px(u, 0.005), P.sky[0])))); out.wide = w / h;
      const c = 9999, r = 7; D.GAMES.delete(c + '_' + r); D.LIVE = { c, r }; const g = D.gameAt(c, r);
      const k0 = A.cellPhoto(c, r, 400), kSmall = A.cellPhoto(c, r, 100);
      out.sizes = [A.photoCanvas(k0).height, A.photoCanvas(kSmall).height];
      // (Oct 20: "add sound effects to tanks.") each sound counted as it is asked for, through the real calls
      const heard = {}, kept = {}; for (const k of Object.keys(D.SFX)){ kept[k] = D.SFX[k]; D.SFX[k] = (...a) => { heard[k] = (heard[k] || 0) + 1; return kept[k](...a); }; }
      const b = D.aimFor(g.S.H, g.S.xs, 0, g.S.wind, 1); g.a[0] = b.a; g.p[0] = b.p; D.fire(g);
      const kinds = new Set();
      for (let n = 0; n < 300 && !(g.state === 'aim' && g.turn === 0) && g.state !== 'over'; n++){ g.lastT = performance.now() - 50; D.stepGame(g); for (const it of D.itemsOf(D.viewOf(c, r))) kinds.add(it.kind); }
      out.kinds = ['tkFire', 'tkClod', 'tkPuff', 'tkRing'].filter(k => kinds.has(k));
      out.redrawn = A.cellPhoto(c, r, 400) !== k0;
      out.heard = heard; Object.assign(D.SFX, kept);
      const V = D.viewOf(c, r), cl = v => D.itemsOf(Object.assign({}, v)).filter(i => i.kind === 'tkCloud').map(i => i.u);
      const a0 = cl(Object.assign({}, V, { cloud: 0, fx: [] })), a1 = cl(Object.assign({}, V, { cloud: 0.05, fx: [] }));
      out.clouds = a0.length > 0 && a0.some((u, i) => Math.abs(u - a1[i]) > 0.005);
      const its = D.itemsOf(V), tk = its.filter(i => /^tkHull/.test(i.kind)); out.tilt = tk.map(i => +(i.yaw || 0).toFixed(3)); out.slope = g.S.xs.map(x => +D.slopeAt(g.S.H, x).toFixed(3));
      // (Oct 20: "sometimes the tanks are up side down": the field leaves an item with a yaw of exactly 0 unturned, half a turn
      //  from every turned one, so no part of a tank may ask for 0; and the right-hand tank is its own mirrored kinds)
      out.upright = its.filter(i => /^tk(Tracks|Hull|Gun)/.test(i.kind)).every(i => typeof i.yaw === 'number' && i.yaw !== 0);
      out.facing = tk.map(i => i.kind).join();
      D.GAMES.delete(c + '_' + r);
      return out; });
    const r = rules, wpn = Object.values(r.weapons).every(x => x), ok = r.levels[0] < r.levels[2] && r.same && r.differ && r.hills[0] === 0 && r.hills[1] > 10 && r.hits >= 18
      && r.dug > 0.03 && r.dmg[1] >= 50 && r.dmg[0] === 0 && r.farDmg.join() === '0,0' && r.ended && wpn
      && r.preview[0].whole && r.preview[0].land < 0.03 && !r.preview[1].whole && r.preview[1].n < r.preview[0].n * 0.45
      && live.aimed && live.aimed.state === 'aim' && live.aimed.turns === 0 && Math.abs(live.aimed.a - live.want) < 2 && live.arc > 5
      && live.tap && live.tap.state === 'play' && live.tap.turns === 1
      && live.answered && live.answered.turns >= 2 && live.answered.state === 'aim'
      && live.drove && live.drove.x > live.x0 + 0.01 && live.drove.fuel < 100
      && live.dragged && live.dragged.turns === 2 && live.dragged.state === 'aim' && Math.abs(live.dragged.a - live.a0) > 2
      && live.entered && live.entered.turns === 3
      && live.chose && (live.chose.over || (live.chose.tiles === 13 && live.chose.fire === 'Fire' && live.chose.wid === 1 && live.chose.big === 1 && live.chose.fired && live.chose.nudged[0] === 1 && live.chose.nudged[1] < -0.009 && live.chose.nudged[1] > -0.031))
      && live.win && live.win.state === 'over' && live.win.won && live.win.stars >= 1 && live.win.best
      && two.seats === 'you,cpu,p2' && /Player 1/.test(two.names) && /Player 2/.test(two.names) && two.mine && two.turn === 2 && two.whoFired === '0,1' && two.p2 === 2
      && shown.looks >= 3 && shown.shells > 10 && shown.blasts > 2
      && looks.earth < 40 && looks.sky < 40 && looks.wide === 1.5 && looks.sizes.join() === '512,256' && looks.kinds.length === 4 && looks.redrawn && looks.clouds
      && looks.tilt.join() === looks.slope.join() && looks.upright && looks.facing === 'tkHull,tkHullL'
      && ['cannon', 'whistle', 'blast', 'whirr'].every(k => looks.heard[k] >= 1);
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ rules, live, two, shown, looks })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} tanks (levels ${r.levels.join('/')} by ring; the steady computer's first shot hit on ${r.hits} of 20 boards; a burst dug ${r.dug.toFixed(3)} and took ${r.dmg[1]}; duels of 2, 3 and 4 tanks ended (${r.duels.join(', ')}); every weapon its own (${Object.entries(r.weapons).map(([k, v]) => k + (v ? '' : ' NOT')).join(', ')}); a real tap aimed with the shot's way dotted, a tap on the tank fired, the computer answered, a real key drove ${live.drove ? (live.drove.x - live.x0).toFixed(3) : '?'}, a real drag aimed and Enter fired, the row nudged the aim and fired a big shell, a steady shot won ${live.win && live.win.stars} stars; two players passed turns past a computer's tank; a board no one plays showed ${shown.looks} looks in 4 s; the picture the right way round, painted again on a burst, ${looks.sizes.join('/')} px; ${looks.kinds.join(', ')})`);
  }
  // TRICK SHOTS (Oct 22: "could you add the trick shot demo from wander. repos to the games application?"): wander's engine
  // gives the textbook results (the thresholds wander's own smoke test holds it to), every challenge's reference shot solves it
  // on its board, a missed try puts the balls back and says why, a real drag aims, a real click on the white shoots and the
  // shot plays to its end, a real Space shoots a free board and a pot counts, the row's Spin and power tiles change the cue, a
  // board no one plays goes through its shot, and the drawing is balls, cushions, the cue and the shot seen ahead.
  // (Oct 22, "1,2,5": every board past the corner's fifteen its own trick shot by level, made in slices and solved by its own
  // reference shot, the same each time, par rising and the window of aim narrowing farther out; stars; a tap on a solved board
  // going on to the next; the real spin inset and pull strip; the balls rolling, numbered, with trails.)
  {
    await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.id === 'trickshots'); window.setFieldApp(A); A._debug.GAMES.clear(); });
    await drawn(page, 1500);
    current = 'trickshots';
    const before = failures.length;
    const rules = await page.evaluate(() => { const D = window.getFieldApp()._debug, sc = D.spinChecks(), out = {};
      out.spin = { roll: sc.rollSlip < 1e-9, follow: Math.abs(sc.follow - sc.followPred) < 0.005, stun: Math.abs(sc.stun) < 0.05, draw: sc.draw < 0.5, english: sc.englishVx * sc.rightX > 0.3,
        miscue: !sc.miscue.grip && sc.miscue.turn < 0 && sc.miscue.turn > -44.5, cutThrow: sc.cutThrow > 0.5 && sc.cutThrow < 4.5, sideThrow: sc.sideThrow < -0.3 && sc.sideThrow > -4.5,
        passed: sc.passed < 0, masse: Math.abs(sc.masseBend) > 10, jump: sc.jumpCleared && sc.jumpPeak > 2 * 0.45, followGrip: sc.followGrip < sc.followPred - 0.01 && sc.followGrip > 0.15,
        backspinPassed: sc.backspinPassed > 0, offTable: sc.offTable };
      out.sols = D.CHALLENGES.map((c, i) => { const S = D.setupOf(i), o = c.sol, st = D.strikeOf(o.a * D.D, ...(o.tip || [0, 0]), o.p, undefined, (o.el || 0) * D.D);
        return S.ch === c && !c.goal(D.simulate(S.B, st.dir, st.speed, st.w, st.vy), c); });
      out.cells = D.CHALLENGES.map((_, i) => D.boardIdx(...D.cellOfIdx(i)) === i).every(Boolean);
      // generated trick shots: three boards at level 1 and at level 5, each solved by its own reference shot, made the same twice
      const gen = lv => [20, 21, 22, 23].map(idx => { const P = D.runGen(D.makePuzzle(idx, lv)), o = P.sol;
        return { ok: !D.trial(P.B(), P, { a: o.a, p: o.p, tip: o.tip || [0, 0], el: o.el || 0 }).why, par: P.par, w: P.window, kind: P.kind, see: P.see, pocket: P.pocket }; });
      const g1 = gen(1), g5 = gen(5), again = D.runGen(D.makePuzzle(21, 5)), avg = (a, k) => a.reduce((x, y) => x + y[k], 0) / a.length;
      out.gen = { solved: [...g1, ...g5].every(x => x.ok), par1: avg(g1, 'par'), par5: avg(g5, 'par'), w1: +avg(g1, 'w').toFixed(2), w5: +avg(g5, 'w').toFixed(2),
        see: [g1[0].see, g5[0].see], same: JSON.stringify(again.sol) === JSON.stringify(D.runGen(D.makePuzzle(21, 5)).sol),
        kinds: [...new Set([...g1, ...g5].map(x => x.kind))].join(','), levels: [[0, 0], [10, 0], [40, 40]].map(([c, r]) => D.levelOf(c, r)),
        stars: [D.starsOf(1, 1), D.starsOf(3, 1), D.starsOf(5, 1)].join() };
      // (Oct 23, "3": from level 3 the pocket is called; its own shot sinks it there, and the same shot with another pocket
      //  called is a miss that says so; level 1 calls none)
      { const P = D.runGen(D.makePuzzle(24, 3)), o = P.sol, at = { a: o.a, p: o.p, tip: o.tip || [0, 0], el: o.el || 0 };
        const Q = D.puzzleOf({ ...D.plainOf(P), pocket: (P.pocket + 1) % 6 });
        out.call = { pocket: P.pocket, l1: g1.every(x => x.pocket == null), ok: !D.trial(P.B(), P, at).why, wrong: D.trial(Q.B(), Q, at).why, see4: D.runGen(D.makePuzzle(25, 4)).see,
          ringed: D.itemsOf({ B: P.B(), pos: P.B().map(b => [b.x, b.z, 0]), ch: P }).filter(i => i.kind === 'tsRing' && i.color === 0xd0574a).length }; }
      // a missed try on the ½-ball board (the cue straight at the 1): the balls go back, the board says why
      const [c0, r0] = D.cellOfIdx(0); D.GAMES.delete(c0 + '_' + r0); const g = D.gameAt(c0, r0), at0 = g.balls.map(b => [b.x, b.z]);
      D.shoot(g); D.finish(g);
      out.miss = { tries: g.tries, why: g.lastWhy, back: g.balls.every((b, i) => b.x === at0[i][0] && b.z === at0[i][1]) };
      D.GAMES.delete(c0 + '_' + r0);
      return out; });
    // the ½-ball challenge framed for real: a real drag aims, and a real click on the white plays the reference shot through
    await page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = D.cellOfIdx(0); D.GAMES.delete(c + '_' + r); D.fly(c, r); });
    await drawn(page, 2500); await page.evaluate(() => window.__settle && window.__settle());   // (and the camera at rest after the flight, 12 Nov 2026)
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    const at = (x, z) => page.evaluate(([x, z]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB, D = window.getFieldApp()._debug;
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - D.Ub(x)) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - D.Vb(z)) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [x, z]);
    const gs = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); if (!g) return null;
      return { ang: g.ang * 180 / Math.PI, tries: g.tries, solvedIn: g.solvedIn, anim: !!g.anim, potted: g.potted, shots: g.shots, power: g.power, tip: g.tip, why: g.lastWhy,
               balls: g.balls.map(b => ({ n: b.n, x: b.x, z: b.z, sunk: b.sunk })) }; }, fc[0] + '_' + fc[1]);
    const live = {};
    if (fc){
      live.cell = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; D.LIVE = { c, r }; D.gameAt(c, r); return D.boardIdx(c, r); }, fc);
      const g0 = await gs(), w = g0.balls[0];
      // a drag from beside the white toward a point straight up the board from it: the cue turns to it (−90°)
      const p0 = await at(w.x + 3, w.z - 2), p1 = await at(w.x, w.z - 3);
      await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p1.x, p1.y, { steps: 8 });
      for (let k = 0; k < 20 && Math.abs((await gs()).ang + 90) > 8; k++) await frame(page, 250);
      await page.mouse.up();
      live.dragged = (await gs()).ang;
      await drawn(page, 500);   // (past the tap the field still calls after a drag)
      await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(c + '_' + r), o = g.ch.sol; g.ang = o.a * D.D; D.setPower(g, o.p); D.setTip(g, 0, 0); }, fc);
      const pw = await at(w.x, w.z);
      await page.mouse.click(pw.x, pw.y);
      const rot0 = await page.evaluate(k => window.getFieldApp()._debug.GAMES.get(k).rot[0].join(), fc[0] + '_' + fc[1]);
      live.playing = (await gs()).anim;
      for (let k = 0; k < 40 && (await gs()).anim; k++) await frame(page, 250);
      live.after = await gs();
      // the white rolled (its turn is not where it began; after a try it goes back with the balls), and the frame wears the stars
      live.rolled = await page.evaluate(([k, r0]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k), V = D.liveView(g), it = D.itemsOf(V);
        // (Oct 23: "the cue stick should always be on top and should extend on to the the adjacent boards if needed": the played
        //  board's cue full length, drawn on top, its butt behind the white, away from the shot)
        const cue = it.find(i => i.kind === 'tsCue'), q = cue && cue.rot, A = window.getFieldApp(), W = window.FIELD_WORLD;
        const back = q ? (() => { const [x, y, z, w] = q, a = -1, ix = w * a, iy = z * a, iz = -y * a, iw = -x * a; return [ix * w + iw * -x + iy * -z - iz * -y, iz * w + iw * -z + ix * -y - iy * -x]; })() : null;
        return { stars: it.filter(i => i.kind === 'tsStar' && i.color === 0xd4a052).length, balls: it.filter(i => /^tsB\d+$/.test(i.kind) && i.rot).length, best: D.BEST.half,
                 cue: cue ? { len: cue.sx, onTop: A.itemGeometries.tsCue(W.THREE).userData.onTop, behind: back[0] * Math.cos(g.ang) + back[1] * Math.sin(g.ang) < -0.9 } : null }; }, [fc[0] + '_' + fc[1], rot0]);
      // the row: Spin steps the tip to follow, power + steps it up by one
      live.row = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(c + '_' + r), p = g.power; D.onTile(g, 5); D.onTile(g, 4);
        return { tip: g.tip.y, power: g.power - p, tiles: D.tilesOf(g).length }; }, fc);
      // the real spin inset: a click above its middle strikes the white high; the real pull strip: pulled and let go, it shoots
      await page.waitForFunction(() => { const e = document.getElementById('tsCtl'); return e && e.style.display !== 'none'; }, null, { timeout: 8000 }).catch(() => {});
      const tipBox = await page.evaluate(() => { const e = document.getElementById('tsTip'), r = e && e.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null; });
      if (tipBox){ await page.mouse.click(tipBox.x - 0.2 * 0.36 * tipBox.w, tipBox.y - 0.5 * 0.36 * tipBox.w); live.inset = (await gs()).tip; }
      await page.waitForFunction(() => { const e = document.getElementById('tsCtl'); return e && e.style.display !== 'none'; }, null, { timeout: 8000 }).catch(() => {});
      const pullBox = await page.evaluate(() => { const e = document.getElementById('tsPull'), r = e && e.getBoundingClientRect(); return r && r.height ? { x: r.left + r.width / 2, y: r.top + 8, h: r.height } : null; });
      if (pullBox){ const s0 = (await gs()).shots; await page.mouse.move(pullBox.x, pullBox.y); await page.mouse.down(); await page.mouse.move(pullBox.x, pullBox.y + pullBox.h * 0.3, { steps: 6 });
        live.pulled = (await gs()).power; await page.mouse.up(); await drawn(page, 300); live.pull = { shots: (await gs()).shots - s0, anim: (await gs()).anim };
        for (let k = 0; k < 40 && (await gs()).anim; k++) await frame(page, 250); }
      // solved, a real click on the table (away from the white) sets it up again where it is (Oct 29: only you move to another board)
      { const g = await gs(), w = g.balls[0], p = await at(w.x > 0 ? w.x - 4 : w.x + 4, 0); await page.mouse.click(p.x, p.y); await drawn(page, 400);
        live.next = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.LIVE, g = L && D.gameAt(L.c, L.r); return L ? [D.boardIdx(L.c, L.r), !!(g && g.solvedIn)] : null; }); }
      // free play on the next board along: a real Space shoots a straight pot (the 1 set before a corner pocket, the white behind it)
      const fr = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug; let k = D.boardIdx(c, r) + 20; const [fc2, fr2] = D.cellOfIdx(k);
        D.GAMES.delete(fc2 + '_' + fr2); D.FREEPLAY.add(fc2 + '_' + fr2); D.fly(fc2, fr2); D.LIVE = { c: fc2, r: fr2 }; const g = D.gameAt(fc2, fr2);
        const a = Math.atan2(4, 6); g.balls = [{ ...g.balls[0], x: 4, z: 1, sunk: false }, { ...g.balls.find(b => !b.cue), x: 4 + 3.6 * Math.cos(a), z: 1 + 3.6 * Math.sin(a), sunk: false }]; g.total = 1; g.dirty = true;
        g.ang = a; D.setPower(g, 12); D.setTip(g, 0, -0.3); return [fc2, fr2, g.ch ? 1 : 0]; }, fc);
      await page.keyboard.press(' ');
      const fk = fr[0] + '_' + fr[1];
      const fgs = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return { anim: !!g.anim, potted: g.potted, shots: g.shots, back: g.history.length }; }, fk);
      live.space = await fgs();
      for (let k = 0; k < 40 && (await fgs()).anim; k++) await frame(page, 250);
      live.free = { ...(await fgs()), challenge: fr[2] };
      await page.evaluate(k => { const D = window.getFieldApp()._debug; D.GAMES.delete(k); D.FREEPLAY.delete(k); D.LIVE = null; }, fk);
      await page.evaluate(k => window.getFieldApp()._debug.GAMES.delete(k), fc[0] + '_' + fc[1]);
    }
    const shown = await page.evaluate(async () => { const D = window.getFieldApp()._debug, idx = 3, R = D.recSoon(idx, true), [c, r] = D.cellOfIdx(idx); D.GAMES.delete(c + '_' + r);
      const a = D.shownOf(R); let moved = 0, sawCue = !!a.cue, sawPlay = !a.cue;
      // (looked at for a whole loop and a little more, from wherever the board's own phase begins it: 4.8 s could fall wholly in the
      //  shot's flight and miss the cue, which failed on CI, Oct 29)
      for (let k = 0; k < Math.ceil((R.cycle + 1) / 0.3); k++){ await new Promise(ok => setTimeout(ok, 300)); const b = D.shownOf(R); sawCue = sawCue || !!b.cue; sawPlay = sawPlay || !b.cue;
        moved += a.pos.reduce((s, p, i) => s + (p && b.pos[i] ? Math.hypot(p[0] - b.pos[i][0], p[1] - b.pos[i][1]) : 0), 0); }
      const it = D.itemsOf({ B: R.S.B, pos: R.S.B.map(b => [b.x, b.z, 0]), ch: R.S.ch, sim: R.s, hz: R.s.hz, see: 3, paths: 'all', cue: { ang: 0.3, power: 14, elev: 0, tip: { x: 0, y: 0 }, chalk: true } });
      const kinds = k => it.filter(i => i.kind === k).length;
      return { cycle: +R.cycle.toFixed(1), moved: +moved.toFixed(2), sawCue, sawPlay, balls: it.filter(i => /^tsB\d+$/.test(i.kind)).length, cushions: kinds('tsBox'), cue: kinds('tsCueIdle'), dots: kinds('tsDot'), ghost: kinds('tsGhost'),
               yaws: it.filter(i => i.kind === 'tsCueIdle').every(i => i.rot), inside: it.every(i => i.u > -0.02 && i.u < 1.02 && i.v > -0.02 && i.v < 1.02), photo: !!D.paint(256) }; });
    const r = rules, ok = Object.values(r.spin).every(Boolean) && r.sols.every(Boolean) && r.cells && r.miss.tries === 1 && r.miss.why && r.miss.back
      && live.cell === 0 && Math.abs(live.dragged + 90) < 10 && live.playing && live.after && !live.after.anim && live.after.tries === 1 && live.after.solvedIn === 1
      && live.row.tip > 0.3 && live.row.power === 1 && live.row.tiles === 12 && live.space.anim && live.free.challenge === 0 && live.free.potted === 1 && live.free.shots === 1 && live.free.back === 1
      && r.gen.solved && r.gen.par5 > r.gen.par1 && r.gen.w5 < r.gen.w1 && r.gen.see[0] > r.gen.see[1] && r.gen.same && r.gen.levels[0] <= r.gen.levels[2] && r.gen.stars === '3,2,1'
      && r.call && r.call.pocket >= 0 && r.call.l1 && r.call.ok && /another pocket/.test(r.call.wrong || '') && r.call.see4 === 0 && r.call.ringed === 2
      && live.rolled.balls >= 2 && live.rolled.stars === 3 && live.rolled.cue && live.rolled.cue.len >= 20 && live.rolled.cue.onTop && live.rolled.cue.behind && live.rolled.best === 1 && live.inset && live.inset.y > 0.3 && live.inset.x < -0.05
      && live.pulled > 10 && live.pull && live.pull.shots === 1 && live.next && live.next[0] === 0 && !live.next[1]
      && shown.moved > 0.5 && shown.sawCue && shown.sawPlay && shown.balls >= 2 && shown.cushions === 6 && shown.cue === 1 && shown.dots > 10 && shown.ghost >= 1 && shown.yaws && shown.inside && shown.photo;
    if (!ok) failures.push(`[${current}] ${JSON.stringify({ rules, live, shown })}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} trick shots (wander's textbook results; ${r.sols.filter(Boolean).length} of ${r.sols.length} reference shots solve their challenges; a missed try put the balls back: ${r.miss.why}; a real drag aimed the cue to ${live.dragged && live.dragged.toFixed(1)}°; a real click on the white played the ½-ball cut, solved in ${live.after && live.after.solvedIn}; a real Space potted on free play; a board no one plays went through its ${shown.cycle} s shot, drawn with ${shown.dots} dots ahead; generated trick shots solved by their own shots (${r.gen.kinds}), par ${r.gen.par1} at level 1 and ${r.gen.par5} at level 5, windows ${r.gen.w1}° and ${r.gen.w5}°; the real inset struck the white high, the real strip pulled to ${live.pulled} shot, and a click on the solved table set board ${live.next && live.next[0]} up again)`);
  }
  // YOUR OWN TRICK SHOT (Oct 23: "2", of what came next for trick shots: "make your own trick shot and share it"): the real ✎ quick
  // button opens the editor on the framed table, real clicks place the white and a ball and mark it to pot, Check finds a shot
  // (in the solver's worker) with its par, Done keeps it on the board (and in localStorage) and plays it, its own shot solves
  // it, a shared copy taken on another board is the same, and a ball ringed by balls not to be touched is refused.
  {
    const before = failures.length, out = {};
    const [c, r] = await page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = D.cellOfIdx(60); D.GAMES.delete(c + '_' + r); D.MINE.delete(60); D.fly(c, r); return [c, r]; });
    await drawn(page, 3000); await page.evaluate(() => window.__settle && window.__settle());   // (and the camera at rest after the flight, 12 Nov 2026)
    const at = (x, z) => page.evaluate(([x, z]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB, D = window.getFieldApp()._debug;
      const pv = new W.THREE.Vector3(T.boardX + (0.5 - D.Ub(x)) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - D.Vb(z)) * bW * (L.cellH || 1)).project(W.camera);
      return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, [x, z]);
    const est = () => page.evaluate(() => { const E = window.getFieldApp()._debug.ed(); return { on: E.on, balls: E.balls.map(b => b.slice()), target: E.target, found: E.found && { par: E.found.par, w: E.found.window }, checking: E.checking }; });
    try {
      await page.evaluate(() => { if (!window.tvf.bottomRow.visible){ window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); } }); await drawn(page, 700);   // (✎ is in the row's band: the row opened by hand, Oct 28)
      await page.waitForSelector('#bbQuick button[title^="Make"]', { state: 'visible', timeout: 15000 });
      await page.click('#bbQuick button[title^="Make"]'); await drawn(page, 800);
      out.opened = (await est()).on;
      const tile = i => page.evaluate(i => window.getFieldApp()._debug.edTile(i), i);
      await tile(11);                                            // Clear: the white alone
      await tile(0); let p = await at(-8, 0); await page.mouse.click(p.x, p.y); await drawn(page, 600);
      await tile(1); p = await at(2, 1); await page.mouse.click(p.x, p.y); await drawn(page, 600);
      await tile(2); p = await at(2, 1); await page.mouse.click(p.x, p.y); await drawn(page, 600);
      out.placed = await est();
      await tile(12);                                            // Check
      for (let k = 0; k < 60 && !(await est()).found; k++) await frame(page, 500);
      out.found = (await est()).found;
      await tile(13); await drawn(page, 2500);           // Play: kept and played
      out.kept = await page.evaluate(([c, r]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(c + '_' + r), m = D.MINE.get(60);
        let stored = false; try { stored = JSON.parse(localStorage.getItem('trickshots.mine')).some(([k]) => k === 60); } catch {}
        const res = { on: D.ed().on, mine: !!m, stored, game: !!(g && g.ch && g.ch.mine), text: g && g.ch && g.ch.text, par: g && g.ch && g.ch.par };
        if (g){ const o = g.ch.sol; g.ang = o.a * D.D; D.setPower(g, o.p); D.setTip(g, ...(o.tip || [0, 0])); D.setElev(g, o.el || 0); D.shoot(g); D.finish(g); res.solvedIn = g.solvedIn; }
        const [c2, r2] = D.cellOfIdx(61); D.MINE.delete(61); D.takeShot(c2, r2, JSON.parse(JSON.stringify(m)));
        res.shared = !!D.MINE.get(61) && JSON.stringify(D.MINE.get(61).balls) === JSON.stringify(m.balls);
        D.edOpen(); const E = D.ed(); E.balls = [[0, -8, 0], [1, 5, 0], ...[0, 1, 2, 3, 4, 5].map(k => [k + 2, 5 + 0.92 * Math.cos(k * Math.PI / 3), 0.92 * Math.sin(k * Math.PI / 3)])];
        E.target = 1; E.avoid = [2, 3, 4, 5, 6, 7]; E.first = null; E.zone = null; E.found = null; D.edCheck(); return res; }, [c, r]);
      for (let k = 0; k < 120 && (await est()).checking; k++) await frame(page, 500);
      out.ringed = await est();
      await page.evaluate(() => { const D = window.getFieldApp()._debug; D.edCancel(); D.MINE.delete(60); D.MINE.delete(61); D.GAMES.clear(); });
    } catch (e) { out.err = String(e); }
    const k = out.kept || {}, ok = !out.err && out.opened && out.placed && out.placed.balls.length === 2 && out.placed.target === 1 && Math.abs(out.placed.balls[1][1] - 2) < 0.3
      && out.found && out.found.par >= 1 && !k.on && k.mine && k.stored && k.game && k.solvedIn === 1 && k.shared && out.ringed && !out.ringed.checking && !out.ringed.found;
    if (!ok) failures.push(`[trickshots editor] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} your own trick shot (the real ✎ opened the editor, real clicks laid a ball and marked it, Check found a shot with par ${out.found && out.found.par} (${out.found && out.found.w}°), Done kept it and its shot solved it, a shared copy went onto another board, a ringed ball was refused)`);
  }
  // A RUN-OUT (Oct 23, "1", of what came next: "multi-shot puzzles: clear a small table in two or three shots, with each leave
  // planned for the next"): a run-out board framed for real; its own shots, set on the cue by the menu's Show me the trick and
  // played by real clicks on the white, carry the table on a shot at a time and clear it in one try; a shot that pots nothing
  // puts every ball back and the run starts again; a board no one plays shows the whole run, every ball down at its end.
  {
    const before = failures.length, out = {};
    try {
      await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.id === 'trickshots'); window.setFieldApp(A); });
      out.idx = await page.evaluate(() => { const D = window.getFieldApp()._debug;
        for (let i = 40; i < 2000; i++){ const lv = D.levelAt(i); if (lv < 2) continue; const P = D.runGen(D.makePuzzle(i, lv)); if (P && P.kind === 'run' && P.sols.length === 2) return i; } return -1; });
      await page.evaluate(i => { const D = window.getFieldApp()._debug, [c, r] = D.cellOfIdx(i); D.GAMES.delete(c + '_' + r); D.fly(c, r); window.__run = [c, r]; }, out.idx);
      await drawn(page, 3500); await page.evaluate(() => window.__settle && window.__settle());   // (and the camera at rest after the flight, 12 Nov 2026)
      await page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = window.__run; D.LIVE = { c, r }; D.gameAt(c, r); });
      for (let k = 0; k < 40; k++){ if (await page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = window.__run, g = D.gameAt(c, r); return !!(g && g.ch); })) break; await frame(page, 500); }
      const rs = () => page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = window.__run, g = D.GAMES.get(c + '_' + r);
        return { kind: g.ch.kind, stage: g.stage, tries: g.tries, solvedIn: g.solvedIn, anim: !!g.anim, left: g.balls.filter(b => !b.cue && !b.sunk).length, why: g.lastWhy, white: (b => [b.x, b.z])(g.balls.find(b => b.cue)) }; });
      const whiteAt = async () => { const w = (await rs()).white; return page.evaluate(([x, z]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB, D = window.getFieldApp()._debug;
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - D.Ub(x)) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - D.Vb(z)) * bW * (L.cellH || 1)).project(W.camera);
        return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight }; }, w); };
      const showMe = () => page.evaluate(() => window.getFieldApp().menu[0].items.find(i => i.label === 'Show me the trick').on());
      const play = async () => { const p = await whiteAt(); await page.mouse.click(p.x, p.y); for (let k = 0; k < 40 && (await rs()).anim; k++) await frame(page, 250); await frame(page, 300); };
      out.start = await rs();
      // a miss first: the cue turned away from every ball, softly
      await page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = window.__run, g = D.GAMES.get(c + '_' + r), w = g.balls.find(b => b.cue);
        let best = 0, bd = -1; for (let a = 0; a < 360; a += 10){ const t = a * D.D; const d = Math.min(...g.balls.filter(b => !b.cue).map(b => Math.abs(Math.sin(Math.atan2(b.z - w.z, b.x - w.x) - t)) + (Math.cos(Math.atan2(b.z - w.z, b.x - w.x) - t) < 0 ? 2 : 0))); if (d > bd){ bd = d; best = t; } }
        g.ang = best; D.setPower(g, 4); D.setTip(g, 0, 0); D.setElev(g, 0); g.dirty = true; });
      await play(); out.missed = await rs();
      await showMe(); await play(); out.one = await rs();
      await showMe(); await play(); out.two = await rs();
      out.shown = await page.evaluate(i => { const D = window.getFieldApp()._debug, R = D.recSoon(i, true), fr = R.s.frames, last = fr[fr.length - 1], n = R.S.B.length;
        return { cycle: +R.cycle.toFixed(1), allDown: R.S.B.every((b, k) => b.cue || isNaN(last[2 * k])), sunk: R.s.sunk.filter(p => p.n !== 0).length }; }, out.idx);
      await page.evaluate(() => { const D = window.getFieldApp()._debug, [c, r] = window.__run; D.GAMES.delete(c + '_' + r); D.LIVE = null; });
    } catch (e) { out.err = String(e); }
    const ok = !out.err && out.idx > 0 && out.start.kind === 'run' && out.start.stage === 0 && out.start.left === 2
      && out.missed.tries === 1 && out.missed.stage === 0 && out.missed.left === 2 && !!out.missed.why
      && out.one.stage === 1 && out.one.left === 1 && out.one.tries === 1 && out.two.left === 0 && out.two.solvedIn === 2
      && out.shown.allDown && out.shown.sunk === 2;
    if (!ok) failures.push(`[trickshots run-out] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} trick shots run-out (board ${out.idx}: a miss started the run again (${out.missed && out.missed.why}); its own two shots, played by real clicks, cleared it on the next try; a board no one plays showed the whole ${out.shown && out.shown.cycle} s run)`);
  }
  // THE GAME LAB (Oct 25: "seems to me these simpler games are good foundation to let the user add features, through a prompt.",
  // then "2"): the starters run in the sandbox and the boards play them; a real click on Lights Out flips exactly its cross; the
  // sandbox has no network or storage, stops an endless loop and names an error's line; Change it… through the real box sends the
  // rules to the gateway (mocked here) and keeps Claude's version, a broken one going back once to be fixed; Undo goes back; a
  // shared game lands on another board; Snake waits for the player, then the real arrow key turns it.
  {
    const before = failures.length, bad = [];
    const GOOD = `// Gold lights
const game = { title: 'Gold Lights', size: l => l < 3 ? 4 : 5,
  setup(level, rand){ const n = game.size(level); return { n, lit: Array.from({ length: n * n }, (_, i) => ((i % n) + (i / n | 0)) % 2 ? 0 : 1), taps: 0 }; },
  tap(s, x, y){ s.lit[y * s.n + x] ^= 1; s.taps++; },
  bot(s){ const i = s.lit.indexOf(1); return i < 0 ? null : [i % s.n, i / s.n | 0]; },
  view(s){ return { squares: s.lit.map(l => l ? '#806010' : '#222222'),
    pieces: s.lit.map((l, i) => l ? { shape: 'gem', x: i % s.n + 0.5, y: (i / s.n | 0) + 0.5, size: 0.7, color: '#ffd700', glow: true } : null).filter(Boolean),
    status: s.taps + ' taps', score: s.taps }; } };`;
    const BROKEN = 'const game = { size: 4, setup(){ return {}; }, view(s){ return s.nope.x; } };';
    const asked = [];
    const sse = text => ['message_start', null].map(() => '').join('') + 'event: a\ndata: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\nevent: b\ndata: {"type":"message_stop"}\n\n';
    await page.route(/login\.tangent\.workers\.dev\/v1\/messages/, async route => {
      const body = JSON.parse(route.request().postData()); asked.push(body);
      const text = asked.length === 1 ? 'I broke it.\n```js\n' + BROKEN + '\n```' : 'I made the lit squares gold gems.\n```js\n' + GOOD + '\n```';
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(text) });
    });
    try {
      await page.evaluate(() => { localStorage.removeItem('gamelab.mine'); const A = window.FIELD_APPS.find(a => a.id === 'gamelab'); window.setFieldApp(A); });
      await drawn(page, 3000);
      // (the board left framed by the checks before is not the corner, and boards go round eight starters since Oct 26: fly there)
      await page.evaluate(() => window.getFieldApp()._debug.fly(0, 0));
      await page.waitForFunction(() => { const L = window.getFieldApp()._debug.live; return L && L.c === 0 && L.r === 0; }, null, { timeout: 8000 }).catch(() => {});
      await drawn(page, 1500);
      const S = await page.evaluate(async () => { const D = window.getFieldApp()._debug, out = {};
        for (const s of D.STARTERS){ const T = await D.trialOf(s.src); out[s.id] = T.error || T.meta.title; }
        const L = D.live, r = D.RUN.get(L.c + '_' + L.r);
        out.live = L; out.title = r && r.meta && r.meta.title; out.started = r && r.started;
        out.loop = (await D.trialOf('const game = { size: 4, setup(){ return {}; }, view(){ for (;;){} } };')).error;
        out.err = await D.trialOf('const game = { size: 4, setup(){ return {}; },\n view(s){ return s.a.b; } };');
        return out; });
      for (const id of ['lights', 'mole', 'snake', 'blank']) if (!/^[A-Z]/.test(S[id] || '')) bad.push('starter ' + id + ': ' + S[id]);
      if (S.title !== 'Lights Out' || !S.started) bad.push('the corner board plays ' + S.title + ', started ' + S.started);
      if (!/too long/.test(S.loop || '')) bad.push('an endless loop: ' + S.loop);
      if (!S.err || !S.err.error || S.err.line !== 2) bad.push('an error and its line: ' + JSON.stringify(S.err));
      // a real click on square (1, 1) of the framed Lights Out: exactly its cross flips
      const lit = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r), n = r.view.n;
        return r.view.colors.map(c => c === 0x6b4416 ? 1 : 0).join(''); });
      const at = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, n = D.RUN.get(L.c + '_' + L.r).view.n;
        for (let y = 100; y < innerHeight - 100; y += 5) for (let x = 100; x < innerWidth - 100; x += 5){ const b = D.uvAt(x, y);
          if (b && b.c === L.c && b.r === L.r && Math.abs(b.u * n - 1.5) < 0.15 && Math.abs(b.v * n - 1.5) < 0.15) return { x, y, n }; } return null; });
      if (!at) bad.push('no square (1, 1) on the screen');
      else {
        // (opened after another game the first click may only select the board: it is clicked again until one flips something)
        const l0 = await lit(); let l1 = l0;
        for (let k = 0; k < 3 && l1 === l0; k++){ await page.mouse.click(at.x, at.y); await frame(page, 900); l1 = await lit(); }
        const diff = [...l0].map((ch, i) => ch !== l1[i] ? i : -1).filter(i => i >= 0).join(',');
        const n = at.n, want = [1 + n, 1 + n - n, 1 + n - 1, 1 + n + 1, 1 + n + n].sort((a, b) => a - b).join(',');
        if (diff !== want) bad.push('a real click flipped ' + diff + ', not the cross ' + want);
      }
      // the sandbox has no network and no storage: a shared game reporting what it can reach, taken onto board (3, 0)
      const shared = await page.evaluate(async () => { const D = window.getFieldApp()._debug;
        await D.takeShared(3, 0, { s: "const game = { size: 3, setup(){ return { f: typeof fetch, x: typeof XMLHttpRequest, l: typeof localStorage, d: typeof document }; }, view(s){ return { status: [s.f, s.x, s.l, s.d].join(' ') }; } };" });
        await new Promise(r => setTimeout(r, 800)); D.recOf(3, 0); await new Promise(r => setTimeout(r, 800));
        const r = D.RUN.get('3_0'); return { status: r && r.view && r.view.status, kept: !!D.MINE.get('3_0') }; });
      if (shared.status !== 'undefined undefined undefined undefined' || !shared.kept) bad.push('the sandbox reaches: ' + JSON.stringify(shared));
      await page.evaluate(() => window.getFieldApp()._debug.fly(0, 0)); await drawn(page, 1500); await page.evaluate(() => window.__settle && window.__settle());
      // Change it… through the real box: the first reply breaks, goes back with its error, the second is kept
      await page.evaluate(() => { const D = window.getFieldApp()._debug; D.session('smoke-session'); const L = D.live; window.getFieldApp().onStatTap(L.c, L.r, 0); });
      await drawn(page, 300);
      await page.fill('#labAskBox textarea', 'make the lit squares gold gems');
      await page.click('#labAskBox button:has-text("Send to Claude")');
      await page.waitForFunction(() => /✓/.test(document.querySelector('#labAskBox').innerText) || /fails/.test(document.querySelector('#labAskBox').innerText), null, { timeout: 20000 }).catch(() => {});
      // (the new version starts in the sandbox a moment after it is kept; a slow runner reads it a little later)
      await page.waitForFunction(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r); return r && r.view && r.meta && r.meta.title === 'Gold Lights'; }, null, { timeout: 8000 }).catch(() => {});
      const C = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r), m = JSON.parse(localStorage.getItem('gamelab.mine') || '{}')[L.c + '_' + L.r];
        return { title: r && r.meta && r.meta.title, pieces: r && r.view && r.view.pieces.length, kept: m && m.v.length, cur: m && m.cur, box: document.querySelector('#labAskBox').innerText.slice(-120) }; });
      if (asked.length !== 2) bad.push(asked.length + ' requests, not 2 (one broken, one fixed)');
      else {
        if (!asked[0].stream || !/Lights Out/.test(asked[0].messages[0].content) || !/gold gems/.test(asked[0].messages[0].content)) bad.push('the first request did not carry the rules and the words');
        if (!/fails when tried/.test(asked[1].messages[2].content)) bad.push('the broken version did not go back with its error');
      }
      if (C.title !== 'Gold Lights' || C.pieces !== 8 || C.kept !== 2 || C.cur !== 1) bad.push('after the change: ' + JSON.stringify(C));
      const U = await page.evaluate(async () => { const D = window.getFieldApp()._debug, L = D.live; document.querySelector('#labAskBox button').closest('#labAskBox').hidden = true;
        window.getFieldApp().onStatTap(L.c, L.r, 1);
        for (let k = 0; k < 40; k++){ await new Promise(r => setTimeout(r, 200)); const r = D.RUN.get(L.c + '_' + L.r); if (r && r.meta && r.meta.title === 'Lights Out' && r.view) break; }
        const r = D.RUN.get(L.c + '_' + L.r); return r && r.meta && r.meta.title; });
      if (U !== 'Lights Out') bad.push('Undo went to ' + U);
      // Snake (board (1, 0)) waits for the player, then the real ArrowUp turns it up
      // (settled on board (1, 0), not a fixed 2.5 s (12 Nov 2026): with the page fresh and its frames seconds apart the flight had
      //  not begun 2.5 s on, the lab's board was still (0, 0) and the key went to Lights Out; the camera left four seconds later)
      await page.evaluate(() => window.getFieldApp()._debug.fly(1, 0)); await drawn(page, 500); await page.evaluate(() => window.__settle(1, 0));
      await page.waitForFunction(() => { const L = window.getFieldApp()._debug.live; return L && L.c === 1 && L.r === 0; }, null, { timeout: 30000 }).catch(() => {});
      const head = () => page.evaluate(() => { const r = window.getFieldApp()._debug.RUN.get('1_0'); return r && r.view && r.view.pieces[0] ? [r.view.pieces[0].x, r.view.pieces[0].y, r.view.over] : null; });
      const h0 = await head();
      await page.keyboard.press('ArrowUp');
      let h1 = null;                                   // (a slow runner's frames are far apart: wait for the first step up)
      // (the snake steps once a frame, and a frame can be seconds: up to a minute for the first, 12 Nov 2026)
      for (let k = 0; k < 600; k++){ await frame(page, 100); h1 = await head(); if (h1 && (h1[1] < 6.5 || h1[0] !== 5.5 || h1[2])) break; }
      if (!h0 || h0[0] !== 5.5 || h0[1] !== 6.5) bad.push('Snake did not wait: ' + JSON.stringify(h0));
      if (!h1 || !(h1[1] < 6.5) || h1[0] !== 5.5 || h1[2]) bad.push('the real ArrowUp did not turn the snake up: ' + JSON.stringify(h1));
    } catch (e){ bad.push(String(e)); }
    await page.unroute(/login\.tangent\.workers\.dev\/v1\/messages/).catch(() => {});
    if (bad.length) failures.push('[game lab] ' + bad.join('; '));
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} game lab: the starters run sandboxed (no network or storage, an endless loop stopped, an error's line named); a real click flips Lights Out's cross; Change it… sends the rules, fixes a broken reply once and keeps Claude's version; Undo; a shared game; Snake waits, then the real arrow turns it`);
  }
  // THE GAME LAB'S LOOP AND ITS NEW PARTS (Oct 26: "1,2": Claude sees what came before and a broken version is one tap from being
  // fixed; games get sounds, words on the board, drags and swipes, and pieces that glide): a game with all four put on board (2, 0);
  // its words drawn a letter a kind; a real click moving a piece that glides there and asking for a click; a real drag left read as
  // a swipe LEFT; the game broken in play (the real Z, then a real click on square (0, 0)), the row's first tile turned to Fix it,
  // and a tap on it sending the error and line back (the gateway mocked) and keeping the fixed version, which the next request's
  // history then names.
  {
    const before = failures.length, bad = [];
    const WORDS = `// words, swipes and sounds
const game = { title: 'Words', size: l => 5 + Math.ceil(l / 2),
  setup(level){ return { n: game.size(level), at: [1, 1], drags: 0, swipe: '' }; },
  tap(s, x, y){ s.at = [x, y]; sound('click'); },
  key(s, k){ if (k === 'z') s.armed = true; },
  bot(s){ return [(s.at[0] + 1) % s.n, 1]; },
  drag(s, x0, y0, x1, y1, done){ s.drags++; if (done){ const dx = x1 - x0, dy = y1 - y0; s.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'); sound('up'); } },
  view(s){ if (s.armed && s.at[0] === 0 && s.at[1] === 0) null.boom;
    const squares = []; for (let i = 0; i < s.n * s.n; i++) squares.push(i % 2 ? '#334455' : '#223344');
    return { squares, pieces: [{ shape: 'text', text: 'Hello 42', x: 3, y: 1, size: 0.9, color: '#ffdd55' },
      { shape: 'block', x: s.at[0] + 0.5, y: s.at[1] + 0.5, size: 0.8, color: '#ff5533', id: 'me', glide: 0.5 }],
      status: s.drags + ' drags ' + s.swipe }; } };`;
    const FIXED = WORDS.replace('if (s.armed && s.at[0] === 0 && s.at[1] === 0) null.boom;', '').replace("title: 'Words'", "title: 'Words fixed'");
    const asked = [];
    await page.route(/login\.tangent\.workers\.dev\/v1\/messages/, async route => {
      asked.push(JSON.parse(route.request().postData()));
      const text = 'It no longer breaks on the corner.\n```js\n' + FIXED + '\n```';
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' },
        body: 'event: a\ndata: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\nevent: b\ndata: {"type":"message_stop"}\n\n' });
    });
    try {
      const live = () => page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, r = L && D.RUN.get(L.c + '_' + L.r);
        return r ? { L, title: r.meta && r.meta.title, drags: r.meta && r.meta.drags, status: r.view && r.view.status, err: r.err, sounds: r.view && r.view.sounds.map(x => x[0]),
                     me: r.view && (r.view.pieces.find(p => p.id === 'me') || {}), anim: r.anim && r.anim.get('me') } : null; });
      await page.evaluate(async src => { const D = window.getFieldApp()._debug; await D.takeShared(2, 0, { s: src }); D.fly(2, 0); }, WORDS);
      /* THE CLICKS WAIT FOR THE CAMERA TO STOP (12 Nov 2026, the flaky check of "1,2,3,4,5,6"'s first: "a real click did not move
         the block", once on CI and again in a sandbox). The flight to board (2, 0) was given until the lab called the board its
         own and 1.2 s more; with frames far apart the camera was still gliding then (its x read 6.37, 6.45, 7.40 and 7.72 at the
         pixel's working out and the three clicks), so the pixel worked out for square (3, 2) was square 2, then 1, then 0 by the
         time each click landed, and the block went there. `__settle` waits until board (2, 0) is framed and the camera has not
         moved over four looks, as the checks that click squares do. */
      await drawn(page, 500); await page.evaluate(() => window.__settle(2, 0));
      await page.waitForFunction(() => { const D = window.getFieldApp()._debug, L = D.live, r = L && D.RUN.get(L.c + '_' + L.r); return L && L.c === 2 && L.r === 0 && r && r.view && r.meta && r.meta.title === 'Words'; }, null, { timeout: 30000 }).catch(() => {});
      await drawn(page, 1200);
      const sys = await page.evaluate(() => window.getFieldApp()._debug.LAB_SYS);
      if (!/sound\(kind, pitch, seconds\)/.test(sys) || !/shape: "text"/.test(sys) || !/game\.drag\(/.test(sys) || !/glide/.test(sys)) bad.push('the system prompt does not tell Claude about sound, text, drag and glide');
      const letters = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r);
        return D.itemsOf(r.view, r).filter(i => /^gch_\d+$/.test(i.kind)).map(i => String.fromCodePoint(+i.kind.slice(4))).join(''); });
      if (letters !== 'HELLO42') bad.push('the words were drawn as ' + JSON.stringify(letters));
      const at = (x, y) => page.evaluate(([x, y]) => { const D = window.getFieldApp()._debug, L = D.live; let best = null, bd = 1e9;
        for (let py = 80; py < innerHeight - 80; py += 5) for (let px = 80; px < innerWidth - 80; px += 5){ const b = D.uvAt(px, py);
          if (b && b.c === L.c && b.r === L.r){ const d = Math.hypot(b.u * 6 - x, b.v * 6 - y); if (d < bd){ bd = d; best = { x: px, y: py }; } } } return best; }, [x, y]);
      // a real click on square (3, 2), within the three squares a piece glides: the block glides there, and a click is asked for
      const t = await at(3.5, 2.5);
      let A = null;
      for (let k = 0; k < 3; k++){ await page.mouse.click(t.x, t.y); await frame(page, 700); A = await live(); if (A && A.me.x === 3.5) break; }
      if (!A || A.me.x !== 3.5 || A.me.y !== 2.5) bad.push('a real click did not move the block: ' + JSON.stringify(A && A.me));
      else {
        if (!A.anim || A.anim.d !== 0.5 || A.anim.x0 === A.anim.x1) bad.push('the block did not glide: ' + JSON.stringify(A.anim));
        if (!A.sounds.includes('click')) bad.push('the tap asked for no click: ' + JSON.stringify(A.sounds));
      }
      // a real drag from the right of the board to the left: moves sent, then a swipe LEFT on letting go
      const a = await at(4.6, 4.6), b = await at(1.4, 4.6);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      for (let k = 1; k <= 10; k++){ await page.mouse.move(a.x + (b.x - a.x) * k / 10, a.y + (b.y - a.y) * k / 10); await page.waitForTimeout(60); }
      await page.mouse.up();
      await page.waitForFunction(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r); return r && r.view && /LEFT|RIGHT|UP|DOWN/.test(r.view.status); }, null, { timeout: 5000 }).catch(() => {});
      const B = await live();
      if (!/^([2-9]|\d\d+) drags LEFT$/.test(B.status || '')) bad.push('a real drag left read as ' + JSON.stringify(B.status));
      if (B.me.x !== 3.5) bad.push('the drag was taken as a tap too: the block went to ' + B.me.x);
      // broken in play: the real Z, then a real click on (0, 0)
      await page.keyboard.press('z'); await drawn(page, 400);
      const z = await at(0.5, 0.5);
      for (let k = 0; k < 3; k++){ await page.mouse.click(z.x, z.y); await frame(page, 700); if ((await live()).err) break; }
      const C = await live();
      const tile = await page.evaluate(() => { const A = window.getFieldApp(), L = A._debug.live; return A.statTiles(L.c, L.r)[0].value; });
      if (!C.err) bad.push('the game did not break in play');
      if (tile !== 'Fix it') bad.push('the first tile of a broken game is ' + tile);
      await page.evaluate(() => { const A = window.getFieldApp(); A._debug.session('smoke-session'); const L = A._debug.live; A.onStatTap(L.c, L.r, 0); });
      await page.waitForFunction(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r); return r && r.meta && r.meta.title === 'Words fixed' && r.view; }, null, { timeout: 10000 }).catch(() => {});
      const F = await live();
      if (asked.length !== 1) bad.push(asked.length + ' requests for Fix it, not 1');
      else if (!/breaks while it is played: Cannot read/.test(asked[0].messages[0].content) || !/line 8/.test(asked[0].messages[0].content)) bad.push('Fix it did not send the error and its line: ' + asked[0].messages[0].content.slice(-200));
      if (F.title !== 'Words fixed' || F.err) bad.push('after Fix it: ' + JSON.stringify(F));
      const H = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live; return D.historyOf(L.c, L.r); });
      if (!/Fix it: Cannot read/.test(H) || !/no longer breaks/.test(H)) bad.push('the next request\'s history: ' + JSON.stringify(H));
      await page.evaluate(() => { const b = document.querySelector('#labAskBox'); if (b) b.hidden = true; });
    } catch (e){ bad.push(String(e)); }
    await page.unroute(/login\.tangent\.workers\.dev\/v1\/messages/).catch(() => {});
    if (bad.length) failures.push('[game lab loop] ' + bad.join('; '));
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} game lab: words drawn a letter at a time, a real click gliding a piece and asking for a sound, a real drag read as a swipe, a game broken in play fixed by the Fix it tile with its error and line, and the history sent with the next request`);
  }
  // THE GAME LAB'S OWN PLAYER (Oct 26: "1,2" of what came next: boards no one plays show the game being played, and a version is
  // played before it is kept): the starters pass the check and the blank board (no player), a game over at once, one where nothing
  // changes and a game to win its player never wins are refused; Change it… sends a reply with no player back to Claude and keeps
  // the next; a board no one plays moves through its recording; and a game won in one tap, by a real click, gets three stars
  // against its player's par of 1 move, kept as the board's best.
  {
    const before = failures.length, bad = [];
    const NOBOT = "const game = { title: 'No player', size: 3, setup(){ return { n: 0 }; }, tap(s){ s.n++; }, view(s){ return { squares: [s.n % 2 ? '#ff0000' : '#000000'], over: s.n > 3 }; } };";
    const WITH = "const game = { title: 'With player', size: l => l < 3 ? 3 : 4, setup(){ return { n: 0 }; }, tap(s){ s.n++; }, bot(s){ return [1, 1]; }, view(s){ return { squares: [s.n % 2 ? '#ff0000' : '#000000'], score: s.n, over: s.n > 3 }; } };";
    const asked = [];
    await page.route(/login\.tangent\.workers\.dev\/v1\/messages/, async route => {
      asked.push(JSON.parse(route.request().postData()));
      const text = (asked.length === 1 ? 'Here.\n```js\n' + NOBOT : 'With a player now.\n```js\n' + WITH) + '\n```';
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' },
        body: 'event: a\ndata: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\nevent: b\ndata: {"type":"message_stop"}\n\n' });
    });
    try {
      await page.evaluate(() => { localStorage.removeItem('gamelab.mine'); localStorage.removeItem('gamelab.best'); window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gamelab')); });
      await drawn(page, 2500);
      const K = await page.evaluate(async () => { const D = window.getFieldApp()._debug, out = {};
        for (const s of D.STARTERS){ const k = await D.checkOf(s.src); out[s.id] = k.ok ? 'ok' : k.why; }
        out.atOnce = (await D.checkOf("const game = { size: 3, setup(){ return {}; }, bot(){ return [0, 0]; }, view(){ return { over: true }; } };")).why;
        out.still = (await D.checkOf("const game = { size: 3, setup(){ return {}; }, tap(){}, bot(){ return [0, 0]; }, view(){ return { squares: [] }; } };")).why;
        out.nowin = (await D.checkOf("const game = { size: 3, wins: true, setup(){ return { n: 0 }; }, tap(s){ s.n++; }, bot(){ return [0, 0]; }, view(s){ return { squares: [s.n % 2 ? '#ff0000' : '#000000'], over: s.n > 5 }; } };")).why;
        return out; });
      // (Oct 26: "Add more starter games": every starter but the blank board, 2048, Gems, Pong, Maze and Connect Four among them)
      for (const id of ['lights', 'mole', 'snake', 'g2048', 'match', 'pong', 'maze', 'four']) if (K[id] !== 'ok') bad.push('the starter ' + id + ' failed its check: ' + K[id]);
      if (!/no game\.bot/.test(K.blank || '')) bad.push('the blank board passed with no player: ' + K.blank);
      if (!/over at once/.test(K.atOnce || '')) bad.push('a game over at once: ' + K.atOnce);
      if (!/nothing on the board ever changed/.test(K.still || '')) bad.push('a game where nothing changes: ' + K.still);
      if (!/never won it at level 1/.test(K.nowin || '')) bad.push('a game to win never won: ' + K.nowin);
      // Change it…: the reply with no player goes back, the next is kept
      await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug; D.session('smoke-session'); const L = D.live; A.onStatTap(L.c, L.r, 0); });
      await drawn(page, 300);
      await page.fill('#labAskBox textarea', 'count my taps');
      await page.click('#labAskBox button:has-text("Send to Claude")');
      await page.waitForFunction(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r); return r && r.meta && r.meta.title === 'With player'; }, null, { timeout: 15000 }).catch(() => {});
      const title = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r); return r && r.meta && r.meta.title; });
      if (asked.length !== 2 || !/no game\.bot/.test((asked[1] && asked[1].messages[2] && asked[1].messages[2].content) || '')) bad.push('the version with no player did not go back to Claude: ' + asked.length + ' requests');
      if (title !== 'With player') bad.push('the version with a player was not kept: ' + title);
      await page.evaluate(() => { const b = document.querySelector('#labAskBox'); if (b) b.hidden = true; });
      // a board no one plays moves through its own player's recording
      const idle = await page.evaluate(async () => { const A = window.getFieldApp(), D = A._debug, L = D.live;
        for (let k = 0; k < 40; k++){
          const ks = [...D.PLAYS.entries()].filter(([key, P]) => P.done && P.frames.length > 30 && key !== L.c + '_' + L.r);
          for (const [key] of ks){ const [c, r] = key.split('_').map(Number);
            const sig = () => JSON.stringify(A.cellItems(c, r).map(i => [i.kind, +i.u.toFixed(3), +i.v.toFixed(3)]));
            const a = sig(); await new Promise(res => setTimeout(res, 400)); if (sig() !== a) return { key, moved: true }; }
          await new Promise(res => setTimeout(res, 300));
        }
        return { boards: D.PLAYS.size, done: [...D.PLAYS.values()].filter(P => P.done).length }; });
      if (!idle.moved) bad.push('no board no one plays moved through its recording: ' + JSON.stringify(idle));
      // par and stars: a game won in one tap, its par 1 move, won by a real click
      const SRC = "const game = { title: 'One tap', size: 3, wins: true, setup(){ return { done: false }; }, tap(s){ s.done = true; }, bot(s){ return s.done ? null : [1, 1]; }, view(s){ return { squares: [], pieces: [], over: s.done, won: s.done, message: s.done ? 'Done.' : '' }; } };";
      await page.evaluate(async src => { const D = window.getFieldApp()._debug, L = D.live; await D.takeShared(L.c, L.r, { s: src }); }, SRC);
      await page.waitForFunction(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r), P = D.PLAYS.get(L.c + '_' + L.r);
        return r && r.meta && r.meta.title === 'One tap' && r.view && P && P.key === r.key && P.par; }, null, { timeout: 10000 }).catch(() => {});
      const par = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, P = D.PLAYS.get(L.c + '_' + L.r); return P && P.par; });
      if (!par || par.kind !== 'moves' || par.val !== 1) bad.push('the one-tap game\'s par: ' + JSON.stringify(par));
      const pt = await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live;
        for (let y = 120; y < innerHeight - 120; y += 6) for (let x = 120; x < innerWidth - 120; x += 6){ const b = D.uvAt(x, y); if (b && b.c === L.c && b.r === L.r && Math.abs(b.u - 0.5) < 0.06 && Math.abs(b.v - 0.5) < 0.06) return { x, y }; } return null; });
      if (!pt) bad.push('the framed board is not on the screen');
      else for (let k = 0; k < 3; k++){ await page.mouse.click(pt.x, pt.y); await frame(page, 900);
        if (await page.evaluate(() => { const D = window.getFieldApp()._debug, L = D.live, r = D.RUN.get(L.c + '_' + L.r); return r && r.view && r.view.over; })) break; }
      const S = await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug, L = D.live; return { best: JSON.parse(localStorage.getItem('gamelab.best') || '{}'), title: A.cellTitle(L.c, L.r) }; });
      if (!Object.values(S.best).includes(3) || !/best ★★★/.test(S.title)) bad.push('a win in par did not keep three stars: ' + JSON.stringify(S));
    } catch (e){ bad.push(String(e)); }
    await page.unroute(/login\.tangent\.workers\.dev\/v1\/messages/).catch(() => {});
    if (bad.length) failures.push('[game lab player] ' + bad.join('; '));
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} game lab: every game's own player checks it before it is kept (no player, over at once, nothing changing, never won all refused), plays the boards no one plays, and sets a par a real click's win is starred against`);
  }
  // THE GAME LAB, HARDER FARTHER OUT AND MY GAMES (Oct 26: "4,6"): its player plays level 5 too, and a game where level 5 is no
  // harder than level 1 goes back to Claude with the numbers, kept anyway after the last try; the starters climb; My games lists
  // every board changed, newest first, and a real click on Play flies to that board and makes it the one played.
  {
    const before = failures.length, bad = [];
    const FLAT = "const game = { title: 'Flat', size: 3, setup(){ return { n: 0 }; }, tap(s){ s.n++; }, bot(){ return [0, 0]; }, view(s){ return { squares: [s.n % 2 ? '#ff0000' : '#000000'], score: s.n, over: s.n > 5 }; } };";
    const asked = [];
    await page.route(/login\.tangent\.workers\.dev\/v1\/messages/, async route => {
      asked.push(JSON.parse(route.request().postData()));
      const text = 'The same at every level.\n```js\n' + FLAT + '\n```';
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' },
        body: 'event: a\ndata: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\nevent: b\ndata: {"type":"message_stop"}\n\n' });
    });
    try {
      await page.evaluate(() => { localStorage.removeItem('gamelab.mine'); window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gamelab')); });
      await drawn(page, 2500);
      const K = await page.evaluate(async src => { const D = window.getFieldApp()._debug, out = {};
        for (const s of D.STARTERS.slice(0, 3)){ const k = await D.checkOf(s.src); out[s.id] = k.ok ? k.note : 'NO ' + k.why; }
        out.flat = (await D.checkOf(src)).why; return out; }, FLAT);
      if (!/level 1: 4×4.*level 5: 7×7/.test(K.lights || '')) bad.push('Lights Out by level: ' + K.lights);
      for (const id of ['mole', 'snake']) if (/^NO /.test(K[id] || 'NO')) bad.push('the starter ' + id + ' did not climb: ' + K[id]);
      if (!/level 5 is no harder than level 1/.test(K.flat || '')) bad.push('a game the same at every level passed: ' + K.flat);
      // through the real box: sent back each time, then kept with a note
      await page.evaluate(() => { const A = window.getFieldApp(), D = A._debug; D.session('smoke-session'); const L = D.live; A.onStatTap(L.c, L.r, 0); });
      await drawn(page, 300);
      await page.fill('#labAskBox textarea', 'a tapping game');
      await page.click('#labAskBox button:has-text("Send to Claude")');
      await page.waitForFunction(() => /✓|fails/.test(document.querySelector('#labAskBox').innerText), null, { timeout: 30000 }).catch(() => {});
      const box = await page.evaluate(() => document.querySelector('#labAskBox').innerText);
      if (asked.length !== 3) bad.push(asked.length + ' requests for a game the same at every level, not 3');
      else if (!/no harder than level 1/.test(asked[1].messages[2].content)) bad.push('the levels did not go back to Claude: ' + asked[1].messages[2].content.slice(0, 160));
      if (!/plays the same farther out/.test(box)) bad.push('the last try was not kept with a note: ' + box.slice(-200));
      await page.evaluate(() => { const b = document.querySelector('#labAskBox'); if (b) b.hidden = true; });
      // My games: two more boards changed (clear of the board the flat game went on, the one the checks above left framed),
      // listed newest first; a real click on Play goes there
      await page.evaluate(async () => { const D = window.getFieldApp()._debug;
        await D.takeShared(6, 3, { s: "const game = { title: 'Alpha', size: 3, setup(){ return {}; }, view(){ return {}; } };" });
        await new Promise(r => setTimeout(r, 20));
        await D.takeShared(4, 1, { s: "const game = { title: 'Beta', size: 3, setup(){ return {}; }, view(){ return {}; } };" }); });
      await page.evaluate(() => { const A = window.getFieldApp(), L = A._debug.live; A.onStatTap(L.c, L.r, 6); });
      await drawn(page, 400);
      const rows = await page.evaluate(() => [...document.querySelectorAll('#labMineBox .labMineRow')].map(e => [e.dataset.k, e.innerText.split('\n')[0]]));
      // (boards changed by the checks above are listed too: the newest two first, the flat game among the rest)
      if (rows.length < 3 || rows[0][0] !== '4_1' || !/Beta/.test(rows[0][1]) || rows[1][0] !== '6_3' || !/Alpha/.test(rows[1][1]) || !rows.some(x => /Flat/.test(x[1]))) bad.push('My games listed ' + JSON.stringify(rows));
      await page.click('#labMineBox .labMineRow[data-k="4_1"] button:has-text("Play")');
      await drawn(page, 2500);
      const W = await page.evaluate(() => { const D = window.getFieldApp()._debug; let f = null; try { f = window.framedCell ? window.framedCell() : null; } catch {} return { live: D.live, hidden: document.querySelector('#labMineBox').hidden }; });
      if (!W.live || W.live.c !== 4 || W.live.r !== 1 || !W.hidden) bad.push('Play did not go to the board: ' + JSON.stringify(W));
    } catch (e){ bad.push(String(e)); }
    await page.unroute(/login\.tangent\.workers\.dev\/v1\/messages/).catch(() => {});
    if (bad.length) failures.push('[game lab levels] ' + bad.join('; '));
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} game lab: level 5 measured against level 1 (the starters climb, a flat game goes back to Claude and is kept with a note after the last try), and My games lists the boards changed with a real Play going there`);
  }


  // SUDOKU (Nov 7: "lets build a new game based our experice with the other games"): every board its own puzzle at a level by its
  // ring (a 6×6, then four 9×9s that want more and more of what a person knows), each with one answer the human solver finds
  // without a guess; the rules by hand (givens fixed, pencil marks, a digit clearing its peers' notes, undo, a wrong digit and a hint
  // as faults, the stars); real clicks on a square and a digit, the keys and the play pad; quick real touches on one digit; a board
  // no one plays solves itself.
  {
    current = 'sudoku';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'sudoku')));
    await drawn(page, 1500);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = { bad: [] }, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      out.sizes = [1, 2, 3, 4, 5].map(lv => D.makePuzzle(1234, lv).N);
      const mean = [0, 0, 0, 0, 0, 0], grade = [0, 0, 0, 0, 0, 0], K = 6, t0 = performance.now();
      for (let lv = 1; lv <= 5; lv++) for (let k = 0; k < K; k++){
        const idx = 50 + k * 97, P = D.makePuzzle(idx, lv), N = P.N, geom = D.suGeom(N), empty = P.givens.filter(g => !g).length;
        const validSol = geom.units.every(U => new Set(U.map(i => P.sol[i])).size === N) && P.sol.every(d => d >= 1 && d <= N);
        const rt = D.suRate(N, P.givens);
        const ok = validSol && P.givens.every((g, i) => !g || g === P.sol[i]) && D.suSolve(N, P.givens, 2).count === 1
          && rt.solved && rt.steps.length === empty && rt.steps.every(s => s.d === P.sol[s.i]) && rt.level === P.level
          && P.order.length === empty && P.order.every(s => !P.givens[s.i] && s.d === P.sol[s.i]) && N === D.LV[lv - 1].N
          && P.level >= D.LV[lv - 1].grade[0] && P.level <= D.LV[lv - 1].grade[1];
        if (!ok) out.bad.push({ lv, idx, level: P.level, count: P.count, solved: rt.solved });
        mean[lv] += P.count / K; grade[lv] += P.level / K;
      }
      out.ms = Math.round(performance.now() - t0);
      out.givens = mean.slice(1).map(x => +x.toFixed(1)); out.grade = grade.slice(1).map(x => +x.toFixed(1));
      // (the 9×9s: fewer givens and a harder grade at every level)
      out.climbs = out.givens[1] > out.givens[2] && out.givens[2] > out.givens[3] && out.givens[3] > out.givens[4] && out.grade[1] < out.grade[2] && out.grade[2] < out.grade[3] && out.grade[3] < out.grade[4];
      // the solvers on known grids: a classic has one answer and the people's steps finish it; an empty 4×4 has many; a grid breaking its own rules none
      const classic = Uint8Array.from('530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number));
      out.classic = { count: D.suSolve(9, classic, 3).count, rated: D.suRate(9, classic).solved };
      out.many = D.suSolve(4, new Uint8Array(16), 5).count;
      const broken = new Uint8Array(81); broken[0] = 5; broken[1] = 5;
      out.broken = D.suSolve(9, broken, 2).count;
      // a board made a few milliseconds at a time (as one only looked at is) is the board made whole
      const a = D.makePuzzle(1000, 5), b = D.makePaced(1000, 5, 2);
      out.paced = { same: same([...a.givens], [...b.P.givens]) && same([...a.sol], [...b.P.sol]), calls: b.calls };
      out.sameBoard = same([...D.makePuzzle(777, 3).givens], [...D.makePuzzle(777, 3).givens]);
      out.differ = !same([...D.makePuzzle(777, 3).givens], [...D.makePuzzle(778, 3).givens]);
      // the rules by hand
      const g = D.fresh(0, 0); D.GAMES.set('0_0', g);
      const P = g.P, N = P.N, G = D.suGeom(N), empt = [...P.givens.keys()].filter(i => !P.givens[i]), e0 = empt[0];
      const gi = P.givens.findIndex(x => x); D.select(g, gi);
      out.givenLocked = D.enter(g, 1, true) === false && D.erase(g, true) === false && g.v[gi] === P.givens[gi];
      D.select(g, e0); g.pencil = true; D.enter(g, 1, true); D.enter(g, 2, true); g.pencil = false;
      const peer = empt.find(i => i !== e0 && G.peers[e0].includes(i)), d0 = P.sol[e0];
      D.select(g, peer); g.pencil = true; D.enter(g, d0, true); g.pencil = false;
      D.select(g, e0); D.enter(g, d0, true);
      out.peerNotes = g.v[e0] === d0 && g.notes[e0] === 0 && !(g.notes[peer] >> (d0 - 1) & 1) && g.wrong === 0;
      D.undo(g, true);
      out.undo = g.v[e0] === 0 && g.notes[e0] === 3 && (g.notes[peer] >> (d0 - 1) & 1) === 1;
      const wd = d0 % N + 1; D.enter(g, wd, true);
      out.wrong = g.v[e0] === wd && g.wrong === 1;
      const h = D.hintOf(g);
      out.hintWrong = h.kind === 'wrong' && h.i === e0 && h.d === d0;
      D.hint(g, true); out.h1 = g.hints === 1 && g.sel === e0 && g.hint && g.hint.kind === 'wrong' && g.v[e0] === wd;
      D.hint(g, true); out.h2 = g.hints === 2 && g.v[e0] === d0 && !g.hint;
      for (const i of empt) D.put(g, i, P.sol[i], true);
      out.solved = { state: g.state, stars: g.stars, faults: D.faults(g) };
      const g2 = D.fresh(0, 0), h2 = D.hintOf(g2);
      out.stepHint = h2.kind === 'step' && h2.d === g2.P.sol[h2.i] && !g2.P.givens[h2.i] && h2.tech >= 1;
      out.stars = [0, 1, 2, 3, 6].map(D.starsOf);
      D.GAMES.delete('0_0');
      // (Nov 7: "#1 is not center aligned") a digit's ink stands in the middle of its column: a 1 is two strokes at its glyph's right edge, so its piece is shifted back
      const Ps = D.puzzleFor(3, 1), Vs = D.shownView(Ps, 0), cols = new Set([...Array(Ps.N).keys()].map(c => ((1 + c + 0.5) / Ps.M).toFixed(9)));
      const dg = D.itemsOf(Ps, Vs, null, false, 400).filter(it => /^skD\d$/.test(it.kind) && it.v > 1.5 / Ps.M);
      out.ink = dg.some(it => it.kind === 'skD1') && dg.every(it => cols.has(it.u.toFixed(9)));
      return out;
    });
    const ok1 = r.levels.join() === '2,3,5,5' && r.sizes.join() === '6,9,9,9,9' && r.ink && !r.bad.length && r.climbs && r.classic.count === 1 && r.classic.rated && r.many === 5 && r.broken === 0
      && r.paced.same && r.paced.calls > 1 && r.sameBoard && r.differ && r.givenLocked && r.peerNotes && r.undo && r.wrong && r.hintWrong && r.h1 && r.h2
      && r.solved.state === 'solved' && r.solved.stars === 1 && r.solved.faults === 3 && r.stepHint && r.stars.join() === '3,2,2,1,1';
    if (!ok1) failures.push('[sudoku] puzzles and rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} sudoku: 6×6 then 9×9s, 30 sampled puzzles each with one answer the human solver finds (${r.ms} ms; givens ${r.givens.join('/')}, grade ${r.grade.join('/')}), the rules, hints and stars`);
    // real input on the framed board: a click on a square and a digit, the keys, the play pad, a puzzle finished by a real click
    await page.evaluate(() => window.getFieldApp()._debug.fly(3, 1));
    await page.evaluate(() => window.__settle(3, 1));     // (the camera at rest on the board: a click while it still glides lands a row off)
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const key = fc[0] + '_' + fc[1];
      // (where to click: projected from the square's middle, and only once the camera has really come to rest there: on the screen, reading back as
      //  the same square, and in the same place 300 ms later. A frame can take seconds in the software renderer, and a camera that looks still
      //  between two frames is only between them)
      const aimOnce = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        const x = (pv.x + 1) / 2 * innerWidth, y = (1 - pv.y) / 2 * innerHeight, q = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? W.uvAt(x, y) : null;
        return { x, y, ok: !!q && Math.abs(q.u - u) < 0.03 && Math.abs(q.v - v) < 0.03 }; }, [u, v]);
      const aimAt = async (u, v) => { let p = null; for (let k = 0; k < 120; k++){ p = await aimOnce(u, v); if (p.ok){ await frame(page, 300); const p2 = await aimOnce(u, v); if (p2.ok && Math.abs(p2.x - p.x) < 1 && Math.abs(p2.y - p.y) < 1) return p2; } await frame(page, 500); } return p; };
      const info = await page.evaluate(([c, r, k]) => { const D = window.getFieldApp()._debug, g = D.fresh(c, r); D.GAMES.set(k, g); D.LIVE = { c, r }; const P = g.P;
        return { N: P.N, sol: [...P.sol], giv: [...P.givens], cen: [...P.sol.keys()].map(i => D.centreOf(P, i)), dig: [...Array(P.N).keys()].map(d => D.digitAt(P, d + 1)) }; }, [...fc, key]);
      const st = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return { v: [...g.v], sel: g.sel, state: g.state, wrong: g.wrong, hints: g.hints, pencil: g.pencil, notes: [...g.notes] }; }, key);
      const click = async ([u, v]) => { const p = await aimAt(u, v); await page.mouse.click(p.x, p.y); await drawn(page, 150); };
      // (a frame can take a second in the software renderer, and a press is read in the frame after it: each step waits for what it wants to see, up to 6 s)
      const until = async test => { for (let k = 0; k < 60; k++){ const s = await st(); if (test(s)) return true; await frame(page, 100); } return false; };
      const empties = info.giv.map((g, i) => g ? -1 : i).filter(i => i >= 0), [e0, e1, e2] = empties, N = info.N, last = empties[empties.length - 1];
      real = {};
      await click(info.cen[e0]); real.sel = await until(s => s.sel === e0);
      await click(info.dig[info.sol[e0] - 1]); real.placed = await until(s => s.v[e0] === info.sol[e0]);
      const gi = info.giv.findIndex(x => x); await click(info.cen[gi]); await until(s => s.sel === gi); await click(info.dig[0]); await drawn(page, 600); real.givenKept = (await st()).v[gi] === info.giv[gi];
      await click(info.cen[e1]); await until(s => s.sel === e1); const wd = info.sol[e1] % N + 1; await click(info.dig[wd - 1]); real.wrong = await until(s => s.v[e1] === wd && s.wrong === 1);
      await click(info.dig[wd - 1]); real.erased = await until(s => s.v[e1] === 0);
      await page.keyboard.press(String(info.sol[e1])); real.key = await until(s => s.v[e1] === info.sol[e1]);
      await page.keyboard.press('Backspace'); real.bs = await until(s => s.v[e1] === 0);
      await page.keyboard.press('z'); real.undo = await until(s => s.v[e1] === info.sol[e1]);
      const before = (await st()).sel; await page.keyboard.press('ArrowRight'); await until(s => s.sel !== before); const after = (await st()).sel;
      real.arrow = after !== before && Math.abs(((after / N) | 0) - ((before / N) | 0)) + Math.abs(after % N - before % N) === 1;
      real.pad = (await page.evaluate(() => [...document.querySelectorAll('#playPad button')].map(b => b.dataset.key))).join();
      await page.click('#playPad button[data-key="notes"]'); real.pencil = await until(s => s.pencil);
      await click(info.cen[e2]); await until(s => s.sel === e2); await click(info.dig[0]); await until(s => s.notes[e2] === 1); await click(info.dig[1]); real.notes = await until(s => s.notes[e2] === 3);
      await page.click('#playPad button[data-key="notes"]'); real.pencilOff = await until(s => !s.pencil);
      await page.click('#playPad button[data-key="hint"]'); real.hint = await until(s => s.hints === 1);
      // the whole puzzle but its last square by the model, the last by a real click on the square and a real click on the digit
      await page.evaluate(([k, last]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k);
        for (let i = 0; i < g.v.length; i++) if (!g.P.givens[i] && i !== last) D.put(g, i, g.P.sol[i], true);
        g.hint = null; g.sel = -1; g.ver++; }, [key, last]);
      await click(info.cen[last]); await until(s => s.sel === last); await click(info.dig[info.sol[last] - 1]);
      real.solved = (await until(s => s.state === 'solved')) ? 'solved' : (await st()).state;
      await click(info.cen[0]);
      real.again = { live: true, state: 'ready' };
      real.again.state = await page.evaluate(async ([k, c, r]) => { for (let q = 0; q < 60; q++){ const D = window.getFieldApp()._debug, g = D.GAMES.get(k); if (g && g.state === 'ready') return 'ready'; await new Promise(ok => setTimeout(ok, 100)); } return D.GAMES.get(k).state; }, [key, ...fc]);
      real.again.live = await page.evaluate(([c, r]) => { const L = window.getFieldApp()._debug.LIVE; return !!L && L.c === c && L.r === r; }, fc);
    }
    const ok2 = real && real.sel && real.placed && real.givenKept && real.wrong && real.erased && real.key && real.bs && real.undo && real.arrow && real.pad === 'notes,erase,undo,hint'
      && real.pencil && real.notes && real.pencilOff && real.hint && real.solved === 'solved' && real.again.live && real.again.state === 'ready';
    if (!ok2) failures.push('[sudoku] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} sudoku: real clicks select a square and put a digit in (a given stays), the same digit again takes it out, the keys, arrows and the play pad work, a real click finishes it and another starts it again`);
    // (Oct 15, Simon's lesson) quick real touches on one digit with a square selected are each a tap: in, out, in, out, and the view never reframed
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const quick = await page.evaluate(async () => {
      const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (u, v) => { const T = W.target, bW = W.boardW(), L = window.LAB || {}; const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0.02, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const tap = async (u, v, after) => { const p = S(u, v); ptr('pointerdown', p); const t = mk(p); fire('touchstart', t); ptr('pointerup', p); fire('touchend', t); await wait(after); };
      const g = D.fresh(f.c, f.r); D.GAMES.set(f.c + '_' + f.r, g); D.LIVE = { c: f.c, r: f.r };
      const i = g.P.givens.findIndex(x => !x), d = g.P.sol[i], seen = [];
      const [cu, cv2] = D.centreOf(g.P, i), [du, dv] = D.digitAt(g.P, d);
      await tap(cu, cv2, 200);
      for (let k = 0; k < 4; k++){ await tap(du, dv, 200); seen.push(g.v[i]); }
      const f2 = W.cellAt(W.target.boardX, W.target.boardZ);
      return { seen, d, still: !!f2 && f2.c === f.c && f2.r === f.r, noDbl: window.getFieldApp().noDoubleTap() };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const ok3 = quick.seen.join() === [quick.d, 0, quick.d, 0].join() && quick.still && quick.noDbl;
    if (!ok3) failures.push('[sudoku] quick taps on one digit: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} sudoku: four quick real touches on one digit are four taps (${quick.seen.join(', ')})`);
    // a board no one plays solves itself: over one cycle of its clock every digit of the solver's order is seen going in, the whole
    // grid is held, the puzzle comes back to its givens, and on the page's own clock it moves
    const demo = await page.evaluate(async () => { const D = window.getFieldApp()._debug, P = D.puzzleFor(9, 9), T = D.cycleOf(P), seen = new Set(), counts = new Set();
      let solved = false, blank = false;
      for (let k = 0; k < 600; k++){ const V = D.shownView(P, 1000 + T * k / 600); seen.add(V.m); counts.add(V.v.filter(x => x).length); solved = solved || (V.solved && V.v.every((x, i) => x === P.sol[i])); blank = blank || V.v.every((x, i) => x === P.givens[i]); }
      const live = new Set(), t0 = performance.now();
      // (sampled until it has moved three times, up to a whole cycle: a few seconds on the page's clock can fall wholly in the rest at either end of it)
      while (performance.now() - t0 < T * 1000 + 1500 && live.size < 3){ live.add(D.shownView(P).stamp); await new Promise(ok => setTimeout(ok, 150)); }
      return { stages: seen.size, steps: P.order.length, counts: counts.size, solved, blank, live: live.size }; });
    const ok4 = demo.stages >= demo.steps && demo.counts > demo.steps * 0.8 && demo.solved && demo.blank && demo.live >= 3;
    if (!ok4) failures.push('[sudoku] a board no one plays: ' + JSON.stringify(demo));
    console.log(`${ok4 ? 'ok  ' : 'FAIL'} sudoku: a board no one plays solves itself (${demo.stages} stages for ${demo.steps} digits, ${demo.live} seen live)`);
  }


  // MISSILE COMMAND, THE LOOK (Nov 7: "Missle command uses bad animations. It should be a beautiful game with explosions and effects
  // from the other games"): the game's rules are as they were; what a board draws is new. A burst's ball is exactly as big as what it
  // can destroy and never strobes; a launch, a burst and an impact each leave their effects, worked out from how long ago and a seed
  // (so the same snapshot is always the same picture); an impact scorches the ground and burns on in the ruin; the barrel turns to
  // its target; the score is lit in the sky; the sky is a picture (four of them, 24 a field) with stars, a moon, skylines and a
  // cratered ground; a real click starts a game and the next one fires.
  {
    current = 'missile command look';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'missilecommand')));
    await drawn(page, 1500);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = {}, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const kinds = items => { const k = {}; for (const it of items) k[it.kind] = (k[it.kind] || 0) + 1; return k; };
      // a game played by the computer: the effects it leaves are recorded, and the snapshot draws them
      const g = D.newGame(); g.state = 'play'; g.lv = 'normal'; D.games.set('t_t', g);
      const seen = new Set(), all = {}; let maxItems = 0, shotsSeen = false, foesSeen = false;
      for (let i = 0; i < 50 * 30; i++){
        D.step(g, 1 / 30, true);
        if (i % 3 === 0){ const s = D.snap(g), it = D.asItems(s); maxItems = Math.max(maxItems, it.length); for (const e of s.fx) seen.add(e[0]); for (const k of Object.keys(kinds(it))) all[k] = 1; shotsSeen = shotsSeen || s.shots.length > 0; foesSeen = foesSeen || s.foes.length > 0; }
      }
      out.played = { score: g.score, wave: g.wave, fx: [...seen].sort().join(''), maxItems, shotsSeen, foesSeen };
      out.kinds = ['mcHead', 'mcGlow', 'mcStreak', 'mcPuff', 'mcFire', 'mcRing', 'mcSpark', 'mcAmmo', 'mcCity', 'mcMound', 'mcBar', 'mcPip', 'mcD0'].filter(k => !all[k]);
      // a burst is as big as it can destroy, at every age, and goes out
      const big = (e, mine) => { const o = []; D.burstFx(o, 0.5, 0.4, e, 12345, mine); return o.filter(it => it.kind === 'mcFire' && it.lift === 0.004).map(it => it.scale); };
      out.size = [0.1, 0.3, 0.5, 0.65, 0.9, 1.1].every(e => big(e, 1).length === 1 && Math.abs(big(e, 1)[0] - 2 * D.blastR(e)) < 1e-12) && big(1.25, 1).length === 0 && big(1.25, 0).length === 0;
      // (no strobe: the colour of the ball changes a little between two frames, never by half its range)
      const colAt = e => { const o = []; D.burstFx(o, 0.5, 0.4, e, 777, 0); return o.find(it => it.kind === 'mcFire' && it.lift === 0.004).color; };
      let worst = 0; for (let e = 0.05; e < 1.1; e += 1 / 60){ const a = colAt(e), b = colAt(e + 1 / 60); for (const sh of [16, 8, 0]) worst = Math.max(worst, Math.abs(((a >> sh) & 255) - ((b >> sh) & 255))); }
      out.smooth = worst;
      // yours blue-white, the enemy's yellow to red
      const hot = (mine) => { const o = []; D.burstFx(o, 0.5, 0.4, 0.6, 99, mine); return o.find(it => it.kind === 'mcFire' && it.lift === 0.004).color; };
      out.hues = { mine: hot(1) & 255, foe: hot(0) & 255 };
      out.hueOk = (hot(1) & 255) > ((hot(1) >> 16) & 255) && ((hot(0) >> 16) & 255) > (hot(0) & 255);
      // the same snapshot is the same picture; another seed another
      const snap = D.snap(g);
      out.again = same(D.asItems(snap), D.asItems(snap));
      const a1 = [], a2 = []; D.burstFx(a1, 0.5, 0.4, 0.3, 1, 0); D.burstFx(a2, 0.5, 0.4, 0.3, 2, 0);
      out.seeds = !same(a1, a2);
      // a launch, an impact on a city, an impact on a base: the ruin, the scorch and the fire
      const h = D.newGame(); h.state = 'play'; h.lv = 'normal'; h.wave = 1; h.queue = 0; h.pause = 99;
      D.fire(h, 0.1, 0.3);
      const fired = h.fx.some(e => e.k === 'l') && h.shots.length === 1 && h.bases[0].ammo === 9 && Math.abs(h.bases[0].aim - Math.atan2(0.3 - (0.9 - 0.02), 0.1 - 0.06)) < 1e-9;
      const barYaw = D.asItems(D.snap(h)).filter(it => it.kind === 'mcBar').map(it => it.yaw);
      out.barrel = fired && barYaw.length === 3 && Math.abs(barYaw[0] - h.bases[0].aim) < 1e-9 && Math.abs(barYaw[1] - (-Math.PI / 2)) < 1e-9;
      h.shots.length = 0; h.t = 5;
      D.impact(h, 0.35); D.impact(h, 0.5); D.impact(h, 0.6);
      out.ruin = h.cities[2] === 0 && h.cities.filter(x => x).length === 5 && h.ruin[2] === 5 && !h.bases[1].up && h.bases[1].ammo === 0 && h.ruin[7] === 5 && h.ruin[0] === -1 && h.scars.length === 3 && h.fx.filter(e => e.k === 'i').length === 3;
      h.t = 8;
      const it3 = D.asItems(D.snap(h)), near = it3.filter(it => Math.abs(it.u - 0.35) < 0.03);
      out.burning = { fire: near.some(it => it.kind === 'mcFire'), smoke: near.some(it => it.kind === 'mcPuff'), ruin: it3.some(it => it.kind === 'mcRuin' && it.u === 0.35), scorch: it3.filter(it => it.kind === 'mcScorch').length === 6,
                      noCity: !it3.some(it => it.kind === 'mcCity' && it.u === 0.35) };
      // (the fire dies down as the ruin ages: fewer flames after twenty seconds)
      h.t = 40; const late = D.asItems(D.snap(h)).filter(it => Math.abs(it.u - 0.35) < 0.03 && it.kind === 'mcFire').length;
      out.dying = late < near.filter(it => it.kind === 'mcFire').length;
      // the score lit in the sky, a pip a wave
      h.score = 1250; h.wave = 4; const hud = D.asItems(D.snap(h));
      out.hud = hud.filter(it => /^mcD\d$/.test(it.kind) && it.v === 0.055).map(it => it.kind.slice(3)).join('') === '001250' && hud.filter(it => it.kind === 'mcPip').length === 4;
      D.games.delete('t_t');
      // a recording carries all of it
      const reel = D.bakeReel(0x3c11), f = reel[reel.length - 1];
      out.reel = { n: reel.length, hasFx: Array.isArray(f.fx), hasScars: Array.isArray(f.scars), hasRuin: f.ruin.length === 9, score: typeof f.score === 'number', wave: f.wave };
      return out;
    });
    const ok1 = !r.kinds.length && r.played.score > 0 && r.played.fx === 'bl' && r.played.shotsSeen && r.played.foesSeen && r.played.maxItems > 100 && r.size && r.smooth < 90 && r.hueOk && r.again && r.seeds
      && r.barrel && r.ruin && r.burning.fire && r.burning.smoke && r.burning.ruin && r.burning.scorch && r.burning.noCity && r.dying && r.hud
      && r.reel.n === 1800 && r.reel.hasFx && r.reel.hasScars && r.reel.hasRuin && r.reel.score && r.reel.wave >= 1;
    if (!ok1) failures.push('[missile command look] effects: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} missile command: a burst is as big as it can destroy and never strobes, launches, bursts and impacts leave their effects, an impact scorches the ground and the ruin burns on, the barrel turns to its target, the score is lit in the sky (${r.played.maxItems} pieces at the busiest)`);
    // the picture a board hangs: four skies by a board's number, big and small, stars and a moon and skylines over a cratered ground
    const pic = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = { keys: [] };
      const hi = D.PIC.canvas(D.photoKey(0, 0, 600)), lo = D.PIC.canvas(D.photoKey(0, 0, 100));
      out.sizes = [hi.width, lo.width];
      out.keys = [D.photoKey(0, 0, 600), D.photoKey(0, 0, 100), D.photoKey(1, 0, 600), D.photoKey(24, 0, 600), D.photoKey(0, 24, 600)];
      const luma = (cv, u, v) => { const S = cv.width, d = cv.getContext('2d').getImageData(Math.round(S - S * u) - 1, Math.round(S - S * v) - 1, 3, 3).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; return s / 9; };
      out.luma = { top: luma(hi, 0.5, 0.04), haze: luma(hi, 0.5, 0.885), ground: luma(hi, 0.5, 0.97) };
      // stars: bright pixels in the high sky; windows and the haze: warm pixels in the skyline's band
      const px = (cv, v0, v1) => { const S = cv.width, y0 = Math.round(S - S * v1), y1 = Math.round(S - S * v0), d = cv.getContext('2d').getImageData(0, y0, S, y1 - y0).data; let bright = 0, warm = 0; for (let i = 0; i < d.length; i += 4){ if (d[i] > 190 && d[i + 1] > 190 && d[i + 2] > 190) bright++; if (d[i] > 200 && d[i + 1] > 170 && d[i + 2] < 190) warm++; } return { bright, warm }; };
      out.stars = px(hi, 0.02, 0.6).bright; out.windows = px(hi, 0.82, 0.9).warm;
      out.skies = [0, 1, 2, 3].map(k => { const cv = D.paint({ k, pal: k }, false), S = cv.width, d = cv.getContext('2d').getImageData(S >> 1, Math.round(S - S * 0.85), 1, 1).data; return [d[0], d[1], d[2]].join(','); });
      return out;
    });
    const ok2 = pic.sizes.join() === '512,256' && pic.keys[0] !== pic.keys[1] && pic.keys[0] !== pic.keys[2] && pic.keys[0] === pic.keys[3].replace('mc0', 'mc0') && pic.keys[3] === pic.keys[0] && pic.keys[4] === pic.keys[0]
      && pic.luma.haze > pic.luma.top + 15 && pic.luma.ground < pic.luma.haze && pic.stars > 25 && pic.windows > 15 && new Set(pic.skies).size === 4;
    if (!ok2) failures.push('[missile command look] the picture: ' + JSON.stringify(pic));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} missile command: the sky is a picture (${pic.sizes.join(' and ')} px, 24 of them a field, four skies; ${pic.stars} bright stars, ${pic.windows} lit windows, a haze at the horizon over a darker ground)`);
    // real input: a click on the framed board starts a game and the next one fires from the nearest bunker
    await page.evaluate(() => { const A = window.getFieldApp(); A._debug.games.clear(); window.gotoCell ? window.gotoCell(3, 1) : A.onSelect(3, 1); });
    await page.evaluate(() => window.__settle(3, 1));
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const aimOnce = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        const x = (pv.x + 1) / 2 * innerWidth, y = (1 - pv.y) / 2 * innerHeight, q = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? W.uvAt(x, y) : null;
        return { x, y, ok: !!q && Math.abs(q.u - u) < 0.03 && Math.abs(q.v - v) < 0.03 }; }, [u, v]);
      const aimAt = async (u, v) => { let p = null; for (let k = 0; k < 120; k++){ p = await aimOnce(u, v); if (p.ok){ await frame(page, 300); const p2 = await aimOnce(u, v); if (p2.ok && Math.abs(p2.x - p.x) < 1 && Math.abs(p2.y - p.y) < 1) return p2; } await frame(page, 500); } return p; };
      // (the game on a board is the recording's moment taken over, so its missiles are whatever that moment had: the check is the change a click makes)
      const gs = () => page.evaluate(k => { const g = window.getFieldApp()._debug.games.get(k); return g ? { state: g.state, ammo: g.bases.map(b => b.ammo), aim: g.bases.map(b => b.aim) } : null; }, fc.join('_'));
      const until = async test => { for (let k = 0; k < 80; k++){ const s = await gs(); if (s && test(s)) return s; await frame(page, 100); } return await gs(); };
      real = { before: await gs() };
      let p = await aimAt(0.5, 0.4); await page.mouse.click(p.x, p.y);
      real.started = await until(s => s.state === 'play');
      // (the game on a board is the recording's moment taken over, and the recording's player overlooks a missile now and then, so at some
      //  moments the nearest bunker is already destroyed and empty, which sends the next shot from another: CI failed once with bunker 0 at
      //  ammo 0, and so did a local run. Every bunker is made whole and filled, so the check is about the nearest one)
      await page.evaluate(k => { const g = window.getFieldApp()._debug.games.get(k); if (g) g.bases.forEach(b => { b.up = true; if (b.ammo < 6) b.ammo = 6; }); }, fc.join('_'));
      real.started = await gs();
      const left = real.started.ammo[0], total = real.started.ammo.reduce((a, b) => a + b, 0);
      p = await aimAt(0.2, 0.4); await page.mouse.click(p.x, p.y);
      real.fired = await until(s => s.ammo[0] === left - 1 || s.ammo.reduce((a, b) => a + b, 0) < total);
      real.left = left; real.total = total;
    }
    const ok3 = real && real.started && real.started.state === 'play' && real.fired && real.fired.ammo[0] === real.left - 1 && Math.abs(real.fired.aim[0] + Math.PI / 2) > 0.05 && real.fired.aim[0] > -Math.PI / 2;
    if (!ok3) failures.push('[missile command look] real input: ' + JSON.stringify(real));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} missile command: a real click starts the game and the next fires from the nearest bunker (its barrel turns to the target)`);
  }

  // HASHI (Nov 7: "what next game should we add", then "hashi"): every board its own sea of islands at a level by its ring (7, 9, 11, 13 and 15
  // squares a side), each with one answer the human solver finds and a grade in its level's band; the solver on small known puzzles (one
  // answer, two, none); the rules by hand (a pair goes none, one, two, none; a bridge across another refused; a bridge the answer lacks a
  // fault; erase, undo, hints, stars); a hint's step sound from any state of a game; real clicks on islands and on the sea between them, a real
  // drag from island to island, the keys and the play pad; quick real touches; a board no one plays lays its own bridges.
  {
    current = 'hashi';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'hashi')));
    await drawn(page, 1500);
    const r = await page.evaluate(() => {
      const D = window.getFieldApp()._debug, out = { bad: [] }, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      out.levels = [[0, 0], [10, 0], [40, 40], [200, 3]].map(([c, r]) => D.levelOf(c, r));
      out.sizes = [1, 2, 3, 4, 5].map(lv => D.makePuzzle(1234, lv).N);
      const isl = [0, 0, 0, 0, 0, 0], grade = [0, 0, 0, 0, 0, 0], K = 6, t0 = performance.now();
      for (let lv = 1; lv <= 5; lv++) for (let k = 0; k < K; k++){
        const idx = 50 + k * 97, P = D.makePuzzle(idx, lv), G = P.G, E = P.E, sum = P.sol.reduce((a, x) => a + x, 0);
        const sums = P.isl.map((s, i) => G.by[i].reduce((a, e) => a + P.sol[e], 0)), p = [...P.isl.keys()];
        const find = x => { while (p[x] !== x) x = p[x] = p[p[x]]; return x; };
        E.forEach((X, e) => { if (P.sol[e]) p[find(X.a)] = find(X.b); });
        const rt = D.hsRate(G, P.n, 5), D5 = D.LV[lv - 1];
        const ok = sums.every((s, i) => s === P.n[i]) && P.sol.every(x => x >= 0 && x <= 2) && E.every((X, e) => !P.sol[e] || X.cross.every(f => !P.sol[f]))
          && P.isl.every((s, i) => find(i) === find(0)) && D.hsSolve(G, P.n, 2).count === 1 && rt.solved && rt.level === P.level && same([...rt.lo], [...P.sol])
          && P.order.length === sum && P.order.every((s, j) => s.v >= 1 && s.v <= P.sol[s.e]) && P.N === D5.N && P.K >= D5.K[0] && P.K <= D5.K[1]
          && P.level >= D5.grade[0] && P.level <= D5.grade[1] && P.miss === 0;
        if (!ok) out.bad.push({ lv, idx, level: P.level, miss: P.miss, solved: rt.solved });
        isl[lv] += P.K / K; grade[lv] += P.level / K;
      }
      out.ms = Math.round(performance.now() - t0);
      out.isl = isl.slice(1).map(x => +x.toFixed(1)); out.grade = grade.slice(1).map(x => +x.toFixed(1));
      // (a bigger sea and a harder grade at every level)
      out.climbs = out.isl[0] < out.isl[1] && out.isl[1] < out.isl[2] && out.isl[2] < out.isl[3] && out.isl[3] < out.isl[4]
        && out.grade[0] <= out.grade[1] && out.grade[1] <= out.grade[2] && out.grade[2] <= out.grade[3] && out.grade[3] <= out.grade[4];
      // the solvers on small known puzzles: a ring of four 2s has one answer, four 3s two (one pair double, the other single, either way round), four 1s
      // in two rows none (each answer leaves two groups); two pairs crossing are told so
      const corners = n => [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }].map(s => ({ ...s, n }));
      out.ring = [2, 3, 1].map(n => D.hsSolve(D.hsGraph(5, corners(n)), [n, n, n, n], 5).count);
      const X = D.hsGraph(5, [{ x: 0, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 4 }]);
      out.cross = { edges: X.E.length, crossed: X.E[0].cross.length === 1 && X.E[1].cross.length === 1 && X.E[0].cross[0] === 1, one: D.hsSolve(X, [1, 1, 1, 1], 5).count };
      const side = D.hsGraph(4, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }]);       // (islands side by side are no pair: a bridge needs a square to lie on)
      out.side = side.E.length === 1 && side.E[0].cells.length === 1;
      // a board made a few milliseconds at a time (as one only looked at is) is the board made whole
      const a = D.makePuzzle(1000, 5), b = D.makePaced(1000, 5, 2);
      out.paced = { same: same([...a.sol], [...b.P.sol]) && same(a.isl, b.P.isl), calls: b.calls };
      out.sameBoard = same(D.makePuzzle(777, 3).isl, D.makePuzzle(777, 3).isl);
      out.differ = !same(D.makePuzzle(777, 3).isl, D.makePuzzle(778, 3).isl);
      // the rules by hand, on the first board that has a bridge the answer lays across a line some other pair would use
      let cc = 0, g = null, cr = null;
      for (; cc < 40 && !cr; cc++){ g = D.fresh(cc, 0); const P = g.P; P.E.forEach((X, e) => { if (!cr && P.sol[e] === 1 && X.cross.length) cr = { e, f: X.cross[0] }; }); }
      D.GAMES.set((cc - 1) + '_0', g);
      const P = g.P, E = P.E, e0 = cr.e, f0 = cr.f;
      D.cycle(g, e0, true); const b1 = g.b[e0]; D.cycle(g, e0, true); const b2 = g.b[e0], w2 = g.wrong; D.cycle(g, e0, true);
      out.cycle = [b1, b2, g.b[e0], w2].join();       // 1,2,0 and the second bridge a fault (the answer has one)
      D.undo(g, true); const u1 = g.b[e0]; D.undo(g, true); const u2 = g.b[e0]; D.undo(g, true);
      out.undo = [u1, u2, g.b[e0]].join();            // 2,1,0
      D.setBridge(g, e0, 1, true);
      out.refused = D.cycle(g, f0, true) === false && g.b[f0] === 0 && D.blockedB(P, g.b, f0);
      const n0 = g.undo.length; D.undo(g, true);
      out.undoLast = g.b[e0] === 0 && g.undo.length === n0 - 1;
      const w0 = g.wrong, zero = E.findIndex((X, e) => !P.sol[e] && !D.blockedB(P, g.b, e));
      D.setBridge(g, zero, 1, true);
      out.wrong = g.wrong === w0 + 1 && g.b[zero] === 1;
      const h = D.hintOf(g);
      out.hintWrong = h.kind === 'wrong' && h.e === zero && h.v === 0;
      const hs0 = g.hints;
      D.hint(g, true); out.h1 = g.hints === hs0 + 1 && g.hint && g.hint.kind === 'wrong' && g.b[zero] === 1;
      D.hint(g, true); out.h2 = g.hints === hs0 + 2 && g.b[zero] === 0 && !g.hint;
      // erase takes every bridge off the selected island, as one move, and undo puts them back
      for (let e = 0; e < E.length; e++) if (P.sol[e]) D.setBridge(g, e, 1, true);
      D.setBridge(g, zero, 0, true);
      const hub = P.isl.findIndex((s, i) => P.G.by[i].filter(e => g.b[e]).length >= 2), had = P.G.by[hub].map(e => g.b[e]);
      D.select(g, hub);
      const n1 = g.undo.length; D.erase(g, true);
      out.erase = P.G.by[hub].every(e => g.b[e] === 0) && g.undo.length === n1 + 1;
      D.undo(g, true); out.eraseUndo = same(P.G.by[hub].map(e => g.b[e]), had);
      D.GAMES.delete((cc - 1) + '_0');
      // finishing: every bridge as the answer has it
      const g3 = D.fresh(cc - 1, 0); D.GAMES.set((cc - 1) + '_0', g3);
      E.forEach((X, e) => { if (P.sol[e]) D.setBridge(g3, e, P.sol[e], true); });
      out.solved = { state: g3.state, stars: g3.stars, faults: D.faults(g3), best: D.BEST.has(P.idx + '@' + P.lv) };
      out.stars = [0, 1, 2, 3, 6].map(D.starsOf);
      D.GAMES.delete((cc - 1) + '_0');
      // a hint's step is always sound: from any state a player could have reached (a prefix of the solver's own order), the pair it lights is one
      // the answer still wants, one bridge more than the game has
      const sound = { n: 0, bad: [] };
      for (let lv = 1; lv <= 5; lv++) for (let k = 0; k < 3; k++){
        const Q = D.makePuzzle(300 + k * 41, lv), gq = { P: Q, b: new Uint8Array(Q.E.length) };     // (hintOf asks only the puzzle and the bridges)
        for (const frac of [0, 0.35, 0.7]){
          gq.b.fill(0); for (let j = 0; j < Math.floor(Q.order.length * frac); j++) gq.b[Q.order[j].e] = Q.order[j].v;
          const hq = D.hintOf(gq); sound.n++;
          if (!hq || hq.kind !== 'step' || hq.v !== gq.b[hq.e] + 1 || hq.v > Q.sol[hq.e]) sound.bad.push({ lv, frac, kind: hq && hq.kind, level: Q.level });
        }
      }
      out.sound = sound;
      // (Nov 7: "#1 is not center aligned") every island's number stands in the middle of its island: a 1 is two strokes at its glyph's right edge,
      // so its piece is shifted back by 0.19 of its height
      const Pn = D.puzzleFor(3, 1), Vn = D.shownView(Pn, 0), nums = D.itemsOf(Pn, Vn, null, false, 400).filter(it => /^hsD\d$/.test(it.kind) && it.lift > 0.0025);
      const mid = new Set(Pn.isl.map((s, i) => D.islC(Pn, i).map(x => x.toFixed(9)).join()));
      out.ink = nums.length === Pn.K && Pn.n.includes(1) && nums.every(it => mid.has([it.u, it.v].map(x => x.toFixed(9)).join()));
      return out;
    });
    const ok1 = r.levels.join() === '2,3,5,5' && r.sizes.join() === '7,9,11,13,15' && !r.bad.length && r.climbs && r.ring.join() === '1,2,0' && r.cross.edges === 2 && r.cross.crossed && r.cross.one === 0 && r.side
      && r.paced.same && r.paced.calls > 1 && r.sameBoard && r.differ && r.cycle === '1,2,0,1' && r.undo === '2,1,0' && r.refused && r.undoLast && r.wrong && r.hintWrong && r.h1 && r.h2
      && r.erase && r.eraseUndo && r.solved.state === 'solved' && r.solved.stars === 3 && r.solved.faults === 0 && r.solved.best && r.stars.join() === '3,2,2,1,1' && r.sound.bad.length === 0 && r.ink;
    if (!ok1) failures.push('[hashi] puzzles and rules: ' + JSON.stringify(r));
    console.log(`${ok1 ? 'ok  ' : 'FAIL'} hashi: seas of 7 to 15 squares, 30 sampled puzzles each with one answer the human solver finds (${r.ms} ms; islands ${r.isl.join('/')}, grade ${r.grade.join('/')}), the solver on known puzzles, the rules, hints and stars`);
    // real input on the framed board: a click on an island and the next, a click on the sea between them, the keys, the play pad, a real drag
    // from island to island, a puzzle finished by real clicks
    await page.evaluate(() => window.getFieldApp()._debug.fly(3, 1));
    await page.evaluate(() => window.__settle(3, 1));     // (the camera at rest on the board: a click while it still glides lands a row off)
    const fc = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, f = W.cellAt(T.boardX, T.boardZ); return f ? [f.c, f.r] : null; });
    let real = null;
    if (fc){
      const key = fc[0] + '_' + fc[1];
      // (where to click: projected from the square's middle, and only once the camera has really come to rest there: on the screen, reading back as
      //  the same square, and in the same place 300 ms later. A frame can take seconds in the software renderer, and a camera that looks still
      //  between two frames is only between them)
      const aimOnce = (u, v) => page.evaluate(([u, v]) => { const W = window.FIELD_WORLD, T = W.target, bW = W.boardW(), L = window.LAB || {};
        const pv = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera);
        const x = (pv.x + 1) / 2 * innerWidth, y = (1 - pv.y) / 2 * innerHeight, q = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? W.uvAt(x, y) : null;
        return { x, y, ok: !!q && Math.abs(q.u - u) < 0.03 && Math.abs(q.v - v) < 0.03 }; }, [u, v]);
      const aimAt = async (u, v) => { let p = null; for (let k = 0; k < 120; k++){ p = await aimOnce(u, v); if (p.ok){ await frame(page, 300); const p2 = await aimOnce(u, v); if (p2.ok && Math.abs(p2.x - p.x) < 1 && Math.abs(p2.y - p.y) < 1) return p2; } await frame(page, 500); } return p; };
      // a board with a path of three islands (two pairs the answer bridges once, sharing an island) and a pair whose middle square is clear of any crossing line
      const info = await page.evaluate(([c, r, k]) => { const D = window.getFieldApp()._debug, g = D.fresh(c, r); D.GAMES.set(k, g); D.LIVE = { c, r }; const P = g.P, E = P.E, N = P.N;
        const mid = e => { const cs = E[e].cells, cell = cs[Math.floor(cs.length / 2)]; return { cell, cross: P.G.eH[cell] >= 0 && P.G.eV[cell] >= 0, at: D.centre(P, cell % N, (cell / N) | 0) }; };
        const ones = E.map((X, e) => e).filter(e => P.sol[e] >= 1 && !mid(e).cross);
        let path = null;
        for (const e1 of ones){ for (const e2 of ones) if (e1 !== e2){ const A = E[e1], B = E[e2], sh = [A.a, A.b].find(i => i === B.a || i === B.b);
          if (sh != null){ const a = A.a === sh ? A.b : A.a, c2 = B.a === sh ? B.b : B.a; if (a !== c2){ path = { e1, e2, a, b: sh, c: c2 }; break; } } } if (path) break; }
        const ed = ones[0];
        return { N, K: P.K, sol: [...P.sol], path, pair: { e: ed, a: E[ed].a, b: E[ed].b }, midU: mid(ed).at, isl: P.isl.map((s, i) => D.islC(P, i)), midOf: E.map((X, e) => mid(e).at), E: E.map(X => [X.a, X.b]), needs: [...P.sol.keys()].filter(e => P.sol[e]) }; }, [...fc, key]);
      const st = () => page.evaluate(k => { const g = window.getFieldApp()._debug.GAMES.get(k); return { b: [...g.b], sel: g.sel, state: g.state, wrong: g.wrong, hints: g.hints, undo: g.undo.length }; }, key);
      const click = async ([u, v]) => { const p = await aimAt(u, v); await page.mouse.click(p.x, p.y); await drawn(page, 150); };
      // (a frame can take a second in the software renderer, and a press is read in the frame after it: each step waits for what it wants to see, up to 6 s)
      const until = async test => { for (let k = 0; k < 60; k++){ const s = await st(); if (test(s)) return true; await frame(page, 100); } return false; };
      const { e: ep, a: pa, b: pb } = info.pair;
      real = {};
      await click(info.isl[pa]); real.sel = await until(s => s.sel === pa);
      await click(info.isl[pb]); real.bridge = await until(s => s.b[ep] === 1 && s.sel === pb);
      await click(info.midU); real.second = await until(s => s.b[ep] === 2);
      await click(info.midU); real.none = await until(s => s.b[ep] === 0);
      await click(info.midU); real.again = await until(s => s.b[ep] === 1);
      // a click on the sea clears the selection; a click on an island that is no neighbour moves it
      await click(info.isl[pa]); await until(s => s.sel === pa);
      const far = [...info.isl.keys()].find(i => i !== pa && i !== pb && !info.E.some(([x, y]) => (x === pa && y === i) || (y === pa && x === i)));
      await click(info.isl[far]); real.moved = await until(s => s.sel === far && s.b.reduce((a, x) => a + x, 0) === 1);
      // the keys: an arrow selects the neighbour that way (the screen's way), Shift with it lays the bridge, Backspace takes an island's bridges off, z takes them back
      await page.evaluate(([k, i]) => { const g = window.getFieldApp()._debug.GAMES.get(k); window.getFieldApp()._debug.select(g, i); }, [key, pa]);
      const before = (await st()).sel;
      for (const kk of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']){ await page.keyboard.press(kk); if ((await st()).sel !== before) break; await frame(page, 150); }
      real.arrow = await until(s => s.sel !== before && s.sel >= 0);
      const selNow = (await st()).sel;
      await page.evaluate(([k, i]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k); D.select(g, i); }, [key, pa]);
      await page.keyboard.press('Backspace'); real.bs = await until(s => s.b[ep] === 0);
      await page.keyboard.press('z'); real.undo = await until(s => s.b[ep] === 1);
      real.pad = (await page.evaluate(() => [...document.querySelectorAll('#playPad button')].map(b => b.dataset.key))).join();
      await page.click('#playPad button[data-key="erase"]'); real.erase = await until(s => s.b[ep] === 0);
      await page.click('#playPad button[data-key="undo"]'); real.padUndo = await until(s => s.b[ep] === 1);
      await page.click('#playPad button[data-key="hint"]'); real.hint = await until(s => s.hints === 1);
      // a real drag from island to island, on to the next: one drag lays two bridges (a clean board, the path's islands in a line of the finger's way)
      await page.evaluate(([k, c, r]) => { const D = window.getFieldApp()._debug; D.GAMES.set(k, D.fresh(c, r)); D.LIVE = { c, r }; }, [key, ...fc]);
      const { e1, e2, a, b, c: c3 } = info.path;
      const A = await aimAt(...info.isl[a]), B = await aimOnce(...info.isl[b]), C = await aimOnce(...info.isl[c3]);
      await page.mouse.move(A.x, A.y); await page.mouse.down();
      for (let k = 1; k <= 12; k++){ await page.mouse.move(A.x + (B.x - A.x) * k / 12, A.y + (B.y - A.y) * k / 12); await page.waitForTimeout(40); }
      for (let k = 1; k <= 12; k++){ await page.mouse.move(B.x + (C.x - B.x) * k / 12, B.y + (C.y - B.y) * k / 12); await page.waitForTimeout(40); }
      await page.mouse.up();
      real.drag = await until(s => s.b[e1] === 1 && s.b[e2] === 1 && s.b.reduce((x, y) => x + y, 0) === 2);
      // the whole puzzle but its last pair by the model, the last by a real click on each island
      const lastE = info.needs.filter(e => info.sol[e] === 1).pop();
      await page.evaluate(([k, last]) => { const D = window.getFieldApp()._debug, g = D.GAMES.get(k);
        for (let e = 0; e < g.b.length; e++) if (g.P.sol[e] && e !== last) D.setBridge(g, e, g.P.sol[e], true);
        g.hint = null; g.sel = -1; g.ver++; }, [key, lastE]);
      await click(info.isl[info.E[lastE][0]]); await until(s => s.sel === info.E[lastE][0]); await click(info.isl[info.E[lastE][1]]);
      real.solved = (await until(s => s.state === 'solved')) ? 'solved' : (await st()).state;
      await click(info.isl[0]);
      real.restart = { live: true, state: 'ready' };
      real.restart.state = await page.evaluate(async ([k, c, r]) => { for (let q = 0; q < 60; q++){ const D = window.getFieldApp()._debug, g = D.GAMES.get(k); if (g && g.state === 'ready') return 'ready'; await new Promise(ok => setTimeout(ok, 100)); } return D.GAMES.get(k).state; }, [key, ...fc]);
      real.restart.live = await page.evaluate(([c, r]) => { const L = window.getFieldApp()._debug.LIVE; return !!L && L.c === c && L.r === r; }, fc);
    }
    const ok2 = real && real.sel && real.bridge && real.second && real.none && real.again && real.moved && real.arrow && real.bs && real.undo && real.pad === 'erase,undo,hint'
      && real.erase && real.padUndo && real.hint && real.drag && real.solved === 'solved' && real.restart.live && real.restart.state === 'ready';
    if (!ok2) failures.push('[hashi] real input: ' + JSON.stringify(real));
    console.log(`${ok2 ? 'ok  ' : 'FAIL'} hashi: real clicks select an island and bridge it to the next, the sea between them steps the pair, a real drag lays two bridges, the keys and the play pad work, a real click finishes it and another starts it again`);
    // (Oct 15, Simon's lesson) quick real touches alternating between two islands are each a tap: select, one bridge, two, none, and the view never reframed
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const quick = await page.evaluate(async () => {
      const D = window.getFieldApp()._debug, W = window.FIELD_WORLD, f = W.cellAt(W.target.boardX, W.target.boardZ);
      const S = (u, v) => { const T = W.target, bW = W.boardW(), L = window.LAB || {}; const p = new W.THREE.Vector3(T.boardX + (0.5 - u) * bW * (L.cellW || 1), 0.02, T.boardZ + (0.5 - v) * bW * (L.cellH || 1)).project(W.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
      const cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
      const mk = ([x, y]) => new Touch({ identifier: 9, target: cv, clientX: x, clientY: y, radiusX: 4, radiusY: 4 });
      const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      const ptr = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, isPrimary: true, clientX: x, clientY: y }));
      const tap = async (u, v, after) => { const p = S(u, v); ptr('pointerdown', p); const t = mk(p); fire('touchstart', t); ptr('pointerup', p); fire('touchend', t); await wait(after); };
      const g = D.fresh(f.c, f.r); D.GAMES.set(f.c + '_' + f.r, g); D.LIVE = { c: f.c, r: f.r };
      const P = g.P, e = P.E.findIndex((X, e) => P.sol[e] === 2) >= 0 ? P.E.findIndex((X, e) => P.sol[e] === 2) : P.E.findIndex((X, e) => P.sol[e] === 1), X = P.E[e], seen = [];
      const [au, av] = D.islC(P, X.a), [bu, bv] = D.islC(P, X.b);
      await tap(au, av, 200); seen.push(g.b[e]);
      await tap(bu, bv, 200); seen.push(g.b[e]);
      await tap(au, av, 200); seen.push(g.b[e]);
      await tap(bu, bv, 200); seen.push(g.b[e]);
      const f2 = W.cellAt(W.target.boardX, W.target.boardZ);
      return { seen, still: !!f2 && f2.c === f.c && f2.r === f.r, noDbl: window.getFieldApp().noDoubleTap() };
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const ok3 = quick.seen.join() === '0,1,2,0' && quick.still && quick.noDbl;
    if (!ok3) failures.push('[hashi] quick taps between two islands: ' + JSON.stringify(quick));
    console.log(`${ok3 ? 'ok  ' : 'FAIL'} hashi: four quick real touches alternating between two islands are four taps (${quick.seen.join(', ')})`);
    // a board no one plays lays its own bridges: over one cycle of its clock every bridge of the solver's order is seen going in, the finished
    // sea is held, the puzzle comes back to bare islands, and on the page's own clock it moves
    const demo = await page.evaluate(async () => { const D = window.getFieldApp()._debug, P = D.puzzleFor(9, 9), T = D.cycleOf(P), seen = new Set(), counts = new Set();
      let solved = false, blank = false;
      for (let k = 0; k < 600; k++){ const V = D.shownView(P, 1000 + T * k / 600); seen.add(V.m); counts.add(V.b.reduce((a, x) => a + x, 0)); solved = solved || (V.solved && V.b.every((x, i) => x === P.sol[i])); blank = blank || V.b.every(x => !x); }
      const live = new Set(), t0 = performance.now();
      // (sampled until it has moved three times, up to a whole cycle: a few seconds on the page's clock can fall wholly in the rest at either end of it)
      while (performance.now() - t0 < T * 1000 + 1500 && live.size < 3){ live.add(D.shownView(P).stamp); await new Promise(ok => setTimeout(ok, 150)); }
      return { stages: seen.size, steps: P.order.length, counts: counts.size, solved, blank, live: live.size }; });
    const ok4 = demo.stages >= demo.steps && demo.counts > demo.steps * 0.8 && demo.solved && demo.blank && demo.live >= 3;
    if (!ok4) failures.push('[hashi] a board no one plays: ' + JSON.stringify(demo));
    console.log(`${ok4 ? 'ok  ' : 'FAIL'} hashi: a board no one plays lays its own bridges (${demo.stages} stages for ${demo.steps} bridges, ${demo.live} seen live)`);
  }

} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
