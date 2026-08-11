// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState } from './useGameState'
import { findWordsInGrid } from './gameLogic'

const HINT_DELAY = 15

function start() {
  const view = renderHook(() => useGameState())
  act(() => { view.result.current.startGame() })
  return view
}

// Each timer effect reschedules itself from a render, so a second of game time
// needs its own act() flush — one big advanceTimersByTime only ticks once.
function tick(seconds) {
  for (let i = 0; i < seconds; i++) {
    act(() => { vi.advanceTimersByTime(1000) })
  }
}

describe('clue pacing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('hides the clue so the player can hunt unaided first', () => {
    const { result } = start()
    expect(result.current.hintRevealed).toBe(false)
    expect(result.current.targetWord).toBeTruthy()
  })

  it('reveals the clue once the delay elapses', () => {
    const { result } = start()
    tick(HINT_DELAY - 1)
    expect(result.current.hintRevealed).toBe(false)
    tick(2)
    expect(result.current.hintRevealed).toBe(true)
  })

  it('reveals the clue on request', () => {
    const { result } = start()
    act(() => { result.current.revealHint() })
    expect(result.current.hintRevealed).toBe(true)
  })

  it('restarts the countdown after any find, so a busy player is never rushed', () => {
    const { result } = start()
    const target = result.current.targetWord
    const bonus = findWordsInGrid(result.current.grid).find(w => w !== target.chinese)

    tick(HINT_DELAY - 2)
    expect(result.current.hintCountdown).toBeLessThan(HINT_DELAY)

    act(() => { result.current.submitWord(bonus) })
    act(() => { result.current.dismissReview() })
    expect(result.current.hintCountdown).toBe(HINT_DELAY)

    // ...and the clue stays hidden through what would have been its old deadline
    tick(3)
    expect(result.current.hintRevealed).toBe(false)
  })
})

describe('reload', () => {
  beforeEach(() => { localStorage.clear() })

  it('starts a clean round on the same board rather than resuming', () => {
    const first = renderHook(() => useGameState())
    act(() => { first.result.current.startGame() })
    act(() => { first.result.current.submitWord(first.result.current.targetWord.chinese) })
    const board = first.result.current.grid
    expect(first.result.current.found).toHaveLength(1)
    first.unmount()

    // A refresh remounts the hook from scratch
    const second = renderHook(() => useGameState())
    expect(second.result.current.phase).toBe('start')
    expect(second.result.current.found).toEqual([])
    expect(second.result.current.score).toBe(0)
    expect(second.result.current.timeLeft).toBe(90)
    // ...on the same daily puzzle
    expect(second.result.current.grid).toEqual(board)
  })

  it('ignores round state left behind by older versions', () => {
    localStorage.setItem('dailyBoard_1234', JSON.stringify({ phase: 'play', score: 999 }))
    const { result } = renderHook(() => useGameState())

    expect(result.current.phase).toBe('start')
    expect(result.current.score).toBe(0)
    expect(localStorage.getItem('dailyBoard_1234')).toBeNull()
  })
})

describe('review card', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('holds on the found target instead of jumping to the next clue', () => {
    const { result } = start()
    const target = result.current.targetWord
    act(() => { result.current.submitWord(target.chinese) })

    expect(result.current.reviewWord).toMatchObject({ word: target.chinese })
    // The clue must not have advanced while the card is up
    expect(result.current.targetWord.chinese).toBe(target.chinese)
  })

  it('pauses the round timer while the card is up', () => {
    const { result } = start()
    const target = result.current.targetWord
    act(() => { result.current.submitWord(target.chinese) })

    const frozen = result.current.timeLeft
    tick(5)
    expect(result.current.timeLeft).toBe(frozen)
  })

  it('holds on bonus words too, leaving the target clue alone', () => {
    const { result } = start()
    const target = result.current.targetWord
    const bonus = findWordsInGrid(result.current.grid).find(w => w !== target.chinese)
    expect(bonus).toBeTruthy()

    act(() => { result.current.revealHint() })
    act(() => { result.current.submitWord(bonus) })
    expect(result.current.reviewWord).toMatchObject({ word: bonus, isTarget: false })

    act(() => { result.current.dismissReview() })
    expect(result.current.reviewWord).toBeNull()
    expect(result.current.targetWord.chinese).toBe(target.chinese)
    expect(result.current.hintRevealed).toBe(true)
  })

  it('advances to a fresh, unrevealed clue when dismissed', () => {
    const { result } = start()
    const target = result.current.targetWord
    act(() => { result.current.revealHint() })
    act(() => { result.current.submitWord(target.chinese) })
    act(() => { result.current.dismissReview() })

    expect(result.current.reviewWord).toBeNull()
    expect(result.current.targetWord.chinese).not.toBe(target.chinese)
    expect(result.current.hintRevealed).toBe(false)

    // ...and the timer runs again
    const before = result.current.timeLeft
    tick(2)
    expect(result.current.timeLeft).toBeLessThan(before)
  })
})
