# games: notes for Claude

A 3D field of boards you fly over, with ~40 games in one page (and Levels, a demonstration of level of detail) (chess against
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
  course and a sample of generated holes (`GEN_SAMPLE`, 40), then rates `LEVEL_SAMPLE` (10) holes at each of levels 1, 3 and 5
  and fails unless they climb (see Difficulty). Sunken ground goes at most BASE deep. All water and sand are shapes
  (`lake`, `sand`, see below): water and sand written in cells (`~`, `s`) are read as shapes (`shapify`, see "No painted
  water or sand"); the old reading of cells blurred (`groundAt`, `softAmount`) is still there but nothing reaches it. Mini golf has `firstTapPlays`: the tap that selects a hole also tees off. The movers (Oct 8) run on the game's clock (`toyAt`; a board no one plays,
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
  whatever its size (the field still asks for none under `itemMinPx`, 20). `railPV`/`railPH` are no longer drawn.
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
  boulders still fade). `cladGeo` stays for the tests. Same views: framed 595k → 253k triangles, zoomed in 263k → 102k, at the
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
  Tall every board's hole is generated. Each size keeps its own My holes, best lines, clipboard and remade holes (the keys get
  `.medium` / `.tall` after them, `SIZED`). A `?hole=` or `?line=` link opens at the size its map is (`golfSizeAtLoad`).
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
- **Hole numbers off by default** (Oct 20: "turn hole number off by default."): the number in a board's far corner (`NUMS`,
  `numberItems`) shows only once the menu's Hole numbers is turned on (localStorage `golf.nums` 'on').
- **Difficulty** (Oct 10: "Now we way to adjust the difficulty, what do you suggest" … "ok, proceed"):
  - **The rating** (`rater`, `rateHole`, `rateSoon`, `RATE`): a player with a person's hands, its aim off by about 4°,
    its strength by about 12%, and its shot up to about half a second late. It plays a hole `RATE.rounds` (8) times, each
    from its own moment of the toys' clock, up to `RATE.cap` (10) strokes.
    - At each stroke it searches as if its hands were perfect: 32 headings × 5 strengths, stepping at 1/40 s.
    - It tries the best 8 that end half a cell apart 3 times each with its own hands (at 1/60 s), and keeps the best on
      average. A stroke lost to water counts as `RATE.wet` cells farther from the cup.
    - It is seeded by the hole as written, so a hole always gets the same rating. It returns {mean, sd, sunk, stars}.
    - Stars come from the mean (`STAR_AT`: 2.7, 3.0, 3.45, 4.6, halfway between the levels' medians, so a level-n hole is
      mostly n stars); par from a rating is `parOfRating` = ceil(mean + 1).
    - A hole takes 1–8 s; `rateSoon` runs it in 10 ms slices and keeps the result on the hole (`H.rated`).
    - The plain player (`solveHole`) aims perfectly and sinks nearly everything in one, so it only says whether the cup
      can be reached.
  - **The menu:** Rate this hole (stars for the selected hole; while editing it is Check, which also sets par), and
    Difficulty: Easy / Normal / Hard / Expert (`LEVEL_SET`, kept in `golf.level` as before).
    - It is the one Difficulty: it was the arcade kit's (the grass's speed and the cup's size, `DIFF`), and now it shifts
      the holes' levels too. Expert plays on Hard's grass and cup.
    - The rater always plays on Normal's (`EVEN`), so a hole's stars and par don't depend on the setting.
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
  - **The editor:** Harder and Easier tiles make every mover 18% faster or slower, its rider 6% bigger or smaller, and
    the ground 18% steeper or gentler.
  - **Rated as you play** (Oct 10: "6,4,2,3", 4 being stars on the scorecard): `rateAhead` rates the hole in play in the
    background (`rateSoon` with `gentle`: 5 ms slices, 40 ms apart), then the next board's (`nextBoard`). One runs at a time
    (`BGR`); a new hole stops it. A rated hole's stars show on the tee and when sunk (`starTag`) and ride on the card
    (`R.card` entries carry `stars`, `name`, `num`). A round ends on a scorecard (`openCardBox`, `#golfCardBox`: a row a
    hole with par, strokes and stars, the average stars, Close; Escape closes it).
  - **Holes no one could finish, made again** (Oct 11: "proceed", on "Catch the near-unplayable holes"): about one level-5
    hole in 400 the guess called fair could hardly be finished (112107; 11763 "the amber saddle" once movers kept apart, sunk
    once in 8 by the rater). Rating every hole as it is made would take seconds a board, so the ratings `rateAhead` already
    makes are used. `vetRated(k, R)` (from `rateSoon`): a generated hole sunk in fewer than half its rounds (`R.sunk < 0.5`)
    is remembered in `REMADE` (GEN key → times remade, localStorage `golf.remade`, the latest 1000), and the board gets the
    hole of its next eight attempts (`genSrc(idx, lv, from)`, from = 8 × times), in its own slot (`remakeIn`: number, level,
    board kept; `H.remadeN`). A hole someone is playing (`holeBusy`: a game on it not done) is not swapped: the tee says so,
    and `holeAt` remakes it the next time the board is wanted. After three it is left as it is. Of 55 fresh level-5 holes
    rated, none sank fewer than half (the worst five in eight). The course test rates a generated hole its player cannot
    finish (`vetHole`); if the page would make it again, it plays the new one, and fails if more than one in 33 of its sample
    was made again.
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
- **Tank maze** (Oct 21: "maze tank battle", the second of the tank games offered): `TANKMAZE_APP`, id `tankmaze`, after Tanks.
  Two tanks seen from above in a maze, as Tank Trouble plays it: drive, turn and fire; a shell runs on for `LIFE` (9 s) bouncing
  off every wall, and hits whichever tank it finds, the one that fired it too once it is `GRACE` (0.17 s) out. The last tank
  standing takes the round, the first to `WIN` (5) the match; every round is a new maze.
  - **Every board its own mazes** (`makeMaze(idx, lv, round)`: the tilt maze's backtracking walk with many more loops, the two
    tanks in cells far apart along it, each facing an open side), at a level 1–5, the ring level plus the Difficulty (Easy 0,
    Normal 1, Hard 2). `LV`: 5 to 9 cells a side, loops 0.32 down to 0.2, and the computer's hand: `aim` (bounces it looks for,
    none at level 1), `rays` (48–120 headings tried), `think` (0.32 s down to 0.11 between plans), `err` (6° down to 1.2°),
    `lead` (aims where you will be, from level 3), `dodge` (the chance it sees a shell coming, 0 to 1), `cool` and `most` (its
    shells in the air, 1 to 3; yours `MAXB`, 5).
  - **One physics for shells and the computer's eye** (`trace`): a shell's whole way is laid down when it is fired, a ray
    against the walls widened by its radius (slab test), mirrored at each face it meets; where it is is how far along it has
    gone (`along`), and a hit is the way coming within `HIT_R` + its radius of a tank between two steps (`nearest`, which also
    takes a moving point, for leading). The computer looks for shots along the same rays (`findShot`: the straight line and
    `rays` headings, each off up to `aim` walls, that reach you before coming back through itself, and that do not come back
    through it in the 2.5 s after); a shell coming its way, it tries seven moves for 0.7 s and takes the one keeping farthest
    from every shell (`escape`); else it drives toward you along the maze (`pathOf`).
  - **Controls**: the arrow keys or WASD drive (up forward, down back at 0.7, left and right turn), Space, Enter, Q or M fire;
    a drag steers the tank toward the finger, driving while it is more than half a cell off (`claimsPan`, `keepsPress`); a tap
    fires. A press of fire is kept until the tank can fire, up to `REQ_T` (0.6 s): a tap in a tank's first 0.4 s, while its
    first cooldown ran, was lost. Two players (the menu's Players, localStorage `tankmaze.players`): Player 1 green on WASD with
    Q or Space, Player 2 blue on the arrows with M or Enter, and a finger steers or fires the tank nearest it (`seatNear`).
  - Rounds: 'ready' until the first key or touch, 'count' (`COUNT_T`) before each, 'play'; a round ends `BOOM_T` (1.5 s) after
    the first tank goes, or at `ROUND_CAP` (60 s), so both can go (no one scores). Through: stars by the match (5–0 or 5–1
    three, to 5–3 two, else one), the most a board kept (localStorage `tankmaze.best`); a tap on a finished board goes on to the
    next (golf's `nextBoard`), a hold starts it again.
  - **A board no one plays** shows a round of two computer tanks on its first maze (`recSoon`, worked out STEP by STEP in about
    6 ms in 30 and kept for `REC_CAP` 500 boards: the tanks sampled `REC_HZ` 15 a second, the shells as their ways, the bursts),
    played back on the page's clock with a 1.5 s rest (`shownOf`). Measured over 20 rounds a level: 4.6, 5, 6, 8.4 and 12.2 s a
    round, 2 to 37 ms to work one out (112 at most), half the hits or more off a wall from level 2; a round with no one left is
    usually two tanks firing straight at each other at once.
  - Drawn: walls as boxes (the outer one the level's colour, golf's flags), each tank tracks, hull, turret and gun turned to its
    heading (`mzTracks`, `mzHull`, `mzTurret`, `mzGun`; never a yaw of 0, `yawOf`), shells, and a burst of fire and smoke.
    An inner wall stops at the outer wall's inner face (Oct 22: "the inner walls of the maze should not extend into the outer
    walls. they flash with a different color."): laid a little long so its corners close, its end lay inside the outer wall,
    the two drawn by turns over each other in two colours. The tilt maze's walls (the same `wallsOf`) too; the smoke test
    checks 20 mazes of each.
  - **More to it** (Oct 21: "1,2,3" of the ideas offered: power-ups, three or four tanks, an aim line):
    - **Power-ups** (`POWERS`, the menu's Power-ups, localStorage `tankmaze.powers`): a crate drops every `CRATE_GAP` (4–7 s,
      the first at `CRATE_FIRST` 2.5 s) while fewer than `crateMax` (1 + tanks/2) lie about, in a cell 1.6 cells from every
      tank (`G.crates`, each with t0 and t1, the time taken). A tank driving over one with nothing held takes it (`t.power`, a
      light over its turret), and its next fire is it (`firePower`):
      - laser (`firstHit`, `cutAt`): the whole way at once, `LASER_LEN` 40 cells off up to `LASER_SEG` 14 walls, the first tank
        on it out, its own tank once it is `LASER_SAFE` 0.7 cells along (a laser at a wall beside you comes back for you);
        drawn as thin bars fading over `LASER_SHOW`;
      - frag: a shell, bigger and orange, that after `FRAG_T` 0.9 s bursts into `SHARDS` 14 short shards (`SHARD_LIFE`, at
        `SHARD_V`, `grace` 0: they hit anyone); a shot's own speed is `b.v`, and its grace `b.grace`;
      - spread: three shells `SPREAD` (0.2 rad) apart;
      - mine (`G.mines`): laid under the tank, armed after `MINE_ARM` 1.2 s, then any tank within `MINE_R` sets it off and every
        tank within `MINE_BLAST` goes;
      - homing (`G.missiles`, `stepMissile`): at `HOME_V` of a shell's speed, toward the nearest other tank along the maze (the
        next cell's middle, the one after once nearly there), straight at it once a ray reaches it, turning `HOME_TURN` a
        second, sliding along a wall it meets (spent on every corner it clipped, it found its tank 13 times in 20; sliding, 19),
        spent on a tank or after `HOME_T` 7 s; its `trail` is where it was, so a recording plays it back.
      The computer goes for a crate within three cells when it has nothing held, lays a mine where ways meet or near a tank,
      sends a missile when it has no shot, and fires a laser (`findShot(…, laser)`: not led, off more walls), frag or spread
      where a shell would hit. Rounds and recordings carry `sounds` (a crate taken, a power fired, a frag's burst, a mine).
    - **Three or four tanks** (the menu's Tanks, `SET.n`, localStorage `tankmaze.count`): `makeMaze(idx, lv, round, tanks)` is a
      cell larger a side for each tank past two (5×5 to 11×11) and starts each tank after the first two in the cell farthest
      along the maze from those placed. Seats: you (or you and Player 2), then the computer's tanks, Red, Orange, Violet
      (`colsOf`, `namesOf`); every tank pushes off every other; a round ends `BOOM_T` after one or none is left (`downAt`,
      `kill`); `score` a seat each, the best kept by board, level and count (`#3`, `#4`). The computer goes for the nearest
      tank along the maze and shoots at any it can hit. A board no one plays records that many computer tanks (`recKey`).
      Measured over 12 rounds each (powers on): 3 tanks 5.4, 8.6 and 19 s a round at levels 1, 3 and 5, 4 tanks 6.9, 11.4 and
      27 s; working one out took up to 0.25 s on average at 4 tanks and level 5 (0.4 at most), done a little at a time.
    - **The aim line** (`aimOf`, the menu's Aim line, localStorage `tankmaze.aim`): for each person's tank in play, dots a fifth
      of a cell apart along where its shell would go from its gun (`trace`): `AIM_SEG` pieces of the way, 4 at level 1, 3, 2,
      then the straight run alone at levels 4 and 5, at most `AIM_CELLS` 12 cells; with a laser held, the laser's own way.
      Kept on the tank (`t._aim`) until it moves or turns.
  - The smoke test checks the levels and sizes by ring, the same maze each time and another each round, a shell's way staying in
    the board and coming back off a wall, your own shell killing you at 0.18 s, computer rounds at levels 2, 4 and 5 ending with
    hits off walls, a computer tank getting out of a shell's way, a real key driving, a real click firing, a real drag steering,
    a round won counted with a new maze, a match won with three stars and a best, two players each on their own keys, a board no
    one plays moving, and the drawing (every wall, two tanks turned, a shell, a burst); since Oct 21 also the mazes for 2, 3 and
    4 tanks, four tanks started apart, 3- and 4-tank rounds ending with crates taken and powers used, a laser coming back off
    the wall beside you, a frag's 14 shards, a spread's 3 shells, a mine armed and set off, a missile finding its tank, a crate
    dropped and taken, the aim line from the gun along its heading (3 pieces at level 1, 1 at level 5), and the crates, mines,
    beams, missiles and aim dots drawn.
- **Golf tanks** (Oct 22: "the mini-golf game could be reused as a tank battle game. it has interesting terrain options.", then
  "Real-time"): `GOLFTANK_APP`, id `golftanks`, after the tank maze. The tank maze's battle (drive, turn, fire, shells bouncing,
  first to `WIN` 5 rounds) on each board's own golf hole, as mini golf makes it at its size; every round is on the same hole.
  - **One on one, no golf** (Oct 22, later: "remove the golf hole and tee box. this is one on one tank combat."): the battle is
    fought on a bare copy of the hole (mini golf's `bareOf(k)`: the compiled hole copied without its kept heights, marked
    `bare`, in a slot of its own in HOLES so its ground meshes are its own; `BARE_CAP` 400, the one wanted least lately giving
    up its slot). `rawH` raises no tee box on it, `hOf` sinks no cup, `onTeeBox` mows no stripes, and `cellItems` draws no cup,
    flag, flag dots, tee markers or number. The tanks start where the tee and the cup were (`spawnsOf`), the two ends the
    hole was made round, kept clear of its things; the title gives no hole name.
  - **Long-range weapons** (Oct 22: "the game can be changed to accomodate tank combat. more long range weapons."): the cannon's
    shell skims the ground, so every hill was cover. `WEAPONS`: Cannon (always), Mortar (3 a round), Rail gun (2), Missile (2),
    `ammo` back to full each round; chosen with 1–4 (Player 2: 7–0, `WEAPON_KEYS`, `choose`) or the bottom row (`statTiles`, the
    ammo left, the one in hand lit; `statsStay`), fired by `fire(G, k, cmd)` (`cmd.w`, a mortar's `cmd.at`).
    - **Mortar** (`fireMortar`, `mortarAt`): lobbed over everything onto a point, `MORTAR_MIN`–`MORTAR_MAX` (1.5–16) cells, landing
      `MORTAR_T0` + `MORTAR_TK` a cell later, a burst `MORTAR_R` (0.8 cell) that takes any tank, its own too (`blast`). A tap puts it
      where you tap (`g.fireAt`); the fire key on the other tank within `AUTO_CONE` of the heading, else `AUTO_RANGE` cells ahead
      (`autoRange`). Its landing place is ringed in red while it flies, and with it in hand the aim line is that ring.
    - **Rail gun** (`railTrace`, `fireRail`): a shell's way at once, no bounce, `RAIL_LEN` (30) cells: the ground and every solid
      thing stop it as they stop a shell; drawn as a fading beam (`G.beams`, `RAIL_SHOW`); its aim line is its whole way.
    - **Missile** (`fireMissile`, `stepMissile`): rises to `MIS_Z` over the ground and flies after the nearest other tank at `MIS_V`,
      turning `MIS_TURN` a second, over everything, bursting within `MIS_HIT` (`MIS_R`); out after `MIS_LIFE` or off the board.
    - The computer: the rail at a tank in plain sight more than 4 cells off (from level 2), else the cannon's search as before;
      with no straight shot, now and then (`LV`'s `mortar` and `missile`, a chance each time it thinks) a mortar onto where the
      tank will be, off by `merr` of the range, or a missile; never in a round's first `LONG_HOLD` (2.5 s: mortars onto tanks still
      where they began ended rounds in four seconds). It sees a mortar coming down near it or a missile after it and drives clear
      (`threatened`, `escape`). Measured over 12 rounds a level: 10.1, 9.7 and 8.6 s a round at levels 1, 3 and 5, long-range
      shots 1, 2 and 11 of them. Recordings keep each shot's kind and the beams.
  - **Mini golf's kit** (`GOLF_APP._kit`, asked for each time, `kit()`; a new kit, after Board size, clears the games and
    recordings): the holes, `holeSoon`/`holeAt`, `hOf`, `gradOf`, `groundAt`, `waterAt`, `toyAt`, `chargePull`, `minesOf`,
    `cellBlocked`, `gridOf`, `bareOf`, and two made for this: `solidsAt(H, x, y, R, t)`, every solid thing a circle of radius R touches at
    the clock t as [nx, ny, depth] (the ball's own tests with any radius: the rail, wall cells, slides, windmills, turnstiles'
    and doors' bars, fences, curved fences, planters, charges' posts, boulders, bumpers, path riders, a gate standing up), and
    `drawHole(c, r, bp, opt)`, mini golf's `cellItems` with `opt` = { hk, t, now, blown, kicked }: the hole at the clock t with
    no golf game's ball, ghost or aim.
  - **The ground** (`moveTank`, in cells of the hole, CW; Oct 22, later: "the tanks just drive through hills. they should respect
    the terrain."): speed × (1 − `SLOPE_K` 1.4 × the slope ahead), 0.2 to 1.5; ground rising more steeply than `SLOPE_MAX` 1.05
    along the tank's way, where it stands or where the step would take it, keeps only the part of the way running along the
    slope, so a tank stops at a hill's foot or slides along it; anything steeper than `SLIDE` 0.95 slides it down, whatever it
    is doing; sand × `SAND` 0.6. (Before, it climbed anything to 2.4, since a raised green's edge, 1.7, had held two computer
    tanks at its foot for a round; now the computer goes round: `navTo` treats a step up to a cell more than 0.85 × `SLOPE_MAX`
    a cell higher, or steeper than `SLOPE_MAX` between the two, as a wall, kept a hole on `H._gtSteep`.) Measured: 0.53 cells
    in half a second up a slope of 0.3, 1.09 down it; driven at a slope of 1.63, a tank rose 0.05 of the hill's 1.25 cells.
    - **Tilted to the slope**: the field's items take `tilt` [du, dv] (`_emitInto`: the ground's slope as lift a unit of u and
      of v; the item's upright turned to the normal (du, 1, dv·bWX/bWZ), after its yaw). A tank's is the slope across
      `TILT_E` (0.3) of a cell either way under it, so it lies along a hillside, not into it.
    - The computer up close with no shot (a ridge between) goes round the other tank on a side of its own (`A.side`, 2.2
      cells out) instead of sitting face to face, and after a shot that would not stand when looked at again it looks for none
      for 0.6 s (`A.noShot`). With hills holding tanks, 3 of 36 rounds had run to `ROUND_CAP` that way; after, none: 9.1, 5.9
      and 6.9 s a round at levels 1, 3 and 5.
  - **Water** stops a tank (it slides along the shore; a bridge is ground); a tank pushed or thrown into a lake goes under and
    is out (`splash`). **A mine** (once a round, `G.blown`) throws a tank `THROW` 5 cells a second, spinning, stunned `STUN`
    0.9 s (2.9 cells, measured). Pipes and zap zones are not used.
  - **Shells** (`shellStep`, stepped every frame since the movers move): fired at `GUN_Z` above the ground, they fly `CLEAR`
    over it (over a lake, its water), following it down at most `DROP` 0.6 a unit along and up at most `CLIMB` 0.35, and burst
    against anything steeper (`-2`, 'hill'): ridges, hills, raised greens, a crater's rim, the tee box are cover. They turn
    back off whatever `solidsAt` gives at the round's clock, so the movers are moving cover; a charge bends them
    (`chargePull` × `CHG` 0.35: 0.37 rad over about three cells, measured). `LIFE` 4.5 s, `MAXB` 4 each.
  - **The computer** (`cpuCmd`, `think`, `LV` by level, the ring level plus the Difficulty as the tank maze's): sees a shell
    coming (`dodge`) and drives clear (`escape`); else flies shells in the round's own physics (`simShot`, 1/30 s, the movers
    where they will be), the straight line first and then `rays` headings nearest its own, off up to `bounce` walls, and turns
    to the first that hits (off by up to `err` degrees); as it fires it flies the shot it meant again in the shells' own steps
    and thinks again if the movers have shut it (`STEP / 2`: without that, against a still target, 75 shots made 19 kills; with
    it, 23 made 17). Else it drives toward the foe through the cells mini golf's players can cross (`navTo`, `cellBlocked`), and
    backs off when stuck. Rounds of two computer tanks: 3–15 s, 30 ms to work out at level 1, 215 ms at level 5.
  - Controls, keys, two players (Player 1 at the near end, Player 2 at the far end), the match, stars and best (localStorage
    `golftanks.best`, by board, level and size) and the aim line (`aimOf`: the shell's own way, `AIM_SEG` bounces by level, at
    most `AIM_LEN` 2.2 s) are the tank maze's. Two tanks only, no power-ups.
  - **Drawn**: the hole by mini golf (`drawHole`), then the tank maze's pieces in golf's units, standing on the ground and
    divided by WD at the end; the board's shape, tilt floor, zoom ceiling, far colours and kinds' room are mini golf's (getters
    on `GOLF_APP`); `itemGeometries` is a Proxy giving the tank kinds from `TANKMAZE_APP` and every other kind from mini golf.
  - **A board no one plays** shows a round of two computer tanks on its hole (`recSoon`: worked out about 6 ms in 30, `REC_CAP`
    300, 40 s at most; tanks sampled `REC_HZ` 15 a second, each shell's points as it went, `shellAt`), its movers and mines at
    the recording's own clock.
  - The smoke test checks the levels by ring, the spawns, the bare copy (the tee box's rise gone, no cup, flag or markers
    drawn, the golf hole itself unchanged), uphill slower than down, the shore and a sinking, a mine's throw, a
    rider solid where the clock has it, a charge's bend, a shell off the rail and against a rise, computer rounds ending at levels
    1, 3 and 5, a real key, click and drag, a round and a match won, and a board no one plays moving and drawn; since Oct 22 also a mortar
    landing on its tank, the rail stopped by the rail and reaching a tank in the open, a missile fired away turning back for its
    tank, the rail's ammo running out, the computer using long-range shots at level 5, and the real key 2 and a real click putting
    a mortar where it was clicked; and a tank driven at steep ground staying at its foot, drawn tilted to it.
- **Trick shots** (Oct 22: "could you add the trick shot demo from wander. repos to the games application?"): `TRICK_APP`, id
  `trickshots`, after golf tanks. wander's `play-trick.html` (its main at 335fa6c), a pool table where you set an angle and a power
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
  solver; a level with no way is refused). Mini golf keeps its own `?hole=` and `?line=`.
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
- **Lakes, bunkers and greens as .tvf** (Oct 11, "proceed", the first of the TVF ideas left: "Open a .tvf as a lake,
  bunker or green ... a heart drawn in draw becomes a heart-shaped pond. Saving a shape back out as .tvf would come with
  it"): the editor's menu has Open a .tvf curve (it was Open a .tvf as a path) and, with one selected, Save this lake /
  bunker / green / path as .tvf. A shape is written as a path is (`shapeToTvf`, `pathToTvf`), with `#meta kind:lake|sand|
  green|path` (and a green's `#meta height`). A file this page wrote opens again as what it was, where it was, without
  asking (`takeTvf`). Any other `.tvf` (picked, opened with the field's Open button or dropped) opens a box asking what it
  should be (`openTvfBox`, `#golfTvfBox`: Lake, Bunker, Green, Path, Cancel; Escape closes it; several files are asked
  about one after another, `TVF_Q`); `addTvfAs` lays it on the hole being edited, the editor started if it was not. A curve
  from draw is fitted into the middle of the board, its proportions kept, in a box for what it becomes (`SHAPE_FIT`: lake
  4 × 6, bunker 3 × 4, green 4 × 5; a path 5 × 7, `fitMiddle`); a shape takes up to 32 leaves, laid evenly along the curve
  itself if it has more (`tvfToShapes`). Draw's y runs down the page, as the board's does, so a heart comes in upright.
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
    `.tvf`: the open box offers Planter (fitted 3 × 3), and Save this planter as .tvf (`#meta kind:planter`).
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
  go where the clock says (any moment of a hole can be shown at once, which the rater, the plain player and the boards no one
  plays need); the clock is arranged so they never meet. `keepApart(src, mode, tiers, anchor)` on a hole as written:
  - Units (`kaUnits`): a path's riders (a train on one loop at one speed is one unit, kept in its spacing), a turnstile, a
    door, a windmill, a gate. Each is tabled as its shape at `KA.Q` (256) fractions of its turn (`kaTable`), with its sweep
    and its fastest part's speed. A door now has a 7th number and a windmill a 5th: its phase (cleanSrc keeps them; a windmill's
    turn rate is kept to six places so a beat stays exact).
  - A train whose riders would meet on their own loop (a figure of eight, an even train) is spaced off those offsets
    (`kaTrain`), or loses riders.
  - A thing standing still on a sweep (`kaStatics`: bumpers, boulders, fences, curved fences, planters, pipe mouths) is nudged
    off it (1.8 cells for a loose one, 0.8 for a guard's, a screen's or the course's), else the less needed goes: tiers loose
    1, weave and planters 2, screen 3, guard 4, the course's own 5 (never dropped); a piece on a track with two riders or more
    gives way to it.
  - Units whose sweeps reach one another go on one beat (`kaBeat`, at least 1.7 s, a multiple of 2 ms): each period becomes
    the nearest of 1, 1½, 2, 3, 4 or 6 beats, so a pair comes round together within 12 beats. The most needed and the longest
    trains first, each takes the first of 48 phases (nearest period first, then the others) at which it never comes within
    `KA.gap` (0.08 cell) of one placed before it over that cycle (`kaClear`, which skips ahead while they are far apart and
    allows half a table step each). Failing that, a train tries a rider shorter; then the unit goes ('gen'), or keeps its best
    and is marked. `KA.budget` (400,000 gap tests) caps the trying, counted, not timed, so a hole is the same on any machine.
  - Modes: 'gen' (a generated hole: `genSrc` keeps apart each attempt near its band and guesses it again, as dropped riders
    made holes easier; the hole keeps `apart` {dropped, meets, why}), 'course' (at load, after the guards: rider sizes allowed
    12% for Expert), 'time' (the editor, on every change: timing only, the selected mover keeps its period and sets the beat
    so Faster and Slower stand; things that still meet are ringed red, `ED.meets`) and 'fit' (the menu's Keep movers apart:
    nudges too, never drops).
  - `tuneMovers` no longer rounds periods and scales windmills too, so a beat survives the Difficulty setting. Screens and the
    fallback bumper keep off every track (`toyPoints`), and the serpent's way back lies a rider's width beside its way out.
  - Measured: before, 185 of 274 generated holes with movers had something pass through something in 40 s (815 pairs of
    riders met). After, none on the course or 300 generated holes, from the start, an hour on and two. The weave keeps 679 of
    the 811 riders it made on 300 holes; a hole takes about 6.7 ms to make, against 3.6. Levels 1, 3 and 5 rate 2.1, 3.3
    and 5.8 strokes (2.4, 3.3 and 6.0 before). Unplayable level-5 holes: 0 in 400 (1 in 400 before), though one that was
    playable, 11763, is not now.
- **The best line and its ghost** (Oct 11: "proceed", on "Shots saved as curves: your best line on a hole is kept as a
  curve, so you can replay it, share it, or race it as a ghost ball on your next try"):
  - **Recorded:** the hole in play (`g.rec`, made at its first putt only for the live game, never the rater's or the
    players' copies) is recorded where `step` moves the ball, at each sub-step, from the first putt: seconds on the toys'
    clock, x, y. A putt, a free push and a ball sent back from the water add a point where the ball lay.
  - **Laid down as a curve** when the ball stops (`recFlush`, `thinLine`): the fewest points that, joined straight and ridden
    at their times, keep within `GHOST_TOL` (0.03 cell) of the ball: Douglas and Peucker with time as the parameter, so the
    points gather at bounces and bends (about 20 a stroke). Not a TVF curve: a bounce is a corner, and a smooth curve would
    take the ghost through the rails.
  - **Kept:** when sunk, `lineDone` makes it the hole's line if it took fewer strokes, or as many in less time. It is kept in
    localStorage `golf.ghosts` (the last `GHOST_CAP` = 200) by `lineKey` = `originOf` the hole as written + `@` the
    Difficulty, since a changed hole is another hole and the setting changes the grass. A line is `{v, s, ms, n, lv, at, p,
    shared?}`, where `p` is [ms, x, y] in hundredths of a cell, each point stored as its step from the last (`lineCode`,
    `lineDecode`, which refuses nonsense). The sunk message adds "best N" or "new best line, beating your N".
  - **Raced:** on the board in play a pale ball (`ghostBall`, 45% opaque) rides the line from your first putt (`lineAt`,
    `ghostItems`). The menu has Ghost: on/off (`golf.ghost`).
  - **Watch my best line** (`watchLine`) plays it from now on the selected board, starting a game if there is none, with
    the line dotted.
  - **Share my best line** (`shareLine`, `lineLink`) copies `?app=minigolf&line=…`, base64 JSON `{hole, line}`, about
    1.5 KB. A course hole on another setting goes with its movers as played. Opening one (`takeLineLink`, at load) plays the
    hole as a shared hole is played (`PENDING`, `pendingNote`) and keeps the line marked shared, unless yours there is better.
  - Played again with the same putts at the same moment, the ghost stays within 0.03 cell of the ball (the smoke test
    checks it, after a real touch's putt starts a recording).
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
  is not. The movers are tools too: Path (draw a loop, or tap for a round one) and Gate (drag a
  track), each placed at a default size by a tap (Shuttle and Orbit went on Oct 10). Undo has Redo (`ED.redo`).
  **The path** (Oct 10: "drawing the orbits in place and moving the leaves would be best"): a mover riding a closed
  loop of its own shape, as a shape in draw.html rides its motion orbit. `path [x0, y0, …, xn, yn, r, seconds, phase
  (fraction), rider (see Riders)]`, 3–64 leaves in cells. **A path is a TVF curve** (Oct 10: "games project should
  take advantage of tvf"): its xs and ys are a closed `.tvf` curve's two rows, leaves at φ = (k + ½)·2π/N, and the loop
  is draw's own reconstruction through them (`TVF_CURVE.core.reconstruct` in `loopOf`, cached by array, so a changed
  path is a new array), ridden at an even speed (`loopAt`, `toyAt`); a drawn loop is laid down by draw's
  `arcLengthResample`. While editing, the menu has Open a .tvf curve (a path, or since Oct 11 a lake, bunker or green: see
  "Lakes, bunkers and greens as .tvf"; as a path, `tvfToPaths`: up to 6 subpaths, 64 leaves; a
  curve from draw is fitted into a 5×7 box at the board's centre, one saved here, `source: minigolf`, keeps its cells)
  and, with a path selected, Save this path as .tvf (`pathToTvf`); a `.tvf` dropped or opened with the field's Open
  button goes the same way (`importTvfFiles`).
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
  - Air raid keeps its taps while its plane flies (`worldTap`: they drop bombs). The smoke test double-taps a neighbour in ten
    games with a game under way and wants the view where the 0 key puts it.
- **The dots, full screen, Tab from the board in view** (Oct 17: "1) the three dots on the bottom for the bottom panel should be
  2px larger and have a shadow. 2) add full screen option to the menu. 3) tab and enter should move to next board, from the
  current visible board that is in the default position."):
  - The bottom row's dots (`#bbHandle`) are 6px across (viewBox 30 × 8, r 3), with a drop shadow.
  - The menu's Full screen (`#bFullScreen`, after Application…) puts the whole page in full screen and back; its label follows
    the state (Escape leaves too); hidden where the browser can't (an iPhone's Safari).
  - Tab and Enter (`stepRight`) step right from the board in view (`viewBoardCell`: `frameSelectedBoardAt` and `frameBoard`'s
    sums run backwards from where the eye stands), not from the board selected before a pan; while the view is where its framing
    put it, or still flying there, from the selected board as before. Games that use Enter themselves (the arcade games, golf's
    putt, Simon's start) keep it; Tab always steps. The smoke test slides the view two boards along in the gallery and checkers.
- **The dots shut the row, and a hold toggles it** (Oct 23: "I can't close the bottom panel by tapping the dots.     long press the
  display should toggle the visiblibility of the bottom panel."):
  - A row an app holds up while you play (`statsStay`: trick shots, the tanks, golf tanks) was put straight back after the dots
    shut it (`bbStatTick`). A row shut by hand (`bbOverride` false) now stays shut; every opening, an editor's too, sets it true.
  - A long press and let go toggles the row in every game. An app's own hold (`onCellHold`) is asked only where it is a move in
    play (`holdIsMove`: Minesweeper's flag, Pipes' and Loops' turn back, Nonograms' cross, Sokoban's undo, Air raid's bomb), and
    so is a right click. Elsewhere a hold used to start the board again, and the notes above that say "a hold starts it again"
    are out of date: the menu's Reset does that.
  - The smoke test clicks the real dots in trick shots and wants the row to stay shut, long-presses the table twice and wants it
    open, then shut, and wants a hold in Simon to flip the field's switch (`window.tvf.bottomRow.visible`).
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
  **The speed rail half as fast** (Oct 17: "velocity scroll bar maximum value is to fast, reduce by 1/2."): the speed is sin θ
  of the lever, and every place on `#thrustZone` asks for half the speed it did (`EdgeGauge.THRUST_SCALE`, 0.5, in
  `thrustFromFrac` and back in `thrustToFrac`): the top gives β 0.50, not 1.0. A swipe's drift and the keys are unchanged. The
  smoke test presses the rail's top and middle.
- **Bigger on a touch screen** (Oct 17: "why is the button and menu so small in mobile, but not desktop.", then "yes"): nothing
  shrank on a phone (the menu button 40 px and the menu's words 11 px everywhere), but a phone's pixel is about 0.17 mm against a
  monitor's 0.26. Under `@media (pointer: coarse)` (a finger, never a mouse) the menu button is 48 px (`--menu-chip`), the menu's
  rows at least 44 px with 15 px words and 300 px wide, and the application picker (`.ap-row`), game index and bucket picker
  follow; fields are 16 px, below which iOS zooms the page when one is touched. `--chip-size` stays 40, since the strip's band
  and tiles are sums on it. A desktop is unchanged. The smoke test measures both, the phone in an iPhone 14 context.
- **Libraries** come from CDNs: three.js r128 (cdnjs), chess.js (jsdelivr),
  pdf.js, unzipit and libarchive (unpkg).

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
- In a cloud sandbox the CDNs may be blocked. Install `three@0.128.0` and
  `chess.js@1.4.0` somewhere and run `LIBS_DIR=that/node_modules npm test`; the
  test then serves both from there.

## Related repos
- **3d:** the shape studio; it exports `.tvf3d`, the chess piece format read here.
- **flare:** the storage Worker this page reads buckets from.
- **draw:** the 2D shape editor; the source of the TVF blocks above (mini golf's paths are its curves).
