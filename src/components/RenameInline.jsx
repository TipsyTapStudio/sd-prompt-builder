import { useEffect, useRef, useState } from 'react'

/**
 * Inline rename / edit field.
 * Single-line (default):
 *   - Enter or Blur → commit
 *   - Esc → cancel
 *   - Empty commit → cancel (keep original) unless allowEmpty
 * Multiline (`multiline` prop):
 *   - Enter → newline
 *   - Cmd/Ctrl+Enter or Blur → commit
 *   - Esc → cancel
 *   - Empty value is permitted by default (descriptions can be empty)
 */
export default function RenameInline({
  initialValue,
  onCommit,
  onCancel,
  className = '',
  autoFocus = true,
  multiline = false,
  rows = 3,
  placeholder = '',
  allowEmpty = null, // null → defaults: false single-line, true multiline
}) {
  const [value, setValue] = useState(initialValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      if (!multiline) inputRef.current.select()
    }
  }, [autoFocus, multiline])

  const empty = (allowEmpty == null) ? multiline : allowEmpty

  const commit = () => {
    const next = multiline ? (value || '') : value.trim()
    const original = multiline ? (initialValue || '') : (initialValue || '').trim()
    if (next === original) { onCancel?.(); return }
    if (!empty && !next) { onCancel?.(); return }
    onCommit?.(next)
  }

  const cancel = () => onCancel?.()

  if (multiline) {
    return (
      <textarea
        ref={inputRef}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => {
          e.stopPropagation()
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
          else if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        onBlur={commit}
        className={`bg-gray-900 border border-blue-500 rounded px-1.5 py-1 text-[11px] text-gray-200 focus:outline-none w-full resize-none leading-relaxed ${className}`}
      />
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => setValue(e.target.value)}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        else if (e.key === 'Escape') { e.preventDefault(); cancel() }
      }}
      onBlur={commit}
      className={`bg-gray-900 border border-blue-500 rounded px-1.5 py-0 text-[13px] text-gray-100 focus:outline-none w-full ${className}`}
    />
  )
}
