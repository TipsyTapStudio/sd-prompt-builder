import { useState, useRef } from 'react'
import PromptAnalysisModal from './PromptAnalysisModal'
import SettingsModal from './SettingsModal'

function DotsIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  )
}

function AnalysisIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12L12 2" />
      <path d="M5.5 2.5L6 1L6.5 2.5L8 3L6.5 3.5L6 5L5.5 3.5L4 3L5.5 2.5Z" />
      <path d="M11.5 8.5L12 7L12.5 8.5L14 9L12.5 9.5L12 11L11.5 9.5L10 9L11.5 8.5Z" />
    </svg>
  )
}

/**
 * Sidebar panel icon
 */
export function SidebarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  )
}

function groupPromptsByDate(prompts) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = { today: [], yesterday: [], week: [], older: [] }
  const sorted = [...prompts].sort((a, b) => {
    return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  })

  for (const prompt of sorted) {
    const date = new Date(prompt.updated_at || prompt.created_at || 0)
    if (date >= today) groups.today.push(prompt)
    else if (date >= yesterday) groups.yesterday.push(prompt)
    else if (date >= weekAgo) groups.week.push(prompt)
    else groups.older.push(prompt)
  }
  return groups
}

const DATE_GROUP_LABELS = { today: '今日', yesterday: '昨日', week: '過去7日間', older: 'それ以前' }

function PromptContextMenu({ prompt, position, onClose, onExportMarkdown, onDelete }) {
  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-[140px]"
        style={{ top: position.y, left: position.x }}>
        <button onClick={(e) => { e.stopPropagation(); onExportMarkdown(prompt); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          Markdown保存
        </button>
        <button onClick={(e) => {
          e.stopPropagation()
          if (window.confirm(`「${prompt.title}」を削除しますか？`)) onDelete(prompt.id)
          onClose()
        }} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 cursor-pointer">
          削除
        </button>
      </div>
    </>
  )
}

export default function Sidebar({
  prompts, currentId, onLoad, onDuplicate, onNew, onDelete,
  onExportJson, onExportMarkdown, onImportJson,
  onResetBench, onClearAll,
  translationProvider, onSetTranslationProvider, translatorActiveProvider, PROVIDERS,
  onToggleSidebar,
  onImportAnalysis,
}) {
  const fileInputRef = useRef(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

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

  const handleDotsClick = (e, prompt) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenu({ prompt, position: { x: Math.min(rect.left, window.innerWidth - 160), y: rect.bottom + 2 } })
  }

  const handleContextMenu = (e, prompt) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ prompt, position: { x: Math.min(e.clientX, window.innerWidth - 160), y: Math.min(e.clientY, window.innerHeight - 80) } })
  }

  const groups = groupPromptsByDate(prompts)

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-gray-800/60">
      {/* Header with close button */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-gray-400 tracking-tight">PPB <span className="text-gray-600 font-normal">for SDXL</span></span>
        <button onClick={onToggleSidebar}
          className="p-1 text-gray-500 hover:text-gray-300 rounded hover:bg-white/[0.05] cursor-pointer transition-colors"
          title="サイドバーを閉じる">
          <SidebarIcon size={16} />
        </button>
      </div>

      {/* Actions: New + Import + Analysis */}
      <div className="px-3 pb-2 space-y-1">
        <div className="flex gap-1.5">
          <button onClick={onNew}
            className="flex-1 px-3 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md font-medium transition-colors cursor-pointer text-gray-300 text-center">
            + 新規作成
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md transition-colors cursor-pointer text-gray-400 hover:text-gray-200"
            title="JSONインポート">
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
        <button onClick={() => setAnalysisModalOpen(true)}
          className="w-full px-3 py-1 text-[11px] bg-transparent hover:bg-white/[0.04] rounded-md transition-colors cursor-pointer text-gray-500 hover:text-gray-300 flex items-center gap-1.5"
          title="プロンプト分析テンプレート">
          <AnalysisIcon size={12} />
          プロンプト分析テンプレート
        </button>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {prompts.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">プロンプトなし</p>
        ) : (
          Object.entries(groups).map(([groupKey, groupPrompts]) => {
            if (groupPrompts.length === 0) return null
            return (
              <div key={groupKey} className="mb-1">
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                    {DATE_GROUP_LABELS[groupKey]}
                  </span>
                </div>
                {groupPrompts.map((prompt) => (
                  <div key={prompt.id}
                    onClick={() => onLoad(prompt)}
                    onContextMenu={(e) => handleContextMenu(e, prompt)}
                    className={`group flex items-center px-2 py-[7px] mx-0.5 rounded-md cursor-pointer transition-colors ${
                      currentId === prompt.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    }`}>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13px] leading-tight truncate ${
                        currentId === prompt.id ? 'text-gray-100' : 'text-gray-400'
                      }`}>{prompt.title || 'Untitled'}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDuplicate(prompt) }}
                      className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 cursor-pointer"
                      title="複製して開く">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="5" y="5" width="9" height="9" rx="1" />
                        <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
                      </svg>
                    </button>
                    <button onClick={(e) => handleDotsClick(e, prompt)}
                      className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 cursor-pointer">
                      <DotsIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Bottom */}
      <div className="px-3 py-2 border-t border-gray-800/60 space-y-1">
        <button onClick={onExportJson}
          className="w-full px-2 py-1.5 text-[11px] bg-transparent hover:bg-white/[0.05] rounded text-gray-500 hover:text-gray-400 transition-colors cursor-pointer text-left">
          Export JSON（全件バックアップ）
        </button>
        <button onClick={() => setSettingsModalOpen(true)}
          className="w-full px-2 py-1.5 text-[11px] bg-transparent hover:bg-white/[0.05] rounded text-gray-400 hover:text-gray-200 transition-colors cursor-pointer text-left flex items-center gap-1.5">
          <span>⚙</span> 設定
        </button>
      </div>

      {contextMenu && (
        <PromptContextMenu prompt={contextMenu.prompt} position={contextMenu.position}
          onClose={() => setContextMenu(null)} onExportMarkdown={onExportMarkdown} onDelete={onDelete} />
      )}
      {analysisModalOpen && <PromptAnalysisModal onClose={() => setAnalysisModalOpen(false)} onImport={onImportAnalysis} />}
      {settingsModalOpen && (
        <SettingsModal
          translationProvider={translationProvider}
          onSetTranslationProvider={onSetTranslationProvider}
          translatorActiveProvider={translatorActiveProvider}
          PROVIDERS={PROVIDERS}
          onResetBench={onResetBench}
          onClearAll={onClearAll}
          onExportJson={onExportJson}
          onClose={() => setSettingsModalOpen(false)}
        />
      )}
    </div>
  )
}
