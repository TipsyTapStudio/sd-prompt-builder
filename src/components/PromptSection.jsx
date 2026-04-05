import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import presetsData from '../data/presets.json'
import HighlightOverlay from './HighlightOverlay'
import { parseComments, stripComments } from '../utils/commentParser'

function estimateTokens(text) {
  if (!text || !text.trim()) return 0
  const cleaned = stripComments(text)
  const segments = cleaned.split(',').map(s => s.trim()).filter(Boolean)
  let count = 0
  for (const seg of segments) {
    count += seg.split(/\s+/).filter(Boolean).length
  }
  return count
}

function normalizeTag(tag) {
  let t = tag.trim()
  const match = t.match(/^\((.+?)(?::\d+(?:\.\d+)?)?\)$/)
  if (match) t = match[1]
  return t.toLowerCase()
}

/**
 * Parse bench text into items: { type: 'tag' | 'comment', text: string }
 * Comments start with // and go to the next comma or end of text.
 * They are rendered as separators, not chips.
 */
function parseBenchItems(text) {
  if (!text || !text.trim()) return []
  const items = []
  const parts = text.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#') && !trimmed.startsWith('##')) {
      // Group header: "# HAIR" → label "HAIR"
      const label = trimmed.replace(/^#\s*/, '').trim()
      items.push({ type: 'comment', text: trimmed, label: label || trimmed, isGroup: true })
    } else if (trimmed.startsWith('//')) {
      // Sub-label: "// color" → label "color"
      const label = trimmed.replace(/^\/\/\s*-*\s*/, '').replace(/\s*-*\s*$/, '').trim()
      items.push({ type: 'comment', text: trimmed, label: label || trimmed, isGroup: false })
    } else {
      items.push({ type: 'tag', text: trimmed })
    }
  }
  return items
}

/** Rebuild bench text from items array */
function benchItemsToText(items) {
  return items.map(it => it.text).join(', ')
}

/** Convert flat comma-separated bench text to formatted multi-line for editing */
function benchTextToFormatted(text) {
  if (!text || !text.trim()) return ''
  const items = parseBenchItems(text)
  const lines = []
  let currentTags = []

  for (const item of items) {
    if (item.type === 'comment') {
      // Flush accumulated tags before the label
      if (currentTags.length > 0) {
        lines.push(currentTags.join(', '))
        currentTags = []
      }
      lines.push(item.text)
    } else {
      currentTags.push(item.text)
    }
  }
  // Flush remaining tags
  if (currentTags.length > 0) {
    lines.push(currentTags.join(', '))
  }
  return lines.join('\n')
}

/** Convert formatted multi-line text back to flat comma-separated */
function formattedToBenchText(formatted) {
  if (!formatted || !formatted.trim()) return ''
  const parts = []
  for (const line of formatted.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      parts.push(trimmed)
    } else {
      // Split tags by comma within the line
      const tags = trimmed.split(',').map(t => t.trim()).filter(Boolean)
      parts.push(...tags)
    }
  }
  return parts.join(', ')
}

export default function PromptSection({ section, value, onChange, type, benchValue, onBenchChange }) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen)
  const [benchOpen, setBenchOpen] = useState(true)
  const [benchEditMode, setBenchEditMode] = useState(false)
  const [benchEditText, setBenchEditText] = useState('')
  const [selectedChips, setSelectedChips] = useState(new Set())
  const [dragIndex, setDragIndex] = useState(null)
  const [dividerWidth, setDividerWidth] = useState(62) // left pane percentage
  const textareaRef = useRef(null)
  const benchRef = useRef(null)
  const userMinHeight = useRef(0)
  const dividerDragging = useRef(false)
  const containerRef = useRef(null)

  const borderColor = type === 'positive' ? 'border-blue-500' : 'border-red-500'
  const label = section.required ? section.name : `${section.name} (任意)`
  const isOptional = !section.required

  const presetKey = type === 'negative' && section.key === 'composition' ? 'neg_composition' : section.key
  const presets = presetsData[presetKey] || []

  const defaultBenchContent = useMemo(() => {
    if (presets.length === 0) return ''
    return presets.map(p => p.tags.replace(/,\s*$/, '')).join(', ')
  }, [presets])

  const effectiveBench = benchValue !== undefined ? benchValue : defaultBenchContent

  // Auto resize textarea
  const autoResize = useCallback((ref, respectUserMin = false) => {
    const ta = ref?.current
    if (!ta) return
    ta.style.height = 'auto'
    const contentHeight = Math.max(ta.scrollHeight, 60)
    const finalHeight = respectUserMin ? Math.max(contentHeight, userMinHeight.current) : contentHeight
    ta.style.height = finalHeight + 'px'
  }, [])

  useEffect(() => {
    if (isOpen) {
      autoResize(textareaRef, true)
      if (benchEditMode) autoResize(benchRef)
    }
  }, [isOpen, value, effectiveBench, benchEditMode, autoResize])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta || !isOpen) return
    const handleMouseUp = () => {
      const h = ta.offsetHeight
      if (h > userMinHeight.current) userMinHeight.current = h
    }
    ta.addEventListener('mouseup', handleMouseUp)
    return () => ta.removeEventListener('mouseup', handleMouseUp)
  }, [isOpen])

  // Active tags for bench filtering
  const activeTagsSet = useMemo(() => {
    if (!value || !value.trim()) return new Set()
    const tags = value.split(',').map(t => normalizeTag(t)).filter(Boolean)
    return new Set(tags)
  }, [value])

  // Insert tag at cursor position (or end)
  const insertTagAtCursor = useCallback((tag) => {
    const ta = textareaRef.current
    const trimmedTag = tag.trim()
    if (!trimmedTag) return

    if (ta && ta === document.activeElement) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const before = value.slice(0, start)
      const after = value.slice(end)

      // Add separator
      const needCommaBefore = before.trim() && !before.trim().endsWith(',') && !before.trim().endsWith('\n')
      const prefix = needCommaBefore ? ', ' : (before.trim() ? ' ' : '')
      const newValue = before + prefix + trimmedTag + ',' + after
      onChange(newValue)

      // Restore cursor after inserted tag
      const newPos = (before + prefix + trimmedTag + ',').length
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = newPos
        ta.focus()
      })
    } else {
      // Fallback: append to end
      const current = value.trim()
      const separator = current && !current.endsWith(',') && !current.endsWith('\n') ? ', ' : current ? ' ' : ''
      onChange(current + separator + trimmedTag + ',')
    }
  }, [value, onChange])

  // Handle bench tag click with Shift support
  const handleBenchTagClick = useCallback((tag, index, e) => {
    if (e.shiftKey) {
      // Toggle chip selection
      setSelectedChips(prev => {
        const next = new Set(prev)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
      return
    }

    // If there are selected chips, insert all selected + this one
    if (selectedChips.size > 0) {
      const benchItems = parseBenchItems(effectiveBench)
      const tagsToInsert = [...selectedChips]
        .sort((a, b) => a - b)
        .map(i => benchItems[i])
        .filter(it => it && it.type === 'tag')
        .map(it => it.text)

      // Also add the clicked tag if not already selected
      if (!selectedChips.has(index)) {
        tagsToInsert.push(tag)
      }

      for (const t of tagsToInsert) {
        insertTagAtCursor(t)
      }
      setSelectedChips(new Set())
      return
    }

    insertTagAtCursor(tag)
  }, [selectedChips, effectiveBench, insertTagAtCursor])

  // Bench items parsed with comments
  const benchItems = useMemo(() => parseBenchItems(effectiveBench), [effectiveBench])
  const hasBench = benchItems.length > 0 || benchEditMode

  // Drag and drop reorder
  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      return
    }
    const items = [...benchItems]
    const [moved] = items.splice(dragIndex, 1)
    items.splice(dropIndex, 0, moved)
    onBenchChange(section.key, benchItemsToText(items))
    setDragIndex(null)
  }, [dragIndex, benchItems, onBenchChange, section.key])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
  }, [])

  // Divider drag
  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    dividerDragging.current = true

    const onMouseMove = (e) => {
      if (!dividerDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setDividerWidth(Math.max(35, Math.min(80, pct)))
    }

    const onMouseUp = () => {
      dividerDragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  // Comment highlighting
  const hasComments = useMemo(() => {
    return parseComments(value).some(s => s.type === 'comment')
  }, [value])

  const tokenCount = useMemo(() => estimateTokens(value), [value])
  const tokenColorClass = tokenCount > 75
    ? 'text-red-400'
    : tokenCount > 60
      ? 'text-orange-400'
      : 'text-gray-600'

  return (
    <div className={`mb-2 border-l-3 ${borderColor} bg-gray-900 rounded-r-lg overflow-hidden ${isOptional && !isOpen ? 'opacity-50' : ''}`}>
      {/* Section header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-gray-800/50 transition-colors select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-4">{isOpen ? '\u25BC' : '\u25B6'}</span>
          <span className="text-sm font-medium text-gray-200">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && tokenCount > 0 && (
            <span className={`text-xs ${tokenColorClass}`}>
              {'\u2248'} {tokenCount} tokens
            </span>
          )}
          {/* Bench toggle (only when section is open and bench has content) */}
          {isOpen && hasBench && (
            <button
              onClick={(e) => { e.stopPropagation(); setBenchOpen(!benchOpen) }}
              className={`text-[11px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                benchOpen
                  ? 'bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'bg-gray-800 text-gray-600 hover:text-gray-400'
              }`}
              title={benchOpen ? 'ベンチを閉じる' : 'ベンチを開く'}
            >
              {benchOpen ? 'bench ✕' : 'bench'}
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-3 pb-2">
          <div className="flex" ref={containerRef}>
            {/* Left Pane: Main textarea */}
            <div style={{ width: benchOpen && hasBench ? `${dividerWidth}%` : '100%', flexShrink: 0 }}>
              <div className="relative">
                {hasComments && <HighlightOverlay text={value} textareaRef={textareaRef} />}
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-20 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors font-mono leading-relaxed"
                  style={{
                    resize: 'vertical',
                    overflow: 'hidden',
                    ...(hasComments ? { color: 'transparent', caretColor: '#f3f4f6' } : {}),
                  }}
                  placeholder={`${section.name} tags...`}
                  rows={2}
                />
                <span className={`absolute right-2 bottom-1.5 text-xs ${tokenColorClass} pointer-events-none`}>
                  {'\u2248'}{tokenCount}/75
                </span>
              </div>
            </div>

            {/* Resizable divider */}
            {benchOpen && hasBench && (
              <div
                className="w-2 flex-shrink-0 cursor-col-resize flex items-center justify-center group"
                onMouseDown={handleDividerMouseDown}
              >
                <div className="w-0.5 h-8 bg-gray-700 group-hover:bg-blue-500 rounded-full transition-colors" />
              </div>
            )}

            {/* Right Pane: Bench zone */}
            {benchOpen && hasBench && (
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chip area */}
                <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-1.5 flex-1 min-h-[60px] overflow-y-auto">
                  <div className="flex flex-wrap gap-0.5">
                    {benchItems.map((item, i) => {
                      if (item.type === 'comment') {
                        if (item.isGroup) {
                          // Group header: bold, slightly larger, with line
                          return (
                            <div key={`comment-${i}`} className="w-full flex items-center gap-1 pt-1.5 pb-0.5 px-1 select-none pointer-events-none first:pt-0">
                              <span className="text-[11px] leading-none text-zinc-400 font-bold truncate">{item.label}</span>
                              <span className="flex-1 h-px bg-zinc-700" />
                            </div>
                          )
                        }
                        return (
                          <div key={`comment-${i}`} className="w-full flex items-center gap-1 py-0.5 px-1 select-none pointer-events-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 flex-shrink-0" />
                            <span className="text-[11px] leading-none text-zinc-500 truncate">{item.label}</span>
                          </div>
                        )
                      }

                      const isUsed = activeTagsSet.has(normalizeTag(item.text))
                      const isSelected = selectedChips.has(i)
                      const isDragging = dragIndex === i

                      return (
                        <button
                          key={`${item.text}-${i}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, i)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => !isUsed && handleBenchTagClick(item.text, i, e)}
                          className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap leading-tight select-none ${
                            isDragging
                              ? 'opacity-40 bg-blue-600/30 text-blue-300'
                              : isSelected
                                ? 'bg-blue-600/40 text-blue-200 ring-1 ring-blue-400'
                                : isUsed
                                  ? 'opacity-30 line-through bg-gray-700/60 text-gray-400 cursor-default'
                                  : 'bg-gray-700/60 hover:bg-blue-600/40 hover:text-blue-200 text-gray-400 cursor-pointer'
                          }`}
                          title={
                            isUsed ? `Already used: ${item.text}` :
                            isSelected ? 'Click to insert selected, Shift+Click to deselect' :
                            'Click to add, Shift+Click to multi-select, Drag to reorder'
                          }
                        >
                          {item.text}
                        </button>
                      )
                    })}
                  </div>
                  {/* Selected chips indicator */}
                  {selectedChips.size > 0 && (
                    <div className="mt-1.5 pt-1 border-t border-gray-700 flex items-center gap-1">
                      <span className="text-[11px] text-blue-400">{selectedChips.size} selected</span>
                      <button
                        onClick={() => {
                          // Insert all selected
                          const items = parseBenchItems(effectiveBench)
                          const tags = [...selectedChips]
                            .sort((a, b) => a - b)
                            .map(i => items[i])
                            .filter(it => it && it.type === 'tag')
                            .map(it => it.text)
                          for (const t of tags) insertTagAtCursor(t)
                          setSelectedChips(new Set())
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer underline"
                      >
                        insert all
                      </button>
                      <button
                        onClick={() => setSelectedChips(new Set())}
                        className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer"
                      >
                        clear
                      </button>
                    </div>
                  )}
                </div>
                {/* Edit toggle */}
                {benchEditMode ? (
                  <div className="mt-1">
                    <textarea
                      ref={benchRef}
                      value={benchEditText}
                      onChange={e => setBenchEditText(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 text-xs text-gray-500 placeholder-gray-700 focus:outline-none focus:border-gray-600 font-mono leading-relaxed"
                      style={{ resize: 'vertical', overflow: 'hidden' }}
                      placeholder={"// label\ntag1, tag2, tag3\n// label\ntag4, tag5"}
                      rows={5}
                    />
                    <button
                      onClick={() => {
                        onBenchChange(section.key, formattedToBenchText(benchEditText))
                        setBenchEditMode(false)
                      }}
                      className="text-[11px] text-gray-500 hover:text-gray-300 mt-0.5 cursor-pointer"
                    >
                      閉じる
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setBenchEditText(benchTextToFormatted(effectiveBench))
                      setBenchEditMode(true)
                    }}
                    className="mt-1 text-[11px] text-gray-600 hover:text-gray-400 cursor-pointer text-left"
                    title="ベンチを編集"
                  >
                    ✎ 編集
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
