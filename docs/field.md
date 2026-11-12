# The field and what every game shares

Home, taps, holds and double taps, the bottom row, the rails, levels by ring, the kits, fonts, drawing and resting, speed.

Moved here from `CLAUDE.md` (12 Nov 2026), unchanged and in the order they stood there: the dated notes of what was built, with the owner's words, the names to search for in `games.html` and the numbers measured. `CLAUDE.md` keeps the rules; read this before working on this part, and add to it when you change it. A later note overrides an earlier one where they differ (several say so).

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
- **Difficulty reads Easy, Normal, Hard** (Nov 6: "The menu options for difficult should say Easy Normal  Hard.  for all applications."): every
  game's Difficulty item says `Difficulty: Easy | Normal | Hard` (`ARCADE.levelName`), as mini golf's does; "at the corner" left the label
  (the item's title still says the rings step harder, `ARCADE.FARTHER`). The smoke test's per-game level check reads the label that way.
- **No double-tap reset** (Nov 6: "remove the double click reset game option"): a double tap no longer asks "Start this game over?" or begins a
  finished board again (`gameDone` is no longer read by the field); on the board you are on in its default view it is the lock/reframe
  it was before Nov 1. The menu's Reset starts a game over. The notes of Nov 1 on a double resetting a completed board and on the
  confirmation are out of date, and so are their smoke checks, which are gone.
- **Sound starts on the first gesture** (Nov 6: "sound is broken everywhere"): the kit's audio woke only on `pointerdown`, which a phone's browser does not
  count as a gesture for sound, and the ring/silent switch muted a page that had not said it plays sound. After `ARCADE`, the first
  `pointerdown`, `pointerup`, `touchend`, `click` or `keydown` anywhere wakes `ARCADE.audio()` and plays a silent sample inside it, and
  `navigator.audioSession.type` is 'playback' (Safari 17+). Not heard here (no speakers); checked only that the context runs. Games with an
  audio engine of their own (pinball, the tanks, trick shots, air raid, Simon, Asteroids) start theirs as before.
- **Home: every game a board, and the page opens on it** (Nov 7: "how about a home page, that shows all games as a board"): `HOME_APP`, id `home`,
  before the gallery in `FIELD_APPS`. Each game is one board: its own little board drawn big (the picture the application picker and the bottom row
  draw, `drawIcon`; chess's the opening position as the picker draws it) on a mat in a hue of its own (the golden angle round the list, so neighbours
  never match), its name along the foot, fitted to the width (`paint`, the photo tier as Missile Command's sky: 512 px from a board `HI_PX` 300 across,
  else 256, `PIC` keeps 160). The games are sorted by title (`order`: plain alphabetical, 2048 before 3D Tetris, `NAMES` fixing the four the picker's
  rule leaves run together or wrongly cased: Air hockey, Whack-a-mole, Pac-Man, 3D Tetris), eight across (`COLS`), row after row from the corner
  (`slotAt`: a column and row through the field's wrap); **read left to right and top to bottom, as the photo gallery's pages are, and the block
  repeats over the whole field so no board is bare** (see the Nov 7 note below: the first game is the corner board, top left of its block). A new
  game appears by being in `FIELD_APPS`; nothing is registered with Home. Nothing here plays, so the field rests; a board too small for its picture
  is its game's hue (`cellGrid`).
  - **Opening a game**: a tap on the framed board (`onCellTap`), a double tap on any board (`startOnDouble`, after the field has framed it) or the
    menu's Open the game on this board open it on its FIRST board, the corner (`openGame`, `openApp(a, [0, 0])`), where its levels begin. `openApp` is
    now the one way in for the application picker too (it was the picker's click handler: `setFieldApp`, `syncAppSelect`, the gallery asking for something
    to show); an `at` takes the view to a board after, settled at once.
  - **The page opens on Home**, framed on the game you were last in: `restoreLastApp` used to reopen that game; it now opens Home
    (`rememberLast(name)`), and `setFieldApp` calls the arriving app's new `onEnter(prev)` hook, which takes Home's view to the board of the game just
    left (from the picker or the menu) or of the remembered one (the page's start; none at a first visit, the corner board). `FIELD_APP_KEY` still holds the
    last GAME (Home, `isHome`, never overwrites it). Home is first in the picker (`_appsByTitle`), with a thumbnail of its own (`iconMosaic`, since the
    picker asks every app's `drawIcon` for the board at (3, 5)). A page that names its game (`?app=`, a share link, a file or bucket) opens that, as ever.
    To go back to opening the last game itself, `restoreLastApp` is the one place.
  - The tilt maze, pinball and Levels had no `drawIcon` (their picker thumbnails and bottom-row tiles were flat or blank, and their boards here would
    have been): each has a small one now (a maze with its holes, ring and marble; a table with bumpers, flippers and ball; the corner's rings round a body).
  - The smoke test (end of part 1) checks every game on one board each in the picker's order and nothing past the block or the wrap, the names, a picture
    for each of eight games (both sizes, painted: colours on the board and a name at the foot) and none past the block, `restoreLastApp` (named: nothing;
    else Home, framed on the golf slot, the last game still mini golf), the application picker (Home first, one row an app, Home from chess framed on
    chess's board), a real click on the framed Tetris board opening Tetris on (0, 0), and a double tap opening Sudoku there. The test harness opens
    `games.html?app=chess` (the page's old opening, so every check begins where it did), and the My holes reload check names `?app=minigolf` (a plain reload
    used to reopen the last game).
- **Home sorted by title, read like the gallery, and steady** (Nov 7: "the home page should be sorted by game title.    the home page should be
  arranged like photo gallary, where the pages are arranged left to right and top to bottom.    the home page has draw problems sometimes if flashes."):
  - **Sorted by title** (`order`): `localeCompare` with `numeric: true` put 3D Tetris (3) before 2048; it is plain alphabetical now (`sensitivity: 'base'`,
    the id breaking a tie), so the block starts 2048, 3D Tetris, Air hockey, Air raid, Asteroids, Ataxx, Bejeweled, Bomberman.
  - **Left to right, top to bottom** (`slotAt`, `slotOf`): the field numbers a board's column and row UP the screen's left and far side (the gallery's
    pages go right and down by FALLING numbers, `pick`: −(row + col)), so Home read right to left and bottom to top, Chess's neighbour Checkers on its
    right. A game's place across is now minus its column's distance from the corner (`fold`) and its place down minus its row's: the first game is the corner
    board (0, 0), the block runs right and down through the field's wrap (the second game is board 9,999, the ninth 0, 9,999), and `slotOf` gives the
    board's own wrapped, never negative column and row (`onEnter` flies there). Tab steps right, so it steps to the next game by title.
  - **Every board has a game** (Nov 7: "your screen shot for home shows the games on the bottom browser.     keep them in the main viewer.    all boards
    should have  a game, don't leave empty boards.  see photo gallary."): I had left the field past the 8 × 8 block bare, so a zoomed-out view showed the block's
    far row along the bottom edge of the screen like a strip, and the user took it for the bottom row (Home's bottom row is empty: the games are boards,
    not tiles in it). The block now repeats over the whole field, as the gallery's prints do: a board's game is its place in the block (`slotAt`: minus
    its column and minus its row, modulo the block's side `cols`), the 64 cells holding the 58 games in order and the last six taking the first six again
    (game number modulo the count). The side is the smallest of 8, 10, 16, 20, 25, 40, 50, 80, 100 that holds every game, always a divisor of the
    field's side (10,000), so a board's wrapped number and its raw one give the same game and the repeat has no seam at the field's wrap. The far field's
    texture is the same block (`fabricRepeat` the side, `fabricCellAt` each cell its game's mat colour, which is what a board too small for its picture is),
    so a board keeps its colour from its picture to the horizon (the texture's cell is the world's column and row modulo the block). `slotOf` is a game's
    first block's board, where `onEnter` flies. Looked at in screenshots at three zooms: every board a picture with its name, rows reading left to right,
    no hole counted and none declined (82 pictures, 52 MB of textures).
  - **Why it flashed** (found by reading the photo tier and tracing frames): (1) the field counted every board that wanted a picture and drew none as a
    HOLE in the ground (`_photoHoles`), which makes the fabric draw all the way in (`uNear`) and stops the field resting; Home's boards past its block
    (and any whose picture was past the frame's budget) counted, 587 frames of 618 while panning, and the fabric's edge switched with the boards in view.
    An app that says `photoHolesOk` fills such a board itself (`cellGrid`, real geometry), so it is no hole: Home says it (0 hole frames of 586 now).
    (2) A picture waiting on the frame's build budget showed its flat hue for a frame or more, then jumped: an app's `photoUrgentPx` (default 120
    with `photoFullAtOnce`) is the size from which a board never waits; Home says 0, so none does, and `photoFullAtOnce` too, so no small copy is
    sharpened later. (3) A picture was made again whenever its texture was (a mesh let go after 600 unused frames, a board crossing 300 px taking the
    other key), and some games' `drawIcon` shows what is happening now (a table's reel, a board's live game), so a board could come back as another
    picture: the icon is drawn once, about 400 px, and kept (`iconOf`), the small picture is kept too (`lowOf`), and both are made ahead in the browser's
    idle time from the page's start, a game a turn (`warm`), so the first sight of the whole field is only texture uploads. Not seen in the sandbox's software
    renderer as one flash in isolation (a trace of 875 frames over a pan showed one board missing for a frame and five key swaps), so these are the
    causes found and closed, not one reproduced and fixed.
  - The smoke test (end of part 1, "home") now also wants the list sorted with 2048 first and 3D Tetris second, the block read as reading order through
    the wrap (the corner the first game, the next on 9,999, a row down on 0 and 9,999) and repeating every `cols` boards each way and at the wrap, every
    game on a board in 29 × 29 boards round the corner, a picture asked for anywhere and a colour of its own for each board, the far texture's cells the
    colour of the boards they stand for, the screen positions of
    the games before and after Chess on its left and right and the rows above and below it above and below, the same pixels each time a picture is
    painted for six games and the kept small picture the same canvas, the three flags, and no hole and no declined board counted with the corner framed and
    the view moving.
- **Home runs through the games both ways, as the gallery does** (Nov 8: "home page is not correct. all boards should go across both horizontally and vertically. photo
  gallery gets this correct."): the 8 × 8 block (a row of eight, the next row eight on) put a game every eighth board down a column. `slotAt` is now the gallery's rule: the
  game whose number is −(row + col) mod N, the column and row first folded to a signed distance from the corner (`side`, as the gallery's `pick`), so every row and every
  column runs through all N games in title order, the next game one board right and one board down, with no block. `cols` is N (the far texture's `fabricRepeat`, as the
  gallery's `blockN`), `slotOf(id)` the board on the corner's row that holds a game. The one seam is half the field away, as the gallery's. The notes below about the block
  of eight, `SIDES`, the repeat dividing the field's side and the reading of the block are older. The smoke test (end of part 1, "home") checks the rule on boards far each way,
  a whole row and a whole column each holding every game once, the wrap at the corner and the neighbours as the gallery's.
- **A Home chip, and no dots where there is no row** (Nov 7: "if an applicaiton does not have a bottom browser, remove the bottom button.   Add a button for home in the
  upper left."): `#homeBtn`, a chip in the upper left (the menu's is upper right), shown on every app but Home (`syncHomeButton`, from `setFieldApp`), opens Home with
  `openApp`, whose `onEnter` takes the view to the board of the game just left. The three dots (`#bbHandle`) were on every game since Oct 9; `bbHasRow` now says whether
  the app has a bottom browser at all (something already in the row, or `nativePieces`, `_record`, `statTiles`, `statsFirst`, `quickActs`, or the gallery's prints) and
  the dots go where it has none: Home, Tetris, Sudoku, Hashi and the other games that play on the board alone. The smoke test (end of part 1, "home chip") checks both.
- **Home returns to where it was left** (Nov 7: "save the position, title and rotation of home so it returns in the same position.": "title" read as tilt): `HOME_APP` keeps the eye's
  place, turn, tilt and zoom and the board framed (`keepView`: `st.camX`, `camZ`, `yaw`, `pitch`, `zoom`, `target.cellX/cellZ`) when Home is left (`onLeave`), twice a second while it is up
  and on `pagehide`, in localStorage `home.view`; `onEnter` puts it back (`savedView`, the camera settled at once, the arrival's default fit given up with `_defFitArmed++`), so the Home
  chip, the picker and a reload all come back to it. Only a first visit, with nothing kept, frames the game just left (or the last one). `forgetView` clears it (the smoke test's earlier
  Home checks, which want that first-visit framing). The dots follow the app at the switch too (`syncBrowserDots`), not only on the next row refresh. The smoke test ("home chip") flies
  Home somewhere, turns and tilts it, opens a game and clicks the chip, wanting the same position, turn, tilt and zoom and the store written.
- **One sans for every word** (Nov 7: "the fonts look very nice on the home page.  can you use that font in all applications?"): Home's board
  names are set in the system's own face (`-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`), the stack the page's text
  was already in (`field-styles.css`'s `html, body`: menus, notices, boxes, so none of that moved). Words drawn elsewhere were in other sans faces:
  the flash cards and the JSON viewer's page chrome in Helvetica Neue, the bottom row's tiles and a dozen inline styles in the same stack without
  Segoe UI, five icon and board paints in the bare `sans-serif`, one in Arial, the trick shots' pull strip in `system-ui`. `UI_SANS` (next to
  `UI_MONO`) is the one stack now, and each of those says it (`F` in the tile painters, `SANS` in the cards and the viewer, the book reader's Sans
  face, the inline `font:` strings). Left alone on purpose: monospace for notation and readouts (`UI_MONO`: chess's file letters, the review
  panel and coach button, the margin numbers; "Courier New" in the diagnostic boxes), the pinball reels' serif figures, the book reader's own
  Serif, Book and Mono faces (its default is Serif), and the dot-matrix lettering some boards are built of (Pong's, air hockey's and squash's
  scores and calls, pinball's panel, the game lab's words: pieces, not a font; the seven-segment numbers went the same day, next note). Measured: with each of the 59 apps shown in turn for a moment, the only canvas font set was this stack (15 of them draw any). New text
  uses `UI_SANS`. The smoke test (end of part 1, "one sans") fails on a stray generic sans in the source and reads every canvas font Home, the
  flash cards, Sudoku and Hashi set.
- **Numbers and words on boards in the page's own font** (Nov 7: "why cant you use the same font from home page on mini-golf and elsewhere?"): the
  numbers on a board were seven-segment pieces (`BOARD_KIT.flat.digit`, mini golf's `segH` and `segV`), which no font can be, and mini golf's plate
  read "1 oF 5" for want of an "of". `BOARD_KIT.type` (before `flat`) lays letters instead: a letter is a flat unlit quad, `geo(T, ch)`, wearing its
  glyph drawn once on a canvas in `UI_SANS` (bold, white, so the item's colour tints it; `userData.map` the picture, `userData.glyph` which the
  field's item materials read as see-through and depth-write-free), its kind `tg` + the code point (`kind`, `kinds(str)` for an app's
  `itemGeometries`), laid by `put(out, str, { u, v, h, color, align, lift })` (u across, v the middle of the capitals, h the height of a digit's box
  as the old digits were laid) with `width(str, h)` and `inkHalf(ch)`. In a piece's units a digit's slot is 0.62 wide (the old pitch) with its ink
  centred in it, and the capitals 0.8 tall (smaller by what a fallback face's wider digits overshoot, `fit`, so numbers never touch); any other
  letter has the face's own advance. Used by: the kit's digit kinds (`flat.digit` now gives the glyph, so Nonograms' clues, Sudoku's squares, keys,
  clock and strikes, Hashi's islands and Missile Command's lit score changed with it and their layouts did not), 2048's figures (a 1 gets a
  slot of 0.48, `figures`) and mini golf's scoreboard and hole numbers (`scoreboardItems`, `numberItems`: gold on the dark green plate, now "1 of 5"
  and the digits at 0.0875 of a board). A lone 1 stands in the middle of its square by itself, so `ONE_AT` and the shifts of the lone-1 note
  above are gone. The notes of Oct–Nov that call these numbers seven-segment, or mini golf's scoreboard segments with `LETTER` and `DIGIT`, are out
  of date. Left as they were: the dot-matrix lettering (`DOT_FONT`: Pong, air hockey and squash scores and calls, pinball's panel, the game lab's
  words) and the pinball reels, which are the look of those games. The smoke test: part 1's "letters" (every digit's ink read back from its picture is
  centred and 0.6–0.9 of a digit tall, 0.62 apart in a line), Sudoku's and Hashi's ink checks without any shift, and mini golf's plate read back as its
  text (a dash with no game, 1 on the tee, 8 with seven strokes, then "of" and the par).
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
- **A stalled frame is not a fast hand** (Nov 1: "panning is broken, you broke it. all of a sudden it moves 100's of boards, and it does not pan, it moves between images."): `applyPan`'s velocity is a distance a sample, quoted against a 60 fps frame, so when the page stalls (a big print decoded and sent to the card) the one move the browser hands back covers everything since the last; a slow drag read as a flick, passed `SWIPE_LAUNCH` and launched the endless drift at release, boards streaming past one image after another. A sample more than two frames after the last is scaled to two frames' worth (`_sc`); quicker ones are as before. A probe of a drag with 150 ms between moves set the drift to 0.12 before, 0 after. The panning code itself has not changed since Oct 3: the cause was the page being slow, not the pan.
- **Two fingers and the wheel are never locked; a board set active can be played** (Nov 4: "1) two finger panning and wheel should always work, don't lock them down. 2) when settinga board to active, you should be able to interact with it.  for example, in mini-golf, after a refresh, the board is selected but it is still locked, You make me click the board to unlock it."): (1) `applyPan` held a locked board against every gesture that started on it; the lock now holds only against the one-pointer drags (`'one'`, pan mode's mouse `'pan'`, the phone's tilt steering `'tilt'`), so two fingers on glass and a trackpad's or wheel's scroll always fly the camera and leave the lock as it was. (Probe: locked, a pad scroll moved the camera 0.69 and the lock stayed; a one-finger drag on the board moved nothing.) (2) After a refresh the corner board was framed with no game on it, so a drag on it only panned until a tap began the hole. Mini golf's `onFramed` now begins the hole of a framed board that has no game (`startOnDouble`, what the double tap and the next tap did), so the first drag aims; a game there already, the editor, and a hole waiting from My holes (played, as before) are respected. Other apps already have their game ready on a framed board. The smoke tests (part 7, "board lock and difficulty flight": a pad scroll over the locked board; "first tap tees off": a board framed with no game begins its hole) check both.
- **The tilt nub is grabbed, not chased** (Nov 4: "I can't grab the tilt nub on the left scroll bar for tilt."): the rail's hit test was fine (the zone is on top at the nub in every app tried, 1280 and 390 px wide), but the finger set a target the tilt then travelled to on the tangent ramp (16° a second from rest, `updateStripMarkers`), so on the packed 240 px rail the nub trailed the finger by seconds and could not be held. While the finger is down (`__tiltLever.on`) the tilt now goes to the finger's place at once; the ramp is kept for a lever left travelling. Probe: a 100 px drag left the nub 59 px along after 1.5 s before, under the finger after. The smoke test (part 6, "tilt nub grab") presses the real nub and drags 80 px.
- **A swipe always sets the auto move, at its own speed** (Nov 2: "Always auto move on swipe.   Tap stops the auto move.   Panning controls the auto move speed."): a swipe used to start the drift only when none was running (`startDriftIfIdle`: a swipe while drifting was steering, the speed the lever's or the gentle 0.12 screens a second whatever the hand did). `launchDriftIfSwipe` now calls `setDriftFromSwipe` on every swipe: the way is the swipe's (`noteDrift`, as before) and the speed its release speed in screens a second (`worldPerScreenHeight`) times `DRIFT_FROM_SWIPE` (⅐), kept between `DRIFT_MIN` 0.06 and `DRIFT_MAX` 0.9, so a harder swipe is a faster drift, a gentler one a slower, standing or already moving; `LAST_SPEED` takes it so the lever resumes at it. A tap on the ground stops it as before (`handleGroundTap`: the braking tap is eaten, Escape too). The floor for a swipe is unchanged (`SWIPE_LAUNCH`). The smoke test (part 6, "swipe auto move") calls the launch through `tvf.swipeDrift(worldPerFrame)` (a hand's timing cannot be scripted: a probe's mouse drags arrived 120 ms apart in the software renderer) and wants a faster swipe faster, a swipe while it runs setting the speed again, and a real click stopping it.
- **The field is not shown while a load sets up** (Nov 2: "the background still moves on load.  I see the empty grid moving before any images are loaded."): a load re-laid the ground in a quarter of a second over an empty grid: the view from the overview to the fit (zoom 300 → 65 → 48), the board's shape (1.00 × 1.00 → 1.05 × 0.79) and the grid under them, all of it a visible move. `window.__loadVeil(true)` hides the canvas (`visibility: hidden`) from the moment a load is asked for (`clearAll`) or a refresh will reopen the last drop or bucket (the startup restore), and `_emitAppPhoto` lifts it when the first print of the load is drawn (a seed's colour prints do not count, `app._seeded`), or after 15 s at the latest, or when the restore finds nothing kept. Measured on a reload of eight pictures: hidden from page open, every camera and shape change inside it, shown at 4.7 s with the camera still ever after. The rails, compass, readouts and menu are not hidden; a hidden canvas takes no presses, which only matters for the seconds of a load.
- **The compass's angles are packed in the middle** (Nov 2: "the top rotation angles should be show just in the center, not spread over the complete screen.   I want the angles to be tighly packed in the center."): the heading marks every 20° along the top edge (`#compass`, `updateCompass`) were placed where each heading falls on the screen, so "20°", "N 0°", "340°" stood across the whole width. Their order and sliding with the yaw are the same, but each mark's x is now `COMPASS_SPREAD` (0.28) of the way out from the middle of where it falls, so the tape is a short strip in the centre of the top. (The turn rail, `#yawZone`, is unchanged.) The smoke test (part 1, "rails") wants every mark on show in the middle third.
- **The turn rail is packed in the middle too** (Nov 2: "the scroll bar should be similarly compressed."): `#yawZone`, the rail across the top, is a strip centred on the top edge, `min(240px, 60vw)` wide, instead of the whole top between the side rails. Still one full turn from end to end (−180° to +180°, the middle forward), so a drag turns the view faster per pixel; its height is still the side rails' width. The side rails are unchanged. The smoke test (part 1, "rails") checks it is short and centred.
- **The tilt rail is packed in the middle too, with a readout** (Nov 2: "the left scroll bar for tilt should be similary compressed, add a tilt readout."): `#tiltZone` is a strip centred on the left edge, `min(240px, 60vh)` tall, as the turn rail is across the top; the tilt still runs from the floor at its top to `PITCH_MAX` at its bottom, so a drag tips the view faster per pixel. `#tiltRead`, beside the rail and riding with the nub (`updateStripMarkers`), says the angle in degrees. The right rail is unchanged. The smoke test (part 1, "rails") checks the strip and that the readout equals the tilt.
- **The swipe starts the auto motion a little more easily** (Nov 2: "make the swipe slightly easier to start the auto motion."): a lift is a swipe when the release speed is `SWIPE_LAUNCH` (0.06 grid cells a frame, now 0.045) and the last move was within `SWIPE_LIFT_MS` (80 ms, now 100) of the lift; a slow creep and a pan that stopped before lifting still do not launch. Not measured with a probe (a scripted drag's timing is not a hand's), so the numbers are a step, not a fit.
- **A tap on the main display shuts the bottom row** (Nov 2: "tapping the main display should close the bottom browser"): `bbStatsAway(true)`, called by `handleGroundTap`, now shuts the row whatever it holds (a game's moves, the gallery's prints, a book's settings), not only a numbers row; a row an app holds up (`statsStay`: an editor, a game in play whose controls it is) stays. A drag that moves the view still shuts only the numbers (`bbStatsAway()`), so panning with the prints in view leaves them. The smoke test (part 6, "tap closes the row") clicks the field with the gallery's row open.
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
- **The smoke test waits on frames and the game's clock, not the wall's** (12 Nov 2026: "1,2,3,4,5,6", the first "Games: fix
  the flaky checks and move to the newer browser", the sixth "Games: split its smoke test like draw's"). With Playwright 1.63.0's
  Chromium the software renderer's first frames of a field, and the first that show a new thing (a shot), take seconds each while
  the page's own thread sits idle (in a sandbox: 11, 6 and 4 s for the first three frames of a tank's shot, then under a second;
  a second shot's all under two; 36 s for one frame as the tanks' field was first drawn). Nothing in the page was wrong; three
  checks counted seconds where the page counts frames, and one did not wait for a flight:
  - **The tanks** (part 5): a game steps a quarter of a second a frame at most (`stepGame`), so 20 s on the wall after a real
    tap fired the game's clock stood at half a second and the turn had not ended, every time on CI. Its waits (`until`,
    `waitAim`, the drive, the row's shell, the win) are given seconds of `g.t`, with five minutes of the wall as the end.
  - **The hold** (part 6, the part's first check): the 600 ms timer fired on time, the frame it waits for (`_holdTok`, above) came
    10.9 s later, 10 s after the 1.4 s press had let go, so there was no hold. And once the press was held long enough, the
    switch flipped but the page's class, which the check reads, follows on the next frame (`syncBrowserVisibility`), 13.6 s on,
    past the 8 s it waited. The press is now held until a frame has come after the hold's time (`held`) and the row read
    after frames (`frame`). A person's hold of 1.4 s on a page that slow would not be one either: the page was left as it is.
  - **The game lab** (part 5): "a real click did not move the block", once on CI on the older browser. The clicks were made 1.2 s
    after the lab called board (2, 0) its own, with the camera still gliding (x 6.37, 6.45, 7.40, 7.72 at the pixel's working
    out and the three clicks), so each landed a square further off. It waits for `__settle(2, 0)` now, as Snake's real arrow
    key waits for `__settle(1, 0)` (run alone, the flight had not begun 2.5 s on and the key went to the board before).
  Parts 5 and 6 then passed whole twice in a row on that browser in a sandbox, so `package.json` asks for Playwright 1.63.0 and
  the smoke jobs run on `ubuntu-latest`. The parts are files since the same day (`tests/part1.mjs` … `part7.mjs`,
  `tests/harness.mjs`; `CLAUDE.md`, Testing).
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
  **A double tap asks to start over** (Nov 1: "double click still not reseting games when the board is in default view. Add a confirmation dialog to confirm reset."): a double tap on the board you are on, with the view already in its default position (`framedAsDefault`), asks "Start this game over?" (`window.confirm`) and calls the app's `onReset` on yes, in every app that has `gameDone`; the double no longer locks the board there. The board lock is taken by a double from any other view (zoomed or turned away) and let go by the menu's Unlock the board or a flight. A finished board's own tap has begun it again by the second tap, so then nothing is asked. A game that keeps both taps (`noDoubleTap`: Lights Out in play, Simon, …) never sees it. The smoke test (part 7, "double tap asks to start over", on 2048) declines and accepts a real double; the lock test zooms off the default view first.
  **2048 shows its numbers** (Nov 1: "2048 game should use standard numbers, not chess pieces."): each tile wears its value as seven-segment digits lying on its top (`digitGeo`, kinds `t8D0`…`t8D9`, nonograms' way; dark on a light tile, white on a dark one, sized to fit up to six digits); the chess letters (`pieceOf`) are not drawn. (Nov 1: "center 2048 numbers, they are currently right aligned.": a 1 is two strokes at its glyph's right, so "16" sat off the middle; `digitGeo` centres a 1's stroke and `figures` gives it a narrow slot and centres the ink's own ends on the tile; the smoke test checks 2, 16, 128 and 1024.)
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
  keys as before), `LV_COL` (the levels' flag colours; 5) and `stars(n)` (★★☆; 15 places), and since Nov 7 `flat` (flat unlit pieces and seven-segment digits: Nonograms' and Sudoku's). Trick shots' worker is made from its
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
