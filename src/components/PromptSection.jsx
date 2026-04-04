import { useState, useRef, useEffect, useCallback } from 'react'
import PresetDropdown from './PresetDropdown'

export default function PromptSection({ section, value, onChange, type }) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen)
  const textareaRef = useRef(null)

  const borderColor = type === 'positive' ? 'border-blue-500' : 'border-red-500'
  const label = section.required ? section.name : `${section.name} (任意)`

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(ta.scrollHeight, 60) + 'px'
  }, [])

  useEffect(() => {
    if (isOpen) autoResize()
  }, [isOpen, value, autoResize])

  const handlePresetSelect = (tags) => {
    const current = value.trim()
    const newValue = current ? `${current}\n${tags}` : tags
    onChange(newValue)
  }

  return (
    <div className={`mb-3 border-l-3 ${borderColor} bg-gray-900 rounded-r-lg overflow-hidden`}>
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-800/50 transition-colors select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-4">{isOpen ? '▼' : '▶'}</span>
          <span className="text-sm font-medium text-gray-200">{label}</span>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <PresetDropdown sectionKey={section.key} onSelect={handlePresetSelect} type={type} />
        </div>
      </div>

      {isOpen && (
        <div className="px-3 pb-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono leading-relaxed"
            placeholder={`${section.name} tags...`}
            rows={2}
          />
        </div>
      )}
    </div>
  )
}
