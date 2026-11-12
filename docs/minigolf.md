# Mini golf

The course, the generator, difficulty, the ground and its TVF shapes, the movers, the hole editor.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

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
- **The scoreboard** (Nov 4: "show the scoreboard next to each mini-golf hole that shows the hole number, par and current shot #."): `scoreboardItems`, `SCORE` (the menu's Scoreboard, localStorage `golf.score`, on by default). One dark plate along each board's far edge, over the walls, reading `1 oF 5` (Nov 4: "remove the board number.   just say 1 of 5... / 2 of 5 / ect.", then "just say 1 of 5, nothing else.", then "1 of 5,   5 is the par.": the shot you are on, of the hole's par, your own if you set one; no hole number, no board number, no other letters; `LETTER` has o, F and a blank) in seven segments, gold (`LETTER`, the digits' `DIGIT`; the first cut had H, P and S groups, then the place in the round, `1 oF 18`). The shot is the stroke about to be taken (strokes + 1 at rest in play), the one in flight while the ball rolls, what the hole took once sunk, and a dash on a board with no game. It is made again each frame with the board's other pieces, so it follows the game. A long par shrinks the glyphs together to keep the plate inside the board's width. While it is on it stands in for the Hole numbers plate (that item still works with the scoreboard off). The smoke test (the mini golf par check) wants the plate on by default, the shot's segments changing with a game and its strokes, and the menu item turning it off.
- **The scoreboard stands up, and the questions are asked in the page's own box** (Nov 8: "mini-golf should show the shot/par (1 of 4) using the same
  font as the home page.    It should show the shot/par as a sign that is vertical to the golf hole.", "Replace the confirmation dialog font with the system
  font."): `scoreboardItems` is now a sign: a dark board on two short posts standing along the far edge over the walls, its face to the near edge, "1 of 4"
  in `BOARD_KIT.type`'s glyphs (the page's font) on its face. Items stand by `rot` (`SIGN_Q`, worked from the field's own half turn: a flat piece stood up with
  its letters upright and reading across as on the flat); the plate's box is centred on its lift and runs from the middle line out by its thickness, so the
  letters go `sy` past the middle line (`put` takes `rot` and `dv`, a nudge in v). `confirmAction(text, okLabel, onOk, field)` sets the whole box in `UI_SANS`
  and takes a `field` {value} that adds a line to type in (Enter in it is OK); the browser's own `confirm()` and `prompt()` (the flash cards' Remove and Forget
  a deck, the game lab's Forget, mini golf's Set par and Name this hole) are asked there instead, so no question comes in the browser's face. Left: the
  copy-this-link fallbacks and the chess FEN prompts, which are the browser's. The smoke test (mini golf's par check) wants the board and its letters on one
  turn at one height with two posts, and Set par opening the box with a field in the page's sans and Enter setting it.
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
