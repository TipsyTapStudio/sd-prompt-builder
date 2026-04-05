import { useState, useCallback, useRef } from 'react'
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
  const [titleError, setTitleError] = useState(false)
  const titleRef = useRef(null)

  const { positivePrompt, negativePrompt } = usePromptBuilder(sections, negativeSections, includeHeaders)
  const {
    prompts, savePrompt, loadPrompt, deletePrompt,
    exportToJson, exportToMarkdown, importFromJson,
    bench, updateBench, loadBench,
  } = useStorage()

  const updateSection = useCallback((key, value) => {
    setSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateNegativeSection = useCallback((key, value) => {
    setNegativeSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = () => {
    if (!title.trim()) {
      setTitleError(true)
      titleRef.current?.focus()
      titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setTitleError(false)
    const id = savePrompt({
      id: currentId,
      title,
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
    setTitleError(false)

    if (prompt.bench) {
      loadBench(prompt.bench)
    }
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
    setTitleError(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 pb-16">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-100">SD Prompt Builder</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors cursor-pointer"
              >
                保存
              </button>
              <button
                onClick={handleNew}
                className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors cursor-pointer"
              >
                新規
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors cursor-pointer"
              >
                ファイル
              </button>
            </div>
          </div>
          {/* Toolbar placeholder for future text decoration tools */}
          <div id="toolbar-placeholder" className="hidden"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        {/* Title & Description */}
        <div className="flex gap-3 mb-4">
          <input
            ref={titleRef}
            type="text"
            placeholder="タイトル"
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleError(false) }}
            className={`flex-1 bg-gray-900 border rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none transition-colors ${
              titleError ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-blue-500'
            }`}
          />
          <input
            type="text"
            placeholder="説明（メモ）"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Positive Sections */}
        <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Positive</h2>

        {sectionsData.positive.map((section) => (
          <div key={section.key}>
            <PromptSection
              section={section}
              value={sections[section.key] || ''}
              onChange={(val) => updateSection(section.key, val)}
              type="positive"
              benchValue={bench[section.key]}
              onBenchChange={updateBench}
            />
            {section.key === sectionsData.breakAfter && <BreakDivider />}
          </div>
        ))}

        {/* Negative Sections */}
        <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mt-4 mb-2">Negative</h2>

        {sectionsData.negative.map((section) => {
          const benchKey = section.key === 'composition' ? 'neg_composition' : section.key
          return (
            <PromptSection
              key={section.key}
              section={section}
              value={negativeSections[section.key] || ''}
              onChange={(val) => updateNegativeSection(section.key, val)}
              type="negative"
              benchValue={bench[benchKey]}
              onBenchChange={(_sectionKey, val) => {
                updateBench(benchKey, val)
              }}
            />
          )
        })}
      </div>

      {/* Sticky Output Panel */}
      <div className="max-w-4xl mx-auto px-4">
        <OutputPanel
          positivePrompt={positivePrompt}
          negativePrompt={negativePrompt}
          includeHeaders={includeHeaders}
          onToggleHeaders={() => setIncludeHeaders(prev => !prev)}
          sections={sections}
          negativeSections={negativeSections}
          onSectionsUpdate={setSections}
          onNegativeSectionsUpdate={setNegativeSections}
        />
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <SaveModal
          prompts={prompts}
          onLoad={handleLoad}
          onDelete={deletePrompt}
          onClose={() => setShowSaveModal(false)}
          onExportJson={exportToJson}
          onExportMarkdown={exportToMarkdown}
          onImportJson={importFromJson}
        />
      )}
    </div>
  )
}
