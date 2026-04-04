import { useState } from 'react'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      {copied ? 'Copied!' : 'コピー'}
    </button>
  )
}

export default function OutputPanel({ positivePrompt, negativePrompt, includeHeaders, onToggleHeaders }) {
  return (
    <div className="mt-8">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">── 出力 ──</h2>
      </div>

      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeHeaders}
          onChange={onToggleHeaders}
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-500"
        />
        <span className="text-sm text-gray-400">セクション見出しを含める</span>
      </label>

      {/* Positive Output */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-400">Positive</span>
          <CopyButton text={positivePrompt} />
        </div>
        <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all min-h-[60px] leading-relaxed">
          {positivePrompt || <span className="text-gray-600">（セクションに入力するとここにプロンプトが表示されます）</span>}
        </pre>
      </div>

      {/* Negative Output */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-red-400">Negative</span>
          <CopyButton text={negativePrompt} />
        </div>
        <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all min-h-[60px] leading-relaxed">
          {negativePrompt || <span className="text-gray-600">（Negative セクションに入力するとここに表示されます）</span>}
        </pre>
      </div>
    </div>
  )
}
