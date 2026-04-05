import { useRef, useEffect, useMemo } from 'react'
import { parseComments } from '../utils/commentParser'

/**
 * Normalize a tag for comparison (strip weight notation, lowercase).
 */
function normalizeTag(tag) {
  let t = tag.trim()
  const match = t.match(/^\((.+?)(?::\d+(?:\.\d+)?)?\)$/)
  if (match) t = match[1]
  return t.toLowerCase()
}

/**
 * Render a normal (non-comment) text segment with per-tag coloring.
 * Tags not in benchTagsSet are highlighted in orange.
 */
function NormalSegment({ text, benchTagsSet }) {
  if (!benchTagsSet || benchTagsSet.size === 0) {
    return <span className="text-gray-100">{text}</span>
  }

  // Split by commas while preserving delimiters
  const parts = text.split(/(,)/)

  return (
    <>
      {parts.map((part, i) => {
        // Comma delimiter or whitespace-only
        if (part === ',' || !part.trim()) {
          return <span key={i} className="text-gray-100">{part}</span>
        }

        // Check if this tag is in the bench
        const normalized = normalizeTag(part)
        if (!normalized) {
          return <span key={i} className="text-gray-100">{part}</span>
        }

        const isInBench = benchTagsSet.has(normalized)
        return (
          <span key={i} className={isInBench ? 'text-gray-100' : 'text-orange-300/70'}>
            {part}
          </span>
        )
      })}
    </>
  )
}

/**
 * Overlay that renders syntax-highlighted text on top of a textarea.
 * Colors: white (bench tag), orange (non-bench tag), green (comment).
 */
export default function HighlightOverlay({ text, textareaRef, benchTagsSet }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef?.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return

    const handleScroll = () => {
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }

    textarea.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => {
      textarea.removeEventListener('scroll', handleScroll)
    }
  }, [textareaRef])

  const segments = useMemo(() => parseComments(text), [text])

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-sm leading-relaxed px-3 py-2 pr-20 whitespace-pre-wrap break-words"
      style={{
        borderWidth: '1px',
        borderColor: 'transparent',
        borderStyle: 'solid',
      }}
      aria-hidden="true"
    >
      {segments.map((seg, i) => (
        seg.type === 'comment'
          ? <span key={i} className="text-green-600/70">{seg.text}</span>
          : <NormalSegment key={i} text={seg.text} benchTagsSet={benchTagsSet} />
      ))}
    </div>
  )
}
