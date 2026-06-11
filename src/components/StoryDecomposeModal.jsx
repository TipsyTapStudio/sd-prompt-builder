import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import sectionsData from '../data/sections.json'
import { parseStoryDecomposeOutput } from '../utils/promptParser'

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

const SCENE_COUNT_OPTIONS = ['auto', '3', '4', '5', '6', '8', '10', '12']

function buildTemplate(story, sceneCount) {
  const countSpec = sceneCount === 'auto' ? '5〜8 シーン（auto）' : `${sceneCount} シーン`
  return `# ストーリー分解

## ストーリー要約

${story || '（ここにストーリーを記述）'}

## 制約

- ${countSpec}に分解
- 各シーンは Title (短い日本語) + Description (1〜2 行の日本語) + 9 Positive セクション + 5 Negative セクション
- キャラ同一性タグ（Face & Hair / Body）は全シーンで一致させる
- Outfit / Composition / Effects / Environment / Lighting はストーリー進行で変える
- タグは英語、\`(tag:weight)\` や \`{a|b|c}\` 記法は許容

## セクション一覧

Positive:
${sectionsData.positive.map(s => `- ${s.name}`).join('\n')}

Negative:
${sectionsData.negative.map(s => `- ${s.name}`).join('\n')}

## 分類ルール

- 身体の状態（汗, 赤面 等）→ Body / Face & Hair
- 身につける物 → Outfit
- 手に持つ物・使う物 → Composition & Pose
- 周囲の物・背景要素 → Environment & Lighting
- 漫画的演出 → Effects / Expression
- カメラアングル → Composition & Pose

## 出力フォーマット

最初の行にフォルダ名を出力（# 名前）。各シーンを ## scene 1, ## scene 2 ... のブロックで出力。
**回答全体を Markdown コードブロック（\`\`\`）で囲んで返してください。**

\`\`\`
# 彼女の一日

## scene 1
### Title
朝の目覚め
### Description
ベッドで目を覚ます瞬間。窓から朝日。
### Quality & Technical
masterpiece, best quality, ...
### Face & Hair
1girl, brown hair, ...
（他の Positive セクション）

---

### Negative - General Quality
worst quality, ...
（他の Negative セクション）

## scene 2
### Title
...
（同形式）
\`\`\``
}

function MiniSceneCard({ scene, index, accepted, onToggle }) {
  return (
    <div className={`flex-shrink-0 w-[220px] bg-gray-950/50 border rounded-lg p-3 transition-colors ${
      accepted ? 'border-blue-500/60' : 'border-gray-800/50'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-600 font-medium tracking-wider">#{index + 1}</span>
        <label className="flex items-center gap-1 text-[10px] text-gray-300 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={onToggle}
            className="cursor-pointer accent-blue-500" />
          採用
        </label>
      </div>
      <div className="text-sm font-medium text-gray-100 mb-1 line-clamp-2 break-words">
        {scene.title || '(タイトルなし)'}
      </div>
      {scene.description && (
        <div className="text-[11px] text-gray-400 mb-1.5 line-clamp-2 whitespace-pre-wrap break-words">
          {scene.description}
        </div>
      )}
      <div className="border-t border-gray-800/50 my-1.5" />
      <div className="text-[10px] text-gray-500">
        {Object.keys(scene.sections).length} pos / {Object.keys(scene.negativeSections).length} neg セクション
      </div>
    </div>
  )
}

export default function StoryDecomposeModal({
  folders,
  currentFolderId,
  onClose,
  onApply, // ({ folderName, scenes, targetFolderId, createNew }) => void
}) {
  const [tab, setTab] = useState('template')
  const [story, setStory] = useState('')
  const [sceneCount, setSceneCount] = useState('auto')
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState(null)
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const [acceptedIndexes, setAcceptedIndexes] = useState([])
  const [target, setTarget] = useState('new') // 'new' | 'existing'
  const [targetFolderId, setTargetFolderId] = useState(currentFolderId || folders[0]?.id || '')
  const [parseError, setParseError] = useState(null)

  const template = useMemo(() => buildTemplate(story, sceneCount), [story, sceneCount])

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
    const result = parseStoryDecomposeOutput(importText)
    if (result.scenes.length === 0) {
      setParseError('「## scene N」形式のブロックが見つかりませんでした。')
      setPreview(null); return
    }
    setPreview(result)
    setFolderNameDraft(result.folderName || (story.trim().slice(0, 30)) || '新規ストーリー')
    setAcceptedIndexes(result.scenes.map((_, i) => i))
  }, [importText, story])

  const acceptedSet = useMemo(() => new Set(acceptedIndexes), [acceptedIndexes])

  const toggleScene = (idx) => {
    setAcceptedIndexes(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b))
  }

  const handleApply = useCallback(() => {
    if (!preview) return
    const acceptedScenes = preview.scenes.filter((_, i) => acceptedSet.has(i))
    if (acceptedScenes.length === 0) return
    onApply({
      folderName: folderNameDraft.trim() || preview.folderName || '新規ストーリー',
      scenes: acceptedScenes,
      targetFolderId: target === 'existing' ? targetFolderId : null,
      createNew: target === 'new',
    })
    onClose()
  }, [preview, acceptedSet, folderNameDraft, target, targetFolderId, onApply, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[920px] max-h-[85vh] flex flex-col mx-4">
        <div className="px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-200">ストーリー分解</h2>
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
            <div className="px-5 py-2.5 bg-blue-950/20 border-b border-gray-800">
              <ol className="list-decimal list-inside text-[11px] text-blue-300/70 space-y-0.5">
                <li>ストーリー要約を書き、シーン数を選ぶ</li>
                <li>テンプレートをコピー → Claude AI / ChatGPT に貼り付け</li>
                <li>AI 出力を「取り込み」タブに貼って適用</li>
              </ol>
            </div>

            <div className="px-5 py-3 border-b border-gray-800 space-y-2">
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">ストーリー要約</label>
                <textarea
                  value={story}
                  onChange={e => setStory(e.target.value)}
                  rows={4}
                  placeholder="例：主人公の女性が朝目覚め、電車で通勤、ランチを食べ、夜にデート、深夜帰宅"
                  className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-gray-500">シーン数:</label>
                <select value={sceneCount} onChange={e => setSceneCount(e.target.value)}
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
                  {SCENE_COUNT_OPTIONS.map(v => (
                    <option key={v} value={v}>{v === 'auto' ? '自動 (5-8 推奨)' : `${v} シーン`}</option>
                  ))}
                </select>
              </div>
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
              <p className="text-[11px] text-blue-300/70">AI 出力（# フォルダ名 + ## scene N ブロック）を貼り付け、適用先を選んで適用</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setPreview(null); setParseError(null) }}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                style={{ minHeight: '180px' }}
                placeholder={'# 彼女の一日\n\n## scene 1\n### Title\n...'}
                rows={8}
              />

              {parseError && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-[11px] text-red-400">
                  {parseError}
                </div>
              )}

              {preview && (
                <>
                  <div className="space-y-2 bg-gray-950/30 border border-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-500 flex-shrink-0">フォルダ名:</label>
                      <input type="text" value={folderNameDraft}
                        onChange={e => setFolderNameDraft(e.target.value)}
                        className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] text-gray-500">適用先:</span>
                      <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                        <input type="radio" checked={target === 'new'} onChange={() => setTarget('new')}
                          className="cursor-pointer accent-blue-500" />
                        新規フォルダ作成
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                        <input type="radio" checked={target === 'existing'} onChange={() => setTarget('existing')}
                          disabled={folders.length === 0}
                          className="cursor-pointer accent-blue-500" />
                        既存フォルダに追記
                      </label>
                      {target === 'existing' && (
                        <select value={targetFolderId} onChange={e => setTargetFolderId(e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
                          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="flex gap-2 pb-2 min-w-min">
                      {preview.scenes.map((scene, idx) => (
                        <MiniSceneCard
                          key={idx}
                          scene={scene}
                          index={idx}
                          accepted={acceptedSet.has(idx)}
                          onToggle={() => toggleScene(idx)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {acceptedSet.size} / {preview.scenes.length} シーンを採用
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={handleParse} disabled={!importText.trim()}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
                {preview ? '✓ プレビュー済み' : 'プレビュー'}
              </button>
              <button onClick={handleApply} disabled={!preview || acceptedSet.size === 0}
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
