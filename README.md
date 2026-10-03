# Games

A 3D field of boards you fly over, with about 40 games in one page: chess
against Stockfish (with a Claude coach), checkers, Go, Reversi, Tetris,
Pac-Man, Asteroids, Sokoban, 2048, Minesweeper and many more, plus a photo,
PDF and comic gallery.

**Play:** https://reportbase.github.io/games/

## Opening a specific game

Add `?app=` and the game's id to the link, for example
`https://reportbase.github.io/games/?app=tetris`.

| Board games | Arcade | Puzzles |
| --- | --- | --- |
| `chess` `checkers` `go` `reversi` `gomoku` `connectfour` `linesofaction` `ataxx` `queens` | `defender` `breakout` `crossing` `snake` `tron` `missilecommand` `asteroids` `tetris` `bejeweled` `bomberman` `pacman` `towerdefense` `airraid` `invaders` `tiles` `minigolf` | `minesweeper` `memory` `pipes` `infinityloop` `pipemania` `flow` `netslide` `rolltheball` `unblockme` `2048` `sokoban` |

`gallery` opens the photo / PDF / comic viewer. `?debug=1` shows the debug menu.

## Files

| File | What it is |
| --- | --- |
| `games.html` | The whole game: one self-contained page. This is the file to edit. |
| `stockfish-18-lite-single.js` / `.wasm` | The Stockfish chess engine. `games.html` loads them from beside itself, so they must stay in the same folder. |
| `index.html` | Forwards `/games/` to `games.html`. |
| `tests/smoke.mjs` | The smoke test (see below). |

Libraries (three.js, chess.js, pdf.js, unzipit, libarchive.js) load from public
CDNs at runtime, so the page needs an internet connection.

## Running it locally

The page has to be served over http (Stockfish runs in a web worker, which
does not load from `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/games.html
```

## Smoke test

Every pull request runs `tests/smoke.mjs` in GitHub Actions. It opens the page
in headless Chromium, switches to every game in turn, and fails if any of them
throws an uncaught error. To run it yourself:

```sh
npm install
npx playwright install chromium
npm test
```

## Publishing

GitHub Pages serves the `main` branch, so merging to `main` updates the live
site within a minute or two.

## License

GPL-3.0 (see `LICENSE`), because the page ships the Stockfish engine, which is
GPL-3.0.

Stockfish.js 18 by Chess.com, LLC (https://github.com/nmrugg/stockfish.js),
based on Stockfish by the Stockfish developers
(https://github.com/official-stockfish/Stockfish).
