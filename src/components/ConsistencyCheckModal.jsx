import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import sectionsData from '../data/sections.json'
import { parseConsistencyOutput } from '../utils/promptParser'

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

function dumpCurrent(title, description, sections, negativeSections) {
  const lines = []
  lines.push('### Title')
  lines.push(title || '(空)')
  lines.push('')
  lines.push('### Description')
  lines.push(description || '(空)')
  lines.push('')
  lines.push('### Positive')
  for (const s of sectionsData.positive) {
    const v = (sections[s.key] || '').trim()
    if (!v) continue
    lines.push(`#### ${s.name}`)
    lines.push(v)
    lines.push('')
  }
  const hasNeg = sectionsData.negative.some(s => (negativeSections[s.key] || '').trim())
  if (hasNeg) {
    lines.push('### Negative')
    for (const s of sectionsData.negative) {
      const v = (negativeSections[s.key] || '').trim()
      if (!v) continue
      lines.push(`#### ${s.name}`)
      lines.push(v)
      lines.push('')
    }
  }
  return lines.join('\n').trimEnd()
}

function buildTemplate(title, description, sections, negativeSections) {
  return `# プロンプト整合性チェック（モード A: タイトル/説明を正）

ユーザーの**タイトルと説明を意図の正典**として扱い、プロンプト本文がその意図を過不足なく表現しているかを点検してください。

## 観点

1. **missing**: 説明にあるがプロンプトに表現されていない要素 → 追加すべき英語タグを提案
2. **contradiction**: 説明とプロンプトで食い違う要素 → 指摘のみ（削除タグは出さない、ユーザーが判断する）
3. **excess**: 説明に存在しないがプロンプトにある主要要素 → 質問形式で確認のみ

## 対象

${dumpCurrent(title, description, sections, negativeSections)}

## 出力フォーマット

下記フォーマットで出力。空のリストは「なし」と書く。
**回答全体を Markdown コードブロック（\`\`\`）で囲んで返してください。**

\`\`\`
## verdict
（1-2行で要約）

## issues
### missing
- Face & Hair: 「ショートカット」が表現されていない
- Environment & Lighting: 「夕焼けの空のグラデーション」が反映されていない

### contradiction
- Outfit: 説明には言及がないが「formal suit」が入っている

### excess
- なし

## suggested_diff
（missing に対応する追加すべき英語タグだけ。9 Positive / 5 Negative セクションの ### 形式。タグはカンマ区切り）

### Face & Hair
short hair, hair fluttering to the right

### Environment & Lighting
orange to purple gradient sky
\`\`\`

## 制約

- suggested_diff は **追加すべき英語タグのみ**。既存タグの置き換えや削除は提案しない
- contradiction は人間判断に委ねるため、削除候補タグは出さない
- セクション名は次のいずれかを使う:

Positive:
${sectionsData.positive.map(s => `- ${s.name}`).join('\n')}

Negative（### Negative - セクション名 形式）:
${sectionsData.negative.map(s => `- ${s.name}`).join('\n')}`
}

function mergeTags(existing, addition) {
  const existingTags = (existing || '').split(',').map(t => t.trim()).filter(Boolean)
  const additionTags = (addition || '').split(',').map(t => t.trim()).filter(Boolean)
  const seen = new Set(existingTags.map(t => t.toLowerCase()))
  const merged = [...existingTags]
  for (const t of additionTags) {
    if (seen.has(t.toLowerCase())) continue
    merged.push(t)
    seen.add(t.toLowerCase())
  }
  return merged.join(', ')
}

export default function ConsistencyCheckModal({
  title,
  description,
  sections,
  negativeSections,
  onApplyDiff, // ({ sections, negativeSections }) => void  — additive merge
  onClose,
}) {
  const [tab, setTab] = useState('template')
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [accepted, setAccepted] = useState({}) // { 'pos:face_hair': true, 'neg:general_quality': true }

  const template = useMemo(
    () => buildTemplate(title, description, sections, negativeSections),
    [title, description, sections, negativeSections]
  )

  const hasIntent = (title?.trim() || description?.trim())

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
    const result = parseConsistencyOutput(importText)
    const hasContent = result.verdict || result.missing.length || result.contradiction.length || result.excess.length
      || Object.keys(result.diff.sections).length || Object.keys(result.diff.negativeSections).length
    if (!hasContent) {
      setParseError('「## verdict」「## issues」「## suggested_diff」のいずれも見つかりませんでした。')
      setParsed(null); return
    }
    setParsed(result)
    // Default-check all suggested diff sections
    const defaultAccept = {}
    for (const k of Object.keys(result.diff.sections)) defaultAccept[`pos:${k}`] = true
    for (const k of Object.keys(result.diff.negativeSections)) defaultAccept[`neg:${k}`] = true
    setAccepted(defaultAccept)
  }, [importText])

  const toggleAccept = (key) => setAccepted(prev => ({ ...prev, [key]: !prev[key] }))

  const handleApply = useCallback(() => {
    if (!parsed) return
    const out = { sections: {}, negativeSections: {} }
    for (const s of sectionsData.positive) {
      const key = `pos:${s.key}`
      if (!accepted[key]) continue
      const addition = parsed.diff.sections[s.key]
      if (!addition) continue
      out.sections[s.key] = mergeTags(sections[s.key], addition)
    }
    for (const s of sectionsData.negative) {
      const key = `neg:${s.key}`
      if (!accepted[key]) continue
      const addition = parsed.diff.negativeSections[s.key]
      if (!addition) continue
      out.negativeSections[s.key] = mergeTags(negativeSections[s.key], addition)
    }
    onApplyDiff?.(out)
    onClose()
  }, [parsed, accepted, sections, negativeSections, onApplyDiff, onClose])

  const acceptedCount = Object.values(accepted).filter(Boolean).length
  const totalDiffCount = parsed
    ? Object.keys(parsed.diff.sections).length + Object.keys(parsed.diff.negativeSections).length
    : 0

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col mx-4">
        <div className="px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-200">整合性チェック<span className="text-gray-500 font-normal text-xs ml-2">タイトル/説明を正として点検</span></h2>
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

        {tab === 'template' ? (
          <>
            {!hasIntent && (
              <div className="px-5 py-2.5 bg-amber-950/30 border-b border-amber-800/40 text-[11px] text-amber-300">
                タイトルか説明を入力すると、より正確な点検ができます
              </div>
            )}
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <ol className="list-decimal list-inside text-[11px] text-blue-300/70 space-y-0.5">
                <li>下のテンプレートをコピー</li>
                <li>Claude AI / ChatGPT に貼り付け</li>
                <li>AI 出力を「取り込み」タブに貼って差分を確認・適用</li>
              </ol>
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
              <p className="text-[11px] text-blue-300/70">AI の出力（## verdict / ## issues / ## suggested_diff）を貼り付け、差分を選択して適用</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setParsed(null); setParseError(null) }}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                style={{ minHeight: '180px' }}
                placeholder={'## verdict\n概ね一致 / 軽微な調整推奨\n\n## issues\n### missing\n- ...\n\n## suggested_diff\n### Face & Hair\n...'}
                rows={8}
              />

              {parseError && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-[11px] text-red-400">
                  {parseError}
                </div>
              )}

              {parsed && (
                <>
                  {parsed.verdict && (
                    <div className="bg-blue-950/20 border border-blue-800/40 rounded-lg p-3">
                      <div className="text-[10px] text-blue-400 font-medium uppercase tracking-wider mb-1">VERDICT</div>
                      <div className="text-[12px] text-blue-200 whitespace-pre-wrap">{parsed.verdict}</div>
                    </div>
                  )}

                  {parsed.missing.length > 0 && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3">
                      <div className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider mb-1.5">不足 ({parsed.missing.length})</div>
                      <ul className="space-y-1">
                        {parsed.missing.map((item, i) => (
                          <li key={i} className="text-[12px] text-emerald-300 flex items-start gap-1">
                            <span className="text-emerald-500 mt-0.5">+</span>
                            <span className="break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsed.contradiction.length > 0 && (
                    <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-3">
                      <div className="text-[10px] text-amber-400 font-medium uppercase tracking-wider mb-1.5">矛盾の指摘 ({parsed.contradiction.length})<span className="text-amber-500/60 normal-case ml-1.5 font-normal">— 手動で要確認</span></div>
                      <ul className="space-y-1">
                        {parsed.contradiction.map((item, i) => (
                          <li key={i} className="text-[12px] text-amber-200 flex items-start gap-1">
                            <span className="text-amber-500 mt-0.5">!</span>
                            <span className="break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsed.excess.length > 0 && (
                    <div className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-3">
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1.5">説明にない要素 ({parsed.excess.length})<span className="text-gray-500 normal-case ml-1.5 font-normal">— 質問</span></div>
                      <ul className="space-y-1">
                        {parsed.excess.map((item, i) => (
                          <li key={i} className="text-[12px] text-gray-400 flex items-start gap-1">
                            <span className="text-gray-500 mt-0.5">?</span>
                            <span className="break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {totalDiffCount > 0 && (
                    <div className="bg-gray-950/50 border border-gray-800/50 rounded-lg p-3">
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2">追加されるタグ ({acceptedCount}/{totalDiffCount})</div>
                      <div className="space-y-2">
                        {sectionsData.positive.map(s => {
                          const addition = parsed.diff.sections[s.key]
                          if (!addition) return null
                          const key = `pos:${s.key}`
                          return (
                            <label key={key} className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!accepted[key]} onChange={() => toggleAccept(key)}
                                className="mt-0.5 cursor-pointer accent-blue-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-blue-400 font-medium">{s.name}</div>
                                <div className="text-[11px] text-emerald-300 font-mono break-words">+ {addition}</div>
                              </div>
                            </label>
                          )
                        })}
                        {sectionsData.negative.map(s => {
                          const addition = parsed.diff.negativeSections[s.key]
                          if (!addition) return null
                          const key = `neg:${s.key}`
                          return (
                            <label key={key} className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!accepted[key]} onChange={() => toggleAccept(key)}
                                className="mt-0.5 cursor-pointer accent-blue-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-red-400 font-medium">Negative · {s.name}</div>
                                <div className="text-[11px] text-emerald-300 font-mono break-words">+ {addition}</div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={handleParse} disabled={!importText.trim()}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                {parsed ? '✓ プレビュー済み' : 'プレビュー'}
              </button>
              <button onClick={handleApply}
                disabled={!parsed || acceptedCount === 0}
                title={totalDiffCount === 0 ? '追加タグの提案がありません' : ''}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                差分を追記
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
