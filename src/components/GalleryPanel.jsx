import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import ImageDetailModal from './ImageDetailModal'
import { textContainsSensitive } from '../utils/sensitive'

const COLLAPSE_KEY = 'sd-prompt-builder:gallery-collapsed'

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

function writeCollapsed(collapsed) {
  try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
}

function EyeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

function Thumb({ image, blurred, onClick, onDelete }) {
  const url = useMemo(() => URL.createObjectURL(image.thumb), [image.thumb])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const handleDelete = (e) => {
    e.stopPropagation()
    if (!window.confirm('サムネイルと記録を削除します。元の PNG ファイルは削除されません。よろしいですか？')) return
    onDelete(image.id)
  }

  return (
    <div
      className="relative group flex-shrink-0 h-24 rounded-lg border border-gray-700 overflow-hidden cursor-pointer hover:border-gray-500 transition-colors bg-gray-900"
      onClick={onClick}
      title={blurred ? 'クリックで表示' : image.fileName}>
      {url && (
        <img src={url} alt={image.fileName}
          className={`h-24 w-auto object-cover ${blurred ? 'blur-md scale-110' : ''}`}
          draggable={false} />
      )}
      {blurred && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
          <EyeIcon />
        </div>
      )}
      {!image.params && (
        <span className="absolute bottom-1 left-1 text-[9px] text-gray-300 bg-gray-950/80 px-1 py-0.5 rounded">
          パラメータなし
        </span>
      )}
      <button onClick={handleDelete}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded bg-gray-950/80 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        title="削除">
        ✕
      </button>
    </div>
  )
}

/**
 * 生成結果ギャラリー — collapsible thumbnail strip below the Negative
 * sections (must stay ABOVE OutputPanel in the DOM: it is sticky-bottom).
 */
export default function GalleryPanel({
  images, busy, onAddFiles, onRemoveImage,
  sensitiveKeywords = [], blurMode = 'keyword',
  hasPrompt,
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [revealed, setRevealed] = useState(() => new Set()) // session-only unblur
  const [detailImage, setDetailImage] = useState(null)
  const fileInputRef = useRef(null)

  const toggle = () => {
    setCollapsed(prev => {
      writeCollapsed(!prev)
      return !prev
    })
  }

  const isBlurred = useCallback((image) => {
    if (blurMode === 'off') return false
    if (revealed.has(image.id)) return false
    if (blurMode === 'all') return true
    return textContainsSensitive(image.positive || image.params || '', sensitiveKeywords)
  }, [blurMode, revealed, sensitiveKeywords])

  // 1st click reveals a blurred thumb; 2nd click opens the detail modal
  const handleThumbClick = (image) => {
    if (isBlurred(image)) {
      setRevealed(prev => new Set(prev).add(image.id))
      return
    }
    setDetailImage(image)
  }

  const handleSelectFiles = (e) => {
    if (e.target.files?.length) onAddFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files)
  }

  // detailImage may have been deleted from the list — keep modal in sync
  const detailCurrent = detailImage && images.find(img => img.id === detailImage.id)

  return (
    <div className="mt-6" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      {/* Header row — always visible so the feature stays discoverable */}
      <button onClick={toggle}
        className="flex items-center gap-2 cursor-pointer select-none group/header">
        <span className="text-xs text-gray-500">{collapsed ? '▶' : '▼'}</span>
        <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">生成結果</h2>
        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">
          {images.length}枚
        </span>
        {busy && <span className="text-[10px] text-gray-500 animate-pulse">登録中…</span>}
      </button>

      {!collapsed && (
        <div className="mt-2">
          {images.length === 0 ? (
            /* Empty state: drop zone doubles as the feature's signboard */
            <div className="border-2 border-dashed border-gray-700 rounded-lg px-4 py-5 text-center">
              <p className="text-xs text-gray-400">生成した PNG をここにドロップ</p>
              <p className="text-[10px] text-gray-500 mt-1">
                A1111/Forge が埋め込んだプロンプトとパラメータを自動で読み取ります
              </p>
              <p className="text-[10px] text-gray-500">
                保存されるのは縮小サムネイルのみ。元ファイルはそのまま
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!hasPrompt}
                className={`mt-2.5 px-3 py-1 text-xs rounded border transition-colors ${
                  hasPrompt
                    ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300 cursor-pointer'
                    : 'bg-gray-900 border-gray-800 text-gray-600 cursor-default'
                }`}>
                ファイルを選択
              </button>
              {!hasPrompt && (
                <p className="text-[10px] text-gray-600 mt-1.5">先にプロンプトを入力してください</p>
              )}
            </div>
          ) : (
            /* Thumbnail strip: newest first, horizontal scroll */
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {images.map(image => (
                <Thumb key={image.id} image={image}
                  blurred={isBlurred(image)}
                  onClick={() => handleThumbClick(image)}
                  onDelete={onRemoveImage} />
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 h-24 w-16 rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                title="画像を追加(ドロップでも可)">
                <PlusIcon />
                <span className="text-[9px]">追加</span>
              </button>
            </div>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleSelectFiles} className="hidden" />

      {detailCurrent && (
        <ImageDetailModal
          image={detailCurrent}
          onDelete={onRemoveImage}
          onClose={() => setDetailImage(null)}
        />
      )}
    </div>
  )
}
