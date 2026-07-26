import './App.css'
import { useGameState } from './useGameState'
import GameBoard from './GameBoard'
import GameStatus from './GameStatus'

function App() {
  const {
    grid, path, found, score, targetWord,
    phase, timeLeft, msg, msgType,
    streak, pointerPos, soundOn,
    svgRef, word, dragging, totalWordsInGrid,
    startGame, submitWord,
    onPointerDown, onPointerMove, onPointerUp,
    setPhase, toggleSound, showMsg,
  } = useGameState()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-2 sm:px-4 select-none">
      <GameStatus
        phase={phase}
        score={score}
        timeLeft={timeLeft}
        targetWord={targetWord}
        found={found}
        msg={msg}
        msgType={msgType}
        streak={streak}
        soundOn={soundOn}
        totalWordsInGrid={totalWordsInGrid}
        startGame={startGame}
        setPhase={setPhase}
        toggleSound={toggleSound}
        onPointerDown={onPointerDown}
      />

      {(phase === 'play') && grid.length > 0 && (
        <div className="mt-4">
          <GameBoard
            grid={grid}
            path={path}
            pointerPos={pointerPos}
            dragging={dragging}
            svgRef={svgRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            word={word}
            found={found}
          />
        </div>
      )}
    </div>
  )
}

export default App
