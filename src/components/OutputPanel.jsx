import { useState } from 'react'

export function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
        copied
          ? 'bg-green-600 border-green-500 text-white'
          : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300'
      }`}
    >
      {copied ? 'Copied!' : (label || 'コピー')}
    </button>
  )
}

export default function OutputPanel({ positivePrompt, negativePrompt, includeHeaders, onToggleHeaders }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="sticky bottom-0 z-40 bg-gray-950 border-t border-gray-700 -mx-4 px-4 mt-8">
      {/* Collapsed header bar — always visible */}
      <div
        className="flex items-center justify-between py-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▲'}</span>
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">出力</span>
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={includeHeaders}
              onChange={onToggleHeaders}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 accent-blue-500"
            />
            <span className="text-xs text-gray-500">見出し</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={positivePrompt} label="P コピー" />
          <CopyButton text={negativePrompt} label="N コピー" />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pb-3 max-h-[40vh] overflow-y-auto">
          {/* Positive Output */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-400">Positive</span>
            </div>
            <pre className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
              {positivePrompt || <span className="text-gray-600">（入力するとここに表示）</span>}
            </pre>
          </div>

          {/* Negative Output */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-red-400">Negative</span>
            </div>
            <pre className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
              {negativePrompt || <span className="text-gray-600">（Negative に入力するとここに表示）</span>}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
