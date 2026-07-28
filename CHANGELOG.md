# Changelog

All notable changes to the Chinese Word Hunter (字词猎人) project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-07-28

### Changed

- **Board reduced from 8×8 to 6×6**: less overwhelming for players who don't know Chinese, and each tile renders ~33% larger on mobile. Word count is unchanged — measured over 200 seeds, every 6×6 grid still places 10–15 words (median 12, 10–23 total findable).
- Saved boards with mismatched dimensions (e.g. an 8×8 board from a previous version) are discarded and regenerated instead of breaking the grid.

## [1.3.0] - 2026-07-28

### Fixed

- **Vocabulary data washed** (new `scripts/wash_words.py`, repeatable):
  - 7,573 of 9,383 pinyin entries had missing or misplaced tone marks (e.g. `taò` → `tào`, `an jian` → `ān jiǎn`) — all regenerated with pypinyin.
  - 854 glosses cleaned of CEDICT bookkeeping: `CL:` classifier tags, `abbr. for …`, embedded Chinese + bracketed pinyin (e.g. 嘴巴 "mouth (CL:張|张[zhang1])" → "mouth"), and paragraph-length definitions trimmed to clue size.
  - 98 entries whose gloss was only a cross-reference ("variant of X", "see X") dropped; 安宁, 比如 and 金子 given proper glosses instead.
- **iOS: pronunciation now plays from the first word**: Safari loads TTS voices asynchronously and silently drops utterances until then, and requires a user gesture to unlock speech. The engine is now primed from the Start button tap, the Chinese voice is resolved up front (`voiceschanged`), and a stuck-paused queue is cleared before speaking.

## [1.2.1] - 2026-07-28

### Fixed

- **Board now fills the screen**: The SVG had no intrinsic width and its parent was shrink-to-fit, so browsers fell back to the 300px SVG default regardless of screen size. The board now scales to the viewport (bounded by width, height, and a 640px cap).
- **Diagonal swipes are reliable**: Tile activation radius reduced from 0.8 to 0.55 × TILE — the old oversized zones made diagonal swipes clip a horizontal/vertical neighbor before reaching the diagonal tile. Tile gap widened from 8 to 12 units for clearer visual separation.

## [1.2.0] - 2026-07-28

### Fixed

- **Impossible target words eliminated**: Word placement no longer overwrites previously placed words — a word may only cross an earlier word's cell when the character matches (crossword-style). Previously ~54% of daily grids had an initial target word that could not be traced on the board (measured over 200 seeds; now 0/200).
- **Down-left diagonal placement was broken**: The start-column range for down-left diagonals was inverted, letting words run off the left edge and wrap into the wrong row. These placements now stay within bounds.
- **Midnight rollover no longer corrupts the next day's board**: The daily seed is captured once at load, so playing past midnight keeps saving under the day the grid was generated for.
- **Timer restore edge cases**: A game saved with 0 seconds left no longer restores with a full timer (falsy checks replaced with type checks).
- **Pinyin labels readable on mobile**: Tile pinyin bumped from 9px light-gray to 11px medium-weight dark-gray — essential for players who don't read Chinese characters.
- **Noto Sans SC is now actually loaded**: The font was referenced by components but never linked in `index.html`; all users silently fell back to system fonts.
- **Confetti no longer jumps mid-celebration**: Particles are generated once per celebration (`useMemo`) instead of on every render.
- **Found-word highlighting uses the traced path**: The player's actual swipe path is stored instead of re-searching the grid, which could highlight a different occurrence of the same word.

### Added

- **你好 added to the vocabulary** (it was missing from the CEDICT-derived list).
- Regression tests: placed words are always findable (50 seeds); placement count stays within 10–15.

### Changed

- localStorage boards from previous days are pruned at load instead of accumulating forever.
- Game state is no longer written to localStorage every timer tick; it saves on state changes and tab close.
- Stale tests updated to derive expectations from the exported grid constants (they still assumed the old 5×5/64px board).

### Removed

- Dead code: unused `pickTargetWord()` and `sameDay()` functions, unused component props (`totalWordsInGrid` on GameBoard, `setPhase`/`onPointerDown` on GameStatus).

## [1.1.0] - 2025-01-17

### Fixed

- **Game no longer freezes mid-round**: When all findable words are exhausted, the game now transitions to the complete state with a celebration and 500-point bonus instead of hanging until the timer runs out.
- **Grid no longer jumps on mobile**: The message toast now renders invisibly (using `\u00A0` placeholder) instead of being removed from the DOM, preventing layout shifts when messages appear and disappear.
- **SVG grid fits small phones**: The 8×8 grid now scales down to fit narrow viewports (tested down to 375px) using CSS `max-width` + `aspectRatio` instead of fixed `width`/`height` attributes.
- **Tap-to-select works on mobile**: Added missing `onTouchEnd` handler to the SVG element, which was preventing word submission on touch devices.

### Changed

- **Grid generation algorithm rewritten**: The board now guarantees 10–15 findable words per round:
  - Fills the entire 8×8 grid with random characters from the vocabulary pool
  - Places 10–15 dictionary words at random positions, in random orientations (horizontal, vertical, or diagonal)
  - Placed words overwrite the random characters at their positions
  - Previously generated only ~5 findable words per board due to sparse placement
- **`generateDailyGrid()` now returns a `placedWords` array** alongside `grid` and `guaranteedWord`, allowing the game state to know the exact word count per board.
- **`startGame()` recalculates `totalWordsInGrid`** on each game start, ensuring saved boards from previous algorithm versions are handled correctly.

### Removed

- **Unused `canPlaceWord()` function** removed from `gameLogic.js`.

## [1.0.0] - 2025-01-15

### Added

- Initial release of Chinese Word Hunter daily word puzzle game.
- 8×8 grid with daily deterministic board generation.
- Word search via swipe/connect adjacent characters.
- Timer-based gameplay (90 seconds).
- Trie-based word search for grid validation.
- HSK 3.0 curated vocabulary (~9,382 words).
- Kid-friendly content filtering.
- Daily board persistence via localStorage.
- Score tracking with length-based and streak bonuses.
- Mobile touch support.