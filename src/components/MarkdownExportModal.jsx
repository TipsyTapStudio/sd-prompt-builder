import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

function sanitizeFilename(name) {
  return (name || '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .replace(/[\s\.]+$/g, '')
    .slice(0, 200)
}

function formatTimestampShort() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function computeDefaultFilename(title) {
  const sanitized = sanitizeFilename((title || '').trim())
  const stem = sanitized || 'prompt'
  // Avoid double-dating if title already contains an 8-digit YYYYMMDD chunk
  if (/(?:^|[^\d])\d{8}(?:[^\d]|$)/.test(stem)) return stem
  return `${stem}_${formatTimestampShort()}`
}

export default function MarkdownExportModal({ prompt, defaultIncludeBench, onExport, onClose }) {
  const [filename, setFilename] = useState(() => computeDefaultFilename(prompt?.title))
  const [includeBench, setIncludeBench] = useState(!!defaultIncludeBench)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const submit = () => {
    const stem = sanitizeFilename(filename) || 'prompt'
    onExport({ filename: `${stem}.md`, includeBench })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[420px] mx-4">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">
            Markdown形式で Export
            {prompt?.title && (
              <span className="text-gray-500 font-normal ml-2 truncate inline-block max-w-[200px] align-bottom">— {prompt.title}</span>
            )}
          </h2>
          <button onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer">
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">ファイル名</label>
            <div className="flex items-stretch">
              <input
                ref={inputRef}
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-l px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                maxLength={200}
              />
              <span className="flex items-center px-2 text-xs text-gray-500 bg-gray-800/50 border border-l-0 border-gray-700 rounded-r font-mono">.md</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">使用できない文字 (<code>/ \ : * ? " &lt; &gt; |</code>) は <code>_</code> に置換されます</p>
          </div>

          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBench}
                onChange={e => setIncludeBench(e.target.checked)}
                className="mt-0.5 cursor-pointer"
              />
              <div>
                <div className="text-xs text-gray-300">ベンチリストも含める（バックアップ用）</div>
                <div className="text-[10px] text-gray-600">通常はOFF推奨。設定 → ベンチ編集に専用バックアップあり。</div>
              </div>
            </label>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors cursor-pointer">
            キャンセル
          </button>
          <button onClick={submit}
            className="px-4 py-2 text-xs bg-blue-600/80 hover:bg-blue-500/80 rounded-lg text-white font-medium transition-colors cursor-pointer">
            Export
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
