# games: notes for Claude

A 3D field of boards you fly over, with ~50 games in one page (and Levels, a demonstration of level of detail) (chess against
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
  and `open` (true only if no screen could be placed) for the tests. **Crossing tracks** (Oct 10: "a variety of crossing
  paths that create complicated paths to golf hole", then "everything should use path … object coordination … increase
  the diffficulty level"): before the guard, about 85 generated holes in 100 get a weave of paths (`weave`): circles
  overlapping across the way in, a figure-eight with a train of riders, two crossed ellipses whose riders reach the
  crossings by turns, a petalled loop round the cup with a crossing circle, a cage of staggered sweeping bumpers round
  the cup, a lumpy loop with a train and a crossing circle, a zipper (two circles touching on the tee-cup line, riders
  there half a turn apart), or a serpent (a snaking loop with a train of three). A train is riders evenly round one loop
  at one speed; speeds not meant to be in step never are. Tracks keep off the tee, the cup, walls and water; par goes up
  one, two with four or more riders; the source keeps `weave` (the smoke test checks that the tracks cross).
  **Everything rides a path** (Oct 10: "remove the shuttle and orbit"): there is no orbit or shuttle any more, in the
  editor (no tiles), the generator, physics or drawing. `pathify` turns an old `orbit` (a circle of leaves, started where
  it was, turning the same way, its rider kept) or `shuttle` (a thin loop out and back, a bumper on it) into a path, for
  the course's holes (as they load), `compileHole` and `cleanList` (saved holes, links, files). Two toys came with the guards:
  `arm [col, row, length, seconds a turn, phase, bars]`, a turnstile, and `swing [col, row, length,
  shut °, open °, seconds]`, a door; both are bars about a post (`barsOf`, drawn as `armBar`), in the
  editor as Turnstile and Door (drag out from the post). Cups are kept two cells in
  from the sides and top. (The cannon was taken out on Oct 9.) Bumpers come in four kinds, `kick [col, row, r, kind]`: 0 classic,
  1 power (kicks much harder), 2 sponge (swallows speed), 3 spinner (flicks sideways).
  `tests/golf-course.mjs` plays the
  course and a sample of generated holes (`GEN_SAMPLE`, 40), then rates (by the guess) `LEVEL_SAMPLE` (10) holes at each of levels 1, 3 and 5
  and fails unless they climb (see Difficulty). Sunken ground goes at most BASE deep. All water and sand are shapes
  (`lake`, `sand`, see below): water and sand written in cells (`~`, `s`) are read as shapes (`shapify`, see "No painted
  water or sand"); the old reading of cells blurred (`softAmount`) went on Oct 27 (dead code). Mini golf has `firstTapPlays`: the tap that selects a hole also tees off. The movers (Oct 8) run on the game's clock (`toyAt`; a board no one plays,
  or one left, runs them on the page's clock, and a new game starts its clock there, so a tap never resets them, Oct 10): the `path`
  (a rider round a loop, see the editor's notes; the shuttle and the orbit became paths on Oct 10) and the `gate` (a bar rising out
  of the ground and sinking). A path's loop and a turnstile's or door's sweep are dotted only with Wireframe on, or on the hole
  being edited (Oct 10: "if wireframe is off, don't show the orbit path"). The grass is one colour,
  shaded by height. A new hole must pass `tests/golf-course.mjs`.
  **Lighter on a field of thousands** (Oct 9): mini golf's tilt floor is `pitchMin: 45` (Oct 14, once the ground and the pieces fade: see below; 62 from Oct 12, 50 before that: "clamp the tilt so that the
  horizon is reduced, so that less boards can be shown"; the top of the screen looks 32° below the horizon, not 20°), a board
  under 20 px gets no pieces (`itemMinPx`). Items may be stretched (`sx`/`sy`/`sz`).
  **Half the triangles** (Oct 12: "mini-golf game is great but its heavy, and its not as fast as all the other games." …
  "yes, proceed"): a framed field of holes drew 958,000 triangles a frame against 50,000–180,000 for the other games, and
  ran 3–8 times slower a frame, measured (making the pieces was 3 ms of it). Bumpers and boulders (`propGeo`) are built at
  12, not 24 (2,352 triangles, not 9,408); rail, wall, fence and planter boxes (`cladGeo`, `picketGeo`) leave out every
  face no one can see, a unit's back against the core and every underside (the camera is always above); the ground
  (`groundGeo`, `MESH`) is 6 rows a cell, not 8 (the shores are a colour blend, `lakeMix`, not the mesh's steps). The same
  view is 540,000 triangles, and screenshots before and after show the same holes. The smoke test fails over 700,000.
  **Full drawing** (Oct 12: "why do the object change when I pan around. they should never change from one thing
  to antoher.", then "still not very good. restore full drawing functionaility. no special handeling. only thing is dont
  draw non-visible boards and no animation when panning or resizing."): until then `cellItems(c, r, bp)` swapped pieces by
  the board's size on screen (longer rail pieces under 1500 px, plain rails, bumpers and boulders under 600, no number
  under 300), and for a while a board under 300 px showed its ground alone. Now every board has all its full pieces,
  whatever its size (the field still asks for none under `itemMinPx`, 20). (`railPV`/`railPH`, and the `PIECES`/`near`/`mid`/`fine` switches always on, went on Oct 27.)
  **The ground's grains** (Oct 14: "could mini-golf and chess beneifit from better LOD handeling of this application." …
  "yes", on the ground first): after Levels, detail that comes and goes with nothing seen to change. The ground has three
  grains, `GROUND_ROWS` 78, 39 and 13 rows (`land`, `landM`, `landL` kinds: 7,488, 1,872 and 208 triangles). Each grain carries
  the next coarser one's surface at its own points, on that grain's own triangles (`pos2`, `col2`, `nrm2`; `groundData`,
  `groundGeo`), so at a weight of 1 it is that grain on the screen exactly; a board's grain and weight come from its width
  (`groundGrain`: full while a column is `GROUND_PX`, 10 px, or more, fading on a log scale into the next). The field draws
  it as a morphing kind (`geometry.userData.morph`, an item's `morph`: an `instMorph` weight per instance, mixed in the
  vertex shader). Physics never reads it. Zoomed out at the 62° floor: the ground 741,000 triangles before, 466,000 after,
  the view 4.18 million before, 3.91 million after. Most of that was the pieces (rail and wall pieces 1.7 million, bumpers
  and boulders), so they came next:
  **The pieces' grains** (Oct 14: "yes", on the pieces): a clad wall, rail, stone or brick fence or planter-wall piece fades
  to its plain core box in its material's far colour (`cladGeo` pulls every point into the core's box: `pos2`; `cladPlain` is
  the box, 10 triangles), a bumper or a boulder from its K = 12 build (3,072 triangles) to its K = 4 one (768; `fieldMorph`, the field's own,
  on each part's grid of rings, `fieldGridOf`, `PROP_GRAIN`), each exactly. `pieceGrain`: full on a board `PIECE_FULL` (480 px)
  or more across, fading on a log scale to `PIECE_PLAIN` (240), and under that the plain twin itself (the kind with `~`
  after it; `TWINNED`). The wooden picket fence stays as it is. Same zoomed-out view: 2.59 million triangles (4.18 before
  any of this); framed, 540,000 as before. At 640/320 it was 2.11 million, but boards about 250 px across lost the bricks'
  texture visibly in screenshots; at 480/240 only the farther ones do.
  **A ceiling** (Oct 14: "pinching zooms in to far show to many mini-golf boards, clamp zoom in mini-golf to keep the boards
  from getting to small."): an app's `zoomMaxH` is the highest the eye may go, in board spacings across; the field holds
  `st.zoom` (and a flight's `target.zoom`) under it once a frame, before the tilt floor, so a pinch, the wheel, the keys and
  a drag's zoom rate all stop there. Mini golf's is 4: it opens at 1.4; at 3 boards are about 200 px across at 1280×800, at
  5 dozens of 130 px ones (1.75 million triangles), and a pinch went on to 19 (2.9 million).
  **The floor lowered to 45°** (Oct 14: "ok, proceed"): a board's pieces were three quarters ground heights, the same
  answers every frame, so the drawing asks `hOfDrawn`, which keeps them on the hole (`H._hd`, up to `HD_MAX`; a compiled hole
  never changes, and an edit makes a new one); the physics still asks `hOf`. 0.37 ms a board became 0.10. Zoomed out, by floor:
  62° 2.59 million triangles, 8 ms a frame making pieces; 55° 2.38 million, 10 ms; 50° 2.90 million, 18 ms; 45° 3.35 million,
  18 ms (62° before the fading: 4.18 million, 20 ms); 40° would be 3.89 million for 417 boards a frame.
  **Painted, not built** (Oct 20: "the mini-golf application is to slow, what is expensive?" … "yes"): measured, a framed
  field of holes drew 595,000 triangles a frame, ten times a board game's (checkers 57,000, Sokoban 49,000), and the page
  waited on the graphics card: 10 frames in 6 s against 57. Half were the rails (each half-cell piece 126–392 triangles of
  units standing proud, about 12,000 a board). Now a rail, wall, stone or brick fence or planter-wall piece is its core box,
  10 triangles, wearing a picture of its material (`cladBox`; `cladTex` paints one 512² picture a material from `MAT_COL`,
  each unit lit along its top and shaded along its foot, repeating without a seam; laid on in the piece's units over u, so a
  brick is the same size everywhere). The field gives an item kind a picture from `geometry.userData.map`, read at the most
  anisotropy the card has. Far off the picture's mipmaps blend toward its average, so these kinds left `TWINNED` (bumpers and
  boulders still fade). `cladGeo` went on Oct 27 (dead code). Same views: framed 595k → 253k triangles, zoomed in 263k → 102k, at the
  zoom ceiling 1.76M → 841k; screenshots before and after show the same holes. The smoke test fails over 350,000 framed.
  **New boards a few at a time** (the same request): sliding over boards not seen yet quadrupled the page's work, each new
  board making its hole (`genSrc`, `keepApart`) and its ground mesh (`groundGeo`) the frame it appeared, about 20 ms a board
  in the sandbox, and the far boards' colours (`cellGrid`) made a hole each too. Now `holeSoon(c, r, far)` gives a board's hole
  only if it is made (or the board is framed or has a game), else queues it (`SOON.holes`, the far ones `SOON.far`) and the
  board is plain grass (no pieces, `PLAIN_GRID`) meanwhile; `soonPump` works through the queue in the browser's idle time
  (`requestIdleCallback`, at most 40 ms a turn, one item at least), nearest the framed board first, boards with pieces before
  far ones, then their fine ground. The ground comes coarse first: `groundSoon` draws the wanted grain if made (`GREADY`),
  else the next coarser made, the 13-row one at once; the fine grains are made ahead (`GCACHE`, taken by `takeGround`).
  Entries not asked for in a second leave the queue. Measured panning thirty boards: 11 frames in 6.5 s before, 27 after;
  standing still framed, 10 then 48.
  **Board size** (Oct 20: "could you provide a board size option for mini-golf. small is current size. add a medium and tall
  size.", then "Medium 13×21, Tall 8×21" and "Generated holes"): the menu's first item, Board size, goes Small (8 × 13, as
  before), Medium (13 × 21) and Tall (8 × 21) (`GOLF_SIZES`, localStorage `golf.size`). `GOLF_APP` is made by `GOLF_MAKE(size)`,
  so NX, NY, CW, WD, the ground's rows (`MESH` = 6·NY, `GROUND_ROWS` = 6, 3 and 1 rows a cell) and `boardShape` follow the size;
  `setGolfSize(size, keep)` makes the app again at the new size, puts it in `FIELD_APPS` in the old one's place (same id) and
  switches to it, so a board's game is begun afresh. Only Small has the course (its 22 holes are drawn at 8 × 13): at Medium and
  Tall every board's hole is generated. Each size keeps its own My holes, pars and clipboard (the keys get
  `.medium` / `.tall` after them, `SIZED`). A `?hole=` link opens at the size its map is (`golfSizeAtLoad`).
  `cleanSrc`'s ranges (`SPEC_LAND`, `SPEC_TOY`) are in NX and NY: written as 8 and 13 they clamped every generated hole's
  things into Small's corner of a bigger board. The generator scales its pieces of ground and loose toys by the board's
  area against Small's (`AREA`, `more`) and its stream's and wall's rows by its height (`TALL`, `down`); on Small both are 1
  and every hole is as it was. `GOLF_SIZE=medium node tests/golf-course.mjs` plays a size's generated holes; both pass.
  Framed: Medium 447k triangles, Tall 475k (Small 253k). Pars came out 4–6 there, and the test's greedy player sank most in
  one or two.
- **Charges, zap zones and mines** (Oct 20: "could you objects that add more complexity like electirc fields and land
  mines?", then "yes"; see CHARGES, ZAP ZONES AND MINES):
  - `charge [col, row, strength, reach]`: a post with a field reaching `reach` cells (0.8–4); strength −1.5–1.5, above nothing
    a pull, below a push, `CHARGE_A` × strength × (1 − (d/reach)²)² / (1 + (d/0.7 cell)²), on a rolling ball only
    (`chargePull`, in `step`). Its post is solid (`CHARGE_POST`). Drawn as a dark post with a red (pull) or blue (push) ball and
    two rings of dots drifting in or out.
  - `zap [leaves…]` with `zt [seconds, phase, share on]`: a closed TVF curve (`zapOf`, a planter's line), on for its share of
    each turn (`zapOn`). A ball rolling in it while on goes back to where it was putted from, no stroke more (`g.zapped`). Its
    ground is tinted (`inZap`); its rim (`zapEdge`) is bright while on, with sparks, dim while off. A thing with two keys, so
    the leaf tools keep the rest of it (`{ ...LS.list[i], [key]: v }`).
  - `mine [col, row, power]`: a ball rolling within `MINE_R` (0.26 cell) of its middle is thrown straight out from it at
    `MINE_V` × power, keeping half of what it had across that way, so straight on it comes back and clipped it is flicked
    aside; once a stroke (`g.blown`, reset by `putt`, a mine the ball sits on left out). Its light blinks while ready.
  - Editor: Charge, Zap zone (drawn as a planter is) and Mine tiles; the menu's Pull harder / Push harder / Reach farther /
    less far, Stronger / Weaker, On longer / On shorter / Faster / Slower (`editAction('tdial', …)`).
  - Generated holes only (the course keeps its guards): guards `charge` and `zapgate` from level 2, `minefield` (an arc of
    five) from level 3 (`CURVE_FROM`); loose charges from level 2 and mines from 3; the guess adds `NEW_GUESS` a thing.
    Rated at level 3, five holes each: minefield 2.95 strokes, zap zone 2.93, charge 2.85, every round finished.
- **The tee box and your par** (Oct 20: "1) user should be able to set the par. 2) the first shot should be from an elevated
  vantage on a tea box"):
  - Every hole's tee stands on a box of level grass, `TEE_BOX` (1.2 cells) across and `TEE_RISE` (0.045) above the highest
    ground under it (`teeTop`, worked out with the box left out: `TEE_BUSY`). Its sides fall to the ground round it over
    `TEE_EDGE` (in `rawH`, before the lakes), so the first putt runs down off it. It is mown in stripes (`onTeeBox`) with two
    blue markers.
  - `compileHole` keeps the tee in from the rail far enough for the box and its sides, as it keeps the cup in, so the ball
    starts on top and the rail never climbs over it, with a strip of grass 0.35 of a cell wide between the foot of its sides
    and the rail (Oct 20: "the tee box should have a small margin so its not next to the border"). A tee in the last row is
    1.1 cells nearer the cup than before.
  - **Your par:** the menu's Set par for this hole… asks for 1 to 9; an empty answer puts back the hole's own (`setParHere`).
    One of My holes takes it into its source. Any other hole keeps it in localStorage `golf.pars` (by size, `SIZED`) under
    `originOf` the hole as written, put on the hole when a game starts on it (`parApply`, in `holeGame`; `H.par0` is its own).
  - The editor has a Par tile again (it steps 1 to 9), and the menu's Par higher and Par lower.
- **A smaller tee box, the ball back on the tee** (Oct 31: "mini golf - put ball back on tee after it goes in hole", "mini-golf - smaller tee
  box"): `TEE_BOX` is 0.8 of a cell across (1.2), its sides `TEE_EDGE` 0.35 (0.45), and `compileHole` keeps the tee in from the rail by
  the box's half, its sides and the 0.35 strip (`mt`). A finished hole (`nextHole`: 'holed' on the board you leave, 'done' at the end
  of a round or a hole of your own) puts its ball back on the tee (`ballToTee`) and the board draws it there; the ball still drops into
  the cup (state 'sunk') first.
- **Pong and air hockey move freely, the board lock, the difficulty flight** (Oct 31: "pong - dont use rackets in tennis. use a paddle", "pong
  - let the user move anywhere on his side of the board", "airhockey - let the user move anywhere on his side", "double clicking a board
  should lock the board in position and set the board so it does not pan", "difficulty setting in the menu should move to a board with
  that difficulty setting"):
  - Pong's tennis theme draws the same paddle as the others (the racket went). A person's paddle goes anywhere on its half (`ROOM` 0.4
    forward of its end line, `REACH` 0.07 kept for the tests' stepping face): the finger takes it to the finger's own place along the
    table as well as across (`handAt`), ↑ ↓ move it, and let go it stays where it was left (it used to step back). Air hockey's mallet
    already went anywhere on its half; its `HAND_V` went from 5 to 9 so it keeps up with a quick finger.
  - **The board lock** (`BOARD_LOCK`, `setBoardLock`): a double tap frames the board as before and locks it there; `applyPan` then moves
    nothing for a drag that starts on that board (one finger, two, the trackpad; an app's own drag, aim or steering is still its own, asked
    first); a drag that starts on any other board or the ground pans as ever and lets the lock go (Nov 1: "don't block panning of
    non-selected boards.": `applyPan`'s `at` is the gesture's place, read through `_framedUV`; the tilt, which has none, is held). A double tap on the framed,
    square, locked board, the menu's Unlock the board (`#bBoardLock`, shown only while locked), any flight (`gotoCell`) or another app lets
    it go. Zoom, tilt, turn, the keys and the rails still work.
  - **The difficulty flight** (`flyToLevel`): the Difficulty menu item (the arcade kit's, and mini golf's) flies to the nearest board of
    its colour after each step: Easy level 1, Normal 3, Hard 5 (mini golf's four: 1, 3, 4, 5), found along the first row, which has every
    ring; no flight if the board in view is one. The smoke test (part 7, "board lock and difficulty flight") checks both with real input.
- **Rotation on a trackpad** (Oct 31: "the two finger rotation works on touch devices, not on touch pads on portable computers"): a pad's two
  fingers are wheel events, not touches, so the glass twist never reached them. WebKit's `gesturechange` carries a `rotation` (degrees,
  clockwise rising), now turned into the view's yaw about the screen's middle as the glass twist is, after the same `TWIST_DEAD`; Chrome and
  Firefox send a pad no rotation gesture at all, so Alt (Option) with a two-finger sideways scroll turns the view there (`WHEEL`'s pad
  branch, 0.25° a pixel). The smoke test (part 7, "trackpad rotation") sends the Alt scroll; WebKit's gesture events cannot be made by a test.
- **Hole numbers off by default** (Oct 20: "turn hole number off by default."): the number in a board's far corner (`NUMS`,
  `numberItems`) shows only once the menu's Hole numbers is turned on (localStorage `golf.nums` 'on').
- **Difficulty** (Oct 10: "Now we way to adjust the difficulty, what do you suggest" … "ok, proceed"):
  - **The rating** (`ratingOf`, Oct 29: the guess; until then a player with a person's hands, `rater`, played every hole
    eight times in the background, 1–8 s a hole, and the guess was fitted to it): a hole's mean strokes is its `guess`
    (`guessMean`), kept on the hole (`H.rated`). Stars come from the mean (`STAR_AT`: 2.7, 3.0, 3.45, 4.6, halfway between the
    levels' medians, so a level-n hole is mostly n stars); par from a rating is `parOfRating` = ceil(mean + 1).
    - The plain player (`solveHole`) aims perfectly and sinks nearly everything in one, so it only says whether the cup
      can be reached.
  - **The menu:** Difficulty: Easy / Normal / Hard / Expert (`LEVEL_SET`, kept in `golf.level` as before); while editing,
    Check also sets par from the rating.
    - It is the one Difficulty: it was the arcade kit's (the grass's speed and the cup's size, `DIFF`), and now it shifts
      the holes' levels too. Expert plays on Hard's grass and cup.
  - **The levels:** a generated hole is made for a level from 1 to 5, given by `levelAt` = the ring level plus the
    setting (Easy 0, Normal 1, Hard 2, Expert 3), so every step of the setting moves every board a level (Oct 10, later:
    "I dont notice any difference").
    - Ring levels (`ringLevel`) double out from the corner: rings 0–6 are level 1, 7–14 level 2, 15–30 level 3, 31–62
      level 4, and beyond that level 5. The ring (`ringOf`) is the distance from the corner the short way round the wrapped
      field, so the boards left of and above the corner are ring 1, not the farthest.
    - A generated hole's flag is its level's colour (`LEVEL_FLAG`: green, blue, yellow, orange, black) and carries the level
      as one to five dots (`flagDots1`…`5`, discs through the flag so both faces show them; boards over 300 px). The flag is
      `FLAG_W` × `FLAG_H` (0.62 × 0.3) of the pole's height. The course keeps red flags with no dots.
    - The course's 22 holes have no level, but their movers follow the setting (`COURSE_TUNE`, `tuneCourse`: slower on
      Easy, faster on Hard and Expert; Normal is the course as made, which the course test plays).
    - `holeAt` keeps a board's hole at each level apart (GEN key idx·8 + level), and sets `H.level`, which the tee
      message shows.
    - `LEVEL_DIALS` set each level: weave chance (a second weave at 4–5), riders per weave, mover speed and rider size
      (`tuneMovers`), ground height (`HEIGHTS`) and number of pieces, water, wall, sand, and loose toys. Level 3 is the
      generator as it was.
    - Guards are weighed by what the rater found (`GROUND_GUARDS`: mound, crater, apron, moat, hillside and pond were the
      hardest), left out at level 1 and favoured at 4–5. There is no cage below level 3, and no rose or serpent at level 1.
    - Level 5 always gets a screen. Bridges are 2 planks wide (3 at level 1). Weave tracks keep off the banks and away
      from bridges: riders by water made holes no one could finish.
  - **Remade until it fits:** `genSrc(idx, lv)` makes `genOnce(idx, lv, a)` for a = 0…7 until `guessMean` falls in
    `LEVEL_BAND[lv]`, keeping the nearest.
    - Rated on 200 fresh holes, the levels came out 2.6, 3.0, 3.1, 3.9 and 5.4 strokes on average.
    - `guessMean` is a straight-line guess (`GUESS_W`) fitted to 400 rated holes; on fresh holes it goes with the
      rating at 0.73. Its features are water, the riders'
      size and speed, walls, windmills, the cage, turnstiles/doors/gates, length, ground and a ground guard.
    - The hole keeps `guess`. If the generator changes much, rate a few hundred holes and refit.
  - **The editor:** Harder and Easier tiles step every mover to the next of the fixed periods (`stepMovers`, `kaStep`: see
    "Movers keep apart"), its rider 6% bigger or smaller, and the ground 18% steeper or gentler.
  - **Stars as you play** (Oct 10: "6,4,2,3", 4 being stars on the scorecard): a hole's stars show on the tee and when sunk
    (`starTag`) and ride on the card (`R.card` entries carry `stars`, `name`, `num`). A round ends on a scorecard
    (`openCardBox`, `#golfCardBox`: a row a hole with par, strokes and stars, the average stars, Close; Escape closes it).
    (Holes the rating player could hardly finish were made again, `REMADE`, Oct 11–29; that went with the player.)
- **Tilt maze** (Oct 14: "what are more games like mini-golf we could create", then "tilt maze"): `TILT_APP`, id `tiltmaze`,
  after Sokoban. A marble on a board you tip, through a maze to the gold ring, past holes.
  - **Every board its own maze** (`mazeFor`, `makeMaze`): from the board's number (`boardIdx`, golf's Szudzik pairing) at a level
    1–5, the ring level plus the Difficulty (Easy 0, Normal 1, Hard 2), as golf and Sokoban. `LV` sets each level: the maze's
    size, loops (walls taken out after a backtracking walk), holes off the way (dead ends and branches first), holes in the
    outside corner of a turn on the way (a marble going too fast runs on into them), holes beside the way on a straight
    (`side`, `SIDE_R`, `SIDE_OFF`: ride the wall and it drops) and how hard the board tips (`g`, on `G`). The ring is the cell
    farthest from the start. The outer wall is the level's colour (golf's flag colours).
  - **Harder** (Oct 20: "the title maze should be more difficult. all levels are to easy."): 7, 9, 11, 13 and 15 cells a side
    (5, 6, 7, 8, 10 before), loops 0.06 down to 0.02, holes off the way 0.16–0.3, corner holes from level 1 at 0.25–0.85 (from
    level 3 before), side holes from level 2 at 0.15–0.45, the tip 1 to 1.5 times as strong; stars tighter (`starsOf`: 1.15 ×
    par for three, 1.6 × for two). Measured on 12 boards a level: every one finished by the steady player on its first try;
    par 12.1, 17.8, 23.1, 32.7 and 43.6 s; 11 to 145 holes; 6 to 71 ms to make.
  - **Played before you see it**: a steady player (`botTilt`: toward the next cell of the shortest way from wherever the marble
    is, braking on its speed) rolls each maze (`playRun`, `TIME_CAP` 120 s); a maze it cannot finish without a fall is made
    again from the next seed (up to 8 times, then without corner holes). Its time is the board's par and its run, sampled 30
    times a second, is what the board shows when no one plays it (`shownBall`, each board at its own phase). Measured on 30
    boards a level: all finished on the first try; par 7.4, 9.4, 12.2, 14.6 and 20.7 s; 3–15 ms to make. Boards only looked at
    get theirs a few at a time (`mazeSoon`, 8 ms in 30) and show a bare floor till then; `MAZES` keeps 1,500.
  - **The marble** (`stepBall`): pulled by `G` times the tilt, slowed by rolling (`ROLL`), walls are boxes (`wallsOf`: runs along
    a line laid as one box, `WB` by cell) it is pushed out of and bounces off (`BOUNCE`), in 1/240 s steps; a frame catches up
    to a quarter of a second. Over a hole's middle it drops (0.6 s) and comes back at the start.
  - **Tipping** (`tiltNow`): the arrow keys or WASD hold a tip, a drag tips the board toward the finger (more, the further it
    is), and the menu's Tilt steering uses the phone (`ARCADE.tilt`); they add up. The clock starts at the first tip.
  - **Through**: time against par as stars (`starsOf`: ≤ 1.3 × par 3, ≤ 2 × par 2, else 1), the best on each board kept
    (localStorage `tiltmaze.best`); a tap on a finished board goes on to the next (golf's `nextBoard`), a hold starts again.
  - **Your own mazes** (Oct 20: "let the user create their own mazes."): the bottom row is a maze editor, as Sokoban's (`ED`,
    `ed…`, `MINE` inside `TILT_APP`, with the same hooks). Opening it (the dots, or the menu's Make a maze for this board…) takes
    the framed board's maze into the editor. Tools: Wall (a tap toggles the edge between two cells nearest it, `edgeAt`; a drag
    paints edges as the first one went), Hole (a tap lays one, again takes it off), Start, Ring, Erase; acts: Clear, Fill, Size
    (7–15), Generate (a made maze of that size to start from), Check, Play; quick buttons Erase, Check, Cancel, Done. Check and
    Done want the ring reachable; the steady player's time is its par, or it is kept without a par if the player cannot finish
    it. A maze is `{ m, E, S, holes: [[x, y, r?]], start, goal }` (`dataOf`, `cleanMaze`), kept on the board (localStorage
    `tiltmaze.mine`, the latest 300; `mineMaze`, which `mazeFor` asks first), framed in violet (`MINE_COL`), tipping as level 2
    does (`MINE_G`). Escape or Cancel leaves the board as it was; the menu has Share this board's maze (`SHARE`, `takeMaze`) and
    Forget this board's maze.
  - The smoke test checks the sizes by level, the steady player finishing 30 mazes (each made again until it does) and never
    passing a wall, the real arrow keys rolling the marble, a hole and the ring, a board no one plays moving, and the editor:
    opened by the real dots, a walled-up maze refused, walls, a hole, the start and the ring laid by taps, Done keeping it with
    a par in storage (read back as the page reads it on load), and a shared copy on another board.
- **Pinball** (Oct 24: "soma is cool. what other games like soma are there?", then "how about pinball"): `PINBALL_APP`, id
  `pinball`, after the tilt maze. A table a board, `W` (0.56) wide by 1 long (the app's `boardShape`), the plunger lane on the
  right, the flippers at the near end; items are laid out in the table's units and divided by W at the end, as golf's.
  - **Every board its own table** (`makeTable(idx, lv)`, `tableFor`, `TABLES` 1,500): the cabinet is the same on every board (an
    arch of 20 rails, the plunger lane with its one-way `gate` and `stop`, outlanes, inlanes, the dividers, the slingshots); the
    playfield is the board's own from its number (`boardIdx`) at a level 1–5, the ring level plus the Difficulty (Easy 0,
    Normal 1, Hard 2; `ARCADE.difficulty(…, own)`): pop bumpers in a cluster, top lanes (3, 4 from level 4), a drop bank along a
    side or across the middle, standups, a saucer on most, rubber posts, kept apart so the ball passes (`free`, `occ`). `LV`:
    the slope `g` 1.15 to 1.75, flippers 0.086 to 0.078 long and set wider (`gap`), outlanes wider (`out`), bumpers harder
    (`kick`), the ball save 10 s down to none (`save`), kickbacks in both outlanes at levels 1–3 and the left at 4 (`kb`). The
    side walls bulge in above the outlanes (`bulge`), so a ball riding a wall is turned toward the divider's post.
  - **The ball** (`sub`, 1/600 s): gravity down the table; segments (`hitSeg`) and circles (`hitCirc`) found through a grid of
    cells (`T.grid`); each kind its own bounce (`E`); a flipper is a tapered capsule turning about its pivot (26 rad/s up, 16
    down) and the ball meets its surface moving at ω × r (`hitFlipper`); bumpers and the slings' faces kick (`T.D.kick`,
    `SLING_V`); the gate is solid only to a ball going down; the saucer holds a slow ball 0.9 s and kicks it out; a kickback
    lit sends a ball in its outlane straight up along the wall, past the divider's post (sent up the middle of the lane, or
    inward, it met the post from below and fell straight back). The plunger's pull is drawn, never moved (a ball drawn down past the stop was
    pushed through it). `endBall` pays the bonus (× 500 × the multiplier, none after a tilt).
  - **Score**: bumper 100, sling 10, drop target 500 (the bank 5000, the multiplier up to ×5, both kickbacks lit, up again a
    second later), lane 300 (all lit 2000 and the multiplier up; a flipper press moves the lit lanes along, `setFlipper`),
    standup 300, saucer 1500; targets, lanes and the saucer add to the bonus.
  - **The steady player** (`botStep`): flips as the ball comes down a flipper, at a point along it drawn for each approach,
    one in ten too late (`MISS`); pulls the plunger to a power of its own. A board no one plays shows the first `REEL_T` (40)
    seconds of its game (`simGen`, sampled `REC_HZ` 30 a second: the ball, both flippers, drops, lanes, bumpers and slings
    lit, the multiplier, the kickbacks, the pull; `frameOf`, `viewOf`), worked out a little at a time (`tableSoon`, 8 ms in
    30). Par, only for a board framed or played (`wantPar`, `parGen`), is the mean of `PAR_GAMES` (3) whole games up to
    `GAME_CAP` (240 s). Measured on 20 tables a level: median par 232k, 201k, 88k, 56k and 21k; a game 177, 150, 102, 65 and
    40 s; 70–310 ms to work one out. Where the steady player's balls go (30 tables a level): an outlane 74% at level 1, 56% at
    3, 57% at 5, the rest between the flippers; a ball lasts 54, 29 and 11 s. (First the inlanes were laid narrower than the
    ball, and every ball coming down a side went down its outlane; a ball lasted 11 s at level 1.) It never nudges, which is
    how a person saves an outlane ball. 2.5 million steps of its play found no ball through a flipper.
  - **Controls**: ← → (Z and /, A and D, the Shift keys) flip; ↓, S or Enter held pulls the plunger, let go launches; ↑, W or
    N nudges, three in three seconds TILT (the flippers dead and no bonus that ball). A press on the table (touch or mouse,
    heard before the field in the capture phase: `pressAt`, `press`, `OWN`) is the left flipper on the left half and the right
    on the right, as long as it is held, both at once with two fingers, or the plunger while the ball waits on it; a finger off
    the table still flies the view. A touch's echo as a mouse press is ignored (`mouseIsTouchEcho`): the tap that started a
    game launched its ball.
  - **Through**: three balls; stars by the score against par (`starsOf`: par 3, 60% of it 2), the best a board kept
    (localStorage `pinball.best`, by board and level); a tap on a finished board, after `GRACE`, goes on to the next. The flight
    there is to the board beside, unwrapped (`gotoCell(c - 1, r)`; `onFramed` wraps what it is told): to the wrapped number,
    from the corner board it went the long way round the whole field, three seconds of empty boards.
  - **Drawn**: the playfield a picture a table (the photo tier, `paint`, 512 px tall from `HI_PX` 300 px boards, else 256: a
    gradient in the table's own hue, rays from the bumpers, the lane and the apron, rings under the lamps, arrows, the level's
    colour round it); rails and rubbers as boxes along their segments (`pbBar`), posts, bumpers with lit caps, drop targets up
    or down, the flippers (`pbFlipper`, an extruded outline, yaw never 0), the ball, and lamps (`pbLamp`, unlit) for the lanes,
    the multiplier, Shoot Again, the kickbacks and the saucer. Measured in the sandbox's software renderer: 7.75 frames a second
    framed (10 with nothing on the boards, the tall board's own cost; mini golf 6.5 with nothing).
  - The smoke test checks the levels by ring, the same table twice and another on the next board, the dials, the launch through
    the gate never coming back down the lane, 72,000 steps of the steady player with the ball never out of the cabinet, a
    flipper's throw, a bumper's kick, a drop bank down with the multiplier up and back up after, a lane lit and moved along, the
    ball save, the kickback, a tilt, the pieces and the picture, par near the corner above par far out, and real input: a
    click starting, the real Down launching, the real arrow flipping, real touches on each half and both with the view still,
    a new game's tap not launching, game over with stars and a best, a click going on to the board beside (not round the
    field); and a board no one plays moving.
  - **Eras, ramps and orbits, every table fitted to its level** (Oct 25: "what are ways we could improve pinball, like more variety
    and the further from the center, the more difficult, and more variety of styles", then "proceed" on ramps and orbits, eras, and
    tables remade until they fit):
    - **Eras** (`ERAS`, `eraOf`: by the board's number alone, so a board keeps its era at every Difficulty): wood rail (five balls,
      no drop targets or ramps, passive bumpers at half the kick, more rubber posts, a gobble hole that takes a ball rolling over it
      slower than 1.5 for 5000 and ends it; cream in a wooden frame, brass rails; bells), electro-mechanical (five balls, drop
      targets, an orbit on half; bright with chevrons, stripes and stars; chimes for the 10s, 100s and 1000s), dot-matrix (three
      balls, one or two ramps and an orbit; dark with rays, plastic ramps, a word in orange dots on the apron, `dotPanel`) and
      modern (three balls, two ramps and an orbit; navy with a grid and lines of light, wire ramps). `palette(T)` gives each era's
      colours; `beep` plays bells or chimes for the first two (`ERA_NOW`, set by `flush`).
    - **Ramps and orbits** (`T.ramps`): a mouth (two posts, a short guide back from each, `mouth`) entered across its line moving in;
      the ball then rides a set path (`spline`, a Catmull-Rom curve, read by length with `pathAt`; `rideStep`, `S.ride`). A ramp
      faces the far flipper, climbs to `zmax` (0.056 to 0.08 by level, `rampZ`) and comes down onto its own side's inlane (`T.inl`);
      the ball rides at √(v0² − 2·`GV`·z), so a weak shot stops short and rolls back out of its mouth. An orbit's two mouths are low
      on each side and its way runs round the arch between them, entered moving up at `ORBIT_V` or more. Ramp 1500, orbit 1000,
      times the combo (one more for each made within `COMBO_T`, 4 s, of the last, up to ×4; the arrows in front of the mouths blink
      while one is on). A side drop bank gives way to an orbit (the bank goes across the middle, clear of the ramps' mouths, or
      none). Drawn: ramp pieces every `RAMP_STEP` at their height (`Rp.draw`), the ball raised on a ramp (`b.z`, recorded as the
      reel's ninth number, `REC_F` 9); orbits as lanes painted on the picture, ramps' shadows too.
    - **Remade until it fits** (`fitGen`): a board's table is played by the steady player as it is made, `FIT_BALLS` (5) balls each
      cut off at `BALL_CAP` (50 s); its life (the mean ball, `lifeOf`) must fall in its level's band (`LIFE_BAND`: 28+, 20–34,
      14–26, 9–18, 4.5–12 s), else the next attempt (`makeTable(idx, lv, a)`, the playfield's seed taking the attempt) up to
      `FIT_TRIES` (6), the nearest kept (`offBand`). The run is also the board's recording. The level dials were spread further
      too (the slope 1.15 to 1.85). A board waits as its bare cabinet (`makeTable(…, true)`) until made; the framed board's table
      is worked on `URGENT_MS` (30 ms) a frame, a played one at once (`readyNow`, in `fresh`); its game is made only when played.
      Measured on 16 tables a level: lives 36, 29.5, 22, 12.5 and 7.7 s by level (one in the first three tries mostly), 10 to 430
      ms to make one. Single runs are noisy (a table's life varies about a quarter run to run), so the bands are wide.
    - The smoke test checks every era among the first 60 boards with its balls and parts, a hard shot riding a ramp up and out
      on its inlane for 1500, a second within the combo's time for 3000, a weak shot rolling back out unscored, an orbit round to
      the other mouth, a gobble hole taking a slow ball, tables fitted at levels 1, 3 and 5 (in band or every try used, a ball
      lasting over twice as long at level 1), the ramps and a ball on one drawn raised, and each era's picture.
    - A touch's echo as a mouse press is also known by the events' own times (`touchTS`, `echoOf`): with the page busy, the echo of
      the tap that began a game was handled past the field's 700 ms window and launched the ball.
  - **Multiball, toys, the upper flipper, themes, a live display** (Oct 25: "whats next for pinball", then "1,5,6,7,9"):
    - **Several balls**: the ball in play is `S.b`, the others in multiball `S.xb`; what a ball is doing is kept on it (`b.ride` on
      a ramp, `b.hold` in the saucer or waiting to be let out with `b.kick`, `b.mag` held by the magnet), and `S.ride`, `S.hold` and
      `S.sIn` are getters onto the ball in play's. `sub` steps each ball (`stepBall`, `rideStep`); a drained ball in multiball gives
      way to another (only the last one's drain is a drain), and balls meet as equal balls (`ballsMeet`). The steady player watches
      every ball, each side going for the one nearest the drain on its flippers.
    - **Multiball** (the dot-matrix and modern eras, `ERA.multi`): balls lock in the saucer, or in a ramp on a table without one
      (`T.lockBy`), while the lock is lit (`lockLit`: from the start at levels 1–2, after `LOCK_NEED` 1 or 2 ramps or orbits since the
      last lock farther out; two blue lamps by the lock, `lockSpot`). A lock keeps the ball where it was (drawn there) and brings a
      new one to the plunger; the third lock lets the two out after it (`startMulti`), and while more than one is in play every ramp
      made (every orbit on a table with no ramp) is a jackpot, `JACK0` (25,000) + 5,000 a level, 10,000 more each time. Locks stay
      from ball to ball.
    - **Toys** (by era in `ERAS`): spinners (`T.spinner`, a plate the ball spins going under it, 100 a half turn, `spinA`, `spinW`),
      rollover buttons (`T.rolls`, three, 500 each, all three 3,000), a captive ball (`T.captive`: a channel shut at its top, two posts
      at its foot closer than a ball; it moves only along the channel, met with that constraint, `capY`, `capV`; up to its top,
      2,500), a magnet (`T.magnet`, on `MAG_ON` of every `MAG_CYCLE` s, `magOn`: pulls a ball in, holds it 0.8 s and throws it up the
      table, 500) and a moving bank of three targets (`T.mbank`, sliding to and fro on the clock, `mbX`, 750 each). The upper flipper
      (`T.fl[2]`, `upper`, `side`) sits on a side wall partway up and works with that side's button (`setFlipper` works a side).
    - **Themes** (`THEMES`, `eraOf` by the board's number, beside the era): space, deep sea, a haunted house, a circus, a jungle;
      each its own hue (the era's palette follows it), art painted over the era's ground (`themeArt`), and its own jingles for a
      lock, multiball, a jackpot and a lock lit (`themeJingle`, `THEME_NOW`).
    - **The display**: dot-matrix and modern tables show the score, now and then the ball's number, and for 1.8 s what just
      happened (`MSGS`, `msg`, `dispText`) as dots lit on the apron's panel (`DISP`, 66 × 9; `pbDot` pieces from `DOT_PX` 160 px
      boards; the panel and its unlit dots are painted). Its letters are a 5 × 7 dot font of the page's own (`FONT`, `dotsOf`): drawn
      from a canvas's pixels the frame time doubled in the sandbox, every board's changing score asking the graphics card for pixels.
      Wood rail and electro-mechanical tables turn seven number reels (`pbReel`: a ten-sided drum wearing the ten figures, `reelGeo`,
      `reelTex`; `reelsOf` turns each on toward its figure, forward only, 16 figures a second), behind a bezel with a window so only
      the figure on top shows, from `REEL_PX` 120 px.
    - **Recordings** carry it all (`frameOf`, `REC_F` 20, 21 since the missions): the upper flipper, two more balls, the locks, multiball, the rollovers, the
      display's message and ball, the spinner, the captive ball and the score.
    - Refitted (`LIFE_BAND` 28+, 20–37, 14–27, 9–18, 4.5–12 s): measured on 16 tables a level, lives 39, 32, 24, 14 and 9 s; 18 to
      905 ms to make one. Over 40 tables and 90 s each the steady player locked 17 balls, set off 2 multiballs and took a jackpot.
    - The smoke test checks every theme among the first 80 boards, a saucer's and a ramp's two locks and third setting three balls
      going, a jackpot in multiball and the next one 10,000 more, a drained ball giving way to another, the lock lit only after a
      shot at level 3, the upper flipper raised with its side and throwing a ball, the spinner, rollovers, captive ball, magnet and
      moving bank each scoring, the display's words and dots, the reels rolling to the score, and a recording's frame.
  - **Missions, and a steady player who aims** (Oct 25: "whats next for pinball", then "5,1"):
    - **Missions** (`MIS`, `misStart`, `misCount`): a ball caught in the saucer (on a table with none, the top lanes all lit) starts the
      board's next mission, drawn from those its table can hold (`has`) by the board's number and how many it has started, never the
      same twice running: ramps, orbits, the drop bank, spinner shots, the rollovers, the captive ball, pop bumper hits, the top lanes,
      standups, the moving bank, the magnet. Each counts one event (`ev()` counts it before the sounds, so quiet games count too);
      `need` (by level) before `MIS_T` (30, 28, 25, 22, 20 s) pays `MIS_AWARD` (25,000) + 10,000 a level, times one more for each won
      this game (up to ×4), and 5 to the bonus; time up, nothing ('TIME UP'). It ends with the ball. Shown: the dot panel says what
      is left and the seconds three seconds in four (`dispText`; the count dropped when the line is too long), six orange clock lamps
      go out as the time runs down (all eras, painted rings at y 0.733), its targets blink, the title and a notice say it. Recorded as
      the 21st number (`misCode`, `misRead`). The moving bank's hits are their own event now (`mbank`).
    - **Aiming** (`shotNow`, `offOf`, `wantOf`, `clearTo`): as a ball comes down a lower flipper the player flies the flipper alone
      ahead from the ball as it is, each step, and flips the first moment the shot heads within `AIM_TOL` (0.05 rad, plus an angle its
      hands are off by this time, `AIM_SD`) of what it wants most that it can see straight (`clearTo`: nothing standing in the way,
      kept by place): in multiball a jackpot ramp, a lit lock, the mission's targets or the saucer to start one, any ramp or orbit; a
      want lower down only while those above head more than `AIM_OK` off; else late (`AIM_LATE`). One approach in five (`AIM_FREE`)
      it takes as it comes, still one in ten too late. A table's shots worked out in advance (the flipper alone, a ball rolling down
      it) were tried first and barely helped: the balls come at the flipper every way. Over 40 tables × 90 s: ramps 110 against 58
      flipping anywhere; an aimed flip's ball comes within 0.025 of what it aimed at 36% of the time.
    - The saucer catches a ball under `SAUCER_IN` (3.4; 2.4 before): a shot from a flipper reaches it faster than 2.4. A ball come to
      rest where no flipper reaches (on top of the right flipper's pivot) is shoved after `STILL_T` (1.5 s, `shove`, which a person's
      nudge uses too): a game sat there until its time ran out.
    - **Which 40 s are recorded** (`simGen`'s `REC_PRE`, `REC_MIN`, `recKind`): from 6 s before the game's first multiball, else its
      first mission, else the start. Of 40 boards near the corner, 2 show a multiball, 19 a mission (7 won); multiball needs three
      locks and comes mostly at the easy levels, where a game lasts (9 multiballs in 16 whole games on tables that have one).
    - Refit unchanged: lives 39, 30, 18.5, 12.4 and 7.1 s by level, all in band; 20 to 1,570 ms to make a table. Par near the corner
      is far higher (1.48 million on the smoke test's board, which plays five long balls; a level-1 board is 50k–400k).
    - Found here: the number reels kept their figures in `holder.reel`, which on a board no one plays is that board's recording, and
      wrote over its first frame; now `holder.reels`.
    - The smoke test checks a mission started by the saucer at its level's clock, won for 25,000 then 50,000, time up, ended with the
      ball, started by the lanes on a table with no saucer, recorded and read back ('12 POPS 20', the clock's lamps), a ball on a flipper
      flown ahead going up the table, the aiming player making more ramps and orbits than one that does not (16 tables), and a
      recording starting before its mission or multiball.
  - **A table of your own** (Oct 25: "whats next for pinball", then "1": a table editor in the bottom row, the steady player
    checking it, shared as a link):
    - **Builders and a spec**: `makeTable`'s parts are each laid by a builder (`B.orbit`, `ramp`, `upper`, `magnet`, `mbank`,
      `captive`, `spinner`, `rolls`, `gobble`, `bumper`, `bankSide`/`bankMid`/`bankNone`, `stand`, `saucer`, `post`) that also writes
      it into the table's plain spec (`T.spec`: `{v, era, theme, lv, orbit (its mouths' y or 0), ramps [[side, x, y]], upper
      [side, y], magnet [x, y, phase], mbank [xc, y, period], captive [x, y1], spinner, rolls, gobble [x, y], bumpers [[x, y]], bank
      {side, y0, n} | {x0, y, n} | null, stands [[y, side]], saucer [x, y, kick x], posts [[x, y]]}`, to a thousandth). A board's own
      table makes the same draws in the same order as before, so every board keeps its table (900 checked identical against the
      page before). `makeTable(idx, lv, a, bare, spec)` lays a spec (`layOut`; its era, theme and hue from `ehOf`); a board's spec
      made again is its table to 0.0007.
    - **The editor** (`ED`, `ed…`, the tilt maze's hooks): the dots, or the menu's Make a table for this board…, take the framed
      board's table into the editor (`edStart`: its spec through `cleanSpec`), drawn as it is made (`ED.M`, a new photo key each
      change). Tools: Bumper, Post, Saucer, Ramp (its side by the tap; one a side), Orbit (a tap lays or takes it), Drop bank
      (across, or along a side wall when tapped near one), Standup and Upper flipper (on the nearer wall), Spinner, Rollovers,
      Captive ball, Magnet, Moving bank, Gobble hole, Erase; the same tool on a part of its kind takes it away, one of a kind
      moves. A press on a part drags it, kept where it last fitted (`claimsPan`, `edDragStart`, `edDragAt`). Parts keep a ball's
      width apart and inside the playfield (`partsOf`: the circles each part takes up, makeTable's own measures; `clashOf`,
      `putPart`, `takePart`; up to 8 bumpers, 10 posts, 4 standups). Acts: Era, Theme, Level (a level whose wider flippers would
      meet a part is refused), Clear, Check (`edCheck`: the steady player's `FIT_BALLS` balls, how long one lasts against the
      level's `LIFE_BAND`, and the level it plays like), Play. Quick buttons Erase, Check, Cancel, Done. While editing the keys
      start nothing.
    - **Kept** (`MINE`, localStorage `pinball.mine`, the latest 300, read back through `cleanSpec`): `tableFor` asks it first
      (`mineTable`: the table from its spec, its recording and life from one steady-player run, par when wanted, `key` 'm' + a hash
      of the spec, so a changed table starts its best afresh: `bestKey`); `knownTable` for the boards only looked at. Framed in
      violet (`MINE_COL`); the title says "your table". Escape or Cancel leaves the board as it was. Menu: Share this board's table
      (`shareTable`, `SHARE`; the draft while making it), Forget this board's table; a shared one (`takeTable`) goes through
      `cleanSpec`.
    - The older eras' ramps were never drawn before (none had any), and drew black: wood rail's are cream, electro-mechanical's
      the table's opposite hue.
    - The smoke test checks 40 tables made again from their specs, the real dots opening the editor, a real click laying a bumper
      where it fell and a real drag moving it, a part too near another refused, a ramp a side, Check, the real ✓ keeping it in
      storage as the board's table and playing it, a shared copy on another board, and nonsense through `cleanSpec`.
- **Pong** (Oct 27: "lets create a polished pong application. what do you suggest?", then "all. provide cusomtization options in
  the bottom browser."): `PONG_APP`, id `pong`, after pinball. A table a board, `W` (0.62) wide by 1 long (the app's `boardShape`,
  `frameFit` 1.1), your paddle at the near end (seat 0, y `PY[0]` 0.94), the computer's at the far end; laid out in table units and
  divided by W at the end, as pinball's.
  - **The feel** (`tick`, `stepBall`, `hit`): ticks of 1/60 s (`TICK`), each `SUB` (8) steps; a paddle's face is met where the ball's
    way crosses it between two steps, so nothing tunnels (the smoke test: 1,600 returns at 2.5 times a level-5 serve's speed, none
    through). Where it meets the paddle sets the angle (up to `MAXA` 1 rad); each return `UP` (4%) faster, to `VMAX` (2.3) times the
    serve; the paddle's speed carries into the ball (`CARRY`) and puts spin on it (`SPIN`, curving it, dying over `SPIN_T`); a fast
    swipe into the angle is a smash (`SMASH`: 15% more, the table shakes). Paddles speed up and slow down under a limit (`acc`).
  - **The match**: first to 11 (5 or 21 from the row), won by two; the loser of a point serves after a countdown (`serveT`: 1.5 s, or
    0.6 quick; a tap or Space serves at once, `serveNow`); the board's far player serves first. Over, a tap after `GRACE` goes on to
    the board beside (`gotoCell(c - 1, r)`, as pinball).
  - **Harder farther out**: a level 1–5, the ring level plus the Difficulty (Easy 0, Normal 1, Hard 2). `LV`: the serve's speed, your
    paddle's half length (0.09 down to 0.061; the computer's `CPU_HW` 0.075), and the computer (`think`): it looks again every `react`
    s (longer on a steep ball), guesses the crossing (`landing`, walls folded in, spin not) off by `err` (more on a steep, fast ball),
    moves at `v` with `acc`, so it runs past where it meant to stop, and aims away from you at `aim`'s rate. Against the steady player
    (`STEADY`, a person's hands, the same everywhere) over 8 matches to 11: level 1 and 2 it won every one by 8–11 points, level 3
    by 2–9 (one lost), level 4 and 5 it lost; a match lasts 2–4 minutes and takes 4–7 ms to work out.
  - **Recordings and par** (`recOf`, `recWork`, `recSoon`, `recView`, `RECS` 400): a board no one plays shows the steady player against
    its computer, frames of 7 numbers at `REC_HZ` 30 for the first `REEL_T` (40) s, looped at the board's own phase, a few boards
    at a time (8 ms in 30); the framed board's match is played to the end for par (`parOf`: the points the steady player gave away
    winning; if it lost, the target). Stars (`starsOf`): a win giving away par or fewer ★★★, a win ★★, a loss with half the target ★;
    the most kept by board, level and target (localStorage `pong.best`).
  - **Hands** (`pressAt`, `handAt`, `handUp`, `OWN`, heard before the field in the capture phase, as pinball's): while a match is under
    way every press on the table is a paddle's, held under the finger (`HAND[seat].tx`, at most `HAND_V` 4 a second), so the view
    never pans under it; a touch's mouse echo is known by its time (`echoOf`). ← → (and A D with one player) move the near paddle
    (`KEY_V`), the screen's way (`screenToBoardDirs`). **Two players** (the row's Players): every touch takes the paddle of its half,
    so a finger each; the arrows against A and D; stars and a best only with one.
  - **Themes** (`THEMES`, `themeOf`: by the board's number, the corner Classic, unless the row picks one; `LOOK`, `paint` on the photo
    tier): Classic (black, white blocks, a square ball, scan lines, square-wave blips), Neon (a glowing grid, cyan and pink paddles,
    gliding sawtooth), Table tennis (a blue table, the net, red and black bats with handles, a tock) and Ice hockey (ice with skate
    marks, red and blue lines, circles and creases, mallets with knobs, a puck, a thud off the boards, a horn and the crowd for a goal).
    The centre line and the score's 3 × 5 dot digits (`DIG`, `digits`) glow; the countdown is dot digits by the server; the ball leaves
    a trail; a hit rings (a smash a gold ring), a wall flashes, a paddle squashes a moment.
  - **Sounds** (`sfx`): each theme's set, a return's pitch climbing 3% a hit of the rally; a crowd (`crowd`, filtered noise) swells in
    at rallies of 8, 14 and every 6 after.
  - **Power-ups** (off at first; `POWERS`, `powerStep`, `take`): a token in the middle of the table every `PW_GAP` (6–10) s, gone after
    `PW_LIFE`; the ball over it gives it to whoever hit last: three balls (each scores as it goes out; the serve waits for the last),
    a paddle half again as long for 8 s, curve (three times the spin) for 8 s, the game at 0.55 speed for 5 s.
  - **The row is the settings** (`tilesOf`, `setting`, `SET`, localStorage `pong.settings`): New match (Restart while playing, the
    score over it), Theme (By board, Classic, Neon, Table tennis, Ice hockey), Points (5, 11, 21), Players (One, Two), Ball speed (Slow,
    Normal, Fast: ×0.8, 1, 1.25), Paddle (Small, Normal, Large: ×0.8, 1, 1.25), Trail, Power-ups, Serve (Countdown, Quick), Shake &
    flash, Sound. What changes the play (points, players, speed, paddle, power-ups) starts every match and recording afresh.
  - The smoke test checks the levels by ring, no tunnelling, the steady player's share of points at levels 1 and 5, a recording's par,
    power-ups taken, and real input: a click starting, the real ← and a real drag moving the paddle (under the finger), a point and a
    match won with stars and a best, two real fingers each taking a paddle with the view still, a real click on the Points tile
    (stored), and a board no one plays moving.
  - **The paddle's face and its step forward, each theme's physics, four more themes, arenas** (Oct 27: "whats next for pong", then
    "3,4,5"; the row's Paddle face, Paddle moves, Physics and Arena, `ORDER` naming the tiles, `setting(key)`):
    - **Curved** (`SET.face`, `CURVE_N` 0.42): the face's normal leans out by the offset × `CURVE_N` and the ball is reflected off it
      (`hit`), so straight on at an end goes back at twice the lean and the angle in counts; Flat (the default) is as before.
    - **The step forward** (`SET.reach`, on by default; `REACH` 0.07): a paddle stands `dy` in from its end (`faceY(k, G)`, `padY`).
      A finger moved up the table from where it pressed steps it in (`HAND[seat].dyT`, `handAt`), ↑ / ↓ too (W / S, the far paddle with
      two players); let go, it steps back. A hit while stepping adds `FWD_K` × the step's speed and over `FWD_SMASH` is a smash, and the
      ball always leaves faster than the face. The face is met from where it was at a step's start to where it is at its end
      (`fyPrev`), so a fast step never lets a ball through either (smoke: 700 returns stepping in and out, none through). The computer
      and the steady player do not step.
    - **Each theme's physics** (`SET.phys`: By theme, the default, or Plain; `PHYS`, `physStep`, `bounceStep`): table tennis and tennis,
      the ball bounces on the receiver's half (`BOUNCE`: at 0.72 or 0.78 of the way, arcs `h1` and `h2`; `b.z`, drawn raised with its
      shadow, recorded as a frame's 8th number) with a tick; on the ice the puck slows to `ICE_FLOOR` of the serve (`ICE_F`), a return
      building on the speed it last left a stick at (`b.vh`: on its slid speed matches ran to the cap); air hockey's ends are walls
      but for a goal's mouth `GOAL` (0.26) wide; Space pulls toward the middle (`GRAV`, softened within `GRAV_S`; `keepGoing` keeps
      the ball off crawling). A theme's change starts every match afresh when physics follow it.
    - **Four more themes**: Tennis (a mown grass court and its lines, a net, rackets with strings and a handle, a yellow ball, a pock
      and applause), Air hockey (air holes, the red line, goal mouths in the rails, mallets with knobs, a puck, a clack and a buzzer),
      Space (nebulae and stars, a swirl and the well's rings, glowing bars, a zap) and 8-bit (big pixels, a white block border,
      paddles of pixels, square-wave arpeggios). Eight in all, by board unless the row picks one.
    - **Arenas** (`SET.arena`, off at first; `arenaOf(idx, lv)`, `ARENAS`, `arenaStep`): every piece with its twin half a turn about
      the middle (W − x, 1 − y), kept to y 0.27–0.45 and its twin, apart: a pair of bumpers at level 1 (a kick, no slower than the
      serve), short walls from 2 (some upright), from 3 sliding walls (`moverX`, `moverV`: the ball meets them moving) or, one board
      in three, a barrier across the middle with a gap, from 4 a pair of portals (in one, out of the other going on as it went,
      `portT`), at 5 more bumpers. A piece struck lights (`G.flash`). Recordings carry the arena, its sliding walls at the frame's
      time. Over 4 matches a level the steady player won 11–0s at level 1, about even at 3, lost at 5; every match ended.
    - The smoke test checks the curved face (twice its lean at an end, an angled ball reflected at the middle where flat sends it
      straight), a step forward faster and none through a stepping face, the bounce on each half and the ball raised, the puck
      slowing to its floor, air hockey's wall and goal, the well bending a ball, the arenas' pieces by level and their twins, a
      bumper, a wall and a portal each doing their part and a sliding wall where its clock says, arena matches ending at levels 1,
      3 and 5, all eight themes painted and drawn, and a real drag up the table stepping the paddle in and back on letting go.
- **Air hockey** (Oct 27: "this is a cool game. what other games could we create like pong.", then "1": "air hockey, played
  properly"): `AIRHOCKEY_APP`, id `airhockey`, after Pong, built on Pong's ways (ticks of 1/60 s in `SUB` 8 steps, recordings, par,
  stars, the row as settings, hands heard before the field). A table `W` (0.62) by 1 (`boardShape`, `frameFit` 1.1), your goal at
  the near end; each end rail but for a goal's mouth `GOAL` (0.26) in its middle.
  - **The puck and the mallets** (`stepPuck`, `hitMallet`): the puck slides with a little air drag (`drag`, by level), loses
    `E_RAIL` off each rail, at most `VMAX` × the level's speed. A mallet is a circle anywhere in its own half (`bounds`); the puck
    meets it as a circle meets a circle, the mallet as heavy as the table: off at the mallet's speed into it plus its bounce
    (`E_MAL`; a swing of 1 sends a still puck off at 1.9). Pinned against a rail the puck stays on the table, its speed into the
    rail gone, and the mallet gives way, so it is never inside a mallet (the smoke test watches nine matches).
  - **The match**: first to 7 (5 or 11 from the row). A goal puts the puck back at rest in the half of the one scored on after
    `GOAL_T`; a puck at rest on the middle line for `STILL_T` (3 s) is nudged to a side, and one that has hardly moved for twice
    that anywhere (dug into a corner) is sent toward the middle with the mallets stepping back.
  - **The computer** (`think`, `LV` by level, the ring level plus the Difficulty): looks again every `react` s; a puck coming at its
    goal, it gets in front at its guess of the crossing (`crossing`, off by `err`, more on a steep one); a puck slow in its half, it
    lines up behind it toward your goal (off by `aimErr`, a bank off a rail at `bank`'s rate) and strikes through it; a puck with no
    "behind" on the table (a corner, the end rail) it shoves out and steps back (`shove`, `back`: pressing on, it pinned the puck in
    the corner for whole matches); else it drifts home. It speeds up and slows down under `acc`. Against the steady player
    (`STEADY`) over 6 matches to 7: level 1 and 2 it won every one, level 3 half, level 4 one, level 5 none; a match 2–3.5 minutes.
  - **Hands** (`pressAt`, `handAt`, `HAND`, `OWN`): while a match is under way a press on the table is your mallet's, which goes
    where the finger is (held to your half, at most `HAND_V` 5 a second); with two players each touch takes the mallet of its
    half. Arrows move the near mallet (W A S D too with one player, the far one with two), the screen's way.
  - **Themes** (`THEMES`, `LOOK`, `paint`, by board unless the row picks one): Classic (white with air holes, red and blue), Neon,
    Stars and stripes, Wood rail (green top, a wooden rail). Mallets are a disc, a darker ring and a knob, squashed a moment as they
    strike; the puck leaves a trail; a strike rings (a hard one gold, the table shaking), a rail flashes, a goal rings its mouth;
    dot-digit scores by the middle line. Sounds: a clack, a rail's thud by how hard, a buzzer and the puck dropping.
  - **Recordings and par** (`recOf`, `recWork`, `recSoon`, `recView`): the steady player against the board's computer, 9 numbers a
    frame at 30 a second for 40 s; the framed board's match to its end for par (goals let in winning, `parOf`); stars as Pong's
    (localStorage `airhockey.best`).
  - **The row** (`tilesOf`, `setting`, `ORDER`, localStorage `airhockey.settings`): New match, Theme, Goals (5, 7, 11), Players,
    Puck speed, Your mallet (Small, Normal, Large: `MALLETS` 0.034, 0.042, 0.052), Trail, Shake & flash, Sound.
    Defaults (Oct 29: "defaults: puck speed slow.   trail - on.   shake & flash - on"): the puck Slow, Trail and Shake & flash on;
    settings saved before (`v` under 2) take those three afresh once.
  - **Rounded corners** (Oct 29: "balls get stuck in the corners in air hockey"): the corners were square, so a puck pushed into
    one met both rails, lost its speed into each and sat dead (in a corner 6% of the computer's matches, up to 7 s; pressed by a
    mallet and let go, it stayed till the 6 s nudge). Each is now an arc of radius `CR` (0.085; `cornerAt`, `inCorner`), painted
    as rail: the puck bounces off it as off a rail, a mallet is kept off it, a pinned puck loses only its speed into the arc and
    slides out along it, and a puck still in a corner for `CORNER_T` (1 s) is sent toward the middle. Measured: in a corner under
    1% of the time, 0.2 s at most; a pressed puck out in 0.45 s. The smoke test (part 7, "air hockey corners") checks all three.
  - The smoke test checks the levels by ring, a swing passed into the puck, the rail and a goal only in the mouth, the puck never
    inside a mallet, matches ending at levels 1, 3 and 5 with the steady player's share falling, a recording's par, the four themes
    painted, and real input: a click starting, a real drag putting the mallet under the finger across and along, the real arrow, a
    match won with stars and a best, two real fingers each taking a mallet with the view still, a real click on the Goals tile,
    and a board no one plays moving.
- **Squash** (Oct 27: "this is a cool game. what other games could we create like pong.", then "2 -squash"): `SQUASH_APP`, id `squash`,
  after air hockey, on Pong's ways (ticks of 1/60 s in `SUB` 8 steps, recordings, par, stars, the row as settings, hands heard
  before the field). A court `W` (0.66) by 1 (`boardShape`, `frameFit` 1.25), seen from behind: the front wall at the far end, both
  players anywhere on the floor (`bounds`), and a ball with a height.
  - **The ball** (`ballStep`): `z` under `GRAV`; off the front wall (`E_FRONT`), the side and back walls, the floor (`E_FLOOR`,
    `F_FLOOR`), rolling once a bounce is too low. The tin (`TIN`), the service line and the out line (`OUT`) are on the front wall.
  - **The rally** (`onBall`): turns go by (`G.to`); a shot must reach the front wall above the tin and under the out line before
    the floor ('tin', 'out', 'down': the hitter loses it), and the other must return it before its second bounce ('not up'). Volleys
    off the front wall, side and back walls all play. PAR scoring to 11 (5 or 15 from the row), won by two; the rally's winner
    serves from the box of its score's side (`setServe`; `serve` lobs it up and across, a tap or Enter serves yours sooner); a
    rally past `RALLY_CAP` is a let.
  - **The stroke** (`hit`): the racket meets the ball as it comes within `REACH` (Small, Normal, Large from the row) on your turn,
    below `ZREACH`. Where it meets across you sets the angle (`MAXA`), your run carries (`CARRY`), and how you move says the shot
    (`shotOf`): stepping in a drive, still a drop, going back a lob (`SHOTS`: pace, height on the wall, spread). A shot is sent to
    strike the wall at its height (`shoot`).
  - **The computer** (`think`, `LV` by level): on its turn it flies the ball ahead (`flight`) and runs to the first place it can
    reach in time, after the bounce if it can, off by `err`, standing so the ball meets it where it aims (away from you at `aim`'s
    rate), with drops and lobs (`drop`, `lob`); off its turn it goes to the T. Bodies push apart. Against the steady player
    (`STEADY`) over 8 matches to 11, its share of points 0.66, 0.68, 0.59, 0.30, 0.16 at levels 1–5; a match 4–14 minutes.
  - **Hands**: a press on the court is a player's, who runs where the finger is (at most `HAND_V` 1.6 a second); with two players
    each finger takes the player nearest it. One player: the arrows or W A S D; two: W A S D red, the arrows blue.
  - **Drawn**: the floor a picture (Classic maple, Show court, Hardcourt, Neon; `LOOK`, `paint`) with the short line, half-court
    line and service boxes; the front wall a box with its tin and lines, the side and back walls low; heights at half (`VZ`), since a
    wall its full height hid the back of the court on the board behind; players (body, head, racket, a ring under the one to hit);
    the ball raised, its shadow and trail; flashes on the wall, rings where it bounces; dot-digit scores on the floor.
  - **Recordings and par** (`recOf`, `recWork`, `recSoon`, `recView`): the steady player against the board's computer, 17 numbers
    a frame; par the points given away winning (`parOf`); stars as Pong's (localStorage `squash.best`); settings `squash.settings`
    (the row: New, Game, Mode, Points, Players, Hands, Shot, Court, Ball speed, Your reach, Guide, Trail, Flashes, Sound; `ORDER`;
    a ring with the first tile in the middle, so tiles 4–10 are brought round by a drag).
  - **Lets, strokes, the ball's height, racquetball, fives, doubles, drills** (Oct 27: "whats next for squash", then "3,4,6,7"):
    - **Four seats** (`G.pl`, `team(k)` = k % 2: 0 and 2 red, 1 and 3 blue; a seat `off` is not on the court; `seatsFor`). `G.to` is
      the side to play; either of a side may take its ball. Recordings are 17 numbers a frame (all four players, the call).
    - **Lets and strokes** (`blockStep`, `G.blkT`, `rallyEnd`): an opponent's body touching the striker's (`BLOCK_W`) on the ball's
      side of it while the striker runs at the ball; for `BLOCK_T` or more, a rally that side then loses 'not up' is a let (played
      again) when its striker was far from the ball, a stroke (its point) within `STROKE_R` reaches. The computer off its turn steps
      off the striker's way (`clearOf`: its line to where it is heading). The referee's call (`callOut`, `CALLS`) is said and written
      on the floor in a 3 × 5 dot font (`FONT`, `text`).
    - **Rallies end** (found while adding lets: rallies of two good players ran to the 60 s cap): a stroke at full stretch or on the
      run is less sure (`unsure`), late in a rally more so by the player's own `err` (`TIRE_A`), and the computer's legs tire
      (`TIRE_T`). Measured over 5 matches to 11 against the steady player, its share of points: squash 0.72, 0.58, 0.19 at levels
      1, 3, 5; racquetball 0.93, 0.59, 0.03; fives 0.75, 0.68, 0.04; a match 3–7 minutes (racquetball longer).
    - **The ball's height** (the row's Guide, on by default): a ring where the ball will first come down (`landing`, kept while the
      rally is the same, `G.landKey`), for your side's turn, all the way at levels 1–3, until it reaches the front wall at level 4,
      none at 5 (`GUIDE_LV`); a thin post from the ball to its shadow; your ring and a halo on the ball lit while it is in reach.
    - **Racquetball and fives** (`COURTS`, the row's Game, `C` on the match): racquetball no tin or out line, a ceiling (`ceil`
      0.5), a livelier ball, the short line at the middle with service lines and a dashed receiving line painted, side-out scoring
      (`scoring: 'side'`, only the server scores, 'hand out' passes the serve) to 11 won by one; fives a gloved hand (`reach` 0.75, no
      racket drawn), a slower ball, a board at 0.076 (its shots aim above it), side-out to 11. Points from the row: the game's own,
      5, 11 or 15 (`SET.target` 0 is the game's).
    - **Doubles** (the row's Players: One, Two, Doubles with a computer partner, Doubles × 2): the computer leaves a ball to a
      partner who gets there first (`earliest`), covers its own half off its turn.
    - **Drills** (the row's Mode; `newMatch(…, { drill })`, `G.drill`; every board its own by its number, `drillOf`, `DRILL_LV` by
      level; `DRILL_T` 40 s; par the steady player's score, its recording the board's show): Targets (a box on the front wall, `tw` ×
      `th`; every legal shot in it scores and a new one comes, `newTarget`), Rally (the longest run of returns alone; from level 3
      each must strike the other half of the wall, `alt`, 'OTHER SIDE'), Feeds (the machine at the wall's foot, `feed`, every `gap`
      s, away from you at `spread`'s rate, drops at `drop`'s, off a side wall at `boast`'s; a return scores when its first bounce
      comes down in the lit zone, `deep` and from level 4 `tight` to a side wall, `drillLand`, else 'SHORT'). Measured (4 boards a
      level, squash): Targets par about 9, 7, 4; Rally 25, 5, 3; Feeds 4, 7, 2 at levels 1, 3, 5. Stars: par 3, 60% 2.
  - **The swing, the shots, the styles** (Oct 27: "whats next for squash", then "1,2,6. also long press does not work to
    show bottom browser. why do some applications not support long press?"):
    - **Swing hands** (the row's Hands: Auto as before, or Swing; `G.swing`): a person hits only with a swing, asked for by a finger
      lifted off the court or Enter (with two people blue's Enter, red's Q: Space never reaches a game on its own clock, the
      field's pause takes it; `SWING`, consumed in `inputs`). The racket comes through from the middle of the swing to its end
      (`SWING_T` 0.2 s) and reaches `SWING_REACH` (1.25) times as far; the timing `tm` is where the ball is along its way when it is
      met, −1 still in front (early: across) to 1 level or past (late: toward the racket's side, `LATE_K`), past `MISHIT` (0.8) a
      mishit (slower, lower). The ring and the ball's halo light while it is in a swing's reach.
    - **Shots** (`SHOTS`): drive, drop, lob, and now the boast (hard across off the nearer side wall first) and the kill (hard and
      low, `zw` near the tin). A person's comes from a flick as the finger lifts (`flickOf`: its last tenth of a second faster than
      `FLICK_V`: up a kill, down a lob, across a boast), else the row's Shot (`SET.shot`, keys 1–5, 0 back to by movement), else
      the movement. The computer plays them at its level's `boast` and `kill` rates.
    - **Styles** (`STYLES`, `styleOf` by the board's number, the corner an all-rounder, `styled`): every board's computer a retriever,
      an attacker, a lobber, a power player (`pace` 1.15), a boaster or an all-rounder, multiplying its level's dials; named in the
      title and the start. Measured at level 3 over three matches each: the lobber's shots 32% lobs against a power player's 7%, the
      boaster's 22% boasts.
    - **Hands by skill**: every stroke's spread goes with the player's own `err` (`hands`, 0.7 to 1.5 of the base), so a level-5
      computer's kills clear the tin; without it the new risky shots made level 5 play like level 3. Over 5 matches to 11 against
      the steady player, its share of points: squash 0.87, 0.54, 0.15 at levels 1, 3, 5; racquetball 0.89, 0.67, 0.04; fives 0.83,
      0.65, 0.15.
    - **No hold of its own** (Oct 27: "its not that important. remove it."): squash, Pong, air hockey and pinball take every press
      on the board before the field while a game is under way, so the field's hold never comes there; the three dots open the row.
    - The smoke test checks no hit without a swing and a hit within one, early and late either way, a mishit slower, a boast off the
      side wall first, a kill low and fast, the flicks, the six styles and the lobber and boaster playing their own shots, and real
      input: the real Hands and Shot tiles (brought round by a real drag of the row), a real finger lifted swinging, the real Enter
      swinging.
  - The smoke test checks the levels by ring, a drive striking the wall at its height, the tin, down and not up, the angle off each
    side, drive/drop/lob by motion, a let and a stroke, the computer stepping off the striker's way, the landing foretold, the guide
    by level, the ball lit in reach, racquetball's ceiling and side-out scoring, fives' tin and reach, doubles with all four seats
    hitting, a target hit, a length scored and a short called, the rally's other side, a drill over at 40 s, matches ending at
    levels 1, 3 and 5 with the share falling, a match's and a drill's par, every court painted, and real input: a click starting, a
    real drag running the player under the finger, the real arrow, a real click serving, a match won with stars and a best, two
    real fingers each taking a player with the view still, real clicks on the Points, Game and Mode tiles, a drill started by a
    real click with the machine feeding, and a board no one plays moving.
- **Curling** (Oct 28: "2,   3 curling, bowling, marble run", the first of the new games: "stones that curl, sweeping, a house on
  every board"): `CURLING_APP`, id `curling`, after squash. The far end of a sheet a board, `W` (0.42) wide by 1 long (`boardShape`,
  `frameFit` 1.1): the house's rings (`RINGS`, the button at `TEE` 0.2), the far hog line (`HOG` 0.5), the back line, and your
  delivery at `REL` (0.93); stones `SR` (0.0128), red yours, yellow the computer's.
  - **The ice** (`slide`, steps of 1/240 s): friction `A0` slows a stone evenly (by the board's `fric`); it curls by its turn
    (`s`, ±1) at `CURL` × A0 × CV / (v + CV), so most of its curl comes as it slows; stones meet as equal masses (`E_STONE`) and both
    lose their turn. Sweeping (`SWEEP_A` 0.85 of the friction, `SWEEP_C` 0.6 of the curl) carries a draw swept all the way about
    0.13 farther. Out: touching a side line, wholly past the back line, or (a delivered stone that struck nothing) short of the
    far hog line (`hogCheck`). A draw curls about 0.04–0.05 (the house is 0.16 across its radius) and takes about 5 s.
  - **An end** (`SET.stones` each, 2–4; a game `SET.ends`, 2–8, a tie playing on an extra end): the side without the hammer first,
    by turns (`toThrow`); scored to the button (`endScore`: the side nearest scores one a stone nearer than the other's nearest,
    in the house); the side that scores gives up the hammer, a blank end keeps it.
  - **Every board its own ice and level** (`iceOf` by the board's number: curl 0.75–1.25 of `CURL`, swingier by a tenth a level;
    friction 0.92–1.08), a level 1–5 by ring plus the Difficulty, as every game with levels.
  - **The computer** (`plan`, `LV`): draws (the button, beside it, short), a guard early, freezes to your stones, stones behind its
    own and takeouts of yours (`solveDraw`, `solveHit`: the broom and weight found by a few throws of the stone alone), each played
    against the stones as they lie (`throwSim`) and valued (`valueOf`: the end's score if it ended now, the nearest stones' gap, a
    little for guards); its hands (`errX` on the broom, `errW` on the weight, `handsOn`), the best taken `pick` of the time; from
    level 3 it sweeps a stone it sees will stop short (`wantSweep`). Against the steady player (`STEADY`) over 8 games of 4 ends:
    the steady player won 8, 6, 4, 1 and 0 at levels 1–5. About 5 ms to plan a stone.
  - **Playing**: a tap or a drag on the sheet puts the broom (← → nudge it); the row's Curl (C), Weight − and + (↑ ↓), and the weight
    tile stepping through guard, draw, back of the house, hit and peel (its name from where the stone would stop, `weightName`);
    Enter, the row's Throw or a tap on your stone at the delivery throws (`throwMine`). While your stone runs, a press held on the
    sheet (heard before the field: `MATCH_KIT.hands`) or S sweeps; two brooms work at its nose. Your own last shot comes back for
    your next stone (`G.mine`). The shot is dotted before it goes (`previewOf`, unswept, through the stones as they lie): all of it
    with a ring where it stops at level 1, `PREVIEW` of it farther out (a quarter at level 5); the row's Show the shot turns it off.
  - **A board no one plays** shows an end of the steady player against its computer, worked out a throw at a time in the boards'
    share of time (`recOf`, `recWork`, `BOARD_KIT.budget(6, 40)`; frames of every stone at `REC_HZ` 15), played back on its own
    phase (`BOARD_KIT.frameAt`). About 80 ms an end.
  - **Through**: stars (a win by 3 or more ★★★, a win ★★, a draw ★), the most kept a board (`curling.best`, by board, level, ends and
    stones); a tap goes on to the board beside. Settings in `curling.settings`. Drawn: the sheet a picture (`paint`: ice, pebble,
    rings, lines, the hack), stones (`cuStone`, a lathe of granite) with handles in the team's colour turned as the stone turns
    (`cuHandle`), the broom, the dots, the sweepers' brooms (`cuBroom`), a flash where stones meet, the score in dot digits.
  - The smoke test (part 7) checks the levels by ring, a draw solved to the button, the curl both ways, sweeping farther and
    straighter, a takeout, the hog line, an end's score, games ending with the steady player better at level 1 than 5, and real
    input: a click starting, a real click putting the broom, the real Enter throwing, a real press sweeping, the computer answering,
    and a board no one plays moving.
  - **By hand** (Oct 28, "Games play with the row shut" above): a press on your stone (`STONE_GRAB`) dragged up the sheet sets the
    weight for it to come to rest about where the finger is (`weightAt`: the distance it slides, rising fast past the back line to
    a hit's and a peel's); a tap on a stone puts the broom on it with a hit's weight (`HIT_W`); a two-finger twist (`twistTurns`,
    `onTwist`) or the play pad's ⟳ turns the curl (`setCurl`).
- **Bowling** (Oct 28: "2,   3 curling, bowling, marble run", the second: "spin and pins"): `BOWLING_APP`, id `bowling`, after curling.
  Ten-pin, the far end of a lane a board, `W` (0.36) wide by 1 long: the pins on their deck (`SPOTS`, `S` 0.078 apart, the head
  pin at `HEAD` 0.27), the lane (`LANE` 0.27) between gutters (`GUT`) down to the foul line (`FOUL`), the arrows at `ARROWS`.
  - **The ball** (`roll`, steps of 1/240 s): straight on the oil; from the board's own oil line (`lane.oil`) the dry back end hooks
    it by its spin, `lane.hk` × hook, coming on over `RAMP`, turned across its way with its speed kept; no hook once on the deck
    or among the pins (slowed by them it turned on the spot and came back up the lane). Past the lane's edge it is in the gutter
    and touches nothing.
  - **The pins**: the ball meets them as `MB` (4.5) pins' weight; pins meet pins; the side kickbacks send them back (`E_WALL`); a
    pin struck harder than `DOWN_V` × `lane.carry` falls, lies the way it was sent and slides on under `PF`, and as it falls it lays
    its length (`TOPPLE` 0.085) onto any pin standing within 35° of its way (as real pins knock their neighbours: thin circles alone
    left the gaps between pins too wide, and a pocket ball took four); one only touched stands. A perfect pocket ball (the ball
    0.44 of a pin spacing right of the head pin, coming in at 8–11°) strikes.
  - **Frames** (`afterBall`, `scoreOf`): a strike or a second ball ends frames 1–9, the standing pins kept where they stand for
    the second; the tenth has a third ball after a strike or a spare, the pins set again whenever all are down. Scored as the game
    is (300, all 9-and-a-spare 190, all fours 80).
  - **Your shot**: where you stand (the row's Stand ◀ ▶, A D), where you aim (a tap or a drag on the lane, ← → nudge it), the
    speed (Speed − +, ↑ ↓, shown in km/h) and the hook (Hook − +, Q E, named straight to a big hook). Enter, the row's Bowl or a
    tap on the ball at the foul line bowls. Your last shot stays for the next ball. The way is dotted before it goes (`previewOf`,
    through the pins as they stand): all of it at level 1, `PREVIEW` of it farther out.
  - **Every board its own lane** (`laneOf` by the board's number at a level 1–5 by ring plus the Difficulty, `LV`): the oil ending
    sooner and the back end hooking harder farther out (`hk` 1.4–1.7 at level 1 to 2.7–3.2 at 5), so a ball off its line goes
    farther wrong, and the pins carrying less (`carry` 1.25 down to 0.85). The ball's colour is the board's.
  - **Par** is the steady player's game on the lane (`STEADY`: aim off 0.012, speed 6%, hook 20%; `pick`: the pocket with a gentle
    hook, less on a hookier lane, then for the pins left a line at each and at their middle, the most taken), worked out a ball at
    a time in the boards' share of time (`recOf`, `recWork`, `BOARD_KIT.budget(6, 40)`), its game what a board no one plays shows.
    Measured over 6 games a level: 203, 192, 190, 173 and 145 at levels 1–5; about 25 ms a game. Stars: par or better ★★★, within a
    fifth ★★, else ★; the best score kept a board (`bowling.best`); a tap on a finished lane goes on to the board beside.
  - Drawn: the lane a picture (`paint`: 39 boards, maple ends and pine between, the oil's sheen, the arrows and dots, the foul line,
    gutters, kickbacks, the pit); pins turned on a lathe with red stripes at the neck (`bwPin`, `bwPinDown` lying along its way),
    the ball, your aim, the dots, the score in dot digits at the foul line.
  - The smoke test (part 7) checks the levels by ring, the scoring (300, 190, 80, the tenth's bonus balls), a hook across the head
    pin's line, a gutter ball taking nothing, the steady player's perfect pocket balls striking and its games better at level 1
    than at 5, and real input (a click starting, a real click aiming, the real Enter bowling) and a board no one plays moving.
  - **Spares, trick shots' way** (Oct 28: "could the ideas of trick shot be applied to bowling?", then "1,2,5"): the row's last
    tile and the menu's Mode switch between Spares (the default; localStorage `bowling.settings` `mode`) and Ten frames.
    - **Every lane a leave to make** with one ball: missed, the pins go back up and it is another try (`G.spare`, `G.tries`;
      `afterBall`'s first branch). The corner is the famous leaves (`COURSE`, 15: the 10, 7 and 5 pins, a sleeper, two baby
      splits, the 2-4-7, the 3-6-10, the bucket, the 1-3-6-10, the 1-2-4-7, a washout, the 5-7, 5-10 and 4-9 splits; the 7-10,
      4-6 and big four are not makeable by any line the search tries and are left out). Every other board deals its own from its
      number at its level (`leaveGen`, `SP_LV`: two to five pins on the rack's spots, up to `SP_TRIES` 10 deals until the
      window falls in the level's band, the nearest kept).
    - **The search** (`shotSearch`, a generator worked a slice at a time, `leaveWork`, `leaveSoon`; the framed board
      `URGENT_MS` 30 a frame, a played one at once, `leaveNow`): lines at the leave's middle and at each pin, full and thin
      (`THIN`), slow and fast, straight and hooking, from either side, each aimed by `aimFor`; a line that clears is widened in
      aim at the arrows `W_STEP` (0.0005) at a time while it still clears; the widest window is the leave's (`w`), its middle
      the board's shot. 0.1–0.5 s a leave. A board still being worked out shows the leave under trial standing (`J.cur`).
    - **Par from the window** (`parOfWindow`): 0.02 (three lane boards, `BOARD_W` = LANE / 39) or more 1 try, 0.012 2, 0.007 3,
      0.004 4, less 5. Measured: windows about 0.03, 0.017, 0.01, 0.007 and 0.004 at levels 1–5; pars 1, 2.5 and 3.75 at levels
      1, 3 and 5. Stars by tries (`triesStars`: par or fewer 3, two more 2); the fewest kept a leave (`bowling.spares`, by its
      key: `g<idx>@<lv>` or `m<hash>`). The menu's Show me the shot puts the found shot on the ball (one star if made with it).
    - A board no one plays shows its leave made by the found shot (`spareRec`, the game's recording frames).
    - **Your own leave** (`ED`, `ed…`, EDIT_KIT with `gameRow`, as trick shots'): ✎ while a leave is shown, or the menu's Make a
      spare for this board…; tools Pin (a tap lays one where it falls on the deck, `DECK`), On a spot (lays or lifts the
      nearest of the ten spots), Erase, a drag moves a pin; acts Rack, Clear, Check (the search at once: its par, or no shot),
      Play. ✓ keeps it once a shot is found (`bowling.mine`, the latest 300, through `cleanLeave`: 1–10 pins on the deck, none
      overlapping) and plays it (`mineJob`); Share this board's leave and a shared link (`takeLeave`, searched again first).
    - The smoke test (part 7) checks all 15 corner leaves and generated ones at levels 1, 3 and 5 made by their own shot with par
      rising, a miss counting a try with the leave up again, `cleanLeave` refusing nonsense, and real input: a real click
      starting the lane's leave, the real Enter, the shown shot making it, the real ✎, real clicks laying pins, the real ✓
      keeping it in storage, a shared copy on another lane, and a board no one plays moving.
  - **Swiped** (Oct 28, "Games play with the row shut" above): a press on the ball dragged along the foul line moves where you stand
    (`BALL_GRAB`); dragged up the lane past `SWIPE_UP` and let go it bowls, as fast as the swipe's last tenth of a second
    (`SWIPE_V` 0.6–3.6 lane lengths a second to `V_MIN`–`V_MAX`), hooking as much as it bowed from the straight line between its
    ends (`BOW_K`). A tap on the lane still aims; the row and the keys still set it all.
  - **Oil you can read, and that wears; the ball chosen** (Oct 28: "whats next for bowling", then "1,2"):
    - **Patterns** (`PATTERNS`, a level's `pats` in `LV`): a lane is oiled to a named pattern, its length in feet from the foul line
      (`ft`, `ftY`; 60 to the head pin) and its crown: the house shots (levels 1–2, some at 3) lay more oil down the middle, so the
      outside boards' oil ends up to `CROWN_L` sooner and is `CROWN_S` dry, and a ball missed wide hooks back (a miss of 0.015 at the
      arrows lands 0.025 off on the house shot against 0.034 on a flat one); the sport patterns farther out (Bear, Chameleon,
      Scorpion, Shark, Viper, Cheetah, Wolf, Badger, 32 to 47 ft) are nearly flat. `laneOf` draws as before, the pattern last, so a
      board's hook and ball colour are the same. `dryAt(lane, x, y)` is what the hook reads (0 oil, 1 the back end).
    - **Wear** (`wearOn`, `freshLane`): a game of ten frames has its own lane with a grid of wear (`lane.wear`, `WX` × `WY`): each
      ball takes oil off where it runs (`WEAR`, more toward the pattern's end) and carries some past it (`CARRY`, over `CARRY_RUN`).
      Measured: a steady player's game moves its frame-1 strike line 0.032 left (about five boards) and wears the track to 0.16
      dry; that line still strikes at level 1 (the house shot) and leaves 3 or 4 pins at levels 3 and 5. A spare is bowled on the
      pattern as laid. The steady player re-aims each ball on the lane as it is (`aimFor` sees the wear), so par includes it.
    - **Drawn**: the oil a cool blue sheen a board at a time to where it ends there (the house shot's arch shows), fading over
      `RAMP`; a game's wear a duller track and its carry-down a faint sheen, the picture made again after every ball (`cellPhoto`'s
      key has the game's `wearV`; `PIC` keeps 160).
    - **The ball** (`BALLS`, `ballDef`, a shot's `b`; `B.def` in `roll`): `react` on the dry, `oilResp` of it on the oil, `shape` how
      late (dry to that power). Reactive solid (the ball as it was), reactive pearl (skids, turns hard late), urethane (an early
      gentle arc), plastic (`PLASTIC`, all but straight: the spare ball). Turn by mid-lane / at the pins for a hook of 0.6: solid
      0.007 / 0.027, pearl 0.0002 / 0.011, urethane 0.020 / 0.046, plastic 0.001 / 0.004. Chosen by the play pad's button, the row's
      Ball tile (index 10), the menu or B (`chooseBall`), kept in `bowling.settings` (`ball`). The steady player throws the solid at
      the pocket and the plastic at its spares (`pick`). Each ball has its own colour (`colOf`).
    - **No weights**: tried as the ball knocked aside less by the pins, and as the pins sent away faster, and left out: over 120
      pocket shots a little off line an 11 lb ball struck more than a 15 or 16 lb one in this deck's pin action, either way.
    - Measured over 4 games a level: the steady player 202, 197 and 133 at levels 1, 3 and 5.
    - The smoke test (part 7, "bowling oil and balls") checks house shots at level 1 and none at 5, the house shot's forgiveness,
      the four balls' turns, a game's wear moving the line and a spare's lane unworn, the picture's key changing after a ball, and
      the real pad button and the real B changing the ball.
- **Marble run** (Oct 28: "2,   3 curling, bowling, marble run", the third: "build a track in the bottom row, the steady player tests
  it"): `MARBLE_APP`, id `marblerun`, after bowling. A square board, an n × n grid of squares: a start chute at the far edge, high
  up (`startPiece`, blue), a cup lower down (red), rocks, some pieces laid for you (darker wood), and a stock in the bottom row.
  - **The pieces** (`EDGES`, `heightAt`; edges 0 N toward the far end, 1 E, 2 S, 3 W): a straight, a curve, a ramp (a straight that
    drops a level) and a spiral (a curve that drops a level, its high end either end: rot 0–7), each at a height `z` (its lower end)
    on a post. Drawn as troughs of wood along the middle line (`trackGeo`: a straight N to S, or a quarter circle from N round to E,
    a level `LH` (0.22 squares) high; each face twice with corners of its own, sharing them shaded the wood black), turned by yaw
    r·π/2 (the field turns an item by π − yaw, so local N to board N at yaw 0).
  - **Building** (`tapCell`): the piece in hand (the row, or 1–4), a tap on an empty square lays it turned and raised to join what
    lies beside it (`fitsAt`: every way it can lie, scored by the ends it meets at their heights, `endsInto`, the chute and the cup
    among them); a tap again on one of yours turns it to the next way, those that fit first; the row's Turn (R), Raise and Lower
    (↑ ↓) move the ringed one; Erase (X) takes back; Clear takes all yours back. The tap that picks a board out lays nothing.
  - **The run** (`runSim`, the row's Run or Enter; steps of 1/240 s): along each piece's middle line (`pointAt`), `G` × the slope
    down every drop, rolling (`MU`, `CURVE_MU` on a curve); into the next square's piece if it has an end there at the same height,
    else it falls (`why`: off the end of the track, into a rock, a piece that does not turn that way, dropped onto one lower, into
    the side of one higher); off a curve faster than the board's `vc`; back down a slope it cannot climb, stopped on the flat
    (`V0` 2 to start; a level dropped pays for about four squares). Into the cup at height 0, through.
  - **Every board its own puzzle** (`makePuzzle(idx, lv)`, `LV` by level, ring plus the Difficulty): a walk from the chute (each
    step the square with fewest ways out, so it does not shut itself in, a little toward the near end), its pieces found by the
    walk's turns, `H` drops spread along it, run in `runSim` until the marble reaches the cup (else other drops, else another walk);
    then rocks off it, some pieces laid for you (`given`), the rest in the stock with `spare`s. Levels 1–5: grids 5 to 8, 2 to 5
    levels down, rocks 0.12–0.28, laid for you a half to none, spares 2 to none, curves throwing at 3.6 down to 2.8. Par (the pieces
    beyond those laid for you): about 3, 8 and 15 at levels 1, 3 and 5; under 2 ms to make. Boards only looked at are made in the
    boards' share of time (`BOARD_KIT.budget(8, 30)`, `PUZ` keeps 1,500).
  - **Through**: in par ★★★, two more ★★, else ★; the fewest pieces kept a board (`marblerun.best`); a tap goes on to the board
    beside. The menu's Show the way lays the made way (no stars for it). A board no one plays shows the made way with the marble
    running down it on the board's own phase (`runOf`, `BOARD_KIT.loopT`).
  - The smoke test (part 7) checks the levels by ring, puzzles made at levels 1, 3 and 5 each running to the cup with par growing,
    a piece taken out and the marble falling, a piece beside the chute laid turned and raised to join it, and real input (a real
    click laying a straight under the chute, another turning it, the made way run to the cup) and a board no one plays running.
  - **Taps alone** (Oct 28, "Games play with the row shut" above): until a piece is picked in the row (`g.chosen`, by the row or
    1–4, X), a tap on an empty square lays the stock's piece that fits best (`bestFits`: every way of every piece left, scored as
    `fitsAt` scores them, more in stock first on a tie); a tap again on one of yours steps through the other ways and pieces that
    join, then takes it back (`tapAuto`); a tap on the chute or the cup runs the marble.
- **Bejeweled** (`GEMS_APP`, id `bejeweled`):
  - **Pearls and lit squares** (Oct 28: "in bejeweld application, the pieces should all be small raised circles like the white
    one, but with different colors. also, when sliding pieces, highlight the selected cells."): all seven kinds are the white one's
    flattened sphere (`PEARL`, `CUTS[6]`), told apart by `COLS`; the faceted cuts are kept, not drawn. The squares being swapped are
    lit pale blue (`litOf`, `gridOf`): the square a drag began on, the one it heads for once the finger has gone 0.08 of a square
    (`g.drag`, which also lets go a gem tapped before), then both while the gems slide and slide back (`g.lit`, `g.litUntil`).
  - **Special gems, a goal on every board, the feel, size and colours** (Oct 28: "whats next for bejeweld", then "1,2,5,6"):
    - A gem is `{ k, sp }`: k a colour 0–6, `HYPER_K` 7 or `STONE_K` 8. `groupsOf` finds the runs and joins them where they share a
      gem. A group of five or more makes a hypercube, a line across meeting a line down a star, four a flame (`clearGroups`), at the
      swapped gem of the group, else where the lines meet, else the longest run's middle. `spread` fires every special caught (a
      flame its 3 × 3, a star its row and column, a hypercube blasted the commonest colour); a hypercube swapped takes every gem of
      the other's colour, two of them the board (`hyperSwap`). A stone goes when a matched gem beside it does or a blast covers it.
    - **Goals** (`specOf(idx, lv)`, seeded; `LV` by level, the ring level plus the Difficulty): a score, so many of a colour (two
      colours farther out), all the ice (panes on squares, one or two thick: a gem cleared on a square breaks one; `ICE1`, `ICE2`, a
      frost pane `bjIce`), or all the stones; stones also stand in the way at levels 4–5; 5 colours at levels 1–2, 6 at 3–4, 7 at 5.
    - **Par** (`parGen`, `parFor`, `PARS`): the steady player (`plan`: every swap tried in a copy, `copyOf`/`simMove`, its cascades
      falling with gems of its own drawn, the one doing most for the goal taken, then specials and score) over `PAR_RUNS` (3) games,
      `PAR_CAP` 60. The moves allowed (`g.limit`) are par × the level's `slack` (2 at level 1 to 1.15 at 5), at least par + 2. Worked
      out for the framed board `URGENT_MS` a frame, at once for a board played (10–50 ms). Measured on 24 boards a level: median par
      8, 8, 13, 14 and 34 moves at levels 1–5; ice the slowest goal (25–50 from level 3).
    - Made: stars by moves against par (`starsOf`: par 3, 1.3 × par 2, else 1), the fewest kept (`bejeweled.best`, by board, level,
      size and colours); a tap after `GRACE` goes on to the board beside. Out of moves: a tap begins again. No swap left: the gems
      shuffle where they stand (`shuffle`), stones kept.
    - **Endless** (the Mode): the game as it was with the specials, no goal, no limit; taking a board carries on from what it showed.
    - **Boards no one plays** (`SHOWS`, `showAt`): each a game of its own on its own clock, played by `quickPick` (the swap clearing
      most, the goal's squares first), begun again `HOLD_T` after its goal is made or `SHOW_CAP` moves.
    - **The feel**: pops (`pops`, `POP_T`), the points floating up in the small dot font (`floats`), cascades called GOOD … INCREDIBLE
      in the big one (`words`, `text5`), a star's row and column flashing (`beams`), bursts (`BOOM`), a special made swelling once
      (`born`); sounds (`beep`, `bejeweled.sound`): a chime climbing a whole tone a cascade step, the specials, ice, stones, a fanfare.
    - **Settings** (`SET`, `bejeweled.settings`, the menu and the row: New/Restart, Mode, Board size 6–10, Colours 5/6/7 or by level,
      Sound): a change starts every board afresh. `g.n` and `g.K` are the game's own.
  - The smoke test (part 7) checks every kind the pearl, the levels, pars, each special made and a flame's 3 × 3, and real input: a
    drag lighting both squares and making a flame, clicks swapping a hypercube, a goal made with stars and a best, a click going on
    to the next board, a board out of moves, the real Size tile, and a board no one plays moving.
- **Simon** (Oct 15: "Are you familiar with the game called simon?", then "Yes"): `SIMON_APP`, id `simon`, after the tilt maze.
  Coloured pads round a hub, each with its tone (the toy's four, 415/310/252/209 Hz, then a pentatonic run): it plays a
  sequence, you play it back, a step longer each round; a wrong pad or too long a wait (`wait`) ends it, the score the
  longest sequence played back.
  - **Every board its own sequence** (`seqOf`: drawn as wanted from a generator seeded by `boardIdx` and the level, no pad
    three times running), at a level 1–5 by ring plus the Difficulty, as the tilt maze. `LV`: 4 pads (levels 1–2), 6 (3–4),
    8 (5); each step lit `on` s with `gap` between, both quickening 3.5% a step as the sequence grows (`stepOf`, at most to
    0.55 of themselves), and `wait` s to answer.
  - States `ready`, `show`, `input`, `pause`, `over` (`stepGame`, `press`, `over`). Tap a pad (`padAt` by angle round the
    middle), or press 1–8 (with four pads the arrows too); a tap on a board not begun or over starts it, a hold too. When it
    is over the pad wanted flashes. Best a board in localStorage `simon.best`.
  - **Every tap a press** (Oct 15: "the simon buttons are very hard to push"): a sequence often has one pad twice running,
    and the field read a quick second tap on the same spot as a double-tap (reframing, never reaching the game): of five
    quick real touches on one pad, two were lost. `noDoubleTap()` says yes while a game shows, waits or pauses. And `padAt`
    gives the whole board out: past a pad's rim, the gaps and the corners are the pad in that direction (the hub is the
    middle 0.8 of its radius). The smoke test taps one pad five times quickly with real touches.
  - A board no one plays lights its own sequence, rounds 1 to 8 and round again, each board at its own phase (`shownLit`).
  - Pads are wedges of their own kinds (`smPad<P>_<p>`, `padGeo`, faces wound to look out); lit, a pad is its full colour
    and raised a little, else 38% of it.
  - The kit's `difficulty(key, title, own)`: `own` for games with levels by ring of their own (Sokoban, the tilt maze,
    Simon) keeps the label plain and leaves out the steps at rings 7 and 31.
  - The smoke test checks the pads by ring, the same sequence on a board each time, three rounds played back and a wrong
    pad ending it, a real click starting a board and a real click on the right pad taken, and a board no one plays lighting.
- **Lights Out** (Oct 16: "what other simple games could we do", then "lights out, nonograms and whack a mole"): `LIGHTS_APP`,
  id `lightsout`, after Simon. A grid of lights; a press flips its square and the four beside it; put every light out in as
  few presses as you can.
  - **Every board its own pattern** (`dealOf`, `makeDeal`): from the board's number (`boardIdx`, golf's Szudzik pairing) at a
    level 1–5, the ring level plus the Difficulty (Easy 0, Normal 1, Hard 2), as Simon. `LV`: 4, 5, 5, 6 and 7 squares a side,
    and a band the fewest presses must fall in (3–5, 5–7, 8–10, 10–13, 14–18). A pattern is dealt by pressing k different
    seeded squares on a dark board, so it can always be put out; up to `TRIES` (24) are made until the par lands in the band,
    else the nearest is kept. `DEALS` keeps 1,500.
  - **Par exact** (`solveLO`, `reducedOf`): Gaussian elimination over GF(2) on the press matrix (done once a size, keeping what
    it does to the right-hand side), then every combination of the free columns tried for the lightest way out. The matrix is
    singular on 4×4 (four free) and 5×5 (two), so a pattern there has 16 or 4 ways out and the pressed set is often not the
    shortest; on 6×6 and 7×7 the way out is unique. The fewest presses is the board's par.
  - Measured on 100 boards a level: par 3.9, 6.1, 8.9, 11.7 and 15.8 presses (every one in its band), 1.2, 1.8, 1.5, 1 and 1
    tries, about 0.04 ms a deal.
  - Tap a square (`cellOf`). Through: presses against par as stars (`starsOf`, as Sokoban's: at par 3, within half again 2,
    else 1), the fewest on each board kept (localStorage `lightsout.best`, by board and level); a tap on a board put out goes on
    to the next (golf's `nextBoard`), a hold or Start this board again deals it afresh. The menu's Hint flashes one press of a
    shortest way out from the lights as they are (`hint`, a blue halo).
  - The squares are the board's colours (`cellGrid`: off a dark checker, lit a warm floor), and each lit square stands up as a
    glowing tile (`loOn`, unlit); the square just pressed has a pale halo for a moment (`loHalo`). A board no one plays
    presses its own way out a square at a time, holds dark, and lights again (`shownOf`, each board at its own phase); the
    board you are on shows its lights as dealt.
  - **Every tap a press**: `noDoubleTap()` says yes while the framed board is not out, so two quick presses on one square
    (Simon's lesson of Oct 15) both reach the game.
  - The smoke test checks the sizes by ring, the same deal on a board each time, par against the fewest presses found by light
    chasing (every top row, then each row pressed under the lights above: a different way) on 15 boards a level, each in its
    band and rising, the way out putting it out with three stars, a hint being one press of a shortest way, three real clicks
    (an inner square, a corner, an edge) flipping exactly their cross, five quick real touches on one square being five
    presses, and a board no one plays moving.
- **Whack-a-mole** (Oct 16: "what other simple games could we do", then "lights out, nonograms and whack a mole"): `MOLE_APP`,
  id `whackamole`, after Simon. A grid of holes; moles pop up for a moment and you bonk them before they duck back, for a round of
  `ROUND_T` (30 s) after a "3, 2, 1" (`COUNT`, 1.5 s).
  - **The rules**: a mole is a point, a golden one three, a bomb costs three and a tap on an empty hole one (`VALUE`, `MISS`); the
    score never goes under nothing. A second whack on a mole still squashed (`BONK`, 0.3 s) is free, unless another has come up in
    that hole. A tap anywhere in a hole's square is that hole (`holeAt`); with nine holes the number pad works too (7 top left).
    States `ready`, `count`, `play`, `over` (`begin`, `stepGame`, `tap`, `over`), on the page's own clock.
  - **Every board its own round** (`makeRound`, kept by `roundAt` in `ROUNDS`, 1,500): every pop (when, which hole, how long up,
    mole, gold or bomb) drawn from a generator seeded by `boardIdx` and the level, so a board's round is always the same. A pop
    takes a hole with nothing in it, not the last one if it can, and waits while `most` are out. The level is the ring level plus
    the Difficulty (Easy 0, Normal 1, Hard 2), as Simon. `LV`: holes 3×3 (levels 1–2), 4×4 (3–4), 5×5 (5); a mole up 1.3, 1.1,
    0.95, 0.88, 0.82 s; a pop every 0.95, 0.75, 0.6, 0.5, 0.42 s on average; at most 1, 2, 2, 3, 3 out at once; bombs 12–18% and
    golden moles 6–8% from level 3. Stays and waits shorten 30% over the round (`QUICKEN`).
  - **Par, from a steady player** (`steady`): one tap at a time, seeing a mole 0.35 s after it shows (`REACT`), moving the mallet in
    0.08 s + 0.3 s a board's width (`TRAVEL`), going for the mole it can reach first and never a bomb. Its score is the board's
    par; stars are yours against it (`starsOf`: par 3, 60% of it 2, else 1). Its taps (`hits`) are what a board no one plays shows
    bonked. Measured on 30 boards a level: par 25.4, 44.4, 48.1, 51.4 and 52.4 points; pops 25.5, 45.2, 55.5, 69.3 and 82.1 a
    round; it reaches 99%, 98%, 89%, 78% and 63% of the moles (with stays of 1.25 down to 0.68 s it reached 22% at level 5 and par
    fell as the levels rose); 0.1–0.8 ms to make a round with its par.
  - A board no one is playing plays its round on the page's clock with the steady player's bonks, each board at its own phase
    (`shownT`), a 2.5 s rest between rounds. Played, a bar along the bottom edge is the time left.
  - Looks: holes are dark discs in an earth rim (kit discs), a mole a body and dome with eyes, nose and belly in one vertex-coloured
    kind (`wmMole`; the item colour makes it brown, gold, or white for the bonk's flash), rising through the board's face (a
    negative `lift`, so the part still under it is hidden); a bonk squashes it (`sy` 0.45) with a ring of light; a bomb is black
    with a red fuse and a spark (`wmBomb`); a miss reddens the hole's rim.
  - `noDoubleTap()` is true while counting and in play (Simon's lesson). Finished, a tap goes on to the next board (golf's
    `nextBoard`), after a 0.8 s grace (`GRACE`) so the last whacks of a round don't fly you off; a hold starts it again. Best a
    board in localStorage `whackamole.best`.
  - The smoke test checks the holes by ring, a board's round the same each time and another's different, pops rising, stays
    shortening and bombs only from level 3, the scoring (mole, free second whack, gold, miss, bomb, the floor), the round ending
    at its time with the score kept as best, a real click starting a board's count and real clicks on two up moles scoring and on
    an empty hole costing, five quick real touches on one hole (moles there one after another) all taken, and a board no one plays
    popping.
- **Nonograms** (Oct 16: "what other simple games could we do", then "lights out, nonograms and whack a mole"): `NONOGRAM_APP`,
  id `nonograms`, after Simon. Picross: numbers along the top of each column and the left of each row give its runs of filled
  squares in order; fill the squares to match every line and the picture comes out in colour.
  - **Play**: a tap fills a square, a tap again clears it. Cross mode (the two marks in the board's top left corner, the menu's
    Taps, or X on the keys; localStorage `nonograms.mode`) makes a tap mark a square empty with an X; a hold or a right click
    always crosses. A drag (`claimsPan`/`onPan`, as Flow's) does what a tap would have done to the first square to every square
    it passes in that square's row or column (the first move decides which) that was as the first one was; the tap the field
    still calls after a short drag is eaten (`DRAG.moved`, golf's `ateTap`). Fills are free, as on paper: nothing says one is
    wrong, but a fill on a square the picture leaves empty is counted (`wrong`), and the stars are by those (`starsOf`: none
    ★★★, one or two ★★, more ★). Best a board (most stars, then quickest) in localStorage `nonograms.best`. Solved, a tap goes
    on to the next board (golf's `nextBoard`), a hold starts it again. A line whose filled squares read as its clue has its
    numbers greyed (`lineDone`).
  - **Every board its own picture** (`makePuzzle(idx, lv)`, `puzzleFor`): from `boardIdx` and a level 1–5, ring plus the
    Difficulty (Easy 0, Normal 1, Hard 2), as Simon. `LV`: 5, 6, 8, 10 and 12 squares a side; the share filled 0.62, 0.58,
    0.54, 0.52, 0.5 (fewer filled, more short runs); at least 0, 0, 3, 4, 5 sweeps of the line solver (`minPasses`).
  - **The generator** (`pictureOf`): noise blurred once (a 3×3 blur) and cut at the quantile for the level's share, so the
    pictures are blobs, not static; three boards in ten mirror it left to right, one in eight top to bottom.
  - **One answer, no guessing**: `lineSolve` lays a clue's runs every way that agrees with what a line knows (bit masks, a line
    at most 12) and keeps what every way agrees on; `solveLines` sweeps rows and columns to a fixed point. A picture is kept
    only if the lines alone finish it (`fair`: so it is unique and needs no guess) in `minPasses` sweeps or more; a stalled one
    is counted to two (`countSolutions`, the lines after every guess) and kept only as a fallback if unique; denser pictures if
    nothing comes in 40 tries.
  - **Measured** (200 boards a level, in Node): every one fair and unique, none from a fallback; 1.0, 1.1, 1.2, 2.0, 2.7
    pictures tried; 2.4, 2.9, 3.4, 4.3, 5.6 sweeps; 0.1–0.5 ms to make (2.6 at most). The clue bands come out 2–5 numbers deep.
  - **Drawn**: the board is M × M squares of the field's tiles (`cellGrid`, M = n + K, K the most numbers any line has, at
    least 2): the bands slate, a stripe a line; the grid paper in a faint checker, blocks of five a shade apart from 8×8 up;
    filled squares ink blue; solved, each patch of the picture a colour near the board's own hue on a pale wash (`paletteOf`).
    Only the numbers (seven-segment digits, one flat unlit piece a digit, `ngD0`…`ngD9`, from 120 px boards up, `DIGIT_PX`),
    the crosses (`ngX`) and the corner's marks (`ngQuad`) are pieces.
  - A board no one plays (`shownView`) fills its picture in, a square at a time row by row (0.42 s a row), shows it in colour
    for 3.2 s, then blank, round again, each board at its own phase. The framed board shows its puzzle blank, to be played.
  - `noDoubleTap()` says yes while the framed board's puzzle is not solved, so two quick taps on a square fill and clear it.
  - The smoke test checks the sizes and levels by ring, 60 sampled puzzles (clues are their pictures', one answer, the lines
    alone reach it, the level's sweeps), a 2×2 with two answers, the rules (a wrong fill counted, a cross not, the picture
    filled reads as solved); real clicks filling exactly the squares clicked and clearing one, the corner's marks switching to
    crosses, a real drag filling a row, the whole picture by real clicks solved and a click then going on; four quick real
    touches on one square read as four taps; and a board no one plays going through every stage of its cycle (`shownView(P,
    at)`, `cycleOf`: a few seconds sampled on the page's clock can fall wholly in the picture's rest, which failed once) and
    moving on the page's clock over a whole cycle.
- **Flash cards** (Oct 25: "how about flash card application?", then "Built-in decks" and "Spaced repetition"): `FLASH_APP`, id
  `flashcards`, after Nonograms. A deck laid over the field, a card a board, studied on a spaced-repetition schedule.
  - **Decks are loaded, not written in the page** (Oct 25, later: "dont type out the cards by hand. it must be loaded like json or
    epub."): a deck comes from a file opened or dropped (the field's Open; the menu's Open a deck…; `importDeckFiles`, from
    `_loadFiles`) or a flare bucket (`_bucketIngest`: every `.csv`, `.tsv` and `.txt`, and any `.json` that is a deck, opened
    when the bucket has no pictures, archive, PDF or book). Read by `readDeckText`: a card a line, front, back and a note, split
    by tabs, else commas, semicolons or pipes (the most common in the first lines; CSV quotes honoured, `splitLine`); a header
    naming its columns (front/question/term, back/answer/definition, note) says which is which; Anki's text export as it is
    (`#separator`, `#columns`, `#deck`, HTML taken down to words, `plain`); `#deck:` and `#ask:` lines of our own. A `.json` is a
    deck (`deckOfJson`) when it is `{format: "flashcards", name, ask, cards: [[front, back, note?] or {front, back, note}]}` (or
    names itself and has `cards`), or a bare list of {front, back} (question/answer, term/definition); `_loadFiles` reads each
    `.json` first and gives a deck to the flash cards, any other to the JSON viewer. A deck is kept in localStorage
    `flashcards.decks` (its key its name and a hash of its cards, `makeDeck`; at most `MAX_CARDS` 5,000 a deck) and comes back
    next time; the menu's Deck steps through them (`flashcards.deck`), Remove this deck takes one off with its progress. A
    card's progress is kept by its own id (`cid`, a hash of its front and back), so it follows the card when a file is edited.
    With no deck every board is a card saying how to bring one (`fc:empty`), and the row's one tile opens the picker.
    **The deck's own picker takes any file** (Oct 25: "json is disabled in flashcard application"): a phone greys out every file
    the field's Open (`#importImageFile`, its `accept` list) cannot match by type, and a .json saved on a phone is often typed as
    text or nothing. Open a deck… and the row's tile open a picker of their own with no `accept` (`pickDecks`), and a file from
    it is read by what it holds (`deckOfAny`: text starting `{` or `[` tried as a JSON deck, else lines of cards). `decks/` in
    the repo holds five deck files to start from (world and US state capitals, the elements, the times tables, Spanish words):
    open them, drop them or put them in a bucket; the page does not load them by itself.
  - **A card a board**: a board's card is `boardIdx` round the deck (`cardOf`), so the corner is card 1 and every card hangs on many
    boards. Each is a picture (the photo tier: `paint`, 640 or 320 px tall from `HI_PX` 260 px boards; the board `ASP` 1.6 wide,
    the app's `boardShape`; drawn turned a half turn, as tanks'), its far edge in its state's colour (`stateOf`: blue new,
    orange learning, red due, green known; `cellGrid` that colour alone for a tiny board). `SPECS` keeps what to paint by key.
  - **Studying**: a tap on the framed card turns it over (Space or Enter; `TURNED` by board); the back has the answer, a note, and
    four buttons along the near edge (v ≥ `BTN_V` 0.78) with when the card would come back: Again, Hard, Good, Easy (a tap, the
    row's tiles or 1–4; `gradeHere`). Graded, the view flies to the nearest board holding the next card (`nextDue`: learning
    cards due, then known cards due, by when; then new ones while the day's `NEW_PER_DAY` 20 last; then a learning card within
    `LEARN_AHEAD` 20 min), found by a spiral out from where you are (`boardFor`). Nothing due: the board says when the next is.
    N or the menu's Next card due flies there. The row: Show answer / Front, the four grades with their intervals, and the
    New, Learning and Due counts. `noDoubleTap` while a board is framed.
  - **The schedule** (`after`, `grade`; SM-2 as Anki plays it): learning steps 1 and 10 min (Hard 6 min, or 1.5 × the step), a
    day on graduating, Easy four days; a known card Good × ease, Hard × 1.2 (ease − 0.15), Easy × ease × 1.3 (ease + 0.15),
    Again back to learning with half the interval (ease − 0.2, never under 1.3, a lapse counted). Kept on the real clock in
    localStorage `flashcards.srs` (by deck: card → [state, step, days, ease, due, reps, lapses], and the day's new count). The
    menu's Forget this deck's progress clears a deck.
  - A board no one studies turns its card over now and then (`FLIP_T` 9 s, `BACK_T` 3.2 s of it on its back), each board at its
    own phase; the framed board holds still.
  - The smoke test checks no deck till one is loaded, four decks opened through the real picker (decks/capitals.tsv, a CSV
    with quotes, an Anki export with HTML, a JSON deck) and kept, a plain JSON still going to the JSON viewer, the deck picker taking any file (a JSON deck with no extension), the cards by board, the steps (1m, 6m, 10m, 4d; then 1m, 15m, 1d, 4d), graduating, a known
    card coming due first, its interval growing and Again putting it back with less ease, the nearest board holding a card, and
    real input: a real click turning the framed card, a real click on Good grading it and flying to the next card's board, the
    real Space and 3, the row's tiles, and a board no one studies turning over.
- **Game lab: games changed by asking Claude** (Oct 25: "seems to me these simpler games are good foundation to let the user add
  features, through a prompt. so the player could develop there own game with AI interaction.", then "2" of the three ways offered:
  the rules rewritten, not only the dials turned): `GAMELAB_APP`, id `gamelab`, after the flash cards. A board's game is a small
  RULES MODULE of plain JavaScript; the player says what to change, Claude writes the whole module again, and the board plays the
  new version at once, every version kept.
  - **The interface** (`LAB_SYS`, what Claude is told; the starters are written against it, so they are its examples):
    `const game = { title, size (2–24 squares a side, or level => size), realtime, setup(level, rand) -> state, tap(state, x, y,
    rand), key(state, k, rand), step(state, dt, rand), view(state) -> { squares, pieces, status, message, score, over, won, size } }`.
    Row 0 is the far row; keys are 'up', 'down', 'left', 'right' (the arrows and WASD, as the board lies: `screenToBoardDirs`),
    'enter', 'space', letters. Pieces are `{ shape: tile | block | ball | disc | ring | peg | cone | gem, x, y, size, height, z, color,
    glow }` in squares; a glowing one is its kind's unlit twin (`gl_<shape>`, `gl_<shape>_L`). `rand` is seeded by the board (its
    number and how many times it was started again), so a board deals the same game; the level is the ring level, 1–5.
  - **Starters** (`STARTERS`): Lights Out, Whack-a-mole and Snake, round the boards by `boardIdx` (the corner Lights Out), and a
    blank board; the menu's Start from … puts any of them on the framed board as a version. Since Oct 26 ("Add more starter
    games") also 2048 (a swipe or arrow slides the tiles, which glide, numbers on them; the goal tile 128 to 2048 by level), Gems
    (a match-three: swap by a swipe or two taps, cascades, a target score within the moves; 4 to 6 colours, fewer moves farther
    out), Pong (first to 5 against a computer quicker by level; drag, tap or the arrows), Maze (a backtracking maze 9 to 17 squares
    a side, keys, a tap or a swipe that runs to a turning; from level 3 only the way near you is seen) and Connect Four (against a
    computer that looks 0 to 3 moves ahead with alpha-beta, slipping less farther out; 2 before the first move for two players):
    `starterOf` goes round every starter but the blank. Each has its own player and passes the check; out of 20 games their players
    win level 1 / 3 / 5: Gems 20 / 13 / 10, 2048 19 / 3 / 0, Connect Four 20 / 19 / 0, Pong 20 / 20 / 0, the maze always (bigger
    farther out). The smoke test checks every starter passing the check.
  - **The sandbox** (`BOX`): a module never runs in the page. It runs in a Worker made inside a hidden iframe with `sandbox=
    "allow-scripts"` (an origin of its own: no storage, no cookies, no page) whose policy is `default-src 'none'` (a blob Worker
    inherits it: fetch, XMLHttpRequest and importScripts refused, measured), and the Worker's ways out are deleted too. The frame
    stops a Worker that has not answered in `LAB_TIMEOUT` (1.5 s a call, 5 s a trial) and starts another; the game whose call hung
    is marked broken, the others start again. What comes back is checked before it is drawn (`cleanView`: colours, sizes, at most
    600 pieces, words cut short). `trial` runs a module at levels 1, 3 and 5 with taps, keys and two seconds of its clock; an
    error names its line in the module.
  - **Playing** (`RUN` by board, `RUN_CAP` 300): every board shows its game's opening; the framed board plays: a tap is its square,
    keys go to a game with `key`, and a realtime game steps once a frame (a step out at a time, `tick`), only after the player's
    first tap or key on it (`rec.go`: a snake framed by a flight hit the wall before it was seen). A game over: a tap, Enter or
    Space starts it again. The board's title has the game's status.
  - **Asking** (`change`, the bottom row's Change it… or the menu's Change this board's game…, `ASK`, `#labAskBox`): through the
    coach's gateway (`coachEndpoint`, `coachHeaders`: the sign-in's session, a daily allowance each; signed out, the box offers Sign
    in), streamed as the 3d studio's requests are (`streamCall`, no answer for 60 s drops it). Claude gets the module and the words,
    and answers with one sentence and the whole module in one ```js block (`parseReply`); the module is tried (`trial`) before it is
    kept, and a broken one goes back with its error and line, up to `FIX_TRIES` (2) times, after which the board keeps the game it
    had. Models (the menu's Claude: …, localStorage `gamelab.model`): Sonnet 5.5 by default, Opus, Haiku; a gateway that does not
    know one falls back to `claude-sonnet-5`. The box lists the versions, what each asked and what Claude said it did.
  - **Versions** (`MINE`, localStorage `gamelab.mine` by board: `{ v: [{ src, note, ask, at }], cur }`, at most 16 a board and 1.5 MB
    in all, the boards changed least lately going first): Undo and Redo (the row and the menu), Restart, Rules (`#labRulesBox`: the
    module to read or change by hand, Apply trying it first), Share (a link `?app=gamelab&setup=` carrying the module, `SHARE`; opened,
    it is tried and put on the framed board as a version, said to run in the sandbox), Forget this board's versions.
  - The smoke test checks the starters in the sandbox, the corner board playing Lights Out, an endless loop stopped and an error's
    line, a real click flipping exactly a cross, a shared game finding no fetch, XMLHttpRequest, localStorage or document, Change
    it… through the real box (the gateway mocked: a broken reply sent back with its error, the fixed one kept as version 2 and in
    storage), Undo, and Snake waiting until the real ArrowUp turns it.
  - **The editing loop and more to build with** (Oct 26: "it works. i asked it to change to 7x7 in whack mole. whats next.", then
    "1,2"):
    - **History**: each request carries the board's last `HISTORY` (4) asks before the current version and what Claude said it did
      (`historyOf`), so "faster again" means something.
    - **Fix it**: a version that breaks while played (`rec.err`, a square the trial never reached) turns the row's first tile into
      🔧 Fix it, and the box and the menu have it too (`fixIt`): `change(c, r, words, { fix, line })` sends "This version breaks while
      it is played: …" with the line, no words needed; kept with the ask "Fix it: …".
    - **Chips** under the box's words (`CHIPS`: Make it faster, Add sounds, Swipe to move, …): a tap adds one to what is written.
    - **Sounds**: the Worker has `sound(kind, pitch, seconds)` (beep, click, chime, buzz, boom, up, down, win, lose, tone; at most 8
      a call, `OUT`), sent back with the view and played for the framed board (`playSounds`, on `ARCADE.tone`; the menu's Sound,
      localStorage `gamelab.sound`).
    - **Words**: a piece `{ shape: 'text', text, x, y, size, color }` is drawn a letter at a time, each letter its own kind (`gch_`
      + its code point, made when first asked for through the `itemGeometries` Proxy, `glyphGeo`) from a 5 × 7 dot font of its own
      (`FONT`: capitals, digits, a few signs and ♥ ★), flat and unlit, turned with `yaw` 1e-6 so it reads as the board is framed.
    - **Drags and swipes**: a game with `drag(state, x0, y0, x1, y1, done, rand)` (squares, fractional) keeps every press on its board
      (`keepsPress`, `claimsPan`): moves are sent as they come (one call out at a time), and the lift once more with done true, where a
      swipe is read; the tap after a drag is eaten (`dragAte`). The trial drags too.
    - **Gliding**: a piece with an `id` slides from where it was drawn to where it is over its `glide` seconds (0.12 by default,
      eased; `glideFrom`, `glideAt`, `rec.anim`); more than `GLIDE_FAR` (3) squares jumps. The starters use them: Snake's segments
      glide a step at a time with a chime for an apple and a sound to lose, Whack-a-mole clicks and buzzes, Lights Out clicks.
    - `LAB_SYS` tells Claude all of it. The smoke test puts a game with all four on a board: its words drawn letter by letter, a real
      click gliding a piece with a click asked for, a real drag read as a swipe left (and not as a tap), the game broken in play by
      the real Z and a click, Fix it sending its error and line (the gateway mocked) and keeping the fix, and the history naming it.
  - **Its own player, the boards no one plays, and the check** (Oct 26: "what next for game lab", then "1,2"):
    - Every module Claude writes has `game.bot(state, rand)`: a move (`{ tap }`, `{ key }`, `{ drag }`, `[x, y]` or `'up'`) or
      nothing; asked every step of a realtime game, once a move of a turn by turn one (`act`, `playOne` in the Worker). It may read
      the whole state and must not change it; at a person's pace. `game.wins` marks a game won or lost rather than scored.
    - **Boards no one plays** show a recording of it playing the board's own deal (`rec`, `recSlice`: the Worker plays 25 ms of its
      time a call, `PLAY_MS`, one call out at a time; `PLAYS` by board, `PLAYS_CAP` 80; frames every 0.1 s of a realtime game or
      every move, up to `REC_T` 40 s or `REC_MOVES` 120), held `HOLD` s at the end and played again, each board at its own phase
      (`shownAt`); pieces with ids slide between frames (`shownView`). The squares follow it too (`cellGrid`).
    - **Par and stars**: the recording's end is the board's par (`parOf`: moves or seconds to a win, or the score); a game played
      to its end on the framed board gets stars against it (`starsAt`: a win at par or under ★★★, within half again ★★, else ★; a
      score at par ★★★, 60% ★★), the most kept by board and version (localStorage `gamelab.best`), par and best in the title.
    - **The check** (`check` in the Worker, `checkOf`): after the trial, its player plays it three times at level 1 and once at 3
      (two minutes or 400 moves each, 450 ms of the Worker a run). It goes back to Claude, as a broken version does, with no player,
      over at once every time, nothing on the board ever changing, or a game to win never won at level 1; the box says what its
      player did. The Rules box and links are tried only.
    - The starters have players: Lights Out keeps the squares it still needs (`need`) and is a game to win, Whack-a-mole taps a mole
      up 0.35 s, a tap every 0.25 s at most, Snake heads for the apple by the safe square with the most room (`roomAt`).
    - **The sandbox times the call it is on**: the host frame now times only the call the Worker is working on, from when it
      reaches it (`arm`, `head`), so a recording slice queued behind a two-second check is not stopped, and the call blamed for a
      hang is the one the Worker was stuck on.
    - The smoke test checks the starters passing, the four refusals, Change it… sending a version with no player back and keeping
      the next, a board no one plays moving through its recording, and a one-tap game's par of 1 move with a real click's win
      kept as three stars.
  - **Harder farther out, measured, and My games** (Oct 26: "whats next", then "4,6"):
    - The check plays level 5 too (three runs at level 1, one at 3, two at 5, 380 ms of the Worker each; a run keeps its board's
      size `n`). `hardness` sets level 1 beside level 5 (`statsAt`): level 5 is harder if the board is bigger, or, for a game to win,
      fewer are won or the wins take a fifth more moves (seconds, realtime), or, for a game of points, more are over, sooner by a
      fifth, or a fifth fewer points. None so, the version goes back to Claude with the numbers ("level 5 is no harder than level
      1 …"); after `FIX_TRIES` it is kept anyway, its note saying it plays the same farther out. `LAB_SYS` asks for it (HARDER
      FARTHER OUT). The box's note gives both levels (Lights Out: 4×4 won in 2.7 moves, 7×7 in 8; Snake over after 19 s and 5.6 s).
    - **My games** (`openMineList`, `#labMineBox`, `mineList`): every board changed, newest first: its game's name (`titleOf`: the
      running meta, else the module's `title:`), the board, which version of how many, when, the last ask, the best stars; Play
      (closes, makes it the live board and flies there), Share, Forget. From the row's 📋 My games tile or the menu's My games (N)….
    - The smoke test checks the starters climbing, a flat game refused and then kept with the note after three requests (the
      gateway mocked), and My games listing the two newest boards first, a real click on Play making the board the live one.
- **Tanks** (Oct 20: "what tank games could we build", then "1" of five: the artillery duel, as Scorched Earth plays it):
  `TANKS_APP`, id `tanks`, after Nonograms. Two tanks on rolling ground, yours on the left, the computer's on the right,
  firing in turns.
  - **The board lies as Missile Command's does**: y down the board is down, the ground filling it from `H[i]` (a height a
    column, `W` = 384) to the near edge. Since Oct 21 the board is half again as wide as it is tall (`ASP` 1.5, the app's
    `boardShape`), and the game runs in its own x (0 to `ASP`) and y, as mini golf's does; `itemsOf` divides u, scale and lift
    by `ASP` at the end, and the picture is `ASP` times as wide as it is tall. A shot is an angle and a power (`launch`, at most
    `VMAX` 1.45 heights a second), pulled down by `G` and pushed along by the wind, in 1/120 s steps (`flyStep`); it ends on a
    tank still in it, the ground, or off the sides.
  - **A burst** (`blastAt`, `BR` 0.06): the ground in its circle is dug out and the earth above falls in (a column stays one
    height); a tank inside is hurt up to `DMG` (55) at its middle, and by `FALL` × how far it drops as the ground goes. 100
    health each.
  - **Every board its own ground** (`terrainOf`, by `boardIdx` and a level 1–5, the ring level plus the Difficulty, Easy 0,
    Normal 1, Hard 2, as Lights Out): `LV` sets how rough (`amp`), how often a hill stands between the tanks and how high
    (`hillP`, `hill`; none at level 1), the wind (drawn again every turn, none at level 1, up to 0.25), how far apart the
    tanks stand (`EDGE`), and the computer's hands: the spread of its angle (`ea`, 9° down to 2.5°) and power (`ep`), tighter
    by `learn` a shot as a player zeroing in, to `FLOOR` (0.3) of where it began.
  - **The computer** (`aimFor`, `foeShot`): 14 angles × 14 powers flown in the game's own physics (at 1/60 s), then the 7 × 7
    about the best, the one landing nearest your tank and not on itself; then its hands' spread. With no spread its first
    shot hit on 20 of 20 boards. About 1 ms a shot.
  - **Controls** (Oct 21: "the aiming mechanism is hard, can it be improved?"): a tap on the board aims toward it (power by the
    distance, full at `AIM_FULL` 0.42) and fires nothing; a press anywhere and a drag aims as the finger goes, and letting go
    leaves it there (`claimsPan` on your turn, `keepsPress`, since on a slow frame the field's hold timer took the press back
    before the finger's moves were read; the tap after a drag eaten). A tap on your own tank (`onTank`), the row's Fire or Enter
    or Space fires. Until then a tap aimed and fired at once, and a drag had to start on the tank and fired as it let go.
    Arrows turn and push (W and S push too), A and D drive, 1–6 choose a shell.
  - **The shot shown before it is fired** (`previewOf`, `PREVIEW`): the shell's own path flown ahead in the game's physics, wind
    and all, and dotted from the muzzle: the whole flight to where it lands at level 1, 60%, 45%, 35% and 25% of it at levels
    2–5. Kept on the game (`g._pv`) until the aim, the tank, the wind or the ground changes. Your last shot's path stays faint.
  - **The row** (`tilesOf`): Fire (the shell in hand under it), Aim ◀ ▶ (a degree, `nudge`), Power − + (two in a hundred,
    snapped to them), the weapons, then Drive ◀ ▶; `AIM_TILES` (5) come before the weapons.
  - **Through**: stars by the health left on a win (`starsOf`: 70 three, 35 two), the most left kept a board (localStorage
    `tanks.best`); a tap on a finished board goes on to the next (golf's `nextBoard`), a hold or Start this board again
    deals it afresh.
  - **A board no one plays** shows its own duel (`duelOf`: two computer players at its level from the left until one is out,
    30 shots at most, each flight sampled `REC_HZ` 30 a second; `shownOf(Dl, at)` on the page's clock, each board at its own
    phase), made a few at a time (`duelSoon`, 8 ms in 30); 3–21 shots, 3–22 ms a duel. A duel keeps what each shot set off
    (`fx`: muzzle, trail, burst, with their times and seeds) and when each tank was hit (`hitT`).
  - **The look** (Oct 20: "how can we make this with perfect graphics", then "yes" to painting the scene, real tank models
    and effects; until then the ground was 64 boxes, a staircase on every hillside, and a tank three boxes):
    - **A picture a board** (the photo tier: `cellPhoto` → a key, `photoCanvas(key)` → `paint`): the board's own sky
      (`PALETTES` by its seed: day, dusk, night with stars and a full moon, desert), sun and glow, two ranges of far hills
      in haze, the ground's line through all 256 columns, the earth deepening, strata where the ground was laid (`H0`, so a
      burst digs through them), stones, grass along the top, bare scorched earth where a burst dug, a scorch round each
      crater. The photo tier lays a canvas's top left at the board's far right (u = 1, v = 1), so `paint` draws it turned a
      half turn. 1 ms a picture.
    - A key is one state of one board's ground (`photoState`: the live game's `ver`, or a duel's shots so far), painted
      again only when that changes; `SPECS` keeps what to paint for a key, since the field asks by key alone. 512 px a side
      for a board large on the screen, 256 under (`photoKey`: from `HI_PX` 320 for the board being played, `HI_DUEL` 480 for
      a duel's, a tenth either way so a board on the line does not flip; each new picture is a texture sent to the graphics
      card). A board under `PHOTO_PX` (20) is its tiles (`gridOf`, the palette's colours), as is any frame whose picture is
      not built yet, so a board is never a hole.
    - **The tanks in relief** (`tankGeos`): the tank's side lies on the board, as the game does, standing up off it by its
      thickness. `tkTracks` (track, road wheels, hubs), `tkHull` (hull with a sloped front, domed turret, cupola, aerial,
      skirt; the side's colour on lighter and darker parts) and `tkGun` (barrel, muzzle brake, a boss over the pivot, lying
      on the turret's face), all vertex-coloured, the turret's middle where the game aims from. A tank sits along the slope
      under it (`slopeAt`, at most `TILT_MAX` 0.5 rad), flashes white when hit, and once out is charred, burning and smoking
      (`wreckFx`). The computer's tank is the same one mirrored along its length (`tkTracksL`, `tkHullL`, each triangle wound
      back), so it faces you.
    - **Never a yaw of exactly 0** (Oct 20: "sometimes the tanks are up side down."): the field turns an item by π − yaw
      only `if (it.yaw)`, so a yaw of 0 left it unturned, half a turn from every turned item. The ground under each tank is
      flattened at the start, so a tank there stood on its turret, tracks up, until a burst tilted the ground. `yawOf` gives
      1e-6 for 0, for the hull, the tracks and the gun.
    - **Effects** (`fxItems`), worked out from how long ago each happened and its seed, so a duel shows them with nothing
      kept: the muzzle's flash and smoke along the gun; the shell glowing, a smoke trail behind it, each puff growing and
      thinning; the burst's fireball in six lobes going white, yellow, orange, red and dark, a ring of shock, sixteen clods
      and ten sparks falling under the shell's gravity (a clod that reaches the ground is gone), and smoke rising and
      drifting on the wind. Clouds cross the top of the sky with the wind (`cloudsOf`, `cloud`: how far it has carried them).
    - Measured in the sandbox's software renderer at 1280×800: zoomed out 11 frames a second against 6.5 for the boxes;
      framed, the first loop of the boards' duels is slower while their pictures are made, then 11.
  - **More to it** (Oct 21: "Growing the artillery duel", the four ideas offered: weapons, more tanks, two players on one
    device, driving):
    - **Weapons** (`WEAPONS`, `simShot`): a shell (always), a big shell (a burst 1.8 times as wide, 80), a cluster (opens at the
      top of its arc into five bomblets spread across its way, each a small burst; one landing before its top bursts as a
      bigger bomblet), a dirt bomb (lays a mound of earth the shape of its upper half, `dirtAt`), a roller (lands, rolls down
      the slope at `ROLL_V` until the ground ahead rises, it meets a tank, or 3.5 s, then bursts) and a digger (goes on into the
      ground the way it was going at `DIG_V` for 0.55 s, the earth falling in behind it, `cut`, a trench since a heightfield
      holds no caves, then a small burst; a tank it went under is hurt by the fall). Two of each a tank (`S.ammo`), chosen with
      1–6 or in the bottom row (`tilesOf`: a tile a weapon with what is left on its top line, the one in hand lit, then Drive ◀
      and Drive ▶ with the fuel; `statsStay` keeps the row up, since a tap on the field shuts a row of numbers).
    - **Two to four tanks** (the menu's Tanks, `SET.n`, localStorage `tanks.count`), every one for itself, spread across the
      board with a hill in a gap now and then; each computer goes for the nearest tank or the weakest, as its board drew its
      mind (`T.minds`, `targetOf`). The tanks on the right half are the mirrored kinds, facing left.
    - **Two players on one device** (the menu's Players, `tanks.players`; `seatsOf`): Player 1 the leftmost tank, Player 2 the
      rightmost, the computer's between, in seat colours (`ME`, `P2C`, `CPU_COL`); on a person's turn (`myTurn`) the controls
      are theirs and the board says whose turn it is; a marker bobs over the tank whose turn it is. Stars and a best only with
      one player.
    - **Driving** (`driveBy`, `drive`): A and D held, or a tap on a Drive tile (`DRIVE_STEP`), at `DRIVE_V`, `FUEL` (100)
      carrying a tank `FUEL_RANGE` (0.2) of the board, no steeper than `CLIMB` up, never off the board or into another tank (a
      wreck too). A computer whose best shot is blocked (a miss over 0.1) tries 0.1 either way and drives if it does better.
    - **One way of playing turns** (TURNS): a game (`gameNew`) is the state S, the seats, the turns so far and the effects they
      set off on its own clock (`G.fx`). A turn (`makeTurn`) is a drive, the gun turning (a computer's; yours is where you put
      it) and the shot, worked out whole when it starts; `viewAt(G, t)` reads any moment of it (the tank driving, the gun
      turning, the shells along their tracks, the ground as it was until the first burst, the health falling as each comes).
      A board no one plays is a game of the computer's tanks made a turn at a time as it is wanted (`duelNew`, `duelStep`,
      `duelSoon`: within 8 s of its clock, 8 ms in 30), its clock waiting at the last turn made, then round and round; the game
      you play (`fresh`) is the same with your seats in it, on `g.t`.
    - The computer's choice of weapon: a big shell once it has the range on a tank still strong, a cluster to open, a roller
      onto a tank below it, else the shell.
  - **Sounds** (Oct 20: "add sound effects to tanks."; `SFX`, made from noise and tones with the browser's audio, each set
    left or right by where it happens, `pan`): the gun's crack, thump and click (`cannon`); the shell's whistle, quiet as it
    climbs and falling louder as it comes down, panned from the gun to where it will land for as long as the flight (the game
    flies the shot ahead to know, in `fire`; stopped when it lands); the burst's roar and drop, crackle and earth falling back
    (`blast`); a hit's ring of struck metal (`clang`); a tank put out cooking off (`cookoff`); the computer's turret turning
    (`whirr`); a tick every 3° or 4% as you aim (`aimTick`); and since Oct 21 a dirt bomb's thump (`thud`), a cluster opening
    (`pop`), a digger grinding (`scrape`), a tank's tracks (`rumble`), and a burst as big as its weapon's. Each plays as its
    moment on the game's clock comes (`stepGame` reads `g.fx`). Only the board being played sounds; the menu's Sound turns it off.
  - The smoke test checks the levels by ring, the same ground on a board each time, hills only past level 1, the steady
    computer's hits, a burst's dig and harm, ten duels ending, a real tap aiming toward it (since Oct 21 with the shot's way
    dotted, the whole flight at level 1 landing where the shot does and a quarter of it at level 5) and a tap on the tank
    firing, the computer answering, a real drag anywhere aiming and the real Enter firing, the row's aim and power nudged, a steady shot winning with stars and a best, a board no one plays moving, the picture the
    right way round (earth at the near edge, sky at the far), a new picture after a burst, 512 and 256 px by size, a burst's
    fireball, ring, clods and smoke, the clouds going with the wind, each tank turned to the slope under it, no part of a tank
    asking for a yaw of 0, the computer's tank its mirrored kinds, and the gun, the whistle, the burst and the whirr asked for
    in a live exchange; since Oct 21 also what each weapon does, duels of two, three and four tanks ending, a real key (D)
    driving on fuel, the row's big shell chosen and spent, and three tanks with two players: after Player 1 and the computer,
    Player 2's turn with the controls theirs.
- **Tank maze, taken out** (Nov 1: "remove tank maze."): `TANKMAZE_APP` (Oct 21 to Nov 1, id `tankmaze`: tanks in a maze, one chased by the
  computer's hunters, first a battle with shells, from Oct 29 a chase with no guns, then you could shoot them) is gone, with its smoke
  checks and its `tankmaze.*` localStorage keys left behind unread. Its last form: you ran from hunters (2, 2, 3, 3, 4 tanks by level), a
  shell of yours sent a hit hunter back to its start, they never fired, touching you ended it and the best was the longest you lasted.
- **Platformer, taken out** (Oct 30–31: "remove platformer application."): `PLATFORM_APP` (a side-on level a board, seams agreeing by
  the left board's number, levels made until a steady bot crossed them clean, the player handed on to the board beside with the
  view following) lived one day, PR 152, and is gone with its smoke check.
- **Golf tanks, taken out** (Oct 29: "this ame does not work very well. it seems very complicated, but not very easy to play.",
  then "remove  golf tanks."): `GOLFTANK_APP` (Oct 22–29, the tank maze's battle on mini golf's holes, then roaming them as
  Asteroids) is gone, with what mini golf kept only for it: its kit (`_kit`, `solidsAt`, `bareOf` and the bare copies
  `H.bare`), `drawHole` (`cellItems`' `opt`), and the field items' `tilt`. Its notes below are kept as the record.
- **Trick shots** (Oct 22: "could you add the trick shot demo from wander. repos to the games application?"): `TRICK_APP`, id
  `trickshots`, after the tank maze. wander's `play-trick.html` (its main at 335fa6c), a pool table where you set an angle and a power
  and see the whole shot ahead of time, every ball it reaches, to rest.
  - **The engine is wander's, moved whole** (two spaces left): the table played from inside (`image`, `respond`, `pairs`: each ball
    reads the other's direction and v = r/d and they touch at h + v = 1, found exactly), cushions as the ball's mirror image,
    pockets that take a ball filling its view, spin and the cloth (`cloth`, `own`), the balls' grip (`gripOf`: throw, spin passed
    on), jump and massé (`inAir`, `strikeOf`), `simulate`, `sightOf` (the preview seen only `see` contacts deep), `LAYOUTS`, the
    fifteen `CHALLENGES` with their reference shots (`sol`) and `spinChecks`. Only `firstStop` (the balls passed in), `respot` (the
    table passed in) and `strikeOf`'s defaults (chalk and the cue's rise passed in) changed, since games keeps a table a board.
    Change it in wander first.
  - **The board** is the table and a unit of frame round it, 22 × 12 (`boardShape` 1 by 1/`ASP`); `Ub`, `Vb`, `Sb` put table
    units on the board (sizes in widths), `toTable` back. The cloth, frame, sights and pockets are one picture for every board
    (`paint`, the photo tier, 1024 or 256 px by size; tiles under `PHOTO_PX`); the six cushions are boxes, the balls spheres (a
    striped one a white ball with a band, `tsBand`), the cue a tapered cylinder on the shot's line, its tip a small blue ball.
    The preview is dots along each ball's way (`DOT_GAP`, at most `DOT_MAX`), a white dot at each contact, a ring where each
    stops, a gold ring on each pocket a ball drops in, a dashed ghost ball (`tsGhost`), a grey ring where the way passes out of
    sight; Paths (all, cue, off: then only the aim to the first ball and its ghost) in the menu and the row (`trickshots.paths`).
  - **The boards:** the corner block is the challenges in wander's order (`boardIdx` 0 the ½-ball cut … 14 the break; `cellOfIdx`
    turns a number back into its board). Every other board has its own trick shot (below). Free play (the menu's Free play on this
    board, `FREEPLAY`; `setupOf(idx, free)`, `FREE`) is the rack, the row of four, the jump, the massé, or fifteen balls scattered
    by the board's number. A board no one plays (`recSoon`, `shownOf`) shows its own shot:
    the cue laid on its line with the shot seen ahead (`AIM_T`), played, held (`HOLD_T`), round again, each board at its own
    phase; a challenge its reference shot, a free table its layout's (`DEMO`) or the best of five seeded shots at a ball. One is
    worked out at most every 30 ms (about 11 ms for a scattered table), `REC_CAP` 300 kept, at `REC_HZ` 30.
  - **Playing** (`fresh`, `shoot`, `finish`, `undo`: the page's): drag on the table to aim (`claimsPan`, `keepsPress`), tap a point
    to aim at it, tap the white, Shoot or Space/Enter to shoot; a tap while it plays jumps to its end; in free play a drag that
    starts on a ball moves it. The row (`tilesOf`, `onTile`): Shoot, Aim ◀ ▶ (0.1°), Power − +, Spin (`SPINS`: centre, follow,
    draw, stun, left, right and the four corners in turn), Cue ↓ ↑ (5°), See (free play), Paths, Tip (chalked or bare), then Undo,
    or Next ▸ on a challenge. The keys are the page's (◀ ▶ aim, shift a degree; ▲ ▼ power; [ ] and − = the tip; , . the cue's
    rise; z undo). A challenge's try is a shot: missed, the balls go back and the board says why; solved, the fewest tries kept
    (localStorage `trickshots.best`). The menu: Sound, Paths, Show me the trick (the reference shot on the cue), Next challenge,
    Start this board again, About. A shot finishes as its board is drawn, so one left mid-shot ends when it is seen again.
  - **Sounds** are the page's knocks (`SOUND`, `knock`, `soundsTo`: the cue, ball on ball, the cushion, the pocket, each as loud
    as its impact), on the arcade kit's audio and its Sound switch (`trickshots.sound`).
  - **Every board its own trick shot** (Oct 22: "1,2,5" of what came next, the first "every board its own trick shot, harder
    farther out"): past the corner's fifteen, `makePuzzle(idx, lv)` makes a board's puzzle from its number at a level 1–5 (the ring
    level plus the Difficulty, Easy 0, Normal 1, Hard 2, as the tilt maze's; `levelAt`, `DL`), seeded, so always the same.
    - Kinds (each level's `kinds` in `GEN_LV`, weighted): a cut, a bank, a kick off a cushion past a ball in the way, a combination, stun,
      draw and follow into a ring, a jump over a ball, a cannon (levels 2–3: laid on the white's way it was hard to miss) and,
      from level 4, a pot with the white off two cushions into a ring. Each is laid out so a shot should exist (`potSetup`, the
      ghost ball, `mirror` of a pocket or ball across a cushion), then searched for near that aim (`searchShot`: powers, tips, the
      cue's rise); a ring is put where the reference shot's white stops, the cannon's 2 where its white passes, so both are
      reachable. Every goal is built from the puzzle's plain numbers (`goalFor`).
    - Farther out (`GEN_LV`): the preview sees 3, 2, 1, 1 and 0 contacts (level 5 the ghost ball alone), 0–1 up to 3–5 more balls
      about, cuts to 66°, shots longer (`reach`), rings 1.2 down to 0.6. Par is from the window of aim that still solves it
      (`windowOf`, `parOfWindow`: 1.2° or more one try, under 0.2° four); of `GEN_TRIES` (6) seeds the first whose window is in
      its level's `band` is kept, else the nearest. Measured on 40 boards a level: every one solved by its own shot; median window
      4.35°, 2.68°, 1.42°, 0.72° and 0.64°; par 1.0, 1.05, 1.55, 2.2 and 3.3; 12 to 220 ms to make (1.1 s at most).
    - **Harder far boards** (Oct 23: "3", of what came next: "the outer rings could hide the preview entirely, so you rely on the
      ghost ball alone, or add a 'call your pocket' rule"): level 4 now sees 0 contacts too (the ghost ball and the white's way to it
      alone, as level 5), and from level 3 the pocket is called (`GEN_LV`'s `call`; a cannon has no pot and calls none): the pocket
      the reference shot's ball drops in (`pocket`, kept in `PLAIN`), ringed red twice on the table, the text ending "in the pocket
      ringed red"; `goalFor` asks the kind's goal, then the pocket ("the 1 went in another pocket, not the one called"). A called
      puzzle's id ends in `c`, so bests from before do not carry over. Measured in Node on 20 boards a level: every one solved by
      its own shot; median window 1.39°, 0.99° and 0.69° at levels 3, 4 and 5, par 1.4, 2.7 and 3.15; 0.3–0.55 s to make.
    - **Run-outs** (Oct 23: "1", of what came next: "multi-shot puzzles: clear a small table in two or three shots, with each
      leave planned for the next, like a real run-out"): a kind of its own (`run`, from level 2, weighted 2–3 in `GEN_LV`; `genRun`):
      two object balls (three from level 4) and the white, to be cleared in as many shots, each potting a ball with the white kept
      up (`goalFor`'s `run`: "nothing went in"). `runFrom` looks for the run as a player reading the table would: each ball into
      each pocket through its ghost ball (clear lines, cuts to 70°, nearest first), stun then follow then draw, softest first,
      and for each pot whether the table it leaves runs out; a pot that leaves no next shot is a trap (`traps`, one more on par;
      rare, 0–0.1 a run measured), `RUN_BUDGET` 5,000 shots at most. The puzzle keeps the run's shots (`sols`, `sol` the first,
      `shotsN`, in `PLAIN`); par is each shot's window's par summed less one a shot after the first (at most 5), `window` the
      narrowest.
      - Played (`finish`): a shot that pots carries the table on (`g.stage`); a miss puts every ball back and the run starts again
        (`g.rot0`), a try being a whole run; cleared, it is solved in that many tries. The title says which shot of the run it is.
        Show me the trick sets the run's next shot on the cue while the table is still the reference run's, else says so.
      - A board no one plays shows the whole run (`runSim`: the shots flown one after another and joined, `RUN_GAP` 0.9 s between).
      - Measured in Node on 40 boards a level: runs 9, 13, 16 and 20 of them at levels 2–5, every one cleared by its own shots
        after the worker's round trip; pars 1–2 at level 2, 1–4 at 3, 2–5 at 4 and 5; 60–120 ms to make.
      - The messages that said "hold it to play this one again" say the menu's Start this board again, since a hold now toggles
        the row.
    - **Made in a worker** (`workers`, `WK_N` 2): the engine and generator's own text from this script (`workerSrc`: from
      TRICK_APP's start to the field's part) with a message handler, so the same puzzle comes back as plain numbers (`plainOf`,
      `puzzleOf`). The framed or played board first, then those asked for most lately; a job not asked for in 2 s is dropped
      (`JOBS`, `jobOrder`), `PUZ` keeps 800. Without a worker the generator (a `function*`, a `yield` after each shot) runs here a
      slice at a time: the urgent job up to `URGENT_MS` a frame (`pump`), the rest in idle time (`idlePump`). A board waiting shows
      its bare table. In the sandbox the in-page idle time made 3 puzzles in 9 s; the workers kept up with 59 boards in view.
    - On the frame: a generated board's level as dots in mini golf's flag colours (each on a pale rim), and three star slots, gold
      for what the best earned (`starsOf`: par or under three, two more two, else one; `BEST` by the puzzle's id, `g<idx>@<lv>`).
      Solved, the board says its stars, and a tap on it goes on to the next board (`nextBoardOf`: idx + 1, the corner's fifteen,
      then out ring by ring); a hold plays it again. The menu's Next trick shot does the same.
  - **The spin inset and the pull strip** (the same request's second, wander's own controls; `CTL`, `ctlSync`): beside the played
    table while it waits (the board `CTL_PX` 300 px across or more, hidden `CTL_GONE` (1.2 s) after it was last drawn and off the app,
    `onLeave`), page elements of their own, so a press on them never pans the view. The white seen from behind the cue (`#tsTip`):
    a press or drag puts the tip there, the dashed ring the chalk's grip, the gold tick where it rolls at once, the spin and the
    cue's rise written under it. The strip (`#tsPull`): pulled down as far as the shot is hard (all of it 60) and let go, it shoots;
    let go near the top, the power goes back. The row's Spin tile still steps the presets.
  - **The balls roll, numbered, with trails** (the same request's fifth): each ball is a kind of its own (`tsB0`…`tsB15`) wearing a
    picture (`ballTex`: its colour, a striped one's band, its number on a white circle front and back, the white's six red dots),
    turned as it has rolled (`roll`: d/R about ŷ × its way, the engine's own rolling; a game's `g.rot`, a board no one plays has
    every frame's, `rotsOf`). The field's items take a whole turn, `rot` [x, y, z, w] in the board's own frame, the item's own axes
    read in the board's terms as yaw's are (`_emitInto`: the board runs +u to −x and +v to −z, a half turn H about up, so the world's
    turn is H·q = (z, w, −x, −y); it stands in for yaw and tilt; until Oct 23 it was H·q·H⁻¹, which turned the cue round to lie
    along the shot). A moving ball leaves a short trail (`trailItems`: where it was 40 … 200 ms ago, smaller each).
  - **The cue on top, full length** (Oct 23: "the cue stick should always be on top and should extend on to the the adjacent
    boards if needed"): the played board's cue is `CUE_LEN` (21) table units, a real cue's 25 ball widths (wander's 3.2 was a
    stub), tapered (`cueGeo`: ferrule, maple, wrapped butt, vertex-coloured), turned whole along the shot with its butt raised by
    the cue's rise (`rot`), so it lies over the frame and on across the next board, and a massé's stands up from the white. It
    and its tip (`tsTip`) are drawn on top of everything: the field's kinds take `geometry.userData.onTop` (no depth test, the
    transparent pass, `renderOrder` 1000 + onTop, so the tip lies over the cue). A board no one plays shows a `CUE_IDLE` (6) cue
    drawn as any piece is (`tsCueIdle`, `tsTipIdle`), or the neighbours' cues lay across the table being played.
  - **Your own trick shot** (Oct 23: "2", of what came next: "make your own trick shot and share it"): the row becomes an editor
    (`ED`, `ed…`, as the tilt maze's and Sokoban's). Since the row is also the played table's and the field opens it by itself, its
    opening is not the editor's switch: the quick button ✎ (while a table is played) or the menu's Make a trick shot for this
    board… opens it on the framed table, its balls where they are (and its goal, if it was one of yours).
    - Tools: White (a tap moves it), Ball (a tap lays the next number), To pot, Hit first, Don't touch (a tap on a ball marks it,
      again unmarks it), Ring (a tap lays the white's ring, a tap in it takes it away), Erase; a drag moves any ball, kept off the
      others and the pockets. Acts: Bank (the ball to pot off a cushion), Kick (the white off a cushion first), Ring size, See (how
      deep the preview sees), Clear, Check, Play. Quick buttons Erase, Check, Cancel, Done.
    - A setup is plain numbers (`draftOf`, `cleanMine`): `{kind: 'mine', balls: [[n, x, z]], target, first, avoid, bank, kick,
      zone, see}`. `mineGoal` asks, in order, the white kept up, the first ball met, the cushion before it, the balls not
      touched, the pot (off a cushion for a bank), the ring, so a miss says the first thing that went wrong; `mineText` says it
      as one sentence.
    - Check and Done look for a shot (`solveMine`, in a worker of its own, `solveSoon`, else here in slices): the plain shots near
      every aim the table offers (each pocket's ghost ball, through the first ball for a combination, mirrored across each cushion
      for a bank or a kick, a fan of cuts when nothing is to be potted), the widest window of those kept, since par is about the
      easiest way; then with spin, a sweep of the whole round, and a jump if a ball is to be kept off. Every shot tried counts:
      past `MINE_BUDGET` (6,000, about 6 s) none is found, and the setup is refused. Par is from the window (`parOfWindow`).
    - Done keeps it on the board (`MINE`, localStorage `trickshots.mine`, the latest 300; `mineAt`, which `setupOf` asks first;
      its id hashes the setup, so a changed one starts a new best), framed with a violet dot (`MINE_COL`), and plays it. Escape
      or ✕ leaves the board as it was. Menu: Share this board's trick shot (`shareShot`, `SHARE`; the draft while making it) and
      Forget this board's trick shot. A shared one (`takeShot`) is checked by its own shot, or looked for again.
    - Measured: the white at one end and the 1 mid-table, Check took 0.5 s (par 3, a window of 0.34°); a ball ringed by six not to
      be touched was refused after the whole budget.
  - The smoke test checks wander's textbook results (the thresholds wander's own test holds), every reference shot solving its
    challenge on its board, a missed try putting the balls back, a real drag aiming, a real click on the white playing the ½-ball
    cut to a solve, a real Space potting on free play, the row's Spin and power, and a board no one plays going through its shot,
    drawn as balls, six cushions, the cue, dots and a ghost; since Oct 22 ("1,2,5") also generated puzzles at levels 1 and 5 solved
    by their own shots and made the same twice, par rising and the window narrowing, less seen ahead, the stars by tries, the
    balls drawn turned, three gold stars on the solved board's frame, a real click on the inset striking high and left, a real
    pull on the strip shooting, and a real click on the solved table going on to the next board; since Oct 23 the played cue full
    length, drawn on top, its butt behind the white; and the editor (the real ✎ opening it, real clicks laying a ball and
    marking it, Check finding a shot, Done keeping it in storage and its shot solving it, a shared copy on another board, a ringed
    ball refused); and the called pocket (a level-3 puzzle's own shot sinking it there, the same shot with another pocket called a
    miss that says so, none called at level 1, level 4 seeing 0, the two red rings drawn); and a run-out (a board's run found, a real miss starting it again, its own two shots played by real
    clicks clearing it on the next try, a board no one plays showing the whole run with every ball down).
- **3D Tetris** (Oct 23: "any games that require 3d spatial rotation", then "2" of five offered: Blockout): `BLOCKOUT_APP`, id
  `blockout`, after Tetris. Blockout stood on its head: a pit of P × P cells on the board, the stack growing up out of it toward
  you, H layers high; pieces of cubes come down from the top, you slide them across the floor and turn them about any of the three
  axes, and a whole layer filled goes, everything above coming down one.
  - **Levels** 1–5 by ring plus the Difficulty (Easy 0, Normal 1, Hard 2; Lights Out's rule), `LV`: 3 × 3 and 4 × 4 of flat
    pieces (two to four cubes in a plane), then 5 × 5 with the I4 and the three tetracubes that are not flat (the tripod and the
    two mirror-image screws), then five pentacubes, faster; six layers (`SQ` 0.12 of the board a cube).
  - **Turns** are worked in the board's own frame (u, up, v), the one an item's `rot` is read in, so a turn's cells and the
    quaternion it is drawn with agree: a quarter turn about a takes w to a × w + a (a·w) (`turnVec`). Every orientation of every
    piece is found once (`ORI`: 24 for L4 and P5, 12 for T, S and the screws, 8 for the tripod), with where each of the six turns
    takes it. A turn keeps the middle of the piece's box and tries a cell aside or up (`KICKS`); drawn, it swings into place over
    `ANIM` (0.14 s), each cube turned with it. Which way is the screen's (`screenToBoardDirs`): Tip sends the top away up the screen
    (about Up × d), Roll to the screen's left or right, Spin about the upright (`opFor`). `g.turns` counts them (a long piece
    turned about its own length keeps its cells).
  - **Seen**: the stack coloured by layer (`LAYER`), the landing shown as pale cubes (`bkGhost`), corner posts ticked at every
    layer and a rim, the next piece small in the far left corner, a cleared layer flashing (`FLASH` 0.25 s).
  - **Controls**: arrows or WASD slide it (the screen's directions), Q / E spin, R / F tip, Z / X roll, Enter drops (Space pauses,
    as in every game on its own clock; these keys are heard before the field's camera keys and stopped). A drag slides it a cell
    for each cell the finger goes; a tap on the piece or its shadow drops it, elsewhere spins it; the bottom row: Spin ⟲ ⟳, Tip,
    Roll, Drop (`statsStay` while playing).
  - **Two field hooks** came with it: an app's `frameFit` (frameBoard frames from that much farther back: the page-load fit, the 0
    key, a double tap, the zoom steps; 1.9 here, with `pitchMin` 68, since six layers stand 0.72 of a board tall and the far rim
    was off the top of the screen) and `tapMargin` (a fraction past the board's edge whose taps the app is still asked about, u or
    v outside 0..1; it returns false for one it does not want). A cube high by the far rim is seen over the next board's ground, so
    a tap is followed from the eye through each cube of the piece and its shadow (`tapsPiece`).
  - **The tilt given back** (Oct 23, found by CI): an app's `pitchMin` lifts the tilt to meet it, and the tilt stayed there on
    every game opened after 3D Tetris (mini golf at 68° at its zoom ceiling, and its first-tap, drag and track checks failed).
    The field keeps the lift (`_pitchLift`: the tilt before and the floor it was lifted to), and `setFieldApp` puts the tilt back
    before framing an app with a lower floor, unless it was moved since. The smoke test opens mini golf, 3D Tetris, mini golf.
  - Scoring 100, 300, 600, 1000, 1500 for one to five layers at once, times the speed step (one every three layers); the best a
    board kept (localStorage `blockout.best`, by board and level).
  - **A board no one plays** shows a reel (Tetris's way: `bakeReel`, `REEL_N` 2 a level, 40 s, each board at its own frame), played
    by the bot (`plan`: every orientation at every place, dropped, the stack scored by layers, height, holes and bumps; then turned
    along the shortest way through the orientations, `pathTo`, and slid there). Over a reel it clears 64, 32, 19, 20 and 7 layers by
    level. Taking a board carries on from what it showed (`adopt`).
  - **Every board its own puzzle** (Oct 23: "whats next for 3d tetris", then "1,2"; the menu's Mode, puzzles by default,
    localStorage `blockout.mode`; Endless is the game above): a pit part-filled, and the pieces to clear it with.
    - Dealt backwards (`makePuzzle(idx, lv)`, seeded by the board's number, `puzzleOf` keeps 1,500): L full layers, then k pieces
      carved out one at a time, each open from above (nothing over its cubes but its own) and resting where it was (dropped from
      the top it stops there), every layer keeping a gap. The carved pieces in the other order each drop into their hole, the last
      filling the last layer; checked as the game plays (`playSeq`, layers clearing as they fill, `clearFull`).
    - `PZ` by level: 1 layer and 2 pieces, then 2 and 3, 2 and 4, 3 and 5, 3 and 7, with 2, 2, 1, 1 and 1 spare pieces drawn from
      the level's set after them. The pieces come in that order (the next one shown); they fall slowly (`PZ_FALL` 2.5 s a layer,
      `PZ_LOCK` 1.2 s).
    - Cleared (the L layers gone): stars by the pieces used against par k (`starsOf`: par 3, one more 2, else 1), the fewest kept
      (`blockout.best`, keys starting `p`); a tap goes on to the next board (golf's `nextBoard`). Out of pieces or overflowed, it is
      over; a tap tries again.
    - A board no one plays (`shownPuzzle`, from the clock alone) shows the dealt stack, each piece of the solution coming down into
      its hole already turned, the layers flashing, the empty pit, and round again.
    - Measured on 40 boards a level: every one dealt and cleared by its own pieces, 0.1–0.3 ms to deal (0.8 at most).
  - **See-through** (the same request's second: "in a 5×5 pit the higher layers hide the holes underneath"; the menu's
    See-through, V, the row's See tile, on by default, `blockout.glass`): on the board being played a cube at or above the bottom
    of where the piece will land, or over a hole in its column, is glass (`bkGlass`, a third opaque), and each hole (an empty cell
    with a cube above it) is marked by a small red cube (`bkHole`).
  - The smoke test checks the orientations, tip and roll moving a tripod's arms where the screen says, a layer cleared, the pit by
    ring, the bot clearing at every level, a turn drawn turned, and real input: a click starting, the real arrow, Q and Enter, a
    click on the floor spinning and on the piece dropping, a drag sliding, the row's Tip tile, a board no one plays moving (in Endless); and the puzzles: 100 dealt, each
    cleared by its own pieces and the same twice, par by level, out of pieces over, a board no one plays solving its own, glass and
    holes on and off, and real input: a click starting one, its own pieces by the real Enter clearing it in par with a best, the
    real V and See tile, a real click on a cleared board going on.
  **The tilt is free** (Nov 1: "i can't look around when i am down low next to the pieces."): `pitchMin: 68` became `pitchFloor: 3` and `pitchMax: 89`, as Soma's, with `fitView` opening it at 68° where `frameFit` was worked out.
- **Soma** (Oct 23: "any games that require 3d spatial rotation", then of the five offered "Soma or burr puzzles"): `SOMA_APP`, id
  `soma`, after 3D Tetris. Piet Hein's seven pieces (`PIECES`, `NAMES`: V, L, T, Z, the tripod P and the two screws A and B, 27
  cubes), turned about all three axes as 3D Tetris's are (its frame, `turnVec`, `opFor`; no gravity, no kicks), filling a figure
  of glass cells.
  - **Every board its own figure** (`makeFigure(idx, lv)`, seeded by the board's number; `figureOf` keeps 1,500): k of the seven
    laid one at a time in a box where each touches the ones before most and stands on something when it can, so it is solvable
    by construction. `LV`: 3 (flat ones only), 4, 5, 6 and 7 pieces in boxes 3 × 3 × 2 to 4 × 4 × 3, by ring plus the
    Difficulty (Lights Out's rule). The corner's first board is the 3 × 3 × 3 cube.
  - **The solver** (`solve(F, fixed, budget)`): an exact cover, the lowest empty cell first, each piece's placements indexed by
    the cells they cover; 5 million steps at most. The cube in about 30 ms, the others 0.2–2 ms; 100 figures, all filled.
  - **Playing**: the piece in hand hovers over the figure; where it fits in its column shows as glass in its colour (lowest
    first, `fitsAt`; Up and Down, [ ] or PageDown / PageUp step through the others); fitting nowhere it is red. Enter or a tap
    places it, the next piece in the tray coming to hand; a tap on a placed piece takes it back (`placedAt`, the ray from the eye
    through its cubes); 1–7 or the row's tiles take any piece. Keys: arrows / WASD slide, Q / E spin, R / F tip, Z / X roll, H
    hints. The row: the pieces, Spin, Tip, Roll, Down, Up, Place (`statsStay` while playing).
  - **Hint** (`hint`): the solver from the pieces placed as they are; its next piece goes into your hand where it belongs. With
    no way on from them, every piece goes back to the tray. Filled: stars by the hints (none 3, one 2, more 1), the best (most
    stars, then quickest) kept (localStorage `soma.best`); a tap goes on to the next board.
  - **A board no one plays** (`shownOf`, from the clock alone) builds its figure: the solution's pieces coming down into place one
    after another, held whole, and round again. `frameFit` 1.5, `tapMargin` 0.4, as 3D Tetris's. **The tilt is free** (Oct 29: "soma clamping of the tilt is to aggressive. I want to see all sides of the cube from the ground level and from above."): it opened at a floor of 60° (`pitchMin`) with the field's bottom stop at 75°, so the figure could not be seen from the side or from straight above. Now `pitchFloor` 3 (the field's altitude coupling raises it a little as the eye climbs, about 5° at the opening zoom) and `pitchMax` 89, a new app field: the field's `PITCH_MAX` is a `let`, set from the app by `setFieldApp` (75 for every other game). `fitView` opens it at 60°, where `frameFit` was worked out.
  - **The course** (Oct 23: "whats next for soma", then "1,2", the first the famous figures on the boards nearest the corner):
    the first sixteen boards (`boardIdx` 0–15, the 4 × 4 corner block) hold named figures of all seven pieces (`COURSE`, written
    as layers from the ground up, `courseFigure`): the cube, the pyramid, the steps, the bathtub, the sofa, the bed, the throne,
    the tower, the wall, the ziggurat, the castle, the well, the bench, the block, the arch and the stairs. Each was put to the
    solver first (a tunnel on pillars one cube wide and a dais could not be filled and were left out). The title names it.
  - **Count the ways** (the second: "the solver can count every way a figure can be filled (the cube has 240)"): `countGen`,
    the solver going on past the first filling, by hand so it can stop between slices (`countSoon`: 12 ms in 42, for the framed
    board, `WAYS` by figure; `COUNT_CAP` 3e8 steps, past which it says "more than n"). A filling is written as the piece type in
    every cell and brought to one form under the figure's own symmetries (`symsOf`: the 48 signed permutations of the axes that
    map it onto itself, a mirroring swapping the two screws, so it counts only with both or neither; `canon`). The cube: 11,520
    fillings, 240 ways, about a second. The course: from 9 ways (the bed) to 1,998 (the tower). The ways you have found are kept
    by board (localStorage `soma.found`); filled, the board says whether it was a new way and how many of how many, the title
    keeps the count, and the menu's Find another way empties the figure again.
  - **Your own figure** (Oct 23: "whats next for soma", then "1,2", the first "make your own figure"): the row becomes a figure
    editor (`ED`, `ed…`, as trick shots': the row is also the played figure's, so ✎ in the row or the menu's Make a figure for this
    board… opens it, on the framed board's figure). A tap puts a cube in the layer being made or takes it out, the cell found
    where the eye's line through the tap crosses that layer's middle (`cellAtTap`); the layer is framed in gold, the others glass.
    The row: the seven pieces (in or out), Layer ▼ ▲, Width, Depth, Height (stepping round, 2–6, 2–6, 1–5), Fill layer, Clear
    layer, Clear, Check (or "n of m" cubes), Play; quick buttons Check, Cancel, Done. Check and Done want as many cubes as the
    pieces and a filling the solver finds (`solve(…, info)`: `info.capped` when its 5 million steps ran out); Check counts the ways.
    Kept cropped to its cubes on the board (`MINE`, localStorage `soma.mine`, the latest 300, through `cleanFig`; `mineFigure`,
    which `figureOf` asks first), its key `m` + a hash (`figKey`: every figure has a `key`, the course and generated ones
    `idx@lv` as before), so a changed one starts its best and ways afresh. Escape or Cancel leaves the board as it was. The menu:
    Share this board's figure (`shareFig`, `SHARE`; any figure, yours or the board's own), Forget this board's figure; a shared
    one (`takeFig`) is checked by the solver.
  - **Your ways, and one you have not found** (the second): the menu's Your ways… (`GAL`) shows the ways you have found one at a
    time on the framed board, each piece pulled `EXPLODE` (0.28 cell) away from the figure's middle, since a kept way is its form
    under the symmetries (`canon`), the piece type in each of the figure's own cells; the row has Back, which of how many, Next,
    Not found yet, Close, and a tap or the arrow keys step. Show me a way I have not found (`showUnfound`) runs the counter until
    a filling's form is not among yours (`countGen(F, stopAt)`, a little at a time), then builds it piece by piece once (`DEMO`,
    `builtAt`, which `shownOf` now uses too); a tap, Enter or Escape gives the board back with every piece in the tray. A way
    shown is not kept: it counts when you build it.
  - **Piece sets** (Oct 23: "whats next for soma", then "1,3", the first "other piece sets"; offered as the Bedlam cube, the
    Diabolical cube or pentacube boxes, but those two puzzles' exact pieces could not be looked up from the sandbox, so the sets
    are ones exactly defined): the menu's Pieces steps through Soma (7), Tetracubes (8: I, O, T, L, S and Soma's tripod and
    screws), Pentominoes (the 12 as flat pieces) and Pentacubes (all 29: the 12 flat, then the 17 that are not, grown a cube at
    a time and kept one of each under turning, `polycubes`, named a–q), localStorage `soma.set`. `useSet` puts one in play:
    `PIECES`, `NAMES`, `COLS` (`palette` past Soma), `LV`, `COURSE`, `ORI` (`oriOf`), `FLAT` (what level 1 draws from) and
    `MIRROR` (each piece's mirror image: `symsOf` allows a mirroring only when every piece's mirror is in the figure, `canon`
    swaps them; a way is written a character a cell, '0' + type + 1). Every key of the other sets starts with the set's name
    (`pk`): their figures, bests, ways and editor figures (`soma.mine.<set>`) are their own, Soma's as before. Courses: the
    tetracubes' slab, bar, pyramid and staircase; the pentominoes' 3 × 4 × 5, 2 × 5 × 6 and 2 × 3 × 10 boxes and the 6 × 10, 5 × 12,
    4 × 15 and 3 × 20 rectangles; the pentacubes' six boxes, each with pieces the solver found fill it (`PENTACUBE_COURSE`; the 29
    together make no box). A figure wider than six is drawn with smaller cubes (`sqOf`: 0.84 of the board over its width, so the
    3 × 20 is 0.042 a cube). The solver and the counter fill cells across the box's shortest side first (`orderOf`): along its
    longest, the 3 × 4 × 5, 5 × 12 and 3 × 20 ran out of steps; now 11, 21 and 74 ms.
  - **Better hands** (the same request's third): a drag takes the piece to the nearest place within `SNAP` (2) cells of the
    finger where it fits at some height (`snapNear`), else follows the finger; two fingers twisted spin it a quarter turn for
    every `TWIST_STEP` (45°) past the field's dead stretch, clockwise with the fingers, and the view stays put (a field hook: an
    app's `twistTurns()` takes the twist, `onTwist(±1)`, + clockwise; `pinchSpin`); and every empty cell any place of the piece,
    turned as it is, would cover glows in its colour (`fitGlow`, `smFit`; the menu's Show where it fits, localStorage `soma.fits`).
  - **A twist on the piece, or the view** (Oct 24: "two finger rotate does not work for some applications, such as soma."):
    every twist went to the piece while one was in hand, so the view never turned in Soma. Now the field asks `twistTurns(pts)`
    once a gesture, with where the two fingers came down (`pinchAt0`, the answer kept in `pinchApp`), and Soma takes it only when
    one of them is on the piece in hand or its shadow (`handAt`: the eye's line through the touch against each cube's box, grown
    by `HAND_SLACK`, 0.6 of a cube); a twist begun anywhere else turns the view as in every other game. An app's `twistTurns()`
    called with no points answers as before. Measured across the apps, the view turned in every one but Soma and pinball, whose
    table takes each finger as a flipper (two fingers are both flippers, as meant).
  - **Difficulty from the count** (Oct 23: "whats next for soma", then "2,1", the first "a figure with few ways is hard"):
    measured, the ways grow with the pieces (Soma about 2, 9, 30, 200 and 300+ at levels 1–5) and spread widely within a level, so
    a level keeps its pieces and its figure is the one with the fewest ways of `PICK_K` made (1 at level 1 to 5 at level 5;
    `oneFigure` makes one), each counted for at most `PICK_CAP` slices (200,000 steps; `quickWays`: a count cut short counts as
    more than any finished, and of those the fewer found the harder). Soma's level 4 went from about 765 ways made alone to 369.
    The figure keeps `waysN`, `waysExact` and its par (`parFor`: 6 s a piece × (1 + 3 / log2(2 + ways)); the course and your own
    figures get theirs once counted, `parOf`), shown in the title; stars are the fewer of the hints' and the time's (`timeStars`:
    within par 3, twice par 2). Making a level-5 figure takes about 100 ms (up to half a second), so a board only looked at from
    level 3 gets its figure a few at a time (`figSoon`, `SOONF`, `soonPump`: the one asked for latest first, 10 ms a turn,
    dropped if not asked for in 2 s) and shows its bare floor till then; the framed or played board is made at once.
  - **Can it be built?** (the second): from level 3 a generated figure is, by its board's draw (`IMPOSSIBLE`: 15%, 20%, 25% at
    levels 3–5), one with no filling: a buildable one with one cube moved to an empty cell beside it (`makeImpossible`,
    `IMP_TRIES` 10), kept only when the solver tried every way and found none within `IMP_BUDGET` steps (not when it ran out;
    `moved` keeps the cube's two places). Its `sol` is the buildable one's less the piece that held the cube, last, so a board no
    one plays builds it as far as any: from level 3 every generated board's show stops a piece short (`shownSol`), and the
    title keeps the count of ways back until the board is through (`canSay`). ✗ Can't build in the row, the menu's It can't be
    built or N says so (`declare`): right, the board is through (stars by hints and time, `g.said`); wrong, it costs a hint. A
    hint or Show me a way on one says there is no way, and counts as a hint.
  - The smoke test checks the orientations (12, 24, 12, 12, 8, 12, 12), the cube on the corner, 60 figures filled by the solver,
    the levels by ring, a board no one plays building, and real input: the real arrow and E, the real H and Enter placing, a real
    click taking a piece back, the figure finished with a best kept, and a real click going on; and the course: all sixteen filled,
    the cube's 240 ways of 11,520 fillings, a figure with no symmetry counted filling by filling, and a course board filled by the
    real H and Enter as a new way, then again as one found before; and the editor (the real ✎, real clicks taking a cube out
    and putting it back, the real ✓ keeping it in storage, its share link taken onto another board) and the ways (two in the
    gallery stepped by the real ▶ tile, a way not found built and given back by a real click); and the sets (7, 8, 12 and 29
    pieces, 8 tetracubes and 29 pentacubes grown again, the mirrors paired, every course and generated figure filled, the keys
    apart) and the hands (a real drag to a column the piece does not fit ending where it does, a real two-finger twist turning the
    piece and not the view, the glow on and off); and the difficulty (level 4's ways fewer as the fewest of four than made alone,
    the pars, stars for time, a figure that cannot be built proved so, shown a piece short, its count kept back) with real input
    (the real N on one that cannot be built taking it, a real click on ✗ on one that can costing a hint).
- **Asteroids: cleared boards stay cleared, endless ships** (Oct 29: "asteroids - dont reset the board, once a board is cleared keep
  it cleared.    continuos lives don't end game after 3 deaths."): `ASTEROIDS_APP` (Sep 28; flying between boards, saucers, gems).
  While flying between boards (`HOP`), a board whose last rock is broken is cleared for good (`CLEARED`, localStorage
  `asteroids.cleared`, the latest 5,000): no new wave, empty space when no one is on it (`shown`, `EMPTY`), empty when flown back
  into (`adopt`); the menu's Forget cleared boards fills them again. With the edges wrapping the waves come as in the arcade. Ships
  are endless by default (`LIVES`, the menu's Ships: endless or three, localStorage `asteroids.lives`): a ship lost comes back and
  is counted (`g.lost`, the title's "N lost"), the game never over; three is the arcade's. The recordings keep the arcade's. The
  smoke test (part 7) checks both.
  - **The settings row** (Oct 29: "what are cusomization options", then "1,2,3,4,5,6"; `SET`, localStorage `asteroids.settings`,
    `tilesOf`, `setting`, `ORDER`, and the menu's Look, Rocks, Drift and Start wave): New game, Look (3D; Vector, white outlines on
    black, `outlineGeo`, `vrock`, `vship`, `vflame`, `vsaucer`; Neon, the outlines glowing on deep violet; `LOOK_COL`), Rocks (×0.6,
    1, 1.5 a wave, `ROCKS_N`), Rock speed (×0.7, 1, 1.35, `ROCK_SP`), Turn (×0.7, 1, 1.4, `TURNS`), Drift (classic, or arcade: twice
    the thrust, the ship stopping when you stop), Rapid fire, Triple shot and Shield always on (`shielded`), Saucers and Gems on or
    off, Start wave (1, 3, 5, 10), Ships, Fly between boards, Sound. All of it is the game you play (`mine()`: not QUIET); the
    boards no one plays keep the arcade's rules and take the look. A game's `spawned` says a wave came to it, so a board started at
    a later wave is not called cleared before its first. The smoke test (part 7, "asteroids settings") checks each and a real
    click on the Look tile.
- **Harder farther out** (Oct 15: "games that have a difficulty setting should switch to being more difficult as the boards
  move away from the center."): mini golf, Sokoban and the tilt maze already had levels by ring; every other game with a
  Difficulty (the board games' computer players, the arcade games, the puzzles) now plays each board at its own level.
  - The rule is the ARCADE kit's (`HARDER FARTHER OUT`): the setting is the corner block's (rings 0–6, golf's `ringOf`: the
    distance from the corner the short way round the wrapped field), a step harder from ring 7 and another from ring 31
    (`RING_STEPS`), as far as Hard. Easy: easy, normal, hard going out; Normal: normal, then hard; Hard everywhere hard.
  - `ARCADE.levelOn(setting, c, r)`; a kit switch's `DL.at(c, r)`. A game takes its board's level when it is made, dealt or
    started and keeps it on the game, so speeds, sizes and the computer's strength are the board's own; boards of
    different sizes sit side by side in the size games, each showing a recording of its own size.
  - The menu says "Difficulty: normal at the corner", its title the rule (`ARCADE.FARTHER`). Each app's `_debug.levelOf(c, r)`
    gives the level a board plays at; the smoke test checks it on every app with a Difficulty.
- **Sokoban: every board its own level** (Oct 12: "what ideas from mini-golf can we extend to the other games." … "ok,
  proceed", on "every board its own puzzle, harder further out" and "rated by a simulated player, rebuilt until it fits"):
  - The corner block keeps the worked-out levels (`MAP`, one a board, as golf keeps its course there; their par is the pushes
    their known solution makes). Every other board deals its own (`boardLevel`, by `boardIdx`, golf's Szudzik pairing),
    at a level from 1 to 5: golf's ring level (`ringOf`, `ringLevel`) plus the Difficulty (Easy 0, Normal 1, Hard 2:
    `levelAt`). The Difficulty no longer picks the board's size; the level does (`LV_DIALS`: 6×6 with 2 or 3 crates, 8×8
    with 3, 10×10 with 3; walls, a band of pushes, a cap).
  - **Dealt backwards** (`dealBack`): the crates on their spots, then every position pulling can reach, breadth first (he
    may stand anywhere). A position first reached at depth d needs exactly d pushes, so the board takes one at a depth in
    its band, with the fewest crates home; that depth is its par, and the pulls back to it, reversed, are its solution
    (the board's demo, `framesOf`). Random pulls (the dealer before) made every level about 13–16 pushes. A new map is
    tried up to eight times (`makeLevel`); one that falls short keeps its level, its par a little under.
  - `solve` (the fewest pushes, forwards) checks it: the smoke test finds the same par.
  - Measured on 20 boards a level: pars 6.5, 11.5, 20, 23 and 29 pushes; 1 ms, 5 ms, 50 ms, 65 ms and 290 ms to deal. So
    boards only looked at are dealt one at a time, 50 ms apart, and show their bare floor until then (whole or not at all);
    a board played is dealt at once. `BOARDS` keeps 1,500.
  - A dealt board shows its level as a frame in golf's flag colours (`frameV`/`frameH`). Solved, it says your pushes
    against par as stars (`starsFor`: at par 3, within half again 2, else 1), and a tap goes on to the next board (golf's
    `nextBoard`).
  - **The row is a level editor** (Oct 13: "yes", on the Sokoban level editor): `ED`, `ed…`, `MINE` inside `SOKOBAN_APP`,
    with the hooks chess and tower defense have; taps reach `edTap` from `onCellTap` (a drag or a hold does nothing while
    editing, and the arrow keys don't walk him).
    - Opening the row (the dots, or the menu's Make a level for this board…) takes the framed board's level as it starts (its
      own, else the one it deals) into the editor (`framedCell`, not `LIVE`). Tiles: Wall, Crate, Spot, Keeper, Floor, then
      Clear, Size (6, 8, 10), Check, Play; quick buttons Floor, Check, Cancel, Done. The same tool again takes a wall, crate
      or spot off; the keeper is moved, never erased.
    - Check and Done run `solve` (cap `MINE_CAP`, 150,000 positions; `solve(L, cap, info)` sets `info.capped` when it gives up
      rather than finds no way). Done needs a crate or more, as many spots, and no proof it is hopeless: the fewest pushes are
      its par and its pushes what the board plays when no one is on it; one too big to finish is kept without a par.
    - Kept on the board (`MINE`, localStorage `sokoban.levels`, the latest 300, read back through `cleanMine`, made playable
      by `mineLevel`, which `boardLevel` asks first) and played at once. Escape or Cancel leaves the board as it was; the
      menu's Forget this board's level puts the dealt one back.
- **Chess: the row is a position editor** (Oct 13: "I really like that bottom browser. lets use it in chess to create custom
  chess games instead of selecting a board. similar to mini-golf"): `CHESS_ED`, `chessEd…`, before `CHESS_APP`, which now has
  golf's hooks (`onBrowserToggle`, `statTiles`, `statsStay`, `onStatTap`, `quickActs`, `onQuickAct`) and `worldTap`, the one tap
  hook chess's own play does not reach first.
  - Opening the row (the dots, or the menu's Set up a position…) takes the framed board's position as it stands (the game in
    play, the board's own game, or what it is showing) into the editor; play stops. The board draws the editor's position
    (`buildInstances`, before `cellSource`'s answer).
  - Tiles: the twelve pieces and Erase, then Clear, Start, whose move it is, which side you play, Play. A tap on the edited
    board puts the piece in hand on that square (the same arithmetic as `handlePlayClick`); the same piece again takes it off,
    a second king of a colour moves it, a pawn on the first or last rank is refused. A tap on another board moves the editor
    there. Quick buttons: Erase, Clear, Cancel, Done.
  - Done (✓, Play, the menu, or shutting the row) checks the position (`chessEdCheck`: a king each, no pawn on the back
    ranks, the side not to move not in check, not already over) and puts it on the board as its own game (`userGames`,
    `setGameMeta` src 'setup', saved with the session; PGN export carries its [FEN]), then plays it (`enterPlay`, you the
    side chosen; the engine is told `position fen`). Escape or Cancel leaves the board as it was.
  - **A FEN** (Oct 14: "can I set the fen. with a string such as : rn1k3r/1b1q1ppp/p2P4/2B2p2/8/1QNBR3/PP3PPP/2R3K1 w - - 1 0",
    then "ok"): the editor's last tile, FEN… (a prompt offering the position's own FEN, `chessFenNow`), puts a pasted FEN on the
    board being set up (`chessEdFen`); the menu's Set up from FEN… does the same and plays it (`chessAskFen(true)`). `chessFenTidy`
    trims quotes and spaces, fills in fields left off (White to move, no castling, no en passant, 0, 1), reads a move number
    under 1 (puzzle books' `1 0`, which chess.js refuses) as 1, then asks chess.js; share links go through it too. The FEN is
    kept whole (`CHESS_ED.fen`), so castling, en passant and the counts are played as given until the board or the side to
    move is changed, when the editor's own reading (`gridToFen`) takes over.
    With no board selected it takes the one in the middle of the view (`_chessMiddleBoard`), and either way the view flies
    to the board it set (Oct 14: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1. did not work": it had worked, on a
    selected board small and far up the screen, or said "Pick a board first").
  - **Many FENs at once** (Oct 14: 96 board-only FENs pasted, then "Yes" to a Paste FENs… item): the menu's Paste FENs… opens
    a box (`openFenPasteBox`, `#fenPasteBox`); `importFenText` reads it a line at a time through `chessFenTidy` (a list's
    "12." numbering is dropped; a board alone is White to move, or Black if White cannot be: `chessPositionWhy`, the editor's
    checks on a FEN) and puts each position on its own unused board, nearest the framed one first (a pasted PGN's ring
    search), as one import in the game index (`recordPgnImport`, `gameMeta` src 'setup' with its FEN); the first is framed.
    The box says how many went on and lists each refused line with why (a rank's squares counted by the page, since chess.js
    calls seven "too many"), keeping only those lines in it. Paste PGN hands a clipboard or box of FENs here (`looksLikeFens`).
    The owner's 96: 92 on boards, 4 refused (two ranks of 7, an `o`, and a line in another notation).
  - While the editor is on, its tiles have the row (`rebuildBoardBrowser` asks `statsStay` before the move tiles), so the
    row no longer shows a game's moves: opening it sets up a position, as golf's edits a hole.
  - Without the piece set (as in the sandbox) chess is watch-only and `enterPlay` says so; the position is still the board's.
- **Chess's pieces fade between rungs** (Oct 14: "ok", after mini golf's ground and pieces): a piece is drawn at rung K (1, 2,
  4 … 64 harmonics, `RUNG_LADDER`) by its board's size, and each rung but the coarsest now carries rung K/2's surface at its own
  points (`fieldMorph`, shared with golf's bumpers: each part's grid of rings and segments, `fieldGridOf`, on the coarser grid's
  own triangles; `pos2`, `col2`, `nrm2`), blended by a weight per piece in `pawnMat`'s vertex shader (`morphMaterial`, an
  `instMorph` per instance, set by `setInstance`'s last argument). `rungFor` keeps the rungs where they were (floor of
  x = log2(bp / `RUNG_BP0`) + 1, so the triangles too) and sets `_rungW` = 1 − 2·(x − L): full over the upper half of a rung's
  range, at the bottom the rung below exactly, so a board flown toward never pops; the band against dithering is no longer
  needed there. Rounding to the nearest rung instead put the far boards a rung finer: 11 million triangles became 35 in a
  zoomed-out field of pieces. `window.fieldLOD` holds the builder and the rung choice for the tests.
- **Flat pieces fade too** (Oct 14: "2,5", the second being "smooth detail for the other board games"): zoomed out, the
  kit's 48-sided discs were nearly all the board games drew (Go 1.22 million triangles, checkers 1.23, Reversi 0.84). A
  `FieldKit.disc` or `.ring` now says what it is (`userData.flat`), and the field (`_emitAppItem`, which is told the board's
  size) draws it by its radius on the screen (`_flatGrain`, `FLAT_SEGS` 48, 12, 6, `FLAT_BANDS`): 48 sides from 24 px,
  fading to 12 by 12 px, 12 from there, fading to 6 between 8 and 4 px. Each grain carries the next one's polygon at its own
  points (`_flatMorph`: `pos2`, the field's morphing kinds), so at weight 1 it is that polygon exactly and the step to the
  coarser kind (the name with `#12` or `#6` after it, made by `_itemRec` from the base kind's numbers) changes nothing on
  the screen. A disc made with 12 sides (a trail's dot) never gains any. Every app's kit discs get it, not only the board
  games'. Zoomed out (×20 from the opening): Go 1.22M → 169k, checkers 1.23M → 253k, Reversi 844k → 199k, Gomoku 739k →
  101k, Ataxx 614k → 133k, Lines of action 490k → 142k; framed, Go 34k → 22k, Gomoku 20k → 10k. `window.fieldLOD` has
  `flatGrain`, `flatMorph` and `itemKinds` for the tests.
- **Tower defense: the row is a map editor** (Oct 13: "tower defense", on "what other games could benifit from this kind of
  thing", after chess's position editor): `ED`, `ed…` and `MAPS` inside `TD_APP`, with chess's hooks (`onBrowserToggle`,
  `statsStay`, `onStatTap`, `quickActs`, `onQuickAct`); taps reach `edTap` from `onCellTap`.
  - There is no road (the towers are the walls), so a map is what the floor starts with: rocks (kept in `g.towers` as 6,
    `ROCK`: they block the way as a tower does, and never fire, raise or sell), the entrance and exit on any edge (`g.doors`,
    `doorsOf`; a piece comes in from outside its entrance and leaves past its exit, `outOf`), towers standing from the start
    (level 1), the size (12, 16, 20) and the gold.
  - Opening the row (the dots, or the menu's Make a map for this board…) edits the board the field has framed (`framedCell`;
    `LIVE` can be a board left earlier): its map if it has one, else its own doors on an empty floor. The draft is a game never
    stepped (state 'edit'), so the board draws it with the way lit.
  - Tiles: Rock, Entrance, Exit, the five towers, Erase, then Clear, Size, Gold, Play. The same tool again takes a thing off;
    anything that would shut the exit off from the entrance is refused, and a door must be on the edge. Quick buttons: Erase,
    Clear, Cancel, Done.
  - Done (✓, Play, the menu, or shutting the row) keeps the map on the board (`MAPS`, localStorage `td.maps`, the latest 300,
    each read back through `cleanMap`) and starts a game on it (`newGame(l, n, map)`). Escape or Cancel leaves the board as it
    was. A tap on another board moves the editor there.
  - The row is the editor's alone (`statTiles` gives nothing while playing): its gold, lives and wave tiles went, since the
    field opens the row by itself when an app's numbers first appear, and in a game that started the editor. The title keeps
    gold, wave and pieces out.
  - A board with a map shows it waiting, not the bot's recording; Reset and Difficulty start it again (the waves and the
    pieces' strength are still the Difficulty's). The menu's Forget this board's map puts the board back.
- **The board games: one position editor** (Oct 13: "1,2", the first being "a position editor for checkers, Reversi,
  Ataxx, Gomoku and Go in one PR"): `BOARD_ED`, before `CHECKERS_APP`. Each of the five apps carries `_ed`, a description
  of itself: `title`, `map` (its own map of games) and `keyOf`, `shown(c, r)`, `pieces` ([code, glyph, name, light?]),
  `sizes` where it has them, `cellsOf(state)` → {n, cells, turn}, `startCells(n, c, r)`, `stateOf(n, cells, turn, you,
  draft)`, `check(n, cells, turn)` → why or null, optional `canPut(n, i, code)`, and `go(c, r, state, you)`, which hands
  the move to its computer player. After `window.FIELD_APPS`, `BOARD_ED.wrap(app, app._ed)` gives each app the bottom
  row's hooks (chaining any it had), menu items, and `_edDebug`.
  - The draft stands in the app's own map while it is made (so the app draws it), never stepped: the computer players are
    only asked after a move, and taps reach the editor first. Escape or Cancel puts back what was there.
  - Tiles: the pieces, Erase, Clear, Start, whose move, which side you play (the side to move unless chosen), Size (Go 9,
    13, 19; Reversi 6, 8, 10), Play. Checks: checkers, a piece each, a move for the side to move, men only on dark squares
    and never on the row that would crown them (kings: ⛃ ⛁); Go, no group without a liberty (`deadGroup`); Reversi and
    Ataxx, someone can move; Gomoku, no five in a row already (`fiveIn`), a square left.
  - Checkers' squares hold {k, red} (red is Black); the editor's codes are 1 black man, 2 white man, 3 black king, 4 white
    king. Go has no `human`: `go` asks its opponent when you are not the side to move. Ataxx's Block is code 3 (`BLOCK`).
- **Share links** (Oct 13: "1,2", the second being share links for what the editors make): `SHARE`, before `CHESS_ED`.
  A link is `?app=<id>&setup=<base64 JSON>`; `SHARE.install(app, apply)` wraps the app's `onFramed` so the first board
  framed after load takes it (once a page), through the game's own checks. Menu items: chess's Share this position (its
  FEN and your side, `chessShare`, `chessTakeSetup`, which runs the editor's Done), the board games' Share this position
  (the framed board's position, any position, or the draft), tower defense's Share this board's map (`shareMap`,
  `takeMap` through `cleanMap`) and Sokoban's Share this board's level (`shareLevel`, `takeLevel`: `cleanMine`, then the
  solver; a level with no way is refused). Mini golf keeps its own `?hole=`.
- **Puzzle makers: Unblock Me, Flow and Eight Queens** (Oct 13: "ok, proceed", on puzzle makers where the solver checks the
  puzzle): `PUZZLE_ED`, after `BOARD_ED`. `PUZZLE_ED.make(app, G)` gives an app the bottom row's hooks, the menu's Make a
  puzzle for this board…, Cancel, Share this board's puzzle and Forget this board's puzzle, Escape, the puzzles kept on their
  boards (localStorage `G.store`, read back through `G.clean`) and the share link (`SHARE`). The game gives `draftOf`,
  `tools`, `acts`, `tap`, `check` (its solver: `{why}` or `{data, note}`), `clean`, `fromData`, `play` and `forget`; it
  draws `P.draft(key)` while one is made and uses `P.mine(key)` for a board's own (its gameAt, Reset, Difficulty, and a tap
  on a solved board start that puzzle again). Drags pan while making. Check and Play are the last two tiles; quick buttons
  Check, Cancel, Done.
  - **Unblock Me** (`unblock.mine`): the red block (across, two long, in the gap's row), blocks across and down of 2 and 3,
    Erase, Clear, Size 6/8/10. `solveUB`: breadth first, a move one block sliding any distance (as the dealt ones count),
    300,000 positions; the fewest moves is the best to beat. A puzzle is the PUZZLES' own code (`h231…`, `encUB`/`decUB`).
  - **Flow** (`flow.mine`): a tile a colour (the game's nine) and Erase, Clear, Size 6/8/10; two dots a colour. `solveFlow`
    looks for pipes joining every pair that fill every square: one colour's pipe a square at a time, toward its goal first,
    a branch given up where an empty square has fewer than two ways through it, a pair's ends share no empty room, or a room
    touches no pair that could fill it; `FLOW_CAP` (400,000) steps, past which the puzzle is kept but said to be unchecked.
    The dealt puzzles solve in 0–21 ms at 6×6 and 8×8, up to 1.3 s at 10×10.
  - **Eight Queens** (`queens.mine`): this game is the classic eight queens, no regions, so a puzzle is clue queens (`GIVEN`,
    drawn white, a tap on one says it stays) and the rest to find. No clue may attack another; `waysOf` counts the ways to
    place the rest, and Done wants exactly one (else it says how many and asks for another clue).
- **Levels: level of detail, shown on the field** (Oct 13: "we are making signifcant progress in the wander project about LOD.
  is there is anything we can do in the games project to help show how LOD works? maybe an application devoted to the
  concept?", then "yes."): `LEVELS_APP`, id `levels`, before `window.FIELD_APPS`. The theory is wander's (`flight.html`,
  `levels.html`, `zoom.html`); this plays it on real boards with a real count of what is drawn.
  - Every board carries one body of its own (Oct 13: "the object in each board should be unique, generated from the board
    Id."): a ball with relief in four bands of doubling frequency, seeded by the board's id (`boardIdx`, golf's and Sokoban's
    Szudzik pairing; `bodyOf`: each band weighed 0.3–1.7, each wave its own way round and phase, the whole stretched a little,
    `B.s`, and its own colour, `B.color`). Grain `g` (0–3, `LV_GEO`) is a mesh of 64 >> g around and 32 >> g up, each a
    quarter of the one before (`TRIS`: 3,968, 960, 224, 48 triangles).
  - **Invariant, locked by the board's id** (Oct 13: "why do object change color and shape. they should be invariant, locked
    by the id of the board."): a body keeps its colour in every mode and at every distance, and every grain keeps band 0, its
    broad lumps, and its stretch, so only the finer bumps come and go. The level shows in the rings and the row.
  - **Smooth, not snapped** (Oct 13: "LOD does not snap, it is smooth between levels. between levels use the proportion part
    of the level."): a board's detail is a number, `gc` (`detailOf`): one address is h/n past the corner, the board's own
    place in its level, and H/n inside it. At gc = g + t the mesh is grain g, holding bands b ≤ 2 − g in full and band 3 − g
    at weight 1 − t (`fadeOf`, `bandWeights`), so that band is gone just as the mesh steps down to g + 1, which holds the same
    bands: a step changes only how finely the surface is sampled. By metres keeps an engine's snapped tiers, None grain 0.
  - **One mesh** (`BODIES`, `bodiesBuild`): with weights moving every frame, nothing is a kind of the field's (`cellItems` gives
    no items). Each board asked goes into `BAT`, and the field's `afterItems` hook (every board asked, nothing drawn yet) lays
    them all into one mesh, lit here (`LIGHT`, a basic material). A body's parts at a grain are made once (`partsOf`: the point
    with its full bands and the step to the fading one, the normals and shades of both); a body with nothing fading is kept in
    the world as laid (`STILL`) and copied; bodies go grain by grain, so the index is written only when a grain's count changes.
    Measured: 1 ms a frame opened (138 bodies), 8 ms tilted to 6° (5,784 bodies, 280,656 triangles, one draw). The caches hold
    20,000: at 3,000 the horizon's bodies were made again every frame, 150 ms.
  - The triangles face out (Oct 13: "the object in each levels board is not centered."): wound the other way, the near side
    was culled and the inside of the far side showed, so every body looked hollow and pushed back off its board's middle.
  - The tilt is not clamped (Oct 13: "don't clamp the tilt in levels."): an app's `pitchFloor` sets the field's tilt floor,
    lower than its 35° if it likes (`pitchMin` can only raise it); Levels' is 2°. It still opens at 35° (`OPEN_PITCH`).
    Tilted to 6° from its opening height the bodies reach the horizon's haze: 16,000 boards (the cap, `PAST_MAX`) out to
    h ≈ 720, about 1.4 million triangles, built in about 23 ms in the sandbox.
  - **Past the tiles** (Oct 13: "the objects are not visible in the far horizon. when i select the board in the far horizon,
    I can see the object again."): the field's walk stopped when its 400,000 tiles were spent (6,250 boards of 64), so every
    board past them was ground alone, and a far board came back only when flown to. An app's `itemsPastTiles()` keeps the
    walk going, nearest first, every tile declined, asking for items until it says enough; Levels' says so up to `PAST_MAX`.
  - **It crashed the computer** (Oct 14: "it crashes the computer at far horizon"), for three reasons, all fixed:
    - `_boardItems` cleared old boards out of its cache on every board once the cache passed 4,000, going through all of
      them each time; with 16,000 in view, all seen lately, that was 16,000 × 16,000 steps a frame. Now once a frame
      (`_itemPurged`).
    - A board past the tiles went through the whole of a board's work for nothing; now it is its items alone.
    - three.js's wireframe made its own lines from the whole index buffer (4 million long) every time the index changed,
      nearly every frame at the horizon. The wire is now lines of its own (`BODYLINES`, sharing the bodies' points and
      colours), each grain's edges listed once (`edgesOf`), laid only as far as the bodies go. Only what is in use is sent to
      the graphics card (`updateRange`), and grown buffers come in new geometries, the old disposed.
    - Measured here at 6°: the walk 3.6 s a frame before, 0.22 s after (0.54 s with no bodies past the tiles at all).
  - v is the eye's height, h a board's distance along the ground from the point under the eye (as flight.html). By v/h (the
    default) the corner is h = v: level 0, the near field, is h ≤ v, and level k runs from 2^(k−1)·v to 2^k·v (`levelAt`).
    By metres the split is at fixed distances (`METRES_D`, 2 board spacings, doubling). None draws every board at grain 0.
  - **H is a dial** (Oct 13: "small H gives good fidelity to nearby objects, large h gives good fidelity to far away objects.
    larger H moves the corner further away from the observer, which gives more proportional space. reader has fixed number
    of addresses, so more proportional space means each object is given less level of detail."): H = v·2^hs, hs −3 to 3
    (`setH`, the row's H smaller / H larger, `?H=`, localStorage `levels.H`); hs = 0 is flight.html's V = H. By v/h the
    levels split at H, 2H, 4H ….
    - The reader holds `ADDR` (512) addresses, shared evenly between the near field and each level out to the farthest
      board in the last frame drawn (`farR`): n = ADDR / (1 + ⌈log2(R / H)⌉) (`shareOf`). One address is H/n inside the
      corner and 2^(k−1)·H/n in level k, so levels 0 and 1 share a grain. A body (`BODY_B`, 1.8 across) gets a = b / address
      addresses, and its grain is round(log2(64 / a)), 0–4 (`grainOf`).
    - Same view (eye at 8, farthest board 63 away): H = v ÷ 4, n = 85 over 6 parts, near grain 0, far (h 32–64) grain 4;
      H = v, n = 128 over 4, near 1, far 3; H = v × 4, n = 256 over 2, near 2, far 2.
    - By metres keeps an engine's fixed tiers (grain = level), None every board at grain 0. Measured at 1280×800, opened by
      v/h: 157 boards in 4 levels for 30,992 triangles; climbed, 1,316 boards for 36,552; None at the opening 622,976.
  - **The leaves are a dial** (Oct 14: "let the user change the leaves of levels not chess to change ihe image size"): the
    reader's addresses are the size of the image it reads the field into, ADDR = 512·2^as, as −3 to 3 (64 to 4,096; the
    row's Fewer leaves / More leaves and its leaves tile, the menu, `setLeaves`, `?leaves=`, localStorage `levels.leaves`).
    Each doubling makes every body a grain finer, as far as the finest. The opening view's 157 boards: 7.5k triangles at 64
    leaves, 27k at 512, 599k at 4,096.
  - **No coloured boards** (Oct 14: "remove the colored background to boards in levels."): with no colours of its own a board
    took the cell fill (`CELL_FILL_CSS`, a warm red), so Levels' `cellFar` is the ground's own colour (0x06080c) and the bodies
    stand on the field alone.
  - Rings on the ground (gold at the corner, then each doubling) follow the point under the eye, scaled by v (or METRES_D),
    drawn from its own frame loop (`tick`), which also takes the counts of each frame the field drew (`fieldRest.drawn`: a
    frame it rests on asks the framed board alone).
  - The bottom row: None, By metres, By v/h, Wireframe (on at first; `?lod=`, localStorage `levels.mode`, `levels.wire`),
    then boards and triangles at each level and the total. A tap on a board says its level, h/v and triangles.
  - Field hooks it added: `afterItems()` (called from `_flushAppItems`); `pitchFloor`; `FIELD_WORLD.itemAt` (the board being asked about, its middle on the ground, set in `_boardItems`
    and for the framed board in `_restDecide`); an item kind's `geometry.userData.wireframe`; an app's `fitView(F)`, called by
    the default fit (Levels opens at the lowest tilt, 35°, from `OPEN_V` = 8, so four or five levels are in view); and
    `onLeave()`, called by `setFieldApp` on the app being left (Levels puts the tilt back). It sets `itemMinPx: 1`.
  - **Recover a body** (Oct 17: "In draw.html we uses the address to recover the shape of two d shapes with cauchy. Let's
    create a new lab that recovers 3d shapes."; "Let's do this in levels application of games.html. it has the 3d shapes."):
    draw's RCC and UDV labs in three dimensions, on Levels' bodies (every band in full). Predictions and runs are in wander's
    `plans/rsh-plan.md`, written first. `recover(idx, k)`: one reader at the body's centre sweeps 4,096 directions (a
    Fibonacci lattice); each meets the surface once and reads its direction [h : v : v₂], the same for every body, so the
    census is a unit sphere; three readers inside (a triangle 0.12 of the least half-extent about the centre, tipped out of
    every axis plane), holding only directions to each point (which point is given), cross the squarest pair's rays: the
    body in |AB| (their own spacing), and with |AB| carried in, the body. `k` scales the world. Run 1 (200 bodies): readings
    the lattice's to 3e-16, points to 1e-13 of the mean radius, every point seen by all three readers. Menu "Recover a body:
    on/off", then a tap on a board: `recoverShow` draws the census (gold, left), the readers' points with |AB| (teal, on the
    body) and in |AB| alone at one drawn length (violet, right), the readers red, in a row across the screen, over everything.
    Hooks `_debug.recover`, `bodyFrame`, `recoverShow`, `recoverOn`, `recoverGroup`; the smoke test checks bodies 0 and 7.
- **Curved fences** (Oct 10: "6,4,2,3", 2 being curved fences as TVF curves): `curve [x0, y0, …]`, 3–24 leaves in cells,
  an open fence through its leaves. TVF curves are closed, so `curveOf` mirrors the leaves (x0…xn, xn…x0) into a closed
  curve, rebuilds it with draw's kernel, and keeps the half from the first leaf to the last (`CURVE_S` points a leaf,
  cached by array).
  - The ball meets the nearest point of its line (`curveNear`), as it meets a fence. It is drawn as half-cell fence pieces in
    the hole's material, stretched along each chord (`sx`).
  - The editor's Curved fence tool (〰️): a drag draws it, a tap lays an arc of five. It stays selected with its leaves
    shown, a leaf drags alone, and the line drags the whole fence.
  - Generated holes only (the course keeps its guards) get three guards: a hook (a round fence about the cup open at the
    back), an S-bend across the way in, and a snail (a fence spiralling one turn out from the cup, arms 1.25 cells apart,
    nothing riding or standing inside it: `clearR`). A screen may also be an arc bowed toward the tee.
  - Rated against holes like them without curves (2.9 strokes): hook 3.5, S-bend 3.8, snail 6.3. So hooks and S-bends
    come from level 2 (`CURVE_FROM`), snails only at level 5, and the guess counts them (`CURVE_GUESS`).
  - No cage goes on a hole with a stream: together they made a hole the plain player could not finish.
- **Lakes, sand and greens as TVF shapes** (Oct 10: "yes, lakes, sand and greens could use tvf."): ground pieces
  `lake [x0, y0, …]`, `sand [same]` and `green [x0, y0, …, height]`, 3–32 leaves in cells (24 until Oct 11). Each is a
  closed TVF curve through its leaves, like a path's loop (`blobOf`, sampled at 8 points a leaf and at least 48, cached by
  array; `blobIn`, `blobEdge`; a hole's shapes by kind, `shapesOf`, kept on the compiled hole as `H._shapes`).
  - `groundAt` reads inside a lake as water and inside sand as sand, so the ball, the drawing, the far boards (`gridOf`)
    and the icon take them as they take cells. The players' way round (`cellBlocked`: the scorer, `solveHole`, the course
    test) treats a cell whose middle is in a lake as water.
  - `rawH` raises or sinks a green inside its outline, sloping over `GREEN_EDGE`.
  - **A lake lies in a basin** (Oct 11): each lake has its own water level (`lakeLevel`, kept on its shape as `level`), a
    little under the lowest ground round its rim, worked out once with the lakes left out (`LAKE_BUSY`). `rawH` carves the
    ground to it: inside, just under the water; outside, ground higher than the water slopes down to the shore over
    `LAKE_EDGE` (1.8 cells); ground lower than it is left alone. The drawing lays a lake's water at its own level
    (`waterAt`); `waterLevel` is the cells' water alone. (Levelled to its lowest point inside, a lake over a hill stood in a
    pit with a blue cliff; to its average, one over a hollow stood as a mesa with the water under it.)
  - Sand's colour is blended over its edge (`sandMix`), cells and shapes alike.
  - Editor: tools Lake, Bunker and Green (a drag draws the outline, a tap lays a round one, `SHAPE_TOOLS`). One tap selects
    a shape, unlike other ground, which needs a second tap on the same spot. Its leaves drag, and are added and taken away
    as a path's are (`leafSel` gives any selected thing with leaves). Higher and Lower change a green's height (its last
    number).
  - Generated holes: bunkers are shapes (`blobLeaves`: round or long, off the tee, cup and stream). A hole with no stream
    may get a pond. The plateau and sunk ground kinds became greens. The apron, raised-green and pond guards are shapes
    on generated holes; on the course they are cells (since Oct 11 the apron's and the pond's are read as shapes, `shapify`).
  - **More leaves** (Oct 11: "could you add more leaves to lake, sand and grass"): bunkers and greens have 12–16 leaves,
    ponds 16–20, the apron's sand 12, the raised green 14 and the pond guard 16 (seven or eight until then). With ten or
    more the rim takes the 4th and 5th waves as well as the 2nd and 3rd, each smaller, so a pond has coves and a bunker
    lobes. In the editor a tap lays twelve, and a drawn outline gets a leaf every 0.6 cells (8–24); a tap on the line
    adds one, up to 32.
  - The guess counts a pond across the tee-cup line as water, and one off to the side as a third of it. Rated on 240 fresh
    holes, the levels came out 2.5, 2.8, 3.5, 4.1 and 5.3 strokes.
- **No painted water or sand** (Oct 11: "then water, grass and sand are not needed. remove them.", after "how do I show
  the lakes leaves?"): the editor's Grass, Sand and Water paints went (Erase puts grass back on a walled or planked cell).
  Water and sand still written in cells (the rapids, the island, the dunes and the bunkers, a generated stream, a guard's
  pond or apron that fell back to cells, holes saved or shared before) are read as shapes by `shapify`: each run of water
  cells, with the planks over it, becomes a lake, each run of sand a bunker; the outline is traced round the cells
  (`outlineLeaves`), pushed 0.45 out under the rail where it meets the board's edge, its corners cut by 0.35, and laid
  down a leaf about every half cell (8–32). The cells become grass; planks (`=`) stay, over the lake. A run that rings
  round something (the island's water) is cut down the middle of what it rings (`unringed`), the halves overlapping.
  - It runs on the course after its guards (so `HOLE_SRC` has shapes), at the end of `genOnce` (the weave and the guards
    still keep off the cells as they always did), and in `cleanSrc` (links, storage, files, generated holes).
  - Lakes that overlap are one water, at the lowest of their levels (`lakeLevel`). A lake's level comes from its rim on the
    board only (a stream's ends run on under the rail).
  - **Bridges over lakes:** planks lie flat just over the water (`rawH`: at least the lake's level + 0.006 in a `=` cell),
    since a carved stream took a bridge that followed the ground down and up again. A stream's line lies within 0.04 of a
    cell of its old rows, so water within `BRIDGE_M` (0.08 cell) of a plank reads as planks (`nearBridge`), and no water
    lies across a bridge's end. `cellBlocked` lets planks pass.
  - The smoke test checks there is no paint for them, no painted cells on the course or 300 generated holes, an old hole
    with a ringed pond, planks and sand read right, and the rapids' bridge flat over its water and dry at its ends.
- **Winding streams** (Oct 11: "4", from "what else can we do with tvf?": a stream that meanders down the hole as a curve):
  a generated stream is a lake whose middle is a sine-generated curve (as rivers' meanders are drawn: the heading swings
  θ(s) = ±Θ·sin(2πs/Λ) along its length), straight under the bridge for the bridge's width and 0.3 of a cell either side,
  each side of it its own wave, on past both rails. No bend is tighter than Λ/(2πΘ), held to the half width + 0.6 of a cell,
  so the inner bank never folds. It keeps 1.3 cells off the tee and the cup (turned the other way on one side, the other, both,
  then gentler, else straight). The banks are the line put out half the width (0.85–1.05, or 1.5–1.8) either side, laid down
  as up to 32 leaves. The planks (still cells, 2 or 3 across, `rows` = ceil(width + 0.5) long) span it with a quarter cell or
  more to spare at each end. While the hole is made the cells the water touches are marked `~` (`stream.cells`), so the weave
  and the guards keep off it as before; `lay` puts them back to grass and adds the lake at the end of `genOnce`. On 200
  streams the bank swings 1.6 cells up and down across the board (1.1 to 2.3), every bridge spans water with dry ends, and the
  tee and cup are 1.3 cells or more clear. The course's rapids keep their straight stream.
  - A lake's shore is drawn as a colour blend a quarter of a cell across its line (`lakeMix`), as the sand's is, not the
    mesh's stairs.
  - A shape's line is held in a grid of 16 × 16 boxes over its own box (`blobGrid`, made when first wanted): `blobIn` tries
    only the pieces of line in the point's row of boxes, and `blobEdge(B, x, y, max)` only those within `max` (nearer is
    exact, farther is `max`; without `max` it tries them all). `rawH` (lakes to `LAKE_EDGE`, greens to `GREEN_EDGE`),
    `sandMix` and `lakeMix` pass their reach. The answers are the same as before; a stream hole rates in 4–5 s, not 7–10.
- **Lakes, bunkers and greens as .tvf** (Oct 11 to 29): the editor opened a `.tvf` from draw as a lake, bunker, green,
  planter or path, and saved one back out. Taken out on Oct 29 ("1,2,47", 2 being the file import and export) with the
  holes' `.golf` files; holes travel as `?hole=` links and are kept in My holes.
- **Planters** (Oct 11: "#6", from "what else can we do with tvf?": "Closed curved walls. Rock islands or planters of any
  outline that the ball banks off, like a curved fence closed into a loop. Kidney-shaped or star-shaped obstacles"):
  `planter [x0, y0, …]`, 3–32 leaves in cells, a closed TVF curve through its leaves (`planterOf`, a lake's line by another
  name). It is walled along its line in the hole's material (`planterWall_` pieces, solid even in wood) and planted inside:
  the ground's drawing raises the inside by `PLANTER_RISE` in hedge green (`HEDGE`, `inPlanter`; the far boards and the icon
  show it too). Physics is untouched underneath.
  - The ball meets the nearest point of the line from outside, as a curved fence's (`blobNear`, the shapes' grid); a ball
    that ever lands inside is put back out over the nearest point. `cellBlocked` treats a cell whose middle is inside as a
    wall, so the players go round. `plantersOf` keeps a hole's lines on the compiled hole.
  - Editor: the Planter tool (🪴): a drag draws the outline, a tap lays a kidney (`planterLeaves`: round, kidney or a
    five-lobed star). It stays selected; its leaves drag, are added and taken away; the line or the inside moves it whole.
    - Generated holes: laid after the weave, asked for at 35–65% by level (a second at 4–5) and kept only where one fits, so
    15% of level-1 holes to 36% at level 3 have one (about a quarter in all). Stars are 0.95–1.15 across, kidneys 0.7–1,
    rounds 0.6–0.9 (a star's lobes rounder than a wall piece, a third of a cell, is long). Every point of its line is on dry
    ground, 2.7 cells off the tee and the cup (the guards' room), off water, 1.6 off a bridge, 1.4 off a wall (one in a
    wall's gap all but shut it), and clear of every thing and track already on the hole (`toyPoints`, each thing's
    footprint). Laid before the weave, the tracks curled up by the cup to keep off it, and a cup with things about it is only
    kept by the ground, so ponds, snails and S-bends came a third as often at level 5.
  - A planter gives way to a guard that would stand on it, and to a pond, an S-bend or a snail entirely (they reach about
    three cells out and are hard enough alone). Guard shapes and curved guards keep off planters (`offPl`); a screen keeps
    1.5 cells off one; a planter so near the tee-cup line that a ball rolling straight would clip it counts as crossing it.
    A screen may be a kidney planter across the way in, bowed toward the tee, if it clears every track and thing.
  - Rated with and without theirs, 50 holes of every level took 0.13 strokes more with, 11 at level 5 0.36 more, so the
    guess counts a quarter of a stroke a planter (`PLANTER_GUESS`).
- **Curved ridges, gullies and ramps** (Oct 11: "proceed on 5", from "what else can we do with tvf?": ridges, gullies and
  ramps that follow a drawn curve): ground pieces `crest [x0, y0, …, xn, yn, width, height]`, a ridge along the line (a gully
  when the height is below nothing), and `incline [same]`, a ramp that rises evenly along the line from nothing at its first
  leaf to its height at its last and drops away just past it. 3–24 leaves in cells, kept within [-1, NX + 1] × [-1, NY + 1];
  width 0.4–3; height in `LINE_HEIGHT` (crest −0.05 to 0.08, incline 0 to 0.08). `LINE_KINDS` lists both.
  - The line is a curved fence's (`curveOf` through every leaf). `lineOf` keeps it by array with its length so far at every
    point; `lineNear(C, x, y, max)` finds the nearest point within a reach on a grid of boxes like the shapes' (`lineGrid`).
  - `rawH`: a crest is the straight ridge's bell across its line, rounded off past its ends. An incline rises with the
    distance along (s / L), smoothed over `EDGE` at its sides.
  - Editor: Ridge (⛰️), Gully (🏞️) and Curved ramp (📐; not "Ramp", whose straight tile went on Oct 10). A drag draws the line
    (a leaf about every cell, 3–16); a tap lays an arc of five. It stays selected, and its leaves drag, are added and taken
    away as a curved fence's are. A press on the ground near the line moves it whole.
  - The menu has Higher and Lower whenever ground with a height is selected (a crest's height moves by 0.01). Harder and
    Easier scale them too.
  - Generated holes: two in three ridges and gullies are crests (bowed once or snaking, `bentLeaves`), and two in five ramps
    are inclines. In 300 holes that came to 37 curved ridges, 25 gullies and 15 curved ramps.
    - One berm guard in two curls about the cup: its ends sit a cell nearer the cup than its middle. One screen berm in two
      bows toward the tee. `across` counts a crest of 0.035 or more within half its width of the tee-cup line.
    - The course keeps its straight ones.
  - Rated against the same holes with each curve straightened between its ends, 27 holes took 0.29 strokes fewer with the
    curves. That is within the noise, so the guess counts them by height, as it does the straight kinds.
  - **The tap that ends a drag** (found here): on a phone the field hands a finger to the editor after about 10 px but
    still calls a press that went under 16 px a tap, so a short drag of a gully's leaf bent it and then added a leaf where
    the finger had pressed. A drag that changed something now keeps that one tap (`ED.ateTap`: at the press point, at once).
- **Smoother and Rougher** (Oct 11: "proceed on 2", from "what else can we do with tvf?": "Smoother takes the fine wiggles
  out of a lake's or bunker's outline and keeps its overall form; Rougher adds some back"). With a closed curve selected (a
  lake, bunker, green, planter or path), the quick buttons ◯ and ✺ and the menu's Smoother and Rougher work on its outline
  (`editAction('smoother' | 'rougher')`, `reshaped`).
  - The leaves' discrete Fourier transform (x + iy, leaf by leaf; `leafWaves`, `wavesLeaves`) is the outline as waves: the
    0th is its place, the ±1st its ellipse, each further one a wave going round that many times. Both keep the place and the
    ellipse, and the leaves stay as many.
  - Smoother shrinks the ±h-th wave by `ROUGH.smooth`^(h − 1) (0.75), so the finest go first. Rougher makes every wave
    `ROUGH.rough` (1.5) times as big, and lays one where a wave is fainter than a floor (0.035 of the ellipse's size at the
    2nd, less for finer ones, up to the 6th), its phase seeded by the leaves, so a round lake gets coves and the same shape
    always comes out the same.
  - Neither may cross the line over itself (`crossesItself`) or bring a planter or path to the rail. A step that would is
    halved, up to three times; if it still would, nothing changes and the message says so. `wiggleOf` measures it (the
    waves beyond the ellipse against the ellipse) for the tests.
  - A tap in the editor refreshes the quick buttons (`bbRefreshNow`) at once, since they follow the selection and the row
    otherwise catches up only on a later frame.
- **A roll stops after `ROLL_MAX`** (15 s, Oct 11). A bumper kicks a ball out at a speed of its own, so a slope that runs back
  down into one (a curved ridge's flank by a power bumper) kept a ball going for ever, and neither a person nor the players
  could take the next shot. Shots stop in a few seconds. Of the four unplayable level-5 holes found while checking curves,
  this fixed three, one of them without curves.
- **Movers keep apart** (Oct 11: "the objects respect the golfball, but not each other. Objecs float into each other, where
  the golfball bounce away", then "Keep them apart" of the two ways offered; the other was making them bounce). Movers still
  go where the clock says (any moment of a hole can be shown at once, which the plain player and the boards no one plays
  need); the clock is arranged so they never meet. `keepApart(src, mode, tiers)` on a hole as written:
  - Units (`kaUnits`): a path's riders (a train on one loop at one speed is one unit), a turnstile, a door, a windmill, a
    gate. Each is tabled as its shape at `KA.Q` (256) fractions of its turn (`kaTable`), with its sweep and its fastest part's
    speed. A door has a 7th number and a windmill a 5th: its phase (cleanSrc keeps them).
  - A train whose riders would meet on their own loop (a figure of eight, an even train) is spaced off those offsets
    (`kaTrain`), or loses riders.
  - A thing standing still on a sweep (`kaStatics`: bumpers, boulders, fences, curved fences, planters, pipe mouths, charges,
    mines) gives way, or the mover does, the less needed (tiers: loose 1, weave and planters 2, screen 3, guard 4, the course's
    own 5, never dropped; a piece on a track with two riders or more gives way to it); in the editor it is ringed red.
  - **Fixed timing** (Oct 29: "1,2,47", 4 being "fixed timing for the movers"): every period is the nearest of `KA.beat`
    (1.7 s) × 1, 1½, 2, 3, 4, 6 or 8; movers that reach one another take, of those lengths, one at a simple ratio to the first
    of them (`KA.ratios`: ¼ to 4; in the editor the one in hand leads), nearest their own first, so a pair comes round together
    within a few turns and every period is saved exact to the millisecond (a third of a length, 4.5333 s saved as 4.533,
    drifted into a meeting within an hour). The most needed and the longest
    trains first, each takes the first of 48 phases at which it never comes within `KA.gap` (0.08 cell) of one placed before
    it over that cycle (`kaClear`). Failing that, a train goes a rider shorter; then the unit goes ('gen'), or is marked.
    Until Oct 29 the beat was searched for on every hole, a stuck thing nudged off a track,
    and the editor had Keep movers apart in its menu.
  - Modes: 'gen' (a generated hole: `genSrc` keeps apart each attempt near its band and guesses it again; the hole keeps
    `apart` {dropped, meets, why}), 'course' (at load, after the guards: rider sizes allowed 12% for Expert) and 'time' (the
    editor, on every change: timing only; things that still meet are ringed red, `ED.meets`). The editor's Faster, Slower,
    Harder and Easier step a period to the next fixed one (`kaStep`, `stepMovers`), since a smaller change lands back on it.
  - Measured (Oct 29): nothing meets on the course or 300 generated holes, 30 s from the start and an hour on; 633 riders on
    those 300 holes against 635 with the beat searched for, and the levels' guesses 2.44, 2.86, 3.33, 4.21, 4.88 against 2.44,
    2.86, 3.32, 4.19, 4.89.
- **The best line and its ghost** (Oct 11 to 29): the hole in play was recorded, its best line kept and raced as a pale ball,
  watched and shared as `?line=` links. Taken out on Oct 29 ("1,2,47", 1 being the ghost and the line links).
- **Leaves added and taken away** (Oct 10: "6,4,2,3", 3): with a path or a curved fence selected (Select), a tap on its
  line puts a leaf there, between the two it falls between. Two taps on a leaf within half a second take it away (three
  is the fewest). "On a leaf" means within a fingertip but no more than a third of the way to the next leaf (`ED.leafTap`).
- **The hole editor** (Oct 8, in mini golf's menu: Edit this hole, New hole, My holes)
  puts its tools in the bottom panel. **The row is the editor** (Oct 10: "remove the game mode"): opening mini golf's
  bottom row (the dots) starts the editor on the selected hole, shutting it leaves the editor, and leaving the editor any
  other way shuts the row (`onBrowserToggle`, the field asks an app before the row moves; `paneTo` moves it without
  asking; `editStop` shuts it only after `ED.on` is false). The row never shows the round's numbers or playing buttons;
  `statTiles` gives the editor's tiles whenever the editor is on. `bbRefreshNow` (field) rebuilds the row and its quick
  buttons at once, since an idle view draws no frames to do it. while editing, `statTiles` gives the editor's tiles
  and a tap on a tile reaches the app's `onStatTap` (the field offers stat-tile taps to any
  app that has it); `statsStay` keeps the row up while the hole is painted. It edits a hole as written, in cells (`ED.src`); the course's own holes are kept as
  written in `HOLE_SRC` and compiled by `compileHole`. Editor holes come after the
  course's in `HOLES` (index `BUILT` and on), are rebuilt after each stroke (`setHole`,
  which drops the old meshes with the field's `fieldDropItemKind`), and are played as
  rounds of one (`R.single`). Saved holes live in localStorage (`golf.myholes`); a link
  `?app=minigolf&hole=…` carries one (base64 JSON). Anything from a link or storage
  goes through `cleanSrc` (map letters, one tee and cup, known kinds, numbers in range).
  **My holes in the menu** (Oct 10: "ive got 50 items in the menu"): one item, My holes (N)…, opens a list
  (`openMineBox`, `#golfMineBox`: Play and Delete a row, Delete all, Close; Escape closes it).
  Exact copies in storage are merged as the page loads. A copy of a course or generated hole carries `from` (a
  short hash of the hole as written, `originOf`, kept by `cleanSrc`), and editing that hole again reopens the copy.
  A hole keeps the board it was made on (`at: [c, r]`, set by `editStart`); the list's Play flies there (`goMine`,
  the field's `gotoCell`) and plays it. One with no board yet takes the selected board, or the corner's, and keeps it.
  (Holes as `.golf` text files, Oct 10 to 29, went with the file import and export.)
  Check runs the course test's plain player in the page (`solveHole`) and sets par.
  Its ground tools: Plateau (drag a box), Ramp and Half-pipe (drag a line) (Hill and Hollow were taken out on Oct 9),
  Bowl, and Select (`nearestLand`, `moveLand`) with Higher, Lower, Delete and Level. The
  editor's Bowl and Half-pipe are sunk into the ground (`dish`, `trough`, Oct 9), at most
  BASE deep; the skate holes' `bowl` and `pipe` keep the ground beyond their lip at the lip's
  height, which raised a whole board when dropped on an ordinary hole. A tap on another board while
  editing moves the editor there, the tool kept (`onCellTap`); the next tap paints.
  Every change is saved to My holes as it is drawn (`keepMine`, Oct 9); a hole only looked at
  is not. The movers are tools too: Path (draw a loop, or tap for a round one) and Gate (drag a
  track), each placed at a default size by a tap (Shuttle and Orbit went on Oct 10). Undo has Redo (`ED.redo`).
  **The path** (Oct 10: "drawing the orbits in place and moving the leaves would be best"): a mover riding a closed
  loop of its own shape, as a shape in draw.html rides its motion orbit. `path [x0, y0, …, xn, yn, r, seconds, phase
  (fraction), rider (see Riders)]`, 3–64 leaves in cells. **A path is a TVF curve** (Oct 10: "games project should
  take advantage of tvf"): its xs and ys are a closed `.tvf` curve's two rows, leaves at φ = (k + ½)·2π/N, and the loop
  is draw's own reconstruction through them (`TVF_CURVE.core.reconstruct` in `loopOf`, cached by array, so a changed
  path is a new array), ridden at an even speed (`loopAt`, `toyAt`); a drawn loop is laid down by draw's
  `arcLengthResample`.
  The Path tile: a drag draws the loop in place (`ED.drag.pts`, laid down as 5–16 leaves evenly along it in
  `editDragEnd`), a tap lays a round loop of eight; the path stays selected (`placedOnce` keeps it), its leaves drawn
  large in gold, and a press on a leaf of the selected path drags that leaf alone (`dragPick`, `ED.grab.leaf`); a press
  elsewhere on it moves the whole loop (`shifted` moves every leaf).
  **Riders** (Oct 10: "clicking inside the shape would move to the next object"): an orbit's 7th number and a path's
  last are its rider, 0 a boulder, 1 a bumper, 2 power, 3 sponge, 4 spinner (a bumper rider acts as that kind of
  standing bumper: `bump`, shared with `kick` and `shuttle`). With Select, a tap inside an orbit's circle or a path's
  loop, clear of its track and of other things (`loopInside`, the innermost), moves its rider on and selects it.
  A row of stat tiles is as wide as its widest words (`bbStatWidth`, at most 150px).
  **The tiles** (Oct 10): no top line (a stat tile with no `label` centres its glyph and name); the tool
  in hand is lit by the tile's `bg`; a tap takes a tool up or puts it down. The tools: the two paints (Wall,
  Bridge; Grass, Sand and Water went on Oct 11), the bumpers, Boulder, Fence, Curved fence, Planter, Windmill, Pipe, the movers (Path among them), Turnstile, Door, Plateau, Erase; the acts:
  Level, Material (named by the material). **Undo, Redo, Copy, Paste and Delete are in mini golf's menu** while editing
  (Oct 10, later: "remove copy,paste,delete,undo,redo from the bottom object browser"). With a thing or a piece of
  ground selected (`selObj`) Copy keeps that one, Paste lays a copy of it on the hole (half a cell along if one is
  already there) and selects it, Delete takes it away; with nothing selected they act on the whole board: Copy keeps
  the hole as written, Paste lays it over the hole being edited (its name kept), Delete clears it to a new hole's.
  The clipboard is `CLIP` ({board} | {toy} | {land}, and localStorage `golf.clip`); a menu item may be `disabled`. The delete-object tile and the text-only
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
- **The photo gallery reads in order** (Oct 16: "photo gallery: pdf and cbz are not loading in correct order"): print i of a
  collection of N (pictures, a PDF's pages, a comic archive's) hangs where −(row + col) mod N = i (`pick`), page 1 on the
  corner, the next page one board right and one board down. A board's column and row are first taken as a signed distance
  from the corner (`_side`: the field wraps at GS = 10,000, so the board right of the corner is numbered 9,999 and is read as
  −1). Folding the wrapped number straight onto N broke the order at the corner for any N that does not divide 10,000: a
  12-page comic had page 10 beside page 1 and its row above read 10, 11, 12, 9, 10. `vpick` (which crop) folds the same way.
  The one seam left is half the field away. The smoke test checks the order across the corner for 5, 12, 37 and 150 pages
  (`GALLERY_APP._pick`).
- **Books: an EPUB reader** (Oct 16: "Could you add an epub reader"): a `.epub` opened, dropped or in a bucket hangs one page
  a board in the photo gallery, as a PDF does (`EPUB`, `_loadEpub`, after `_loadPdf`). A book has no pages of its own, so it is
  laid out here, once, before the pour is told the count: onto 2:3 pages (`PAGE_W` × `PAGE_H`, 640 × 960), Georgia at 20, words
  measured with the canvas's `measureText` (kept by word), broken greedily and justified (ragged where a gap would pass 0.9 em),
  paragraphs indented but the first after a heading, headings centred and kept with two lines, every chapter on a fresh page, a
  chapter that is one picture alone on its page edge to edge (a cover; a cover named only in the package goes in front), other
  pictures fitted to the column, a page number at the foot. The book's CSS is not read; tables become lines; CJK breaks
  anywhere. `open` reads `META-INF/container.xml`, the package's spine (linear="no" left out but at the front), chapters through
  the XHTML parser and, if not well-formed, the HTML one, and picture sizes from their headers; a book whose chapters are
  encrypted (DRM) is refused. `paint` draws a page at `_pdfPx`; pictures are decoded as pages want them (the latest
  `EPUB_PICS`, 8). Reads from the zip go 32 at a time (`many`): one after another, each waited behind a frame, and Pride and
  Prejudice (605 pages, 164 pictures) took 53 s to open in the sandbox; together, 4.7 s (Alice, 130 pages: 11 s, then 2.8 s).
  Laying out is 34 ms for Alice, 150 ms for Pride and Prejudice. The canvas spells a font back its own way, so the font last set
  is kept by hand (`mfont`), or it is parsed again for every word. An epub's type, application/epub+zip, matched the archives' `/zip/` and opened as its pictures alone; it is
  taken out first. The smoke test builds a book (a stored zip it writes itself) and opens it through the real picker:
  `GALLERY_APP._epub` has the pages and `EPUB.textOf`.
  - **The row is the book's settings** (Oct 17: "the epub reader should use the bottom browser for settings such as font size
    and font and color and background color, similar to how the games do it"): while a book hangs (`BOOK`, `bookLive`: its
    collection still `GALLERY_APP._gen`) the gallery's `statTiles` give Smaller, the size, Larger (`SIZES` 14–32), the four faces
    (`FONTS`: Serif, Sans, Book, Mono, the one in use lit) and Text and Page (`INKS`, `PAPERS`, each tile stepping to the next,
    its swatch the colour). A new app hook, `statsFirst`, gives an app's tiles the row over the gallery's thumbnails without
    holding it open as an editor's `statsStay` does. A face or a size lays the book out again (`EPUB.set` says so; `laidAs`)
    and hangs it afresh (`_hangBook`, the pour declared again), and the view goes to the page whose words began where the
    framed page's did (a page's `at`, pieces of words before it). A colour only paints the pages again. A page colour the
    text would not read on (dark ink on Night) takes the first ink that does. Kept in localStorage `epub.style`.
  - **A book opened with other files keeps them** (Oct 17, "proceed on fixes"): a change hung the book again alone and the
    pictures and comics dropped beside it went. The drop a book came in with is kept (`_bookDrop`, set in `_loadFiles`); a
    change opens that drop again in the new settings, and `BOOK_GO` takes the view to the book's page holding the words it
    was on (`goToWords`) once the book hangs. A book alone, or from a bucket, is hung again on its own as before.
- **JSON files as pages** (Oct 25: "what about a json file viewer", then "Pages, like the EPUB reader" and, for sources, "Open or
  drop a file" and "Flare buckets"): a `.json`, `.jsonl`, `.ndjson` or `.geojson` opened, dropped or in a bucket hangs one page a
  board in the photo gallery, laid out as a book is (`JSONV`, `_loadJson`, `_hangJson`, after `_loadEpub`), on the book's 2:3
  pages (640 × 960).
  - The pages are the document printed as `JSON.stringify(v, null, 2)` prints it (the smoke test checks they are the same lines),
    in a monospaced face measured once (`advance`), every token its colour (keys, strings, numbers, true/false/null, punctuation),
    numbered in a gutter. A long line wraps two spaces past its indent (a token that fits a fresh row starts one; a long string
    is broken where the row ends), and an indent never takes more than half the row. Each page's head says the file and the
    path its first line is at (`$.users[3].name`); its foot `n / N`.
  - **Depth** (`linesOf`): a container nested deeper than the depth is one line, `{ … 4 keys }`. The depth asked (1–6, 8, All)
    is used if the file fits `LINE_CAP` (50,000 lines); else the deepest that fits, said at the top of the first page; one too
    long even one level deep is cut there, said too (`fit`). Files over `MAX_BYTES` (128 MB) are refused.
  - **Not JSON** (`parse`): tried as JSON Lines (two or more non-empty lines, each parsing: one array, said at the top); else
    the first page says why and the text follows, numbered, the line it broke on marked in red. Chromium's message gives no
    offset any more, so `faultAt` scans JSON's grammar for the first character that cannot be where it is.
  - **The row is its settings** while it hangs (as a book's): Smaller, the size (10–22, `SIZES`), Larger, Shallower, the depth
    (with the depth shown in brackets when `fit` lowered it), Deeper, and Colours (Light, Sepia, Dark, `THEMES`); kept in
    localStorage `json.style`. The gallery's `statTiles`, `statsFirst` and `onStatTap` are wrapped: the JSON's row while one
    hangs (`jsonLive`), else the book's. A size or a depth lays it out again and keeps the place by path (`goToPath`: the
    framed page's first path, or after a depth change the deepest line on its way still standing); a colour paints again. A
    file opened with others keeps the drop (`_jsonDrop`, `JSON_GO`), as a book does.
  - **Buckets**: a `.json` that resolves to no image slices (a tensor gallery among them) and every `.jsonl`, `.ndjson` and
    `.geojson` is data (`datas`); a bucket with no pictures, archive, PDF or book opens the first in the viewer instead of
    saying it has no images.
  - **Taken by its type only when its name says nothing else** (found by CI on the flash cards' PR): a mini golf `.golf` is
    JSON, and opened as application/json it went to the viewer as well, the page left mini golf, and the smoke test's hole
    editor failed on every run since the viewer came. A name ending `.golf`, `.tvf`, `.tvf3d`, `.csv`, `.tsv`, `.txt`, `.pgn`
    or `.fen` (`_ownExt`) is never taken by its type.
  - **A JSON file is never a deck's lines, and loose pictures never join it** (found by CI on the same PR): `_loadFiles` asks the
    flash cards of every JSON file first, and `deckOfText` read any name but `.json` as lines of cards, so a `.jsonl` became a deck
    of its comma-split lines; now only `.csv`, `.tsv` and `.txt` are read as lines, anything else as a JSON deck or nothing. And
    loose pictures dropped while a book or JSON file hangs start a collection of their own (`docHangs`): joined, the document's
    settings row stayed up over them.
  - The smoke test opens a file through the real picker (pages, lines, numbers, a path head, a wrap), a real click on Larger
    keeping the place, a real click on Shallower and taps to depth 2 folding the 120 records, Colours painting sepia, a broken
    file marked on its line, and JSON Lines read as one array. `GALLERY_APP._json` and `_jsonRow` are for it.
- **Markdown files as a book** (Oct 25: "would it be hard to add an application that read md files", then "yes, add the markdown
  reader"): a `.md` (`.markdown`, `.mdown`, `.mkd`, or typed text/markdown) opened, dropped or in a bucket is written out as HTML by
  the page's own converter (`MD.toHtml`) and read as a book's chapters (`EPUB.fromHtml`, the book reader's `blocksOf` and
  `layout`), so it hangs one 2:3 page a board with the book's settings row, its place kept when they change (`BOOK`, `bookSet`,
  `_bookDrop`), all as an EPUB does (`_loadMarkdown`, after `_loadEpub`).
  - It reads ATX and underlined headings, paragraphs (lazy lines, hard breaks), bold, italics, strikethrough, inline and fenced or
    indented code, block quotes, nested lists, numbered lists from any start, task boxes (☐ ☑ in place of the bullet), rules,
    links (inline, by reference, autolinks: the words shown), GitHub tables (set out as columns in the monospaced face, the head
    in bold), images, a front matter's `title`, and HTML written in (parsed into a document of its own, as a book's is).
  - Laid out `flat`, as a document (`blocksOf(…, opts)`, a block's `flat`): headings to the left, paragraphs spaced apart rather
    than indented, code on a faint box and quotes with a bar down their left (a page's `shades`, painted under the words). Books
    are laid out as before.
  - A chapter at each heading of the top level used, when there are two or more of them. The title is the front matter's, else
    the first `#` heading's, else the file's name.
  - **Chapters seen from far off** (Oct 25: "this reader is different, more for dramatic flare, iteresting to see thousands of
    pages sweeping into the horizon", then "yes" to chapters coloured and headings as landmarks): in a document of two or more
    chapters each chapter's paper takes `TINT` (0.13) of a hue of its own (`hueOf`: the golden angle round the wheel, so
    neighbours never match; a page's `tint` is its chapter), and each chapter's first heading of the top level (`book.top`) is set
    `TITLE_K` (1.9) times the largest heading's size on a band of that hue (`BAND` 0.4) across the page's top (a `shades` entry of
    kind `band`). Zoomed out, the pages lie across the field as diagonal bands of colour with each chapter's opening as a marker.
    The code's shade follows a tinted page. Books (`flat` off) keep their paper.
  - Pictures (`_mdPictures`): found among the files it came with, by path and then by name alone, or a data: URI; each given a
    key of its own. Those found are on their pages and not hung again as pictures (`_loadFiles` reads the file first and takes
    them out of the loose list). One not found, or on the web, is a line in italics with its alt text.
  - Buckets: the first `.md` by name is opened when the bucket has no archive, PDF or book, and either no pictures or pictures
    the file names (fetched as its pages ask).
  - The smoke test opens a `.md` and a picture through the real picker (the title, two chapters, the words in order, the picture
    placed once, a missing one in words, code and quote blocks, the code's shade painted) and a real click on Larger laying it
    out again. `GALLERY_APP._md` is the converter, `_epub.md` says the book is one.
- **A double tap brings a board in** (Oct 16: "double click should select the board and move it into the default position,
  unless the game has a good reason not to."): a double tap (two taps on one spot within `DOUBLE_TAP_MS`, 400) selects the
  board and frames it as the 0 key does (`gotoCell`, `zoomBoardToFit`, the heading back to forward) in every game.
  - An app's `noDoubleTap()` (mini golf's editor; Simon, Lights Out, Whack-a-mole and Nonograms while a board is in play) is
    heard only when the pair's first tap was on the board already framed (`_lastTapSelected`): two quick taps there are two
    moves. A pair that began by selecting another board is always the field's, since that first tap made the new board the
    framed one and the game was being asked about it (Lights Out and Nonograms say yes on any board not solved, so a double
    on another board never came in).
  - The pair is timed by the taps' own event times (`ev.timeStamp`, `tapIsDouble(hit, at)`), not when they were handled: a
    heavy frame held the second back past the window (tower defense after snake, in the sandbox).
  - **A touch is timed by its own event** (Oct 17): the touchend went to `turnEnd` without its event, so a touch's double was
    timed by when it was handled; selecting a board in tower defense builds its game, and on CI (or a slow phone) the second
    tap came a second late and the pair was two taps. `turnEnd(e)` now passes it on. The smoke test makes both taps' events
    before sending either, since a synthetic event's time is when it is made.
  - **Off its default position, a double tap always puts it back** (Oct 28: "If a board is not in the default position than let
    double click put it in the default position."): `noDoubleTap()` is heard only while the framed board stands where a double
    tap would put it (`framedAsDefault`: settled at the page-load fit, heading forward, the same sums as `frameBoard`; a flight
    under way counts as there). An editor's answer is `'always'` (mini golf's, the tilt maze's, pinball's, bowling's, Soma's, trick
    shots'): it is worked zoomed in, and its quick second taps are its own wherever the view is. The games that take every press before the field (`MATCH_KIT.hands`: Pong, air hockey, squash,
    curling's sweep; pinball's own) ask `pressReframes(e, x, y)` of each press: the second of a double, by the events' own times
    within 40 px, with the board off its default position, puts it back (`reframeDefault`) and is not the game's. The smoke test
    (part 7) zooms Lights Out, Pong and pinball off with the real wheel, a game under way, and a real double tap brings each back.
  - **A single tap never selects a board** (Oct 29: "double click selects a centers board, not a single click. don't select a board
    with only one tap."): a tap on a board you are not on did nothing but select it in place (Sep 23: the view stays) and join it
    to the strip, and in an app with `firstTapPlays` (mini golf) tee off on it. Now it does nothing at all (`handleGroundTap`
    returns after the framed-board guard; `selectCellInPlace` went). Only a double tap goes to another board, selecting it and
    framing it as the 0 key does (Oct 29: "double clicking a board does not center the board properly": the heading is set before the framing, which is worked out for the heading it arrives at; after, a board double-tapped at an angle ended 215 px off the middle), with Tab, Enter, the game index and a strip tile; a tap on the board you are on is the game's
    as ever. So every note above that says a tap on another board selects it, or tees off on it, or moves the editor there, now
    means a double tap, and then a tap. The smoke test's "first tap tees off" checks a single click leaving the view and the hole
    alone, a double click bringing it in, and the first click then teeing off.
  - Air raid keeps its taps while its plane flies (`worldTap`: they drop bombs). The smoke test double-taps a neighbour in ten
    games with a game under way and wants the view where the 0 key puts it.
- **The dots, full screen, Tab from the board in view** (Oct 17: "1) the three dots on the bottom for the bottom panel should be
  2px larger and have a shadow. 2) add full screen option to the menu. 3) tab and enter should move to next board, from the
  current visible board that is in the default position."):
  - The bottom row's dots (`#bbHandle`) are 6px across (viewBox 30 × 8, r 3), with a drop shadow.
  - **A ring round them** (Oct 28: "the three dots on the bottom should be surrouned by a larger circle that eccompasses them to
    make them easier to see."): a dark translucent disc 44px across behind the dots (`#bbHandle::before`, under them, so a press
    anywhere in it is still the button's), its rim white while the row is shut and gold while it is open or hovered, as the dots are.
  - The menu's Full screen (`#bFullScreen`, after Application…) puts the whole page in full screen and back; its label follows
    the state (Escape leaves too); hidden where the browser can't (an iPhone's Safari).
  - Tab and Enter (`stepRight`) step right from the board in view (`viewBoardCell`: `frameSelectedBoardAt` and `frameBoard`'s
    sums run backwards from where the eye stands), not from the board selected before a pan; while the view is where its framing
    put it, or still flying there, from the selected board as before. Games that use Enter themselves (the arcade games, golf's
    putt, Simon's start) keep it; Tab always steps. The smoke test slides the view two boards along in the gallery and checkers.
- **The dots shut the row, and a hold toggles it** (Oct 23: "I can't close the bottom panel by tapping the dots.     long press the
  display should toggle the visiblibility of the bottom panel."):
  - A row an app holds up while you play (`statsStay`: trick shots, the tanks) was put straight back after the dots
    shut it (`bbStatTick`). A row shut by hand (`bbOverride` false) now stays shut; every opening, an editor's too, sets it true.
  - A long press and let go toggles the row in every game. An app's own hold (`onCellHold`) is asked only where it is a move in
    play (`holdIsMove`: Minesweeper's flag, Pipes' and Loops' turn back, Nonograms' cross, Sokoban's undo, Air raid's bomb), and
    so is a right click. Elsewhere a hold used to start the board again, and the notes above that say "a hold starts it again"
    are out of date: the menu's Reset does that.
  - The smoke test clicks the real dots in trick shots and wants the row to stay shut, long-presses the table twice and wants it
    open, then shut, wants a hold in Simon to flip the field's switch (`window.tvf.bottomRow.visible`), and in Minesweeper a hold
    on a covered square to flag it with the switch left alone, and one off the board to flip it.
  - **Always** (Oct 25: "Long press is always toggle of bottom browser"): no app's hold is asked any more, not even a move's. A right
    click still reaches `onCellHold` where `holdIsMove` says it is a move. What a phone lost has a way of its own: Sokoban's menu
    Undo a step (Z on the keys); the pipe games turn by taps, Nonograms has its cross mode and Air raid drops a bomb on a tap on
    yourself. Minesweeper keeps its hold (Oct 25, later: "minesweeper should restore the long press, its fundemental to its game
    play."): an app with `holdKeeps` is asked first, and a hold it takes (a covered square in a game under way) flags it; a hold
    anywhere else is the row's. Its menu's Taps: dig / flag (F on the keys, localStorage `minesweeper.taps`) stays too.
- **A hold is decided a frame late** (Oct 29, found by the smoke test's bejeweled drag): the browser holds a finger's moves until
  just before the next frame, so on a slow page the 600 ms long-press timer (`LONG_PRESS_MS`) ran out with the first move still
  waiting, the press was taken back from the game as a hold and the drag went nowhere (3 page loads in 6 here). When the time is
  up the hold now waits one frame (`_holdTok`, a `requestAnimationFrame`): a hand that has started moving clears the timer first
  (`turnMove`), as it would have before the time was up.
- **Games play with the row shut** (Oct 28: "you should not need to have the bottom browser open to play games. that is only
  for advanced users.", then "Mostly getstures, but some buttons if needed."):
  - **The row never opens by itself.** `bbStatTick` opened it when a game's numbers first appeared (Sep 30), and put back a row a
    game held up (`statsStay`) after anything but a hand shut it. Both went. Only the dots, the menu and an editor's own opening
    (EDIT_KIT's `pane`, chess's, golf's `paneTo`) open it; the tilt maze's, Sokoban's and tower defense's menu items now open
    their pane themselves. `statsStay` still keeps an open row up.
  - **Gestures** where a game needed the row: bowling (a press on the ball dragged along the foul line is where you stand; swiped
    up the lane and let go it bowls, the swipe's speed the ball's, its bow the hook: `swipeOf`), curling (a drag of your stone up
    the sheet sets the weight to come to rest about there, `weightAt`; a tap on a stone aims at it with a hit's weight; a
    two-finger twist turns the curl, `onTwist`) and marble run (until a piece is picked in the row, `g.chosen`, a tap lays the
    stock's piece that fits best, `bestFits`, a tap again steps through the other ways and pieces that join, then takes it back,
    `tapAuto`; a tap on the chute or the cup runs it).
  - **The play pad** (`#playPad`, `playPadTick`): an app's `playActs(c, r)` gives round buttons ([{ key, glyph, label, title, on
    }]) shown on the right above the bottom band while it is played, whether or not the row is open; a press reaches
    `onPlayAct(c, r, key)`. Used only where no gesture would do: 3D Tetris (spin the other way, tip, roll), Soma (spin, tip, roll,
    the next piece from the tray), the tanks (the shell in hand, a tap for the next; drive either way) and curling (the curl, beside the twist).
  - The smoke test (part 7, "played with the row shut") checks the row staying shut through a game and each of these by real
    input; the checks that click row tiles in 3D Tetris and Soma open the row first, as an advanced user would.
- **Boards coloured by difficulty** (Oct 29: "boards should be colored by difficulty. so when I'm panning board of an application, I can
  know how difficult the board is by color. the background of the board should show the difficulty of the board, so when I'm panning
  the horizen, I can pan towards colors that match my desired difficulty."): the field paints a board's level, green, blue, yellow,
  orange, red for 1 to 5 (`DIFF_COL`, light pastels since "the difficulty colors are to strong, make them lighter shades"), in every game that has levels (48 of 56 apps: not chess, Go, 2048, Queens, Air raid, flash
  cards, Levels, the gallery). A level is a function of the ring (the larger of the board's two wrapped distances from the corner),
  so the field asks the app (`difficultyAt(c, r)`, mini golf's; else `_debug.levelOf(c, r)`; else `_debug.levelAt(boardIdx)`: the tilt
  maze, pinball, Sokoban, the game lab; a 'easy' / 'normal' / 'hard' game counts as 1, 3, 5) along row 0 and finds where it steps
  (`diffRefresh`: 27 rings probed, the steps found by halving, redone when the setting changes, every 20 frames at most), so
  `window.__diff` has `thr` (the rings at which the level steps) and `val` (the levels). Near, each board has a mat the colour of its
  level (`DIFF_GAP` 50% toward it from the ground's) under the whole cell, showing in the gutters, and where the app paints squares (`cellGrid`)
  they are mixed `DIFF_K` (0.18) toward it; a game that hangs a picture (the photo tier) has the mat alone. Far, the fabric's shader
  does the same from the ring of the cell it is over (`uSnapCell`, `uDiffThr`, `uDiffCol`, `vCell`), the gutter fully and the board
  `DIFF_K`, so a board does not change colour at the handoff. The smoke test (part 7) checks the steps for Lights Out and mini golf,
  none for chess, and the fabric given them.
- **Only you move to another board** (Oct 29: "Often times boards auto move to another board. They should never do that. Only
  the user can move to a new board."): no game flies the view anywhere by itself any more.
  - A tap on a finished board plays it again where it is (the app's own `onReset`, as the menu's Reset), in the seventeen games
    whose tap went on to the board beside: 3D Tetris and Soma (puzzles), Bejeweled, Sokoban, the tilt maze, pinball, Lights Out,
    Whack-a-mole, Nonograms, the tanks, the tank maze, Pong, air hockey, squash, curling, bowling and marble run; trick shots too
    (its menu's Next trick shot still goes on, being asked for). Their messages say "Tap to play it again." Every note above that
    says a tap on a finished board "goes on to the next" is out of date.
  - **Mini golf's round** goes on board after board, but the view stays: when the ball drops, the next hole is laid on the board
    beside (`nextHole`) and the board just played is `'holed'`; the message says the round goes on on the next board along (Tab).
    A tap on the holed board says so once, and a tap again there starts a new round.
  - **Flash cards**: graded, the view stays on the card's board; N or the menu's Next card due flies to the next card.
  - What still moves the view is yours: Tab and Enter, a pan or swipe, a tap or double tap on a board, auto motion (Space), the
    menus' Next items, the game index and My games' Play, Asteroids' ship flown off an edge, the page of a book or JSON file kept
    when you change its settings.
  - The smoke test's checks that wanted a click on a finished board to land on another (Sokoban, the tilt maze, pinball, 3D Tetris,
    Soma, Nonograms, trick shots, Bejeweled) now want the view where it was and the board's game begun again; the flash cards'
    want the view still after grading and the real N to fly to the next card.
- **A double tap resets a completed board** (Nov 1: "double clicking a completed board should reset it."): an app that can say a board's game
  is over has `gameDone(c, r)` (set after the id list from a table of each game's own finished state: 3D Tetris and Soma 'done', Bejeweled
  and marble run 'won', Sokoban `solved`, the tilt maze 'done', Lights Out `done`, Nonograms 'solved', trick shots `ch && solvedIn`, and
  'over' for pinball, Simon, Whack-a-mole, the tanks, Pong, air hockey, squash, curling and bowling; each reads its `_debug.GAMES`, which
  3D Tetris, Soma, Bejeweled and Sokoban now expose). `handleGroundTap` asks it on every tap (`_lastTapDone`): a double on a finished board
  calls the app's `onReset` for it before the field's reframe, and when the pair's first tap landed on a finished board (a tap there
  already plays it again, so by the second the board is new) the second is the field's double and not a first move on the new game.
  Boards in play are untouched by a double, which only reframes as before. The smoke test (part 7, "double tap resets a completed
  board") checks the apps answer, a real double on a board in play leaving its game and on a finished Lights Out board beginning it again.
  **Every game with an end** (Nov 1: "double click is still not reseting the board."): the first cut named seventeen games; every other
  app with its boards' games in `_debug.GAMES` or `_debug.games` and an `onReset` is read by the words its state uses for an end (`ENDS`,
  `ANY`: state over / won / done / solved / lost, or a truthy over / won / done / solved), so Snake, Tetris, 2048, Minesweeper, the
  board games and the rest reset on a double tap too. Chess, Go, Air raid, flash cards, the game lab, Levels and the gallery have none.
  **No notice for a double tap** (Nov 1: "stop showing stupid message boxes. they are rarely needed, telling me I just double clicked is stupid."): the field no longer says "Board locked in place" or "Board unlocked"; the lock shows in the view and the menu item.
  **No game says anything in the notice** (Nov 1: "You add message all over the place. mostly they are stupid and not needed."): `BOARD_KIT.say` returns a function that does nothing, so the games' routine messages ("Tap to play it again", tee and result lines, and the rest of the 45) never show; every note above that says a game "says" something in the notice is out of date. The field's own notices (errors, sign-in, chess, files) are `engineNotice` and stay.
- **The bottom row coasts on physics** (Oct 17: "swipe is broken in bottom browser of the photo gallary, it should use
  physics."): a swipe let go is a body at the finger's speed, slowed in proportion to its speed, read off the clock:
  v(t) = v0·e^(−t/τ), gone v0·τ·(1 − e^(−t/τ)) (`bbMomentum`: `TAU` 325 ms, starts above `START_V` 0.2 px/ms, stops under
  `MIN_V`, at most `MAX_V` 8). A thousand pixels a second carries the row about three tiles. Speeds are pixels, turned into
  the row's angle a frame at a time by `bbDragAngle`. The finger's speed (`bbVelTracker`) is the distance over its last
  100 ms of moves, by the events' own times; a finger still for 80 ms when it lifts has none. Until then the coast was per
  frame (a third of the release speed, 10% off a frame): a hard flick went half a tile and stalled on heavy frames. And a
  rebuild of the same kind of row (pictures or pages arriving) keeps the item in the middle and the coast running
  (`rebuildBoardBrowser`); it used to stop the coast and let the row creep as the count grew. `window.tvf.bottomRow` reads
  the row for the smoke test, which swipes it with timed mouse events.
- **A game opens framed** (Oct 9): `_defaultFitSoon` settles the camera at the default fit at once
  (`settleCameraNow`), so a game no longer glides down from the overview when it opens.
- **Quick buttons** (Oct 9): an app's `quickActs(c, r)` gives small icon buttons (glyph and
  title, no text) in the band at the top right of the bottom pane (`#bbQuick`, `bbQuickTick`);
  a click reaches `onQuickAct(c, r, key)`. Mini golf: Select, Box, Undo, Redo, Erase, Done while editing
  (none while playing: the row is the editor's, Oct 10). The row stops short of the middle and its buttons narrow to fit. They show only while the pane is open; the three dots
  (`#bbHandle`) show on every game, whether or not its row has anything in it.
- **Every board in view, in full, every frame** (Oct 12: "restore full drawing functionaility. no special handeling. only
  thing is dont draw non-visible boards and no animation when panning or resizing."). From Oct 11 ("only the selected board
  needs to be presented perfectly …") boards other than the selected one were asked for their pieces every 3, 6 or 12
  frames by size, at a degraded size, and not at all while half off the screen; all of that went. `buildInstances` walks the
  boards in the view's reach, and `_boardItems` asks every one of them on the screen (`_boardVisible`: its box, from the ground to a
  board's width up and a tenth wider each way, meets the camera's frustum; the camera is the last frame's) every frame at its own size; one off the screen gets nothing. The lists are kept (`_itemCache`) only for
  telling whether a board's pieces changed (the rest), and asked again after another app, a click, a drop, a change or
  `window.fieldItemsChanged()`.
- **Every board plays on while the view moves** (Oct 14: "turn animation back on for chess when the chess board is in
  motion.", then "turn it back on for all games except mini-golf.", whose movers already ran on, and "5", taking the
  machinery out). From Oct 12 ("when panning, no object motion anywhere, turn it off.") to Oct 14 a pan hold (`PANHOLD`,
  `_panCheck`) held every board's pieces and the animation clock (`animTime`) while the camera moved, mini golf and Levels
  let off by `panMoves`. It is gone: `animTime` is the page's clock less pauses and time dilation, and `_boardItems` asks
  every board on the screen every frame, panning or not. The smoke test drags the view in chess and in mini golf and wants
  their clocks running throughout.
- **The field rests when nothing changes** (Oct 11, "proceed" on "Rest when still": the page built and drew every frame with
  the view still). `_restDecide` runs first in `frame`; a frame it skips is not built or drawn (the last one stays on the
  screen), only the light watchers run.
  - Never skipped: while the camera's numbers (and the dial's) differ from the last frame's, a finger or key is down, the
    view glides, or within 0.8 s of any input, an app switch, `bbRefreshNow` or `fieldItemsChanged` (`REST.wakeAt`,
    `window.fieldWake`); and never for an app without pieces of its own (chess), one with `onWorld` or `alwaysAnimate`,
    or while a board still waits for its picture (`_photoHoles`).
  - The framed board is asked for its pieces every frame even so (its game steps there; `_framedPre` passes the list on to
    the build) and any change in it (`_itemsHash`, to a ten-thousandth of the board) means every frame is drawn.
  - Otherwise every frame is drawn while any board's list changed in the last 2.5 s (`REST.change`, set by `_boardItems`;
    a third of them until Oct 12, "no special handeling"), and one in half a second when nothing has. `window.fieldRest`
    counts frames drawn and skipped for the tests.
  - Every game's boards play themselves, so with every board drawn something is nearly always moving and the field rests
    only when nothing is (the smoke test holds each board's pieces to check it: Sokoban, 3 of 108 frames drawn).
- **Pools that grow** (Oct 11, "proceed" on "Smaller piece pools"): every instanced pool was made at the most it could hold
  (chess's 42 piece pools of 33,334 even in mini golf, 48,000 for every kind of piece, 400,000 board tiles, 600,000 whole
  boards: 4.2 million instances). Now each starts at `POOL_START` (256; the tiles at 4,096) and doubles when full up to
  that size (`growInstanced`: same geometry and material, contents copied, put in the old one's place in the scene, the old
  one disposed). Rung ladder slots (`slot.cap`), app item kinds (`rec.cap`, `rec.max`), `boardMesh` (`_tileRoom`) and
  `wholeMesh` (now `let`). Measured: mini golf framed 307 MB of instance buffers before, 3 MB after (18 MB zoomed out);
  chess 183 MB before, 3–6 MB after.
- **The rails** (Oct 10): the turn rail across the top (`#yawZone`) is as tall as the side rails (`#tiltZone`,
  `#thrustZone`) are wide, `min(32px, 5.25vw)`; the smoke test checks it.
  **The right rail is a scroll bar for where you are** (Oct 25: "the right scroll bar for speed lever should be more like a normal
  scroll bar to move the current position. it should follow the auto motion for the direction of movement.", then "A window
  round you" and "Remove it"): it was the speed lever (the dial's θ unrolled, half as fast since Oct 17; `EdgeGauge.THRUST_SCALE` and the
  rail's speed functions went on Oct 27). Now `#thrustZone` is a scroll bar along the direction of motion (`railDir`: `LAST_DRIFT`, snapped
  to cells as `stepBoard` snaps it while auto motion runs, its fallback viewer-right then; else ahead) over a window `RAIL_WIN`
  (50) boards long centred where you were (`RAIL`, `window.__posRail`): top ahead, bottom behind. The thumb (`#railThumb`) is
  where you are in it (`railFrac`), as tall as the screen's share of it (`railThumb`, 5%–40%), and moves as you move: auto
  motion's steps, the drift, a pan. A drag of the thumb moves the view with it (`railMoveTo`; the glide in `stepThrust` and
  `autoTick` wait while it is held), a press on the track takes it where it is and moves it by the finger's travel (Oct 31: "scroll bars - don't support taps, only support panning": no rail goes anywhere on a press that never moves, the tilt and turn rails' press-to-choose included); let go, or travel off either end, or the way
  of motion turns, and the window centres on you again (`railCentre`). Speed stays with the keys, a swipe's drift, the dial and
  auto motion. The smoke test drags the real thumb a quarter up (12.5 boards ahead), presses low on the track (nothing moves: a tap, Oct 31), and runs Space's
  auto motion, wanting the thumb to climb.
- **Screen diagnostics** (Oct 29: the default framing sits about a fifth left of centre, and the buttons and text are very small, on one
  of the owner's Google phones only): `?diag=1` shows a box at the top left (the last script in the page) with `innerWidth` and
  `innerHeight`, the layout viewport (`documentElement.clientWidth`), the visual viewport (size, scale, offset), the screen, the pixel
  ratio and root font size, the canvas's rectangle and where the framed board's middle falls; a tap copies it. The page sizes its
  canvas and aims its camera by `innerWidth`/`innerHeight`, a fixed canvas follows the layout viewport and a finger's `clientX` is
  in it too, so a phone where those differ would put a board off its middle. Not yet fixed: the phone's numbers are wanted first.
- **Bigger on a touch screen** (Oct 17: "why is the button and menu so small in mobile, but not desktop.", then "yes"): nothing
  shrank on a phone (the menu button 40 px and the menu's words 11 px everywhere), but a phone's pixel is about 0.17 mm against a
  monitor's 0.26. Under `@media (pointer: coarse)` (a finger, never a mouse) the menu button is 48 px (`--menu-chip`), the menu's
  rows at least 44 px with 15 px words and 300 px wide, and the application picker (`.ap-row`), game index and bucket picker
  follow; fields are 16 px, below which iOS zooms the page when one is touched. `--chip-size` stays 40, since the strip's band
  and tiles are sums on it. A desktop is unchanged. The smoke test measures both, the phone in an iPhone 14 context.
- **The system's text size** (Oct 24: "font size is way to small. its not respecting system font size."): every size given to
  text (CSS `font-size` and `font:`, in the style sheets, `FIELD_STYLES` and the styles set from script) is in rem, a sixteenth
  of the root for each pixel it was, so at the usual 16 px nothing moved. The root follows the system: a desktop browser's
  default font size (`html { font-size: 100% }`), iOS's Dynamic Type (`font: -apple-system-body`, 17 px at the usual setting),
  and Android Chrome's font size (`<meta name="text-scale" content="scale">`). Write new text sizes in rem. Pictures drawn on
  canvases (the bottom row's tiles, the boards' lettering) are sized to their tiles and boards and stay as they were. The
  smoke test sets the root to 150% and wants the menu's words and the button's glyph half again as big, and no text left in px.
  **The page's own text size, taken out** (Oct 24, then Oct 31: "remove text size option from the menu"): the menu's A−, Text N% and A+
  (`#textSizeRow`, kept in `ui.textScale`) went, with its smoke check. The page follows the system's size only; a scale saved before is
  ignored.
- **Libraries** come from CDNs: three.js r128 (cdnjs), chess.js (jsdelivr),
  pdf.js, unzipit and libarchive (unpkg).
- **The walk over the boards in view** (Oct 27: "mini-golf and golf tanks are to slow to be usable. they are pretty, the best
  looking applications, but no one will play them because of the performance problems."): `buildInstances` walked every
  board in the rows' reach, out to the horizon, and kept the few `inFOV` passes: 1.5 million boards a frame to keep 43 in
  mini golf (its long boards fit more rows), 0.94 million in checkers, the most time any game spent in a frame. `inFOV`'s
  tests are lines in a board's place (`_fovLines`), so each row of the walk is cut to the interval they allow, a board wider
  each way, and `inFOV` still decides: 53 boards walked, the same boards kept (checked frame by frame over pans, zooms and
  turns). Then the most left was a sum over every board of every row out to the horizon (`demand`, `clarityAt`), made every
  frame and read nowhere: gone. Golf tanks' boards no one plays (`recSoon`) ask the clock after every step of the round, not
  every twentieth, and take 4 ms in 40 (6 in 30 before). Measured with the CPU slowed four times (a phone), JS a frame: mini
  golf framed 245 → 68 ms, checkers 121 → 33 ms (before the `demand` sum went).
  **Measured again** (Oct 28: "1,3", the second being speed on phones; CPU slowed four times): mini golf framed 22 ms of script
  a frame (checkers 8.7), and the page's thread idle most of the time zoomed out, so what is drawn costs more than what is
  worked out. Two things came of it:
  - `BOARD_KIT.budget` fills as time passes (ms/every for each ms) and carries a slice's overrun as debt, so the boards' share
    is the share whatever the frames do. A window refilled whole forgave a step that ran 50–70 ms (golf tanks' two computer
    tanks thinking), and with frames of 140 ms every frame got a fresh one: golf tanks framed went from 38 ms a frame to resting.
  - The windmill is built at K = 12, not 24 (34,500 triangles a windmill to about 10,000); zoomed out, mini golf 849k → 756k
    triangles. Screenshots enlarged show the same windmill.
  Tried and left: bumpers and boulders at their coarse build (the bumper lost its red rim, the boulder its lumps), and the ground a
  grain coarser (`GROUND_PX` 16: the rails' colour smeared into the grass along the far boards). `window.fieldLOD.itemTris` gives
  each kind's instances and triangles, for measuring.
- **Dead code taken out** (Oct 27: "what other needlessly complicated things could be removed?", then "remove dead code and
  the shared kits"): functions and constants nothing reached, found by counting every name in the page (a name written once
  is its own declaration): `LOD_APP` and `HELLO_APP` (apps off the list since Sep 25), mini golf's `softAmount`, `cladGeo`,
  `railPV`/`railPH` and its always-on `PIECES` switches, the right rail's old speed functions, chess's `switchSides`,
  `askCoachHere`, `renderEvalBar_LEGACY_HTML`, the field-lib's `buildExtrudedSlab`, `rungToN`, `bondiK`, and a few more.
  To look again: a name that appears once in `games.html` is never used (an IIFE's own name aside).
- **One match kit** (Oct 27, the same request): Pong, air hockey and squash had their recordings, their hands and their bests
  written out three times, line for line. `MATCH_KIT` (before Pong) has them once: `recordings(o)` (`recOf`, `recWork`,
  `recSoon`, `at` for where a board's loop is, `trail`; each game gives its key, how to make and step a match, a frame, when it
  is over and its par), `hands(o)` (every press on the canvas offered to the game's `pressAt`, `handAt`, `handUp` before the
  field, a touch's mouse echo known by its time) and `best(key)`. A new game of their kind uses it.
- **One edit kit** (Oct 27, the same request): the six games that make their own boards in the bottom row (the tilt maze,
  Sokoban, tower defense, pinball, trick shots, Soma) wrote out the same plumbing each. `EDIT_KIT` (before Soma) has it once:
  `make(o)` gives `pane(open)` (the row opened or shut as the editor's own, `ED.busy`), Escape cancelling, and the row's hooks
  (`hooks`, spread into the app: `onBrowserToggle`, `statTiles`, `statsStay`, `onStatTap`, `quickActs`, `onQuickAct`; the game's
  own quick buttons, then ✕ Cancel and ✓ Done, or ✎ when the row is the game's), each game giving its `open`, `done`, `cancel`,
  `tiles` and `tile`; `store(key, keep, clean)` keeps the boards' own in localStorage. Chess's, the board games' (`BOARD_ED`),
  the puzzle makers' (`PUZZLE_ED`) and mini golf's editors have their own, older ways.
- **One board kit** (Oct 27: "I want to reuse resources and code between games as much as possible. how are we doing on that
  regard?", then "Yes"): seventeen games wrote out the same lines for a board's number, its ring and level, a seeded generator,
  the board beside and a best a board. `BOARD_KIT` (before ARCADE) has them once: `gs()` (the field's side), `boardIdx(c, r)`,
  `cellOfIdx`, `ringOf`, `ringLevel`, `levelAt(idx, DL)` (the ring level plus Easy 0, Normal 1, Hard 2), `rng(seed)` (mulberry32),
  `nextBoard(c, r)` and `best(key)` ({ BEST, saveBest }, the latest 500; `MATCH_KIT.best` is it). A game says
  `const boardIdx = BOARD_KIT.boardIdx;` and the rest reads as before; every app's levels and board numbers were checked the same
  before and after. Mini golf (its levels follow its own setting), Levels (a level is a distance), trick shots' bests and the game
  lab's sandbox Worker keep their own. A new game with levels by ring uses it.
  **The boards' share of time** (Oct 27: "do the recording schedule next"): seven games made or recorded the boards no one plays
  a little at a time with the same window, a few ms of work in every 30 (the tilt maze's mazes 8, pinball's tables 10, the
  nonograms 8, the tanks' duels 8, the tank maze's rounds 6, golf tanks' rounds 4 in 40, and MATCH_KIT's recordings 8, which
  serve Pong, air hockey and squash). `BOARD_KIT.budget(ms, every)` keeps it once: `left()`, `spend(t0)`, `take(fn)`. Each
  game's own queue and order stay its own (mini golf's idle-time `SOON`, Soma's `soonPump`, trick shots' workers, the game
  lab's sandbox), being different in kind. Checked: the same boards' caches fill as fast before and after.
  **One dot font** (Oct 27: "do the dot font next"): `DOT_FONT` (after `BOARD_KIT`) holds the page's two dot fonts, which five
  games wrote out each: `five`, a 5 × 7 (55 glyphs as seven rows of five bits: capitals, digits, signs, ♥ ★; the game lab's words
  and pinball's dot-matrix panel, which keeps only the 37 it always drew, `pick`), and `three`, a 3 × 5 (digits and the letters
  squash's calls need) with `text3` and `digits3` (Pong's, air hockey's and squash's scores, squash's calls). Checked: every glyph
  and every dot laid the same as the copies before. A new game's lettering uses it.
  **One way to say a thing** (Oct 27: "do the message helpers next"): 45 games each wrote `say(message, ms)` out, the notice at
  the top for so long (1.8 to 3.5 s by game), some held back while the game is quiet (`QUIET`, `SILENT`: a demo, muted). Now
  `const say = BOARD_KIT.say(ms, () => QUIET);` (the second argument only where the game had one). The four that do more (the
  board editors' and puzzle makers', which keep the message on the draft too, and chess's early one) keep their own. Checked: every
  app loads, and the games' own messages say the same.
  **A game a board, and the small things** (Oct 27: "what else could be shared between games?", then "do 1 and 2"): `BOARD_KIT`
  also has `gkey` (50 games), `gameAt(GAMES, fresh)` (a board's game made on first want; 11), `liveGame(() => app, () => LIVE,
  gameAt)` (the board being played while this game is up; 10), `clamp` (12), `now` (the paused-aware clock in ms; 17), `yawOf`
  (never a yaw of exactly 0; 5), `hash` (FNV-1a in base 36: the keys of your own tables, figures and trick shots; 4, the same
  keys as before), `LV_COL` (the levels' flag colours; 5) and `stars(n)` (★★☆; 15 places). Trick shots' worker is made from its
  own text up to "IN THE FIELD", so nothing of the kit may go above that line; the game lab's starters and sandbox keep their
  own. Checked: every app loads with the same levels, every hash the same, a tap starts the same game.
  **Boards no one plays, played back** (Oct 27: "do the idle-board playback"): `BOARD_KIT.phase(idx)` (a board's own place in its
  loop, its number × 0.618, so neighbours never move together; 12 games), `loopT(ph, T, s)` (where in a loop of T seconds the
  board is at s seconds, the page's clock if not given; Simon, Lights Out, Whack-a-mole, Nonograms, the tank maze, golf tanks)
  and `frameAt(n, hz, rest, ph, s)` (the two frames of a recording to blend and how far between, with `rest` s held at its end;
  the tilt maze, pinball and MATCH_KIT's recordings for Pong, air hockey and squash). Soma and 3D Tetris keep their own phase
  (0.6180339887, a different number: their boards would all move to another place in their loops). Checked: the same frames
  chosen over 200,000 random boards and moments (times within 2e-13 s), and every one of the twelve games' idle boards moving.
  **A board painted as a picture** (Oct 28: "do the painted board helper next"): six games (pinball, the flash cards, the tanks,
  Pong, air hockey, squash) kept, each in its own words, what the photo tier's key stands for, since the field asks for the
  picture by the key alone. `BOARD_KIT.painted(cap, paint)` does it once: `key(base, hi, make)` is `base` + ':h' or ':l' and keeps
  `make()` for it the first time (the oldest let go past `cap`), `canvas(key)` calls `paint(spec, hi)`, `SPECS` the store. Each game
  says `const PIC = BOARD_KIT.painted(…)`, and `cellPhoto`/`photoCanvas` are `photoKey(c, r, bp)` and `PIC.canvas(key)`. The flash
  cards' sizes are now ':h'/':l' too (':H'/':L' before; a front's hint is ':hint'). Checked: the same keys and the same pixels
  in all six. Trick shots (one picture for every board) and the board games' and gallery's prints keep their own.
  **One way of sounding** (Oct 28: "1,3", the first): eleven arcade games (Defender, Breakout, the crossing, Snake, Tetris, 3D
  Tetris, Soma, Bomber, Pac-Man, tower defense, Space Invaders) wrote out their own sound switch, its menu item and the head of
  their `beep` (off or quiet, no audio, a kind again within its gap). `ARCADE.sounds(key, title, own)` (the puzzles' switch since
  Sep 28) takes `own` = { gaps, quiet } and gives `gate(kind)`: the audio context if that kind may sound now, else null. A game
  says `const SND = ARCADE.sounds('snake.sound', '…', { gaps: { turn: 0.05, … }, quiet: () => QUIET })`, its menu `SND.item`, and
  its `beep` begins `const A = SND.gate(kind); if (!A) return;`; its tones stay its own. Pinball, the tanks, trick shots, air raid,
  Simon and Asteroids keep their own sounds (an engine of their own, or no gate). Checked: every game sounds, the items the same.

## Shared with draw: change with care
`games.html` carries two blocks of draw's **verbatim**, inside `const TVF_CURVE = (() => { … })()` before `GOLF_APP`:
the tvf-core library (`// >>> copied from draw.html, unchanged: tvf-core`) and `parseTvfText`
(`… unchanged: tvf-reader`), each ending at its `// <<< end of NAME`. Don't edit inside them: fix draw first, then copy
across. `node tests/draw-sync.mjs` (also the weekly "Draw sync" workflow) fails when they drift from draw's `main`
(`DRAW_HTML=../draw/draw.html` compares with a local draw). `TVF_CURVE` is the curve library; the older `TVF` is the
3D shape helper the field-lib uses, a different thing.

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
