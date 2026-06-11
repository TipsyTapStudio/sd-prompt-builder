import { useState, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import sectionsData from '../data/sections.json'
import { parseAIOutput } from '../utils/promptParser'
import { parseMarkdownPrompt } from '../utils/markdownPromptParser'

// ── Template builders ────────────────────────────────────────────────────────

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
**回答全体を Markdown コードブロック（\`\`\`）で囲んで返してください。**

\`\`\`
### Title
（シーンのタイトルを日本語で1行。例: 朝のカフェ / 夕暮れのビーチ）

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

function dumpScene(scene) {
  if (!scene) return '（シーンデータなし）'
  const lines = []
  lines.push('### Title')
  lines.push(scene.title || '（タイトルなし）')
  lines.push('')
  if (scene.description) {
    lines.push('### Description')
    lines.push(scene.description)
    lines.push('')
  }
  for (const s of sectionsData.positive) {
    const v = (scene.sections?.[s.key] || '').trim()
    if (!v) continue
    lines.push(`### ${s.name}`)
    lines.push(v)
    lines.push('')
  }
  const hasNeg = sectionsData.negative.some(s => (scene.negativeSections?.[s.key] || '').trim())
  if (hasNeg) {
    lines.push('---')
    lines.push('')
    for (const s of sectionsData.negative) {
      const v = (scene.negativeSections?.[s.key] || '').trim()
      if (!v) continue
      lines.push(`### Negative - ${s.name}`)
      lines.push(v)
      lines.push('')
    }
  }
  return lines.join('\n').trimEnd()
}

const SCENE_OUTPUT_FORMAT = `## 出力フォーマット

空セクション省略可。**回答全体を Markdown コードブロック（\`\`\`）で囲んで返してください。**

\`\`\`
### Title
（シーンのタイトルを日本語で1行）

### Quality & Technical
masterpiece, best quality, ...

### Face & Hair
1girl, brown hair, ...

（他の Positive セクション）

BREAK

### Environment & Lighting
beach, sunset, ...

---

### Negative - General Quality
worst quality, ...
（他の Negative セクション）
\`\`\``

function buildPrevSceneTemplate(scene) {
  return `# 前シーン生成

## 起点シーン（アンカー）

${dumpScene(scene)}

## 指示

- 上記シーンの「直前」にあたるシーン（時系列・状況として自然な流れ）を1つ生成
- キャラクターの連続性を保持（Face & Hair / Body はなるべく同じタグで）
- Outfit / Composition / Effects / Environment はストーリー進行に合わせて変えてよい
- タグは英語のまま、\`(tag:weight)\` / \`{a|b|c}\` 記法はそのまま保持

## セクション一覧（参考）

Positive: ${sectionsData.positive.map(s => s.name).join(', ')}
Negative: ${sectionsData.negative.map(s => s.name).join(', ')}

${SCENE_OUTPUT_FORMAT}`
}

function buildNextSceneTemplate(scene) {
  return `# 後シーン生成

## 起点シーン（アンカー）

${dumpScene(scene)}

## 指示

- 上記シーンの「直後」にあたるシーン（時系列・状況として自然な流れ）を1つ生成
- キャラクターの連続性を保持（Face & Hair / Body はなるべく同じタグで）
- Outfit / Composition / Effects / Environment はストーリー進行に合わせて変えてよい
- タグは英語のまま、\`(tag:weight)\` / \`{a|b|c}\` 記法はそのまま保持

## セクション一覧（参考）

Positive: ${sectionsData.positive.map(s => s.name).join(', ')}
Negative: ${sectionsData.negative.map(s => s.name).join(', ')}

${SCENE_OUTPUT_FORMAT}`
}

// ── Icons ────────────────────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

export default function PromptAnalysisModal({
  onClose,
  onImport,
  onImportAsNew,
  hasContent = false,
  initialTab = 'import',       // 'import' | 'template'
  initialTemplate = 'analysis', // 'analysis' | 'prev' | 'next'
  currentScene = null,          // { title, description, sections, negativeSections }
}) {
  const [tab, setTab] = useState(initialTab)
  const [templateKind, setTemplateKind] = useState(initialTemplate)
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState(null)
  const [parseError, setParseError] = useState(null)
  // File tab state
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [filePreview, setFilePreview] = useState(null) // { title, description, sections, negativeSections, bench, warnings }
  const [fileError, setFileError] = useState(null)
  const [fileIncludeBench, setFileIncludeBench] = useState(false)

  const template = useMemo(() => {
    if (templateKind === 'prev') return buildPrevSceneTemplate(currentScene)
    if (templateKind === 'next') return buildNextSceneTemplate(currentScene)
    return ANALYSIS_TEMPLATE
  }, [templateKind, currentScene])

  const templateLabel = templateKind === 'prev' ? '前シーン生成'
    : templateKind === 'next' ? '後シーン生成'
    : 'プロンプト分析'

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
    const result = parseAIOutput(importText)
    const hasPositive = Object.keys(result.sections).length > 0
    const hasNegative = Object.keys(result.negativeSections).length > 0
    if (!hasPositive && !hasNegative) {
      setParseError('解析可能なセクションが見つかりませんでした。「### セクション名」形式のヘッダーを含むテキストを貼り付けてください。')
      setPreview(null)
      return
    }
    setPreview(result)
  }, [importText])

  const handleApply = useCallback(() => {
    if (!preview) return
    onImport(preview)
    onClose()
  }, [preview, onImport, onClose])

  const handleApplyAsNew = useCallback(() => {
    if (!preview) return
    onImportAsNew(preview)
    onClose()
  }, [preview, onImportAsNew, onClose])

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return
    setFileError(null)
    setFilePreview(null)
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseMarkdownPrompt(text)
      const hasAny = Object.keys(parsed.sections).length > 0
        || Object.keys(parsed.negativeSections).length > 0
      if (!hasAny) {
        setFileError('解析可能なセクションが見つかりませんでした。')
        return
      }
      setFilePreview(parsed)
      setFileIncludeBench(false) // default OFF per UX recommendation
    } catch (err) {
      setFileError(`ファイル読み込みエラー: ${err.message || err}`)
    }
  }, [])

  const buildFilePayload = useCallback(() => {
    if (!filePreview) return null
    const payload = {
      title: filePreview.title,
      description: filePreview.description,
      sections: filePreview.sections,
      negativeSections: filePreview.negativeSections,
    }
    if (fileIncludeBench && filePreview.bench) payload.bench = filePreview.bench
    return payload
  }, [filePreview, fileIncludeBench])

  const handleApplyFile = useCallback(() => {
    const payload = buildFilePayload()
    if (!payload) return
    onImport(payload)
    onClose()
  }, [buildFilePayload, onImport, onClose])

  const handleApplyFileAsNew = useCallback(() => {
    const payload = buildFilePayload()
    if (!payload) return
    onImportAsNew(payload)
    onClose()
  }, [buildFilePayload, onImportAsNew, onClose])

  const TABS = [
    { id: 'import', label: '貼り付け' },
    { id: 'file', label: 'ファイル (.md)' },
    { id: 'template', label: 'テンプレート' },
  ]

  const TEMPLATE_KINDS = [
    { id: 'analysis', label: 'プロンプト分析' },
    { id: 'prev', label: '前シーン生成' },
    { id: 'next', label: '後シーン生成' },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col mx-4">
        {/* Header + main tabs */}
        <div className="px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-200">
              プロンプトを読み込む
              {tab === 'template' && (
                <span className="text-gray-500 font-normal text-xs ml-2">— {templateLabel}</span>
              )}
            </h2>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer">
              <CloseIcon />
            </button>
          </div>
          <div className="flex gap-4">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                  tab === t.id ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-gray-400'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 貼り付けタブ ─────────────────────────────────────── */}
        {tab === 'import' && (
          <>
            <div className={`px-5 py-2.5 border-b ${hasContent ? 'bg-amber-950/30 border-amber-800/40' : 'bg-blue-950/20 border-gray-800'}`}>
              <p className={`text-[11px] ${hasContent ? 'text-amber-300' : 'text-blue-300/70'}`}>
                {hasContent
                  ? '⚠ 適用するとこのシーンのすべてのセクションが AIの出力で置き換えられます'
                  : 'AIの出力（### 見出し付きのテキスト）を貼り付けて、「プレビュー」→「読み込む」でセクションに取り込みます。'
                }
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setPreview(null); setParseError(null) }}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                style={{ minHeight: '300px' }}
                placeholder={"AIの出力をここに貼り付け...\n\n### Title\n朝のカフェ\n\n### Quality & Technical\nmasterpiece, best quality, ...\n\n### Face & Hair\n1girl, brown hair, ..."}
                rows={8}
              />

              {parseError && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-[11px] text-red-400">
                  {parseError}
                </div>
              )}

              {preview && (
                <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                  <div className="text-[11px] text-gray-400 font-medium mb-2">解析結果プレビュー:</div>
                  {preview.title && (
                    <div className="mb-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">タイトル</div>
                      <div className="text-[12px] text-gray-100 font-medium">{preview.title}</div>
                    </div>
                  )}
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
                {preview ? '✓ プレビュー済み' : 'プレビュー'}
              </button>
              {onImportAsNew && (
                <button onClick={handleApplyAsNew} disabled={!preview}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-green-700/80 hover:bg-green-600/80 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                  新規シーンとして作成
                </button>
              )}
              <button onClick={handleApply} disabled={!preview}
                className={`px-4 py-2 text-xs font-medium rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                  hasContent ? 'bg-amber-600/80 hover:bg-amber-500/80' : 'bg-blue-600/80 hover:bg-blue-500/80'
                }`}>
                {hasContent ? '上書きして適用' : '読み込む'}
              </button>
            </div>
          </>
        )}

        {/* ── ファイルタブ ─────────────────────────────────────── */}
        {tab === 'file' && (
          <>
            <div className="px-5 py-2.5 border-b bg-blue-950/20 border-gray-800">
              <p className="text-[11px] text-blue-300/70">
                <code>Markdown形式で Export</code> で保存したファイル (.md) を読み込みます。
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <div
                onDragOver={e => { e.preventDefault() }}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFileSelect(f)
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-700 hover:border-blue-500/50 rounded-lg p-6 text-center cursor-pointer transition-colors"
              >
                <div className="text-xs text-gray-400 mb-1">
                  {fileName ? `選択中: ${fileName}` : '.md ファイルをドロップ、またはクリックして選択'}
                </div>
                {!fileName && <div className="text-[10px] text-gray-600">対応形式: PPB が出力した Markdown</div>}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,text/markdown"
                onChange={e => handleFileSelect(e.target.files?.[0])}
                className="hidden"
              />

              {fileError && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-[11px] text-red-400">
                  {fileError}
                </div>
              )}

              {filePreview && (
                <>
                  <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                    <div className="text-[11px] text-gray-400 font-medium mb-2">解析結果プレビュー:</div>
                    {filePreview.title && (
                      <div className="mb-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">タイトル</div>
                        <div className="text-[12px] text-gray-100 font-medium">{filePreview.title}</div>
                      </div>
                    )}
                    {filePreview.description && (
                      <div className="mb-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">説明</div>
                        <div className="text-[11px] text-gray-300">{filePreview.description}</div>
                      </div>
                    )}
                    {sectionsData.positive.map(s => {
                      const val = filePreview.sections[s.key]
                      if (!val) return null
                      return (
                        <div key={s.key} className="mb-1.5">
                          <div className="text-[10px] text-blue-400">{s.name}</div>
                          <div className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap">{val}</div>
                        </div>
                      )
                    })}
                    {Object.keys(filePreview.negativeSections).length > 0 && (
                      <>
                        <div className="border-t border-gray-800 my-2" />
                        {sectionsData.negative.map(s => {
                          const val = filePreview.negativeSections[s.key]
                          if (!val) return null
                          return (
                            <div key={s.key} className="mb-1.5">
                              <div className="text-[10px] text-red-400">{s.name}</div>
                              <div className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap">{val}</div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>

                  {filePreview.bench && (
                    <label className="flex items-start gap-2 cursor-pointer bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
                      <input
                        type="checkbox"
                        checked={fileIncludeBench}
                        onChange={e => setFileIncludeBench(e.target.checked)}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs text-amber-200">ベンチデータも読み込む（現在のグローバルベンチを上書き）</div>
                        <div className="text-[10px] text-amber-300/60 mt-0.5">
                          ベンチはアプリ全体で共有されます。チェックすると現在の設定が失われます。
                          ファイルには {Object.keys(filePreview.bench).length} セクション分のベンチが含まれます。
                        </div>
                      </div>
                    </label>
                  )}

                  {filePreview.warnings && filePreview.warnings.length > 0 && (
                    <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-3">
                      <div className="text-[11px] text-yellow-300/80 font-medium mb-1">⚠ 警告:</div>
                      <ul className="text-[10px] text-yellow-300/60 list-disc list-inside space-y-0.5">
                        {filePreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
              {onImportAsNew && (
                <button onClick={handleApplyFileAsNew} disabled={!filePreview}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-green-700/80 hover:bg-green-600/80 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                  新規シーンとして作成
                </button>
              )}
              <button onClick={handleApplyFile} disabled={!filePreview}
                className={`px-4 py-2 text-xs font-medium rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                  hasContent ? 'bg-amber-600/80 hover:bg-amber-500/80' : 'bg-blue-600/80 hover:bg-blue-500/80'
                }`}>
                {hasContent ? '上書きして適用' : '読み込む'}
              </button>
            </div>
          </>
        )}

        {/* ── テンプレートタブ ─────────────────────────────────── */}
        {tab === 'template' && (
          <>
            {/* Sub-tab selector */}
            <div className="px-5 pt-3 pb-0 border-b border-gray-800 flex gap-3 bg-gray-900/50">
              {TEMPLATE_KINDS.map(k => (
                <button key={k.id} onClick={() => setTemplateKind(k.id)}
                  className={`text-[11px] font-medium pb-2 border-b-2 transition-colors cursor-pointer ${
                    templateKind === k.id
                      ? 'text-gray-200 border-gray-400'
                      : 'text-gray-600 border-transparent hover:text-gray-400'
                  }`}>
                  {k.label}
                </button>
              ))}
            </div>

            {/* Guide */}
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <ol className="list-decimal list-inside text-[11px] text-blue-300/70 space-y-0.5">
                <li>下のテンプレートをコピー</li>
                <li>Claude AI / ChatGPT に貼り付け{templateKind === 'analysis' ? '、プロンプトを追記' : ''}</li>
                <li>AIの出力を「取り込み」タブに貼り付けて適用</li>
              </ol>
            </div>

            {(templateKind === 'prev' || templateKind === 'next') && !currentScene?.title && !Object.values(currentScene?.sections || {}).some(v => v?.trim()) && (
              <div className="px-5 py-2 bg-amber-950/30 border-b border-amber-800/40 text-[11px] text-amber-300">
                ⚠ 現在のシーンに内容がありません。起点シーンを開いてから使用してください。
              </div>
            )}

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
        )}
      </div>
    </div>,
    document.body
  )
}
