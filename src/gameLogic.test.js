import { describe, it, expect } from 'vitest'
import {
  mulberry32, shuffle, generateDailyGrid, findWordsInGrid,
  validateWord, lookupWord, scoreWord, cellCenter, cellFromPoint, adj,
  ROWS, COLS, TOTAL
} from './gameLogic'

describe('generateDailyGrid', () => {
  it('creates a grid with correct dimensions', () => {
    const rng = mulberry32(12345)
    const { grid } = generateDailyGrid(rng)
    expect(grid).toHaveLength(TOTAL)
    expect(grid.length).toBe(ROWS * COLS)
  })

  it('fills all cells with non-empty strings', () => {
    const rng = mulberry32(67890)
    const { grid } = generateDailyGrid(rng)
    for (const cell of grid) {
      expect(typeof cell).toBe('string')
      expect(cell.length).toBeGreaterThan(0)
    }
  })

  it('guarantees a word is placed in the grid', () => {
    const rng = mulberry32(11111)
    const { grid, guaranteedWord } = generateDailyGrid(rng)
    expect(guaranteedWord).toBeDefined()
    expect(guaranteedWord.length).toBeGreaterThanOrEqual(2)
    // The guaranteed word should be findable in the grid
    const wordsInGrid = findWordsInGrid(grid)
    expect(wordsInGrid).toContain(guaranteedWord)
  })

  it('produces reproducible grids with the same seed', () => {
    const rng1 = mulberry32(42)
    const { grid: grid1 } = generateDailyGrid(rng1)
    const rng2 = mulberry32(42)
    const { grid: grid2 } = generateDailyGrid(rng2)
    expect(grid1).toEqual(grid2)
  })

  it('produces different grids with different seeds', () => {
    const rng1 = mulberry32(1)
    const { grid: grid1 } = generateDailyGrid(rng1)
    const rng2 = mulberry32(2)
    const { grid: grid2 } = generateDailyGrid(rng2)
    expect(grid1).not.toEqual(grid2)
  })
})

describe('findWordsInGrid', () => {
  it('finds the guaranteed word placed in the grid', () => {
    const rng = mulberry32(9999)
    const { grid, guaranteedWord } = generateDailyGrid(rng)
    const found = findWordsInGrid(grid)
    expect(found.length).toBeGreaterThanOrEqual(1)
    expect(found).toContain(guaranteedWord)
  })

  it('returns an array of strings', () => {
    const rng = mulberry32(5555)
    const { grid } = generateDailyGrid(rng)
    const found = findWordsInGrid(grid)
    for (const word of found) {
      expect(typeof word).toBe('string')
    }
  })
})

describe('validateWord', () => {
  it('returns true for valid Chinese words', () => {
    expect(validateWord('你好')).toBe(true)
    expect(validateWord('不客气')).toBe(true)
    expect(validateWord('谢谢')).toBe(true)
  })

  it('returns false for invalid words', () => {
    expect(validateWord('')).toBe(false)
    expect(validateWord('abc')).toBe(false)
    expect(validateWord('不存在')).toBe(false)
  })
})

describe('lookupWord', () => {
  it('returns pinyin and english for valid words', () => {
    const info = lookupWord('你好')
    expect(info).not.toBeNull()
    expect(info.pinyin).toBe('nǐ hǎo')
    expect(info.english).toBe('hello')
  })

  it('returns null for invalid words', () => {
    expect(lookupWord('不存在')).toBeNull()
    expect(lookupWord('')).toBeNull()
  })
})

describe('scoreWord', () => {
  it('scores 2-character words with base + length', () => {
    const score = scoreWord('你好')
    expect(score).toBe(10 + 2 * 5) // BASE + len*5 = 20
  })

  it('adds LONG_WORD_BONUS for 3+ character words', () => {
    const score = scoreWord('不客气')
    expect(score).toBe(10 + 3 * 5 + 5) // BASE + len*5 + bonus = 30
  })
})

describe('cellCenter', () => {
  it('returns correct coordinates for cell 0', () => {
    const { x, y } = cellCenter(0)
    expect(x).toBe(32) // TILE/2 = 32
    expect(y).toBe(32)
  })

  it('returns correct coordinates for cell 6 (row 1, col 1)', () => {
    const { x, y } = cellCenter(6)
    expect(x).toBe(74 + 32) // (TILE + GAP) * 1 + TILE/2
    expect(y).toBe(74 + 32) // (TILE + GAP) * 1 + TILE/2
  })
})

describe('adj', () => {
  it('returns true for horizontally adjacent cells', () => {
    expect(adj(0, 1)).toBe(true)
  })

  it('returns true for vertically adjacent cells', () => {
    expect(adj(0, 5)).toBe(true)
  })

  it('returns true for diagonally adjacent cells', () => {
    expect(adj(0, 6)).toBe(true)
  })

  it('returns false for non-adjacent cells', () => {
    expect(adj(0, 2)).toBe(false)
    expect(adj(0, 10)).toBe(false)
  })

  it('returns false for invalid indices', () => {
    expect(adj(-1, 0)).toBe(false)
    expect(adj(0, -1)).toBe(false)
  })
})

describe('mulberry32', () => {
  it('returns a function', () => {
    const rng = mulberry32(42)
    expect(typeof rng).toBe('function')
  })

  it('produces values between 0 and 1', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('produces deterministic sequences', () => {
    const rng1 = mulberry32(100)
    const seq1 = Array.from({ length: 5 }, () => rng1())
    const rng2 = mulberry32(100)
    const seq2 = Array.from({ length: 5 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })
})

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5]
    const rng = mulberry32(42)
    const result = shuffle([...arr], rng)
    expect(result).toHaveLength(arr.length)
  })

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const rng = mulberry32(42)
    const result = shuffle([...arr], rng)
    expect(result.sort()).toEqual(arr.sort())
  })
})
