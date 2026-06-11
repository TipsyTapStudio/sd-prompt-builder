import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getDefaultSensitiveKeywords } from '../utils/sensitive'
import sectionsData from '../data/sections.json'
import presetsData from '../data/presets.json'
import { benchTextToFormatted, formattedToBenchText } from '../utils/benchFormat'

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
      <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
    </svg>
  )
}

function DownloadIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v9" />
      <path d="M4.5 7.5L8 11l3.5-3.5" />
      <path d="M2 13h12" />
    </svg>
  )
}

function presetDefaultFor(key) {
  const presets = presetsData[key] || []
  if (presets.length === 0) return ''
  return presets.map(p => (p.tags || '').replace(/,\s*$/, '')).join(', ')
}

function benchKeyFor(section, isNeg) {
  if (isNeg && section.key === 'composition') return 'neg_composition'
  return section.key
}

const ALL_BENCH_SECTIONS = [
  ...sectionsData.positive.map(s => ({ key: s.key, label: s.name, group: 'Positive' })),
  ...sectionsData.negative.map(s => ({ key: benchKeyFor(s, true), label: s.name, group: 'Negative' })),
]

export default function SettingsModal({
  translationProvider, onSetTranslationProvider, translatorActiveProvider, PROVIDERS,
  onResetBench, onClearAll, onExportJson, onClose,
  sensitiveKeywords = [], onUpdateSensitiveKeywords,
  galleryBlurMode = 'keyword', onSetGalleryBlurMode,
  bench = {}, onUpdateBench,
}) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [sensitiveDraft, setSensitiveDraft] = useState((sensitiveKeywords || []).join(', '))
  const [activeTab, setActiveTab] = useState('bench') // 'bench' | 'general'
  const [benchViewMode, setBenchViewMode] = useState('sections') // 'sections' | 'unified'
  const [unifiedText, setUnifiedText] = useState('')
  const [copiedKey, setCopiedKey] = useState(null) // null | section key | 'unified'

  // Bench draft: pre-filled with current bench value or preset default, formatted multi-line
  const toDisplay = (key, rawBench) => {
    const raw = rawBench[key] !== undefined ? rawBench[key] : presetDefaultFor(key)
    return benchTextToFormatted(raw) || raw
  }

  const initBenchDraft = () => {
    const result = {}
    for (const { key } of ALL_BENCH_SECTIONS) {
      result[key] = toDisplay(key, bench)
    }
    return result
  }
  const [benchDraft, setBenchDraft] = useState(initBenchDraft)

  // Re-sync draft when bench prop changes (e.g. after reset)
  useEffect(() => {
    setBenchDraft(prev => {
      const updated = { ...prev }
      for (const { key } of ALL_BENCH_SECTIONS) {
        updated[key] = toDisplay(key, bench)
      }
      return updated
    })
  }, [bench]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitSensitive = () => {
    const list = sensitiveDraft
      .split(/[,、\n]/)
      .map(s => s.trim())
      .filter(Boolean)
    onUpdateSensitiveKeywords?.(list)
  }
  const resetSensitive = () => {
    const def = getDefaultSensitiveKeywords()
    setSensitiveDraft(def.join(', '))
    onUpdateSensitiveKeywords?.(def)
  }

  const commitBenchSection = (key, displayValue) => {
    onUpdateBench?.(key, formattedToBenchText(displayValue))
  }

  const buildUnifiedText = (draft) =>
    ALL_BENCH_SECTIONS.map(({ key, label }) => `## ${label}\n${draft[key] || ''}`).join('\n\n')

  const parseAndCommitUnified = (text) => {
    const result = {}
    let currentKey = null
    const lines = []
    for (const line of text.split('\n')) {
      const m = line.match(/^## (.+)$/)
      if (m) {
        if (currentKey !== null) result[currentKey] = lines.join('\n').trim()
        const sec = ALL_BENCH_SECTIONS.find(s => s.label === m[1].trim())
        currentKey = sec?.key ?? null
        lines.length = 0
      } else if (currentKey !== null) {
        lines.push(line)
      }
    }
    if (currentKey !== null) result[currentKey] = lines.join('\n').trim()
    setBenchDraft(prev => ({ ...prev, ...result }))
    for (const [key, val] of Object.entries(result)) {
      onUpdateBench?.(key, formattedToBenchText(val))
    }
  }

  const switchToUnified = () => {
    setUnifiedText(buildUnifiedText(benchDraft))
    setBenchViewMode('unified')
  }

  const switchToSections = (currentUnified) => {
    if (currentUnified !== undefined) parseAndCommitUnified(currentUnified)
    setBenchViewMode('sections')
  }

  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch { /* ignore */ }
  }

  const handleDownloadBackup = () => {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const exportedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const fileTs = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

    const lines = [
      '<!-- PPB for SDXL - Bench Backup -->',
      `<!-- Exported: ${exportedAt} -->`,
      '<!-- App: PPB for SDXL -->',
      '',
    ]
    for (const { key, label } of ALL_BENCH_SECTIONS) {
      lines.push(`## ${label}`)
      lines.push(benchDraft[key] || '')
      lines.push('')
    }
    const content = lines.join('\n')

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ppb-bench-${fileTs}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetBenchToPresets = () => {
    if (!window.confirm('全セクションのベンチをプリセット初期値に戻しますか？\nカスタマイズした内容が失われます。')) return
    const reset = {}
    for (const { key } of ALL_BENCH_SECTIONS) {
      const presetRaw = presetDefaultFor(key)
      reset[key] = benchTextToFormatted(presetRaw) || presetRaw
      onUpdateBench?.(key, presetRaw)
    }
    setBenchDraft(reset)
  }

  const TAB_CLS = (t) =>
    `px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
      activeTab === t
        ? 'border-blue-500 text-blue-400'
        : 'border-transparent text-gray-500 hover:text-gray-300'
    }`

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">設定</h2>
          <button onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors cursor-pointer">
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          <button className={TAB_CLS('bench')} onClick={() => setActiveTab('bench')}>ベンチ編集</button>
          <button className={TAB_CLS('general')} onClick={() => setActiveTab('general')}>一般</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── General tab ── */}
          {activeTab === 'general' && (
            <div className="px-6 py-5 space-y-6">
              {/* Translation */}
              <div>
                <h3 className="text-sm font-medium text-gray-200 mb-1">翻訳</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Positive セクションの下に日本語訳を表示します。ヘッダーの「訳」ボタンで ON/OFF を切り替えられます。
                </p>
                <div className="flex gap-2 mb-2">
                  {[
                    { key: PROVIDERS.AUTO, label: 'Auto', desc: 'Chrome → MyMemory の順で自動選択' },
                    { key: PROVIDERS.MYMEMORY, label: 'MyMemory', desc: '無料API（5,000文字/日）' },
                    { key: PROVIDERS.CHROME, label: 'Chrome', desc: 'ブラウザ内蔵（要言語パック）' },
                    { key: PROVIDERS.OFF, label: 'OFF', desc: '翻訳を無効化' },
                  ].map(({ key, label, desc }) => (
                    <button key={key} onClick={() => onSetTranslationProvider(key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-center transition-colors cursor-pointer ${
                        translationProvider === key
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                      }`}>
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-[9px] mt-0.5 opacity-70">{desc}</div>
                    </button>
                  ))}
                </div>
                {translatorActiveProvider && (
                  <div className="text-xs text-gray-500">
                    現在のエンジン: <span className="text-gray-300">{translatorActiveProvider}</span>
                  </div>
                )}
              </div>

              {/* Sensitive keywords */}
              <div>
                <h3 className="text-sm font-medium text-gray-200 mb-1">センシティブ判定ラベル</h3>
                <p className="text-xs text-gray-500 mb-3">
                  ベンチで <code className="text-pink-400">#</code> グループ名や <code className="text-pink-400">//</code> サブラベルがここに登録された語と一致したとき、配下のタグをピンクで表示します（カンマ区切り、大文字小文字無視）。
                  生成結果ギャラリーのぼかし判定（画像内プロンプトとの部分一致）にも使われます。
                </p>
                <textarea
                  value={sensitiveDraft}
                  onChange={e => setSensitiveDraft(e.target.value)}
                  onBlur={commitSensitive}
                  rows={2}
                  placeholder="SENSITIVE, NSFW, R-18, R18, EXPLICIT"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-pink-500 resize-none leading-relaxed"
                />
                <div className="mt-2">
                  <button onClick={resetSensitive}
                    className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-400 transition-colors cursor-pointer">
                    既定値に戻す
                  </button>
                </div>
              </div>

              {/* Gallery blur */}
              <div>
                <h3 className="text-sm font-medium text-gray-200 mb-1">生成結果ギャラリーのぼかし</h3>
                <p className="text-xs text-gray-500 mb-3">
                  サムネイルのぼかし表示。クリックで一時的に解除できます（リロードで元に戻ります）。
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['keyword', 'キーワード一致のみ', '判定ラベルに一致した画像をぼかす'],
                    ['all', '常にすべてぼかす', '全サムネイルをぼかす'],
                    ['off', 'ぼかさない', 'すべてそのまま表示'],
                  ].map(([mode, label, desc]) => (
                    <button key={mode}
                      onClick={() => onSetGalleryBlurMode?.(mode)}
                      className={`px-2 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        galleryBlurMode === mode
                          ? 'bg-pink-600/20 text-pink-200 ring-1 ring-pink-500'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                      }`}>
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-[9px] mt-0.5 opacity-70">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div className="border-t border-gray-800 pt-5">
                <h3 className="text-sm font-medium text-red-400 mb-1">データ管理</h3>
                <p className="text-xs text-gray-500 mb-3">
                  全てのデータ（保存済みプロンプト・ベンチ・設定・下書き）を削除してアプリを初期状態に戻します。
                  この操作は取り消せません。
                </p>

                {!confirmClear ? (
                  <button onClick={() => setConfirmClear(true)}
                    className="px-4 py-2 text-sm bg-gray-800 hover:bg-red-950 rounded-lg text-red-400 transition-colors cursor-pointer">
                    全データを削除してリセット...
                  </button>
                ) : (
                  <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
                    <p className="text-xs text-red-300 mb-3">
                      本当に全データを削除しますか？事前にバックアップを推奨します。
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => { onExportJson(); }}
                        className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors cursor-pointer">
                        まずバックアップ（Export JSON）
                      </button>
                      <button onClick={() => { onClearAll(); onClose() }}
                        className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 rounded text-white transition-colors cursor-pointer">
                        削除してリセット
                      </button>
                      <button onClick={() => setConfirmClear(false)}
                        className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-400 transition-colors cursor-pointer">
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Bench tab ── */}
          {activeTab === 'bench' && (
            <div className="px-6 py-5">
              {/* Header row: description + view toggle */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-xs text-gray-500 flex-1">
                  変更はフォーカスを外した時点で即時反映されます。<br />
                  <span className="text-gray-600">記法: <code className="text-blue-400"># GROUP</code> グループ見出し　<code className="text-blue-400">// label</code> サブラベル　タグはカンマ区切り　<code className="text-yellow-500">;; メモ</code> コメント</span>
                </p>
                {/* Segmented toggle */}
                <div className="flex-shrink-0 flex bg-gray-800 rounded-lg p-0.5 text-[11px]">
                  <button
                    onClick={() => switchToSections(benchViewMode === 'unified' ? unifiedText : undefined)}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${benchViewMode === 'sections' ? 'bg-gray-600 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
                    セクション別
                  </button>
                  <button
                    onClick={switchToUnified}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${benchViewMode === 'unified' ? 'bg-gray-600 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
                    統合
                  </button>
                </div>
              </div>

              {benchViewMode === 'sections' ? (
                <>
                  {/* Positive sections */}
                  <div className="mb-2">
                    <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-3">Positive</div>
                    <div className="space-y-4">
                      {ALL_BENCH_SECTIONS.filter(s => s.group === 'Positive').map(({ key, label }) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-gray-400">{label}</label>
                            <button
                              onClick={() => handleCopy(benchDraft[key] || '', key)}
                              className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
                              title="コピー">
                              <CopyIcon />
                              {copiedKey === key && <span className="text-green-400">コピー済み</span>}
                            </button>
                          </div>
                          <textarea
                            value={benchDraft[key] || ''}
                            onChange={e => setBenchDraft(prev => ({ ...prev, [key]: e.target.value }))}
                            onBlur={e => commitBenchSection(key, e.target.value)}
                            style={{ minHeight: '6rem', resize: 'vertical' }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 leading-relaxed font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Negative sections */}
                  <div className="mt-6">
                    <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-3">Negative</div>
                    <div className="space-y-4">
                      {ALL_BENCH_SECTIONS.filter(s => s.group === 'Negative').map(({ key, label }) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-gray-400">{label}</label>
                            <button
                              onClick={() => handleCopy(benchDraft[key] || '', key)}
                              className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
                              title="コピー">
                              <CopyIcon />
                              {copiedKey === key && <span className="text-green-400">コピー済み</span>}
                            </button>
                          </div>
                          <textarea
                            value={benchDraft[key] || ''}
                            onChange={e => setBenchDraft(prev => ({ ...prev, [key]: e.target.value }))}
                            onBlur={e => commitBenchSection(key, e.target.value)}
                            rows={3}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500 resize-y leading-relaxed font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* ── 統合ビュー ── */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-gray-600">
                      <code className="text-gray-500">## セクション名</code> で区切り。フォーカスを外すと各セクションに保存されます。
                    </p>
                    <button
                      onClick={() => handleCopy(unifiedText, 'unified')}
                      className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors cursor-pointer flex-shrink-0 ml-3"
                      title="全体をコピー">
                      <CopyIcon />
                      {copiedKey === 'unified' ? <span className="text-green-400">コピー済み</span> : <span>全体コピー</span>}
                    </button>
                  </div>
                  <textarea
                    value={unifiedText}
                    onChange={e => setUnifiedText(e.target.value)}
                    onBlur={e => parseAndCommitUnified(e.target.value)}
                    style={{ minHeight: '40rem', resize: 'vertical' }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 leading-relaxed font-mono"
                  />
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-gray-800 flex items-start justify-between gap-4">
                <div>
                  <button onClick={handleDownloadBackup}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors cursor-pointer">
                    <DownloadIcon />
                    バックアップをダウンロード (.md)
                  </button>
                  <p className="text-[11px] text-gray-600 mt-2">現在のベンチ内容を Markdown ファイルで保存します。</p>
                </div>
                <div className="text-right">
                  <button onClick={resetBenchToPresets}
                    className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors cursor-pointer">
                    プリセット初期値に戻す
                  </button>
                  <p className="text-[11px] text-gray-600 mt-2">プリセット定義の初期状態に戻します。<br />カスタマイズ内容が失われます。</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
