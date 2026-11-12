# Puzzles and makers

The tilt maze, Bejeweled, Simon, Lights Out, Whack-a-mole, Nonograms, Sudoku, Hashi, Sokoban, the puzzle makers, 3D Tetris, Soma, the flash cards, the game lab.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

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
  - **No colour dots** (Nov 1: "simon - remove the bottom row, and move the top row to the bottom."): the strip of one dot a colour went. The ring is drawn at `RING_K` to leave the strip for the slider.
  - **The history slider** (Nov 1: "the top of simon board should have a slider that lets the player pan through the current games history.", then moved to the near edge, `SL_V` 0.95): along the near edge a row of dots, one for each step of the sequence so far (`g.n`, from two steps up), oldest on the left, each in its pad's colour (`sliderItems`, `slSp`). A press on that strip (`SL_HIT`, the bottom tenth of the board; `claimsPan`, so the view never pans under it) or a drag along it (`onPan`, the tap after a drag eaten) picks a step (`g.view`, `look`, `viewAt`): its pad lights with its tone, its dot is ringed white and the answer's clock stops. A tap anywhere else, a pad pressed or the next round puts it live again. **Shown and hidden** (Nov 1: "toggle the bottom row visibility by clicking anywhere in the margin or board background."): a tap past the pads' ring (`padAt` gives 'bg' beyond `R_OUT` × `RING_K` × 1.12: the margin and the corners) toggles the slider (`SLIDER`, localStorage `simon.slider`); the gaps between pads and just past a rim are still the pad. The ring is `RING_K` 0.84. The smoke test ("simon: a real drag along the top slider") drags it both ways with the real mouse.
- **Simon plays songs** (Nov 8: "can you add buttons to pre-set songs?", then "Simon: play a tune"): the bottom row (`statTiles`, `onStatTap`: the three dots now show on Simon) has an Own tile and a button a song
  (`SONGS`: Twinkle, Mary's lamb, Ode to Joy, Jingle Bells, Happy Birthday, then (Nov 8: "can you add more songs?") Row Your Boat, Frère Jacques, Au clair, Hot Cross Buns, London Bridge, Itsy Bitsy and the Fifth Symphony, twelve as MIDI notes, 8 to 27 long; the menu's Song steps through them too); a tap begins that tune on the framed board (`playSong`, `songSeq`): round n
  plays its first n notes and you play them back, the whole song played back wins (`finishSong`, the best kept under `s<k>` in `simon.best`). Each distinct note is a pad, lowest first and clockwise, the pads 4, 6
  or 8 as many as the song has notes, and a pad sounds at its note's own pitch (`S.freq`, `beep`'s fourth argument) so the tune is the tune and not the toy's four tones; a song's steps are one length
  (`D` on 0.4 s, gap 0.12, 5 s to answer). The song in hand (`SONG`) holds for the session and every game made while it is up (a reset, another board) plays it; Own puts the board's sequences back. The
  smoke test (part 7, "simon songs") checks the pads, each pad's pitch, the buttons, round n playing n notes, Twinkle won and kept, and a wrong pad losing.
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
  - **A margin and a history slider** (Nov 1: "similarly, the memory game should let the user browse the games history. adjust the board size to accomodate.", then "move the history slider to the bottom of the board."; `FRAME`, `sliderItems`, `viewIdx`): `MEMORY_APP`'s cards stand in a board one square larger all round (a 6 × 6 is 8 × 8 squares of the board, `gridOf` gives `n + 2`, the margin a dark wood; `itemsOf`, `onCellTap` and the far fabric follow), and the bottom margin holds a dot for each turn so far (`g.moves`, `{ a, b, hit }`, from two turns up): green for a pair made, red for a miss, oldest on the left. A press or drag along it (`claimsPan`, `onPan`) picks a turn (`g.view`): the pairs made up to it and its two cards turned up (`viewOf`), the dot ringed white; a tap on a card puts it live again. The smoke test ("memory: the cards in a margin …") drags it with the real mouse.
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
- **Sudoku** (Nov 7: "lets build a new game based our experice with the other games"): `SUDOKU_APP`, id `sudoku`, after Nonograms. The
  classic, built the way the other puzzles were: every board its own puzzle, harder further out, one answer, rated by a solver that plays
  like a person, the board itself the controls, a board no one plays solving itself.
  - **Every board its own puzzle** (`makePuzzle(idx, lv)`, `puzzleFor`, `PUZZLES` 1,500): from the board's number (`boardIdx`) at a level
    1–5, the ring level plus the Difficulty (Easy 0, Normal 1, Hard 2), as Lights Out and Nonograms. `LV` (a level's grid, the givens it may
    keep, the grade of the human solver it must need, the full grids to try): 6×6 with 2×3 boxes; then four 9×9s: grade 1 (naked singles
    alone, 40–46 givens), 2 (hidden singles, 32–37), 3–4 (locked candidates, pairs and triples, 27–31), 4–5 (X-wing, swordfish, XY-wing, 22–27).
    Measured on 60 boards a level: every one with one answer; givens 16.7, 42.8, 33.5, 28.4, 26.3; mean grade 1, 1, 2, 3.2, 4.6; 0.1, 0.3, 1.7, 15
    and 47 ms to make (154 at worst).
  - **The solvers** (`SUDOKU CORE START … END`, pure, so a probe can run them in node): `suSolve(N, grid, limit, R)` counts answers by
    backtracking on the square with fewest candidates (a full grid is one drawn from an empty grid with `R` shuffling the digits);
    `suRate(N, grid, firstOnly)` is the human solver, easiest first and one thing at a time: naked single (1), hidden single (2), locked
    candidates (3), naked pairs and triples and hidden pairs (4), X-wing, swordfish, XY-wing (5); its `steps` are the placements in order,
    each with the grade of what it took since the last, and its `level` the puzzle's grade (checked against the answers over 300 puzzles: it
    never put a wrong digit down, and about 12% of minimal puzzles stall it, which is why the hardest levels keep trying). `suMake` takes
    squares out of a full grid (a square and its half-turn twin together) while one answer remains, down to the level's givens, and keeps the
    first of up to `tries` grids whose grade is in the level's band, else the nearest (a board whose grade missed says "beyond the logic here").
  - **Boards looked at are made a few milliseconds a frame** (the boards' share of time, `SOON`): a level 5 takes 47 ms on average, one go a
    visible stop, so `suMake` is worked a try at a time and carried on from where it got to (`suJob`, `JOBS`); the answer is the same however
    it is paced (`makePaced` in the smoke test). The board you play is made at once.
  - **The board is the controls** (Oct 28, "Games play with the row shut"): M = N + 2 squares across, the grid in a margin of one; the far
    margin holds the level as dots in its flag colour, the clock (m:ss, seven segments) and a red strike for each fault (most five), the near
    margin the digits 1 to N as buttons (cream; dim where a digit is all placed). Tap a square (gold; its row, column and box a cool tint, the
    same digit a warm one, a wrong digit pink), tap a digit; the same digit again takes it out; a given never changes. The play pad has what a
    gesture does not: Notes (pencil marks, a bit a digit, small digits in the square from boards 240 px wide; a digit put in clears it from
    its peers' notes), Erase, Undo and Hint. The keys do it all: 1–9, Backspace, arrows (the screen's directions, `screenToBoardDirs`), N, Z,
    H (not 0, which frames the board). No message ever shows; the title says what the game is (`cellTitle`: the level, the grade, best, the
    digits placed, the hint's technique).
  - **Faults and stars**: a wrong digit put down (shown red as it goes in; the menu's Show mistakes turns that off) or a press of Hint is a
    fault; none ★★★, one or two ★★, more ★; the best (most stars, then quickest) kept (`sudoku.best`, by board and level). **Hint**: a wrong
    digit is found first (shown pink; the second press puts the right one in), else the human solver is asked for its next step from the
    digits as they stand (never your notes), the square lit and selected and the technique in the title, the second press putting its digit in;
    a grid it cannot go on from lights the square with fewest candidates and says it is a guess.
  - **A board no one plays solves itself**: its givens, then each digit in the order the human solver found them (`P.order`; a stalled
    puzzle's rest in answer order), a step (0.32 s) apart, the grid held, then again, each board at its own phase (`shownView`, `cycleOf`).
    Solved, a tap plays it again where it is.
  - **`BOARD_KIT.flat`** (`geo`, `rect`, `digit`, `cross`): Nonograms' flat unlit pieces and seven-segment digits, moved into the kit whole
    so the two share one copy (item kinds `skD0`…`skD9`, `skX`, `skDot` here).
  - Found building it: the sandbox's software renderer takes 2–5 s a frame (the page's JS is idle 97% of that, Sudoku's included), so a
    camera that "looks still" over four looks a quarter second apart is only between two frames: a real click right after `__settle` landed
    off the board. The check aims only once the point reads back as the square and holds still 300 ms (`aimAt`).
  - The smoke test (part 5) checks the sizes and levels by ring, 30 sampled puzzles each with one answer that the human solver finishes with
    the answer's digits, the climb in givens and grade, a classic grid's one answer, an empty 4×4's many and a broken grid's none, a paced
    make equal to a whole one, the rules by hand (a given fixed, notes, a digit clearing its peers' notes, undo, a wrong digit, both hint
    presses, the stars), real input (a click on a square and a digit, a given staying, the same digit taking it out, the keys, arrows,
    Backspace, Z, the play pad's four buttons, a real click finishing a puzzle and another starting it again), four quick real touches on one
    digit, and a board no one plays going through every step of its solve.
- **Hashi** (Nov 7: "what next game should we add", then "hashi"): `HASHI_APP`, id `hashi`, after Sudoku. Bridges: islands on a sea carry numbers;
  lay one or two bridges between islands that face one another along a row or column so each island has its number, none across another, all
  one group. Built the way Sudoku was.
  - **Every board its own sea** (`makePuzzle(idx, lv)`, `puzzleFor`, `PUZZLES` 1,500): from the board's number (`boardIdx`) at a level 1–5, the
    ring level plus the Difficulty (Easy 0, Normal 1, Hard 2), as Lights Out and Sudoku. `LV`: 7, 9, 11, 13 and 15 squares a side with 8–10,
    14–17, 22–26, 32–38 and 44–50 islands, and the grades a puzzle may need (see below). Islands are never side by side (a bridge needs a square
    to lie on); two are a pair when they face along a row or column with no island between (`hsGraph`: `E` the pairs with the squares between
    them, `cross` the pairs each would cross, `by` an island's pairs, `islAt`, `eH`/`eV` the pair a square lies on).
  - **Made so it has one answer** (`hsLayout`, `hsMake`): a layout is grown, each island a bridge away (2 to `reach` squares) from one with
    nothing that way, on squares no bridge lies on, then loose neighbours are joined now and then for loops (`o.p2` the share given two bridges,
    `o.extra` the loops); the numbers are what each island ends up with. It is kept when the human solver (`hsRate`) finishes it, which proves one
    answer, or `hsSolve` (backtracking over the techniques, to two answers) finds exactly one when the human solver stalls; the hardest technique
    it needed must fall in the level's `grade` band (and `ifs` what-ifs at least, level 5), else the nearest of `tries` is kept (`P.miss`).
    Measured on 60 boards a level (Node): 0.3, 0.7, 0.9, 1.3 and 36 ms each (level 5 takes about 30 layouts to find one with one answer that needs
    two what-ifs), every one in its band; the human solver and the backtracking solver agree on 600 random layouts, and a layout's own bridges are
    always an answer.
  - **The human solver** (`hsRate`, `hsProp`): each pair holds the fewest and most bridges it can still take (`lo`, `hi`, 0–2, hi starting at
    the smaller of 2 and its two islands' numbers); a technique is one sweep, the easiest first, back to the easiest after any change: 1 counting
    (an island's bridges add up to its number: what it needs against what its neighbours can still give), 2 crossings (a bridge laid shuts every
    pair it crosses), 3 loose groups (a bridge that would close a group of full islands off from the rest is not laid; `hsGroups`), 4 the way out
    (a group not yet joined with one way left takes it), 5 what-ifs (a pair's fewest or most, followed through 1–4, cannot be). The grade is the
    hardest technique that changed anything; 6 is a puzzle it stalled on. (Found while checking: the loose-group rule counted an island's need
    with the pair's own bridges in it, so it closed a pair off that was not; fixed by a run of the two solvers against each other.) Way out
    (4) is rarely the hardest need: the levels' bands are counting, crossings, loose groups, then what-ifs.
  - **The board is the controls**: `M = N + 2` squares across, the sea in a margin of one, the far margin the level's dots, the clock and a strike
    for each fault. Tap an island and the next one it faces (the second becomes the first of the next pair), drag from island to island (one drag
    goes on through several, `claimsPan`, `onPan`), or tap the sea between two islands (`tileAt`: at a crossing, the pair with a bridge, else the
    line nearer the tap): a pair goes none, one, two, none (`cycle`); a pair another bridge crosses cannot take its first. An island turns green
    when it has its number and pink with too many; the pairs the selected island could still bridge show pale blue. The play pad has Erase (the
    island's bridges, one move), Undo and Hint; the keys: arrows select the neighbour that way (the screen's, `nbrDir`), Shift with an arrow lays the
    bridge, Backspace, Z, H. `noDoubleTap` while a puzzle is on the framed board.
  - **Faults and stars**: a bridge laid that the answer does not have (the count above the answer's) shows red (the menu's Show mistakes turns that
    off) and is a fault; a press of Hint is one. The first press lights the pair the next logical step finds (the solver run from the bridges as they
    stand, `hintOf`: a wrong bridge first, else `hsRate`'s first bridge laid; no logic left lights a pair the answer wants and says it is a guess)
    and the technique in the title, the second lays it. None ★★★, one or two ★★, more ★; the best on a board is kept (`hashi.best`).
  - **A board no one plays** lays its bridges one at a time in the order the solver found them (`P.order`, `shownView`, `cycleOf`: 1.6 s bare, a
    bridge every 0.32 s, 3.2 s held, each board at its own phase). Boards only looked at get their puzzle a few milliseconds a frame (`SOON`,
    `JOBS`, `hsJob`: a job is a layout a try), bare sea till then.
  - The smoke test (part 5) checks the sizes and levels by ring, 30 sampled puzzles (one answer, the solvers agreeing, a valid answer, the grade in
    its band, the order laying the answer), the climb in islands and grade, the solver on a ring of 2s, 3s and 1s, a crossing and two islands side
    by side, a paced make equal to a whole one, the rules by hand (the cycle and its fault, undo, a crossing refused, erase and its undo, a wrong
    bridge's hint, the stars), a hint's step sound from fifteen states a player could be in, real input (clicks on two islands, the sea between them,
    the keys, the play pad, a real drag laying two bridges, a real click finishing it and another starting it again), four quick real touches, and
    a board no one plays going through every step.
- **A lone 1 stands in the middle of its square** (Nov 7: "#1 is not center aligned", on Hashi's islands; Sudoku's and Nonograms' squares had it too):
  the kit's seven-segment 1 (`BOARD_KIT.flat.digit`) is two strokes at its glyph's right edge, so a piece laid on a square's middle put the 1 a
  fifth of its height to the right (2048's digits were centred the same way on Nov 1, `figures`). The three games' `numItems` (Nonograms', Sudoku's,
  Hashi's) shift a number that is a lone 1 back by `BOARD_KIT.flat.ONE_AT` (0.19) of its height; a 1 beside other digits (a clue of 12, a clock) stands
  in its slot as a calculator's does. The smoke test (Sudoku's and Hashi's first checks) wants every digit's ink on its column's or island's middle. The
  idle-board checks (Sudoku, Hashi) now sample until the board has moved three times, up to a cycle: a four-second window fell wholly in the rest at either
  end of a cycle about one run in ten.
- **Soma's "can it be built" click waits for its tile** (Nov 7, CI on the Home PR, smoke 4/7): the real click on the row's ✗ tile was skipped when the tile
  had not been laid out 700 ms after the row opened (a busy runner), so the hint was never counted; the check now waits for the tile to be found and to
  hold still (up to 10 s) and keeps where it clicked for the failure's message. Nothing in the page changed.
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
