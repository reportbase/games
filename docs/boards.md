# Chess, the board games and Levels

Chess's position editor and pieces, the board games' editor, share links, flat pieces, Levels.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

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
