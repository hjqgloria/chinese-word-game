import { cellCenter, ROWS, COLS, TILE, GAP, adj, getCharPinyin } from './gameLogic'

export default function GameBoard({ grid, path, pointerPos, dragging, svgRef, onPointerDown, onPointerMove, onPointerUp, word, found, totalWordsInGrid }) {
  const W = COLS * (TILE + GAP) - GAP
  const H = ROWS * (TILE + GAP) - GAP
  const currentWord = word || ''

  // Build a set of all grid indices that are part of any found word
  const foundIndices = new Set()
  if (found) {
    for (const f of found) {
      if (f.path) {
        for (const idx of f.path) {
          foundIndices.add(idx)
        }
      }
    }
  }

  return (

    <div className="bg-gray-900 rounded-xl p-2 touch-none" style={{maxWidth:'min(408px,calc(100vw-1rem))'}}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        className="block cursor-default w-full"
        style={{aspectRatio: `${W} / ${H}`}}
      >
        {/* Connection lines between selected cells */}
        {path.length > 1 && path.slice(0, -1).map((idx, i) => {
          const a = cellCenter(idx)
          const b = cellCenter(path[i + 1])
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className="stroke-emerald-400 stroke-[4.5] stroke-round opacity-90"
            />
          )
        })}

        {/* Dashed line from last cell to pointer */}
        {dragging.current && path.length > 0 && pointerPos && (
          <line
            x1={cellCenter(path[path.length - 1]).x}
            y1={cellCenter(path[path.length - 1]).y}
            x2={pointerPos.x}
            y2={pointerPos.y}
            className="stroke-emerald-400 stroke-[3] [stroke-dasharray:4_2] opacity-60"
          />
        )}

        {/* Grid cells */}
        {grid.map((char, i) => {
          const x = (i % COLS) * (TILE + GAP)
          const y = Math.floor(i / COLS) * (TILE + GAP)
          const inPath = path.includes(i)
          const isLast = path[path.length - 1] === i
          const canConnect = !inPath && path.length > 0 && adj(path[path.length - 1], i) && dragging.current
          const isFound = foundIndices.has(i)
          const pinyinLabel = getCharPinyin(char)

          return (
            <g key={i} transform={`translate(${x},${y})`}>
              {/* Tile background */}
              <rect
                width={TILE}
                height={TILE}
                rx={6}
                className={`stroke-1 ${
                  isLast ? 'fill-emerald-400 stroke-black' :
                  inPath ? 'fill-emerald-300 stroke-gray-600' :
                  canConnect ? 'fill-gray-600 stroke-transparent' :
                  isFound ? 'fill-emerald-100 stroke-emerald-400' :
                  'fill-white stroke-transparent'
                }`}
              />
              {/* Found indicator: small colored underline bar */}
              {isFound && (
                <rect
                  x={TILE * 0.2}
                  y={TILE - 4}
                  width={TILE * 0.6}
                  height={2}
                  rx={1}
                  className="fill-emerald-500"
                />
              )}
              {/* Pinyin label above character */}
              {pinyinLabel && (
                <text
                  x={TILE / 2}
                  y={8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] fill-gray-400 font-light"
                  style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
                >
                  {pinyinLabel}
                </text>
              )}
              {/* Chinese character */}
              <text
                x={TILE / 2}
                y={TILE / 2 + 2}
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-[20px] font-medium ${isFound ? 'fill-emerald-700' : 'fill-black'}`}
                style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
              >
                {char}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Current word display */}
      <div className="mt-3 text-center h-8">
        {currentWord && (
          <span className="text-xl text-emerald-400 font-bold">
            {currentWord}
          </span>
        )}
      </div>
    </div>
  )
}