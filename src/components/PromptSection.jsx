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
    const words = seg.split(/\s+/).filter(Boolean)
    count += words.length
  }
  return count
}

function normalizeTag(tag) {
  let t = tag.trim()
  const match = t.match(/^\((.+?)(?::\d+(?:\.\d+)?)?\)$/)
  if (match) t = match[1]
  return t.toLowerCase()
}

export default function PromptSection({ section, value, onChange, type, benchValue, onBenchChange }) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen)
  const [benchEditMode, setBenchEditMode] = useState(false)
  const textareaRef = useRef(null)
  const benchRef = useRef(null)
  const userMinHeight = useRef(0)

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

  // Track user manual resize via mouseup
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta || !isOpen) return
    const handleMouseUp = () => {
      const h = ta.offsetHeight
      if (h > userMinHeight.current) {
        userMinHeight.current = h
      }
    }
    ta.addEventListener('mouseup', handleMouseUp)
    return () => ta.removeEventListener('mouseup', handleMouseUp)
  }, [isOpen])

  // Compute active tags set for bench filtering
  const activeTagsSet = useMemo(() => {
    if (!value || !value.trim()) return new Set()
    const tags = value.split(',').map(t => normalizeTag(t)).filter(Boolean)
    return new Set(tags)
  }, [value])

  const handleBenchTagClick = (tag) => {
    const trimmedTag = tag.trim()
    if (!trimmedTag) return
    const current = value.trim()
    const separator = current && !current.endsWith(',') && !current.endsWith('\n') ? ', ' : current ? ' ' : ''
    const newValue = current + separator + trimmedTag + ','
    onChange(newValue)
  }

  const benchTags = useMemo(() => {
    if (!effectiveBench || !effectiveBench.trim()) return []
    return effectiveBench.split(',').map(t => t.trim()).filter(Boolean)
  }, [effectiveBench])

  const hasBench = benchTags.length > 0 || benchEditMode

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
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-gray-800/50 transition-colors select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-4">{isOpen ? '\u25BC' : '\u25B6'}</span>
          <span className="text-sm font-medium text-gray-200">{label}</span>
        </div>
        {!isOpen && tokenCount > 0 && (
          <span className={`text-xs ${tokenColorClass}`}>
            {'\u2248'} {tokenCount} tokens
          </span>
        )}
      </div>

      {isOpen && (
        <div className="px-3 pb-2">
          <div className="flex gap-2">
            {/* Left Pane: Main textarea */}
            <div className={hasBench ? 'w-[72%]' : 'w-full'} style={{ flexShrink: 0 }}>
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
                {/* Token counter overlay */}
                <span className={`absolute right-2 bottom-1.5 text-xs ${tokenColorClass} pointer-events-none`}>
                  {'\u2248'}{tokenCount}/75
                </span>
              </div>
            </div>

            {/* Right Pane: Bench zone */}
            {hasBench && (
              <div className="w-[28%] flex-shrink-0 flex flex-col">
                <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-1.5 flex-1 min-h-[60px] max-h-[120px] overflow-y-auto">
                  {benchTags.length > 0 ? (
                    <div className="flex flex-wrap gap-0.5">
                      {benchTags.map((tag, i) => {
                        const isUsed = activeTagsSet.has(normalizeTag(tag))
                        return (
                          <button
                            key={`${tag}-${i}`}
                            onClick={isUsed ? undefined : () => handleBenchTagClick(tag)}
                            className={`text-[11px] px-1 py-0.5 rounded transition-colors whitespace-nowrap leading-tight ${
                              isUsed
                                ? 'opacity-30 line-through bg-gray-700/60 text-gray-400 cursor-default'
                                : 'bg-gray-700/60 hover:bg-blue-600/40 hover:text-blue-200 text-gray-400 cursor-pointer'
                            }`}
                            title={isUsed ? `Already used: ${tag}` : `Click to add: ${tag}`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 italic">Empty</span>
                  )}
                </div>
                {benchEditMode ? (
                  <div className="mt-1">
                    <textarea
                      ref={benchRef}
                      value={effectiveBench}
                      onChange={e => onBenchChange(section.key, e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 text-xs text-gray-500 placeholder-gray-700 focus:outline-none focus:border-gray-600 resize-none font-mono leading-relaxed"
                      placeholder="Bench tags..."
                      rows={2}
                    />
                    <button
                      onClick={() => setBenchEditMode(false)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 mt-0.5 cursor-pointer"
                    >
                      閉じる
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setBenchEditMode(true)}
                    className="mt-1 text-[10px] text-gray-600 hover:text-gray-400 cursor-pointer text-left"
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
