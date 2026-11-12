// Smoke test, part 6 of 7: the bottom row (the dots, a hold, a double tap), the gallery and its readers (EPUB, Markdown, JSON), loading and buckets.
//
//   node tests/part6.mjs            this part alone (LIBS_DIR, BASE_URL, SETTLE_MS and CHROMIUM_PATH as for npm test)
//   SHARD=6/7 node tests/smoke.mjs  the same, by the runner
//   npm test                        every part, then the course test
//
// Cut from tests/smoke.mjs (12 Nov 2026) as it stood: the checks and their comments are unchanged. What every part
// needs (the server, the browser, the page loaded, the failures and how a run ends) is tests/harness.mjs.

import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { begin, SETTLE_MS, frame, held, drawn } from './harness.mjs';

let current = 'page load';
const T = await begin(6, () => current);
const { page, failures, cdp } = T;

try {
  // THE DOTS SHUT THE ROW, AND A HOLD TOGGLES IT (Oct 23: "I can't close the bottom panel by tapping the dots.     long press the
  // display should toggle the visiblibility of the bottom panel."): in trick shots, whose play row stays up while a table is played,
  // a real click on the dots shuts it and it stays shut; a real long press on the table opens it and another shuts it; and in
  // Simon a long press toggles the row instead of starting the board again.
  {
    const before = failures.length, out = {};
    const shown = () => page.evaluate(() => { const b = document.body; return !b.classList.contains('bb-collapsed'); });
    // (a hold is decided a frame after its time is up, and on a loaded CI runner that frame can come later than the fixed 900 ms this waited
    //  after the press let go: found once, the row toggled after it was read, twice over. It waits for the switch it is to flip)
    /* THE PRESS IS HELD UNTIL THE PAGE HAS DRAWN A FRAME PAST THE HOLD'S TIME (12 Nov 2026: "1,2,3,4,5,6", the first "Games: fix
       the flaky checks and move to the newer browser"). A hold is decided a frame after its 600 ms are up (`_holdTok`), and
       letting go before that frame takes it back. The press was held 1.4 s by the wall; this check is the part's first, the page
       fresh, and with Playwright 1.63.0's Chromium the software renderer's first frames of trick shots are seconds each (measured
       in a sandbox: the hold's timer fired 600 ms after the press, the frame it then asked for came 10.9 s later, 10 s after the
       press had let go), so the row was not toggled, on CI every time. `held` is the hold a person makes, until the page has
       seen it: 700 ms, then the next frame (asked for after the hold's own, so it runs after it), and never less than the 1.4 s
       it was; a minute at most, should no frame come. */
    /* …AND THE ROW IS READ A FRAME ON. The hold flips the field's switch; the page's class, which `shown` reads, follows on the
       next frame (`syncBrowserVisibility`). With the press held as above the first hold did flip the switch, and the class came
       13.6 s later, past the 8 s this waited: read as not opened, and the second hold, which then shut it, as not shut. So the
       wait for the switch is counted in frames, twelve at most (each a fifth of a second at least, a minute at most). */
    const hold = async (read = shown) => { const p = await page.evaluate(() => ({ x: innerWidth * 0.45, y: innerHeight * 0.4 })); await page.mouse.move(p.x, p.y);
      const was = await read(); await page.mouse.down();
      await held(page); await page.mouse.up(); await drawn(page, 900);
      for (let k = 0; k < 12 && (await read()) === was; k++) await frame(page); };
    try {
      await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.id === 'trickshots'); window.setFieldApp(A); const D = A._debug, [c, r] = D.cellOfIdx(1); D.GAMES.clear(); D.fly(c, r); D.LIVE = { c, r }; D.gameAt(c, r); });
      // (settled, not a fixed 3 s: in a part of its own the page is fresh and its frames slow, and a hold during the flight was a pan)
      await drawn(page, 500); await page.evaluate(() => window.__settle());
      if (!(await shown())){ await page.click('#bbHandle'); await drawn(page, 800); }
      out.up = await shown();
      await page.evaluate(() => document.getElementById('bbHandle').click()); await drawn(page, 1500);   // (the dots are hidden while the row is open, Nov 1: the click is made on the element itself; a long press shuts it by hand)
      out.shut = !(await shown());
      await hold(); out.heldOpen = await shown();
      await hold(); out.heldShut = !(await shown());
      await page.evaluate(() => { const A = window.FIELD_APPS.find(a => a.id === 'simon'); window.setFieldApp(A); });
      await drawn(page, 2500);
      // (Simon's row is empty, so it is drawn shut either way: the field's own switch is read)
      const vis = () => page.evaluate(() => window.tvf.bottomRow.visible);
      const s0 = await vis(); await hold(vis); out.simon = { before: s0, after: await vis() };
      // (Oct 25: "Long press is always toggle of bottom browser"): in Minesweeper, a game under way, a hold flips the switch and
      // plants no flag; with Taps: flag (the real F) a real click on a covered square plants one. (Oct 25, later: "minesweeper should
      // restore the long press, its fundemental to its game play."): a real hold on a covered square flags it and leaves the switch
      // alone; one on an open square flips the switch.
      await page.evaluate(() => { localStorage.removeItem('minesweeper.taps'); const A = window.FIELD_APPS.find(a => a.name === 'minesweeper'); window.setFieldApp(A); });
      await drawn(page, 2500);
      const P = await page.evaluate(() => ({ x: innerWidth * 0.45, y: innerHeight * 0.4 }));
      const playing = () => page.evaluate(() => { let n = 0; window.getFieldApp()._debug.games.forEach(g => { if (g.state === 'play') n++; }); return n; });
      for (let k = 0; k < 3 && !(await playing()); k++){ await page.mouse.click(P.x, P.y); await frame(page, 900); }   // (the first may only select)
      // (the row is empty, so it is drawn shut and a hold always opens it: the switch is put off first)
      await page.evaluate(() => { window.tvf.fn.toggleBoardBrowser(false); window.tvf.fn.syncBrowserVisibility(); });
      const flags = () => page.evaluate(() => { let n = 0; window.getFieldApp()._debug.games.forEach(g => { if (g.state === 'play') n += g.flag.reduce((s, f) => s + f, 0); }); return n; });
      // a square's middle on the screen, covered (and not flagged) or open, from the game's own squares (the framed board's u, v)
      const squareAt = covered => page.evaluate(covered => { const A = window.getFieldApp(); let g; A._debug.games.forEach(v => { if (v.state === 'play') g = v; }); if (!g) return null;
        const n = g.n, uv = (x, y) => { try { return A._debug.uvAt(x, y); } catch { return null; } };
        for (let y = 40; y < innerHeight - 40; y += 6) for (let x = 40; x < innerWidth - 40; x += 6){ const b = uv(x, y); if (!b) continue;
          const i = Math.floor(b.v * n) * n + Math.floor(b.u * n), cu = (b.u * n) % 1, cv = (b.v * n) % 1;
          if (b.u > 0 && b.u < 1 && b.v > 0 && b.v < 1 && cu > 0.3 && cu < 0.7 && cv > 0.3 && cv < 0.7 && (covered ? !g.open[i] && !g.flag[i] : g.open[i])) return { x, y }; } return null; }, covered);
      const holdAt = async p => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await held(page); await page.mouse.up(); await drawn(page, 900); };
      out.mines = {};
      const cov = await squareAt(true);
      if (cov){ const m0 = await vis(), f0 = await flags(); await holdAt(cov); out.mines.holdFlag = (await flags()) === f0 + 1 && m0 === await vis(); }
      else out.mines.holdFlag = 'no covered square found';
      const opn = await squareAt(false);
      if (opn){ const m0 = await vis(), f0 = await flags(); await holdAt(opn); out.mines.holdRow = m0 !== await vis() && (await flags()) === f0; }
      else out.mines.holdRow = 'no open square found';
      await page.keyboard.press('f'); await drawn(page, 200);
      out.mines.flagMode = await page.evaluate(() => window.getFieldApp().menu[0].items.at(-1).label());
      const at = await squareAt(true);
      if (at){ const f1 = await flags(); await page.mouse.click(at.x, at.y); await drawn(page, 600); out.mines.tapFlag = (await flags()) === f1 + 1; }
      else out.mines.tapFlag = 'no square found';
      await page.keyboard.press('f');
    } catch (e) { out.err = String(e); }
    const ok = !out.err && out.up && out.shut && out.heldOpen && out.heldShut && out.simon && out.simon.before !== out.simon.after
      && out.mines && out.mines.holdFlag === true && out.mines.holdRow === true && out.mines.flagMode === 'Taps: flag' && out.mines.tapFlag === true;
    if (!ok) failures.push(`[bottom row] ${JSON.stringify(out)}`);
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} the dots shut trick shots' row and it stayed shut; a real long press opened it and another shut it; in Simon a hold toggled the row; in Minesweeper a hold on a covered square flagged it and one on an open square flipped the row, and Taps: flag (the real F) flagged by a real click`);
  }
  // A DOUBLE TAP BRINGS A BOARD IN (Oct 16: "double click should select the board and move it into the default position,
  // unless the game has a good reason not to."): in every game a double tap (real touches) on another board selects it and
  // the view comes to the default framing, the one the 0 key gives, even when the game in play keeps quick taps for itself
  // (Lights Out, Nonograms, Simon, Whack-a-mole). On the board being played those games still take both taps.
  {
    current = 'double tap';
    const bad = [], seen = [];
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    for (const id of ['chess', 'tetris', 'towerdefense', 'minigolf', 'sokoban', 'checkers', 'simon', 'lightsout', 'whackamole', 'nonograms']){
      await page.evaluate(id => window.setFieldApp(window.FIELD_APPS.find(a => a.id === id)), id);
      await drawn(page, 1500);
      // a game under way on the framed board (a tap on it), then the view pulled back so the neighbours show
      await page.evaluate(async () => {
        const W = window.FIELD_WORLD, T = W.target, cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
        const p = new W.THREE.Vector3(T.boardX, 0, T.boardZ).project(W.camera), at = [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight];
        const t = new Touch({ identifier: 7, target: cv, clientX: at[0], clientY: at[1], radiusX: 4, radiusY: 4 });
        const fire = (type, t) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
        cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: at[0], clientY: at[1] })); fire('touchstart', t);
        cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: at[0], clientY: at[1] })); fire('touchend', t);
        await wait(700);
      });
      await page.mouse.move(640, 400); await page.mouse.wheel(0, -500); await drawn(page, 1500);
      // (until a neighbour shows: on CI chess, the first game here, once had none on the screen 1.5 s after the wheel, Oct 27)
      for (let k = 0; k < 4; k++){
        const shows = await page.evaluate(() => { const W = window.FIELD_WORLD, T = W.target, [spx, spz] = W.spacing(), cv = document.querySelector('canvas');
          return [[spx, 0], [-spx, 0], [0, spz], [0, -spz]].some(([dx, dz]) => { const v = new W.THREE.Vector3(T.boardX + dx, 0, T.boardZ + dz).project(W.camera), x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
            return x > 60 && y > 60 && x < innerWidth - 60 && y < innerHeight - 140 && document.elementFromPoint(x, y) === cv; }); });
        if (shows) break;
        await page.mouse.move(640, 400); await page.mouse.wheel(0, -500); await drawn(page, 1500);
      }
      const r = await page.evaluate(async () => {
        const W = window.FIELD_WORLD, T = W.target, [spx, spz] = W.spacing(), cv = document.querySelector('canvas'), wait = ms => new Promise(ok => setTimeout(ok, ms));
        let at = null, want = null;
        for (const [dx, dz] of [[spx, 0], [-spx, 0], [0, spz], [0, -spz]]){
          const v = new W.THREE.Vector3(T.boardX + dx, 0, T.boardZ + dz).project(W.camera), x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
          if (x > 60 && y > 60 && x < innerWidth - 60 && y < innerHeight - 140 && document.elementFromPoint(x, y) === cv){ at = [x, y]; want = W.cellAt(T.boardX + dx, T.boardZ + dz); break; }
        }
        if (!at) return { why: 'no neighbour on the screen' };
        // (the view at rest first: a tap while it still coasts from the wheel is the brake, and the field eats it, so on CI
        //  tower defense's pair once lost its first tap and the second only selected)
        const S = window.tvf && window.tvf.state;
        for (let k = 0; k < 80 && (T.active || (S && S.heldPanRate) || (typeof ARCADE !== 'undefined' && ARCADE.paused)); k++) await wait(250);
        const before = { active: !!T.active, held: !!(S && S.heldPanRate), paused: typeof ARCADE !== 'undefined' && !!ARCADE.paused, taps: window.tvf && window.tvf.tapCount };
        const p0 = W.camera.position.clone();
        // (each tap's events MADE before either is sent, Oct 17: an event's time is when it is made, and sending is
        //  synchronous, so the second tap made after the first was handled carried the first's handling in its time. In
        //  tower defense selecting a board builds its game, about a second on CI, and the pair, a second apart, was no
        //  double: failed twice running there, and every time here with the CPU slowed 4×. A phone stamps a touch when the
        //  finger lands, however busy the page.)
        const tap = () => { const t = new Touch({ identifier: 7, target: cv, clientX: at[0], clientY: at[1], radiusX: 4, radiusY: 4 });
          const te = (type) => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] });
          const pe = (type) => new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: at[0], clientY: at[1] });
          return [pe('pointerdown'), te('touchstart'), pe('pointerup'), te('touchend')]; };
        // (the pair back to back: on CI's software renderer a frame can take longer than the whole double's window, and a
        //  wait between the taps let one fall between them; a person's two taps are 100–250 ms apart on a real screen)
        const pair = [...tap(), ...tap()];
        for (const e of pair) cv.dispatchEvent(e);
        // settled where the 0 key would put it
        // (landed when the field says so, not when the camera looks still: between slow frames it can look still mid-flight)
        const landed = async () => { await wait(300); for (let k = 0; k < 120 && T.active; k++) await wait(250); await wait(600); };
        await landed();
        const a = W.camera.position.clone(), f = W.cellAt(T.boardX, T.boardZ);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
        await landed();
        const b = W.camera.position.clone();
        return { want: [want.c, want.r], got: f && [f.c, f.r], moved: +a.distanceTo(p0).toFixed(2), off: +(a.distanceTo(b) / Math.max(1e-6, b.y)).toFixed(3), before, taps: window.tvf && (window.tvf.tapCount - before.taps) };
      });
      seen.push(id + ' ' + (r.off != null ? r.off : r.why));
      if (r.why || !r.got || r.got.join() !== r.want.join() || !(r.off < 0.03) || !(r.moved > 0.1)) bad.push(id + ' ' + JSON.stringify(r));
    }
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    if (bad.length) failures.push('[double tap] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} double tap on another board brings it in, framed as the 0 key frames it (${seen.join(', ')})`);
  }
  // THE GALLERY READS IN ORDER ACROSS THE CORNER (Oct 16: "photo gallery: pdf and cbz are not loading in correct order"): a
  // print's board is −(row + col) mod N with the board's place taken as a signed distance from the corner, so the next page is
  // one board to the right (cell c − 1) and one board down (row r − 1) everywhere near where the gallery opens, for sizes that
  // divide the field's 10,000 and those that do not (12 pages opened with page 10 beside page 1).
  {
    current = 'gallery order';
    const r = await page.evaluate(() => {
      const G = window.FIELD_APPS.find(a => a.id === 'gallery'), was = G._expect, bad = [];
      for (const n of [5, 12, 37, 150]){
        G._expect = Math.max(n, G._list.length);
        const N = Math.max(n, G._list.length);
        for (let r = -3; r <= 3; r++) for (let c = -3; c <= 3; c++){
          const p = G._pick(c, r), right = G._pick(c - 1, r), down = G._pick(c, r - 1);
          // (and the renderer's own wrapped numbers name the same print as the signed ones)
          const wrapped = G._pick(((c % 10000) + 10000) % 10000, ((r % 10000) + 10000) % 10000);
          if (right !== (p + 1) % N || down !== (p + 1) % N || wrapped !== p) bad.push([N, c, r, p, right, down, wrapped].join('/'));
        }
        if (G._pick(0, 0) !== 0) bad.push(N + ': the corner is not the first page');
      }
      G._expect = was;
      return bad.slice(0, 6);
    });
    if (r.length) failures.push('[gallery order] ' + r.join('; '));
    console.log(`${r.length ? 'FAIL' : 'ok  '} gallery order: page 1 on the corner, the next page right and down across it (5, 12, 37, 150 pages)`);
  }
  // THE BOTTOM ROW COASTS ON PHYSICS (Oct 17: "swipe is broken in bottom browser of the photo gallary, it should use physics."):
  // forty pictures in the gallery, a swipe on the row at a thousand pixels a second (mouse events timed as a hand makes them,
  // since this browser handles them far apart) leaves the row coasting on after the release, more than a tile, slowing to a
  // stop on its own; a swipe that stops before it lifts leaves the row where it was put.
  {
    current = 'bottom row coast';
    const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
    const pngOf = (w, h, rgb) => { const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]);
        const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
      const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]); };
    await page.setInputFiles('#importImageFile', Array.from({ length: 40 }, (_, i) => ({ name: `row${String(i).padStart(2, '0')}.png`, mimeType: 'image/png',
      buffer: pngOf(48, 36, [(i * 37) % 255, (i * 91) % 255, (i * 53) % 255]) })));
    await page.waitForFunction(() => window.tvf.bottomRow.n === 40, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => { window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); });
    await drawn(page, 1500);
    const y = await page.evaluate(() => { const r = document.getElementById('boardBrowser').getBoundingClientRect(); return r.top + r.height * 0.6; });
    const cdp2 = await page.context().newCDPSession(page);
    const swipe = async (liftAfter) => {          // 10 moves of 16 px, 16 ms apart, then the lift liftAfter steps after the last
      const T = Date.now() / 1000, ev = (type, x, k, buttons) => cdp2.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, timestamp: T + k * 0.016 });
      await ev('mousePressed', 900, 0, 1);
      for (let k = 1; k <= 10; k++) await ev('mouseMoved', 900 - 16 * k, k, 1);
      await ev('mouseReleased', 740, 10 + liftAfter, 0);
      return page.evaluate(() => window.tvf.bottomRow.angle);
    };
    const moved = (a0, a1) => page.evaluate(([a0, a1]) => { let d = a1 - a0; if (d > Math.PI / 2) d -= Math.PI; if (d < -Math.PI / 2) d += Math.PI; return window.tvf.bottomRow.px(d); }, [a0, a1]);
    const a0 = await swipe(0.2);
    const st0 = await page.evaluate(() => window.tvf.bottomRow);
    await page.waitForFunction(() => !window.tvf.bottomRow.coasting, null, { timeout: 8000 }).catch(() => {});
    const coast = await moved(a0, await page.evaluate(() => window.tvf.bottomRow.angle));
    const b0 = await swipe(10);                 // the finger stops 160 ms before it lifts
    const still = await page.evaluate(() => window.tvf.bottomRow.coasting);
    await drawn(page, 800);
    const after = await moved(b0, await page.evaluate(() => window.tvf.bottomRow.angle));
    const ok = st0.n === 40 && st0.coasting && -coast > st0.itemW && !still && Math.abs(after) < 1;
    if (!ok) failures.push('[bottom row coast] ' + JSON.stringify({ n: st0.n, coastingAtRelease: st0.coasting, vel: st0.vel, coast, still, after }));
    console.log(`${ok ? 'ok  ' : 'FAIL'} bottom row coast: a swipe at 1 px/ms coasts ${Math.round(-coast)} px after the release and stops; one that stops before lifting stays put`);
  }
  // AN EPUB IS READ (Oct 16: "Could you add an epub reader"): a book built here (a zip of a package, two chapters, one XHTML
  // with a list and a figure, one HTML that is not well-formed XML with a word too long for a line and a line of Japanese,
  // and a cover named only in the package) is opened through the real file picker. It must come up as the gallery with a
  // page count, the cover first and alone, each chapter starting a page, every word of the book on the pages in order, the
  // figure on a page, and the pages actually painted onto the boards.
  {
    current = 'epub';
    const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
    const zipOf = files => {          // a stored (uncompressed) zip
      const parts = [], cen = []; let off = 0;
      for (const [name, d0] of files){
        const d = Buffer.isBuffer(d0) ? d0 : Buffer.from(d0), nm = Buffer.from(name), c = crc(d);
        const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14);
        h.writeUInt32LE(d.length, 18); h.writeUInt32LE(d.length, 22); h.writeUInt16LE(nm.length, 26);
        parts.push(h, nm, d);
        const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt32LE(c, 16);
        e.writeUInt32LE(d.length, 20); e.writeUInt32LE(d.length, 24); e.writeUInt16LE(nm.length, 28); e.writeUInt32LE(off, 42);
        cen.push(e, nm); off += 30 + nm.length + d.length;
      }
      const cd = Buffer.concat(cen), end = Buffer.alloc(22);
      end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
      end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
      return Buffer.concat([...parts, cd, end]);
    };
    const pngOf = (w, h, rgb) => {     // a plain picture
      const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]);
                                const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
      const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
                            chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
    };
    const words = 'the quick brown fox jumps over a lazy dog while seven old sailors sing of distant harbours and silver rain'.split(' ');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const paras = Array.from({ length: 50 }, () => Array.from({ length: 40 + Math.floor(rnd() * 60) }, () => words[Math.floor(rnd() * words.length)]).join(' '));
    const long = 'Supercalifragilistic' + 'x'.repeat(120);
    const ch1 = '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>one</title></head><body>' +
      '<h1>Chapter One</h1>' + paras.slice(0, 25).map((p, k) => k === 3 ? `<p>${p} <i>leaning words</i> and <b>heavy</b>.</p>` : `<p>${p}</p>`).join('\n') +
      '<div><img src="../images/fig.png" alt=""/></div><ul><li>first item</li><li>second item</li></ul></body></html>';
    const ch2 = '<html><head></head><body><h2>Chapter&nbsp;Two</h2><p>' + long + '</p>' + paras.slice(25).map(p => `<p>${p}</p>`).join('\n') +
      '<p>日本語の文章です。</p></body></html>';
    const opf = '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:title>The Smoke Book</dc:title><meta name="cover" content="cov"/></metadata><manifest>' +
      '<item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/two%20b.html" media-type="text/html"/>' +
      '<item id="cov" href="images/cover.png" media-type="image/png"/><item id="fig" href="images/fig.png" media-type="image/png"/></manifest>' +
      '<spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>';
    const dir = await mkdtemp(join(tmpdir(), 'epub-'));
    const file = join(dir, 'smoke.epub');
    await writeFile(file, zipOf([['mimetype', 'application/epub+zip'],
      ['META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'],
      ['OEBPS/content.opf', opf], ['OEBPS/text/one.xhtml', ch1], ['OEBPS/text/two b.html', ch2],
      ['OEBPS/images/cover.png', pngOf(60, 90, [200, 40, 40])], ['OEBPS/images/fig.png', pngOf(300, 120, [40, 90, 200])]]));
    const has = await page.evaluate(() => !!window.unzipit);
    if (!has) console.log('skip epub: unzipit did not load (offline? put unzipit@2.0.1 in LIBS_DIR)');
    else {
      await page.setInputFiles('#importImageFile', file);
      await page.waitForFunction(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._epub && G._epub.label === 'The Smoke Book'; }, null, { timeout: 30000 }).catch(() => {});
      await drawn(page, 4000);
      const r = await page.evaluate(() => {
        const G = window.FIELD_APPS.find(a => a.id === 'gallery'), E = G._epub;
        if (!E) return { why: 'no book laid out' };
        const P = E.pages;
        const text = P.map(p => E.EPUB.textOf(p));
        const firstOf = s => text.findIndex(t => t.includes(s));
        return { n: P.length, app: window.getFieldApp && window.getFieldApp() === G, expect: G._expect,
                 cover: P[0].full && P[0].imgs.length === 1 && !P[0].lines.length,
                 one: firstOf('Chapter One'), two: firstOf('Chapter'), twoAt: text.findIndex(t => /Chapter\s+Two/.test(t)),
                 twoTop: (() => { const k = text.findIndex(t => /Chapter\s+Two/.test(t)); return k > 0 && P[k].lines[0].items.some(it => it.s === 'Two'); })(),
                 fig: P.some(p => !p.full && p.imgs.length), text: text.join(' '), loaded: G._list.filter(Boolean).length };
      });
      const bad = [];
      if (r.why) bad.push(r.why);
      else {
        const flat = r.text.replace(/\s+/g, ' ');
        // every paragraph in order (the long word may be cut, the Japanese is broken a character at a time)
        let at = 0;
        for (const p of paras){ const k = flat.indexOf(p, at); if (k < 0){ bad.push('a paragraph is missing or out of order'); break; } at = k + p.length; }
        if (!/leaning words and heavy/.test(flat)) bad.push('italic and bold runs lost');
        if (!/first item.*second item/.test(flat)) bad.push('the list lost');
        if (flat.replace(/ /g, '').indexOf(long) < 0) bad.push('the long word lost');
        if (flat.replace(/ /g, '').indexOf('日本語の文章です。') < 0) bad.push('the Japanese lost');
        if (!r.app) bad.push('the gallery did not come forward');
        if (!r.cover) bad.push('the cover is not alone on the first page');
        if (r.one !== 1) bad.push('chapter one starts on page ' + (r.one + 1));
        if (!r.twoTop) bad.push('chapter two does not start a page');
        if (!r.fig) bad.push('the figure is on no page');
        if (r.expect !== r.n) bad.push(`the gallery expects ${r.expect} prints for ${r.n} pages`);
        if (!(r.loaded >= 1)) bad.push('no page painted onto a board');
      }
      // THE ROW IS THE BOOK'S SETTINGS (Oct 17: "the epub reader should use the bottom browser for settings such as font
      // size and font and color and background color, similar to how the games do it"): with the book hanging the row holds
      // its settings, not page thumbnails; a real click on Larger lays it out again bigger (more pages) and keeps the reader
      // on the page holding the words they were on; Page steps the paper colour without moving a word.
      if (!r.why){
        const row = await page.evaluate(() => {
          const G = window.FIELD_APPS.find(a => a.id === 'gallery');
          const live = [...document.querySelectorAll('#boardBrowser .bb-tile')].filter(t => t.style.display !== 'none').map(t => t._key);
          return { tiles: (G.statTiles() || []).map(t => t.value), keys: live };
        });
        if (row.tiles.join() !== 'Smaller,20,Larger,Serif,Sans,Book,Mono,Text: Ink,Page: Paper') bad.push('the settings row is ' + row.tiles.join());
        if (!row.keys.length || !row.keys.every(k => String(k).startsWith('stat_'))) bad.push('the row shows ' + row.keys.slice(0, 3).join() + ', not the settings');
        const before = await page.evaluate(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'), E = G._epub, i = G._pick(tvf.target.cellX, tvf.target.cellZ) - E.base;
                                                    return { n: E.pages.length, at: E.pages[i] && E.pages[i].at, i }; });
        const box = await page.evaluate(() => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === 'stat_2' && t.style.display !== 'none');
                                                const b = t && t.getBoundingClientRect(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
        if (!box) bad.push('no Larger tile on the screen');
        else {
          await page.mouse.click(box.x, box.y);
          await page.waitForFunction(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._epub.EPUB.style.size === 22 && !G._book.busy; }, null, { timeout: 20000 }).catch(() => {});
          await drawn(page, 1500);
          const big = await page.evaluate(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'), E = G._epub, i = G._pick(tvf.target.cellX, tvf.target.cellZ) - E.base;
                                                  return { n: E.pages.length, size: E.EPUB.style.size, from: E.pages[i] && E.pages[i].at, to: E.pages[i + 1] ? E.pages[i + 1].at : 1e9 }; });
          if (big.size !== 22) bad.push('Larger left the size at ' + big.size);
          if (!(big.n > before.n)) bad.push(`larger type made ${big.n} pages from ${before.n}`);
          if (before.at != null && !(big.from <= before.at && before.at < big.to)) bad.push('the framed page does not hold the words the reader was on');
          const paper = await page.evaluate(async () => {
            const G = window.FIELD_APPS.find(a => a.id === 'gallery'); const n = G._epub.pages.length;
            await G._book.tap(8);
            const E = G._epub, cv = document.createElement('canvas'); E.EPUB.paint(cv, E.pages[1], 96, new Map());
            const d = cv.getContext('2d').getImageData(2, 2, 1, 1).data;
            return { n0: n, n: E.pages.length, paper: E.EPUB.style.paper, px: [d[0], d[1], d[2]] };
          });
          if (paper.paper !== 'white' || paper.px.join() !== '255,255,255') bad.push('Page did not paint the pages white: ' + JSON.stringify(paper));
          if (paper.n !== paper.n0) bad.push('a page colour moved the words');
          await page.evaluate(async () => { const B = window.FIELD_APPS.find(a => a.id === 'gallery')._book; for (let k = 0; k < 5; k++) await B.tap(8); await B.tap(0); });   // back as it was
        }
      }
      // A BOOK OPENED WITH A PICTURE KEEPS IT (Oct 17, "proceed on fixes"): a change from the row opened the book again alone and
      // the files beside it went; now the drop is opened again in the new settings, the picture still hanging after the pages.
      if (!r.why){
        const png = join(dir, 'beside.png');
        await writeFile(png, pngOf(40, 60, [30, 160, 60]));
        await page.setInputFiles('#importImageFile', [file, png]);
        await page.waitForFunction(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._book.live() && G._expect === G._epub.pages.length + 1 && G._epub.EPUB.style.size === 20; }, null, { timeout: 30000 }).catch(() => {});
        const n0 = await page.evaluate(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._book.live() ? G._epub.pages.length : -1; });
        await page.evaluate(() => { window.FIELD_APPS.find(a => a.id === 'gallery')._book.tap(2); });
        await page.waitForFunction(n0 => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._book.live() && G._epub.EPUB.style.size === 22 && G._epub.pages.length > n0; }, n0, { timeout: 30000 }).catch(() => {});
        const both = await page.evaluate(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return { n: G._epub.pages.length, expect: G._expect, size: G._epub.EPUB.style.size }; });
        if (n0 < 0 || both.size !== 22 || !(both.n > n0) || both.expect !== both.n + 1) bad.push(`a book opened with a picture, after Larger: ${JSON.stringify({ n0, ...both })} (the picture should still hang after the pages)`);
        await page.evaluate(() => { window.FIELD_APPS.find(a => a.id === 'gallery')._book.tap(0); });
        await page.waitForFunction(() => { const G = window.FIELD_APPS.find(a => a.id === 'gallery'); return G._book.live() && G._epub.EPUB.style.size === 20; }, null, { timeout: 30000 }).catch(() => {});
      }
      if (bad.length) failures.push('[epub] ' + bad.join('; '));
      console.log(`${bad.length ? 'FAIL' : 'ok  '} epub: a book opened through the picker laid out as ${r.n} pages, cover first, chapters on fresh pages, every word in order, ${r.loaded} painted; the row its settings (Larger re-laid it, the place kept; Page painted it white; a picture opened with it kept)`);
    }
  }
  // A MARKDOWN FILE IS READ AS A BOOK (Oct 25: "would it be hard to add an application that read md files", then "yes, add the
  // markdown reader"): a .md written here, with a picture beside it, opened through the real file picker. It must come up as the
  // gallery with the front matter's title, a chapter at each top heading, its words in order (bold, code, a link's words, a
  // lazy line, nested and task lists, a quote, a fenced block and a table as columns), the picture it names placed on its page
  // and not hung again on its own, a missing one said in words; the row the book's settings (a real click on Larger laying it
  // out again), and a code block painted on its shade.
  {
    current = 'markdown';
    const bad = [];
    const G = 'window.FIELD_APPS.find(a => a.id === \'gallery\')';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1500);
    const md = ['---', 'title: "The Garden Notes"', '---', '# Planting', '',
      'Some **bold** words, some *italic* ones, `inline code` and a [link](https://example.com).', 'A line that carries on.', '',
      '![a red square](pics/red.png)', '', '- one', '- two', '  - two and a half', '- [x] done', '- [ ] not yet', '', '1. first', '2. second', '',
      '> a quoted line', '> and another', '', '```js', 'const x = 1;   // kept as written', '```', '',
      '| Plant | Days |', '|-------|-----:|', '| Bean  | 60   |', '| Pea   | 70   |', '', '---', '', '# Harvest', '', 'Underlined', '----------', '',
      '![missing](nowhere.png) and text after.', ''].join('\n');
    const red = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJElEQVR4nGO4Iyc3IIhh1OJRi0ctHrV41OJRi0ctHrV45FgMAAu5ay6grAKsAAAAAElFTkSuQmCC', 'base64');
    await page.setInputFiles('#importImageFile', [{ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from(md) },
                                                    { name: 'red.png', mimeType: 'image/png', buffer: red }]);
    await page.waitForFunction(g => { const E = eval(g)._epub; return E && E.md && E.label === 'The Garden Notes'; }, G, { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(g => {
      const A = window.getFieldApp(), E = eval(g)._epub; if (!E || !E.md) return null;
      return { app: A.name, chapters: E.book.chapters.length, pages: E.pages.length, n: eval(g)._expect,
        text: E.pages.map(p => E.EPUB.textOf(p)).join(' | '), imgs: E.pages.reduce((k, p) => k + p.imgs.length, 0),
        pre: E.book.chapters[0].filter(b => b.pre).length, quote: E.book.chapters[0].some(b => b.quote),
        size: E.EPUB.style.size, row: (eval(g).statTiles(0, 0) || []).map(t => t.value).join(',') };
    }, G);
    const want = ['Planting', 'Some bold words, some italic ones, inline code and a link', 'A line that carries on.', '• one', '• two', '• two and a half',
      '☑ done', '☐ not yet', '1. first', '2. second', 'a quoted line and another', 'const x = 1;', '// kept as written', 'Plant Days', 'Bean 60', 'Pea 70',
      '| Harvest Underlined [picture: missing] and text after.'];
    const flat = r ? r.text.replace(/ (?=[.,])/g, '') : '';
    let at = 0;
    for (const w of want){ const k = flat.indexOf(w, at); if (k < 0){ bad.push('words missing or out of order: ' + JSON.stringify(w)); break; } at = k + w.length; }
    if (!r) bad.push('the file did not open as a book');
    else {
      if (r.app !== 'photo gallery' || r.chapters !== 2 || r.pages !== 2) bad.push('opened as ' + JSON.stringify({ app: r.app, chapters: r.chapters, pages: r.pages }));
      if (r.imgs !== 1 || r.n !== r.pages) bad.push(`the picture: ${r.imgs} placed, ${r.n} prints for ${r.pages} pages (it should be on its page and not hung on its own)`);
      if (r.pre !== 1 || !r.quote) bad.push('code and quote blocks (the table is a table now, no longer a block of monospaced lines, Nov 5): ' + JSON.stringify({ pre: r.pre, quote: r.quote }));
      if (!/^Smaller,\d+,Larger,Serif/.test(r.row)) bad.push('the row is not the book\'s settings: ' + r.row);
      // a real click on Larger lays it out again (the row opened first: a book's settings do not hold it open)
      await page.evaluate(() => { window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); });
      await drawn(page, 1200);
      const tile = await page.evaluate(() => {
        const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(e => e._key === 'stat_2' && e.style.display !== 'none'); if (!t) return null;
        const b = t.getBoundingClientRect(); return b.width > 4 && b.left >= 0 && b.right <= innerWidth ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; });
      if (tile) await page.mouse.click(tile.x, tile.y); else await page.evaluate(g => eval(g)._book.tap(2), G);
      await page.waitForFunction(([g, s0]) => { const E = eval(g)._epub; return E && E.md && E.EPUB.style.size > s0; }, [G, r.size], { timeout: 30000 }).catch(() => {});
      const big = await page.evaluate(g => { const E = eval(g)._epub; return E && { size: E.EPUB.style.size, md: E.md, label: E.label }; }, G);
      if (!big || !(big.size > r.size) || !big.md || big.label !== 'The Garden Notes') bad.push(`Larger (${tile ? 'a real click' : 'the row'}): ` + JSON.stringify(big));
      // the code block painted on its shade
      const px = await page.evaluate(g => { const E = eval(g)._epub, pg = E.pages[0], sh = pg.shades.find(s => s.k === 'code'); if (!sh) return null;
        const cv = document.createElement('canvas'); E.EPUB.paint(cv, pg, 960, new Map());
        const d = cv.getContext('2d').getImageData(Math.round(sh.x + sh.w - 4), Math.round(sh.y + sh.h / 2), 1, 1).data, e = cv.getContext('2d').getImageData(4, 900, 1, 1).data;
        return { shade: [d[0], d[1], d[2]].join(), paper: [e[0], e[1], e[2]].join() }; }, G);
      if (!px || px.shade === px.paper) bad.push('the code block has no shade: ' + JSON.stringify(px));
      // each chapter its own paper, each opening on its title large on a band of its colour (Oct 25: "yes", to chapters seen
      // from far off and headings as landmarks)
      const tint = await page.evaluate(g => { const E = eval(g)._epub, at = (pg, x, y) => { const cv = document.createElement('canvas'); E.EPUB.paint(cv, pg, 960, new Map());
          return [...cv.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3).join(); };
        const band = p => p.shades.find(s => s.k === 'band'), big = p => Math.max(...p.lines[0].items.map(it => +/(\d+)px/.exec(it.font)[1]));
        return { tints: E.pages.map(p => p.tint), bands: E.pages.map(p => !!band(p)), big: E.pages.map(big), paper: E.pages.map(p => at(p, 4, 900)), band: E.pages.map(p => at(p, 600, 20)) }; }, G);
      if (tint.tints.join() !== '0,1' || tint.bands.join() !== 'true,true' || tint.paper[0] === tint.paper[1] || tint.band[0] === tint.paper[0] || !(tint.big[0] >= 50))
        bad.push('chapter colours and title bands: ' + JSON.stringify(tint));
      await page.evaluate(g => { eval(g)._book.tap(0); }, G);
      await page.waitForFunction(([g, s0]) => { const E = eval(g)._epub; return E && E.EPUB.style.size === s0; }, [G, r.size], { timeout: 30000 }).catch(() => {});
    }
    if (bad.length) failures.push('[markdown] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} markdown: a .md opened through the picker as a book of ${r ? r.pages : '?'} pages, a chapter a top heading, its words in order, the picture beside it placed and not hung again, a missing one in words, code shaded, each chapter its own paper and its title large on a band, a real click on Larger laying it out again`);
  }
  // BETTER MARKDOWN (Nov 5: "is it possible to add better md support." … tables, footnotes and definition lists, alerts, highlight,
  // sub- and superscript, emoji): a .md with each of them opened through the real picker. A table is real columns (a `table` block,
  // its cells aligned as the separator row says, none of the old monospaced lines), a footnote's mark is a superscript number and its note
  // comes after the last block, a definition's term is bold with its definition indented, an alert's title and bar are its kind's,
  // and the marks, rises, falls and strikes are flags on the words, painted (a mark's yellow behind its words).
  {
    current = 'markdown more';
    const bad = [];
    const G = 'window.FIELD_APPS.find(a => a.id === \'gallery\')';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const md = ['# More', '', 'A note[^a], ==marked words==, H~2~O, x^2^, :smile: and ~~struck~~ with ~5 and ~10 left alone.', '', '> [!WARNING]', '> Mind the step.', '',
      'Term', ': Its definition.', '', '| Left | Mid | Right |', '|:-----|:---:|------:|', '| a | **b** | `c` |', '| long cell words that wrap | 2 | 3 |', '',
      '[^a]: The note.', ''].join('\n');
    await page.setInputFiles('#importImageFile', [{ name: 'more.md', mimeType: 'text/markdown', buffer: Buffer.from(md) }]);
    await page.waitForFunction(g => { const E = eval(g)._epub; return E && E.md && E.label === 'More'; }, G, { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(g => {
      const E = eval(g)._epub; if (!E || !E.md) return null;
      const items = E.pages.flatMap(p => p.lines.flatMap(l => l.items)), blocks = E.book.chapters.flat();
      const fx = f => items.filter(it => it.fx && it.fx.includes(f)).map(it => it.s).join('');
      const tbl = blocks.find(b => b.t === 'table');
      const pg = E.pages.find(p => p.shades.some(s => s.k === 'bar' && s.alert));
      const mk = items.find(it => it.fx && it.fx.includes('m'));
      let mark = null;
      if (mk){ const p = E.pages.find(q => q.lines.some(l => l.items.includes(mk))), ln = p.lines.find(l => l.items.includes(mk)), cv = document.createElement('canvas');
        E.EPUB.paint(cv, p, 1100, new Map()); const z = 1100 / E.EPUB.PAGE_H, d = cv.getContext('2d').getImageData(Math.round((mk.x + mk.wd / 2) * z), Math.round((ln.y - mk.h * 0.7) * z), 1, 1).data,
          e = cv.getContext('2d').getImageData(4, 1090, 1, 1).data; mark = [d[0], d[1], d[2]].join() !== [e[0], e[1], e[2]].join(); }
      return { text: E.pages.map(p => E.EPUB.textOf(p)).join(' | '), mark: fx('m'), sup: fx('p'), strike: fx('s'), cols: tbl && tbl.rows.map(x => x.cells.map(c => c.align).join()),
               heads: tbl && tbl.rows.map(x => x.head), pre: blocks.filter(b => b.pre).length, bar: pg && pg.shades.find(s => s.k === 'bar' && s.alert).alert,
               rules: E.pages.reduce((k, p) => k + p.shades.filter(s => s.k === 'rule').length, 0), dd: blocks.some(b => b.t === 'p' && b.inset >= 24 && /Its definition/.test(b.runs.map(x => x.s).join('')) && !b.list),
               dt: blocks.some(b => b.t === 'p' && b.runs.every(x => x.b) && /^Term/.test(b.runs.map(x => x.s).join(''))), marked: mark };
    }, G);
    if (!r) bad.push('the file did not open');
    else {
      if (r.mark !== 'markedwords') bad.push('the highlight: ' + JSON.stringify(r.mark));
      if (r.sup !== '1221') bad.push('the super- and subscripts (the mark, H~2~, x^2^, the note\'s number): ' + JSON.stringify(r.sup));
      if (r.strike !== 'struck') bad.push('the strike: ' + JSON.stringify(r.strike));
      if (!r.text.includes('😄') || !r.text.includes('~5 and ~10 left alone')) bad.push('emoji and tildes in words: ' + r.text.slice(0, 200));
      if (!r.cols || r.cols.join('|') !== 'left,center,right|left,center,right|left,center,right' || r.heads.join() !== 'true,false,false') bad.push('the table: ' + JSON.stringify({ cols: r.cols, heads: r.heads }));
      if (r.pre) bad.push('the table is still monospaced lines');
      if (r.rules < 3) bad.push('the table has no rules: ' + r.rules);
      if (!/Left Mid Right/.test(r.text) || !/long cell words that wrap/.test(r.text)) bad.push('the table words: ' + r.text.slice(0, 300));
      if (r.bar !== 'warning' || !/Warning Mind the step\./.test(r.text)) bad.push('the alert: ' + JSON.stringify({ bar: r.bar }));
      if (!r.dt || !r.dd) bad.push('the definition list: ' + JSON.stringify({ dt: r.dt, dd: r.dd }));
      if (!/1 The note\./.test(r.text)) bad.push('the footnote\'s note is not after the text: ' + r.text.slice(-120));
      if (!r.marked) bad.push('the highlight is not painted behind its words');
    }
    if (bad.length) failures.push('[markdown more] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} markdown more (a table of real columns aligned as written, a footnote numbered with its note after, a definition list, an alert, ==highlight==, H~2~O, x^2^, ~~strike~~ and emoji)`);
  }
  // A BOOK REPLACES A FOLDER STILL ARRIVING (Nov 1: "when I load images, then something else, say an epub file or pdf, and some of the
  // original images are still showing, and the aspect ratio has not been reset"): forty pictures are dropped (read a frame at a
  // time), and a .md is opened before they are all in. The collection is then the book's pages alone, none of the pictures.
  {
    current = 'folder then book';
    const bad = [];
    const G = 'window.FIELD_APPS.find(a => a.id === \'gallery\')';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const pngs = await page.evaluate(() => Array.from({ length: 40 }, (_, k) => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const x = c.getContext('2d'); x.fillStyle = `hsl(${k * 9},70%,45%)`; x.fillRect(0, 0, 200, 200); return c.toDataURL('image/png').split(',')[1]; }));
    await page.setInputFiles('#importImageFile', pngs.map((b, i) => ({ name: `f${String(i).padStart(2, '0')}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await drawn(page, 1500);   // (a picture or two may be in, or the folder still being measured: the book wins either way)
    const md = '# Alone\n\n' + 'Some words here. '.repeat(30) + '\n';
    await page.setInputFiles('#importImageFile', [{ name: 'alone.md', mimeType: 'text/markdown', buffer: Buffer.from(md) }]);
    await page.waitForFunction(g => { const E = eval(g)._epub; return E && E.md && E.label === 'Alone'; }, G, { timeout: 30000 }).catch(() => {});
    await drawn(page, 6000);
    const r = await page.evaluate(g => { const A = eval(g), E = A._epub; return { pages: E ? E.pages.length : -1, have: A._list.filter(Boolean).length, names: A._list.filter(Boolean).map(e => e.name) }; }, G);
    if (r.pages < 1) bad.push('the book did not open');
    else if (r.names.some(n => !/ · /.test(n || ''))) bad.push('pictures of the folder are still in the collection: ' + r.names.filter(n => !/ · /.test(n || '')).slice(0, 3).join(', '));
    if (bad.length) failures.push('[folder then book] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} folder then book: a markdown book opened while a folder of pictures was still arriving holds its ${r.pages} pages alone`);
  }
  // THE CURRENT IMAGE SETS THE SHAPE WHEN IT LOADS (Nov 1: "the current image should be set as the aspect ratio when loading it."): a
  // portrait print on the framed board with three landscape ones beside it would get a landscape board from the load's survey; the
  // board takes the framed print's own shape once it is read.
  {
    current = 'load shape from current image';
    const bad = [];
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const pngs = await page.evaluate(() => [0, 1, 2, 3].map(k => { const c = document.createElement('canvas'); const L = k !== 0; c.width = L ? 600 : 300; c.height = L ? 300 : 600; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1]; }));
    await page.setInputFiles('#importImageFile', pngs.map((b, i) => ({ name: `q${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForFunction(() => ['q0', 'q1'].every(n => window.GALLERY_APP._list.some(e => e && e.name === n)), null, { timeout: 120000 }).catch(() => {});
    // (the framed print is whichever is on the board in view: the board's shape follows ITS aspect)
    const want = () => page.evaluate(() => { const G = window.GALLERY_APP, T = window.FIELD_TARGET; const SP = window.FIELD_WORLD.spacing(); const e = G._list[G._pick(Math.round(T.boardX / SP[0]), Math.round(T.boardZ / SP[1]))]; return { a: e && e.aspect, shape: window.LAB.cellW / window.LAB.cellH }; });
    await page.waitForFunction(() => { const G = window.GALLERY_APP, T = window.FIELD_TARGET; const SP = window.FIELD_WORLD.spacing(); const e = G._list[G._pick(Math.round(T.boardX / SP[0]), Math.round(T.boardZ / SP[1]))]; return e && e.aspect && Math.abs(Math.log((window.LAB.cellW / window.LAB.cellH) / e.aspect)) < 0.05; }, null, { timeout: 30000 }).catch(() => {});
    const sh = await want();
    if (!(sh.a && Math.abs(Math.log(sh.shape / sh.a)) < 0.05)) bad.push('the board did not take the framed print\'s shape: ' + JSON.stringify(sh));
    if (bad.length) failures.push('[load shape] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} load shape: the board took the framed print's (portrait) shape as the collection loaded`);
  }
  // A TAP ON A PRINT TAKES THE BOARD'S SHAPE FROM IT (Nov 1: "tapping an image should reset the aspect ratio."): four pictures, two
  // landscape and two portrait, so the board starts landscape; a tap on a portrait one makes the board portrait, every print's windows
  // follow (a portrait print's window is the whole of it), and a tap on a landscape one makes it landscape again.
  {
    current = 'tap reshapes';
    const bad = [];
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const pngs = await page.evaluate(() => [0, 1, 2, 3].map(k => { const c = document.createElement('canvas'); const L = k % 2 === 0; c.width = L ? 600 : 300; c.height = L ? 300 : 600; const x = c.getContext('2d'); x.fillStyle = `hsl(${k * 80},70%,45%)`; x.fillRect(0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1]; }));
    await page.setInputFiles('#importImageFile', pngs.map((b, i) => ({ name: `s${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForFunction(() => ['s0', 's1'].every(n => window.GALLERY_APP._list.some(e => e && e.name === n)), null, { timeout: 120000 }).catch(() => {});
    await drawn(page, 1500);
    const shape = () => page.evaluate(() => ({ w: window.LAB.cellW, h: window.LAB.cellH }));
    const tapKind = async odd => {
      await page.evaluate(odd => { const G = window.GALLERY_APP; for (let c = -3; c <= 3; c++) for (let r = -3; r <= 3; r++) if ((G._pick(c, r) % 2 === 1) === odd && G._list[G._pick(c, r)]){ window.FIELD_TARGET.shown = true; G._zoomKey = null; G.onCellTap(c, r, 0.5, 0.5); return; } }, odd);
      await drawn(page, 800);
      return shape();
    };
    // (a landscape print first, then a portrait one, then a landscape one: every load is a fresh set, so the board's shape at the start is
    //  the load's own pick over two shapes of each and is not asked)
    const p0 = await tapKind(false), p1 = await tapKind(true), p2 = await tapKind(false);
    if (!(p0.w > p0.h)) bad.push('a tap on a landscape print did not make the board landscape: ' + JSON.stringify(p0));
    if (!(p1.h > p1.w)) bad.push('a tap on a portrait print did not make the board portrait: ' + JSON.stringify(p1));
    if (!(p2.w > p2.h)) bad.push('a tap on a landscape print did not make it landscape again: ' + JSON.stringify(p2));
    // (prints stand edge to edge and never over one another, in either shape: Nov 2, "the images in photo gallery are overlapping")
    const fill = () => page.evaluate(() => { const W = window.FIELD_WORLD, sp = W.spacing(), bw = W.boardW(), L = window.LAB; return { x: bw * L.cellW / sp[0], z: bw * L.cellH / sp[1] }; });
    for (const nm of ['landscape', 'portrait']){
      if (nm === 'portrait') await tapKind(true);
      const f = await fill();
      if (f.x > 1.01 || f.z > 1.01) bad.push('prints overlap their neighbours (a ' + nm + ' board is ' + f.x.toFixed(3) + ' × ' + f.z.toFixed(3) + ' of its cell)');
      if (Math.max(f.x, f.z) < 0.99) bad.push('prints leave a gutter (a ' + nm + ' board is ' + f.x.toFixed(3) + ' × ' + f.z.toFixed(3) + ')');
    }
    if (bad.length) failures.push('[tap reshapes] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} tap reshapes: the gallery board took a portrait print's shape on a tap and a landscape print's on the next`);
  }
  // THE PAGE YOU ARE ON IS KEPT FOR EACH COLLECTION (Nov 1: "can you save the current page to the localstorage, and use that as the current page on load"):
  // after a folder is opened and the view steps to another board (the real Tab), localStorage `gallery.pos` holds that board's print under
  // the collection's key. (The restore on the next load is the same move the other way; a reload is too slow for this part.)
  {
    current = 'gallery position';
    const bad = [];
    await page.evaluate(() => { try { localStorage.removeItem('gallery.pos'); } catch {} window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')); });
    await drawn(page, 800);
    const pngs = await page.evaluate(() => Array.from({ length: 6 }, (_, k) => { const c = document.createElement('canvas'); c.width = 240; c.height = 160; const x = c.getContext('2d'); x.fillStyle = `hsl(${k * 50},70%,45%)`; x.fillRect(0, 0, 240, 160); return c.toDataURL('image/png').split(',')[1]; }));
    await page.setInputFiles('#importImageFile', pngs.map((b, i) => ({ name: `z${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForFunction(() => window.GALLERY_APP._list.filter(e => e && /^z\d$/.test(e.name)).length >= 3, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3000);                      // (the place is kept only once the opening move is over)
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => { try { return Object.keys(JSON.parse(localStorage.getItem('gallery.pos') || '{}')).length > 0; } catch { return false; } }, null, { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(() => { let m = {}; try { m = JSON.parse(localStorage.getItem('gallery.pos') || '{}'); } catch {} const G = window.GALLERY_APP, T = window.FIELD_TARGET; return { saved: Object.values(m), now: G._pick(T.cellX | 0, T.cellZ | 0) }; });
    // (an entry or two: the collection before this one, which every load now keys, may have written its own just before this one began)
    if (r.saved.length < 1) bad.push('nothing was kept: ' + JSON.stringify(r));
    else if (r.saved.some(v => !Number.isInteger(v.i) || v.i < 0)) bad.push('the kept print is not a print number: ' + JSON.stringify(r));   // (not compared with the framed board's: the flight's last board and the first it framed differ, and earlier checks' pictures may still be hung)
    // …and a view only PANNED (no flight, so no framing) keeps its page too: clear the store, drag the view across a board or two, wait.
    await page.evaluate(() => { try { localStorage.removeItem('gallery.pos'); } catch {} window.GALLERY_APP._posReset && window.GALLERY_APP._posReset(); });
    await page.mouse.move(1000, 200); await page.mouse.down();
    for (let j = 1; j <= 14; j++){ await page.mouse.move(1000 - 60 * j, 200 + 8 * j); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.waitForFunction(() => { try { return Object.keys(JSON.parse(localStorage.getItem('gallery.pos') || '{}')).length > 0; } catch { return false; } }, null, { timeout: 15000 }).catch(() => {});
    const pn = await page.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('gallery.pos') || '{}')).length; } catch { return -1; } });
    if (pn < 1) bad.push('a panned view kept nothing: ' + pn);
    if (bad.length) failures.push('[gallery position] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} gallery position: the print on the framed board is kept in localStorage under the collection's key after the view steps on`);
  }
  // THE LAST DROP IS KEPT ACROSS A REFRESH (Nov 1: "If I hit refresh, after loading a book, I loose the book."): a .md opened through the real
  // picker is kept in IndexedDB (`window.__galleryKeep`); read back it is the same file, by name and size. (The reopening on a load is
  // the same files through the same path as a drop; a reload by hand brought the book back with its two pages.)
  {
    current = 'gallery keeps the drop';
    const bad = [];
    const md = '# Kept\n\n' + 'Words to keep. '.repeat(40) + '\n';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 800);
    await page.setInputFiles('#importImageFile', [{ name: 'keepme.md', mimeType: 'text/markdown', buffer: Buffer.from(md) }]);
    await page.waitForFunction(() => { const E = window.GALLERY_APP._epub; return E && E.md && E.label === 'Kept'; }, null, { timeout: 60000 }).catch(() => {});
    await drawn(page, 1500);
    const r = await page.evaluate(async () => { const f = await window.__galleryKeep.get(); return f.map(x => [x.name, x.size]); });
    if (r.length !== 1 || r[0][0] !== 'keepme.md') bad.push('the drop was not kept: ' + JSON.stringify(r));
    else if (r[0][1] !== Buffer.byteLength(md)) bad.push('the kept file is not the one dropped: ' + JSON.stringify(r));
    if (bad.length) failures.push('[gallery keeps the drop] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} gallery keeps the drop: the file opened is kept in IndexedDB and reads back the same`);
  }
  // A JSON FILE IS READ AS PAGES (Oct 25: "what about a json file viewer", then "Pages, like the EPUB reader"): a file built here
  // is opened through the real file picker. It must come up as the gallery, its lines exactly JSON.stringify's two-space
  // printing, numbered, every page headed by the path it begins at; the row its settings (a real click on Shallower and
  // taps to depth 2 folding each record to one line, a real click on Larger keeping the reader at the path they were on,
  // Colours painting the page sepia); a file that is not JSON showing why with the line it broke on marked, and JSON Lines
  // read as one array.
  {
    current = 'json';
    const bad = [];
    const G = 'window.FIELD_APPS.find(a => a.id === \'gallery\')';
    const dir = await mkdtemp(join(tmpdir(), 'json-'));
    const v = { name: 'smoke', flag: true, nothing: null, ratio: 0.25,
      users: Array.from({ length: 120 }, (_, i) => ({ id: i, name: 'user ' + i, tags: ['a', 'b' + i], address: { city: 'Town ' + (i % 7), zip: 10000 + i } })),
      long: 'word '.repeat(60).trim() };
    const file = join(dir, 'smoke-data.json');
    await writeFile(file, JSON.stringify(v));
    await page.setInputFiles('#importImageFile', file);
    await page.waitForFunction(g => { const G = eval(g); return G._json && G._json.label === 'smoke-data.json'; }, G, { timeout: 30000 }).catch(() => {});
    await drawn(page, 1500);
    const r = await page.evaluate(([g, want]) => {
      const G = eval(g), J = G._json;
      if (!J) return { why: 'no JSON laid out' };
      const D = J.doc, P = J.pages;
      const printed = D.lines.map(l => '  '.repeat(l.ind) + l.toks.map(t => t.s).join(''));
      const exact = printed.join('\n') === want;
      const nums = P.flatMap(p => p.rows.filter(r => r.no).map(r => r.no));
      return { n: P.length, app: window.getFieldApp() === G, expect: G._expect, exact, lines: D.lines.length,
               numbered: nums.length === D.lines.length && nums.every((x, i) => x === i + 1),
               head: P[3] && P[3].p, first: J.JSONV.textOf(P[0]).split('\n').slice(0, 2).join(' | '),
               wraps: P.some(p => p.rows.some(r => !r.no)), live: G._jsonRow.live() };
    }, [G, JSON.stringify(v, null, 2)]);
    if (r.why) bad.push(r.why);
    else {
      if (!r.app) bad.push('the gallery is not the app');
      if (!(r.n > 3) || r.expect !== r.n) bad.push(`${r.n} pages, ${r.expect} expected by the gallery`);
      if (!r.exact) bad.push('the lines are not JSON.stringify(v, null, 2)\'s');
      if (!r.numbered) bad.push('the line numbers are not 1 to ' + r.lines);
      if (!/^\$\.users\[\d+\]/.test(r.head || '')) bad.push('page 4 is headed ' + r.head);
      if (!r.wraps) bad.push('the long string did not wrap');
      if (!r.live) bad.push('the row is not the file\'s');
      const row = await page.evaluate(g => (eval(g).statTiles() || []).map(t => t.value).join(), G);
      if (row !== 'Smaller,13,Larger,Shallower,All,Deeper,Colours: Light') bad.push('the settings row is ' + row);
      const tile = k => page.evaluate(k => { const t = [...document.querySelectorAll('#boardBrowser .bb-tile')].find(t => t._key === k && t.style.display !== 'none');
                                              const b = t && t.getBoundingClientRect(); return b && b.width ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; }, k);
      // Larger, the place kept: page 4 framed, its path, then the page framed after must hold that path's line.
      await page.evaluate(g => { const G = eval(g), J = G._json, c = G._cellFor(J.base + 3, tvf.target.cellX | 0, tvf.target.cellZ | 0); tvf.fn.gotoCell(c.c, c.r); }, G);
      await drawn(page, 1200);
      const p0 = await page.evaluate(g => { const G = eval(g), J = G._json, i = G._pick(tvf.target.cellX, tvf.target.cellZ) - J.base; return J.pages[i] && J.pages[i].p; }, G);
      let box = await tile('stat_2');
      if (!box) bad.push('no Larger tile on the screen');
      else {
        await page.mouse.click(box.x, box.y);
        await page.waitForFunction(g => { const G = eval(g); return G._json.JSONV.style.size === 14 && !G._jsonRow.busy; }, G, { timeout: 20000 }).catch(() => {});
        await drawn(page, 1500);
        const k = await page.evaluate(([g, p0]) => {
          const G = eval(g), J = G._json, i = G._pick(tvf.target.cellX, tvf.target.cellZ) - J.base, L = J.L;
          const li = L.lines.findIndex(l => l.p === p0);
          return { size: J.JSONV.style.size, holds: !!J.pages[i] && J.pages[i].first <= li && (!J.pages[i + 1] || li < J.pages[i + 1].first), n: J.pages.length };
        }, [G, p0]);
        if (k.size !== 14) bad.push('Larger left the size at ' + k.size);
        if (!(k.n > r.n)) bad.push(`larger type made ${k.n} pages from ${r.n}`);
        if (!k.holds) bad.push('the framed page does not hold ' + p0);
      }
      // Shallower (a real click to 8), then taps to 2: every record one folded line.
      box = await tile('stat_3');
      if (!box) bad.push('no Shallower tile on the screen');
      else {
        await page.mouse.click(box.x, box.y);
        await page.waitForFunction(g => { const G = eval(g); return G._json.JSONV.style.depth === 8 && !G._jsonRow.busy; }, G, { timeout: 20000 }).catch(() => {});
        for (let d = 8; d > 2; d = [1, 2, 3, 4, 5, 6, 8][[1, 2, 3, 4, 5, 6, 8].indexOf(d) - 1]){
          await page.evaluate(g => eval(g)._jsonRow.tap(3), G);
          await page.waitForFunction(g => !eval(g)._jsonRow.busy, G, { timeout: 20000 }).catch(() => {});
        }
        const f = await page.evaluate(g => { const J = eval(g)._json; return { depth: J.JSONV.style.depth, n: J.doc.lines.length,
          folded: J.doc.lines.filter(l => l.toks.some(t => t.k === 'fold' && /4 keys/.test(t.s))).length }; }, G);
        if (f.depth !== 2 || f.folded !== 120 || f.n !== 120 + 9) bad.push('at depth 2: ' + JSON.stringify(f));
      }
      const sep = await page.evaluate(async g => {
        const G = eval(g); await G._jsonRow.tap(6);
        const J = G._json, cv = document.createElement('canvas'); J.JSONV.paint(cv, J.L, J.pages[0], 96);
        const d = cv.getContext('2d').getImageData(2, 2, 1, 1).data; return { theme: J.JSONV.style.theme, px: [d[0], d[1], d[2]].join() };
      }, G);
      if (sep.theme !== 'sepia' || sep.px !== '243,231,204') bad.push('Colours did not paint the page sepia: ' + JSON.stringify(sep));
      await page.evaluate(g => { const S = eval(g)._json.JSONV.style; Object.assign(S, { size: 13, depth: 99, theme: 'light' }); try { localStorage.removeItem('json.style'); } catch {} }, G);
    }
    // Not JSON: the reason, the line marked.
    const broken = join(dir, 'broken.json');
    await writeFile(broken, '{"a": 1,\n "b": [1, 2,,3]\n}\n');
    await page.setInputFiles('#importImageFile', broken);
    await page.waitForFunction(g => { const G = eval(g); return G._json && G._json.label === 'broken.json'; }, G, { timeout: 30000 }).catch(() => {});
    const e = await page.evaluate(g => { const J = eval(g)._json; return J && { ok: J.doc.ok, line: J.doc.errLine, text: J.JSONV.textOf(J.pages[0]),
      marked: J.pages[0].rows.some(r => r.segs.some(s => s.k === 'err' && /2,,3/.test(s.s))) }; }, G);
    if (!e || e.ok || e.line !== 1 || !/Not JSON/.test(e.text) || !e.marked) bad.push('a broken file: ' + JSON.stringify(e));
    // JSON Lines: one array.
    const jl = join(dir, 'log.jsonl');
    await writeFile(jl, '{"t": 1, "msg": "up"}\n{"t": 2, "msg": "down"}\n\n{"t": 3, "msg": "up"}\n');
    await page.setInputFiles('#importImageFile', jl);
    await page.waitForFunction(g => { const G = eval(g); return G._json && G._json.label === 'log.jsonl'; }, G, { timeout: 30000 }).catch(() => {});
    const l = await page.evaluate(g => { const J = eval(g)._json; return J && { kind: J.doc.kind, notes: J.doc.notes.join(' '), n: J.doc.lines.length }; }, G);
    if (!l || l.kind !== 'jsonl' || !/3 records/.test(l.notes) || l.n !== 2 + 3 * 4) bad.push('JSON Lines: ' + JSON.stringify(l));
    if (bad.length) failures.push('[json] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} json: a file opened through the picker laid out as ${r.n} pages of JSON.stringify's lines, numbered, headed by their paths; the row its settings (Larger kept the place, depth 2 folded the records, Colours sepia); a broken file marked where it broke; JSON Lines one array`);
  }
  // THE DOTS, FULL SCREEN, AND TAB FROM THE BOARD IN VIEW (Oct 17: "1) the three dots on the bottom for the bottom panel should
  // be 2px larger and have a shadow. 2) add full screen option to the menu. 3) tab and enter should move to next board, from the
  // current visible board that is in the default position."): the dots 6px across with a drop shadow; a Full screen item on the
  // menu that the browser here can use; and Tab, after the view has slid two boards along and one down with nothing selected
  // there, going to the board right of the one now in view, not right of the board selected before the slide. Then Enter, in
  // an app that leaves Enter to the field, one further.
  {
    current = 'dots, full screen, tab';
    const bad = [];
    await page.evaluate(() => { if (!document.body.classList.contains('bb-collapsed')) document.getElementById('bbHandle').click(); });   // (the dots are hidden while the row is open: measured with it shut)
    await page.waitForFunction(() => document.body.classList.contains('bb-collapsed'), null, { timeout: 15000 }).catch(() => {});
    await drawn(page, 800);
    const d = await page.evaluate(() => {
      const svg = document.querySelector('#bbHandle svg'), c = svg && svg.querySelector('circle');
      const r = c && c.getBoundingClientRect();
      return { w: r && Math.round(r.width), shadow: svg && getComputedStyle(svg).filter,
               fs: (() => { const b = document.getElementById('bFullScreen'); return b ? { hidden: b.hidden, text: b.textContent, inMenu: !!b.closest('#menu') } : null; })() };
    });
    if (d.w !== 6) bad.push('a dot is ' + d.w + 'px across, not 6');
    if (!/drop-shadow/.test(d.shadow || '')) bad.push('the dots have no shadow');
    if (!d.fs || !d.fs.inMenu || d.fs.hidden || d.fs.text !== 'Full screen') bad.push('no Full screen item on the menu: ' + JSON.stringify(d.fs));
    const steps = [];
    for (const id of ['gallery', 'checkers']){
      await page.evaluate(id => { const a = window.FIELD_APPS.find(a => a.id === id); window.setFieldApp(a); }, id);
      await drawn(page, 2500);
      await page.evaluate(() => { FIELD_WORLD.st.yaw = 0; tvf.target.yaw = null; tvf.fn.gotoCell(0, 0); });   // facing forward, so right is −x
      await page.waitForFunction(() => !tvf.target.active, null, { timeout: 15000 }).catch(() => {});
      await drawn(page, 500);
      const slid = await page.evaluate(() => { const st = FIELD_WORLD.st, [sx, sz] = FIELD_WORLD.spacing(); st.camX -= 2 * sx; st.camZ -= sz;
                                                const v = tvf.fn.viewBoardCell(); return [v.c, v.r]; });
      await page.waitForTimeout(800);
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => !tvf.target.active, null, { timeout: 15000 }).catch(() => {});
      const afterTab = await page.evaluate(() => [tvf.target.cellX, tvf.target.cellZ]);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !tvf.target.active, null, { timeout: 15000 }).catch(() => {});
      const afterEnter = await page.evaluate(() => [tvf.target.cellX, tvf.target.cellZ]);
      steps.push(id + ' ' + [slid, afterTab, afterEnter].map(c => c.join(',')).join(' → '));
      if (slid.join() !== '-2,-1') bad.push(id + ': the board in view after the slide is ' + slid);
      if (afterTab.join() !== '-3,-1') bad.push(id + ': Tab went to ' + afterTab + ', not the board right of ' + slid);
      if (afterEnter.join() !== '-4,-1') bad.push(id + ': Enter went to ' + afterEnter);
    }
    if (bad.length) failures.push('[dots, full screen, tab] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} the dots 6px with a shadow, Full screen on the menu, Tab and Enter step from the board in view (${steps.join('; ')})`);
  }
  // THE LOADED FILE'S NAME OVER THE BOTTOM ROW, THE DOTS GONE WHILE IT IS OPEN, THE MENU ITEM JUST "Open" (Nov 1: "show … the name of the file that
  // was loaded on the top of the bottom browser, above the images. don't show the three dots when the bottom browser is open." and "the menu item
  // to open files should just say Open, not the file name."): a file opened through the picker, the row opened.
  {
    current = 'loaded name over the row';
    const bad = [];
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const md = '# Named\n\n' + 'Some words here. '.repeat(40) + '\n';
    await page.setInputFiles('#importImageFile', [{ name: 'shown-name.md', mimeType: 'text/markdown', buffer: Buffer.from(md) }]);
    await page.waitForFunction(() => { const E = window.GALLERY_APP._epub; return E && E.md; }, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => { if (document.body.classList.contains('bb-collapsed')) document.getElementById('bbHandle').click(); });
    await page.waitForFunction(() => !document.body.classList.contains('bb-collapsed'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => document.getElementById('bbName').textContent === 'shown-name.md', null, { timeout: 15000 }).catch(() => {});
    const r = await page.evaluate(() => { const n = document.getElementById('bbName'), h = document.getElementById('bbHandle'), m = document.getElementById('bLoadImage'), rc = n.getBoundingClientRect();
      return { name: n.textContent, shown: getComputedStyle(n).display !== 'none' && rc.width > 0, dots: getComputedStyle(h).display, menu: m.textContent }; });
    if (r.name !== 'shown-name.md' || !r.shown) bad.push('the file name is not over the open row: ' + JSON.stringify(r));
    if (r.dots !== 'none') bad.push('the dots are shown while the row is open: ' + r.dots);
    if (r.menu !== 'Open\u2026') bad.push('the menu item says ' + JSON.stringify(r.menu));
    if (bad.length) failures.push('[loaded name] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} loaded name: the open row carries the file's name in place of the dots, and the menu item says Open`);
    await page.evaluate(() => { if (!document.body.classList.contains('bb-collapsed')) document.getElementById('bbHandle').click(); });
  }
  // EVERY LOAD IS A FRESH SET (Nov 1: "opening images, reset the display, so the aspect ratio and number of images are set by each loading of a set of
  // images or file."): three landscape pictures are opened, then two portrait ones; the collection is the two alone and the board is portrait.
  {
    current = 'every load a fresh set';
    const bad = [];
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const png = (w, h, c) => page.evaluate(([w, h, c]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png').split(',')[1]; }, [w, h, c]);
    const A = await Promise.all([0, 1, 2].map(k => png(600, 300, '#c33')));
    await page.setInputFiles('#importImageFile', A.map((b, i) => ({ name: `first${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForFunction(() => window.GALLERY_APP._list.filter(e => e && /^first/.test(e.name)).length >= 3, null, { timeout: 120000 }).catch(() => {});
    const B = await Promise.all([0, 1].map(k => png(300, 600, '#36c')));
    await page.setInputFiles('#importImageFile', B.map((b, i) => ({ name: `second${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForFunction(() => window.GALLERY_APP._list.filter(e => e && /^second/.test(e.name)).length >= 2, null, { timeout: 120000 }).catch(() => {});
    await drawn(page, 1500);
    const r = await page.evaluate(() => ({ names: window.GALLERY_APP._list.filter(Boolean).map(e => e.name), n: window.GALLERY_APP._expect, w: window.LAB.cellW, h: window.LAB.cellH }));
    if (r.names.some(n => /^first/.test(n))) bad.push('the first set is still in the collection: ' + r.names.join(','));
    if (!(r.h > r.w)) bad.push('the board is not the second set\'s portrait shape: ' + JSON.stringify(r));
    if (bad.length) failures.push('[fresh set] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} every load a fresh set: two portrait pictures opened after three landscape ones are the whole collection, the board portrait`);
  }
  // A LOAD CLEARS THE FIELD AT ONCE (Nov 2: "Images are still visible when I load a file from the bucket.   Clear all images and reset the boards"):
  // pictures are opened, then a bucket file (the bucket mocked, its answer held back two seconds); while it is still on its way the field holds
  // no picture and the board is square, and then the file arrives.
  {
    current = 'a load clears the field';
    const bad = [];
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1000);
    const pn = await Promise.all([0, 1].map(k => page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#36c'; x.fillRect(0, 0, 300, 600); return c.toDataURL('image/png').split(',')[1]; })));
    await page.setInputFiles('#importImageFile', pn.map((b, i) => ({ name: `clr${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForFunction(() => window.GALLERY_APP._list.filter(e => e && /^clr/.test(e.name)).length >= 2, null, { timeout: 120000 }).catch(() => {});
    await page.route(/flare\.tangent\.workers\.dev\/bucket\?bucket=BUCKET1&key=slow\.md/, async r => { await new Promise(ok => setTimeout(ok, 2500)); r.fulfill({ contentType: 'text/markdown', headers: { 'access-control-allow-origin': '*' }, body: '# Slow\n\n' + 'Some words here. '.repeat(40) + '\n' }); });
    await page.evaluate(() => { window.tvfBucket.cli({ bucket: 'BUCKET1', file: 'slow.md' }); });
    await drawn(page, 700);
    const mid = await page.evaluate(() => ({ n: window.GALLERY_APP._list.filter(Boolean).length, expect: window.GALLERY_APP._expect, w: window.LAB.cellW, h: window.LAB.cellH }));
    if (mid.n !== 0 || mid.expect !== 0) bad.push('pictures are still held while the file is on its way: ' + JSON.stringify(mid));
    if (Math.abs(mid.w - mid.h) > 0.01) bad.push('the board was not put back to a square: ' + JSON.stringify(mid));
    await page.waitForFunction(() => { const E = window.GALLERY_APP._epub; return E && E.md && E.label === 'Slow'; }, null, { timeout: 60000 }).catch(() => {});
    const after = await page.evaluate(() => { const E = window.GALLERY_APP._epub; return { label: E ? E.label : null, names: window.GALLERY_APP._list.filter(Boolean).map(e => e.name).filter(n => /^clr/.test(n)) }; });
    if (after.label !== 'Slow' || after.names.length) bad.push('the file did not arrive alone: ' + JSON.stringify(after));
    if (bad.length) failures.push('[load clears] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} a load clears the field: the pictures went the moment a bucket file was asked for, the board square, and the file came alone`);
    await page.evaluate(() => { try { localStorage.removeItem('gallery.last'); } catch {} });
  }
  // THE LAST BUCKET LOAD IS KEPT (Nov 1: "save the last bucket file to load on refresh."): what `gallery.last` holds is opened again on a
  // load into the gallery (the bucket mocked, one markdown file).
  {
    current = 'bucket restore';
    const bad = [];
    await page.route(/flare\.tangent\.workers\.dev\/bucket\?bucket=BUCKET1&key=kept\.md/, r => r.fulfill({ contentType: 'text/markdown', headers: { 'access-control-allow-origin': '*' }, body: '# Kept\n\n' + 'Some words here. '.repeat(40) + '\n' }));
    await page.evaluate(() => localStorage.setItem('gallery.last', JSON.stringify({ k: 'bucket', bucket: 'BUCKET1', names: ['kept.md'] })));
    await page.goto(page.url().split('?')[0].split('#')[0] + '?app=gallery', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.getFieldApp && window.getFieldApp() && window.getFieldApp().id === 'gallery', null, { timeout: 150000 }).catch(() => {});
    await page.waitForFunction(() => { const E = window.GALLERY_APP && window.GALLERY_APP._epub; return E && E.md && E.label === 'Kept'; }, null, { timeout: 60000 }).catch(() => {});
    const r = await page.evaluate(() => { const E = window.GALLERY_APP._epub; return E ? E.label : null; });
    if (r !== 'Kept') bad.push('the bucket file was not opened again on a load: ' + r);
    if (bad.length) failures.push('[bucket restore] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} bucket restore: the last bucket file opened again on a load`);
    await page.evaluate(() => { try { localStorage.removeItem('gallery.last'); } catch {} });
  }
  /* NEVER PIXELATED (Nov 2: "you are still loading images with heavy pixelation. Under no circumstances are you to do that."): the gallery's
     tile layer, seen under a print that is not drawn yet, is one flat tone for every print at every size, never a grid of coarse blocks. */
  {
    current = 'gallery never pixelated';
    const bad = [];
    const r = await page.evaluate(() => { const G = window.GALLERY_APP, out = []; if (!G || !G._cellFor) return null;
      for (let i = 0; i < 6; i++){ const c = G._cellFor(i, 0, 0); if (!c) continue; for (const bp of [20, 100, 300, 800]) out.push(G.cellGrid(c.c, c.r, bp)); }
      return out; });
    if (!r || !r.length) bad.push('no cell to read: ' + JSON.stringify(r));
    else if (r.some(g => g !== null)) bad.push('a board\'s tile layer drew something under its print: ' + JSON.stringify(r));
    // (and the far ground is the field's own dark, for a board with no picture drawn: nothing coloured, nothing small)
    const fb = await page.evaluate(() => { const G = window.GALLERY_APP, cv = document.createElement('canvas'); cv.width = cv.height = 8; const x = cv.getContext('2d'); x.fillStyle = '#f00'; x.fillRect(0, 0, 8, 8);
      G.fabricCellAt(x, { x: 0, y: 0, w: 8, h: 8 }, 0, 0); const d = x.getImageData(4, 4, 1, 1).data; return [d[0], d[1], d[2]]; });
    if (fb[0] > 30 || fb[1] > 30 || fb[2] > 40) bad.push('the far ground painted a board with no picture drawn as ' + fb.join(','));
    if (bad.length) failures.push('[gallery never pixelated] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} gallery never pixelated: ${r ? r.length : 0} tile layers read, none drawn; a board with no picture is the dark ground`);
  }
  /* A FRESH LOAD DOES NOT ANIMATE (Nov 2: "it is still animating on load."): three pictures opened through the real picker, the camera sampled
     every 40 ms for five seconds, goes from where it was to where the default fit puts it in a step or two, never a glide. */
  {
    current = 'fresh load does not animate';
    const bad = [];
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => a.id === 'gallery')));
    await drawn(page, 1500);
    const png = (w, h, c) => page.evaluate(([w, h, c]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); for (let k = 0; k < 200; k++){ x.fillStyle = 'hsl(' + (k * 47 % 360) + ',70%,50%)'; x.fillRect((k * 37) % w, (k * 91) % h, 12, 12); } return cv.toDataURL('image/png').split(',')[1]; }, [w, h, c]);
    const A = await Promise.all([0, 1, 2].map(k => png(1200, 800, '#274')));
    await page.setInputFiles('#importImageFile', A.map((b, i) => ({ name: `anim${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    const seen = [], t0 = Date.now();
    while (Date.now() - t0 < 5000){
      const c = await page.evaluate(() => { try { const q = window.FIELD_WORLD.camera.position, s = window.tvf.state; return q.x.toFixed(1) + ',' + q.y.toFixed(1) + ',' + q.z.toFixed(1) + '|' + (s.zoom || 0).toFixed(0); } catch { return null; } });
      if (c && seen[seen.length - 1] !== c) seen.push(c);
      await page.waitForTimeout(40);
    }
    if (seen.length > 6) bad.push('the view glided through ' + seen.length + ' positions on a load: ' + seen.slice(0, 8).join(' '));
    if (bad.length) failures.push('[fresh load does not animate] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} fresh load does not animate: the camera went through ${seen.length} positions in five seconds, no glide`);
  }
  /* THE FIRST PLACING IS A JUMP (Nov 2: "the inital load and display of images is not smooth because images are being loaded and
     panning is then not smooth. I propose the initial load does not animate, it should go directly to the image"): a bucket file of
     eight chapters is opened again on a load with page 3 kept for it; the camera, sampled every 40 ms, must go from the corner to
     that page in at most one step in between, not glide there over seconds. */
  {
    current = 'first placing is a jump';
    const bad = [];
    await page.route(/flare\.tangent\.workers\.dev\/bucket\?bucket=BUCKET1&key=jump\.md/, r => r.fulfill({ contentType: 'text/markdown', headers: { 'access-control-allow-origin': '*' },
      body: Array.from({ length: 8 }, (_, i) => `# Chapter ${i}\n\n` + 'Some words here. '.repeat(120) + '\n').join('\n') }));
    await page.evaluate(() => {
      localStorage.setItem('gallery.last', JSON.stringify({ k: 'bucket', bucket: 'BUCKET1', names: ['jump.md'] }));
      localStorage.setItem('gallery.pos', JSON.stringify({ 'b:BUCKET1:jump.md': { i: 3 } }));
    });
    await page.goto(page.url().split('?')[0].split('#')[0] + '?app=gallery', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.FIELD_WORLD && window.getFieldApp && window.getFieldApp() && window.getFieldApp().id === 'gallery', null, { timeout: 150000 }).catch(() => {});
    const seen = [], t0 = Date.now();
    let firstShown = null;   // (the camera the first moment the field is on show: Nov 2, "load that image directly, don't first load the first image")
    while (Date.now() - t0 < 14000){
      const c = await page.evaluate(() => { try { const q = window.FIELD_WORLD.camera.position; return q.x.toFixed(1) + ',' + q.z.toFixed(1) + (document.querySelector('canvas').style.visibility === 'hidden' ? '#h' : ''); } catch { return null; } });
      if (c && !c.endsWith('#h') && firstShown === null) firstShown = c;
      if (c && seen[seen.length - 1] !== c.replace('#h', '')) seen.push(c.replace('#h', ''));
      await page.waitForTimeout(40);
    }
    // (the corner, perhaps a settling nudge, then the page: a glide would show a dozen steps)
    if (seen.length > 5) bad.push('the view glided to the kept page through ' + seen.length + ' positions');
    if (seen.length < 2) bad.push('the view never moved to the kept page: ' + seen.join(' '));
    if (firstShown !== null && seen.length >= 2 && firstShown !== seen[seen.length - 1]) bad.push('the field was shown at ' + firstShown + ' before the kept page ' + seen[seen.length - 1]);
    if (bad.length) failures.push('[first placing is a jump] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} first placing is a jump: the kept page was reached in ${seen.length} camera positions, no glide`);
    await page.evaluate(() => { try { localStorage.removeItem('gallery.last'); localStorage.removeItem('gallery.pos'); } catch {} });
  }
  /* A TAP ON THE MAIN DISPLAY SHUTS THE ROW (Nov 2: "tapping the main display should close the bottom browser"): the gallery's row
     (its prints, not a numbers row, which already went) open, a real click on the field shuts it. */
  {
    current = 'tap closes the row';
    await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === 'gallery')));
    await drawn(page, SETTLE_MS);
    await page.evaluate(() => { window.tvf.fn.toggleBoardBrowser(true); window.tvf.fn.syncBrowserVisibility(); });
    await drawn(page, 700);
    const was = await page.evaluate(() => window.tvf.bottomRow.visible);
    await page.mouse.click(640, 300);
    await drawn(page, 800);
    const now = await page.evaluate(() => window.tvf.bottomRow.visible);
    const bad = [];
    if (!was) bad.push('the row did not open');
    if (now) bad.push('a click on the field left the row open');
    if (bad.length) failures.push('[tap closes the row] ' + bad.join('; '));
    console.log(`${bad.length ? 'FAIL' : 'ok  '} tap closes the row: a click on the field shut the gallery's row`);
    // A SWIPE ALWAYS SETS THE AUTO MOVE AT THE SWIPE'S SPEED, A TAP STOPS IT (Nov 2: "Always auto move on swipe.   Tap stops the auto move.
    // Panning controls the auto move speed."): the launch is called with a release speed (a hand's timing cannot be scripted through the
    // software renderer): a slow swipe, a hard one while the first still runs, a gentle one again, then a real click on the field.
    {
      const sw = await page.evaluate(() => { const g = window.FIELD_WORLD.spacing()[0], T = window.tvf, o = {}; o.slow = T.swipeDrift(g * 0.03).rate; o.fast = T.swipeDrift(g * 0.25).rate; o.slowAgain = T.swipeDrift(g * 0.03).rate; return o; });
      await page.mouse.click(300, 300);
      await drawn(page, 400);
      sw.afterTap = await page.evaluate(() => window.FIELD_WORLD.st.heldPanRate || 0);
      const bd = [];
      if (!(sw.slow > 0)) bd.push('a swipe did not start the auto move: ' + JSON.stringify(sw));
      if (!(sw.fast > sw.slow * 1.5)) bd.push('a harder swipe did not make it faster: ' + JSON.stringify(sw));
      if (Math.abs(sw.slowAgain - sw.slow) > 1e-6) bd.push('a swipe while it ran did not set its speed: ' + JSON.stringify(sw));
      if (sw.afterTap !== 0) bd.push('a tap did not stop the auto move: ' + JSON.stringify(sw));
      if (bd.length) failures.push('[swipe auto move] ' + bd.join('; '));
      console.log(`${bd.length ? 'FAIL' : 'ok  '} swipe auto move: speeds ${sw.slow.toFixed(2)} → ${sw.fast.toFixed(2)} → ${sw.slowAgain.toFixed(2)} screens a second by the swipe, a tap stopped it`);
    }
    // THE TILT NUB IS GRABBED, NOT CHASED (Nov 4: "I can't grab the tilt nub on the left scroll bar for tilt."): a real press on the nub and a
    // real drag down the rail must leave the nub under the finger as it goes (it trailed by seconds on the tangent ramp), and let go it stays.
    {
      await page.evaluate(() => window.setFieldApp(window.FIELD_APPS.find(a => (a.id || a.name) === 'checkers')));
      await drawn(page, SETTLE_MS);
      const nub = () => page.evaluate(() => { const m = document.getElementById('tiltMark').getBoundingClientRect(); return { x: m.left + 10, y: m.top + 4 }; });
      const n0 = await nub();
      const hit = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) || {}).id, [n0.x, n0.y]);
      await page.mouse.move(n0.x, n0.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++){ await page.mouse.move(n0.x, n0.y + i * 10); await page.waitForTimeout(30); }
      await page.waitForTimeout(150);
      const n1 = await nub();
      await page.mouse.up();
      const bd = [];
      if (hit !== 'tiltZone') bd.push('the nub is covered by ' + hit);
      if (Math.abs(n1.y - (n0.y + 80)) > 12) bd.push(`the nub trailed the finger: finger ${n0.y + 80}, nub ${n1.y.toFixed(1)}`);
      if (bd.length) failures.push('[tilt nub grab] ' + bd.join('; '));
      console.log(`${bd.length ? 'FAIL' : 'ok  '} tilt nub grab: dragged 80 px, the nub is at ${(n1.y - n0.y).toFixed(0)} px`);
    }
  }
} catch (e){
  failures.push(`[${current}] ${e.message}`);
}

await T.finish();
