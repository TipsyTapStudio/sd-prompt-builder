import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import sectionsData from '../data/sections.json'

const ANALYSIS_TEMPLATE = `# Portrait Prompt 構造化分析

以下のプロンプトを指定セクションに分解してください。

## セクション定義

**Positive（この順序）:**
- Quality & Technical: 品質・技術指定（masterpiece, best quality, RAW photo 等）
- Style / Aesthetic: 画風（anime, realistic, oil painting 等）
- Face & Hair: 顔・髪・表情（1girl, brown hair, smile 等）
- Body: 体型・身体状態（slim waist, sweat 等）
- Outfit: 衣装・アクセサリー（bikini, necklace 等）
- Composition & Pose: 構図・ポーズ・手持ち物（low angle, sitting, holding cup 等）
- Effects / Expression: 漫画的演出（motion lines, heart 等）
- BREAK（composition/effects と environment の間に挿入）
- Environment & Lighting: 背景・天候・光源（beach, sunset, rim lighting 等）
- Lora: LoRA指定（<lora:xxx:0.8> 等）

**Negative:**
- General Quality: 品質除外（worst quality, blurry, watermark 等）
- Body & Anatomy: 破綻防止（bad hands, extra fingers 等）
- Skin & Realism: のっぺり防止（smooth skin, plastic skin 等）
- Lighting: ライティング除外（flat lighting 等）
- Composition (situational): 構図除外・状況依存

## 分類ルール

- 身体の状態（汗, 赤面 等）→ Body / Face & Hair（部位で判断）
- 身につける物 → Outfit
- 手に持つ物・使う物 → Composition & Pose
- 周囲の物・背景要素 → Environment & Lighting
- 漫画的演出 → Effects / Expression
- カメラアングル → Composition & Pose
- \`(tag:weight)\` \`{a|b|c}\` はそのまま保持

## 分析対象プロンプト

Positive:
\`\`\`
（ここに貼り付け）
\`\`\`

Negative:
\`\`\`
（ここに貼り付け）
\`\`\`

## 出力フォーマット

以下の形式で出力。タグの追加・削除・並び替えはしない。空セクションは省略可。

\`\`\`
### Quality & Technical
masterpiece, best quality, ...

### Face & Hair
1girl, brown hair, ...

（他のPositiveセクション）

BREAK

### Environment & Lighting
beach, sunset, ...

---

### Negative - General Quality
worst quality, low quality, ...

### Negative - Body & Anatomy
bad hands, extra fingers, ...

（他のNegativeセクション）
\`\`\``

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

/**
 * Parse AI output (Markdown with ### headers) into sections/negative_sections.
 */
function parseAIOutput(text) {
  const sections = {}
  const negativeSections = {}
  let currentKey = null
  let isNegative = false
  let passedSeparator = false

  for (const line of text.split('\n')) {
    const trimmed = line.trim()

    // --- separator between Positive and Negative
    if (trimmed === '---') {
      passedSeparator = true
      currentKey = null
      continue
    }

    // Skip BREAK
    if (trimmed === 'BREAK') { currentKey = null; continue }

    // ### header
    const headerMatch = trimmed.match(/^###\s+(.+)$/)
    if (headerMatch) {
      const name = headerMatch[1].trim()

      // Check Negative headers: "Negative - General Quality" or just after ---
      const negMatch = name.match(/^Negative\s*-\s*(.+)$/)
      if (negMatch) {
        isNegative = true
        const negName = negMatch[1].trim()
        const section = sectionsData.negative.find(s => s.name === negName)
        currentKey = section ? section.key : null
      } else {
        const section = sectionsData.positive.find(s => s.name === name)
        if (section) {
          isNegative = false
          currentKey = section.key
        } else if (passedSeparator) {
          // After ---, try matching as negative without prefix
          const negSection = sectionsData.negative.find(s => s.name === name)
          if (negSection) {
            isNegative = true
            currentKey = negSection.key
          }
        }
      }
      continue
    }

    // Skip markdown code block markers
    if (trimmed.startsWith('```')) continue

    // Accumulate content
    if (currentKey) {
      const target = isNegative ? negativeSections : sections
      target[currentKey] = (target[currentKey] || '') + (target[currentKey] ? '\n' : '') + line
    }
  }

  // Trim all values
  for (const key of Object.keys(sections)) sections[key] = sections[key].trim()
  for (const key of Object.keys(negativeSections)) negativeSections[key] = negativeSections[key].trim()

  return { sections, negativeSections }
}

export default function PromptAnalysisModal({ onClose, onImport }) {
  const [tab, setTab] = useState('template') // 'template' | 'import'
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ANALYSIS_TEMPLATE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = ANALYSIS_TEMPLATE
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  const handleParse = useCallback(() => {
    if (!importText.trim()) return
    const result = parseAIOutput(importText)
    setPreview(result)
  }, [importText])

  const handleApply = useCallback(() => {
    if (!preview) return
    onImport(preview)
    onClose()
  }, [preview, onImport, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col mx-4">
        {/* Header + Tabs */}
        <div className="px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-200">プロンプト分析</h2>
            <button onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer">
              <CloseIcon />
            </button>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setTab('template')}
              className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                tab === 'template' ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-gray-400'
              }`}>
              テンプレート
            </button>
            <button onClick={() => setTab('import')}
              className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                tab === 'import' ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-gray-400'
              }`}>
              取り込み
            </button>
          </div>
        </div>

        {tab === 'template' ? (
          <>
            {/* Usage guide */}
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <ol className="list-decimal list-inside text-[11px] text-blue-300/70 space-y-0.5">
                <li>下のテンプレートをコピー</li>
                <li>Claude AI / ChatGPT に貼り付け、プロンプトを追記</li>
                <li>AIの出力を「取り込み」タブに貼り付けて適用</li>
              </ol>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <pre className="text-[11px] leading-relaxed text-gray-400 whitespace-pre-wrap font-mono bg-gray-950/50 rounded-lg p-4 border border-gray-800/50">
                {ANALYSIS_TEMPLATE}
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
            {/* Import tab */}
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <p className="text-[11px] text-blue-300/70">
                AIの出力（### 見出し付きのテキスト）を貼り付けて、「解析」→「適用」で各セクションに取り込みます。
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setPreview(null) }}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none min-h-[150px]"
                placeholder={"AIの出力をここに貼り付け...\n\n### Quality & Technical\nmasterpiece, best quality, ...\n\n### Face & Hair\n1girl, brown hair, ..."}
                rows={8}
              />

              {preview && (
                <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                  <div className="text-[11px] text-gray-400 font-medium mb-2">解析結果プレビュー:</div>
                  {sectionsData.positive.map(s => {
                    const val = preview.sections[s.key]
                    if (!val) return null
                    return (
                      <div key={s.key} className="mb-1.5">
                        <div className="text-[10px] text-blue-400">{s.name}</div>
                        <div className="text-[11px] text-gray-300 font-mono">{val}</div>
                      </div>
                    )
                  })}
                  {Object.keys(preview.negativeSections).length > 0 && (
                    <>
                      <div className="border-t border-gray-800 my-2" />
                      {sectionsData.negative.map(s => {
                        const val = preview.negativeSections[s.key]
                        if (!val) return null
                        return (
                          <div key={s.key} className="mb-1.5">
                            <div className="text-[10px] text-red-400">{s.name}</div>
                            <div className="text-[11px] text-gray-300 font-mono">{val}</div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={handleParse} disabled={!importText.trim()}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                解析
              </button>
              <button onClick={handleApply} disabled={!preview}
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
