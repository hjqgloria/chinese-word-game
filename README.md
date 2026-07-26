# Chinese Word Hunter (字词猎人)

A daily Chinese word puzzle game built with React + Vite. Find Chinese words by connecting characters on an 8×8 grid.

## How to Run

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Features

### Daily Board
- A deterministic grid is generated once per day using `getDailySeed()` (YYYYMMDD format)
- Game state is saved to `localStorage` with the daily seed as the key
- On refresh, if the saved seed matches today's seed, the game state is restored
- "Play Again" resets score/found/path but keeps the same daily grid
- At midnight, the seed changes → new grid on next load

### Gameplay
- An 8×8 grid of Chinese characters is displayed
- A target word is shown (pinyin + English translation)
- Players swipe/connect adjacent characters to form words
- Valid words are scored (longer words = more points, streaks give bonus)
- Finding the target word awards bonus points and a new target appears
- Finding ALL words in the grid triggers a celebration with bonus
- Timer counts down from 90 seconds

### Kid-Friendly Vocabulary
- The word list is sourced from **HSK 3.0** (the official Chinese proficiency test vocabulary), ranging from HSK Level 1 to Levels 7-9
- Each word includes simplified Chinese characters, pinyin (with tone marks), and English definition
- The list is curated for foreign learners and kids — **no political, sexual, curse, violent, or drug-related words**

## Word List: Source & Filtering

### Source
1. **`src/chinese_words.csv`** — HSK 3.0 vocabulary list (~11,000 entries). Columns: HSK level, number, OCR, Hanzi (Chinese characters), Hanzi Alternate, HSK level usage notes. https://github.com/andycburke/HSK-3.0-Word-List/
2. **CC-CEDICT** — The [CC-CEDICT](https://cc-cedict.org/) dictionary from MDBG is used to obtain pinyin (with tone marks) and English definitions for each word.

### Processing (`scripts/update_from_csv.mjs`)
1. **Parse CSV**: Extract Hanzi entries (2–4 characters), handle POS tags (e.g., `白（形）` → `白`), prefer the Hanzi_Alternate column when available
2. **Download CC-CEDICT**: Fetch the latest dictionary from MDBG
3. **Lookup**: Match each CSV word against CC-CEDICT entries
4. **Inappropriate Content Filter**: English definitions are scanned for indicators of:
   - Explicit sexual content
   - Curse words / profanity
   - Racial or ethnic slurs
   - Political sensitivity / propaganda
   - Violence, murder, weapons
   - Drug references
   - Crime-related terms
5. **Problematic Hanzi Blocklist**: A curated set of explicitly problematic Chinese words is excluded regardless of CC-CEDICT definition (curse words, political slurs, etc.)
6. **Output**: `src/chinese_words.json` — a JSON array of `[hanzi, pinyin, english]` tuples

### Verification
After generation, the script reports:
- Total words in CSV (2–4 characters)
- Words found in CC-CEDICT
- Words NOT found in CC-CEDICT (typically ~27 words — edge cases like `车上` which aren't standalone dictionary entries)
- Words filtered out (typically ~9 for the refined filter)
- Final entry count: **~9,382 words**

### Running the Update Script
```bash
node scripts/update_from_csv.mjs
```
This re-downloads CC-CEDICT and regenerates `src/chinese_words.json`.

## Project Structure

```
src/
├── gameLogic.js          # Grid generation, word validation, trie search, scoring, PRNG (mulberry32), daily seed
├── useGameState.js       # React hook: game state management, daily board persistence, timer, pointer handling
├── App.jsx               # Top-level component, wires GameBoard + GameStatus
├── GameBoard.jsx         # SVG grid rendering, pointer tracking, current word display, found words list
├── GameStatus.jsx        # Start screen, target word prompt, timer, score, game over / celebration screens
├── chinese_words.json    # HSK-based word list with pinyin and English (~9,382 entries)
├── chinese_words.csv     # HSK 3.0 source vocabulary (~11,000 entries)
├── App.css               # Tailwind-based styling
├── main.jsx              # Vite entry point
└── index.html            # HTML shell
scripts/
├── fetch_cedict.py       # Original Python script to fetch CC-CEDICT
├── fetch_cedict.mjs      # JavaScript version of CC-CEDICT fetch
└── update_from_csv.mjs   # Script to build chinese_words.json from HSK CSV + CC-CEDICT
```

## Technical Notes

- **Seedable PRNG**: Uses the mulberry32 algorithm for deterministic grid generation from a numeric seed
- **Daily Seed**: `YYYYMMDD` as an integer (e.g., 20260725 for July 25, 2026)
- **Trie-based Word Search**: All valid words in the grid are found via DFS with a prefix trie for efficient pruning
- **Grid Generation**: Guarantees at least one target word is placed, then fills with random characters from the vocabulary pool
- **Scaled for 8×8**: Grid uses 44px tiles with 8px gap, optimized for mobile touch
- **localStorage Key Format**: `dailyBoard_<YYYYMMDD>`