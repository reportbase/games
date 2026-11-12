// The smoke test: every part, one after another, then the course test (npm test); or the parts named.
//
//   npm test                         every part, then tests/golf-course.mjs if they all passed
//   npm test -- 3 5                  those parts (part3 and part5 say the same); `course` names the course test
//   SHARD=3/7 node tests/smoke.mjs   part 3 alone, as before the test was split
//   JOBS=3 npm test                  three parts at a time (each part's output printed whole when it ends)
//   BASE_URL=http://host/ npm test   test an already-running server instead of serving the repo
//   LIBS_DIR=path/node_modules npm test
//                                    serve three.js, chess.js and unzipit from local npm copies (three@0.128.0,
//                                    chess.js@1.4.0, unzipit@2.0.1), for a sandbox where the CDNs are blocked
//
// The test was one file until 12 Nov 2026 ("1,2,3,4,5,6", to a list whose sixth was "Games: split its smoke test
// like draw's"). It loads games.html in headless Chromium, switches to every app in window.FIELD_APPS and runs each
// game's checks, and fails if the page throws an uncaught error anywhere or a check does. Its checks are in the
// seven part files beside this one, unchanged (tests/part1.mjs … part7.mjs, the parts SHARD=k/7 already chose), each
// run by `node tests/partK.mjs` as a process of its own with its own server and browser (tests/harness.mjs), so a
// failure is rerun alone and CI runs the parts side by side (.github/workflows/smoke.yml).
//
// A new check goes at the end of the part it sits beside, or in the shortest part. Nothing declared in one part is
// used in another: each loads the page afresh and sets its own app.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PARTS = 7;
const COURSE = 'course';                                  // tests/golf-course.mjs, which npm test has always run after the smoke test
const names = Array.from({ length: PARTS }, (_, i) => 'part' + (i + 1));
const fileOf = name => name === COURSE ? 'golf-course.mjs' : name + '.mjs';

const [SHARD_K, SHARD_N] = (process.env.SHARD || '').split('/').map(Number);
if (process.env.SHARD && !(SHARD_N === PARTS && SHARD_K >= 1 && SHARD_K <= PARTS)){
  console.error(`SHARD ${process.env.SHARD}: the test has ${PARTS} parts`); process.exit(2);
}
const asked = process.argv.slice(2).map(a => /^\d+$/.test(a) ? 'part' + a : a);
const unknown = asked.filter(a => a !== COURSE && !names.includes(a));
if (unknown.length){ console.error(`no such part: ${unknown.join(', ')} (the parts: 1 to ${PARTS}, and ${COURSE})`); process.exit(2); }
// SHARD picks one part and nothing else; names pick theirs; with neither it is every part and then the course
const parts = SHARD_K ? ['part' + SHARD_K] : asked.length ? names.filter(p => asked.includes(p)) : names;
const course = !SHARD_K && (!asked.length || asked.includes(COURSE));
const jobs = Math.max(1, Math.min(parts.length, Number(process.env.JOBS) || 1));

function run(name, quiet){
  const t0 = Date.now();
  return new Promise(done => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(fileOf(name), import.meta.url))],
                        { stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let out = '';
    if (quiet) for (const s of [child.stdout, child.stderr]) s.on('data', d => { out += d; });
    child.on('close', code => {
      if (quiet) process.stdout.write(`\n── ${name} ──\n${out}`);
      done({ name, code: code ?? 1, s: Math.round((Date.now() - t0) / 1000) });
    });
  });
}

const results = [], queue = [...parts];
await Promise.all(Array.from({ length: jobs }, async () => {
  for (let p; (p = queue.shift());){
    if (jobs === 1 && parts.length + course > 1) console.log(`\n── ${p} ──`);
    results.push(await run(p, jobs > 1));
  }
}));
results.sort((a, b) => parts.indexOf(a.name) - parts.indexOf(b.name));
// (the course test after the parts and only if they passed, as `node tests/smoke.mjs && node tests/golf-course.mjs` ran it)
if (course && !results.some(r => r.code)){
  if (parts.length) console.log(`\n── ${COURSE} ──`);
  results.push(await run(COURSE, false));
}

if (results.length > 1) console.log('\n' + results.map(r => `${r.code ? 'FAIL' : 'ok  '} ${r.name.padEnd(8)} ${r.s} s`).join('\n'));
const bad = results.filter(r => r.code);
if (bad.length){ if (results.length > 1) console.error(`\n${bad.length} part(s) failed: ${bad.map(r => r.name).join(', ')}`); process.exit(1); }
