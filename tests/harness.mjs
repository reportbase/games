// What every part of the smoke test needs: the repo served on a free port, headless Chromium, the page loaded and
// its apps ready, the two helpers the page is given (__settle, __aim), the list of failures and how a run ends.
//
// tests/smoke.mjs was one file of 8,562 lines (12 Nov 2026: "1,2,3,4,5,6", to a list whose sixth was "Games: split
// its smoke test like draw's"). Its checks were already cut into seven parts that shared nothing but what stood
// above the first, so each part is now a file (tests/part1.mjs … part7.mjs) that runs on its own or side by side,
// and this file is what stood above and below them. A part begins `const T = await begin(k, () => current)` and
// ends `await T.finish()`.
//
//   BASE_URL=http://host/        test an already-running server instead of serving the repo
//   LIBS_DIR=path/node_modules   serve three.js, chess.js and unzipit from local npm copies (three@0.128.0,
//                                chess.js@1.4.0, unzipit@2.0.1), for a sandbox where the CDNs are blocked
//   SETTLE_MS=1500               the time each app gets to run
//   CHROMIUM_PATH=…              another Chromium
//
// Console errors (a CDN hiccup, the coach's sign-in check) are printed but do not fail the run; uncaught exceptions do.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SETTLE_MS = Number(process.env.SETTLE_MS || 1500);   // time each app gets to run
export const PARTS = 7;
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

/* A REQUEST TO ANOTHER SERVER IS GIVEN 20 SECONDS (Oct 28): a library from a CDN that never answered held a part's page past two
   minutes, even waiting for the page's own content alone (a script in the head holds the parsing). Every request off the test's own
   server is fetched here with a time limit and dropped past it, as if the network had refused it, which the page already copes
   with. Registered first, so the LIBS_DIR routes below (registered later, asked first) still serve their files.
   Every page the test opens gets it (`timeLimit`): the share links' and puzzle makers' pages of their own timed out without it. */
export const timeLimit = pg => pg.route(u => !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u.href) && !/^(data|blob):/.test(u.href), async r => {
  try { const res = await r.fetch({ timeout: 20000 }); await r.fulfill({ response: res }); }
  catch { try { await r.abort(); } catch {} }
});

/* begin(k, current): part k's server, browser and page, the page loaded on chess with its apps ready. `current` is a function
   that returns the part's own `current`, the check under way, which names an uncaught error: the checks set it as a plain
   variable, as they did in the one file, so the part hands over a way to read it rather than the checks being rewritten.
   What comes back is what the checks use by name: base, browser, page, failures, ids (every app's id) and cdp. */
export async function begin(k, current){
  const server = process.env.BASE_URL ? null : await serve();
  const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}/`;

  const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await timeLimit(page);
  if (process.env.LIBS_DIR){
    const lib = f => readFile(join(process.env.LIBS_DIR, f));
    await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.module\.min\.js/, async r =>
      r.fulfill({ contentType: 'text/javascript', body: await lib('three/build/three.module.js') }));
    await page.route(/cdn\.jsdelivr\.net\/npm\/chess\.js@1\.4\.0\/\+esm/, async r =>
      r.fulfill({ contentType: 'text/javascript', body: await lib('chess.js/dist/esm/chess.js') }));
    // unzipit too, if it is there (unzipit@2.0.1): the EPUB check needs it.
    if (await access(join(process.env.LIBS_DIR, 'unzipit/dist/unzipit.min.js')).then(() => true, () => false))
      await page.route(/unpkg\.com\/unzipit@2\.0\.1\/dist\/unzipit\.min\.js/, async r =>
        r.fulfill({ contentType: 'text/javascript', body: await lib('unzipit/dist/unzipit.min.js') }));
  }

  console.log(`part ${k} of ${PARTS}`);

  const failures = [];
  page.on('pageerror', e => failures.push(`[${current()}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') console.log(`  console (${current()}): ${m.text().slice(0, 200)}`); });

  const T = { part: k, base, browser, page, failures, ids: [], cdp: null };

  T.finish = async function finish(){
    let code = 0;
    if (failures.length){
      console.error(`\n${failures.length} failure(s):\n` + failures.map(f => '  ' + f).join('\n'));
      code = 1;
    } else {
      console.log('\nall apps loaded without errors');
    }
    await browser.close();
    server?.close();
    process.exit(code);
  };

  try {
    // (not 'load': that waits on every request the page makes, and one from a CDN that never answered held a part's page load
    //  past two minutes on CI, Oct 28; the page is ready when its apps are, which the next line waits for)
    // (?app=chess: the page opens on Home now (Nov 7), and these checks begin where the page used to open)
    await page.goto(new URL('games.html?app=chess', base).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => Array.isArray(window.FIELD_APPS) && window.FIELD_APPS.length > 0
                                     && typeof window.setFieldApp === 'function', null, { timeout: 120000 });
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
    T.ids = await page.evaluate(() => window.FIELD_APPS.map(a => a.id || a.name));
    console.log(`page loaded, ${T.ids.length} apps`);
    T.cdp = await page.context().newCDPSession(page);
  } catch (e){
    // (the page did not load: in the one file the same catch that ends a part's checks took this, and the run ended the same way)
    failures.push(`[${current()}] ${e.message}`);
    await T.finish();
  }
  return T;
}
