# Technical Design Document — Chinese Word Hunter (字词猎人)

## 1. Architecture Overview

```
React 18+ (Functional Components + Hooks)
├── App.jsx                     # Top-level component
│   ├── GameBoard.jsx           # SVG grid rendering, pointer tracking
│   └── GameStatus.jsx          # Start screen, target prompt, timer, score, results
├── useGameState.js             # Core state management hook
├── gameLogic.js                # Pure functions: grid generation, word search, scoring
└── chinese_words.json          # HSK 3.0 curated vocabulary (~9,382 entries)
```

### Data Flow

1. `App.jsx` instantiates `useGameState()` which returns state + handlers
2. `GameBoard.jsx` renders an SVG grid and tracks pointer events (`onPointerDown`, `onPointerUp`, `onPointerMove`, `onTouchEnd`)
3. On pointer up, `GameBoard` calls `onSubmitWord(path)` from `useGameState`
4. `useGameState` validates the word via `gameLogic.validateWord()`, scores it, and updates state
5. `GameStatus.jsx` displays the target word, timer, score, and game-over/celebration screens

## 2. Grid Generation Algorithm (`generateDailyGrid`)

### Current Implementation (v1.1.0)

```javascript
generateDailyGrid(rng) → { grid, guaranteedWord, placedWords }
```

**Steps:**
1. Fill all 64 cells (8×8) with random characters from the vocabulary pool
2. Select 10–15 random words (≥2 characters, ≤8 characters) from the word list
3. For each word, attempt up to 50 random placements:
   - Pick a random direction: horizontal (`[0,1]`), vertical (`[1,0]`), diagonal down-right (`[1,1]`), diagonal down-left (`[1,-1]`)
   - Calculate valid placement bounds
   - Pick a random starting position within bounds
   - Overwrite characters at each position with the word's characters
4. Return the filled grid, a guaranteed word (first placed word), and the list of placed words

**Key Design Decisions:**

| Decision | Rationale |
|---|---|
| Fill with random chars first | Ensures every cell has a character; avoids sparse grids with empty cells |
| Overwrite with placed words | Guarantees the words are findable; random chars fill the rest |
| 10-15 words | Balances solvability with challenge; provides ~12-18 total findable words (including diagonal reads) |
| 50 placement attempts per word | High success rate; worst-case <5ms execution time |
| Random orientation | Prevents obvious patterns; all 4 directions equally likely |

**Previous Implementation (v1.0.0):**
- Started with empty grid
- Placed characters one at a time with adjacency constraints
- Result: only ~5 findable words per board due to sparse placement

## 3. Word Search Algorithm (`findWordsInGrid`)

### Trie Construction

- Built from the entire word list at import time
- Each node: `{ children: Map<char, TrieNode>, isEnd: boolean }`
- Enables O(n) prefix lookup during DFS

### DFS Search

- Starts from every cell in the grid
- Explores all 8 adjacent directions (including diagonals)
- Prunes branches when the current prefix has no matches in the trie
- Tracks visited cells to prevent reusing the same cell in a single word path
- Collects all valid words found (length ≥ 2)

**Time Complexity:** O(64 × 8^L) where L is max word length (8), but heavily pruned by the trie—practical runtime <1ms

## 4. Scoring System

| Word Length | Base Points |
|---|---|
| 2 chars | 10 |
| 3 chars | 20 |
| 4 chars | 40 |
| 5 chars | 80 |
| 6 chars | 160 |
| 7 chars | 320 |
| 8 chars | 640 |

**Bonuses:**
- **Target word bonus**: 2× base points
- **Streak bonus**: Consecutive finds without timeout → +10 per streak level
- **All words found bonus**: 500 points

## 5. State Machine (`useGameState`)

```
[loading] → [start] → [playing] → [complete] or [timeout]
                ↑                        |
                └────────────────────────┘ (Play Again)
```

### States

| Phase | Description |
|---|---|
| `loading` | Board is being generated; shows spinner |
| `start` | Board ready, waiting for player to press Start |
| `playing` | Timer running, words can be submitted |
| `complete` | All words found; celebration screen |
| `timeout` | Timer expired; game over screen |

### Key State Variables

```javascript
{
  phase,           // 'loading' | 'start' | 'playing' | 'complete' | 'timeout'
  grid,            // Array of 64 characters
  targetWord,      // Current target word (Chinese string)
  foundWords,      // Array of found word objects [{ chinese, pinyin, english, points, newHighScore }]
  currentWord,     // Characters currently selected by the player
  currentPath,     // Cell indices currently selected
  score,           // Total score
  streak,          // Current streak count
  timeLeft,        // Seconds remaining (90 → 0)
  totalWordsInGrid,// Total findable words in the grid
  msg,             // Current message to display
  msgType,         // 'ok' | 'warn' | 'error'
  dailySeed        // Today's seed integer
}
```

## 6. Persistence

### localStorage Schema

| Key | Value |
|---|---|
| `dailyBoard_<YYYYMMDD>` | `{ grid, targetWord, foundWords, score, streak, timeLeft, phase, ... }` |

### Restore Logic

1. On mount, compute `getDailySeed()` (YYYYMMDD integer)
2. Look up `localStorage.getItem('dailyBoard_<seed>')`
3. If found + seed matches today → restore game state
4. If not found or seed mismatch → generate new board

**Edge Case:** Old boards from v1.0.0 stored without `placedWords` and `totalWordsInGrid`. The `startGame()` function recalculates `totalWordsInGrid` from the current grid on each game start, ensuring these are handled correctly.

## 7. Deterministic RNG

### mulberry32 Algorithm

```javascript
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
```

- Seed: `YYYYMMDD` integer (e.g., 20250725 for July 25, 2025)
- All players worldwide see the same grid on the same day
- Testable: `mulberry32(20250117)()` returns a known value

## 8. Mobile Responsiveness

### SVG Grid Scaling

```css
style={{ maxWidth: 'min(408px, calc(100vw - 1rem))' }}
```

- Container shrinks to fit viewport width (with 0.5rem padding on each side)
- SVG uses `viewBox="0 0 408 408"` + `w-full` + `aspectRatio: 408/408`
- Pointer coordinates are converted via `getSVGPoint()` which maps screen coordinates to SVG viewBox coordinates

### Touch Support

| Event | Handler |
|---|---|
| `onPointerDown` | Start selection |
| `onPointerMove` | Extend selection |
| `onPointerUp` | Submit word |
| `onTouchEnd` | Submit word (mobile fallback) |

**Critical Fix:** `onTouchEnd` was missing from the SVG element, causing word submission to fail on mobile devices. This was added alongside the responsive scaling changes.

## 9. Performance Considerations

| Aspect | Measurement |
|---|---|
| Grid generation | <5ms (64 cells + 15 words × 50 attempts) |
| Word search (DFS+Trie) | <1ms for 64 cells |
| chinese_words.json | 630 KB raw, ~245 KB gzipped |
| localStorage payload | ~2 KB per board |
| React re-renders | Optimized with `useCallback` for handlers |

**Bundle Warning:** Vite warns about chunks >500 kB due to the static import of `chinese_words.json`. Future optimization: dynamic `import()` of the JSON file.

## 10. Key Bug Fixes (v1.1.0)

| Bug | Root Cause | Fix |
|---|---|---|
| Game freezes after ~5 words | `pickTargetFromGrid()` returns `null` when no unfound words remain; `if(next)` silently does nothing | Added `else` branch: celebrate completion with 500-point bonus |
| Layout jump on message toast | Conditional rendering (`{msg && ...}`) removes/ adds DOM element | Always render with `invisible` class + `\u00A0` placeholder |
| Grid overflow on small phones | SVG had fixed `width`/`height` attributes | CSS `max-width` + `aspectRatio` scaling |
| Word submission fails on mobile | SVG missing `onTouchEnd` handler | Added handler to SVG element |
## 11. Future Work

Items deferred from the current session, listed in priority order:

### P1 — Lazy-Load `chinese_words.json`

**Problem:** Vite warns that some chunks exceed 500 kB. The JSON file is 630 KB raw (~245 KB gzipped) and is statically imported at the top of `gameLogic.js`, forcing it into the main bundle.

**Approach:**
- Replace the static `import` with a dynamic `import()` call
- Load the file on the first game start (when the user presses "Start"), not on page load
- Show a brief loading state while the JSON is being fetched and the trie is being built
- The trie construction can remain in `gameLogic.js` but be called asynchronously

**Trade-off:** Slightly slower first-start time (network fetch + trie build) in exchange for a smaller initial bundle and faster page load.

### P2 — HSK Level Filtering

**Concept:** Let players choose which HSK levels to include:
- Beginner: HSK 1–3 only (~1,500 words)
- Intermediate: HSK 1–6 (~5,000 words)
- Advanced: All levels (current behavior)

**Requires:** The word list JSON needs an HSK level field per entry. Currently the JSON is flat `[hanzi, pinyin, english]` tuples. The HSK level data exists in the source CSV but was stripped during processing.

### P3 — Free-Play Mode

**Concept:** A non-timed mode where players can explore the grid at their own pace. Could be a separate route or a toggle on the start screen. The daily board would remain the default/timed mode.

### P4 — Clean Stale localStorage Data

**Problem:** Boards saved during the v1.0.0 era may have incorrect `totalWordsInGrid` values. The `startGame()` recalculation handles this on new games, but saved states from prior sessions could still show mismatched counts if the player refreshes mid-game.

**Approach:** On app mount, check if the saved board's version matches the current version. If not, prompt the user to start fresh or attempt a migration.

### P5 — Accessibility Improvements

- Add `aria-label` attributes to grid cells
- Ensure keyboard navigation works (arrow keys to move, Enter to select)
- Add a high-contrast mode for visually impaired players
- Include screen reader announcements for word found, target changed, and timer warnings

## 11. Future Work

Items deferred from the current session, listed in priority order:

### P1 — Lazy-Load `chinese_words.json`

**Problem:** Vite warns that some chunks exceed 500 kB. The JSON file is 630 KB raw (~245 KB gzipped) and is statically imported at the top of `gameLogic.js`, forcing it into the main bundle.

**Approach:**
- Replace the static `import` with a dynamic `import()` call
- Load the file on the first game start (when the user presses "Start"), not on page load
- Show a brief loading state while the JSON is being fetched and the trie is being built
- The trie construction can remain in `gameLogic.js` but be called asynchronously

**Trade-off:** Slightly slower first-start time (network fetch + trie build) in exchange for a smaller initial bundle and faster page load.

### P2 — HSK Level Filtering

**Concept:** Let players choose which HSK levels to include:
- Beginner: HSK 1–3 only (~1,500 words)
- Intermediate: HSK 1–6 (~5,000 words)
- Advanced: All levels (current behavior)

**Requires:** The word list JSON needs an HSK level field per entry. Currently the JSON is flat `[hanzi, pinyin, english]` tuples. The HSK level data exists in the source CSV but was stripped during processing.

### P3 — Free-Play Mode

**Concept:** A non-timed mode where players can explore the grid at their own pace. Could be a separate route or a toggle on the start screen. The daily board would remain the default/timed mode.

### P4 — Clean Stale localStorage Data

**Problem:** Boards saved during the v1.0.0 era may have incorrect `totalWordsInGrid` values. The `startGame()` recalculation handles this on new games, but saved states from prior sessions could still show mismatched counts if the player refreshes mid-game.

**Approach:** On app mount, check if the saved board's version matches the current version. If not, prompt the user to start fresh or attempt a migration.

### P5 — Accessibility Improvements

- Add `aria-label` attributes to grid cells
- Ensure keyboard navigation works (arrow keys to move, Enter to select)
- Add a high-contrast mode for visually impaired players
- Include screen reader announcements for word found, target changed, and timer warnings
