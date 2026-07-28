import { useMemo } from 'react'

export default function GameStatus({ phase, score, timeLeft, targetWord, found, msg, msgType, streak, soundOn, totalWordsInGrid, startGame, toggleSound }) {

  // Generate confetti particles once per celebration — regenerating on every
  // render makes the particles jump around mid-animation
  const confettiParticles = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 1.5 + Math.random() * 2,
    color: ['#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa'][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 10,
    round: Math.random() > 0.5,
    rotate: Math.random() * 360,
  })), [phase])

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto relative">
      {/* Celebration confetti */}
      {phase === 'complete' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiParticles.map(p => (
            <div
              key={p.id}
              className="absolute animate-bounce"
              style={{
                left: `${p.left}%`,
                top: '-20px',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.round ? '50%' : '2px',
                animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s infinite`,
                opacity: 0.9,
                transform: `rotate(${p.rotate}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Top bar: sound toggle + timer + score */}
      {(phase === 'play') && (
        <div className="flex items-center justify-between w-full mb-4 px-2">
          <button
            onClick={toggleSound}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            className="text-2xl bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-12 h-12 flex items-center justify-center transition-colors"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>

          <div className="text-3xl font-bold text-white tabular-nums">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>

          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {score} pts
          </div>
        </div>
      )}

      {/* Start screen */}
      {phase === 'start' && (
        <div className="flex flex-col items-center gap-5 mt-8 px-4">
          <h1 className="text-5xl font-bold text-white">字词猎人</h1>
          <p className="text-xl text-emerald-400">Chinese Word Hunter</p>
          <p className="text-gray-400 text-center max-w-sm">
            A daily word-search puzzle — no Chinese knowledge needed.
            Every tile shows its pinyin, so you can play by sound.
          </p>

          <div className="bg-gray-800/80 rounded-xl p-5 max-w-sm w-full text-left">
            <h2 className="text-emerald-400 font-bold mb-3 text-center">How to play</h2>
            <ul className="text-gray-300 text-sm space-y-2.5">
              <li className="flex gap-2.5">
                <span>🎯</span>
                <span>You get a clue: a <span className="text-emerald-400">pinyin</span> (how the word sounds) and its English meaning.</span>
              </li>
              <li className="flex gap-2.5">
                <span>👆</span>
                <span>Swipe across neighboring tiles — in any direction, even diagonally or zig-zag — to connect characters into the word.</span>
              </li>
              <li className="flex gap-2.5">
                <span>💡</span>
                <span>Match the small pinyin above each character to the clue. Found words are spoken out loud so you learn the sound.</span>
              </li>
              <li className="flex gap-2.5">
                <span>⭐</span>
                <span>Any valid word counts, not just the target — longer words and streaks earn bonus points.</span>
              </li>
              <li className="flex gap-2.5">
                <span>⏱️</span>
                <span>Find as many of the hidden words as you can in 90 seconds. Find them all for a +500 bonus!</span>
              </li>
              <li className="flex gap-2.5">
                <span>📅</span>
                <span>Everyone gets the same board — a new puzzle every day.</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => { startGame(); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xl px-10 py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30"
          >
            Start Game
          </button>
        </div>
      )}

      {/* Play screen - target word prompt */}
      {phase === 'play' && targetWord && (
        <div className="w-full mb-3">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Find this word:</p>
            <p className="text-3xl font-bold text-emerald-400 mb-1">{targetWord.pinyin}</p>
            <p className="text-lg text-gray-300">{targetWord.english}</p>
          </div>

          {/* Streak indicator */}
          {streak > 1 && (
            <div className="text-center mt-2 text-orange-400 font-bold text-sm">
              🔥 Streak x{streak}!
            </div>
          )}

          {/* Words found counter */}
          <div className="text-center mt-1 text-gray-500 text-xs">
            Words found: {found.length} / {totalWordsInGrid}
          </div>
        </div>
      )}

      {/* Message toast — always rendered to prevent layout shifts */}
      <div
        className={`mb-3 px-4 py-2 rounded-xl text-center font-bold transition-none ${
          msg
            ? (msgType === 'ok' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
               msgType === 'warn' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
               'bg-red-500/20 text-red-400 border border-red-500/30')
            : 'invisible'
        }`}
      >
        {msg || '\u00A0'}
      </div>

      {/* Game over screen - time up */}
      {phase === 'over' && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <h2 className="text-4xl font-bold text-white">Time's Up!</h2>
          <div className="text-6xl font-bold text-emerald-400">{score} pts</div>
          <p className="text-gray-400">Words found: {found.length} / {totalWordsInGrid}</p>
          <button
            onClick={startGame}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xl px-10 py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Celebration screen - found all words */}
      {phase === 'complete' && (
        <div className="flex flex-col items-center gap-6 mt-8 relative z-10">
          <div className="text-6xl mb-2">🎉🎊🎉</div>
          <h2 className="text-4xl font-bold text-emerald-400">Amazing!</h2>
          <p className="text-2xl text-white">You found all the words!</p>
          <div className="text-6xl font-bold text-yellow-400">{score} pts</div>
          <p className="text-gray-400 text-center max-w-sm">
            You found all {found.length} words before time ran out!
            +500 bonus points awarded!
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-sm">
            {found.map((f, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
              >
                <span className="text-base">{f.word}</span>
                <span className="text-emerald-400 ml-2">+{f.points}</span>
              </div>
            ))}
          </div>
          <button
            onClick={startGame}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xl px-10 py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30 mt-4"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Confetti animation styles */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
