import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CopyButton } from './OutputPanel'

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

/** Split "Steps: 20, Sampler: ..., Lora hashes: \"a: b, c: d\"" respecting quotes. */
function parseSettingsPairs(settings) {
  if (!settings) return []
  const parts = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < settings.length; i++) {
    const ch = settings[i]
    if (ch === '"') inQuote = !inQuote
    if (!inQuote && ch === ',' && settings[i + 1] === ' ') {
      parts.push(cur)
      cur = ''
      i++
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => {
    const idx = p.indexOf(': ')
    return idx > 0 ? [p.slice(0, idx).trim(), p.slice(idx + 2).trim()] : [p.trim(), '']
  }).filter(([k]) => k)
}

function SeedCopyButton({ seed }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(seed)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }
  return (
    <button onClick={handleCopy}
      className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors cursor-pointer flex-shrink-0 ${
        copied ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300'
      }`}>
      {copied ? 'Copied!' : 'コピー'}
    </button>
  )
}

function PromptBlock({ label, color, text }) {
  if (!text) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-medium ${color}`}>{label}</span>
        <CopyButton text={text} label={label === 'Positive' ? 'P' : 'N'} />
      </div>
      <pre className="bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
        {text}
      </pre>
    </div>
  )
}

export default function ImageDetailModal({ image, onDelete, onClose }) {
  const url = useMemo(() => URL.createObjectURL(image.thumb), [image.thumb])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDelete = () => {
    if (!window.confirm('サムネイルと記録を削除します。元の PNG ファイルは削除されません。よろしいですか？')) return
    onDelete(image.id)
    onClose()
  }

  const settingsPairs = parseSettingsPairs(image.settings)
  const mainKeys = ['Steps', 'Sampler', 'Schedule type', 'CFG scale', 'Size', 'Model', 'Clip skip']
  const mainPairs = settingsPairs.filter(([k]) => mainKeys.includes(k))
  const otherPairs = settingsPairs.filter(([k]) => !mainKeys.includes(k) && k !== 'Seed')

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Left: image */}
        <div className="flex-1 min-w-0 bg-gray-950 flex items-center justify-center p-4">
          {url && (
            <img src={url} alt={image.fileName}
              className="max-w-full max-h-[80vh] object-contain rounded" />
          )}
        </div>

        {/* Right: metadata */}
        <div className="w-[360px] flex-shrink-0 flex flex-col border-l border-gray-800">
          <div className="flex items-start justify-between px-4 pt-3 pb-2">
            <div className="min-w-0">
              <div className="text-xs text-gray-200 font-medium truncate" title={image.fileName}>
                {image.fileName}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {image.width}×{image.height}
                {' ・ 登録: '}
                {new Date(image.createdAt).toLocaleString('ja-JP')}
              </div>
            </div>
            <button onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors cursor-pointer flex-shrink-0">
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
            {!image.params ? (
              <div className="text-xs text-gray-500 bg-gray-800/50 rounded px-3 py-2">
                この画像にはパラメータ情報が埋め込まれていません
              </div>
            ) : (
              <>
                <PromptBlock label="Positive" color="text-blue-400" text={image.positive} />
                <PromptBlock label="Negative" color="text-red-400" text={image.negative} />

                {/* Seed — most reused value, own row with copy */}
                {image.seed && (
                  <div className="flex items-center justify-between bg-gray-800/60 rounded px-2 py-1.5">
                    <span className="text-[11px] text-gray-400">Seed</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-gray-200 font-mono truncate">{image.seed}</span>
                      <SeedCopyButton seed={image.seed} />
                    </div>
                  </div>
                )}

                {mainPairs.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {mainPairs.map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <div className="text-[9px] text-gray-500">{k}</div>
                        <div className="text-[11px] text-gray-300 truncate" title={v}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {otherPairs.length > 0 && (
                  <details className="text-[11px]">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-300 select-none">
                      その他のパラメータ ({otherPairs.length})
                    </summary>
                    <div className="mt-1.5 space-y-1">
                      {otherPairs.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-gray-500 flex-shrink-0">{k}</span>
                          <span className="text-gray-300 truncate" title={v}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-800 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">元の PNG ファイルは削除されません</span>
            <button onClick={handleDelete}
              className="px-3 py-1 text-xs text-red-400 hover:bg-red-950/50 rounded transition-colors cursor-pointer">
              削除
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
