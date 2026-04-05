import { useRef } from 'react'

export default function SaveModal({ prompts, onLoad, onDelete, onClose, onExportJson, onExportMarkdown, onImportJson }) {
  const fileInputRef = useRef(null)

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const result = await onImportJson(file)
      alert(`インポート完了: ${result.imported}件追加, ${result.skipped}件スキップ`)
    } catch (err) {
      alert(`インポートエラー: ${err.message}`)
    }
    // Reset file input so the same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-base font-semibold text-gray-100">ファイル</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Export / Import buttons */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-700">
          <button
            onClick={onExportJson}
            className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 rounded border border-emerald-600 text-white transition-colors cursor-pointer"
          >
            エクスポート(JSON)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs bg-amber-700 hover:bg-amber-600 rounded border border-amber-600 text-white transition-colors cursor-pointer"
          >
            インポート
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {prompts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">保存済みプロンプトはありません</p>
          ) : (
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-100 truncate">{prompt.title}</div>
                      {prompt.description && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{prompt.description}</div>
                      )}
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(prompt.updated_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => onLoad(prompt)}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors cursor-pointer"
                      >
                        読み込み
                      </button>
                      <button
                        onClick={() => onExportMarkdown(prompt)}
                        className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors cursor-pointer"
                      >
                        MD保存
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`「${prompt.title}」を削除しますか？`)) {
                            onDelete(prompt.id)
                          }
                        }}
                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
