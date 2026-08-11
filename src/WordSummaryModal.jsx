import { useState, useEffect, useRef } from 'react'

export default function WordSummaryModal({ found, phase, onClose }) {
  const [selectedWord, setSelectedWord] = useState(null)
  const [examples, setExamples] = useState({})
  const [loading, setLoading] = useState(true)
  const modalRef = useRef(null)

  // Lazy-load examples.json on first render
  useEffect(() => {
    const loadExamples = async () => {
      try {
        setLoading(true)
        const res = await fetch('/word_examples.json')
        if (res.ok) {
          const data = await res.json()
          setExamples(data)
        }
      } catch (e) {
        console.warn('Failed to load word examples:', e)
        setExamples({})
      } finally {
        setLoading(false)
      }
    }
    loadExamples()
  }, [])

  const speakSentence = (sentence) => {
    if (!('speechSynthesis' in window)) return
    try {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(sentence)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.8
      speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('TTS error:', e)
    }
  }

  const selected = selectedWord && found.find(f => f.word === selectedWord)
  const exampleData = selected ? examples?.[selected.word] : null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-2 overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-xl p-6 max-w-md w-full my-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Detail view */}
        {selected ? (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setSelectedWord(null)}
              className="text-left text-gray-400 hover:text-gray-300 transition"
            >
              ← Back
            </button>

            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400 mb-2">
                {selected.word}
              </div>
              <div className="text-sm text-gray-400 mb-3">
                {selected.pinyin}
              </div>
              <div className="text-lg text-gray-300">
                {selected.english}
              </div>
            </div>

            {/* Example sentence */}
            {exampleData ? (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Example:</p>
                <p className="text-base text-white mb-2 leading-relaxed">
                  {exampleData[0]}
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  {exampleData[1]}
                </p>
                <p className="text-sm text-gray-300 italic">
                  "{exampleData[2]}"
                </p>
                <button
                  onClick={() => speakSentence(exampleData[0])}
                  className="mt-3 text-2xl bg-gray-700 hover:bg-gray-600 rounded p-2 transition"
                >
                  🔊
                </button>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-4 text-center text-gray-400 text-sm">
                {loading ? 'Loading...' : 'No example available'}
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-emerald-400">
              Words Found: {found.length}
            </h2>

            <div className="flex flex-wrap gap-2 max-h-96 overflow-y-auto">
              {found.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedWord(f.word)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30 transition cursor-pointer"
                >
                  <div className="text-base leading-tight">{f.word}</div>
                  <div className="text-xs text-emerald-400/70">{f.pinyin}</div>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
