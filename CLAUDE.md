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
  **Lighter on a field of thousands** (Oct 9): mini golf's tilt floor is `pitchMin: 62` (50 until Oct 12: "clamp the tilt so that the
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
  whatever its size (the field still asks for none under `itemMinPx`, 20). `railPV`/`railPH`, `landM` and `landL` are no
  longer drawn.
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
  - While the editor is on, its tiles have the row (`rebuildBoardBrowser` asks `statsStay` before the move tiles), so the
    row no longer shows a game's moves: opening it sets up a position, as golf's edits a hole.
  - Without the piece set (as in the sandbox) chess is watch-only and `enterPlay` says so; the position is still the board's.
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
  the pan hold to draw, and asked again after another app, a click, a drop, a change or `window.fieldItemsChanged()`.
- **Nothing moves while the view does** (Oct 12: "restore last update. lets try something different, when panning, no
  object motion anywhere, turn it off."; the update restored was "Lighter boards not selected", #59, reverted). While the
  camera's numbers (`st.camX`, `camZ`, `yaw`, `pitch`, `zoom`) or the window's size change from frame to frame, and for
  `PANHOLD.linger` (250 ms) after, the pan hold is on (`_panCheck`, first in `frame`; `window.fieldPanHold`). This covers a drag, a pinch, a swipe's
  glide, keys, a flight to a board and resizing the window ("no animation when panning or resizing").
  - No board's pieces are asked for, the selected board's included. `_boardItems` draws each from its last list (the
    framed board's list is kept in `_itemCache` too now), and `_restDecide` skips its ask of the framed board. A board coming
    into view meanwhile is asked once and held.
  - The games step only when their board is asked, so they wait. Mini golf's ball in play stops and its clock (`g.t`)
    with it; boards no one plays jump to the page's clock after.
  - The animation clock chess reads (`animTime`) is held (`holdAnimForPan`, `animPanHeld`) and the time held is taken out
    after, so boards playing themselves go on from where they stopped. A pause begun while held keeps the held moment. Time
    dilation does not run while held.
  - When the camera stops, every board is asked again.
  - Left out: an app with `onWorld` (air raid's bomber steers the camera as its game), and one with `panMoves`: mini golf
    (Oct 12: "first turn motion back on in mini-golf., don't stop it during panning."), whose movers and ball run on.
  - Without the linger, a slow drag's frames did not all move the camera, and the boards came alive between them.
  - A hand that is panning holds it too, whatever the camera did that frame (`turn`: a drag past its deadzone, a hold
    pulling to tilt or turn, two fingers; not the app's own drags, such as mini golf's aim). On CI's slow frames a
    finger's moves came further apart than the linger, and the boards came alive mid-drag (Oct 12).
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
- **draw:** the 2D shape editor; the source of the TVF blocks above (mini golf's paths are its curves).
