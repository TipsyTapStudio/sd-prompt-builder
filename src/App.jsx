import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import sectionsData from './data/sections.json'
import PromptSection from './components/PromptSection'
import BreakDivider from './components/BreakDivider'
import OutputPanel from './components/OutputPanel'
import Sidebar, { SidebarIcon } from './components/Sidebar'
import { usePromptBuilder } from './hooks/usePromptBuilder'
import { useStorage, saveDraft, loadDraft, clearDraft } from './hooks/useStorage'
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
 * Title dropdown menu
 */
function TitleMenu({ title, description, onTitleChange, onDescriptionChange,
  onExportMarkdown, onDelete, onCopyAsNew, onRevert, canRevert, createdAt, lastSavedAt, onClose }) {
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
        <button onClick={() => { onCopyAsNew(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          コピーとして保存
        </button>
        <button onClick={() => { onExportMarkdown(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          Markdown保存
        </button>
        <div className="border-t border-gray-700 my-1" />
        <button onClick={() => { onRevert(); onClose() }}
          disabled={!canRevert}
          className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer ${
            canRevert ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 cursor-default'
          }`}>
          変更を元に戻す
        </button>
        <div className="border-t border-gray-700 my-1" />
        <button onClick={() => { onDelete(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 cursor-pointer">
          削除
        </button>
        {(createdAt || lastSavedAt) && (
          <div className="px-3 pt-1.5 space-y-0.5">
            {createdAt && (
              <div className="text-[11px] text-gray-400">
                作成: {new Date(createdAt).toLocaleString('ja-JP')}
              </div>
            )}
            {lastSavedAt && (
              <div className="text-[11px] text-gray-400">
                更新: {new Date(lastSavedAt).toLocaleString('ja-JP')}
              </div>
            )}
          </div>
        )}
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
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null) // snapshot of last saved state
  const [saveFlash, setSaveFlash] = useState(false) // brief "saved" feedback

  const { positivePrompt, negativePrompt } = usePromptBuilder(sections, negativeSections, includeHeaders)
  const translator = useTranslator(translationProvider)
  const {
    prompts, savePrompt, loadPrompt, deletePrompt,
    exportToJson, exportToMarkdown, importFromJson,
    bench, updateBench, loadBench,
    getFirstSamplePrompt,
  } = useStorage()

  // --- Draft auto-save (debounce 1.5s) ---
  const draftTimerRef = useRef(null)
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      saveDraft({ title, description, sections, negativeSections, currentId, bench })
    }, 1500)
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current) }
  }, [title, description, sections, negativeSections, currentId, bench])

  // Save draft immediately on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft({ title, description, sections, negativeSections, currentId, bench })
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [title, description, sections, negativeSections, currentId, bench])

  // --- Initial load: Draft > Sample ---
  useEffect(() => {
    const draft = loadDraft()
    if (draft && (draft.title || Object.values(draft.sections || {}).some(v => v?.trim()))) {
      setTitle(draft.title || '')
      setDescription(draft.description || '')
      setSections(prev => ({ ...prev, ...(draft.sections || {}) }))
      setNegativeSections(prev => ({ ...prev, ...(draft.negativeSections || {}) }))
      setCurrentId(draft.currentId || null)
      if (draft.bench) loadBench(draft.bench)
      // Set snapshot if loading an existing prompt
      if (draft.currentId) {
        const saved = prompts.find(p => p.id === draft.currentId)
        if (saved) setLastSavedSnapshot(saved)
      }
      return
    }
    // Fallback: load sample
    const sample = getFirstSamplePrompt()
    if (sample) {
      setTitle(sample.title || '')
      setDescription(sample.description || '')
      setSections(prev => ({ ...prev, ...sample.sections }))
      setNegativeSections(prev => ({ ...prev, ...sample.negative_sections }))
      setCurrentId(sample.id)
      setLastSavedSnapshot(sample)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- isDirty: compare current state with last saved ---
  const isDirty = useMemo(() => {
    if (!currentId || !lastSavedSnapshot) return false
    const snap = lastSavedSnapshot
    if (title !== (snap.title || '')) return true
    if (description !== (snap.description || '')) return true
    for (const s of sectionsData.positive) {
      if ((sections[s.key] || '') !== (snap.sections?.[s.key] || '')) return true
    }
    for (const s of sectionsData.negative) {
      if ((negativeSections[s.key] || '') !== (snap.negative_sections?.[s.key] || '')) return true
    }
    return false
  }, [title, description, sections, negativeSections, currentId, lastSavedSnapshot])

  const isNewPrompt = !currentId

  // --- Handlers ---
  const updateSection = useCallback((key, value) => {
    setSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateNegativeSection = useCallback((key, value) => {
    setNegativeSections(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = () => {
    if (!title.trim()) {
      setTitleMenuOpen(true)
      return
    }
    const data = {
      id: currentId,
      title, description, sections,
      negative_sections: negativeSections,
    }
    const id = savePrompt(data)
    setCurrentId(id)
    // Update snapshot
    setLastSavedSnapshot({
      ...data, id,
      title, description, sections, negative_sections: negativeSections,
      updated_at: new Date().toISOString(),
    })
    // Flash feedback
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 2000)
  }

  const handleLoad = (prompt) => {
    setTitle(prompt.title || '')
    setDescription(prompt.description || '')
    setSections({ ...createEmptySections(), ...prompt.sections })
    setNegativeSections({ ...createEmptyNegativeSections(), ...prompt.negative_sections })
    setCurrentId(prompt.id)
    setLastSavedSnapshot(prompt)
    if (prompt.bench) loadBench(prompt.bench)
    clearDraft()
  }

  const handleNew = () => {
    setTitle('')
    setDescription('')
    setSections(createEmptySections())
    setNegativeSections(createEmptyNegativeSections())
    setCurrentId(null)
    setLastSavedSnapshot(null)
    clearDraft()
  }

  const handleDeleteCurrent = () => {
    if (!currentId) return
    if (!window.confirm(`「${title}」を削除しますか？`)) return
    deletePrompt(currentId)
    handleNew()
  }

  const handleCopyAsNew = () => {
    const newTitle = `${title || '無題'} のコピー`
    setTitle(newTitle)
    setCurrentId(null) // detach from original
    setLastSavedSnapshot(null)
    // Next save will create a new prompt
  }

  // Duplicate a prompt from sidebar (open as new copy)
  const handleDuplicate = (prompt) => {
    setTitle(`${prompt.title || '無題'} のコピー`)
    setDescription(prompt.description || '')
    setSections({ ...createEmptySections(), ...prompt.sections })
    setNegativeSections({ ...createEmptyNegativeSections(), ...prompt.negative_sections })
    setCurrentId(null) // new prompt
    setLastSavedSnapshot(null)
    if (prompt.bench) loadBench(prompt.bench)
    clearDraft()
  }

  const handleRevert = () => {
    if (!lastSavedSnapshot) return
    if (!window.confirm('最後に保存した状態に戻しますか？')) return
    handleLoad(lastSavedSnapshot)
  }

  const handleExportCurrentMd = () => {
    exportToMarkdown({
      id: currentId, title, description,
      sections, negative_sections: negativeSections, bench,
    })
  }

  const handleResetBench = () => {
    if (!window.confirm('ベンチデータをプリセットの初期状態にリセットしますか？')) return
    localStorage.removeItem('sd-prompt-builder:bench')
    loadBench({})
  }

  const handleClearAll = () => {
    localStorage.removeItem('sd-prompt-builder:prompts')
    localStorage.removeItem('sd-prompt-builder:bench')
    localStorage.removeItem('sd-prompt-builder:settings')
    localStorage.removeItem('sd-prompt-builder:draft')
    window.location.reload()
  }

  const displayTitle = title || '無題のプロンプト'

  // Save button label & style
  const saveButtonLabel = saveFlash ? '✓ 保存済み' : isNewPrompt ? '保存する' : isDirty ? '変更を保存' : '✓ 保存済み'
  const saveButtonActive = isNewPrompt || isDirty
  const saveButtonClass = saveFlash
    ? 'bg-green-600/80 text-white'
    : saveButtonActive
      ? 'bg-blue-600 hover:bg-blue-500 text-white'
      : 'bg-transparent text-gray-500'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex">
      {/* Sidebar */}
      <div className="flex-shrink-0 h-screen sticky top-0 transition-all duration-200 overflow-hidden"
        style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0 }}>
        <div style={{ width: SIDEBAR_WIDTH }} className="h-full">
          <Sidebar
            prompts={prompts} currentId={currentId}
            onLoad={handleLoad} onDuplicate={handleDuplicate} onNew={handleNew} onDelete={deletePrompt}
            onExportJson={exportToJson} onExportMarkdown={exportToMarkdown} onImportJson={importFromJson}
            onResetBench={handleResetBench} onClearAll={handleClearAll}
            translationProvider={translationProvider}
            onSetTranslationProvider={setTranslationProvider}
            translatorActiveProvider={translator.activeProvider}
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
              {/* Title dropdown */}
              <div className="relative min-w-0">
                <button onClick={() => setTitleMenuOpen(!titleMenuOpen)}
                  className="flex items-center gap-1 min-w-0 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors cursor-pointer">
                  <span className={`text-sm truncate ${title ? 'text-gray-200' : 'text-gray-500'}`}>
                    {displayTitle}
                  </span>
                  {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="未保存の変更あり" />}
                  <span className="text-gray-500 text-xs flex-shrink-0">▼</span>
                </button>
                {titleMenuOpen && (
                  <TitleMenu
                    title={title} description={description}
                    onTitleChange={setTitle} onDescriptionChange={setDescription}
                    onExportMarkdown={handleExportCurrentMd}
                    onDelete={handleDeleteCurrent}
                    onCopyAsNew={handleCopyAsNew}
                    onRevert={handleRevert}
                    canRevert={isDirty}
                    createdAt={lastSavedSnapshot?.created_at}
                    lastSavedAt={lastSavedSnapshot?.updated_at}
                    onClose={() => setTitleMenuOpen(false)}
                  />
                )}
              </div>
            </div>
            {/* Right: translation status + save */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setTranslationProvider(prev =>
                prev === PROVIDERS.OFF ? PROVIDERS.MYMEMORY : PROVIDERS.OFF
              )}
                className={`px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  translationProvider !== PROVIDERS.OFF
                    ? 'text-blue-400 hover:text-blue-300 bg-blue-600/10'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
                title="クリックで翻訳ON/OFF切替。エンジン変更は設定から">
                {translationProvider === PROVIDERS.OFF
                  ? '翻訳OFF'
                  : `翻訳 ${translator.activeProvider || translationProvider}`
                }
              </button>
              <button onClick={saveButtonActive ? handleSave : undefined}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${saveButtonClass} ${
                  saveButtonActive ? 'cursor-pointer' : 'cursor-default'
                }`}>
                {saveButtonLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-4">
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Positive</h2>
          {sectionsData.positive.map((section) => (
            <div key={section.key}>
              <PromptSection section={section} value={sections[section.key] || ''}
                onChange={(val) => updateSection(section.key, val)} type="positive"
                benchValue={bench[section.key]} onBenchChange={updateBench} translator={translator} />
              {section.key === sectionsData.breakAfter && <BreakDivider />}
            </div>
          ))}

          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mt-4 mb-2">Negative</h2>
          {sectionsData.negative.map((section) => {
            const benchKey = section.key === 'composition' ? 'neg_composition' : section.key
            return (
              <PromptSection key={section.key} section={section}
                value={negativeSections[section.key] || ''}
                onChange={(val) => updateNegativeSection(section.key, val)} type="negative"
                benchValue={bench[benchKey]}
                onBenchChange={(_sectionKey, val) => { updateBench(benchKey, val) }} />
            )
          })}
        </div>

        <div className="max-w-5xl mx-auto px-4">
          <OutputPanel
            positivePrompt={positivePrompt} negativePrompt={negativePrompt}
            includeHeaders={includeHeaders} onToggleHeaders={() => setIncludeHeaders(prev => !prev)}
            includeComments={includeComments} onToggleComments={() => setIncludeComments(prev => !prev)}
            sections={sections} negativeSections={negativeSections}
            onSectionsUpdate={setSections} onNegativeSectionsUpdate={setNegativeSections} />
        </div>
      </div>
    </div>
  )
}
