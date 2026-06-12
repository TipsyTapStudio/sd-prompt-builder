import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PromptBlock, ParamSummary } from './ImageParams'

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  )
}

export default function ImageDetailModal({ image, onDelete, onClose }) {
  const url = useMemo(() => URL.createObjectURL(image.thumb), [image.thumb])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDelete = () => {
    if (!window.confirm('サムネイルと記録を削除します。元の PNG ファイルは削除されません。よろしいですか？')) return
    onDelete(image.id)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Left: image */}
        <div className="flex-1 min-w-0 bg-gray-950 flex items-center justify-center p-4">
          {url && (
            <img src={url} alt={image.fileName}
              className="max-w-full max-h-[80vh] object-contain rounded" />
          )}
        </div>

        {/* Right: metadata */}
        <div className="w-[360px] flex-shrink-0 flex flex-col border-l border-gray-800">
          <div className="flex items-start justify-between px-4 pt-3 pb-2">
            <div className="min-w-0">
              <div className="text-xs text-gray-200 font-medium truncate" title={image.fileName}>
                {image.fileName}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {image.width}×{image.height}
                {' ・ 登録: '}
                {new Date(image.createdAt).toLocaleString('ja-JP')}
              </div>
            </div>
            <button onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors cursor-pointer flex-shrink-0">
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
            {!image.params ? (
              <div className="text-xs text-gray-500 bg-gray-800/50 rounded px-3 py-2">
                この画像にはパラメータ情報が埋め込まれていません
              </div>
            ) : (
              <>
                <PromptBlock label="Positive" color="text-blue-400" text={image.positive} />
                <PromptBlock label="Negative" color="text-red-400" text={image.negative} />
                <ParamSummary settings={image.settings} seed={image.seed} />
              </>
            )}
          </div>

          <div className="border-t border-gray-800 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">元の PNG ファイルは削除されません</span>
            <button onClick={handleDelete}
              className="px-3 py-1 text-xs text-red-400 hover:bg-red-950/50 rounded transition-colors cursor-pointer">
              削除
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
