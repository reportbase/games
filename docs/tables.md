# Table and ball games

Pinball, Pong, air hockey, squash, curling, bowling, marble run, the tanks, trick shots, and the three taken out.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

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
