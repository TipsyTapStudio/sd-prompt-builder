import { useState, useCallback } from 'react'
import sectionsData from './data/sections.json'
import PromptSection from './components/PromptSection'
import BreakDivider from './components/BreakDivider'
import OutputPanel from './components/OutputPanel'
import SaveModal from './components/SaveModal'
import { usePromptBuilder } from './hooks/usePromptBuilder'
import { useStorage } from './hooks/useStorage'

const createEmptySections = () => {
  const sections = {}
  sectionsData.positive.forEach(s => { sections[s.key] = '' })
  return sections
}

const createEmptyNegativeSections = () => {
  const sections = {}
  sectionsData.negative.forEach(s => { sections[s.key] = '' })
  return sections
}

export default function App() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sections, setSections] = useState(createEmptySections)
  const [negativeSections, setNegativeSections] = useState(createEmptyNegativeSections)
  const [includeHeaders, setIncludeHeaders] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [currentId, setCurrentId] = useState(null)

  const { positivePrompt, negativePrompt } = usePromptBuilder(sections, negativeSections, includeHeaders)
  const { prompts, savePrompt, loadPrompt, deletePrompt } = useStorage()

  const updateSection = useCallback((key, value) => {
    setSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateNegativeSection = useCallback((key, value) => {
    setNegativeSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = () => {
    let saveTitle = title
    if (!saveTitle.trim()) {
      const input = window.prompt('タイトルを入力してください')
      if (!input) return
      saveTitle = input
      setTitle(saveTitle)
    }
    const id = savePrompt({
      id: currentId,
      title: saveTitle,
      description,
      sections,
      negative_sections: negativeSections,
    })
    setCurrentId(id)
  }

  const handleLoad = (prompt) => {
    const hasContent = Object.values(sections).some(v => v.trim()) ||
      Object.values(negativeSections).some(v => v.trim())
    if (hasContent && !window.confirm('現在の入力内容を上書きしますか？')) return

    setTitle(prompt.title || '')
    setDescription(prompt.description || '')
    setSections({ ...createEmptySections(), ...prompt.sections })
    setNegativeSections({ ...createEmptyNegativeSections(), ...prompt.negative_sections })
    setCurrentId(prompt.id)
    setShowSaveModal(false)
  }

  const handleNew = () => {
    const hasContent = Object.values(sections).some(v => v.trim()) ||
      Object.values(negativeSections).some(v => v.trim())
    if (hasContent && !window.confirm('現在の入力内容をクリアしますか？')) return

    setTitle('')
    setDescription('')
    setSections(createEmptySections())
    setNegativeSections(createEmptyNegativeSections())
    setCurrentId(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-100">SD Prompt Builder</h1>
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors cursor-pointer"
          >
            保存一覧
          </button>
        </div>

        {/* Title & Description */}
        <div className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="タイトル"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <input
            type="text"
            placeholder="説明（メモ）"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Positive Sections */}
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">── Positive ──</h2>
        </div>

        {sectionsData.positive.map((section) => (
          <div key={section.key}>
            <PromptSection
              section={section}
              value={sections[section.key] || ''}
              onChange={(val) => updateSection(section.key, val)}
              type="positive"
            />
            {section.key === sectionsData.breakAfter && <BreakDivider />}
          </div>
        ))}

        {/* Negative Sections */}
        <div className="mt-6 mb-2">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">── Negative ──</h2>
        </div>

        {sectionsData.negative.map((section) => (
          <PromptSection
            key={section.key}
            section={section}
            value={negativeSections[section.key] || ''}
            onChange={(val) => updateNegativeSection(section.key, val)}
            type="negative"
          />
        ))}

        {/* Output */}
        <OutputPanel
          positivePrompt={positivePrompt}
          negativePrompt={negativePrompt}
          includeHeaders={includeHeaders}
          onToggleHeaders={() => setIncludeHeaders(prev => !prev)}
        />

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 mb-10">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors cursor-pointer"
          >
            保存
          </button>
          <button
            onClick={handleNew}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 font-medium transition-colors cursor-pointer"
          >
            新規作成
          </button>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <SaveModal
          prompts={prompts}
          onLoad={handleLoad}
          onDelete={deletePrompt}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  )
}
