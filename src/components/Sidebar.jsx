import { useState, useRef } from 'react'
import PromptAnalysisModal from './PromptAnalysisModal'

/**
 * Sidebar panel icon (rectangle with left bar) -- similar to Claude Code's sidebar toggle
 */
function SidebarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  )
}

/**
 * Three-dot menu icon
 */
function DotsIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  )
}

/**
 * Analysis icon (sparkle/wand)
 */
function AnalysisIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12L12 2" />
      <path d="M5.5 2.5L6 1L6.5 2.5L8 3L6.5 3.5L6 5L5.5 3.5L4 3L5.5 2.5Z" />
      <path d="M11.5 8.5L12 7L12.5 8.5L14 9L12.5 9.5L12 11L11.5 9.5L10 9L11.5 8.5Z" />
    </svg>
  )
}

export { SidebarIcon }

/**
 * Group prompts by date: today, yesterday, past 7 days, older
 */
function groupPromptsByDate(prompts) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  }

  // Sort by updated_at descending first
  const sorted = [...prompts].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0)
    const dateB = new Date(b.updated_at || b.created_at || 0)
    return dateB - dateA
  })

  for (const prompt of sorted) {
    const date = new Date(prompt.updated_at || prompt.created_at || 0)
    if (date >= today) {
      groups.today.push(prompt)
    } else if (date >= yesterday) {
      groups.yesterday.push(prompt)
    } else if (date >= weekAgo) {
      groups.week.push(prompt)
    } else {
      groups.older.push(prompt)
    }
  }

  return groups
}

const DATE_GROUP_LABELS = {
  today: '今日',
  yesterday: '昨日',
  week: '過去7日間',
  older: 'それ以前',
}

/**
 * Context menu for prompt actions
 */
function PromptContextMenu({ prompt, position, onClose, onExportMarkdown, onDelete }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" onClick={onClose} />
      {/* Menu */}
      <div
        className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-[120px]"
        style={{ top: position.y, left: position.x }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onExportMarkdown(prompt); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer"
        >
          Markdown保存
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`「${prompt.title}」を削除しますか？`)) {
              onDelete(prompt.id)
            }
            onClose()
          }}
          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 cursor-pointer"
        >
          削除
        </button>
      </div>
    </>
  )
}

export default function Sidebar({
  prompts,
  currentId,
  onLoad,
  onNew,
  onDelete,
  onExportJson,
  onExportMarkdown,
  onImportJson,
  onResetBench,
  onClearAll,
  translationProvider,
  onSetTranslationProvider,
  translatorActiveProvider,
  PROVIDERS,
}) {
  const fileInputRef = useRef(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const result = await onImportJson(file)
      alert(`インポート完了: ${result.imported}件追加, ${result.skipped}件スキップ`)
    } catch (err) {
      alert(`インポートエラー: ${err.message}`)
    }
    e.target.value = ''
  }

  const handleContextMenu = (e, prompt) => {
    e.preventDefault()
    e.stopPropagation()
    // Position menu near the click, but ensure it fits in viewport
    const x = Math.min(e.clientX, window.innerWidth - 140)
    const y = Math.min(e.clientY, window.innerHeight - 80)
    setContextMenu({ prompt, position: { x, y } })
  }

  const handleDotsClick = (e, prompt) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(rect.left, window.innerWidth - 140)
    const y = rect.bottom + 2
    setContextMenu({ prompt, position: { x, y } })
  }

  const groups = groupPromptsByDate(prompts)

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-gray-800/60">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="text-[13px] font-semibold text-gray-400 tracking-tight">SD Prompt Builder</div>
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-2 flex gap-1.5">
        <button
          onClick={onNew}
          className="flex-1 px-3 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md font-medium transition-colors cursor-pointer text-gray-300 text-center"
        >
          + 新規作成
        </button>
        <button
          onClick={() => setAnalysisModalOpen(true)}
          className="px-2.5 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md transition-colors cursor-pointer text-gray-400 hover:text-gray-200 flex items-center gap-1"
          title="プロンプト分析テンプレート"
        >
          <AnalysisIcon size={13} />
          <span className="text-[10px]">分析</span>
        </button>
      </div>

      {/* Prompt list with date groups */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {prompts.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">プロンプトなし</p>
        ) : (
          <>
            {Object.entries(groups).map(([groupKey, groupPrompts]) => {
              if (groupPrompts.length === 0) return null
              return (
                <div key={groupKey} className="mb-1">
                  {/* Date group label */}
                  <div className="px-2 pt-3 pb-1">
                    <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                      {DATE_GROUP_LABELS[groupKey]}
                    </span>
                  </div>
                  {/* Prompt items */}
                  {groupPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      onClick={() => onLoad(prompt)}
                      onContextMenu={(e) => handleContextMenu(e, prompt)}
                      className={`group flex items-center px-2 py-[7px] mx-0.5 rounded-md cursor-pointer transition-colors ${
                        currentId === prompt.id
                          ? 'bg-white/[0.08]'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] leading-tight truncate ${
                          currentId === prompt.id ? 'text-gray-100' : 'text-gray-400'
                        }`}>
                          {prompt.title || 'Untitled'}
                        </div>
                      </div>
                      {/* Dots menu on hover */}
                      <button
                        onClick={(e) => handleDotsClick(e, prompt)}
                        className="flex-shrink-0 ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 cursor-pointer"
                      >
                        <DotsIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-2 border-t border-gray-800/60 space-y-1.5">
        {/* Export / Import */}
        <div className="flex gap-1">
          <button
            onClick={onExportJson}
            className="flex-1 px-2 py-1 text-[10px] bg-transparent hover:bg-white/[0.05] rounded text-gray-500 hover:text-gray-400 transition-colors cursor-pointer"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-2 py-1 text-[10px] bg-transparent hover:bg-white/[0.05] rounded text-gray-500 hover:text-gray-400 transition-colors cursor-pointer"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Translation */}
        <div>
          <div className="text-[10px] text-gray-600 mb-0.5">翻訳</div>
          <div className="flex gap-0.5">
            {[
              { key: PROVIDERS.AUTO, label: 'Auto' },
              { key: PROVIDERS.MYMEMORY, label: 'MyMem' },
              { key: PROVIDERS.CHROME, label: 'Chrome' },
              { key: PROVIDERS.OFF, label: 'OFF' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onSetTranslationProvider(key)}
                className={`flex-1 px-1 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                  translationProvider === key
                    ? 'bg-blue-600/80 text-white'
                    : 'bg-transparent text-gray-600 hover:text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {translatorActiveProvider && (
            <div className="text-[9px] text-gray-600 mt-0.5">active: {translatorActiveProvider}</div>
          )}
        </div>

        {/* Settings */}
        <div className="flex gap-1">
          <button
            onClick={onResetBench}
            className="flex-1 px-2 py-1 text-[10px] bg-transparent hover:bg-white/[0.05] rounded text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
          >
            ベンチ初期化
          </button>
          <button
            onClick={onClearAll}
            className="flex-1 px-2 py-1 text-[10px] bg-transparent hover:bg-red-950/50 rounded text-red-500/50 hover:text-red-400 transition-colors cursor-pointer"
          >
            全クリア
          </button>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <PromptContextMenu
          prompt={contextMenu.prompt}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onExportMarkdown={onExportMarkdown}
          onDelete={onDelete}
        />
      )}

      {/* Prompt Analysis Modal */}
      {analysisModalOpen && (
        <PromptAnalysisModal onClose={() => setAnalysisModalOpen(false)} />
      )}
    </div>
  )
}
