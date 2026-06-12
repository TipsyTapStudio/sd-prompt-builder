import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import ImageDetailModal from './ImageDetailModal'
import { PromptBlock, ParamSummary } from './ImageParams'
import { textContainsSensitive } from '../utils/sensitive'

function EyeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ImageIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function PlusIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

function ChevronRightIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

/** Small strip thumbnail (click switches the big preview). */
function StripThumb({ image, blurred, selected, onClick }) {
  const url = useMemo(() => URL.createObjectURL(image.thumb), [image.thumb])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <button onClick={onClick}
      className={`relative flex-shrink-0 h-16 w-16 rounded-md overflow-hidden border transition-colors cursor-pointer ${
        selected ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-700 hover:border-gray-500'
      }`}
      title={blurred ? 'クリックで表示' : image.fileName}>
      <img src={url} alt="" draggable={false}
        className={`h-16 w-16 object-cover ${blurred ? 'blur-md scale-110' : ''}`} />
      {blurred && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
          <EyeIcon size={16} />
        </div>
      )}
    </button>
  )
}

/** Large representative preview (click expands to the detail modal). */
function BigPreview({ image, blurred, onClick }) {
  const url = useMemo(() => URL.createObjectURL(image.thumb), [image.thumb])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div onClick={onClick}
      className="relative bg-gray-950 rounded-lg overflow-hidden border border-gray-800 cursor-pointer flex items-center justify-center"
      title={blurred ? 'クリックで表示' : 'クリックで拡大'}>
      <img src={url} alt={image.fileName} draggable={false}
        className={`w-full max-h-72 object-contain ${blurred ? 'blur-xl scale-105' : ''}`} />
      {blurred && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
          <EyeIcon size={28} />
        </div>
      )}
      {!image.params && (
        <span className="absolute bottom-1 left-1 text-[9px] text-gray-300 bg-gray-950/80 px-1 py-0.5 rounded">
          パラメータなし
        </span>
      )}
    </div>
  )
}

/**
 * Editor right pane — always-visible "generation results" for the current
 * prompt: a big preview + a strip to switch images + the image's EMBEDDED
 * prompt/parameters (distinct from the prompt being edited). Collapsible to a
 * thin rail. The full-screen DropOverlay is separate and unaffected.
 */
export default function GenerationResultPanel({
  images, busy, onAddFiles, onRemoveImage,
  sensitiveKeywords = [], blurMode = 'keyword',
  hasPrompt, collapsed, onExpand, onCollapse,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [revealed, setRevealed] = useState(() => new Set()) // session-only unblur
  const [detailImage, setDetailImage] = useState(null)
  const fileInputRef = useRef(null)

  // Selected image, falling back to the newest if the selection is stale
  // (e.g. after switching prompts or deleting the selected image).
  const selected = images.find(i => i.id === selectedId) || images[0] || null

  const isBlurred = useCallback((image) => {
    if (!image || blurMode === 'off') return false
    if (revealed.has(image.id)) return false
    if (blurMode === 'all') return true
    return textContainsSensitive(image.positive || image.params || '', sensitiveKeywords)
  }, [blurMode, revealed, sensitiveKeywords])

  const reveal = useCallback((id) => setRevealed(prev => new Set(prev).add(id)), [])

  // Strip thumb: 1st click reveals a blurred thumb, otherwise selects it.
  const handleThumbClick = (image) => {
    if (isBlurred(image)) { reveal(image.id); return }
    setSelectedId(image.id)
  }
  // Big preview: 1st click reveals, otherwise opens the detail modal (expand).
  const handleBigClick = () => {
    if (!selected) return
    if (isBlurred(selected)) { reveal(selected.id); return }
    setDetailImage(selected)
  }

  const handleSelectFiles = (e) => {
    if (e.target.files?.length) onAddFiles(e.target.files)
    e.target.value = ''
  }
  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files)
  }

  // detailImage may have been deleted — keep the modal in sync with the list.
  const detailCurrent = detailImage && images.find(img => img.id === detailImage.id)

  if (collapsed) {
    return (
      <div onClick={onExpand}
        className="flex-shrink-0 self-start sticky top-0 h-screen w-10 border-l border-gray-800 bg-gray-900 flex flex-col items-center gap-2 pt-3 cursor-pointer hover:bg-gray-800 transition-colors z-30"
        title="生成結果パネルを開く">
        <span className="text-gray-400"><ImageIcon size={18} /></span>
        <span className="text-[10px] text-gray-500 bg-gray-800 rounded-full px-1.5 py-0.5">{images.length}</span>
        <span className="[writing-mode:vertical-rl] text-[10px] text-gray-600 tracking-wider mt-1">生成結果</span>
      </div>
    )
  }

  return (
    <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}
      className="flex-shrink-0 self-start sticky top-0 h-screen w-80 border-l border-gray-800 bg-gray-900 flex flex-col z-30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onCollapse}
            className="p-0.5 text-gray-500 hover:text-gray-300 cursor-pointer flex-shrink-0" title="パネルを閉じる">
            <ChevronRightIcon size={16} />
          </button>
          <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">生成結果</h2>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">{images.length}枚</span>
          {busy && <span className="text-[10px] text-gray-500 animate-pulse">登録中…</span>}
        </div>
        {images.length > 0 && hasPrompt && (
          <button onClick={() => fileInputRef.current?.click()}
            className="p-1 text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 cursor-pointer flex-shrink-0" title="画像を追加（ドロップでも可）">
            <PlusIcon size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {images.length === 0 ? (
          hasPrompt ? (
            /* Case A: a current prompt exists but has no images yet */
            <div className="flex flex-col items-center justify-center text-center px-4 py-8 border-2 border-dashed border-gray-700 rounded-lg m-3">
              <span className="text-gray-600 mb-2"><ImageIcon size={32} /></span>
              <p className="text-xs text-gray-400">生成した PNG をここにドロップ</p>
              <p className="text-[10px] text-gray-500 mt-1">A1111/Forge が埋め込んだプロンプトとパラメータを自動で読み取ります</p>
              <p className="text-[10px] text-gray-500">保存されるのは縮小サムネイルのみ。元ファイルはそのまま</p>
              <button onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 px-3 py-1 text-xs rounded border bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300 cursor-pointer">
                ファイルを選択
              </button>
            </div>
          ) : (
            /* Case B: brand-new unsaved editor — no destination for images yet */
            <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-gray-600">
              <span className="text-gray-700 mb-2"><ImageIcon size={32} /></span>
              <p className="text-xs text-gray-500">生成結果はここに表示されます</p>
              <p className="text-[10px] text-gray-600 mt-1">プロンプトを保存すると、生成した PNG を登録できます</p>
            </div>
          )
        ) : (
          <div className="p-3 space-y-3">
            {selected && (
              <BigPreview image={selected} blurred={isBlurred(selected)} onClick={handleBigClick} />
            )}

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map(image => (
                  <StripThumb key={image.id} image={image}
                    blurred={isBlurred(image)}
                    selected={selected?.id === image.id}
                    onClick={() => handleThumbClick(image)} />
                ))}
              </div>
            )}

            {selected && (
              !selected.params ? (
                <div className="text-xs text-gray-500 bg-gray-800/50 rounded px-3 py-2">
                  この画像にはパラメータ情報が埋め込まれていません
                </div>
              ) : (
                <div className="space-y-3">
                  <PromptBlock label="Positive" color="text-blue-400" text={selected.positive} maxHeightClass="max-h-32" />
                  <PromptBlock label="Negative" color="text-red-400" text={selected.negative} maxHeightClass="max-h-32" />
                  <ParamSummary settings={selected.settings} seed={selected.seed} />
                </div>
              )
            )}
          </div>
        )}
      </div>

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
