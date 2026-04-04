import { useState, useRef, useEffect } from 'react'
import presetsData from '../data/presets.json'

export default function PresetDropdown({ sectionKey, onSelect, type }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const presetKey = type === 'negative' && sectionKey === 'composition' ? 'neg_composition' : sectionKey
  const presets = presetsData[presetKey] || []

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (presets.length === 0) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-gray-300 transition-colors cursor-pointer"
      >
        プリセット▼
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
          {presets.map((preset, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(preset.tags)
                setIsOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer border-b border-gray-700 last:border-b-0"
            >
              <div className="font-medium text-gray-200">{preset.label}</div>
              <div className="text-gray-500 truncate mt-0.5">{preset.tags}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
