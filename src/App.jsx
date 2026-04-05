import { useState, useCallback, useRef, useEffect } from 'react'
import sectionsData from './data/sections.json'
import PromptSection from './components/PromptSection'
import BreakDivider from './components/BreakDivider'
import OutputPanel from './components/OutputPanel'
import Sidebar, { SidebarIcon } from './components/Sidebar'
import { usePromptBuilder } from './hooks/usePromptBuilder'
import { useStorage } from './hooks/useStorage'
import { useTranslator, PROVIDERS } from './hooks/useTranslator'

const SIDEBAR_WIDTH = 260

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

/**
 * Title dropdown menu — edit title/description, MD export, delete
 */
function TitleMenu({ title, description, onTitleChange, onDescriptionChange, onExportMarkdown, onDelete, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-2">
        <div className="px-3 pb-2">
          <label className="text-[10px] text-gray-500 block mb-0.5">タイトル</label>
          <input type="text" value={title} onChange={e => onTitleChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            placeholder="無題のプロンプト" />
        </div>
        <div className="px-3 pb-2">
          <label className="text-[10px] text-gray-500 block mb-0.5">説明</label>
          <input type="text" value={description} onChange={e => onDescriptionChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
            placeholder="メモ・コンテキスト" />
        </div>
        <div className="border-t border-gray-700 my-1" />
        <button onClick={() => { onExportMarkdown(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          Markdown保存
        </button>
        <div className="border-t border-gray-700 my-1" />
        <button onClick={() => { onDelete(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 cursor-pointer">
          削除
        </button>
      </div>
    </>
  )
}

export default function App() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sections, setSections] = useState(createEmptySections)
  const [negativeSections, setNegativeSections] = useState(createEmptyNegativeSections)
  const [includeHeaders, setIncludeHeaders] = useState(false)
  const [includeComments, setIncludeComments] = useState(true)
  const [currentId, setCurrentId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [translationProvider, setTranslationProvider] = useState(PROVIDERS.MYMEMORY)

  const handleResetBench = () => {
    if (!window.confirm('ベンチデータをプリセットの初期状態にリセットしますか？')) return
    localStorage.removeItem('sd-prompt-builder:bench')
    loadBench({})
  }

  const handleClearAll = () => {
    localStorage.removeItem('sd-prompt-builder:prompts')
    localStorage.removeItem('sd-prompt-builder:bench')
    localStorage.removeItem('sd-prompt-builder:settings')
    window.location.reload()
  }

  const { positivePrompt, negativePrompt } = usePromptBuilder(sections, negativeSections, includeHeaders)
  const translator = useTranslator(translationProvider)
  const {
    prompts, savePrompt, loadPrompt, deletePrompt,
    exportToJson, exportToMarkdown, importFromJson,
    bench, updateBench, loadBench,
    getFirstSamplePrompt,
  } = useStorage()

  // Auto-load first sample prompt on initial launch
  useEffect(() => {
    const hasAnyContent = Object.values(sections).some(v => v.trim()) ||
      Object.values(negativeSections).some(v => v.trim())
    if (!hasAnyContent && !currentId) {
      const sample = getFirstSamplePrompt()
      if (sample) {
        setTitle(sample.title || '')
        setDescription(sample.description || '')
        setSections(prev => ({ ...prev, ...sample.sections }))
        setNegativeSections(prev => ({ ...prev, ...sample.negative_sections }))
        setCurrentId(sample.id)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSection = useCallback((key, value) => {
    setSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateNegativeSection = useCallback((key, value) => {
    setNegativeSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = () => {
    if (!title.trim()) {
      setTitleMenuOpen(true) // Open title menu to prompt user to enter title
      return
    }
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
    if (prompt.bench) loadBench(prompt.bench)
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

  const handleDeleteCurrent = () => {
    if (!currentId) return
    if (!window.confirm(`「${title}」を削除しますか？`)) return
    deletePrompt(currentId)
    handleNew()
  }

  const handleExportCurrentMd = () => {
    exportToMarkdown({
      id: currentId, title, description,
      sections, negative_sections: negativeSections, bench,
    })
  }

  const displayTitle = title || '無題のプロンプト'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex">
      {/* Sidebar */}
      <div className="flex-shrink-0 h-screen sticky top-0 transition-all duration-200 overflow-hidden"
        style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0 }}>
        <div style={{ width: SIDEBAR_WIDTH }} className="h-full">
          <Sidebar
            prompts={prompts} currentId={currentId}
            onLoad={handleLoad} onNew={handleNew} onDelete={deletePrompt}
            onExportJson={exportToJson} onExportMarkdown={exportToMarkdown} onImportJson={importFromJson}
            onResetBench={handleResetBench} onClearAll={handleClearAll}
            translationProvider={translationProvider}
            onSetTranslationProvider={setTranslationProvider}
            PROVIDERS={PROVIDERS}
            onToggleSidebar={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 pb-16">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800">
          <div className="px-4 py-2 flex items-center justify-between">
            {/* Left: sidebar toggle + title */}
            <div className="flex items-center gap-2 min-w-0">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)}
                  className="p-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer rounded hover:bg-gray-800 flex-shrink-0"
                  title="サイドバーを開く">
                  <SidebarIcon size={18} />
                </button>
              )}
              {!sidebarOpen && (
                <span className="text-[11px] text-gray-500 flex-shrink-0 mr-1">SD Prompt Builder</span>
              )}
              {/* Title with dropdown */}
              <div className="relative min-w-0">
                <button onClick={() => setTitleMenuOpen(!titleMenuOpen)}
                  className="flex items-center gap-1 min-w-0 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors cursor-pointer">
                  <span className={`text-sm truncate ${title ? 'text-gray-200' : 'text-gray-500'}`}>
                    {displayTitle}
                  </span>
                  <span className="text-gray-500 text-xs flex-shrink-0">▼</span>
                </button>
                {titleMenuOpen && (
                  <TitleMenu
                    title={title} description={description}
                    onTitleChange={setTitle} onDescriptionChange={setDescription}
                    onExportMarkdown={handleExportCurrentMd}
                    onDelete={handleDeleteCurrent}
                    onClose={() => setTitleMenuOpen(false)}
                  />
                )}
              </div>
            </div>
            {/* Right: translation toggle + save */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setTranslationProvider(prev =>
                prev === PROVIDERS.OFF ? PROVIDERS.MYMEMORY : PROVIDERS.OFF
              )}
                className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                  translationProvider !== PROVIDERS.OFF
                    ? 'text-blue-400 hover:text-blue-300 bg-blue-600/10'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
                title={translationProvider !== PROVIDERS.OFF ? '翻訳ON（クリックでOFF）' : '翻訳OFF（クリックでON）'}>
                訳
              </button>
              <button onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors cursor-pointer">
                保存
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-4">
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
                translator={translator}
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
                onBenchChange={(_sectionKey, val) => { updateBench(benchKey, val) }}
              />
            )
          })}
        </div>

        {/* Output Panel */}
        <div className="max-w-5xl mx-auto px-4">
          <OutputPanel
            positivePrompt={positivePrompt} negativePrompt={negativePrompt}
            includeHeaders={includeHeaders}
            onToggleHeaders={() => setIncludeHeaders(prev => !prev)}
            includeComments={includeComments}
            onToggleComments={() => setIncludeComments(prev => !prev)}
            sections={sections} negativeSections={negativeSections}
            onSectionsUpdate={setSections} onNegativeSectionsUpdate={setNegativeSections}
          />
        </div>
      </div>
    </div>
  )
}
