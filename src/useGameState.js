import { useState, useEffect, useRef, useCallback } from 'react'
import {
  generateDailyGrid, validateWord, lookupWord, scoreWord,
  findWordsInGrid, findWordInGrid, adj, cellFromPoint, getSVGPoint, mulberry32,
  getDailySeed, STREAK_BONUS
} from './gameLogic'

// Seconds a player gets to hunt unaided before the target word's clue appears
const HINT_DELAY = 15

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
  // The target word's clue stays hidden at first so players get a chance to
  // hunt on their own; it unlocks after HINT_DELAY seconds or on request.
  const [hintRevealed, setHintRevealed] = useState(false)
  const [hintCountdown, setHintCountdown] = useState(HINT_DELAY)
  // Set to the just-found target so the player can study it before moving on.
  // While it's set the round timer is paused.
  const [reviewWord, setReviewWord] = useState(null)

  const dragging = useRef(false)
  const svgRef = useRef(null)
  const msgTimer = useRef(null)
  // Next target, held back until the player dismisses the review card
  const pendingTarget = useRef(null)
  const pathRef = useRef(path)
  const streakRef = useRef(streak)
  const gridRef = useRef(grid)
  // Capture the seed once — playing past midnight must not swap the board out
  // from under the player mid-round
  const seedRef = useRef(getDailySeed())

  // Sync refs
  useEffect(() => { pathRef.current = path }, [path])
  useEffect(() => { streakRef.current = streak }, [streak])
  useEffect(() => { gridRef.current = grid }, [grid])

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

  // Build today's board. The grid is a pure function of the daily seed, so
  // every load reconstructs the same puzzle without persisting anything — and
  // a refresh drops the player back on the start screen with a clean round
  // rather than into a half-finished one.
  useEffect(() => {
    // Round state written by earlier versions would otherwise sit there unread
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('dailyBoard_')) localStorage.removeItem(key)
    }

    const rng = mulberry32(seedRef.current)
    const { grid: newGrid, placedWords } = generateDailyGrid(rng)
    setGrid(newGrid)
    // Count total findable words
    const wordsInGrid = findWordsInGrid(newGrid)
    setTotalWordsInGrid(Math.max(wordsInGrid.length, placedWords.length))
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
  }, [])

  // Timer — paused while the player is studying a word they just found
  useEffect(() => {
    if (phase !== 'play' || reviewWord) return
    if (timeLeft <= 0) {
      setPhase('over')
      dragging.current = false
      return
    }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft, reviewWord])

  // Countdown to the clue being revealed. Runs on the same conditions as the
  // round timer so a paused round never burns the player's unaided hunt time.
  useEffect(() => {
    if (phase !== 'play' || reviewWord || hintRevealed) return
    if (hintCountdown <= 0) {
      setHintRevealed(true)
      return
    }
    const t = setTimeout(() => setHintCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, reviewWord, hintRevealed, hintCountdown])

  const revealHint = useCallback(() => setHintRevealed(true), [])

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

  // Speak a word using browser TTS. Always speaks — this backs the explicit
  // 🔊 buttons, where a tap is a direct request regardless of the mute toggle.
  const pronounce = useCallback((chinese) => {
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
  }, [])

  // Automatic playback on finding a word — silent when the player has muted
  const speakWord = useCallback((chinese) => {
    if (!soundOn) return
    pronounce(chinese)
  }, [soundOn, pronounce])

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

      // Clearing the target queues up the next one, shown once the player
      // dismisses the card
      if (isTarget) {
        const foundWords = newFound.map(f => f.word)
        const next = pickTargetFromGrid(foundWords)
        if (!next) {
          // No more targets — all words in the grid have been found!
          setTotalWordsInGrid(newFound.length)
          setScore(s => s + 500)
          setPhase('complete')
          dragging.current = false
          showMsg('🎉 ALL WORDS FOUND! 🎉', 'ok')
          return
        }
        pendingTarget.current = next
      }

      // Every word earns a beat to study it, target or not
      setReviewWord({
        word: w,
        pinyin: info?.pinyin,
        english: info?.english,
        points: totalPoints,
        isTarget,
      })
    } else {
      setPath([])
      setStreak(0)
      showMsg(`"${w}" - Not in our word list`, 'bad')
    }
  }, [found, targetWord, showMsg, speakWord, pickTargetFromGrid, totalWordsInGrid])

  // Leave the review card and move on to the queued target word
  const dismissReview = useCallback(() => {
    setReviewWord(null)
    const next = pendingTarget.current
    pendingTarget.current = null
    if (next) {
      setTargetWord(next)
      setHintRevealed(false)
    }
    // The countdown exists to spot a stuck player, so finding anything at all
    // — target or bonus — earns a full stretch of unaided hunting again.
    // An already-revealed clue stays up; it belongs to a target still unfound.
    setHintCountdown(HINT_DELAY)
  }, [])

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
    setReviewWord(null)
    setHintRevealed(false)
    setHintCountdown(HINT_DELAY)
    pendingTarget.current = null
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
    hintRevealed, hintCountdown, reviewWord,
    startGame, submitWord, revealHint, dismissReview, pronounce,
    onPointerDown, onPointerMove, onPointerUp,
    setPhase, toggleSound, showMsg,
  }
}
