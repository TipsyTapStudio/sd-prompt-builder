import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import sectionsData from '../data/sections.json'
import { parsePrevNextOutput } from '../utils/promptParser'

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

function CopyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
    </svg>
  )
}

function dumpSceneAsTemplate(prompt) {
  if (!prompt) return ''
  const lines = []
  lines.push('### Title')
  lines.push(prompt.title || '')
  lines.push('')
  if (prompt.description) {
    lines.push('### Description')
    lines.push(prompt.description)
    lines.push('')
  }
  for (const s of sectionsData.positive) {
    const v = (prompt.sections?.[s.key] || '').trim()
    if (!v) continue
    lines.push(`### ${s.name}`)
    lines.push(v)
    lines.push('')
  }
  const hasNeg = sectionsData.negative.some(s => (prompt.negative_sections?.[s.key] || '').trim())
  if (hasNeg) {
    lines.push('---')
    lines.push('')
    for (const s of sectionsData.negative) {
      const v = (prompt.negative_sections?.[s.key] || '').trim()
      if (!v) continue
      lines.push(`### Negative - ${s.name}`)
      lines.push(v)
      lines.push('')
    }
  }
  return lines.join('\n').trimEnd()
}

function buildTemplate(anchor, { wantPrev, wantNext, lockIdentity }) {
  const directions = [wantPrev && 'prev', wantNext && 'next'].filter(Boolean).join(' / ') || 'prev / next'
  const identity = lockIdentity
    ? '- Face & Hair / Body は **完全にコピー**（キャラ同一性を保つ）\n- Outfit / Composition / Effects / Environment / Lighting はストーリー進行に合わせて変えてよい'
    : '- 一貫性は LLM の判断に任せる（コスチューム変化など自由）'

  return `# 前後シーン生成

## 起点シーン

${dumpSceneAsTemplate(anchor)}

## 指示

- 上記シーンを起点に、${directions} のシーンを生成してください
- 9 Positive セクション + 5 Negative セクションの構造を維持
${identity}
- タグは英語のまま、\`(tag:weight)\` や \`{a|b|c}\` 記法は許容
- Title は短い日本語、Description は 1〜2 行の日本語

## セクション一覧（参考）

Positive:
${sectionsData.positive.map(s => `- ${s.name}`).join('\n')}

Negative:
${sectionsData.negative.map(s => `- ${s.name}`).join('\n')}

## 出力フォーマット

以下のフォーマットで出力。空セクションは省略可。
**回答全体を Markdown コードブロック（\`\`\`）で囲んで返してください。**

\`\`\`
## prev
### Title
（短い日本語）
### Description
（1〜2行の日本語）
### Quality & Technical
masterpiece, best quality, ...
### Face & Hair
1girl, brown hair, ...
（他の Positive セクション）

---

### Negative - General Quality
worst quality, ...
（他の Negative セクション）

## next
### Title
...
（同形式）
\`\`\``
}

function MiniScenePreview({ heading, scene, accepted, onToggle }) {
  if (!scene) {
    return (
      <div className="flex-1 bg-gray-950/50 border border-gray-800/50 rounded-lg p-3 text-xs text-gray-600 italic">
        {heading}: 出力に含まれていません
      </div>
    )
  }
  return (
    <div className={`flex-1 bg-gray-950/50 border rounded-lg p-3 transition-colors ${
      accepted ? 'border-blue-500/60' : 'border-gray-800/50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{heading}</div>
        <label className="flex items-center gap-1 text-[11px] text-gray-300 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={onToggle}
            className="cursor-pointer accent-blue-500" />
          採用
        </label>
      </div>
      <div className="text-sm font-medium text-gray-100 mb-1 line-clamp-2 break-words">
        {scene.title || '(タイトルなし)'}
      </div>
      {scene.description && (
        <div className="text-[11px] text-gray-400 mb-2 line-clamp-2 whitespace-pre-wrap break-words">
          {scene.description}
        </div>
      )}
      <div className="space-y-1">
        {sectionsData.positive.map(s => {
          const v = scene.sections[s.key]
          if (!v) return null
          return (
            <div key={s.key}>
              <div className="text-[10px] text-blue-400">{s.name}</div>
              <div className="text-[11px] text-gray-300 font-mono break-words line-clamp-2">{v}</div>
            </div>
          )
        })}
        {Object.keys(scene.negativeSections).length > 0 && (
          <>
            <div className="border-t border-gray-800 my-1" />
            {sectionsData.negative.map(s => {
              const v = scene.negativeSections[s.key]
              if (!v) return null
              return (
                <div key={s.key}>
                  <div className="text-[10px] text-red-400">{s.name}</div>
                  <div className="text-[11px] text-gray-300 font-mono break-words line-clamp-2">{v}</div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default function SceneExpansionModal({
  folder,
  scenes,
  defaultAnchorId,
  onClose,
  onApply, // ({ prev, next, anchorId }) => void
}) {
  const [anchorId, setAnchorId] = useState(defaultAnchorId || scenes[0]?.id || '')
  const [tab, setTab] = useState('template')
  const [wantPrev, setWantPrev] = useState(true)
  const [wantNext, setWantNext] = useState(true)
  const [lockIdentity, setLockIdentity] = useState(true)
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState(null)
  const [acceptPrev, setAcceptPrev] = useState(true)
  const [acceptNext, setAcceptNext] = useState(true)
  const [parseError, setParseError] = useState(null)

  const anchor = useMemo(() => scenes.find(s => s.id === anchorId) || null, [scenes, anchorId])
  const template = useMemo(() => buildTemplate(anchor, { wantPrev, wantNext, lockIdentity }), [anchor, wantPrev, wantNext, lockIdentity])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(template)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = template
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [template])

  const handleParse = useCallback(() => {
    if (!importText.trim()) return
    setParseError(null)
    const result = parsePrevNextOutput(importText)
    if (!result.prev && !result.next) {
      setParseError('「## prev」または「## next」のブロックが見つかりませんでした。')
      setPreview(null); return
    }
    setPreview(result)
    setAcceptPrev(!!result.prev)
    setAcceptNext(!!result.next)
  }, [importText])

  const handleApply = useCallback(() => {
    if (!preview || !anchor) return
    const out = {
      anchorId: anchor.id,
      prev: (acceptPrev && preview.prev) ? preview.prev : null,
      next: (acceptNext && preview.next) ? preview.next : null,
    }
    if (!out.prev && !out.next) return
    onApply(out)
    onClose()
  }, [preview, acceptPrev, acceptNext, anchor, onApply, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[860px] max-h-[85vh] flex flex-col mx-4">
        <div className="px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-200">前後シーン生成</h2>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer">
              <CloseIcon />
            </button>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setTab('template')}
              className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                tab === 'template' ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-gray-400'
              }`}>テンプレート</button>
            <button onClick={() => setTab('import')}
              className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                tab === 'import' ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-gray-400'
              }`}>取り込み</button>
          </div>
        </div>

        {/* Anchor selector — shared across tabs */}
        <div className="px-5 py-2.5 bg-gray-950/30 border-b border-gray-800 flex items-center gap-3 flex-wrap">
          <label className="text-[11px] text-gray-500">起点シーン:</label>
          <select value={anchorId} onChange={e => setAnchorId(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
            {scenes.map((s, i) => (
              <option key={s.id} value={s.id}>#{i + 1} {s.title || 'Untitled'}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-600 ml-auto">フォルダ: {folder.name}</span>
        </div>

        {tab === 'template' ? (
          <>
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <ol className="list-decimal list-inside text-[11px] text-blue-300/70 space-y-0.5">
                <li>下のテンプレートをコピー</li>
                <li>Claude AI / ChatGPT に貼り付け</li>
                <li>AI の出力を「取り込み」タブに貼って適用</li>
              </ol>
            </div>

            <div className="px-5 py-2.5 border-b border-gray-800 flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={wantPrev} onChange={e => setWantPrev(e.target.checked)} className="cursor-pointer accent-blue-500" />
                直前 (prev)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={wantNext} onChange={e => setWantNext(e.target.checked)} className="cursor-pointer accent-blue-500" />
                直後 (next)
              </label>
              <span className="text-gray-700 text-xs">|</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={lockIdentity} onChange={e => setLockIdentity(e.target.checked)} className="cursor-pointer accent-blue-500" />
                <span>キャラ同一性を維持（Face & Hair / Body 固定）</span>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <pre className="text-[11px] leading-relaxed text-gray-400 whitespace-pre-wrap font-mono bg-gray-950/50 rounded-lg p-4 border border-gray-800/50">
                {template}
              </pre>
            </div>

            <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
              <button onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  copied ? 'bg-green-600/80 text-white' : 'bg-blue-600/80 hover:bg-blue-500/80 text-white'
                }`}>
                <CopyIcon size={13} />
                {copied ? 'コピーしました' : 'テンプレートをコピー'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <p className="text-[11px] text-blue-300/70">AI の出力（## prev / ## next ブロック）を貼り付け、「プレビュー」→ 採用範囲を確認 →「適用」</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setPreview(null); setParseError(null) }}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                style={{ minHeight: '180px' }}
                placeholder={'## prev\n### Title\n...\n## next\n### Title\n...'}
                rows={8}
              />

              {parseError && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-[11px] text-red-400">
                  {parseError}
                </div>
              )}

              {preview && (
                <div className="flex gap-3">
                  <MiniScenePreview heading="prev（直前）" scene={preview.prev}
                    accepted={acceptPrev} onToggle={() => setAcceptPrev(v => !v)} />
                  <MiniScenePreview heading="next（直後）" scene={preview.next}
                    accepted={acceptNext} onToggle={() => setAcceptNext(v => !v)} />
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={handleParse} disabled={!importText.trim()}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                {preview ? '✓ プレビュー済み' : 'プレビュー'}
              </button>
              <button onClick={handleApply}
                disabled={!preview || (!acceptPrev && !acceptNext) || (!preview.prev && !preview.next)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                適用
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
