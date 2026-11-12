# Arcade games

Invaders, Missile Command, Asteroids, the crossing, tower defense.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

- **Invaders: forward, a smaller easy board** (Nov 6: "Invaders let the user move forward.  Add difficulty menu setting.   Less difficult
  smaller board and slower.    Further from center more difficult boards."): the ship has a `y` (up, down, W, S, or a drag up the board;
  `FWD` 9 squares from its base line, `SHIP_Y`); its shots start and bombs, pickups and rammers meet it there; invasion is still the
  formation reaching the base line. The Difficulty (already by ring, `lvAt`) also sets the formation's width, `DIFF[lv].cols` 7, 9, 11
  (`formation(level, lv)`, `f.cols`; shapes are cut from the middle of the eleven), and easy marches 0.65 and fires 0.7 as fast.
  The boards' recorded reels are made at normal. The smoke test ("invaders: a smaller formation when easy …") checks both.
- **Invaders' board grows with the Difficulty** (Nov 6: "easy should have smaller board size, normal should have medium board size."): a game carries
  its board's side `g.n`, 16 on easy, 20 on normal, 24 on hard (`DIFF[lv].n`); `N`, `SQ` and every length in squares (`PIECE_S`, `SHIP_S`,
  `MARGIN`, `SHIP_Y`, `FWD`, the shields) are worked out again by `use(n)`, which each entry point calls with the game's own `n`
  (`step`, `frameOf`, `fire`, `loseShip`, `botInput`, `cellItems`, `onPan`, `drawIcon`). A smaller board has bigger squares, so bigger
  pieces and a ship, fewer across (`cols` 7, 9, 11). The checkerboard follows (`checkerOf(n)`); boards no one plays show recordings at 20.
  A waiting board takes its size afresh when the setting changes (`relevel`), a game in play keeps its own.
- **Invaders' Difficulty changes how it plays** (Nov 6: "the difficulty menu option should affect game play.   more difficult boards should be harder to
  play."): beside the size, `DIFF[lv]` sets ships (`lives` 5, 3, 2), the march (0.55, 1, 1.4), how often they fire (`rate` 1.7, 1, 0.6) and how
  fast their shots fall (0.6, 1, 1.3), the ship's cooldown between shots (`cool` 0.7, 1, 1.4), the step down at each edge (`drop` 0.6, 1,
  1.25) and how many bombs may be falling (`cap` −1, 0, +2). A board plays at its ring's level (`lvAt`), so the far boards are the hard ones.
- **Invaders: power-ups from kills, twelve formations, one to a board** (Nov 6: "Yes.   also add different formations of invaders."): a destroyed
  invader may drop a power-up (double shot, rapid fire, shield, pierce; the mystery ship that used to drop them is still off) at `DIFF[lv].pwr`
  (1 in 6 on easy, 10, 16 on hard) lasting `pwrT` seconds (14, 10, 7). `SHAPES` has twelve waves (the block, a V, a diamond, a checkerboard,
  a frame, two wings, a pyramid, a chevron, columns, a cross, an hourglass, stairs), cut from the middle of the eleven at any width, and a board
  begins at its own (`g.seed` = board number mod 12, `formation(level, lv, seed)`), going round them as the levels climb (a boss every fifth).
- **Invaders' power-ups have sounds** (Nov 6: "Add sound"): a blip as one drops from a kill (`drop`), a rising run when it is caught (`power`, which
  replaced the level jingle there) and a sinking tone when a timed one wears off (`expire`), all through the game's own Sound switch (`SND`).
- **The crossing's strikes, taken out** (Nov 1: "seems like it would be better to just ignore the cells. its very difficult to get across, so you need full control of the pieces and know how to avoid them. cell based contact conflates that."): `CROSSING_APP` (Sep 27 to Nov 1) had the pieces take aim now and then at the squares they attack in chess, lit red for a moment, and took you on one when it struck ("Checkmated by a …"). Gone with its warning squares, sounds and Difficulty dials: only touching a piece catches you (`hitBy`, a piece on your rank within 0.62 of a square of the pawn and more than half out of the rim). The smoke test ("crossing: only touching a piece catches you") leaves a pawn on its start square for a minute.
- **Missile Command's look** (Nov 7: "Missle command uses bad animations.  It should be a beautiful game with explosions and effects from the other
  games"): the rules are as they were (`blastR`, the speeds, the bot's aim, the waves, `D(g)`); what a board draws is new, in the other games' ways.
  - **The sky is a picture** (the photo tier, as the tanks'; `paint`, `photoKey`, `PIC`): stars (faint, bright with a glow, a few with a cross),
    soft colour clouds and a band, a moon on some boards, a haze at the horizon, two far skylines with their windows lit, over cratered ground with a
    lit rim. Four skies (`SKIES`: night, dusk, ember red, polar green), one of `SKY_N` = 24 pictures by the board's number (so a field of boards shares 24
    textures, not one each), the corner's the night; 512 px from a board `HI_PX` (320) across, 256 under. The marks are laid in a few canvas paths
    (a canvas pays by the call): 4–5 ms a sky on a software canvas (the sandbox's GPU canvas, `--use-angle=swiftshader`, takes 100 ms for the same).
  - **Effects are worked out from how long ago and a seed** (the tanks' `fxItems`): `g.fx` keeps what happened ([kind, x, y, age, seed, mine, angle] in a
    snapshot: `l` a launch, `b` a burst, `i` a ground impact), `g.scars` where the ground scorched (the last 24, shared between snapshots until a new one),
    `g.ruin` when each city and base fell. A recording is snapshots, so it shows all of it with nothing else kept (about 425,000 numbers for three
    minutes of reels; baked in 35 ms).
  - **A burst** (`burstFx`) is exactly as big as what it can destroy (`blastR` at its age: the player reads the danger from it), a core and six boiling
    lobes in colours a little apart, cooling with its life (yours white to cyan to blue, the enemy's white to yellow to red: the old ball flashed
    between two colours twelve times a second), a glow wider than it (light, not harm), a ring of shock, sparks that fall, and smoke rising from an
    enemy missile shot down. **A missile** is a hot head in a glow and a line behind it that cools to dark red, with smoke along the enemy's that spreads
    and thins with its age (`foeFx`); yours cyan, with a flickering exhaust and a ringed cross that closes in on where it will burst (`shotFx`). The line
    is stretched boxes turned along the way (`streaks`: `sx` and `yaw`). **A launch** has a muzzle flash and smoke; **a ground impact** a flash, a ring along the
    ground, a fireball thrown up in lobes, dust, embers (and `BOOM`'s rock debris, as before) and a scorch that stays; a city or base destroyed burns and
    smokes on for the rest of the game, less as it goes (`ruinFx`). Cities have lit windows that flicker (three patterns turned through), a beacon and
    a spire; a bunker a barrel that turns to the last target, a lamp (green, amber at three or fewer, red and blinking at none) and its missiles in rows;
    the score and the wave are lit in the sky (seven segments from `BOARD_KIT.flat`, the score's leading zeros dim, a pip a wave).
  - **A recording's player overlooks one missile in eight** (`MISS_P`, a foe made with `skip` only in a recording): the bot is so good that no recorded game ever
    lost a city, so no board showed an impact, a scorch or a ruin; now they do, and a game taken over from a recording goes on from there.
  - **Cost**: windows are quads (two triangles each) not boxes; about 68,000 triangles for the 33 boards in a framed view (checkers' framed view
    is 57,000), 1,400 pieces; `asItems` 0.12 ms a board. Every board draws all of it at any size (Oct 12: "no special handeling").
  - **Sounds** (`sfx`): a launch a rising whoosh, your burst a low boom with a bright crack, an enemy missile shot down a pop, an impact a long deep thump and
    rumble; only the board in play, no kind twice within 45 ms.
  - The smoke test (part 5, "missile command") checks a computer-played game leaving all three kinds of effect and drawing every kind of piece, a burst's
    ball exactly `2 × blastR` at six ages and gone at 1.25 s, its colour never jumping by more than a third of a channel's range between two frames,
    yours blue and the enemy's red, a snapshot drawn the same twice and another seed another picture, a launch turning the barrel, three impacts leaving
    ruins, scorches and fire that dies down, the lit score, a recording's frames, the sky's sizes, keys, luminance (a haze at the horizon over a darker
    ground), stars, windows and four skies, and a real click starting a game and the next firing.
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
  **Always black** (Nov 1: "astroid background and difficulty color should always be black."): space is `0x000000` in every look (the 3D one was `0x05070d`, Neon's deep violet) and the app says `noDifficultyColor`, which `diffRefresh` reads as no level mat under its boards (`DIFF.on` false, near and far), so the field shows its own dark ground.
  **Snake stops at the sides** (Nov 1: "snake should not crash when hitting the sides. it should just stop."): in `SNAKE_APP`'s `step` a head that would leave the board stays where it is that tick, its body unmoved, and goes on once it is turned; the sides no longer kill (bodies, hazards and heads meeting still do). The smoke test ("snake: a head at a side stops …") steps one into the top edge and then turns it.
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
