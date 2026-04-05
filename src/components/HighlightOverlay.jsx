import { useRef, useEffect } from 'react'
import { parseComments } from '../utils/commentParser'

/**
 * Overlay that renders syntax-highlighted text on top of a textarea.
 * The textarea text is made transparent so this overlay's colored spans
 * show through while the textarea retains full editing capability.
 *
 * Props:
 *   text         - the raw text content (same as textarea value)
 *   textareaRef  - React ref to the underlying textarea element
 */
export default function HighlightOverlay({ text, textareaRef }) {
  const overlayRef = useRef(null)

  // Sync scroll position with the textarea
  useEffect(() => {
    const textarea = textareaRef?.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return

    const handleScroll = () => {
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }

    textarea.addEventListener('scroll', handleScroll)
    // Initial sync
    handleScroll()

    return () => {
      textarea.removeEventListener('scroll', handleScroll)
    }
  }, [textareaRef])

  const segments = parseComments(text)

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-sm leading-relaxed px-3 py-2 pr-20 whitespace-pre-wrap break-words"
      style={{
        // Match the textarea's 1px border so text aligns exactly
        borderWidth: '1px',
        borderColor: 'transparent',
        borderStyle: 'solid',
      }}
      aria-hidden="true"
    >
      {segments.map((seg, i) => (
        <span
          key={i}
          className={seg.type === 'comment' ? 'text-green-600/70' : 'text-gray-100'}
        >
          {seg.text}
        </span>
      ))}
    </div>
  )
}
