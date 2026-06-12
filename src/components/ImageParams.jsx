import { useState } from 'react'
import { CopyButton } from './OutputPanel'
import { parseSettingsPairs, MAIN_PARAM_KEYS } from '../utils/sdParams'

/**
 * Presentational pieces for an image's embedded generation data, shared by
 * ImageDetailModal (full-screen) and GenerationResultPanel (editor right pane).
 */

export function SeedCopyButton({ seed }) {
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

/** Labeled prompt block with a copy button. `maxHeightClass` caps the scroll area. */
export function PromptBlock({ label, color, text, maxHeightClass = 'max-h-48' }) {
  if (!text) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-medium ${color}`}>{label}</span>
        <CopyButton text={text} label={label === 'Positive' ? 'P' : 'N'} />
      </div>
      <pre className={`bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed ${maxHeightClass} overflow-y-auto`}>
        {text}
      </pre>
    </div>
  )
}

/** Seed (own row + copy) + curated 2-col grid + collapsible "その他" tail. */
export function ParamSummary({ settings, seed }) {
  const pairs = parseSettingsPairs(settings)
  const mainPairs = pairs.filter(([k]) => MAIN_PARAM_KEYS.includes(k))
  const otherPairs = pairs.filter(([k]) => !MAIN_PARAM_KEYS.includes(k) && k !== 'Seed')
  return (
    <>
      {seed && (
        <div className="flex items-center justify-between bg-gray-800/60 rounded px-2 py-1.5">
          <span className="text-[11px] text-gray-400">Seed</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-gray-200 font-mono truncate">{seed}</span>
            <SeedCopyButton seed={seed} />
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
  )
}
