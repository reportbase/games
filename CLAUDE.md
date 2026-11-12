# games: notes for Claude

A 3D field of boards you fly over, with ~50 games in one page (and Levels, a demonstration of level of detail) (chess against
Stockfish with a Claude coach, checkers, Go, Tetris, Pac-Man, Sokoban, …), served
by GitHub Pages at https://reportbase.github.io/games/. The owner works through
Claude Code: changes go on a branch, as a PR, and the owner merges. Merging to
`main` publishes.

This file holds the rules: what each file is, how the page is put together, what every game
follows, how to test. The dated notes of what was built and why (the owner's words, the names to
search for in `games.html`, the numbers measured) are in `docs/`, by part; **read the one for the
part you are about to change**, and add to it when you change it:

| Working on | Read |
| --- | --- |
| mini golf: the course, the generator, difficulty, the ground's shapes, the movers, the hole editor | `docs/minigolf.md` |
| Board War | `docs/boardwar.md` |
| pinball, Pong, air hockey, squash, curling, bowling, marble run, the tanks, trick shots | `docs/tables.md` |
| the tilt maze, Bejeweled, Simon, Lights Out, Whack-a-mole, Nonograms, Sudoku, Hashi, Sokoban, the puzzle makers, 3D Tetris, Soma, the flash cards, the game lab | `docs/puzzles.md` |
| Invaders, Missile Command, Asteroids, the crossing, tower defense | `docs/arcade.md` |
| chess, the board games' position editor, share links, Levels | `docs/boards.md` |
| the photo gallery, the EPUB, JSON and Markdown readers, loading files and buckets | `docs/gallery.md` |
| the field itself and what games share: Home, taps and holds, the bottom row, the rails, levels by ring, the kits, fonts, drawing, speed | `docs/field.md` |

## Files
- `games.html`: **the whole program and the file to edit.** About 41,000 lines,
  one self-contained page with no build step. Some blocks inside are marked
  "generated, do not edit here" (the inlined field-lib, the runtime assets). Their
  original sources and build scripts no longer exist, so **this file is now the
  source**: edit those blocks in place, carefully.
- `stockfish-18-lite-single.js` and `.wasm`: the chess engine. `games.html` loads
  them as a Worker from beside itself, so they must stay in the same folder. This
  is why the game runs on Pages but has no engine as a single-file chat artifact.
- `index.html`: forwards `/games/` to `games.html`, keeping `?app=…`.
- `res/`: the `.tvf3d` files the page fetches from beside itself. `res/windmill.tvf3d` is
  mini golf's windmill, a prop from the 3d studio (a `TVF3D-PARTS` file, like a piece);
  without it the windmills are drawn with the old plain shapes. `bumper`, `rock` and
  `pipe` (Oct 7) are the course's other props, each with a plain fallback shape.
  New props go here too.
- `explainers/`: nine MP4 videos of draw's scrolling explainers (reading, turned, addresses, nearfar, standpoints, pictures, rates, bridge, leaves), 1280×720, made from draw's scenes by `npm run video` there (`tools/explainer-video.mjs`: the player's frames into ffmpeg, a chapter a beat, the beat words as soft subtitles; Nov 8: "can you make videos of the explainers?", then "add them to the repo"). They are outputs of draw's `player/examples/*.tvfs`, so draw is their source: render them again there, not here. The page does not load them.
- `decks/`: deck files for the flash cards (`.tsv`, Anki-style `#deck`/`#ask` lines and a header), to open, drop or put in a
  bucket. The page never loads them by itself: decks are loaded as files are (Oct 25).

## How the page is put together
- **Apps:** each game is an app object (`CHESS_APP`, `TETRIS_APP`, …), with the
  shared parts in the APP KIT and ARCADE sections. A new app goes into
  `window.FIELD_APPS` (around line 36284) and gets a short id in the
  `[[APP, 'id'], …]` list just below it. The id is what `?app=` uses, and the
  smoke test reaches every app through that list.
- **External services:**
  - the Claude coach talks to the `login.tangent.workers.dev` gateway (the page
    holds no API key)
  - bucket files (piece shapes, pictures) are read from
    `flare.tangent.workers.dev`; games only reads from flare, never writes
- **Chess pieces** are `.tvf3d` fields from flare's BUCKET1 (`PIECE_FILES`).
  A `TVF3D-PARTS` file is a piece of several parts, written by the 3d studio's
  "export as a chess piece": `parseTVF3D` reads it and `buildPartsGeometry`
  lays the parts into one mesh. The format is defined on the 3d side
  (`buildPieceTVF3D`); change the two together. Dropping or opening a
  `.tvf3d` named after a piece swaps it in for the session (`loadPieceFiles`).
- **Props** (`PROPS`, `propC`) are other games' objects in the same format, loaded
  from beside the page. Mini golf's windmill is the first: the parts named
  `sail …` turn (`millGeos`, an item's `yaw`) and the rest stand. A prop is the
  look only: the game's own collisions stay as they were. A dropped `.tvf3d`
  named after a prop (`my_windmill.tvf3d`) swaps it in for the session.

## What every game follows
Each of these was asked for and is told in full in `docs/field.md` (or the game's own file);
a new game or a change keeps to them.
- **Shared kits, not copies.** A game with levels uses `BOARD_KIT` (`boardIdx`, `ringOf`,
  `levelAt`, `rng`, `best`, `gameAt`, `liveGame`, `budget`, `phase`, `loopT`, `frameAt`,
  `painted`, `say`, `stars`, `yawOf`, `flat`, `type`); a match game `MATCH_KIT` (recordings,
  hands, best); a game that makes its own boards in the row `EDIT_KIT`; sounds
  `ARCADE.sounds`; dot lettering `DOT_FONT`; words on a board `BOARD_KIT.type`; any text
  `UI_SANS` (monospace `UI_MONO`), sized in rem.
- **Every board its own game, harder farther out.** A board's game is made from its number
  (`boardIdx`, seeded, so always the same) at a level 1–5: the ring level plus the Difficulty
  (Easy 0, Normal 1, Hard 2). Par comes from a steady player playing it; a puzzle is kept only
  if it can be solved. The menu says `Difficulty: Easy | Normal | Hard`.
- **A board no one plays plays itself** (a recording or its solution, each board at its own
  phase), worked out in the boards' share of time (`BOARD_KIT.budget`), never all at once.
- **Only the user moves the view.** No game flies to another board by itself. A single tap
  never selects another board; a double tap brings one in; a tap on the board you are on is
  the game's. A long press toggles the bottom row (Minesweeper keeps its flag).
- **Games play with the row shut.** The row never opens by itself; what a gesture cannot do
  goes on the play pad (`playActs`). An editor's row is opened by its ✎ or menu item.
- **No notices from games.** `BOARD_KIT.say` does nothing; a board's title and the board
  itself say what is going on. The field's own notices (`engineNotice`) are for errors.
- **Never a yaw of exactly 0** on a turned item (`BOARD_KIT.yawOf`): the field leaves it
  unturned, half a turn from the rest.
- **Trick shots' worker** is made from its own text up to "IN THE FIELD": nothing of a kit
  may go above that line.
- **Draw only what is seen, in full.** Every board on the screen has all its pieces at any
  size; detail fades by the kits' morphing kinds, never by swapping pieces.

## Shared with draw: change with care
`games.html` carries two blocks of draw's **verbatim**, inside `const TVF_CURVE = (() => { … })()` before `GOLF_APP`:
the tvf-core library (`// >>> copied from draw.html, unchanged: tvf-core`, draw's `tvf-core.js`) and `parseTvfText`
(`… unchanged: tvf-reader`, draw's `tvf-reader.js` since 12 Nov 2026; it was in `draw.html`), each ending at its
`// <<< end of NAME`. Don't edit inside them: fix draw first, then copy
across. `node tests/draw-sync.mjs` (also the weekly "Draw sync" workflow) fails when they drift from draw's `main`
(`DRAW_HTML=../draw/draw.html` compares with a local draw). `TVF_CURVE` is the curve library; the older `TVF` is the
3D shape helper the field-lib uses, a different thing.

## Conventions
- Comments explain *why*, at length, and often quote the owner's request with a
  date, e.g. `(Sep 22: "…")`. There are hundreds of these. Keep the voice: when a
  change follows a request, record it the same way.
- The account of a change (what was asked, what was built, what was measured, what the smoke
  test checks) goes in the `docs/` file for its part, as a dated note in the voice those have;
  a new rule that every game must follow goes here, in a line.
- Keep the program in the one file. Don't split it up or add a build step without
  asking.

## Testing
- **Test the editor with real input.** The smoke test's "real touches" check sends touch events (with
  the pointer events a phone sends before them) to the canvas; checks that call `onCellTap`/`onPan`
  directly passed for a week while the phone did not. A tap's touchstart and touchend go together
  there, because the software renderer can take a second a frame.
- `npm test` runs `tests/smoke.mjs`: it loads the page in headless Chromium,
  switches to every app in `FIELD_APPS`, and fails on any uncaught error. Add checks there for new behaviour.
  **Not for every change** (Oct 17: "its not needed for every change."): CI runs it once, on the PR
  (`.github/workflows/smoke.yml`: not again on `main` after the merge, not for a PR of Markdown alone, and by hand
  from the Actions tab). Locally, a change is checked with a probe of what it touches and left to CI. **Don't run the full
  smoke test (about 20 minutes in a sandbox) or the whole course test locally unless the owner asks** (Oct 20: "the smoke test
  takes to long. stop doing them unless I ask."). It then runs
  `tests/golf-course.mjs`, which plays every golf hole in the page's own physics
  with a greedy player and fails on a hole it can't sink within par + 3.
- **Seven parts side by side** (Oct 28: "2", the faster smoke test: a CI run took 30 minutes, 26 of the smoke test and 3.5 of
  the course test): `tests/smoke.mjs`'s checks are cut into `PARTS` (7) contiguous parts of three to five minutes, each in an
  `if (part(k)) { … }` at the end of its blocks (part 7 the three games of Oct 28), and `SHARD=k/7` runs one (the page loaded afresh, each part setting its own
  app; no part uses a name another declares, `cdp` being made at the start for all). With no `SHARD` every part runs, as
  `npm test` does. CI (`smoke.yml`) runs the seven parts and the course test as eight jobs at once, then a job named `smoke`
  that passes only if all of them did, so a run takes about as long as its longest part. A new check goes at the end of the
  part it sits beside or in the shortest one; one part alone runs locally as `SHARD=3/7 node tests/smoke.mjs`.
- **CI serves the CDN libraries itself** (Oct 28): a CDN that would not answer held every part's page from loading, so `smoke.yml`
  installs three@0.128.0, chess.js@1.4.0 and unzipit@2.0.1 and runs the tests with `LIBS_DIR`; every other request off the
  test's own server is given 20 s and dropped past it (`timeLimit` in the smoke test, the same in the course test).
- In a cloud sandbox the CDNs may be blocked. Install `three@0.128.0` and
  `chess.js@1.4.0` somewhere and run `LIBS_DIR=that/node_modules npm test`; the
  test then serves both from there.

## Related repos
- **3d:** the shape studio; it exports `.tvf3d`, the chess piece format read here.
- **flare:** the storage Worker this page reads buckets from.
- **draw:** the 2D shape editor; the source of the TVF blocks above (mini golf's paths are its curves).
