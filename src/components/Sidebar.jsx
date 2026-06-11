import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import SidebarSceneItem from './SidebarSceneItem'
import SidebarFolderItem from './SidebarFolderItem'

const DRAG_TYPE = 'text/x-ppb-scene'
const AUTO_EXPAND_MS = 800


function NewFolderIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5a1 1 0 011-1h3.5l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z" />
      <path d="M8 7v3M6.5 8.5h3" />
    </svg>
  )
}

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

function ContextMenu({ position, items, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-[160px]"
        style={{ top: position.y, left: position.x }}>
        {items.map((item, idx) => {
          if (item.divider) return <div key={`div-${idx}`} className="border-t border-gray-700 my-1" />
          return (
            <button
              key={item.label}
              onClick={(e) => { e.stopPropagation(); item.onClick(); onClose() }}
              disabled={item.disabled}
              className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer ${
                item.disabled ? 'text-gray-600 cursor-default' : item.danger ? 'text-red-400 hover:bg-gray-700' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {item.label}
            </button>
          )
        })}
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
  sensitiveKeywords, onUpdateSensitiveKeywords,
  // folders
  folders, onCreateFolder, onRenameFolder, onDeleteFolder,
  isFolderCollapsed, onToggleFolder, onExpandFolder,
  onMoveScene,
  onRenamePrompt,
  activeFolderId,
  onOpenFolder,
  onGenerateScene,
  bench,
  onUpdateBench,
  onOpenSettings,
  imageCounts = {},
}) {
  const fileInputRef = useRef(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [renaming, setRenaming] = useState(null) // { type: 'folder'|'scene', id }

  // Drag state
  const [dragState, setDragState] = useState(null)
  // dragState: { sceneId, fromFolderId, hover: { type, id, position } | null }
  const autoExpandTimerRef = useRef(null)
  const autoExpandTargetRef = useRef(null)

  // Maps
  const folderById = useMemo(() => {
    const map = new Map()
    for (const f of folders) map.set(f.id, f)
    return map
  }, [folders])

  const sceneToFolder = useMemo(() => {
    const map = new Map()
    for (const f of folders) for (const sid of f.sceneIds) map.set(sid, f.id)
    return map
  }, [folders])

  const promptById = useMemo(() => {
    const map = new Map()
    for (const p of prompts) map.set(p.id, p)
    return map
  }, [prompts])

  const unsortedPrompts = useMemo(() => {
    return prompts.filter(p => !sceneToFolder.has(p.id))
  }, [prompts, sceneToFolder])

  const hasFolders = folders.length > 0

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const result = await onImportJson(file)
      const folderInfo = result.foldersImported ? `, ${result.foldersImported}フォルダ` : ''
      alert(`インポート完了: ${result.imported}件追加, ${result.skipped}件スキップ${folderInfo}`)
    } catch (err) {
      alert(`インポートエラー: ${err.message}`)
    }
    e.target.value = ''
  }

  const closeContextMenu = () => setContextMenu(null)

  const showSceneContextMenu = (e, prompt, anchor = null) => {
    e.preventDefault?.(); e.stopPropagation?.()
    const inFolder = sceneToFolder.has(prompt.id)
    const items = [
      { label: '名前を変更 (F2)', onClick: () => setRenaming({ type: 'scene', id: prompt.id }) },
      { label: '複製して開く', onClick: () => onDuplicate(prompt) },
      { divider: true },
      { label: '前シーンを生成…', onClick: () => onGenerateScene?.(prompt.id, 'prev') },
      { label: '後シーンを生成…', onClick: () => onGenerateScene?.(prompt.id, 'next') },
      { divider: true },
      { label: 'Markdown形式で Export…', onClick: () => onExportMarkdown(prompt) },
      ...(inFolder ? [{ label: 'フォルダから外す', onClick: () => onMoveScene?.(prompt.id, null, null) }] : []),
      { divider: true },
      { label: '削除', danger: true, onClick: () => {
        if (window.confirm(`「${prompt.title || 'Untitled'}」を削除しますか？`)) onDelete(prompt.id)
      } },
    ]
    const pos = anchor
      ? { x: Math.min(anchor.left, window.innerWidth - 180), y: anchor.bottom + 2 }
      : { x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 200) }
    setContextMenu({ position: pos, items })
  }

  const showFolderContextMenu = (e, folder, anchor = null) => {
    e.preventDefault?.(); e.stopPropagation?.()
    const isOpen = !isFolderCollapsed?.(folder.id)
    const items = [
      { label: 'ストーリーボードを開く', onClick: () => onOpenFolder?.(folder.id) },
      { label: '名前を変更 (F2)', onClick: () => setRenaming({ type: 'folder', id: folder.id }) },
      { label: isOpen ? '折りたたむ' : '展開', onClick: () => onToggleFolder?.(folder.id) },
      { divider: true },
      { label: '削除', danger: true, onClick: () => {
        const childCount = folder.sceneIds.length
        const msg = childCount > 0
          ? `「${folder.name}」フォルダを削除しますか？\n中のシーン${childCount}件は未整理に戻ります。`
          : `「${folder.name}」フォルダを削除しますか？`
        if (window.confirm(msg)) onDeleteFolder(folder.id)
      } },
    ]
    const pos = anchor
      ? { x: Math.min(anchor.left, window.innerWidth - 180), y: anchor.bottom + 2 }
      : { x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 200) }
    setContextMenu({ position: pos, items })
  }

  const handleSceneDots = (e, prompt) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    showSceneContextMenu(e, prompt, rect)
  }
  const handleFolderDots = (e, folder) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    showFolderContextMenu(e, folder, rect)
  }

  // F2 to rename
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'F2') return
      // Don't trigger if focus is in an input/textarea
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (currentId) {
        setRenaming({ type: 'scene', id: currentId })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentId])

  // --- DnD ---

  const clearAutoExpand = useCallback(() => {
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current)
      autoExpandTimerRef.current = null
    }
    autoExpandTargetRef.current = null
  }, [])

  useEffect(() => () => clearAutoExpand(), [clearAutoExpand])

  const startAutoExpand = useCallback((folderId) => {
    if (autoExpandTargetRef.current === folderId) return
    clearAutoExpand()
    autoExpandTargetRef.current = folderId
    autoExpandTimerRef.current = setTimeout(() => {
      onExpandFolder?.(folderId)
      autoExpandTimerRef.current = null
      autoExpandTargetRef.current = null
    }, AUTO_EXPAND_MS)
  }, [clearAutoExpand, onExpandFolder])

  const onSceneDragStart = (e, prompt) => {
    e.dataTransfer.setData(DRAG_TYPE, prompt.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragState({
      sceneId: prompt.id,
      fromFolderId: sceneToFolder.get(prompt.id) || null,
      hover: null,
    })
  }

  const onSceneDragEnd = () => {
    clearAutoExpand()
    setDragState(null)
  }

  const computeScenePosition = (e, currentTarget) => {
    const rect = currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    return y < rect.height / 2 ? 'before' : 'after'
  }

  const onSceneDragOver = (e, scene) => {
    if (!dragState) return
    if (scene.id === dragState.sceneId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    clearAutoExpand()
    const targetFolderId = sceneToFolder.get(scene.id) || null
    // Skip reorder within unsorted (no stable order) — only allow move-out semantics
    if (targetFolderId === null && dragState.fromFolderId === null) {
      // no-op
      return
    }
    const position = computeScenePosition(e, e.currentTarget)
    setDragState(prev => prev && {
      ...prev,
      hover: { type: 'scene', id: scene.id, position, folderId: targetFolderId },
    })
  }

  const onSceneDragLeave = (e, scene) => {
    if (!dragState) return
    if (dragState.hover?.type === 'scene' && dragState.hover.id === scene.id) {
      // Don't clear here aggressively; let next dragOver overwrite
    }
  }

  const onSceneDrop = (e, scene) => {
    if (!dragState) return
    e.preventDefault(); e.stopPropagation()
    const draggedId = dragState.sceneId
    if (!draggedId || draggedId === scene.id) { setDragState(null); return }
    const targetFolderId = sceneToFolder.get(scene.id) || null
    if (targetFolderId === null && dragState.fromFolderId === null) {
      setDragState(null); return
    }
    const position = dragState.hover?.position || computeScenePosition(e, e.currentTarget)
    if (targetFolderId === null) {
      // Drop on unsorted scene → move out of folder
      onMoveScene?.(draggedId, null, null)
    } else {
      const folder = folderById.get(targetFolderId)
      const baseIds = folder.sceneIds.filter(id => id !== draggedId)
      const targetIdx = baseIds.indexOf(scene.id)
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
      onMoveScene?.(draggedId, targetFolderId, insertIdx)
    }
    setDragState(null)
    clearAutoExpand()
  }

  const onFolderDragOver = (e, folder) => {
    if (!dragState) return
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragState(prev => prev && {
      ...prev,
      hover: { type: 'folder', id: folder.id, position: 'inside' },
    })
    if (isFolderCollapsed?.(folder.id)) {
      startAutoExpand(folder.id)
    }
  }

  const onFolderDragLeave = (e, folder) => {
    if (!dragState) return
    if (autoExpandTargetRef.current === folder.id) clearAutoExpand()
  }

  const onFolderDrop = (e, folder) => {
    if (!dragState) return
    e.preventDefault(); e.stopPropagation()
    const draggedId = dragState.sceneId
    if (!draggedId) { setDragState(null); return }
    onMoveScene?.(draggedId, folder.id, null) // append to end
    setDragState(null)
    clearAutoExpand()
  }

  // Unsorted area drop (background)
  const onUnsortedDragOver = (e) => {
    if (!dragState) return
    if (dragState.fromFolderId === null) return // already unsorted
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragState(prev => prev && { ...prev, hover: { type: 'unsorted', id: null, position: 'inside' } })
    clearAutoExpand()
  }

  const onUnsortedDrop = (e) => {
    if (!dragState) return
    if (dragState.fromFolderId === null) { setDragState(null); return }
    e.preventDefault(); e.stopPropagation()
    onMoveScene?.(dragState.sceneId, null, null)
    setDragState(null)
    clearAutoExpand()
  }

  // Per-scene drop indicator map
  const sceneDropMap = useMemo(() => {
    if (!dragState?.hover || dragState.hover.type !== 'scene') return {}
    return { [dragState.hover.id]: dragState.hover.position }
  }, [dragState])

  // Rename commit
  const commitFolderRename = (newName) => {
    if (renaming?.type === 'folder') onRenameFolder?.(renaming.id, newName)
    setRenaming(null)
  }
  const commitSceneRename = (newName) => {
    if (renaming?.type === 'scene') onRenamePrompt?.(renaming.id, newName)
    setRenaming(null)
  }

  // Render scene rows for unsorted (with date grouping)
  const renderUnsortedScenes = () => {
    const groups = groupPromptsByDate(unsortedPrompts)
    return Object.entries(groups).map(([groupKey, groupPrompts]) => {
      if (groupPrompts.length === 0) return null
      return (
        <div key={groupKey} className="mb-1">
          <div className="px-2 pt-3 pb-1">
            <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
              {DATE_GROUP_LABELS[groupKey]}
            </span>
          </div>
          {groupPrompts.map(prompt => (
            <SidebarSceneItem
              key={prompt.id}
              prompt={prompt}
              isCurrent={currentId === prompt.id}
              isBeingDragged={dragState?.sceneId === prompt.id}
              dropPosition={sceneDropMap[prompt.id] || null}
              isRenaming={renaming?.type === 'scene' && renaming.id === prompt.id}
              imageCount={imageCounts[prompt.id] || 0}
              onLoad={onLoad}
              onContextMenu={showSceneContextMenu}
              onDuplicate={onDuplicate}
              onDotsClick={handleSceneDots}
              onCommitRename={commitSceneRename}
              onCancelRename={() => setRenaming(null)}
              onDragStart={onSceneDragStart}
              onDragEnd={onSceneDragEnd}
              onDragOver={onSceneDragOver}
              onDragLeave={onSceneDragLeave}
              onDrop={onSceneDrop}
            />
          ))}
        </div>
      )
    })
  }

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

      {/* Actions */}
      <div className="px-3 pb-2 space-y-1">
        <div className="flex gap-1.5">
          <button onClick={onNew}
            className="flex-1 px-3 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md font-medium transition-colors cursor-pointer text-gray-300 text-center">
            + 新規作成
          </button>
          <button onClick={() => {
              const id = onCreateFolder?.('新規フォルダ')
              if (id) setRenaming({ type: 'folder', id })
            }}
            className="px-2.5 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md transition-colors cursor-pointer text-gray-500 hover:text-gray-300 flex items-center gap-1"
            title="フォルダを作成">
            <NewFolderIcon size={12} /> フォルダ
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 rounded-md transition-colors cursor-pointer text-gray-400 hover:text-gray-200"
            title="JSON形式のバックアップを復元">
            JSON復元
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {prompts.length === 0 && folders.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">プロンプトなし</p>
        ) : (
          <>
            {/* Folders */}
            {folders.map(folder => {
              const childIds = folder.sceneIds
              const childScenes = childIds.map(id => promptById.get(id)).filter(Boolean)
              const isOpen = !isFolderCollapsed?.(folder.id)
              const isFolderRenaming = renaming?.type === 'folder' && renaming.id === folder.id
              const isFolderDropTarget = dragState?.hover?.type === 'folder' && dragState.hover.id === folder.id
              const isEmptyFolderDropActive = isFolderDropTarget && childScenes.length === 0
              const isActiveFolder = activeFolderId === folder.id
              return (
                <SidebarFolderItem
                  key={folder.id}
                  folder={folder}
                  isOpen={isOpen}
                  isRenaming={isFolderRenaming}
                  isDropTarget={isFolderDropTarget}
                  isActive={isActiveFolder}
                  childScenes={childScenes}
                  currentSceneId={currentId}
                  renamingSceneId={renaming?.type === 'scene' ? renaming.id : null}
                  draggedSceneId={dragState?.sceneId}
                  sceneDropMap={sceneDropMap}
                  imageCounts={imageCounts}
                  onToggle={onToggleFolder}
                  onCommitRename={commitFolderRename}
                  onCancelRename={() => setRenaming(null)}
                  onClick={(e, f) => { e.stopPropagation(); onOpenFolder?.(f.id) }}
                  onContextMenu={showFolderContextMenu}
                  onDotsClick={handleFolderDots}
                  onSceneLoad={onLoad}
                  onSceneContextMenu={showSceneContextMenu}
                  onSceneDuplicate={onDuplicate}
                  onSceneDotsClick={handleSceneDots}
                  onSceneCommitRename={commitSceneRename}
                  onSceneCancelRename={() => setRenaming(null)}
                  onDragOver={onFolderDragOver}
                  onDragLeave={onFolderDragLeave}
                  onDrop={onFolderDrop}
                  onSceneDragStart={onSceneDragStart}
                  onSceneDragEnd={onSceneDragEnd}
                  onSceneDragOver={onSceneDragOver}
                  onSceneDragLeave={onSceneDragLeave}
                  onSceneDrop={onSceneDrop}
                  emptyDropActive={isEmptyFolderDropActive}
                />
              )
            })}

            {/* Unsorted area */}
            <div
              onDragOver={onUnsortedDragOver}
              onDrop={onUnsortedDrop}
              className={`mt-1 ${dragState?.hover?.type === 'unsorted' ? 'bg-blue-500/[0.04] rounded' : ''}`}
            >
              {hasFolders && unsortedPrompts.length > 0 && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">未整理</span>
                </div>
              )}
              {hasFolders ? (
                unsortedPrompts.length > 0 ? renderUnsortedScenes() : null
              ) : (
                renderUnsortedScenes()
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom */}
      <div className="px-3 py-2 border-t border-gray-800/60 space-y-1">
        <button onClick={onExportJson}
          className="w-full px-2 py-1.5 text-[11px] bg-transparent hover:bg-white/[0.05] rounded text-gray-500 hover:text-gray-400 transition-colors cursor-pointer text-left">
          Export JSON（全件バックアップ）
        </button>
        <button onClick={() => onOpenSettings?.()}
          className="w-full px-2 py-1.5 text-[11px] bg-transparent hover:bg-white/[0.05] rounded text-gray-400 hover:text-gray-200 transition-colors cursor-pointer text-left flex items-center gap-1.5">
          <span>⚙</span> 設定
        </button>
      </div>

      {contextMenu && (
        <ContextMenu position={contextMenu.position} items={contextMenu.items} onClose={closeContextMenu} />
      )}
    </div>
  )
}
