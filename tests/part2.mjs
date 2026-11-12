// Smoke test, part 2 of 7: the editors in the row (chess positions, tower defense maps, Sokoban levels, the board games' positions), share links and the
// puzzle makers.
//
//   node tests/part2.mjs            this part alone (LIBS_DIR, BASE_URL, SETTLE_MS and CHROMIUM_PATH as for npm test)
//   SHARD=2/7 node tests/smoke.mjs  the same, by the runner
//   npm test                        every part, then the course test
//
// Cut from tests/smoke.mjs (12 Nov 2026) as it stood: the checks and their comments are unchanged. What every part
// needs (the server, the browser, the page loaded, the failures and how a run ends) is tests/harness.mjs.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { begin, timeLimit } from './harness.mjs';

let current = 'page load';
const T = await begin(2, () => current);
const { base, browser, page, failures } = T;

try {
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
      /* (then the default framing, the 0 key, and still again: the view left by opening the row could hold the board at 90 px,
         low on the screen, and on CI its every square fell under the open row, so no square could be clicked, Oct 17) */
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true })); await window.__settle(E.c, E.r);
      const n = E.g.n;
      /* (the first empty square away from the edges that is on the canvas: twice on CI the one asked for fell above the screen,
         and once the Sokoban check's below it, in a view turned about, Oct 13) */
      const pick = () => { for (let row = 2; row < n - 2; row++) for (let col = 2; col < n - 2; col++){ const i = row * n + col; if (E.g.towers[i]) continue; const v = window.__aim(n, col, row); if (v.ok) return { ...v, i }; } return null; };
      let v = pick();
      if (!v){ D.fly(E.c, E.r); await window.__settle(E.c, E.r); v = pick(); }
      if (!v){   // (what lies where the board's middle is, for a failure)
        const pv = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera), x = (pv.x + 1) / 2 * innerWidth, y = (1 - pv.y) / 2 * innerHeight, el = document.elementFromPoint(x, y);
        return { aimed: false, n, view: { yaw: W.st.yaw, pitch: W.st.pitch, zoom: W.st.zoom }, middle: [Math.round(x), Math.round(y)], under: el && (el.tagName + '#' + el.id),
                 framed: T.shown && W.cellAt(T.boardX, T.boardZ), ed: [E.c, E.r], settle: window.__lastSettle };
      }
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
      /* (then the default framing, the 0 key, and still again: the view left by opening the row could hold the board at 90 px,
         low on the screen, and on CI its every square fell under the open row, so no square could be clicked, Oct 17) */
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true })); await window.__settle(E.c, E.r);
      const n = E.L.n, V = n - 2, L0 = E.L;
      /* (the first empty square that is on the canvas: twice on CI the far row's square fell below the screen, at the foot of a
         view turned about, under the bottom row, Oct 13) */
      const free = i => !L0.wall[i] && L0.player !== i && !(L0.boxes || []).includes(i) && !(L0.goal && L0.goal[i]) && !((L0.goals || []).includes && (L0.goals || []).includes(i));
      const pick = () => { for (let row = 0; row < V; row++) for (let col = 0; col < V; col++){ const i = (row + 1) * n + col + 1; if (!free(i)) continue; const v = window.__aim(V, col, row); if (v.ok) return { ...v, i }; } return null; };
      let v = pick();
      if (!v){ D.fly(E.c, E.r); await window.__settle(E.c, E.r); v = pick(); }
      if (!v){   // (what lies where the board's middle is, for a failure)
        const pv = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera), x = (pv.x + 1) / 2 * innerWidth, y = (1 - pv.y) / 2 * innerHeight, el = document.elementFromPoint(x, y);
        return { aimed: false, n, view: { yaw: W.st.yaw, pitch: W.st.pitch, zoom: W.st.zoom }, middle: [Math.round(x), Math.round(y)], under: el && (el.tagName + '#' + el.id),
                 framed: T.shown && W.cellAt(T.boardX, T.boardZ), ed: [E.c, E.r], settle: window.__lastSettle };
      }
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
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage(); await timeLimit(pg);
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
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage(); await timeLimit(pg);
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
} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
