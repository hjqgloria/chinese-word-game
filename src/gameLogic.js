import CHINESE_WORDS from './chinese_words.json'

// Build a lookup map: Chinese characters -> pinyin + english
const WORD_MAP = new Map()
for (const [chinese, pinyin, english] of CHINESE_WORDS) {
  WORD_MAP.set(chinese, { pinyin, english })
}

// Grid dimensions — 8×8 for a more spacious game
const ROWS = 8
const COLS = 8
const TOTAL = ROWS * COLS
const TILE = 44  // smaller tiles for 8×8
const GAP = 12   // wide enough that diagonal swipes have room between tiles

// Scoring: simple per-word points
const BASE_POINTS = 10
const LONG_WORD_BONUS = 5  // words with 3+ characters
const STREAK_BONUS = 3     // bonus per consecutive correct word

// Build a character -> pinyin map (for displaying pinyin on tiles)
function buildCharPinyinMap() {
  const map = new Map()
  for (const [chinese, pinyin, _english] of CHINESE_WORDS) {
    const chars = [...chinese]
    const pinyins = pinyin.split(/\s+/)
    if (chars.length === pinyins.length) {
      for (let i = 0; i < chars.length; i++) {
        if (!map.has(chars[i])) {
          map.set(chars[i], pinyins[i])
        }
      }
    }
  }
  return map
}

const CHAR_PINYIN_MAP = buildCharPinyinMap()

// Get pinyin for a single character
export function getCharPinyin(char) {
  return CHAR_PINYIN_MAP.get(char) || ''
}

// Collect all unique characters from the word list for grid generation
function getAllCharacters() {
  const chars = new Set()
  for (const [chinese] of CHINESE_WORDS) {
    for (const ch of chinese) {
      chars.add(ch)
    }
  }
  return [...chars]
}

// Get all words from the list
function getAllWords() {
  return CHINESE_WORDS.map(w => w[0])
}

// Seedable PRNG (mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Shuffle array in place
export function shuffle(array, rng = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

// Generate a grid filled with Chinese characters
// Algorithm:
// 1. Fill the whole grid with random characters
// 2. Pick 10-15 random words from the word list
// 3. Place each word at a random position in horizontal, vertical, or diagonal direction.
//    A word may only cross a cell used by an earlier word if the character matches
//    (crossword-style), so placed words are never destroyed by later placements.
export function generateDailyGrid(rng = Math.random) {
  const allChars = getAllCharacters()
  const grid = new Array(TOTAL)

  // Step 1: Fill the entire grid with random characters
  for (let i = 0; i < TOTAL; i++) {
    grid[i] = allChars[Math.floor(rng() * allChars.length)]
  }

  // Step 2: Pick 10-15 random words from the word list
  const words = getAllWords()
  const eligible = words.filter(w => w.length >= 2 && w.length <= COLS)
  shuffle(eligible, rng)

  // Pick a random number between 10 and 15
  const numWords = 10 + Math.floor(rng() * 6) // 10-15
  const placedWords = []
  const occupied = new Map() // grid index -> character a placed word depends on

  // Directions: horizontal, vertical, diagonal (down-right), diagonal (down-left)
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]

  // Step 3: Place words until we reach numWords or run out of candidates
  for (const word of eligible) {
    if (placedWords.length >= numWords) break
    const wordLen = word.length

    for (let attempt = 0; attempt < 50; attempt++) {
      // Pick a random direction
      const dirIdx = Math.floor(rng() * directions.length)
      const [dr, dc] = directions[dirIdx]

      // Pick a random starting position where the word fits within bounds.
      // Down-left placement (dc === -1) needs enough columns to its LEFT,
      // so the start column ranges from wordLen-1 up to COLS-1.
      const maxR = dr === 1 ? ROWS - wordLen : ROWS - 1
      const minC = dc === -1 ? wordLen - 1 : 0
      const maxC = dc === 1 ? COLS - wordLen : COLS - 1
      if (maxR < 0 || maxC < minC) continue

      const r = Math.floor(rng() * (maxR + 1))
      const c = minC + Math.floor(rng() * (maxC - minC + 1))

      // Reject placements that would change a cell another word depends on
      let fits = true
      for (let i = 0; i < wordLen; i++) {
        const idx = (r + dr * i) * COLS + (c + dc * i)
        if (occupied.has(idx) && occupied.get(idx) !== word[i]) {
          fits = false
          break
        }
      }
      if (!fits) continue

      for (let i = 0; i < wordLen; i++) {
        const idx = (r + dr * i) * COLS + (c + dc * i)
        grid[idx] = word[i]
        occupied.set(idx, word[i])
      }

      placedWords.push(word)
      break
    }
  }

  // Use the first placed word as the guaranteed word
  const guaranteedWord = placedWords.length > 0 ? placedWords[0] : eligible[0]

  return { grid, guaranteedWord, placedWords }
}

// Trie for fast prefix-based word lookup — dramatically speeds up DFS
class TrieNode {
  constructor() {
    this.children = new Map()
    this.isWord = false
  }
}

function buildTrie() {
  const root = new TrieNode()
  for (const [chinese] of CHINESE_WORDS) {
    let node = root
    for (const ch of chinese) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode())
      }
      node = node.children.get(ch)
    }
    node.isWord = true
  }
  return root
}

const TRIE_ROOT = buildTrie()

// Find all valid words in the grid by scanning connected paths (DFS)
// Uses a trie for fast prefix pruning — dramatically faster than the old version
export function findWordsInGrid(grid) {
  const found = new Set()

  function dfs(currentIdx, visited, node, currentWord) {
    if (currentWord.length > COLS) return
    if (node.isWord && currentWord.length >= 2) {
      found.add(currentWord)
    }
    if (currentWord.length === COLS) return

    const row = Math.floor(currentIdx / COLS)
    const col = currentIdx % COLS

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = row + dr
        const nc = col + dc
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
        const nextIdx = nr * COLS + nc
        if (visited.has(nextIdx)) continue
        const nextChar = grid[nextIdx]
        if (!node.children.has(nextChar)) continue
        visited.add(nextIdx)
        dfs(nextIdx, visited, node.children.get(nextChar), currentWord + nextChar)
        visited.delete(nextIdx)
      }
    }
  }

  for (let i = 0; i < TOTAL; i++) {
    const char = grid[i]
    if (TRIE_ROOT.children.has(char)) {
      const visited = new Set([i])
      dfs(i, visited, TRIE_ROOT.children.get(char), char)
    }
  }

  return [...found]
}

// Find the specific path (indices) of a word in the grid
// Useful for highlighting found words on the board
export function findWordInGrid(grid, word) {
  function dfs(idx, visited, depth) {
    if (depth === word.length) return [idx]

    const row = Math.floor(idx / COLS)
    const col = idx % COLS

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = row + dr
        const nc = col + dc
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
        const nextIdx = nr * COLS + nc
        if (visited.has(nextIdx)) continue
        if (grid[nextIdx] !== word[depth]) continue
        visited.add(nextIdx)
        const result = dfs(nextIdx, visited, depth + 1)
        if (result) {
          result.unshift(idx)
          return result
        }
        visited.delete(nextIdx)
      }
    }
    return null
  }

  for (let i = 0; i < TOTAL; i++) {
    if (grid[i] === word[0]) {
      const visited = new Set([i])
      const result = dfs(i, visited, 1)
      if (result) return result
    }
  }
  return null
}

// Cell math: get center coordinates of a grid cell
export function cellCenter(i) {
  return {
    x: (i % COLS) * (TILE + GAP) + TILE / 2,
    y: Math.floor(i / COLS) * (TILE + GAP) + TILE / 2,
  }
}

// Find which cell the pointer is over.
// The activation radius is deliberately just over half a tile: a large radius
// makes diagonal swipes clip the horizontal/vertical neighbor's zone before
// reaching the diagonal tile, selecting the wrong cell.
export function cellFromPoint(x, y) {
  const step = TILE + GAP
  const col = Math.floor(x / step)
  const row = Math.floor(y / step)
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1
  const cx = col * step + TILE / 2
  const cy = row * step + TILE / 2
  const dist = Math.hypot(x - cx, y - cy)
  return dist < TILE * 0.55 ? row * COLS + col : -1
}

// Check if two cells are adjacent (including diagonal)
export function adj(a, b) {
  if (a === b || a < 0 || b < 0) return false
  const ar = Math.floor(a / COLS), ac = a % COLS
  const br = Math.floor(b / COLS), bc = b % COLS
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1
}

// Convert SVG point from event coordinates
export function getSVGPoint(svg, e) {
  const pt = svg.createSVGPoint()
  const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e)
  pt.x = touch.clientX
  pt.y = touch.clientY
  return pt.matrixTransform(svg.getScreenCTM().inverse())
}

// Validate a Chinese word — checks if it exists in our curated list
export function validateWord(chinese) {
  return WORD_MAP.has(chinese)
}

// Get pinyin and english for a Chinese word
export function lookupWord(chinese) {
  return WORD_MAP.get(chinese) || null
}

// Score a word: longer words = more points
export function scoreWord(chinese) {
  const bonus = chinese.length >= 3 ? LONG_WORD_BONUS : 0
  const points = BASE_POINTS + (chinese.length * 5) + bonus
  return points
}

// Get a deterministic seed for today's date
// The same grid is generated all day, then changes at midnight
// Format: YYYYMMDD as a number (e.g. 20260725 for July 25, 2026)
export function getDailySeed() {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

export { ROWS, COLS, TILE, GAP, TOTAL, STREAK_BONUS, WORD_MAP, getAllWords }
