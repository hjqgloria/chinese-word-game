import { useState, useEffect, useRef, useCallback } from 'react'
import {
  generateDailyGrid, validateWord, lookupWord, scoreWord,
  findWordsInGrid, findWordInGrid, adj, cellFromPoint, getSVGPoint, mulberry32,
  getDailySeed, STREAK_BONUS
} from './gameLogic'

export function useGameState() {
  const [grid, setGrid] = useState([])
  const [path, setPath] = useState([])
  const [found, setFound] = useState([])
  const [score, setScore] = useState(0)
  const [targetWord, setTargetWord] = useState(null)
  const [phase, setPhase] = useState('start') // start, play, over, complete
  const [timeLeft, setTimeLeft] = useState(90)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')
  const [streak, setStreak] = useState(0)
  const [pointerPos, setPointerPos] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [totalWordsInGrid, setTotalWordsInGrid] = useState(0) // total findable words in current grid

  const dragging = useRef(false)
  const svgRef = useRef(null)
  const msgTimer = useRef(null)
  const pathRef = useRef(path)
  const streakRef = useRef(streak)
  const gridRef = useRef(grid)
  // Capture the seed once — playing past midnight must keep saving under the
  // day the grid was generated for, not corrupt the next day's board
  const seedRef = useRef(getDailySeed())

  // Sync refs
  useEffect(() => { pathRef.current = path }, [path])
  useEffect(() => { streakRef.current = streak }, [streak])
  useEffect(() => { gridRef.current = grid }, [grid])

  // Save current game state to localStorage with today's seed
  const saveDailyState = useCallback((overrideState = {}) => {
    const seed = seedRef.current
    const state = {
      grid: overrideState.grid !== undefined ? overrideState.grid : gridRef.current,
      found: overrideState.found !== undefined ? overrideState.found : found,
      score: overrideState.score !== undefined ? overrideState.score : score,
      totalWordsInGrid: overrideState.totalWordsInGrid !== undefined ? overrideState.totalWordsInGrid : totalWordsInGrid,
      targetWord: overrideState.targetWord !== undefined ? overrideState.targetWord : targetWord,
      phase: overrideState.phase !== undefined ? overrideState.phase : phase,
      timeLeft: overrideState.timeLeft !== undefined ? overrideState.timeLeft : timeLeft,
    }
    localStorage.setItem('dailyBoard_' + seed, JSON.stringify(state))
  }, [found, score, totalWordsInGrid, targetWord, phase, timeLeft])

  // Persist daily state whenever key game state changes.
  // timeLeft is deliberately not a dependency — saving every timer tick would
  // hit localStorage once per second; it's captured on phase changes and unload.
  useEffect(() => {
    if (grid.length === 0) return // don't save before initialization
    saveDailyState()
  }, [found, score, phase, targetWord]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save on tab close/reload so the restored timer is accurate
  const saveRef = useRef(saveDailyState)
  useEffect(() => { saveRef.current = saveDailyState }, [saveDailyState])
  useEffect(() => {
    const onUnload = () => {
      if (gridRef.current.length > 0) saveRef.current()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // Pick a random target from words that are actually in the grid
  const pickTargetFromGrid = useCallback((excludeWords = []) => {
    const g = gridRef.current
    if (g.length === 0) return null
    const wordsInGrid = findWordsInGrid(g).filter(w => !excludeWords.includes(w))
    if (wordsInGrid.length === 0) return null
    const pick = wordsInGrid[Math.floor(Math.random() * wordsInGrid.length)]
    const info = lookupWord(pick)
    if (!info) return null
    return {
      chinese: pick,
      pinyin: info.pinyin,
      english: info.english,
    }
  }, [])

  // Initialize game — generate a daily grid or restore from localStorage
  useEffect(() => {
    const todaySeed = seedRef.current

    // Prune saved boards from previous days so localStorage doesn't grow forever
    const todayKey = 'dailyBoard_' + todaySeed
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('dailyBoard_') && key !== todayKey) {
        localStorage.removeItem(key)
      }
    }

    const saved = localStorage.getItem(todayKey)

    if (saved) {
      try {
        const state = JSON.parse(saved)
        setGrid(state.grid)
        setFound(state.found)
        setScore(state.score)
        setTotalWordsInGrid(state.totalWordsInGrid)
        if (state.targetWord) setTargetWord(state.targetWord)
        if (state.phase !== undefined) setPhase(state.phase)
        if (typeof state.timeLeft === 'number') setTimeLeft(state.timeLeft)
        return // done restoring
      } catch (e) {
        console.warn('Failed to restore daily board state:', e)
      }
    }

    // No saved state for today — generate a new daily grid
    const rng = mulberry32(todaySeed)
    const { grid: newGrid, placedWords } = generateDailyGrid(rng)
    setGrid(newGrid)
    // Count total findable words
    const wordsInGrid = findWordsInGrid(newGrid)
    const totalCount = Math.max(wordsInGrid.length, placedWords.length)
    setTotalWordsInGrid(totalCount)
    // Use the first placed word as the target
    const firstWord = placedWords[0] || wordsInGrid[0]
    if (firstWord) {
      const info = lookupWord(firstWord)
      if (info) {
        setTargetWord({
          chinese: firstWord,
          pinyin: info.pinyin,
          english: info.english,
        })
      }
    }

    // Save initial state to localStorage
    saveDailyState({
      grid: newGrid,
      found: [],
      score: 0,
      totalWordsInGrid: totalCount,
      targetWord: null, // will be set below
      phase: 'start',
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    if (phase !== 'play') return
    if (timeLeft <= 0) {
      setPhase('over')
      dragging.current = false
      return
    }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft])

  // Message display
  const showMsg = useCallback((text, type = 'ok') => {
    clearTimeout(msgTimer.current)
    setMsg(text)
    setMsgType(type)
    msgTimer.current = setTimeout(() => setMsg(''), 2000)
  }, [])

  // iOS loads TTS voices asynchronously — utterances spoken before the
  // Chinese voice is ready are silently dropped. Resolve the voice up front
  // and keep it updated via the voiceschanged event.
  const zhVoiceRef = useRef(null)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const pickVoice = () => {
      const voices = speechSynthesis.getVoices()
      zhVoiceRef.current =
        voices.find(v => v.lang === 'zh-CN') ||
        voices.find(v => v.lang && v.lang.startsWith('zh')) ||
        null
    }
    pickVoice()
    speechSynthesis.addEventListener('voiceschanged', pickVoice)
    return () => speechSynthesis.removeEventListener('voiceschanged', pickVoice)
  }, [])

  // iOS also requires speech to be unlocked by a user gesture — speak a
  // silent utterance from the Start button tap so real words play from word 1
  const primeTTS = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    try {
      speechSynthesis.getVoices() // kick off async voice loading
      const utterance = new SpeechSynthesisUtterance(' ')
      utterance.volume = 0
      speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('TTS prime error:', e)
    }
  }, [])

  // Speak word using browser TTS
  const speakWord = useCallback((chinese) => {
    if (!soundOn) return
    if (!('speechSynthesis' in window)) return
    try {
      // iOS can leave the queue stuck in a paused state; clear it first
      if (speechSynthesis.paused) speechSynthesis.resume()
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(chinese)
      utterance.lang = 'zh-CN'
      if (zhVoiceRef.current) utterance.voice = zhVoiceRef.current
      utterance.rate = 0.8
      speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('TTS error:', e)
    }
  }, [soundOn])

  // Get the current word from path
  const word = path.map(i => grid[i]).join('')

  // Submit a word. tracedPath is the cell path the player actually swiped —
  // used for highlighting; falls back to searching the grid when absent.
  const submitWord = useCallback(async (w, tracedPath = null) => {
    if (w.length < 1) return

    // Check if already found
    if (found.some(f => f.word === w)) {
      showMsg(`${w} - Already found!`, 'warn')
      setPath([])
      return
    }

    const isValid = validateWord(w)
    if (isValid) {
      const info = lookupWord(w)
      const points = scoreWord(w)
      const newStreak = streakRef.current + 1
      const totalPoints = points + (newStreak > 1 ? (newStreak - 1) * STREAK_BONUS : 0)

      // Check if this matches the target
      const isTarget = targetWord && w === targetWord.chinese

      // Path (indices) of this word in the grid for highlighting
      const wordPath = tracedPath || findWordInGrid(grid, w)

      const newFound = [...found, { word: w, points: totalPoints, pinyin: info?.pinyin, english: info?.english, isTarget, path: wordPath }]
      setFound(newFound)
      setScore(s => s + totalPoints)
      setStreak(newStreak)
      setPath([])

      speakWord(w)

      let label = `+${totalPoints} pts`
      if (isTarget) label = `TARGET WORD! ${label}`
      else if (newStreak > 1) label = `Streak x${newStreak}! ${label}`
      showMsg(label, 'ok')

      // Check if all words in the grid have been found!
      if (newFound.length >= totalWordsInGrid && totalWordsInGrid > 0) {
        const bonusPoints = 500 // big bonus for finding all words
        // Stop timer early and go to celebration
        setScore(s => s + bonusPoints)
        setPhase('complete')
        dragging.current = false
        showMsg(`🎉 ALL WORDS FOUND! +${bonusPoints} BONUS! 🎉`, 'ok')
        return
      }

      // If they found the target, pick a new one from the grid
      if (isTarget) {
        const foundWords = newFound.map(f => f.word)
        const next = pickTargetFromGrid(foundWords)
        if (next) {
          setTimeout(() => setTargetWord(next), 500)
        } else {
          // No more targets — all words in the grid have been found!
          setTotalWordsInGrid(newFound.length)
          setScore(s => s + 500)
          setPhase('complete')
          dragging.current = false
          showMsg('🎉 ALL WORDS FOUND! 🎉', 'ok')
        }
      }
    } else {
      setPath([])
      setStreak(0)
      showMsg(`"${w}" - Not in word list`, 'bad')
    }
  }, [found, targetWord, showMsg, speakWord, pickTargetFromGrid, totalWordsInGrid])

  // Start game — "Play Again": resets score/found/path but keeps the same daily grid
  const startGame = () => {
    primeTTS() // runs inside the button tap — the user gesture iOS requires
    setScore(0)
    setFound([])
    setPath([])
    setTimeLeft(90)
    setMsg('')
    setPhase('play')
    setStreak(0)
    setPointerPos(null)
    dragging.current = false

    // Recalculate total words from the grid
    const g = gridRef.current
    if (g.length > 0) {
      const wordsInGrid = findWordsInGrid(g)
      setTotalWordsInGrid(wordsInGrid.length)
    }

    // Keep the existing grid — regenerate a target word from the grid
    const target = pickTargetFromGrid([])
    setTargetWord(target)
  }

  // Pointer handlers
  const onPointerDown = useCallback((e) => {
    if (phase !== 'play') return
    if (e.cancelable) e.preventDefault()

    const svg = svgRef.current
    if (!svg) return
    const pt = getSVGPoint(svg, e)
    const idx = cellFromPoint(pt.x, pt.y)
    if (idx >= 0) {
      dragging.current = true
      setPath([idx])
      setPointerPos(pt)
    }
  }, [phase])

  // Keep pathRef in sync for memoized onMove
  const onMove = useCallback((idx) => {
    if (idx < 0 || idx === pathRef.current[pathRef.current.length - 1]) return

    if (pathRef.current.includes(idx)) {
      const existing = pathRef.current.indexOf(idx)
      setPath(pathRef.current.slice(0, existing + 1))
      return
    }

    if (pathRef.current.length > 0 && !adj(pathRef.current[pathRef.current.length - 1], idx)) return
    setPath([...pathRef.current, idx])
  }, [])

  const pointerLastUpdate = useRef(0)
  const onPointerMove = useCallback((e) => {
    if (!dragging.current || phase !== 'play') return
    if (e.cancelable) e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const pt = getSVGPoint(svg, e)
    const now = Date.now()
    if (now - pointerLastUpdate.current > 200) {
      setPointerPos(pt)
      pointerLastUpdate.current = now
    }
    onMove(cellFromPoint(pt.x, pt.y))
  }, [phase, onMove])

  const onPointerUp = useCallback((e) => {
    if (phase !== 'play') return
    if (e && e.cancelable) e.preventDefault()
    dragging.current = false
    if (path.length >= 2) submitWord(word, path)
    else setPath([])
  }, [phase, path, word, submitWord])

  const toggleSound = useCallback(() => {
    if (!soundOn) primeTTS() // re-unlock when sound is turned back on
    setSoundOn(s => !s)
  }, [soundOn, primeTTS])

  return {
    grid, path, found, score, targetWord,
    phase, timeLeft, msg, msgType,
    streak, pointerPos, soundOn,
    svgRef, word, dragging, totalWordsInGrid,
    startGame, submitWord,
    onPointerDown, onPointerMove, onPointerUp,
    setPhase, toggleSound, showMsg,
  }
}
