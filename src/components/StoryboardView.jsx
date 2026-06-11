import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import SceneCard from './SceneCard'
import SceneExpansionModal from './SceneExpansionModal'
import StoryDecomposeModal from './StoryDecomposeModal'
import { getLatestImageForPrompts } from '../utils/imageDb'
import { textContainsSensitive } from '../utils/sensitive'

const DRAG_TYPE = 'text/x-ppb-scene'

function FolderIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5a1 1 0 011-1h3.5l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z" />
    </svg>
  )
}

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export default function StoryboardView({
  folder,
  scenes,                // ordered array of prompt objects
  currentSceneId,
  onOpenScene,
  onNewScene,            // (folderId) => void
  onDuplicateScene,
  onDeleteScene,
  onMoveSceneOut,
  onRenameScene,
  onUpdateSceneDescription,
  onRenameFolder,
  onDeleteFolder,
  onUpdateFolderDescription,
  onMoveScene,           // (sceneId, folderId, index) => void
  onBackToEditor,
  allFolders = [],
  onSceneExpansionApply,
  onStoryDecomposeApply,
  sensitiveKeywords = [],
  blurMode = 'keyword',
}) {
  // Representative thumbnails (newest per scene). Editor & storyboard views are
  // exclusive, so a one-shot load on mount / scene-set change is enough — no
  // live sync needed (images are only added from the editor).
  const [imageMap, setImageMap] = useState({})
  const [revealed, setRevealed] = useState(() => new Set()) // session-only unblur
  const sceneIdsKey = scenes.map(s => s.id).join(',')
  useEffect(() => {
    let cancelled = false
    const ids = sceneIdsKey ? sceneIdsKey.split(',') : []
    getLatestImageForPrompts(ids)
      .then(map => { if (!cancelled) setImageMap(map) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [sceneIdsKey])

  const isBlurred = useCallback((image) => {
    if (!image || blurMode === 'off') return false
    if (revealed.has(image.id)) return false
    if (blurMode === 'all') return true
    return textContainsSensitive(image.positive || image.params || '', sensitiveKeywords)
  }, [blurMode, revealed, sensitiveKeywords])

  const revealImage = useCallback((imageId) => {
    setRevealed(prev => new Set(prev).add(imageId))
  }, [])

  const [editingDescription, setEditingDescription] = useState(false)
  const [descDraft, setDescDraft] = useState(folder.description || '')
  const [folderRenaming, setFolderRenaming] = useState(false)
  const [folderNameDraft, setFolderNameDraft] = useState(folder.name || '')
  const [folderMenuPos, setFolderMenuPos] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [showExpansion, setShowExpansion] = useState(false)
  const [showDecompose, setShowDecompose] = useState(false)
  const scrollerRef = useRef(null)

  const sceneDropMap = useMemo(() => {
    if (!dragState?.hover || dragState.hover.type !== 'scene') return {}
    return { [dragState.hover.id]: dragState.hover.position }
  }, [dragState])

  // DnD ----
  const onSceneDragStart = (e, prompt) => {
    e.dataTransfer.setData(DRAG_TYPE, prompt.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragState({ sceneId: prompt.id, hover: null })
  }
  const onSceneDragEnd = () => setDragState(null)

  const computePosition = (e, target) => {
    const rect = target.getBoundingClientRect()
    return e.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
  }

  const onSceneDragOver = (e, scene) => {
    if (!dragState) return
    if (scene.id === dragState.sceneId) return
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const position = computePosition(e, e.currentTarget)
    setDragState(prev => prev && { ...prev, hover: { type: 'scene', id: scene.id, position } })
  }
  const onSceneDragLeave = () => {}

  const onSceneDrop = (e, scene) => {
    if (!dragState) return
    e.preventDefault(); e.stopPropagation()
    const draggedId = dragState.sceneId
    if (!draggedId || draggedId === scene.id) { setDragState(null); return }
    const position = dragState.hover?.position || computePosition(e, e.currentTarget)
    const baseIds = folder.sceneIds.filter(id => id !== draggedId)
    const targetIdx = baseIds.indexOf(scene.id)
    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
    onMoveScene?.(draggedId, folder.id, insertIdx)
    setDragState(null)
  }

  const commitFolderRename = () => {
    const next = folderNameDraft.trim()
    if (next && next !== folder.name) onRenameFolder?.(folder.id, next)
    setFolderRenaming(false)
  }

  const commitDescription = () => {
    if ((descDraft || '') !== (folder.description || '')) {
      onUpdateFolderDescription?.(folder.id, descDraft || '')
    }
    setEditingDescription(false)
  }

  const cancelDescription = () => {
    setDescDraft(folder.description || '')
    setEditingDescription(false)
  }

  return (
    <div className="flex-1 min-w-0 pb-16">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-950 border-b border-gray-800">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBackToEditor}
              className="p-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer rounded hover:bg-gray-800 flex-shrink-0"
              title="編集ビューに戻る">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
            <span className="text-gray-500 flex-shrink-0"><FolderIcon size={16} /></span>
            <div className="relative min-w-0">
              {folderRenaming ? (
                <input
                  autoFocus
                  type="text"
                  value={folderNameDraft}
                  onChange={e => setFolderNameDraft(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitFolderRename()
                    else if (e.key === 'Escape') { setFolderNameDraft(folder.name); setFolderRenaming(false) }
                  }}
                  onBlur={commitFolderRename}
                  className="bg-gray-900 border border-blue-500 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none"
                />
              ) : (
                <button onClick={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setFolderMenuPos({ x: Math.min(rect.left, window.innerWidth - 200), y: rect.bottom + 4 })
                  }}
                  className="flex items-center gap-1 min-w-0 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors cursor-pointer">
                  <span className="text-sm text-gray-200 truncate">{folder.name || '無題のフォルダ'}</span>
                  <span className="text-gray-500 text-xs flex-shrink-0">▼</span>
                </button>
              )}
            </div>
            <span className="text-[11px] text-gray-600 ml-2 flex-shrink-0">{scenes.length} シーン</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onNewScene?.(folder.id)}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer flex items-center gap-1">
              <PlusIcon size={14} /> 新シーン
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="px-4 pb-2.5">
          {editingDescription ? (
            <textarea
              autoFocus
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); cancelDescription() }
              }}
              onBlur={commitDescription}
              rows={2}
              placeholder="このフォルダの説明（例：彼女の一日）"
              className="w-full bg-gray-900 border border-blue-500 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none resize-none leading-relaxed"
            />
          ) : (
            <button onClick={() => { setDescDraft(folder.description || ''); setEditingDescription(true) }}
              className="w-full text-left px-2 py-1 rounded text-xs leading-relaxed transition-colors cursor-text">
              {folder.description ? (
                <span className="text-gray-400 whitespace-pre-wrap">{folder.description}</span>
              ) : (
                <span className="text-gray-600 italic hover:text-gray-500">このフォルダの説明（例：彼女の一日）</span>
              )}
            </button>
          )}
        </div>

        {/* AI templates */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <button onClick={() => setShowDecompose(true)}
            className="px-2.5 py-1 text-[11px] rounded bg-transparent text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-600 hover:bg-white/[0.04] transition-colors cursor-pointer">
            ストーリー分解
          </button>
          <button onClick={() => setShowExpansion(true)}
            disabled={scenes.length === 0}
            title={scenes.length === 0 ? '起点シーンがありません' : ''}
            className="px-2.5 py-1 text-[11px] rounded bg-transparent text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-600 hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400">
            前後シーン生成
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 pt-6">
        {scenes.length === 0 ? (
          <div className="max-w-md mx-auto mt-12 border border-dashed border-gray-700 rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-1">📁 このフォルダはまだ空です</div>
            <div className="text-xs text-gray-600 mb-4">サイドバーからシーンをドラッグするか、新規作成してください</div>
            <button onClick={() => onNewScene?.(folder.id)}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer inline-flex items-center gap-1">
              <PlusIcon size={14} /> 新シーンを作成
            </button>
          </div>
        ) : (
          <div ref={scrollerRef} className="overflow-x-auto pb-4">
            <div className="flex items-stretch gap-4 min-w-min">
              {scenes.map((scene, idx) => (
                <SceneCard
                  key={scene.id}
                  prompt={scene}
                  index={idx}
                  isLast={idx === scenes.length - 1}
                  isCurrent={currentSceneId === scene.id}
                  isBeingDragged={dragState?.sceneId === scene.id}
                  dropPosition={sceneDropMap[scene.id] || null}
                  image={imageMap[scene.id] || null}
                  imageBlurred={isBlurred(imageMap[scene.id])}
                  onRevealImage={revealImage}
                  onOpen={onOpenScene}
                  onRenameTitle={onRenameScene}
                  onUpdateDescription={onUpdateSceneDescription}
                  onDuplicate={onDuplicateScene}
                  onMoveOut={(p) => onMoveSceneOut?.(p.id)}
                  onDelete={(p) => onDeleteScene?.(p.id)}
                  onDragStart={onSceneDragStart}
                  onDragEnd={onSceneDragEnd}
                  onDragOver={onSceneDragOver}
                  onDragLeave={onSceneDragLeave}
                  onDrop={onSceneDrop}
                />
              ))}
              {/* + new scene placeholder card */}
              <button onClick={() => onNewScene?.(folder.id)}
                className="flex-shrink-0 w-[240px] min-h-[180px] rounded-lg border border-dashed border-gray-700 hover:border-blue-500/60 hover:bg-blue-500/[0.04] transition-colors cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-blue-400">
                <PlusIcon size={20} />
                <span className="text-xs mt-1">新シーン</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI modals */}
      {showExpansion && (
        <SceneExpansionModal
          folder={folder}
          scenes={scenes}
          defaultAnchorId={currentSceneId && scenes.some(s => s.id === currentSceneId) ? currentSceneId : scenes[0]?.id}
          onClose={() => setShowExpansion(false)}
          onApply={(payload) => onSceneExpansionApply?.(payload)}
        />
      )}
      {showDecompose && (
        <StoryDecomposeModal
          folders={allFolders}
          currentFolderId={folder.id}
          onClose={() => setShowDecompose(false)}
          onApply={(payload) => onStoryDecomposeApply?.(payload)}
        />
      )}

      {/* Folder dropdown menu */}
      {folderMenuPos && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setFolderMenuPos(null)} />
          <div className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-[180px]"
            style={{ top: folderMenuPos.y, left: folderMenuPos.x }}>
            <button onClick={() => { setFolderNameDraft(folder.name || ''); setFolderRenaming(true); setFolderMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">名前を変更</button>
            <button onClick={() => { setDescDraft(folder.description || ''); setEditingDescription(true); setFolderMenuPos(null) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">説明を編集</button>
            <div className="border-t border-gray-700 my-1" />
            <button onClick={() => {
                const childCount = folder.sceneIds.length
                const msg = childCount > 0
                  ? `「${folder.name}」フォルダを削除しますか？\n中のシーン${childCount}件は未整理に戻ります。`
                  : `「${folder.name}」フォルダを削除しますか？`
                if (window.confirm(msg)) onDeleteFolder?.(folder.id)
                setFolderMenuPos(null)
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 cursor-pointer">削除</button>
          </div>
        </>
      )}
    </div>
  )
}
