import { useState, useMemo, useCallback } from 'react'
import sectionsData from '../data/sections.json'

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
    } catch {
      // fallback
    }
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
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`absolute top-2 right-2 p-1.5 rounded transition-colors cursor-pointer ${
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

/**
 * Build preview text with section headers from raw section data.
 * Always includes ### headers for display purposes.
 */
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

/**
 * Parse preview text back into section key-value pairs.
 */
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

/**
 * Build the raw prompt text (for copying) without ### headers.
 */
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
 * Render styled preview lines with colored headers and BREAK.
 */
function StyledPreview({ text }) {
  if (!text) {
    return <span className="text-gray-600 text-xs">(input to see preview)</span>
  }

  const lines = text.split('\n')
  return (
    <div className="text-xs font-mono leading-relaxed">
      {lines.map((line, i) => {
        if (line.match(/^###\s+/)) {
          return (
            <div key={i} className="text-gray-500">
              {line}
            </div>
          )
        }
        if (line.trim() === 'BREAK') {
          return (
            <div key={i} className="text-orange-400 font-bold">
              BREAK
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
  sections,
  negativeSections,
  onSectionsUpdate,
  onNegativeSectionsUpdate,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('positive') // 'positive' | 'negative'
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')

  // Build preview texts from raw section data
  const positivePreview = useMemo(
    () => buildPreviewText(sections, sectionsData.positive, true),
    [sections]
  )
  const negativePreview = useMemo(
    () => buildPreviewText(negativeSections, sectionsData.negative, false),
    [negativeSections]
  )

  // Copy texts (without headers)
  const positiveCopyText = useMemo(
    () => buildCopyText(sections, sectionsData.positive, true),
    [sections]
  )
  const negativeCopyText = useMemo(
    () => buildCopyText(negativeSections, sectionsData.negative, false),
    [negativeSections]
  )

  const currentPreview = activeTab === 'positive' ? positivePreview : negativePreview
  const currentCopyText = activeTab === 'positive' ? positiveCopyText : negativeCopyText

  // Collapsed preview: first 50 chars of positive prompt
  const collapsedPreview = useMemo(() => {
    const text = positiveCopyText
    if (!text) return ''
    return text.length > 50 ? text.slice(0, 50) + '...' : text
  }, [positiveCopyText])

  const handleStartEdit = useCallback(() => {
    setEditText(currentPreview)
    setIsEditing(true)
  }, [currentPreview])

  const handleFinishEdit = useCallback(() => {
    const sectionDefs = activeTab === 'positive' ? sectionsData.positive : sectionsData.negative
    const parsed = parsePreviewText(editText, sectionDefs)

    if (activeTab === 'positive') {
      // Merge parsed values with existing sections (keep keys not in parsed as empty)
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

    setIsEditing(false)
  }, [editText, activeTab, onSectionsUpdate, onNegativeSectionsUpdate])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <div className="sticky bottom-0 z-40 bg-gray-950 border-t border-gray-700 -mx-4 px-4 mt-8">
      {/* Collapsed header bar */}
      <div
        className="flex items-center justify-between py-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-gray-400 flex-shrink-0">{isExpanded ? '▼' : '▲'}</span>
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
            preview
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={includeHeaders}
              onChange={onToggleHeaders}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 accent-blue-500"
            />
            <span className="text-xs text-gray-500">headers</span>
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

      {/* Expanded content */}
      {isExpanded && (
        <div className="pb-3 max-h-[60vh] overflow-y-auto">
          {/* Tab bar */}
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => { setActiveTab('positive'); setIsEditing(false) }}
              className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'positive'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-500 border-transparent hover:text-gray-400'
              }`}
            >
              Positive
            </button>
            <button
              onClick={() => { setActiveTab('negative'); setIsEditing(false) }}
              className={`text-xs font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'negative'
                  ? 'text-red-400 border-red-400'
                  : 'text-gray-500 border-transparent hover:text-gray-400'
              }`}
            >
              Negative
            </button>
          </div>

          {/* Preview area */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            {/* Corner copy button */}
            <CornerCopyButton text={includeHeaders ? (activeTab === 'positive' ? positivePrompt : negativePrompt) : currentCopyText} />

            {isEditing ? (
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-gray-900 text-xs text-gray-200 font-mono p-3 pr-10 resize-none focus:outline-none leading-relaxed min-h-[120px]"
                  style={{ height: `${Math.max(120, editText.split('\n').length * 18 + 24)}px` }}
                />
                <div className="flex items-center gap-2 px-3 pb-2">
                  <button
                    onClick={handleFinishEdit}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer"
                  >
                    apply
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors cursor-pointer"
                  >
                    cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="p-3 pr-10 cursor-text min-h-[60px]"
                onClick={handleStartEdit}
              >
                <StyledPreview text={currentPreview} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { CopyIconButton as CopyButton }
