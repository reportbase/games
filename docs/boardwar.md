# Board War

The war of boards on mini golf's ground.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

- **Board War** (Nov 8: "create a game where boards are at war with each other.   when a board is defeated, it joins the side that defeated it.   create various
  types of missel launchers to lauch missles at each other."): `WAR_APP`, id `boardwar`, after Whack-a-mole (the code's header comment has the whole design).
  - **Sides**: four (`SIDES`: Red, Blue, Green, Gold), a side to each 5 × 5 block of boards by a hash of the block (`regionSide`), the corner's block yours (your side
    is the menu's Your side, Blue to begin; changing it begins a new war). Who owns a board is `ownerOf`: a capture kept in `OWN` (localStorage `boardwar.own`, with
    `boardwar.stats`), else the block's side. Hit points (`HP`, 100, healing 2 a second from `REGEN_AFTER` 6 s after the last hit; not kept) and each launcher's
    reload (`RDY`) are per board.
  - **Launchers** (`KINDS`; every board has all five along its near edge, told apart by their shapes, `GEOS`): mortar (range 1.5 boards, 10 damage, reload 1.6 s),
    rocket battery (2.3, a volley of four at 6, 4.2 s), cruise missile (3.3, 26, 7.5 s, flat and fast), cluster (2.3, six bomblets at 5 scattered over the board, 6 s)
    and warhead (5.3, 55 and 12 on every hostile board round the one it falls on, 20 s). A shot (`launch`) is refused out of range, at a friend or while the launcher
    reloads. Missiles (`MIS`) fly 1.5–4 s along an arc; drawn on the board that fired them for the first half of the flight and on the board they fall on for the
    second (in that board's frame, a board a column on being `PU` = spacing / board width at −u, `spot`), so no board needs another's pieces; bursts and the
    capture ring are `FX`.
  - **A board at no hit points joins the side whose missile finished it** (`hurt`, `capture`): hit points back at 40, its launchers reload, its missiles from then on
    fall on its old friends; missiles already in flight from it keep their old side's name. A missile that falls on a board that has joined its own side by then
    does nothing.
  - **The war goes on without you** (`ai`, `advance`, `pump`): the war's clock is the page's, in steps of 0.1 s, never more than a quarter second a frame; every board
    within `WAR_R` (5) boards of the one in view fires its launchers that are ready at the weakest hostile board in range (a warhead only at one with 50 or more),
    reloading by the kind's time × the board's level (`LEVEL_MULT`: 1.7 at level 1 to 0.65 at level 5, the ring level plus the Difficulty) × a chance; your side's boards
    that you are not on fire at 1.4 × that (`GARRISON`). Measured over six minutes from the corner: about 35 shots a second in the region, a hundred boards changing
    hands, 0.08 s of script per simulated minute. Further out the war waits.
  - **You play** on a board of your side: a tap on one of the five launchers takes that kind (keys 1–5), a tap anywhere else fires it at the hostile board in range
    that lies that way from the board's middle (within 60°, the nearest; a tap in the middle or none that way: the weakest in range), Space / Enter fires at the weakest.
    The row is not used. A tap on another side's board does nothing; `noDoubleTap` on yours, so quick taps are both shots. The title says the side, hit points, level, the
    count of each side within four boards and your side's captures and losses.
  - The smoke test (part 7, "board war") checks the sides, each kind's volley and damage to the point (1:10, 4:24, 1:26, 6:30, 1:55), range, friends refused, the reload, the
    warhead's splash (45, 88, 88 and a friend's 100), a board taken joining the taker's side with 40 back and kept in storage, the pieces, a missile over the board it left and
    then the one it falls on, two minutes of war by itself, and real clicks: one on the third launcher, one toward the hostile board firing the cruise missile there.
  - **On mini golf's ground** (Nov 8: "I was thinking more like combining missle command and mini-golf terrain and walls."): every board is the mini golf hole of its
    number (`holeFor`, golf's own `holeAt`; the page's golf size and difficulty, so its `boardShape` is golf's, `get boardShape`): its ground, rails, walls, fences,
    planters, bumpers and windmills are golf's `cellItems` as they are, less the flag, cup, ball and scoreboard (`KEEP_OUT`), in the owner's colour (white pieces
    multiplied toward the side's, `tintL`, `tintW`; the far tiles' `cellGrid` mixed toward it), the kinds asked of golf's `itemGeometries` through a Proxy. The keep
    stands on the cup (`keepOf`, which every hole guards), the five launchers near the tee each on the nearest free ground (`terrOf`, `padOf`: grass or sand, nothing
    standing there, off the rail, apart from one another). Missiles fly as Missile Command's do and burst on the target board: **a high arc** (mortar, cluster,
    warhead) comes down where it was aimed, a **flat shot** (rockets at `flat` 0.17, cruise 0.10, a height over the ground it comes in at) flies in from the side it
    came from and stops at the first wall cell, fence, boulder, windmill tower or rise of ground higher than it flies (`los`), bursting there in dust. What a burst
    does to the keep falls off with its distance from it (`blast`, `m.f`: `CHIP` 0.18 of the damage anywhere on the board, the whole of it on the keep), so a wall or
    a hill in front of the keep is a shield and where the cup lies matters. `SIM.ideal` (tests) takes away the scatter and the obstacles. A tap on a launcher takes it
    (within 0.085 of its pad), a tap elsewhere fires toward the hostile board that way (true proportions: the board is 8 : 13). The smoke test: the damage by kind
    exact in the ideal case, a golf hole's ground under it without its flag, flat shots stopped and clear on 39 boards and no high arc ever stopped, and a real
    click on the third launcher's pad. The notes above describing the plain boards, bars along the edges and `LEVEL` of the launchers' places are older.
    **Launchers behind cover, and breakable** (Nov 8: "move the missle launchers behind walls and hills so they are protected. and move them around the board
    strategically, not just at the bottom. the missle launchers should take damege and can be destroyed."): each launcher takes the free spot with most `cover` (of
    eight ways a flat shot can come, how many have a wall, fence, boulder or rise within a cell and a half standing over it) near its own anchor on the board (the five
    anchors spread over it, turned by the hole's hash), off the keep and 2.5 cells from one another. Each has hit points (`LMAX` 40, the warhead 60; `lhpOf`, `LHP`):
    a burst within 0.9 of its blast of a launcher takes 1.5 times the missile's damage there; at none it is a wreck (`bwRubble`, cannot fire), built again at half
    after `REBUILD` 60 s, and a board that changes sides has them at half. A shot is aimed at the keep or, with `launch`'s `aim`, a launcher of the target: the
    menu's "Aim at: the keep / the launchers" (the strongest standing, warhead first) for you, 45% of the computer's shots at a standing launcher of its choice. A
    launcher behind a wall is covered from flat shots (they stop at the wall) and exposed to high arcs. The smoke test checks the spread and cover of 30 boards' pads, a
    cruise missile taking a launcher to 1 and then destroying it, the wreck drawn, a wreck refusing to fire and the rebuild at 20.
    **The castle** (Nov 8: "do more construction to build up a castle with walls and a moat, and build them on top of hills and down in valleys. be creative."): the keep
    stands in a curtain wall of ten sides (`castle` in `terrOf`, drawn by `castleItems`) with a tower and battlement at each corner, its gate on the side that faces the tee
    with a drawbridge over the moat that rings it (28 ribbons of water a little above the ground under each, `bwWater`; clipped at the rail), every piece standing on the ground
    under it (`hh`) with the wall's foot sunk so a slope shows no gap. Outworks go where the ground asks: a watchtower with a banner on each of the two highest free places
    and a sunken ward (a low ring of wall with a door and two cottages) in the lowest, off the launchers and each other. The walls and towers are in `obst`, so they shelter
    the keep from flat shots (the launchers keep 3.4 cells off the castle); the curtain is built up and knocked down with the board's hit points (`lost` of ten segments,
    in an order the hole sets, rubble where one stood). The smoke test checks ten corner towers, nine wall segments, a gate and a moat on 24 boards, the watchtowers on higher
    ground than the ward, the walls going to rubble at 30 hit points, and each piece drawn.
    **Four castles, one for each faction** (Nov 8: "make the castles more detailed.     Each color faction should have a different type of castle."): the walls, towers, roofs and
    keep are the owner's kind (`CASTLES`, by side; the ring, moat, gate and shelter are the hole's and the same): Red a Norman fortress (battlemented walls `bwWallM` 1.3 high,
    square battlemented towers `bwTowerSq`, small towers half way along every other wall, a square donjon with corner turrets `bwKeepSq`), Blue a château (slim round towers
    under tall spires `bwTowerFr`/`bwSpire` with banners, an inner ring of lower wall, a keep of turrets `bwKeepFr`), Green a timber stockade (a palisade of stakes `bwPalisade`,
    towers on stilts with thatched roofs `bwTowerWood`/`bwWoodRoof`, a log hall on a mound `bwKeepWood`) and Gold a desert citadel (stepped sandstone walls `bwWallS`, minarets
    `bwMinaret` and domed towers `bwDome` alternating round the ring, a domed palace with four minarets `bwKeepDome`); every side's gate has a lintel (`bwGateTop`), its
    hilltop watchtowers and valley cottages in its own kind. The keep is the faction's colour, the walls a stone of its own tinted a tenth toward it. A tower is sized by its
    kind's width and height (`TWR`: the mesh's width, height and top), so a taller one is a stretch, not another mesh. The ring now shelters the keep from nearly every flat shot
    (a shell comes down onto the keep's foot, under the wall's top, unless it comes through the gate's side): rockets and the cruise missile are for launchers and outer works, the
    high arcs for keeps. The smoke test wants the four sides' castles to differ in walls, towers, roofs and keep, each with its own kinds.

- **Board War: a goal and a territory minimap** (Nov 8: "where could we take this game?" … "proceed"): the war had no end, so the menu's Goal (`CAPTURE_GOALS` 0, 10, 25, 50; localStorage
  `boardwar.goal`, ten by default) is a number of boards to take from the other sides, won when `realm().took` reaches it and lost when none of the 25 boards of your home block is yours
  (`realm`, `checkGoal`); the result is kept once (`boardwar.result`), said once in the page's own box (`confirmAction`, Keep playing), and cleared by a new war or another goal; Free war never ends.
  A minimap (`#warMap`, `mapShow`, `mapDraw`: 61 × 61 boards round the one in view, 3 px a board in its owner's colour, the view in white, home and taken counts and the goal under it)
  stands bottom left while the game is up, redrawn twice a second and when a board changes hands; a tap on it flies to the board (`gotoCell`). Next in the plan: a resource from held castles
  that upgrades launchers, faction doctrines in `ai`, siege tools. The smoke test (part 7, "board war goal") plays the win, the single saying, the defeat, the free war and the map.
- **Board War: doctrines** (Nov 8, "proceed" on the plan): the four sides choose differently (`DOCTRINES`, `chooseFor`, used by `ai`): Red the Rusher (reloads at 0.8, 15% of its shots at launchers, the
  weakest board), Blue the Sniper (80% at launchers), Green the Turtle (1.25, the nearest board, 30%), Gold the Hoarder (a warhead only at a board with 85 or more hit points). The same shots and
  rules; only the choosing differs, and a side's doctrine also drives its garrison boards. A fresh save starts at the goal of ten boards, a war already under way (saved ownership) as a free war, so a
  first capture never ends it at once. Found here: the minimap's hooks first landed in the game lab (an anchor matching an earlier app's identical lines); check which app an edit landed in.
- **Board War: supplies and upgrades** (Nov 8: "What's next" … "Proceed", the plan's next step, a resource that upgrades launchers): your side's boards within `WAR_R` of the one in view each bring
  `INCOME` (0.02) supplies a second (about 1.5 a second at the corner; `advance` adds it, `SUPPLY`, kept as `boardwar.supply`), and supplies buy a launcher kind a level (`UPG`, `upgrade(k)`, up to
  `UP_MAX` 3, kept as `boardwar.upg`): level n + 1 costs `UP_COST` 30 × (n + 1)², each level adds `UP_DMG` (a quarter) to the kind's damage and takes `UP_RELOAD` (an eighth) off its reload, for every
  launcher of that kind on your side's boards (`upOf(side, k)`: the computer's sides are never upgraded), in `launch`. The menu's Upgrade item (the launcher in hand, its cost, greyed when short or at its
  best) and the title (supplies and the five levels) show it; a new war (`newWar`, a change of side) starts supplies and levels over. Fifteen levels in all cost 2,100 supplies, about 25 minutes of holding
  the corner. Not yet at the time: siege tools, the castle's state changing the income (both since done). The smoke test (part 7, "board war: supplies") checks the income, the costs, a mortar's damage 10 → 12.5 and reload 1.6 → 1.408 s,
  the cap and the reset.
- **Board War: castles pay, repair, flak** (Nov 9: "The board war is a playground board to see whats possible and reasonable.", then ideas "1,2,5"): a playground, so keep these
  small and drop what does not feel right. Income is `INCOME` × (`CASTLE_FLOOR` 0.4 + 0.6 × the board's hit points) over your boards within `WAR_R` (`income`), so whole walls pay
  full; the menu's Repair this board (`repair`, `repairCost`: 0.25 supplies a hit point, 0.15 a launcher point) mends the board and every launcher at once; flak (`flakTry`, `FLAK`):
  each board has 2 shots, one back every 12 s, each bringing down a mortar or cluster shell above it with chance 0.55 (rockets and cruise fly too flat, the warhead is too big;
  `SIM.ideal` turns it off so the exact-damage checks stand). The smoke test ("board war: walls whole pay full income") has loose bounds.
- **Board War: escalation, a ram, wind** (Nov 9: "1,2,3" of the next ideas, a playground): the computer's sides upgrade every launcher kind a level per `AI_UP_EVERY` (240) s of the war's age
  (`WAR0`, set by `newWar`; `upOf`; none in `SIM.ideal`); taking a board beside ones you hold pays `CHAIN_HP` (6) hit points and `CHAIN_SUP` (5) supplies for each of its eight neighbours that is
  yours (`capture`; not in `SIM.ideal`); a ram (`ram`, key R, the menu's Send a ram, `RAM_COST` 25 supplies) walks `RAM_T` (8) s to the weakest hostile board within 1.5 and breaks on its keep for
  `RAM_DMG` 45, past walls and flak (a `MIS` entry with `ram`, drawn as three brown shells along the ground); wind (`windAt`: a way turning once in about seven minutes, a strength between 0.1
  and 1) pushes a landing `WIND_PUSH` (0.06 of a board) at most, a high arc fully and a flat shot two fifths (not in `SIM.ideal`), a streamer of dots on every board and "wind N%" in the title.
  The computer rams too (`sendRam`, `RAM_AI` 40 s × its level's stretch × its doctrine's rate, free, a first one at a random time; never your garrison, none in `SIM.ideal`; `RAMRDY`).
  Not yet: spies, a moat that slows. The smoke test ("board war: the computer's sides upgrade …") has loose bounds.
- **Board War: technology and construction grow with time** (Nov 9: "a board in war should get more technology and future construction as time goes on.   the go back to the baseline at when they are destroyed."): every board has
  a tech level 0 to `TECH_MAX` 4 (`techOf`), a step for each `TECH_EVERY` (90) seconds since its baseline (`SINCE`: the war's start, or when the board was last destroyed, which is when it changes hands in `capture`; a new war
  starts every board over; not kept across a reload, since the war's clock starts over with the page; none in `SIM.ideal`). Each step makes the board's launchers hit `TECH_DMG` (10%) harder and reload `TECH_RELOAD` (6%) quicker
  (`launch`, from the firing board), and takes `TECH_ARMOUR` (5%) off the damage the board suffers (`hurt`). It builds (`castleItems`' `tech`): 1 a pennant on the keep, taller walls, towers and keep by 7–8% a step, 2 small towers
  along the walls (the faction's own kind, for the ones that had none), 3 a second ring of wall inside the first, 4 a banner on every tower. The title names it (outpost, fort, stronghold, citadel, fortress city). The smoke test
  ("board war: technology …") checks the steps, none when ideal, a capture back to zero with its neighbour untouched, a mortar's 14 and 1.216 s against 10 and 1.6, 20 damage leaving 84 against 80, and more built at four.
- **Board War: Medium boards, troops, the margins** (Nov 10: "make the boards bigger in board war.   replace the moving bumpers with troops moving around.   use the margins between the boards to
  move troops to other boards to fight."): (1) **Bigger boards** (asked which of three readings: more ground, bigger on screen, zoomed closer; "more ground"): the war is played on mini golf's Medium boards,
  13 × 21 cells, golf's own Board size borrowed (`applySize`: `setGolfSize(size, true)`, not kept as golf's own choice, then the war's app set again so the field takes the new `boardShape`); the menu's Board
  size steps Small, Medium, Tall (`boardwar.size`, default Medium, saved with `save` so as JSON), and `restoreGolf` puts golf's saved size back when another game comes forward (golf too, if that is where you
  went). (2) **No bumpers on loops**: golf tags the bumpers and boulders that ride a path `rider`, and `itemsOf` leaves them out. (3) **Troops** (`GAR`, `TROOPS`): every board has a garrison of up to `GAR_MAX` 4
  foot soldiers in its owner's colour (`bwTroop`, `bwTroopHead`; one grows back every `GAR_REGEN` 12 s) who patrol a loop over clear ground through the launchers' places, the hilltop towers and the ward
  (`patrolOf`, `patrolAt`). A squad of `SQUAD` 3 goes from a board to a hostile board among the eight round it (`sendTroops`, `foes`; the menu's Send troops or T for you, `marchHere`; the computer's boards,
  about every `TROOP_AI` 22 s × their stretch, when the garrison is three or more: `ai`): the route (`troopRoute`) is a gate on clear ground outside the moat, the board's edge, **a point in the margin lane
  between the boards** (the gap `BOARD_FILL` leaves, a lane between every two columns and every two rows), along it when the target is a corner away, the target's edge, and a place on a ring round its
  keep; each soldier's place is worked out from the war's clock along that line in the source board's own (u, v) (`troopAt`, `TROOP_V`), and drawn by whichever board its place falls in (`troopBoards`,
  `troopItems`: a place in the margin belongs to the nearest board). On a friend's board a soldier joins the garrison; on a hostile one he stands and fights (`troopTick`, twice a second): each attacker
  has `KILL_A` 0.34 of felling a defender, each defender `KILL_D` 0.28 (a tenth more a tech step) of felling an attacker, and with no defender left the attackers wear the keep down at `TROOP_DPS`
  2.2 hit points a second each until it falls (`hurt`, `capture`: the survivors become its garrison, `troopsCaptured`). Measured over 40 fights: a squad beats a garrison of one 38 times, of two 28, of three 13,
  of four 7; two squads beat four 29 times of 40 in about 24 s. Not kept across a reload. **Found here: `pitch()` was wrong** (the field puts an item at `cx + (0.5 - u) * bWX`, a board `boardW() * cellW` across
  and `boardW()` down, so a neighbour is 1.11 boards away in u and in v alike; `pitch` gave 0.68, the board's width over its height, twice), so a missile's far end was drawn two fifths of a board short of
  the board beside and a tap's direction was read through a squashed pitch; both now follow the real one. The smoke test ("board war: no bumpers riding loops …", written on the Small boards, the earlier
  war checks too: `boardwar.size` set to small first) checks the pitch, no rider, a garrison of four drawn on every board, a squad out through the edge, along the margin and in, two squads taking a
  garrison of one, a friend's board taking a squad in, Medium boards and golf's size put back.
