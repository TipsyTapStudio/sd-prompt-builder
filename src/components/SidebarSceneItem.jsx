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

function DuplicateIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
    </svg>
  )
}

function HasImagesIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <path d="M13.5 10.5L10 7l-5.5 5.5" />
    </svg>
  )
}

export default function SidebarSceneItem({
  prompt,
  isCurrent,
  inFolder = false,
  isBeingDragged = false,
  dropPosition = null, // 'before' | 'after' | null
  isRenaming = false,
  imageCount = 0,
  onLoad,
  onContextMenu,
  onDuplicate,
  onDotsClick,
  onCommitRename,
  onCancelRename,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  return (
    <div className="relative">
      {dropPosition === 'before' && (
        <div className="absolute left-2 right-2 -top-px h-0.5 bg-blue-500 rounded-full pointer-events-none z-10" />
      )}
      {dropPosition === 'after' && (
        <div className="absolute left-2 right-2 -bottom-px h-0.5 bg-blue-500 rounded-full pointer-events-none z-10" />
      )}
      <div
        draggable={!isRenaming}
        onClick={isRenaming ? undefined : () => onLoad?.(prompt)}
        onContextMenu={isRenaming ? undefined : (e) => onContextMenu?.(e, prompt)}
        onDragStart={(e) => onDragStart?.(e, prompt)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver?.(e, prompt)}
        onDragLeave={(e) => onDragLeave?.(e, prompt)}
        onDrop={(e) => onDrop?.(e, prompt)}
        className={`group flex items-center px-2 py-[7px] mx-0.5 rounded-md transition-colors ${
          isRenaming ? 'cursor-default' : 'cursor-pointer'
        } ${
          isBeingDragged ? 'opacity-40' : ''
        } ${
          isCurrent ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
        } ${inFolder ? 'pl-6' : ''}`}
      >
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <RenameInline
              initialValue={prompt.title || ''}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
            />
          ) : (
            <>
              <div className={`text-[13px] leading-tight truncate ${
                isCurrent ? 'text-gray-100' : 'text-gray-400'
              }`}>{prompt.title || 'Untitled'}</div>
              {prompt.description && (
                <div className={`text-[11px] leading-tight truncate mt-0.5 ${
                  isCurrent ? 'text-gray-400' : 'text-gray-500'
                }`}>{prompt.description}</div>
              )}
            </>
          )}
        </div>
        {!isRenaming && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate?.(prompt) }}
              className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 cursor-pointer"
              title="複製して開く"
            >
              <DuplicateIcon size={12} />
            </button>
            <button
              onClick={(e) => onDotsClick?.(e, prompt)}
              className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              <DotsIcon size={12} />
            </button>
            {imageCount > 0 && (
              <span
                className={`flex-shrink-0 pl-1 ${isCurrent ? 'text-gray-500' : 'text-gray-600'}`}
                title={`生成画像 ${imageCount}枚`}
                aria-hidden="true"
              >
                <HasImagesIcon />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
