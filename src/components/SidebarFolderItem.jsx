import RenameInline from './RenameInline'
import SidebarSceneItem from './SidebarSceneItem'

function ChevronIcon({ open, size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }}>
      <path d="M5 3l6 5-6 5" />
    </svg>
  )
}

function FolderIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5a1 1 0 011-1h3.5l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z" />
    </svg>
  )
}

function DotsIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  )
}

export default function SidebarFolderItem({
  folder,
  isOpen,
  isRenaming,
  isDropTarget = false,           // ring highlight when drop=inside
  isActive = false,               // currently shown in storyboard view
  childScenes,                    // array of prompts in this folder (sorted by sceneIds order)
  currentSceneId,
  renamingSceneId,
  draggedSceneId,
  sceneDropMap,                   // { [sceneId]: 'before'|'after' } for child drop indicators
  imageCounts = {},               // { [sceneId]: count } gallery attachment indicator
  onToggle,
  onCommitRename,
  onCancelRename,
  onDotsClick,
  onContextMenu,
  onClick,                        // body click → toggle in Phase 1
  onSceneLoad,
  onSceneContextMenu,
  onSceneDuplicate,
  onSceneDotsClick,
  onSceneCommitRename,
  onSceneCancelRename,
  // DnD handlers (folder body)
  onDragOver,
  onDragLeave,
  onDrop,
  // DnD handlers (scene rows)
  onSceneDragStart,
  onSceneDragEnd,
  onSceneDragOver,
  onSceneDragLeave,
  onSceneDrop,
  // DnD: empty body inside expanded folder
  emptyDropActive = false,
}) {
  return (
    <div className="mb-0.5">
      {/* Folder row */}
      <div
        onClick={isRenaming ? undefined : (e) => onClick?.(e, folder)}
        onContextMenu={isRenaming ? undefined : (e) => onContextMenu?.(e, folder)}
        onDragOver={(e) => onDragOver?.(e, folder)}
        onDragLeave={(e) => onDragLeave?.(e, folder)}
        onDrop={(e) => onDrop?.(e, folder)}
        className={`group flex items-center gap-1 px-2 py-[7px] mx-0.5 rounded-md transition-colors ${
          isRenaming ? 'cursor-default' : 'cursor-pointer'
        } ${
          isDropTarget
            ? 'ring-1 ring-blue-500/60 bg-blue-500/[0.08]'
            : isActive
              ? 'bg-white/[0.06]'
              : 'hover:bg-white/[0.04]'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(folder.id) }}
          className="flex-shrink-0 p-0.5 text-gray-500 hover:text-gray-300 cursor-pointer"
          aria-label={isOpen ? '折りたたむ' : '展開'}
          tabIndex={-1}
        >
          <ChevronIcon open={isOpen} size={10} />
        </button>
        <span className="flex-shrink-0 text-gray-500"><FolderIcon size={13} /></span>
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <RenameInline
              initialValue={folder.name || ''}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
            />
          ) : (
            <div className="text-[13px] leading-tight truncate text-gray-300">{folder.name || '無題のフォルダ'}</div>
          )}
        </div>
        {!isRenaming && (
          <button
            onClick={(e) => onDotsClick?.(e, folder)}
            className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 cursor-pointer"
            aria-label="メニュー"
          >
            <DotsIcon size={12} />
          </button>
        )}
      </div>

      {/* Child scenes */}
      {isOpen && (
        <div>
          {childScenes.length === 0 && !emptyDropActive && (
            <div className="text-[11px] text-gray-600 px-2 py-1 italic ml-6">シーンをドラッグして追加</div>
          )}
          {emptyDropActive && childScenes.length === 0 && (
            <div className="mx-2 my-1 ml-6 h-6 border border-dashed border-blue-500/60 rounded bg-blue-500/[0.06]" />
          )}
          {childScenes.map(scene => (
            <SidebarSceneItem
              key={scene.id}
              prompt={scene}
              isCurrent={currentSceneId === scene.id}
              inFolder
              isBeingDragged={draggedSceneId === scene.id}
              dropPosition={sceneDropMap?.[scene.id] || null}
              isRenaming={renamingSceneId === scene.id}
              imageCount={imageCounts[scene.id] || 0}
              onLoad={onSceneLoad}
              onContextMenu={onSceneContextMenu}
              onDuplicate={onSceneDuplicate}
              onDotsClick={onSceneDotsClick}
              onCommitRename={onSceneCommitRename}
              onCancelRename={onSceneCancelRename}
              onDragStart={onSceneDragStart}
              onDragEnd={onSceneDragEnd}
              onDragOver={onSceneDragOver}
              onDragLeave={onSceneDragLeave}
              onDrop={onSceneDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}
