import { useState, useMemo, useCallback } from 'react'
import sectionsData from '../data/sections.json'
import { parseComments } from '../utils/commentParser'

function CopyIcon({ size = 16 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CopyIconButton({ text, label }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
        copied
          ? 'bg-green-600 border-green-500 text-white'
          : 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300'
      }`}
      title={label}
    >
      <CopyIcon size={14} />
      <span>{copied ? 'Copied!' : label}</span>
    </button>
  )
}

function CornerCopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  return (
    <button
      onClick={handleCopy}
      className={`absolute top-2 right-2 p-1.5 rounded transition-colors cursor-pointer z-10 ${
        copied
          ? 'bg-green-600 text-white'
          : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200'
      }`}
      title={copied ? 'Copied!' : 'Copy'}
    >
      <CopyIcon size={14} />
    </button>
  )
}

function buildPreviewText(sections, sectionDefs, isPositive) {
  const parts = []

  if (isPositive) {
    const breakIndex = sectionDefs.findIndex(s => s.key === sectionsData.breakAfter)
    let breakInserted = false

    for (let i = 0; i < sectionDefs.length; i++) {
      const section = sectionDefs[i]
      const text = (sections[section.key] || '').trim()

      if (!breakInserted && i > breakIndex) {
        const hasContentBefore = sectionDefs.slice(0, breakIndex + 1).some(s => (sections[s.key] || '').trim())
        if (text && hasContentBefore) {
          parts.push('BREAK')
        }
        breakInserted = true
      }

      if (!text) continue
      parts.push(`### ${section.name}`)
      parts.push(text)
    }
  } else {
    for (const section of sectionDefs) {
      const text = (sections[section.key] || '').trim()
      if (!text) continue
      parts.push(`### ${section.name}`)
      parts.push(text)
    }
  }

  return parts.join('\n')
}

function parsePreviewText(text, sectionDefs) {
  const result = {}
  let currentKey = null
  for (const line of text.split('\n')) {
    const match = line.match(/^###\s+(.+)$/)
    if (match) {
      const sectionName = match[1].trim()
      const section = sectionDefs.find(s => s.name === sectionName)
      currentKey = section ? section.key : null
      continue
    }
    if (line.trim() === 'BREAK') continue
    if (currentKey) {
      result[currentKey] = (result[currentKey] || '') + (result[currentKey] ? '\n' : '') + line
    }
  }
  for (const key of Object.keys(result)) {
    result[key] = result[key].trim()
  }
  return result
}

function buildCopyText(sections, sectionDefs, isPositive) {
  const parts = []

  if (isPositive) {
    const breakIndex = sectionDefs.findIndex(s => s.key === sectionsData.breakAfter)
    let breakInserted = false

    for (let i = 0; i < sectionDefs.length; i++) {
      const section = sectionDefs[i]
      const text = (sections[section.key] || '').trim()

      if (!breakInserted && i > breakIndex) {
        const hasContentBefore = sectionDefs.slice(0, breakIndex + 1).some(s => (sections[s.key] || '').trim())
        if (text && hasContentBefore) {
          parts.push('')
          parts.push('BREAK')
          parts.push('')
        }
        breakInserted = true
      }

      if (!text) continue
      parts.push(text)
    }
  } else {
    for (const section of sectionDefs) {
      const text = (sections[section.key] || '').trim()
      if (!text) continue
      parts.push(text)
    }
  }

  return parts.join('\n').trim()
}

/**
 * Render a single line with inline comment coloring.
 * Comments (// and /* *​/) within a line are rendered in green with smaller font.
 */
function renderLineWithComments(line) {
  const segments = parseComments(line)
  return segments.map((seg, j) => {
    if (seg.type === 'comment') {
      return (
        <span key={j} className="text-green-600/70 text-[10px]">{seg.text}</span>
      )
    }
    return <span key={j}>{seg.text}</span>
  })
}

/**
 * Render styled preview with colored headers, BREAK, and comments.
 */
function StyledPreview({ text, showHeaders, showComments }) {
  if (!text) {
    return <span className="text-gray-600 text-xs">(input to see preview)</span>
  }

  const lines = text.split('\n')
  return (
    <div className="text-xs font-mono leading-relaxed">
      {lines.map((line, i) => {
        // Header lines
        if (line.match(/^###\s+/)) {
          if (!showHeaders) return null
          return (
            <div key={i} className="text-gray-500 text-[10px]">
              {line}
            </div>
          )
        }
        // BREAK
        if (line.trim() === 'BREAK') {
          return (
            <div key={i} className="text-orange-400 font-bold">
              BREAK
            </div>
          )
        }
        // Content lines — check for comments
        const hasComment = line.includes('//') || line.includes('/*')
        if (hasComment && !showComments) {
          // Strip comments from this line for display
          const segments = parseComments(line)
          const cleanParts = segments.filter(s => s.type === 'normal').map(s => s.text).join('')
          const cleaned = cleanParts.trim()
          if (!cleaned) return null // line was entirely a comment
          return (
            <div key={i} className="text-gray-200">
              {cleaned}
            </div>
          )
        }
        if (hasComment) {
          return (
            <div key={i} className="text-gray-200">
              {renderLineWithComments(line)}
            </div>
          )
        }
        return (
          <div key={i} className="text-gray-200">
            {line || '\u00A0'}
          </div>
        )
      })}
    </div>
  )
}

export default function OutputPanel({
  positivePrompt,
  negativePrompt,
  includeHeaders,
  onToggleHeaders,
  includeComments,
  onToggleComments,
  sections,
  negativeSections,
  onSectionsUpdate,
  onNegativeSectionsUpdate,
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingPanel, setEditingPanel] = useState(null) // 'positive' | 'negative' | null
  const [editText, setEditText] = useState('')

  const positivePreview = useMemo(
    () => buildPreviewText(sections, sectionsData.positive, true),
    [sections]
  )
  const negativePreview = useMemo(
    () => buildPreviewText(negativeSections, sectionsData.negative, false),
    [negativeSections]
  )

  const positiveCopyText = useMemo(
    () => buildCopyText(sections, sectionsData.positive, true),
    [sections]
  )
  const negativeCopyText = useMemo(
    () => buildCopyText(negativeSections, sectionsData.negative, false),
    [negativeSections]
  )

  const collapsedPreview = useMemo(() => {
    const text = positiveCopyText
    if (!text) return ''
    return text.length > 50 ? text.slice(0, 50) + '...' : text
  }, [positiveCopyText])

  const handleStartEdit = useCallback((panel) => {
    const preview = panel === 'positive' ? positivePreview : negativePreview
    setEditText(preview)
    setEditingPanel(panel)
  }, [positivePreview, negativePreview])

  const handleFinishEdit = useCallback(() => {
    const sectionDefs = editingPanel === 'positive' ? sectionsData.positive : sectionsData.negative
    const parsed = parsePreviewText(editText, sectionDefs)

    if (editingPanel === 'positive') {
      const updated = {}
      for (const s of sectionsData.positive) {
        updated[s.key] = parsed[s.key] !== undefined ? parsed[s.key] : ''
      }
      onSectionsUpdate(updated)
    } else {
      const updated = {}
      for (const s of sectionsData.negative) {
        updated[s.key] = parsed[s.key] !== undefined ? parsed[s.key] : ''
      }
      onNegativeSectionsUpdate(updated)
    }

    setEditingPanel(null)
  }, [editText, editingPanel, onSectionsUpdate, onNegativeSectionsUpdate])

  const handleCancelEdit = useCallback(() => {
    setEditingPanel(null)
  }, [])

  return (
    <div className="sticky bottom-0 z-40 bg-gray-950 border-t border-gray-700 -mx-4 px-4 mt-8">
      {/* Collapsed header bar */}
      <div
        className="flex items-center justify-between py-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-gray-400 flex-shrink-0">{isExpanded ? '\u25BC' : '\u25B2'}</span>
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
            preview
          </span>
          {/* Toggle checkboxes */}
          <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={includeHeaders}
              onChange={onToggleHeaders}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 accent-blue-500"
            />
            <span className="text-[10px] text-gray-500">headers</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={includeComments}
              onChange={onToggleComments}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 accent-blue-500"
            />
            <span className="text-[10px] text-gray-500">comments</span>
          </label>
          {/* Collapsed preview text */}
          {!isExpanded && collapsedPreview && (
            <span className="text-xs text-gray-500 truncate min-w-0">
              {collapsedPreview}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <CopyIconButton text={includeHeaders ? positivePrompt : positiveCopyText} label="P" />
          <CopyIconButton text={includeHeaders ? negativePrompt : negativeCopyText} label="N" />
        </div>
      </div>

      {/* Expanded content — Positive and Negative stacked */}
      {isExpanded && (
        <div className="pb-3 max-h-[60vh] overflow-y-auto">
          {/* Positive */}
          <div className="mb-2">
            <span className="text-[11px] font-medium text-blue-400">Positive</span>
            <div className="relative bg-gray-900 border border-gray-700 rounded-lg overflow-hidden mt-1">
              <CornerCopyButton text={includeHeaders ? positivePrompt : positiveCopyText} />
              {editingPanel === 'positive' ? (
                <div>
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-gray-900 text-xs text-gray-200 font-mono p-2 pr-10 resize-none focus:outline-none leading-relaxed min-h-[80px]"
                    style={{ height: `${Math.max(80, editText.split('\n').length * 18 + 20)}px` }} />
                  <div className="flex items-center gap-2 px-3 pb-2">
                    <button onClick={handleFinishEdit} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer">apply</button>
                    <button onClick={handleCancelEdit} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors cursor-pointer">cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-2 pr-10 cursor-text min-h-[40px]" onClick={() => handleStartEdit('positive')}>
                  <StyledPreview text={positivePreview} showHeaders={includeHeaders} showComments={includeComments} />
                </div>
              )}
            </div>
          </div>
          {/* Negative */}
          <div>
            <span className="text-[11px] font-medium text-red-400">Negative</span>
            <div className="relative bg-gray-900 border border-gray-700 rounded-lg overflow-hidden mt-1">
              <CornerCopyButton text={includeHeaders ? negativePrompt : negativeCopyText} />
              {editingPanel === 'negative' ? (
                <div>
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-gray-900 text-xs text-gray-200 font-mono p-2 pr-10 resize-none focus:outline-none leading-relaxed min-h-[60px]"
                    style={{ height: `${Math.max(60, editText.split('\n').length * 18 + 20)}px` }} />
                  <div className="flex items-center gap-2 px-3 pb-2">
                    <button onClick={handleFinishEdit} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer">apply</button>
                    <button onClick={handleCancelEdit} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors cursor-pointer">cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-2 pr-10 cursor-text min-h-[30px]" onClick={() => handleStartEdit('negative')}>
                  <StyledPreview text={negativePreview} showHeaders={includeHeaders} showComments={includeComments} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { CopyIconButton as CopyButton }
