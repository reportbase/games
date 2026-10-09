# games: notes for Claude

A 3D field of boards you fly over, with ~37 games in one page (chess against
Stockfish with a Claude coach, checkers, Go, Tetris, Pac-Man, Sokoban, …), served
by GitHub Pages at https://reportbase.github.io/games/. The owner works through
Claude Code: changes go on a branch, as a PR, and the owner merges. Merging to
`main` publishes.

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
- **Mini golf** (`GOLF_APP`, Oct 7) is played on a golden board: 8×13 cells, the short
  side at the bottom for phones, declared as the app's `boardShape: {cellW, cellH}`
  (the field calls `applyBoardShape` with it). Physics runs in square units (x in
  [0, WD], y in [0, 1], `CW` = 1/13, `WD` = 8/13); `cellItems` divides u, scale and lift
  by WD at the end, because items are laid out across the board's width. `HOLES` are
  maps of 13 rows of 8, every cell in play (the board's edge is the wall, drawn as a
  thin rail `RT` inside it), with toys given in cells: bumpers (`kick`), boulders (`rock`)
  and fences (`fence [c0, r0, c1, r1]`, a low wall along a line) the ball bounces off, pipes
  (`pipe`) that carry it to their other mouth, bridges (`=`) over water, plus the windmills.
  Each hole is built of one material (`fence: 'wood' | 'stone' | 'brick'`, the course's in
  turn): its fences, walls and rail are clad in it (`cladGeo`, `picketGeo`, Oct 8). An old
  `tree` or `bush` (saved or shared holes) is read as a short fence. The cup is kept clear
  of the rail by a quarter of its width (`compileHole`, `CUP_R_MAX`). The ground (`land`, read by
  `rawH`) sums bumps (negative ones are hollows), tilts, steps, waves and ridges
  (negative ones are gullies), two or more per hole, the skate park's bowls and
  pipes, plateaus (a raised box) and ramps (a kicker along a line), sunken dishes and
  troughs, `rough` (the green perturbed every way, by a seed) and `ring` (a round rim, or a
  moat when negative). The course was rebuilt on Oct 9 ("reset all the boards"): 22 holes
  made first of their ground (the crater, the terraces, the moguls, the mesa, the
  amphitheatre, the sunken garden, …). **Every board has its own hole** (Oct 9): a board's index
  (`boardIdx`, row by row) picks it; the first 22 boards are the course as written, every other
  board gets a hole generated from its index (`genSrc`, seeded, so always the same; `holeAt`
  makes it on first want and keeps up to `GEN_CAP` = 1500, the least recently wanted giving up
  its slot). A round is `ROUND` = 18 holes, board after board. Every hole has one to three
  boulders orbiting its cup as guards (`guardCup`, Oct 9), so cups are kept two cells in from
  the sides and top. Bumpers come in four kinds, `kick [col, row, r, kind]`: 0 classic,
  1 power (kicks much harder), 2 sponge (swallows speed), 3 spinner (flicks sideways).
  A **cannon** (`cannon [col, row, heading°]`, Oct 9) fires a ball rolled into it onto the next
  board the way it points (`fireCannon`, state `'fly'`, `cannonLand`): the view follows and the
  round goes on there, on that board's hole, strokes kept. Some generated boards and the meadow
  and the moguls have one; to a ball only being tried out (the course test, Check) it is a post. `tests/golf-course.mjs` plays the
  course and a sample of generated holes (`GEN_SAMPLE`, 40). Sunken ground goes at most BASE deep; water lies
  level below its banks (`waterLevel`). Water and sand are rounded: what a point is
  comes from the map's cells blurred (`groundAt`, `softAmount`), for physics and drawing
  alike. Mini golf has `firstTapPlays`: the tap that selects a hole also tees off. The movers (Oct 8) run on the game's clock (`toyAt`): `shuttle` (a
  bumper riding to and fro), `orbit` (a boulder going round) and `gate` (a bar rising out
  of the ground and sinking), each drawn over a dotted track. The grass is one colour,
  shaded by height. A new hole must pass `tests/golf-course.mjs`.
- **The hole editor** (Oct 8, in mini golf's menu: Edit this hole, New hole, My holes)
  puts its tools in the bottom panel: while editing, `statTiles` gives the editor's tiles
  and a tap on a tile reaches the app's `onStatTap` (the field offers stat-tile taps to any
  app that has it); `statsStay` keeps the row up while the hole is painted. It edits a hole as written, in cells (`ED.src`); the course's own holes are kept as
  written in `HOLE_SRC` and compiled by `compileHole`. Editor holes come after the
  course's in `HOLES` (index `BUILT` and on), are rebuilt after each stroke (`setHole`,
  which drops the old meshes with the field's `fieldDropItemKind`), and are played as
  rounds of one (`R.single`). Saved holes live in localStorage (`golf.myholes`); a link
  `?app=minigolf&hole=…` carries one (base64 JSON). Anything from a link or storage
  goes through `cleanSrc` (map letters, one tee and cup, known kinds, numbers in range).
  Check runs the course test's plain player in the page (`solveHole`) and sets par.
  Its ground tools: Hill and Hollow, Plateau (drag a box), Ramp and Half-pipe (drag a line),
  Bowl, and Select (`nearestLand`, `moveLand`) with Higher, Lower, Delete and Level. The
  editor's Bowl and Half-pipe are sunk into the ground (`dish`, `trough`, Oct 9), at most
  BASE deep; the skate holes' `bowl` and `pipe` keep the ground beyond their lip at the lip's
  height, which raised a whole board when dropped on an ordinary hole. A tap on another board while
  editing moves the editor there, the tool kept (`onCellTap`); the next tap paints.
  Every change is saved to My holes as it is drawn (`keepMine`, Oct 9); a hole only looked at
  is not. The movers are tools too: Shuttle and Gate (drag a track), Orbit (drag out from the
  centre), each placed at a default size by a tap. Undo has Redo (`ED.redo`).
  A row of stat tiles is as wide as its widest words (`bbStatWidth`, at most 150px).
- **Quick buttons** (Oct 9): an app's `quickActs(c, r)` gives small icon buttons (glyph and
  title, no text) in the band at the top right of the bottom pane (`#bbQuick`, `bbQuickTick`);
  a click reaches `onQuickAct(c, r, key)`. Mini golf: Undo, Redo, Erase, Done while editing;
  Start again and Edit while playing. They show only while the pane is open; the three dots
  (`#bbHandle`) show on every game, whether or not its row has anything in it.
- **Libraries** come from CDNs: three.js r128 (cdnjs), chess.js (jsdelivr),
  pdf.js, unzipit and libarchive (unpkg).

## Conventions
- Comments explain *why*, at length, and often quote the owner's request with a
  date, e.g. `(Sep 22: "…")`. There are hundreds of these. Keep the voice: when a
  change follows a request, record it the same way.
- Keep everything in the one file. Don't split it up or add a build step without
  asking.

## Testing
- `npm test` runs `tests/smoke.mjs`: it loads the page in headless Chromium,
  switches to every app in `FIELD_APPS`, and fails on any uncaught error. Run it
  before every PR, and add checks there for new behaviour. It then runs
  `tests/golf-course.mjs`, which plays every golf hole in the page's own physics
  with a greedy player and fails on a hole it can't sink within par + 3.
- In a cloud sandbox the CDNs may be blocked. Install `three@0.128.0` and
  `chess.js@1.4.0` somewhere and run `LIBS_DIR=that/node_modules npm test`; the
  test then serves both from there.

## Related repos
- **3d:** the shape studio; it exports `.tvf3d`, the chess piece format read here.
- **flare:** the storage Worker this page reads buckets from.
- **draw:** the 2D shape editor.
