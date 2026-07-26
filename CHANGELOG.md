# Changelog

All notable changes to the Chinese Word Hunter (字词猎人) project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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