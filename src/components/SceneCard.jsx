import { useState } from 'react'
import RenameInline from './RenameInline'

function DotsIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  )
}

function ArrowIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function formatRelativeDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (d >= today) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    const yest = new Date(today); yest.setDate(yest.getDate() - 1)
    if (d >= yest) return '昨日'
    const yr = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}/`
    return `${yr}${d.getMonth() + 1}/${d.getDate()}`
  } catch { return '' }
}

export default function SceneCard({
  prompt,
  index,                    // 0-based, displayed as #(index+1)
  isCurrent = false,
  isLast = false,
  isBeingDragged = false,
  dropPosition = null,      // 'before' | 'after' | null
  onOpen,
  onRenameTitle,            // (sceneId, newTitle) => void
  onUpdateDescription,      // (sceneId, newDesc) => void
  onDuplicate,
  onMoveOut,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [menuPos, setMenuPos] = useState(null)

  const description = prompt.description || ''
  const fallbackPreview = !description && prompt.sections?.face_hair
    ? prompt.sections.face_hair.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 50)
    : ''

  const openMenu = (e) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ x: Math.min(rect.left, window.innerWidth - 200), y: rect.bottom + 2 })
  }

  return (
    <>
      {dropPosition === 'before' && (
        <div className="self-stretch w-0.5 bg-blue-500 rounded-full mx-1 flex-shrink-0" />
      )}

      <div
        draggable={!editingTitle && !editingDesc}
        onDragStart={(e) => onDragStart?.(e, prompt)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver?.(e, prompt)}
        onDragLeave={(e) => onDragLeave?.(e, prompt)}
        onDrop={(e) => onDrop?.(e, prompt)}
        className={`group relative flex-shrink-0 w-[240px] min-h-[180px] rounded-lg border transition-all flex flex-col cursor-default ${
          isBeingDragged ? 'opacity-40' : ''
        } ${
          isCurrent
            ? 'bg-gray-900/80 border-gray-700 ring-1 ring-blue-500/50'
            : 'bg-gray-900/60 border-gray-800/60 hover:bg-gray-900/80 hover:border-gray-700'
        }`}
      >
        {/* Top thin band: #index + 3-dot menu */}
        <div className="px-3 pt-2 pb-1 flex items-center justify-between">
          <span className="text-[10px] text-gray-600 font-medium tracking-wider">#{index + 1}</span>
          <button
            onClick={openMenu}
            className="p-0.5 rounded text-gray-500 hover:text-gray-300 cursor-pointer"
            aria-label="メニュー"
          >
            <DotsIcon size={12} />
          </button>
        </div>

        {/* Title (click to edit) */}
        <div className="px-3 pb-1">
          {editingTitle ? (
            <RenameInline
              initialValue={prompt.title || ''}
              onCommit={(name) => { onRenameTitle?.(prompt.id, name); setEditingTitle(false) }}
              onCancel={() => setEditingTitle(false)}
            />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
              className="w-full text-left rounded px-1 -mx-1 py-0.5 hover:bg-gray-800/50 transition-colors cursor-text"
              title="クリックでタイトル編集"
            >
              <div className="text-sm font-medium text-gray-100 leading-snug line-clamp-2 break-words">
                {prompt.title || 'Untitled'}
              </div>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-gray-800/60 my-1" />

        {/* Description (click to edit) */}
        <div className="px-3 pb-2 flex-1">
          {editingDesc ? (
            <RenameInline
              multiline
              rows={4}
              placeholder="シーンの説明（任意）"
              initialValue={description}
              onCommit={(text) => { onUpdateDescription?.(prompt.id, text); setEditingDesc(false) }}
              onCancel={() => setEditingDesc(false)}
            />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingDesc(true) }}
              className="w-full text-left rounded px-1 -mx-1 py-0.5 hover:bg-gray-800/50 transition-colors cursor-text"
              title="クリックで説明を編集"
            >
              {description ? (
                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">
                  {description}
                </p>
              ) : fallbackPreview ? (
                <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3 italic">
                  {fallbackPreview}
                </p>
              ) : (
                <p className="text-[11px] text-gray-700 italic">説明を追加…</p>
              )}
            </button>
          )}
        </div>

        {/* Footer: edit-link + timestamp */}
        <div className="px-3 pb-2 flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen?.(prompt) }}
            className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
            title="このシーンを編集ビューで開く"
          >
            開く
          </button>
          <span className="text-[10px] text-gray-600">
            {formatRelativeDate(prompt.updated_at || prompt.created_at)}
          </span>
        </div>

        {/* Hover arrow to next card (decorative) */}
        {!isLast && (
          <div className="absolute right-[-18px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none text-gray-500 z-10">
            <ArrowIcon size={14} />
          </div>
        )}
      </div>

      {dropPosition === 'after' && (
        <div className="self-stretch w-0.5 bg-blue-500 rounded-full mx-1 flex-shrink-0" />
      )}

      {/* Card context menu */}
      {menuPos && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenuPos(null)} onContextMenu={(e) => { e.preventDefault(); setMenuPos(null) }} />
          <div className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-[160px]"
            style={{ top: menuPos.y, left: menuPos.x }}>
            <button onClick={(e) => { e.stopPropagation(); onOpen?.(prompt); setMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">編集ビューで開く</button>
            <button onClick={(e) => { e.stopPropagation(); setEditingTitle(true); setMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">名前を変更</button>
            <button onClick={(e) => { e.stopPropagation(); setEditingDesc(true); setMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">説明を編集</button>
            <button onClick={(e) => { e.stopPropagation(); onDuplicate?.(prompt); setMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">複製</button>
            <div className="border-t border-gray-700 my-1" />
            <button onClick={(e) => { e.stopPropagation(); onMoveOut?.(prompt); setMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">フォルダから外す</button>
            <div className="border-t border-gray-700 my-1" />
            <button onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`「${prompt.title || 'Untitled'}」を削除しますか？`)) onDelete?.(prompt)
                setMenuPos(null)
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 cursor-pointer">削除</button>
          </div>
        </>
      )}
    </>
  )
}
