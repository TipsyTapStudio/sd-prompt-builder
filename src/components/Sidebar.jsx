/**
 * Sidebar panel icon (rectangle with left bar) — similar to Claude Code's sidebar toggle
 */
function SidebarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  )
}

export { SidebarIcon }

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
  const fileInputRef = { current: null }

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

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-800">
        <div className="text-sm font-bold text-gray-300">SD Prompt Builder</div>
      </div>

      {/* New button */}
      <div className="px-3 py-2">
        <button
          onClick={onNew}
          className="w-full px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors cursor-pointer text-center"
        >
          + 新規作成
        </button>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-2">
        {prompts.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">プロンプトなし</p>
        ) : (
          <div className="space-y-0.5">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                onClick={() => onLoad(prompt)}
                className={`group px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  currentId === prompt.id
                    ? 'bg-gray-800 border-l-2 border-blue-500'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-200 truncate">{prompt.title || 'Untitled'}</div>
                    {prompt.description && (
                      <div className="text-[10px] text-gray-500 truncate">{prompt.description}</div>
                    )}
                  </div>
                  {/* Actions — visible on hover */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onExportMarkdown(prompt) }}
                      className="text-[10px] text-gray-500 hover:text-gray-300 px-1 cursor-pointer"
                      title="MD保存"
                    >
                      MD
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`「${prompt.title}」を削除しますか？`)) onDelete(prompt.id)
                      }}
                      className="text-[10px] text-gray-500 hover:text-red-400 px-1 cursor-pointer"
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-2 border-t border-gray-800 space-y-1.5">
        {/* Export / Import */}
        <div className="flex gap-1">
          <button
            onClick={onExportJson}
            className="flex-1 px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 rounded text-gray-400 transition-colors cursor-pointer"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 rounded text-gray-400 transition-colors cursor-pointer"
          >
            Import
          </button>
          <input
            ref={(el) => { fileInputRef.current = el }}
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
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
            className="flex-1 px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded text-gray-500 transition-colors cursor-pointer"
          >
            ベンチ初期化
          </button>
          <button
            onClick={onClearAll}
            className="flex-1 px-2 py-1 text-[10px] bg-gray-800 hover:bg-red-950 rounded text-red-400/70 hover:text-red-300 transition-colors cursor-pointer"
          >
            全クリア
          </button>
        </div>
      </div>
    </div>
  )
}
