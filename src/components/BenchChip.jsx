import { useState, useRef, useEffect } from 'react'
import { getCached, setCached } from '../utils/tagTranslationCache'

const HOVER_DELAY_MS = 500

export default function BenchChip({
  text,
  isUsedFixed = false,
  isUsedDP = false,
  isSelected = false,
  isDragging = false,
  isSensitive = false,
  isSystemDefault = false,
  translator,
  enableHoverTranslate = true,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const [hover, setHover] = useState(false)
  const [tooltipText, setTooltipText] = useState(() => getCached(text) || '')
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const cancelledRef = useRef(false)

  const isUsed = isUsedFixed || isUsedDP

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); cancelledRef.current = true }, [])

  const onMouseEnter = () => {
    setHover(true)
    if (!enableHoverTranslate || !translator?.isAvailable) return
    const cached = getCached(text)
    if (cached !== null) {
      setTooltipText(cached)
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      cancelledRef.current = false
      try {
        const t = await translator.translate(text)
        if (cancelledRef.current) return
        if (t) {
          setCached(text, t)
          setTooltipText(t)
        }
      } finally {
        if (!cancelledRef.current) setLoading(false)
      }
    }, HOVER_DELAY_MS)
  }

  const onMouseLeave = () => {
    setHover(false)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    cancelledRef.current = true
    setLoading(false)
  }

  // Style classes (priority: dragging > selected > sensitive > used > base)
  let chipClass
  if (isDragging) {
    chipClass = 'opacity-40 bg-blue-600/30 text-blue-300'
  } else if (isSelected) {
    chipClass = 'bg-blue-600/40 text-blue-200 ring-1 ring-blue-400'
  } else if (isUsedDP) {
    chipClass = isSensitive
      ? 'ring-1 ring-pink-400/70 bg-pink-900/30 text-pink-200 hover:ring-red-400/60 hover:bg-red-900/20 hover:text-red-300'
      : 'ring-1 ring-amber-400/60 bg-amber-900/20 text-amber-300 hover:ring-red-400/60 hover:bg-red-900/20 hover:text-red-300'
  } else if (isUsedFixed) {
    chipClass = isSensitive
      ? 'ring-1 ring-pink-400/70 bg-pink-900/30 text-pink-200 hover:ring-red-400/60 hover:bg-red-900/20 hover:text-red-300'
      : 'ring-1 ring-green-400/60 bg-green-900/20 text-green-300 hover:ring-red-400/60 hover:bg-red-900/20 hover:text-red-300'
  } else if (isSensitive) {
    chipClass = 'bg-pink-900/20 text-pink-300 ring-1 ring-pink-500/40 hover:bg-pink-700/40 hover:text-pink-100'
  } else {
    chipClass = 'bg-gray-700/60 hover:bg-blue-600/40 hover:text-blue-200 text-gray-400'
  }

  let prefix = ''
  if (isUsedDP) prefix = '◇ '
  else if (isUsedFixed) prefix = '✓ '

  const showTooltip = hover && enableHoverTranslate && translator?.isAvailable && (tooltipText || loading)

  return (
    <span className="relative inline-flex">
      <button
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap leading-tight select-none cursor-pointer ${isSystemDefault ? 'font-bold' : 'font-normal'} ${chipClass}`}
      >
        {prefix}{text}
      </button>
      {showTooltip && (
        <span
          className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 rounded bg-gray-950 border border-gray-700 shadow-lg text-[11px] text-gray-200 whitespace-pre-wrap pointer-events-none"
          style={{ minWidth: '60px', maxWidth: '240px' }}
        >
          {loading && !tooltipText ? <span className="text-gray-500">…</span> : tooltipText}
        </span>
      )}
    </span>
  )
}
