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
  (`boardIdx`, made from its column and row alone by Szudzik's pairing, so a hole stays on its board
  whatever the field's size) picks it; the first 22 (the corner block) are the course as written, every other
  board gets a hole generated from its index (`genSrc`, seeded, so always the same; `holeAt`
  makes it on first want and keeps up to `GEN_CAP` = 1500, the least recently wanted giving up
  its slot). A round is `ROUND` = 18 holes, board after board, and there is no stroke limit
  (Oct 9: stay on a hole as long as you like). Each hole draws one of twenty-two ways of keeping its cup
  (`guardCup`, Oct 9; never none): boulders or bumpers going round (an `orbit`'s 7th number, 1),
  a bumper sweeping across the way in, two crossing, one sliding beside it, a gate, a horseshoe of
  fences open at the back, an arc of bumpers, a scatter of boulders, a sand apron with a bumper, a raised
  green with a ramp, a crater's rim, a moat, the cup on a mound, the cup on a hill's side, a berm, a
  turnstile, a door or two, a pond in front, a short wall, a chicane of fences, a fan of pegs. A cup with
  toys of its own near gets a ground guard, one on ground of its own a toy, a hole with a stream or wall
  across a gentle one; nothing lands on water or by a bridge; the hardest add a stroke to par. Then, if
  nothing crosses the straight line from the tee to the cup, a screen goes on it about halfway (fence,
  boulders, bumper, berm, turnstile, pegs or door). A generated hole's source keeps `guard`, `screen`
  and `open` (true only if no screen could be placed) for the tests. Two toys came with it:
  `arm [col, row, length, seconds a turn, phase, bars]`, a turnstile, and `swing [col, row, length,
  shut °, open °, seconds]`, a door; both are bars about a post (`barsOf`, drawn as `armBar`), in the
  editor as Turnstile and Door (drag out from the post). Cups are kept two cells in
  from the sides and top. (The cannon was taken out on Oct 9.) Bumpers come in four kinds, `kick [col, row, r, kind]`: 0 classic,
  1 power (kicks much harder), 2 sponge (swallows speed), 3 spinner (flicks sideways).
  `tests/golf-course.mjs` plays the
  course and a sample of generated holes (`GEN_SAMPLE`, 40). Sunken ground goes at most BASE deep; water lies
  level below its banks (`waterLevel`). Water and sand are rounded: what a point is
  comes from the map's cells blurred (`groundAt`, `softAmount`), for physics and drawing
  alike. Mini golf has `firstTapPlays`: the tap that selects a hole also tees off. The movers (Oct 8) run on the game's clock (`toyAt`): `shuttle` (a
  bumper riding to and fro), `orbit` (a boulder going round) and `gate` (a bar rising out
  of the ground and sinking), each drawn over a dotted track. The grass is one colour,
  shaded by height. A new hole must pass `tests/golf-course.mjs`.
  **Lighter on a field of thousands** (Oct 9): mini golf's tilt floor is `pitchMin: 50`, a board
  under 20 px gets no pieces (`itemMinPx`), and `cellItems(c, r, bp)` draws by the board's size on
  screen: under 1500 px the rail in cell-long pieces, under 600 plain box rails (`railPV`/`railPH`),
  plain bumpers and boulders and quarter-detail ground (`landM`), under 300 two-cell rails, coarse
  ground (`landL`), no number and no dotted tracks. Items may be stretched (`sx`/`sy`/`sz`).
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
  **My holes in the menu** (Oct 10: "ive got 50 items in the menu"): one item, My holes (N)…, opens a list
  (`openMineBox`, `#golfMineBox`: Play and Delete a row, Save all to a file, Delete all, Close; Escape closes it).
  Exact copies in storage are merged as the page loads. A copy of a course or generated hole carries `from` (a
  short hash of the hole as written, `originOf`, kept by `cleanSrc`), and editing that hole again reopens the copy.
  A hole keeps the board it was made on (`at: [c, r]`, set by `editStart`); the list's Play flies there (`goMine`,
  the field's `gotoCell`) and plays it. One with no board yet takes the selected board, or the corner's, and keeps it.
  **Holes as text files** (Oct 10, as chess has Export PGN): the menu's Save this hole to a file, Save My holes to a
  file and Open holes from a file; a `.golf` file is JSON `{format: 'minigolf', v: 1, holes: [...]}` laid out to be read
  (`holeText`: the map as its 13 rows, a thing or a piece of ground a line, the dots a row to a line). `readHoles` also
  takes a bare hole, a list, or text with a `?hole=` link; every hole goes through `cleanSrc` into My holes (not twice),
  and the first is played. A `.golf` opened with the field's Open button or dropped on the window goes the same way
  (`_loadFiles` → `GOLF_APP.importHoleFiles`, switching to mini golf). A hole is 0.2–1.5 KB.
  Check runs the course test's plain player in the page (`solveHole`) and sets par.
  Its ground tools: Plateau (drag a box), Ramp and Half-pipe (drag a line) (Hill and Hollow were taken out on Oct 9),
  Bowl, and Select (`nearestLand`, `moveLand`) with Higher, Lower, Delete and Level. The
  editor's Bowl and Half-pipe are sunk into the ground (`dish`, `trough`, Oct 9), at most
  BASE deep; the skate holes' `bowl` and `pipe` keep the ground beyond their lip at the lip's
  height, which raised a whole board when dropped on an ordinary hole. A tap on another board while
  editing moves the editor there, the tool kept (`onCellTap`); the next tap paints.
  Every change is saved to My holes as it is drawn (`keepMine`, Oct 9); a hole only looked at
  is not. The movers are tools too: Shuttle and Gate (drag a track), Orbit (drag out from the
  centre), each placed at a default size by a tap. Undo has Redo (`ED.redo`).
  **The path** (Oct 10: "drawing the orbits in place and moving the leaves would be best"): a mover riding a closed
  loop of its own shape, as a shape in draw.html rides its motion orbit. `path [x0, y0, …, xn, yn, r, seconds, phase
  (fraction), kind (0 boulder, 1 bumper)]`, 3–24 leaves in cells; the loop is a closed Catmull-Rom curve through the
  leaves (`loopOf`, cached by array, so a changed path is a new array), ridden at an even speed (`loopAt`, `toyAt`).
  The Path tile: a drag draws the loop in place (`ED.drag.pts`, laid down as 5–16 leaves evenly along it in
  `editDragEnd`), a tap lays a round loop of eight; the path stays selected (`placedOnce` keeps it), its leaves drawn
  large in gold, and a press on a leaf of the selected path drags that leaf alone (`dragPick`, `ED.grab.leaf`); a press
  elsewhere on it moves the whole loop (`shifted` moves every leaf).
  A row of stat tiles is as wide as its widest words (`bbStatWidth`, at most 150px).
  **The tiles** (Oct 10): no top line (a stat tile with no `label` centres its glyph and name); the tool
  in hand is lit by the tile's `bg`; a tap takes a tool up or puts it down. The tools: the five paints,
  the bumpers, Boulder, Fence, Windmill, Pipe, the movers (Path among them), Turnstile, Door, Plateau, Erase; the acts:
  Undo, Redo, Copy, Paste, Delete, Level, Material (named by the material). Copy, Paste and Delete act on the whole
  board (Oct 10): Copy keeps the hole as written (`CLIP`, and localStorage `golf.clip`), Paste lays it over the hole
  being edited (its name kept), Delete clears it to a new hole's; both undo. The delete-object tile and the text-only
  first tile (name, par, material) went, so tile i is `TOOLS[i]`, then `ACTS`. Par, Check, Save, Share, Done, Tee, Cup,
  Ramp, Bowl, Half-pipe, Select, Higher, Lower and Name lost their tiles (Done and Select are quick
  buttons; the actions remain in `editAction`).
  **Select and move in place** (Oct 9, step 1 of making the editor like draw.html): Select is the
  tool in hand at the start (and a quick button). A tap takes a thing, the tee or the cup; a tap on
  the grass takes NO dot and lets go (Oct 10: a tapped dot made the next drag from that spot pull one
  dot instead of drawing the box, "selects only one point at a time"); a second tap on the same bare
  spot takes ground of the hole's own (`pickAll`, `toyReach`, `landReach`). Dots are taken only by the
  selection box. A tap on the tile of the tool in hand puts it down (Select again), as Escape does
  first. While editing, `noDoubleTap()` makes the field pass a quick second tap to the app instead of
  reading a double-tap (which reframed the view and swallowed the tap). With any other tool in
  hand (Erase and Box aside) a tap on the body of a thing, the tee or the cup selects it and takes up
  Select, so the next drag moves it (Oct 9: "taping an object should select it allow it to be moved").
  **One at a time** (Oct 9): a thing or a piece of ground laid on the hole puts its tool down
  (`placedOnce`): back in Select with nothing selected; another needs its tile taken up again. The
  paints and Erase stay in hand. **Escape** in mini golf never moves the view (the field's Escape flies
  out to the horizon): while editing it closes an open selection box, else leaves the editor. A drag that starts on a thing moves it
  (`dragPick`): from where the finger pressed, its anchor snapped to half cells and into line with
  other things (`snapAnchor`, a white guide line; Ctrl/Alt/Shift held moves freely); the tee and cup
  go cell by cell. The one selection is `ED.pick` ({type: 'toy'|'land'|'T'|'O', i}); `ED.sel` (the
  ground index the older code uses) is an accessor over it. What a tool places is selected, and a
  tap with Bumper, Boulder or Windmill on a thing already there selects it. `selActs`/`selAct` hold
  what can be done to a selection (kind, Faster/Slower, Higher/Lower, Duplicate, Delete); the bar that
  showed them beside it was taken out on Oct 9 ("not needed"), so they are reached by the tiles
  (Higher, Lower, Delete) and, later, keys. Undo keeps the selection. Draw.html has no selection library to lift
  (its selection is spread through its app), so its ways are rewritten here. Still to come: handles
  per kind (size rings, line ends, plateau corners, turning grips) and drag-to-create, box select,
  keys, copy and paste.
  **The dots lift the grass** (Oct 9): the editor's faint dots at the cells' corners ((NX+1) × (NY+1),
  `LIFT_W` × `LIFT_H`) each carry a height in the hole's optional `lift` list (row by row, dropped
  when all are level; `cleanLift` keeps it in range, -0.05 to 0.12). `rawH` adds `liftAt`: a
  Catmull-Rom surface through the dots, exact at each dot and smooth between. With Select, a press
  near a dot takes it (`pickAll`, after things, before ground; "near" is a fingertip on screen,
  `DOT_PX`/`PICK_PX` over `cellPx`, and on bare grass the nearest dot is taken anyway); a drag is
  hit-tested where the finger pressed (`ED.pressAt`, from `claimsPan(u, v)`), and up or down the screen raises
  or sinks it (`DOT_PER_PX`, the pan's dy passed in as `ED.panDy`). **Many dots** (Oct 9): only the
  selection box takes several (a tap takes one dot alone); the Box quick
  button (⬚, tool `box`) takes every dot inside a dragged box; a drag on any selected dot moves them
  all by the same amount (`moveDots`), and the Higher/Lower tiles act on them all. The set is
  `ED.dots`, read through `selDots()` only while the selection is a dot. **The selection box** (Oct 9):
  a drag with Select draws a box (`ED.boxing`) unless it starts on what is selected (a dot or ground
  tapped first) or on a thing, the tee or the cup ("selects only one point at a time": a dot within a
  fingertip no longer takes the drag); it stays open in gold (`ED.box`, cells) with
  its dots selected (`boxDots`); a drag inside it moves them all, a tap outside it or Escape closes it
  (`closeBox`); Box (⬚) draws one from anywhere. Lifted dots draw warm, sunk
  ones cool; Level (the tile) also levels every dot.
- **A game opens framed** (Oct 9): `_defaultFitSoon` settles the camera at the default fit at once
  (`settleCameraNow`), so a game no longer glides down from the overview when it opens.
- **Quick buttons** (Oct 9): an app's `quickActs(c, r)` gives small icon buttons (glyph and
  title, no text) in the band at the top right of the bottom pane (`#bbQuick`, `bbQuickTick`);
  a click reaches `onQuickAct(c, r, key)`. Mini golf: Select, Box, Undo, Redo, Erase, Done while editing;
  Start again and Edit while playing. The row stops short of the middle and its buttons narrow to fit. They show only while the pane is open; the three dots
  (`#bbHandle`) show on every game, whether or not its row has anything in it.
- **The rails** (Oct 10): the turn rail across the top (`#yawZone`) is as tall as the side rails (`#tiltZone`,
  `#thrustZone`) are wide, `min(32px, 5.25vw)`; the smoke test checks it.
- **Libraries** come from CDNs: three.js r128 (cdnjs), chess.js (jsdelivr),
  pdf.js, unzipit and libarchive (unpkg).

## Conventions
- Comments explain *why*, at length, and often quote the owner's request with a
  date, e.g. `(Sep 22: "…")`. There are hundreds of these. Keep the voice: when a
  change follows a request, record it the same way.
- Keep everything in the one file. Don't split it up or add a build step without
  asking.

## Testing
- **Test the editor with real input.** The smoke test's "real touches" check sends touch events (with
  the pointer events a phone sends before them) to the canvas; checks that call `onCellTap`/`onPan`
  directly passed for a week while the phone did not. A tap's touchstart and touchend go together
  there, because the software renderer can take a second a frame.
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
