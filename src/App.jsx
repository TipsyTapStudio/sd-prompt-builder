import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import sectionsData from './data/sections.json'
import PromptSection from './components/PromptSection'
import MarkdownExportModal from './components/MarkdownExportModal'
import BreakDivider from './components/BreakDivider'
import OutputPanel from './components/OutputPanel'
import Sidebar, { SidebarIcon } from './components/Sidebar'
import PromptAnalysisModal from './components/PromptAnalysisModal'
import SettingsModal from './components/SettingsModal'
import StoryboardView from './components/StoryboardView'
import ConsistencyCheckModal from './components/ConsistencyCheckModal'
import GalleryPanel from './components/GalleryPanel'
import DropOverlay from './components/DropOverlay'
import { usePromptBuilder } from './hooks/usePromptBuilder'
import { useStorage, saveDraft, loadDraft, clearDraft } from './hooks/useStorage'
import { useFolders } from './hooks/useFolders'
import { useImageGallery } from './hooks/useImageGallery'
import { useTranslator, PROVIDERS } from './hooks/useTranslator'
import {
  getSensitiveKeywords, setSensitiveKeywords,
  getGalleryBlurMode, setGalleryBlurMode,
} from './utils/sensitive'
import { deleteImagesForPrompt, deleteImageDatabase, getImageCounts } from './utils/imageDb'

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
  onExportMarkdown, onImportMarkdown, onDelete, onCopyAsNew, onRevert, canRevert, createdAt, lastSavedAt,
  onCheckConsistency, onLoadPrompt, onGeneratePrevScene, onGenerateNextScene, onClose }) {
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
          <textarea value={description} onChange={e => onDescriptionChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
            placeholder="メモ・コンテキスト"
            rows={3} />
        </div>
        <div className="border-t border-gray-700 my-1" />
        <button onClick={() => { onCheckConsistency(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          整合性チェック…
        </button>
        <button onClick={() => { onLoadPrompt(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          プロンプトを読み込む…
        </button>
        <button onClick={() => { onGeneratePrevScene(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          前シーンを生成…
        </button>
        <button onClick={() => { onGenerateNextScene(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          後シーンを生成…
        </button>
        <div className="border-t border-gray-700 my-1" />
        <button onClick={() => { onCopyAsNew(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          コピーとして保存
        </button>
        <button onClick={() => { onExportMarkdown(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          Markdown形式で Export…
        </button>
        <button onClick={() => { onImportMarkdown(); onClose() }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
          Markdown形式で Import…
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
  const [translationProvider, setTranslationProvider] = useState(PROVIDERS.AUTO)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null) // snapshot of last saved state
  const [saveFlash, setSaveFlash] = useState(false)
  const [viewMode, setViewMode] = useState('editor') // 'editor' | 'storyboard'
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [pendingFolderId, setPendingFolderId] = useState(null)
  const [consistencyOpen, setConsistencyOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisModalTemplate, setAnalysisModalTemplate] = useState('analysis') // 'analysis'|'prev'|'next'
  const [analysisInitialTab, setAnalysisInitialTab] = useState(null) // override initialTab when set
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mdExportTarget, setMdExportTarget] = useState(null) // { id, title, description, sections, negative_sections, bench } | null
  const [mdExportIncludeBench, setMdExportIncludeBench] = useState(false) // session-level remembered choice
  const autoSaveTimerRef = useRef(null)
  const autoSaveDataRef = useRef(null)
  const [sensitiveKeywords, setSensitiveKeywordsState] = useState(getSensitiveKeywords)
  const [galleryBlurMode, setGalleryBlurModeState] = useState(getGalleryBlurMode)

  const { positivePrompt, negativePrompt } = usePromptBuilder(sections, negativeSections, includeHeaders)
  const translator = useTranslator(translationProvider)
  const {
    prompts, savePrompt, loadPrompt, deletePrompt,
    exportToJson, exportToMarkdown, importFromJson,
    bench, updateBench, loadBench,
    getFirstSamplePrompt,
  } = useStorage()
  const {
    folders,
    createFolder, renameFolder, updateFolderDescription, deleteFolder,
    moveScene, removeSceneFromFolders, insertSceneAfter,
    findFolderForScene,
    isCollapsed, toggleFolder, expandFolder,
    replaceFolders,
  } = useFolders()
  const gallery = useImageGallery(currentId)

  // Keep autoSaveDataRef in sync with latest state (for flush callback)
  autoSaveDataRef.current = { title, description, sections, negativeSections, currentId, pendingFolderId, bench }

  // --- Core save logic (used by auto-save and flush) ---
  const performSave = useCallback((data) => {
    const d = new Date()
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const saveTitle = data.title.trim() || `${dateStr}_無題`
    const saveData = {
      id: data.currentId,
      title: saveTitle,
      description: data.description,
      sections: data.sections,
      negative_sections: data.negativeSections,
    }
    const savedId = savePrompt(saveData)
    setCurrentId(savedId)
    if (!data.title.trim()) setTitle(saveTitle)
    if (data.pendingFolderId && !data.currentId) {
      moveScene(savedId, data.pendingFolderId, null)
      setPendingFolderId(null)
    }
    setLastSavedSnapshot(prev => ({
      ...saveData, id: savedId, title: saveTitle,
      created_at: prev?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1500)
    return savedId
  }, [savePrompt, moveScene])

  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null }
  }, [])

  const flushAutoSave = useCallback(() => {
    cancelAutoSave()
    const d = autoSaveDataRef.current
    if (!d) return
    const hasContent = d.title.trim() || sectionsData.positive.some(s => (d.sections[s.key] || '').trim())
    if (hasContent) performSave(d)
  }, [cancelAutoSave, performSave])

  // --- Gallery: register dropped/selected images to the current prompt ---
  const hasEditorContent = title.trim() !== '' || sectionsData.positive.some(s => (sections[s.key] || '').trim())

  const { addFiles: galleryAddFiles } = gallery
  const handleGalleryFiles = useCallback((files) => {
    let pid = autoSaveDataRef.current?.currentId
    if (!pid) {
      // Unsaved prompt: flush an auto-save first so the images have an id to attach to
      const d = autoSaveDataRef.current
      const hasContent = d && (d.title.trim() || sectionsData.positive.some(s => (d.sections[s.key] || '').trim()))
      if (!hasContent) return
      cancelAutoSave()
      pid = performSave(d)
    }
    galleryAddFiles(files, pid)
  }, [cancelAutoSave, performSave, galleryAddFiles])

  const handleSetGalleryBlurMode = useCallback((mode) => {
    setGalleryBlurMode(mode)
    setGalleryBlurModeState(getGalleryBlurMode())
  }, [])

  // --- Image counts per prompt (sidebar attachment indicator) ---
  // Refreshed when the current gallery changes (add/remove) or prompts change
  // (covers deletion of non-current prompts). Index key scan — cheap.
  const [imageCounts, setImageCounts] = useState({})
  useEffect(() => {
    let cancelled = false
    getImageCounts()
      .then(counts => { if (!cancelled) setImageCounts(counts) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [gallery.images, prompts])

  // --- Auto-save (debounce 2s) ---
  useEffect(() => {
    const hasContent = title.trim() || sectionsData.positive.some(s => (sections[s.key] || '').trim())
    if (!hasContent) return
    cancelAutoSave()
    autoSaveTimerRef.current = setTimeout(() => {
      performSave(autoSaveDataRef.current)
    }, 2000)
    return cancelAutoSave
  }, [title, description, sections, negativeSections, currentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Draft (localStorage resilience layer, 1.5s) ---
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

  const loadPromptIntoEditor = (prompt) => {
    setTitle(prompt.title || '')
    setDescription(prompt.description || '')
    setSections({ ...createEmptySections(), ...prompt.sections })
    setNegativeSections({ ...createEmptyNegativeSections(), ...prompt.negative_sections })
    setCurrentId(prompt.id)
    setLastSavedSnapshot(prompt)
    if (prompt.bench) loadBench(prompt.bench)
    setPendingFolderId(null)
    clearDraft()
  }

  const handleLoad = (prompt) => {
    if (prompt.id === currentId && viewMode === 'editor') return
    flushAutoSave()
    loadPromptIntoEditor(prompt)
    setViewMode('editor')
  }

  const handleNew = () => {
    flushAutoSave()
    setTitle('')
    setDescription('')
    setSections(createEmptySections())
    setNegativeSections(createEmptyNegativeSections())
    setCurrentId(null)
    setLastSavedSnapshot(null)
    setPendingFolderId(null)
    setViewMode('editor')
    clearDraft()
  }

  const handleNewInFolder = (folderId) => {
    flushAutoSave()
    setTitle('')
    setDescription('')
    setSections(createEmptySections())
    setNegativeSections(createEmptyNegativeSections())
    setCurrentId(null)
    setLastSavedSnapshot(null)
    setPendingFolderId(folderId)
    setViewMode('editor')
    clearDraft()
  }

  const handleOpenFolder = (folderId) => {
    setActiveFolderId(folderId)
    setViewMode('storyboard')
  }

  const handleBackToEditor = () => {
    setViewMode('editor')
  }

  const handleDeleteCurrent = () => {
    if (!currentId) return
    if (!window.confirm(`「${title}」を削除しますか？`)) return
    cancelAutoSave()
    removeSceneFromFolders(currentId)
    deleteImagesForPrompt(currentId).catch(() => {})
    deletePrompt(currentId)
    handleNew()
  }

  const handleDeletePrompt = useCallback((id) => {
    removeSceneFromFolders(id)
    deleteImagesForPrompt(id).catch(() => {})
    deletePrompt(id)
  }, [deletePrompt, removeSceneFromFolders])

  const handleRenamePrompt = useCallback((id, newTitle) => {
    const target = prompts.find(p => p.id === id)
    if (!target) return
    savePrompt({ ...target, title: newTitle, bench: target.bench })
    if (id === currentId) setTitle(newTitle)
  }, [prompts, savePrompt, currentId])

  const handleUpdatePromptDescription = useCallback((id, newDescription) => {
    const target = prompts.find(p => p.id === id)
    if (!target) return
    savePrompt({ ...target, description: newDescription, bench: target.bench })
    if (id === currentId) setDescription(newDescription)
  }, [prompts, savePrompt, currentId])

  const buildSceneFromParsed = useCallback((parsed) => {
    const sectionsObj = createEmptySections()
    Object.assign(sectionsObj, parsed.sections || {})
    const negObj = createEmptyNegativeSections()
    Object.assign(negObj, parsed.negativeSections || {})
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      sections: sectionsObj,
      negative_sections: negObj,
    }
  }, [])

  const handleSceneExpansionApply = useCallback(({ anchorId, prev, next }) => {
    const folder = folders.find(f => f.sceneIds.includes(anchorId))
    if (!folder) return
    const anchorIdx = folder.sceneIds.indexOf(anchorId)
    let insertOffset = 0
    if (prev) {
      const data = buildSceneFromParsed(prev)
      const newId = savePrompt({ id: null, ...data, bench: {} })
      moveScene(newId, folder.id, anchorIdx)
      insertOffset = 1
    }
    if (next) {
      const data = buildSceneFromParsed(next)
      const newId = savePrompt({ id: null, ...data, bench: {} })
      moveScene(newId, folder.id, anchorIdx + insertOffset + 1)
    }
  }, [folders, buildSceneFromParsed, savePrompt, moveScene])

  const handleStoryDecomposeApply = useCallback(({ folderName, scenes, targetFolderId, createNew }) => {
    let folderId = targetFolderId
    if (createNew) {
      folderId = createFolder(folderName)
    }
    if (!folderId) return
    for (const sceneParsed of scenes) {
      const data = buildSceneFromParsed(sceneParsed)
      const newId = savePrompt({ id: null, ...data, bench: {} })
      moveScene(newId, folderId, null) // append
    }
    if (createNew) {
      setActiveFolderId(folderId)
      setViewMode('storyboard')
    }
  }, [createFolder, buildSceneFromParsed, savePrompt, moveScene])

  const handleCopyAsNew = () => {
    flushAutoSave() // save original first
    const newTitle = `${title || '無題'} のコピー`
    setTitle(newTitle)
    setCurrentId(null)
    setLastSavedSnapshot(null)
    // auto-save picks up the new state and creates a new entry
  }

  // Duplicate a prompt from sidebar — saves immediately and inserts after source if in folder
  const handleDuplicate = (prompt) => {
    const newTitle = `${prompt.title || '無題'} のコピー`
    const newSections = { ...createEmptySections(), ...prompt.sections }
    const newNeg = { ...createEmptyNegativeSections(), ...prompt.negative_sections }
    const newBench = prompt.bench || bench
    const newId = savePrompt({
      id: null,
      title: newTitle,
      description: prompt.description || '',
      sections: newSections,
      negative_sections: newNeg,
      bench: newBench,
    })
    const srcFolder = findFolderForScene(prompt.id)
    if (srcFolder) insertSceneAfter(newId, prompt.id)
    setTitle(newTitle)
    setDescription(prompt.description || '')
    setSections(newSections)
    setNegativeSections(newNeg)
    setCurrentId(newId)
    if (prompt.bench) loadBench(prompt.bench)
    const now = new Date().toISOString()
    setLastSavedSnapshot({
      id: newId,
      title: newTitle,
      description: prompt.description || '',
      sections: newSections,
      negative_sections: newNeg,
      bench: newBench,
      created_at: now,
      updated_at: now,
    })
    clearDraft()
  }

  const handleRevert = () => {
    if (!lastSavedSnapshot) return
    if (!window.confirm('最後に保存した状態に戻しますか？')) return
    cancelAutoSave() // discard pending dirty state
    loadPromptIntoEditor(lastSavedSnapshot)
  }

  const handleExportCurrentMd = () => {
    setMdExportTarget({
      id: currentId, title, description,
      sections, negative_sections: negativeSections, bench,
    })
  }

  const handleImportMarkdown = () => {
    setAnalysisInitialTab('file')
    setAnalysisModalTemplate('analysis')
    setAnalysisOpen(true)
  }

  const handleExportFromSidebar = useCallback((prompt) => {
    setMdExportTarget(prompt)
  }, [])

  const handleConfirmMdExport = useCallback(({ filename, includeBench }) => {
    if (!mdExportTarget) return
    setMdExportIncludeBench(includeBench)
    exportToMarkdown(mdExportTarget, { filename, includeBench })
    setMdExportTarget(null)
  }, [mdExportTarget, exportToMarkdown])

  const handleApplyConsistencyDiff = useCallback(({ sections: addPos, negativeSections: addNeg }) => {
    setSections(prev => ({ ...prev, ...addPos }))
    setNegativeSections(prev => ({ ...prev, ...addNeg }))
  }, [])

  const handleImportAnalysis = useCallback(({ sections: newSections, negativeSections: newNeg, title: parsedTitle, description: parsedDesc, bench: parsedBench }) => {
    setSections({ ...createEmptySections(), ...newSections })
    setNegativeSections({ ...createEmptyNegativeSections(), ...newNeg })
    if (parsedTitle?.trim()) {
      // For overwrite path keep the current title untouched if user already set one.
      // Only auto-prefix with date when overwriting an empty-title scene.
      if (!title?.trim()) {
        const d = new Date()
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
        setTitle(`${dateStr}_${parsedTitle.trim()}`)
      } else {
        setTitle(parsedTitle.trim())
      }
    }
    if (parsedDesc !== undefined) setDescription(parsedDesc || '')
    if (parsedBench) {
      for (const [key, val] of Object.entries(parsedBench)) {
        updateBench(key, val)
      }
    }
  }, [title, updateBench])

  const handleImportAnalysisAsNew = useCallback(({ sections: newSections, negativeSections: newNeg, title: parsedTitle, description: parsedDesc, bench: parsedBench }) => {
    flushAutoSave()
    const d = new Date()
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const newTitle = parsedTitle?.trim() ? parsedTitle.trim() : `${dateStr}_new`
    setTitle(newTitle)
    setDescription(parsedDesc || '')
    if (parsedBench) {
      for (const [key, val] of Object.entries(parsedBench)) {
        updateBench(key, val)
      }
    }
    setSections({ ...createEmptySections(), ...newSections })
    setNegativeSections({ ...createEmptyNegativeSections(), ...newNeg })
    setCurrentId(null)
    setLastSavedSnapshot(null)
    setPendingFolderId(null)
    setViewMode('editor')
    clearDraft()
  }, [flushAutoSave, clearDraft, updateBench])

  const openAnalysisModal = useCallback((template) => {
    setAnalysisModalTemplate(template)
    setAnalysisInitialTab(null)
    setAnalysisOpen(true)
  }, [])

  // Used by sidebar context menu — opens modal for any scene (loads it first if not current)
  const [modalAnchorScene, setModalAnchorScene] = useState(null) // overrides currentScene for modal

  const handleGenerateSceneFromSidebar = useCallback((sceneId, direction) => {
    const prompt = prompts.find(p => p.id === sceneId)
    if (!prompt) return
    const sceneSections = { ...createEmptySections(), ...prompt.sections }
    const sceneNeg = { ...createEmptyNegativeSections(), ...prompt.negative_sections }
    setModalAnchorScene({ title: prompt.title || '', description: prompt.description || '', sections: sceneSections, negativeSections: sceneNeg })
    setAnalysisModalTemplate(direction)
    setAnalysisOpen(true)
  }, [prompts])

  const handleResetBench = () => {
    if (!window.confirm('ベンチデータをプリセットの初期状態にリセットしますか？')) return
    localStorage.removeItem('sd-prompt-builder:bench')
    loadBench({})
  }

  const handleClearAll = async () => {
    localStorage.removeItem('sd-prompt-builder:prompts')
    localStorage.removeItem('sd-prompt-builder:bench')
    localStorage.removeItem('sd-prompt-builder:settings')
    localStorage.removeItem('sd-prompt-builder:draft')
    localStorage.removeItem('sd-prompt-builder:folders')
    localStorage.removeItem('sd-prompt-builder:folder-state')
    localStorage.removeItem('sd-prompt-builder:tag-translations')
    localStorage.removeItem('sd-prompt-builder:sensitive-keywords')
    localStorage.removeItem('sd-prompt-builder:bench-collapsed')
    localStorage.removeItem('sd-prompt-builder:gallery-collapsed')
    localStorage.removeItem('sd-prompt-builder:gallery-blur')
    try { await deleteImageDatabase() } catch { /* proceed with reload */ }
    window.location.reload()
  }

  const handleUpdateSensitiveKeywords = useCallback((list) => {
    setSensitiveKeywords(list)
    setSensitiveKeywordsState(getSensitiveKeywords())
  }, [])

  const handleDeleteFolder = useCallback((id) => {
    if (activeFolderId === id) {
      setActiveFolderId(null)
      setViewMode('editor')
    }
    deleteFolder(id)
  }, [activeFolderId, deleteFolder])

  const activeFolder = useMemo(
    () => folders.find(f => f.id === activeFolderId) || null,
    [folders, activeFolderId]
  )

  const activeFolderScenes = useMemo(() => {
    if (!activeFolder) return []
    const map = new Map(prompts.map(p => [p.id, p]))
    return activeFolder.sceneIds.map(id => map.get(id)).filter(Boolean)
  }, [activeFolder, prompts])

  const handleImportJson = useCallback(async (file) => {
    const result = await importFromJson(file)
    if (Array.isArray(result.folders) && result.folders.length > 0) {
      const existingIds = new Set(folders.map(f => f.id))
      const merged = [
        ...result.folders.filter(f => !existingIds.has(f.id)),
        ...folders,
      ]
      replaceFolders(merged)
      return { ...result, foldersImported: result.folders.filter(f => !existingIds.has(f.id)).length }
    }
    return { ...result, foldersImported: 0 }
  }, [importFromJson, folders, replaceFolders])

  const displayTitle = title || '無題のプロンプト'

  // Save button label & style
  const saveStatusLabel = saveFlash ? '✓ 保存済み' : '自動保存'
  const saveStatusClass = saveFlash ? 'text-green-400' : 'text-gray-600'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex">
      {/* Sidebar */}
      <div className="flex-shrink-0 h-screen sticky top-0 transition-all duration-200 overflow-hidden"
        style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0 }}>
        <div style={{ width: SIDEBAR_WIDTH }} className="h-full">
          <Sidebar
            prompts={prompts} currentId={currentId}
            onLoad={handleLoad} onDuplicate={handleDuplicate} onNew={handleNew} onDelete={handleDeletePrompt}
            onExportJson={exportToJson} onExportMarkdown={handleExportFromSidebar} onImportJson={handleImportJson}
            onResetBench={handleResetBench} onClearAll={handleClearAll}
            sensitiveKeywords={sensitiveKeywords}
            onUpdateSensitiveKeywords={handleUpdateSensitiveKeywords}
            translationProvider={translationProvider}
            onSetTranslationProvider={setTranslationProvider}
            translatorActiveProvider={translator.activeProvider}
            PROVIDERS={PROVIDERS}
            onToggleSidebar={() => setSidebarOpen(false)}
            bench={bench}
            onUpdateBench={updateBench}
            folders={folders}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={handleDeleteFolder}
            isFolderCollapsed={isCollapsed}
            onToggleFolder={toggleFolder}
            onExpandFolder={expandFolder}
            onMoveScene={moveScene}
            onRenamePrompt={handleRenamePrompt}
            activeFolderId={viewMode === 'storyboard' ? activeFolderId : null}
            onOpenFolder={handleOpenFolder}
            onGenerateScene={handleGenerateSceneFromSidebar}
            onOpenSettings={() => setSettingsOpen(true)}
            imageCounts={imageCounts}
          />
        </div>
      </div>

      {/* Main content */}
      {viewMode === 'storyboard' && activeFolder ? (
        <StoryboardView
          folder={activeFolder}
          scenes={activeFolderScenes}
          currentSceneId={currentId}
          onOpenScene={handleLoad}
          onNewScene={handleNewInFolder}
          onDuplicateScene={handleDuplicate}
          onDeleteScene={handleDeletePrompt}
          onMoveSceneOut={(sceneId) => moveScene(sceneId, null, null)}
          onRenameScene={handleRenamePrompt}
          onUpdateSceneDescription={handleUpdatePromptDescription}
          onRenameFolder={renameFolder}
          onDeleteFolder={handleDeleteFolder}
          onUpdateFolderDescription={updateFolderDescription}
          onMoveScene={moveScene}
          onBackToEditor={handleBackToEditor}
          allFolders={folders}
          onSceneExpansionApply={handleSceneExpansionApply}
          onStoryDecomposeApply={handleStoryDecomposeApply}
        />
      ) : (
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
                <span className="text-[11px] text-gray-500 flex-shrink-0 mr-1">PPB for SDXL</span>
              )}
              {/* Title dropdown */}
              <div className="relative min-w-0 flex flex-col">
                <button onClick={() => setTitleMenuOpen(!titleMenuOpen)}
                  className="flex items-center gap-1 min-w-0 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors cursor-pointer text-left">
                  <span className={`text-sm truncate ${title ? 'text-gray-200' : 'text-gray-500'}`}>
                    {displayTitle}
                  </span>
                  {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="未保存の変更あり" />}
                  <span className="text-gray-500 text-xs flex-shrink-0">▼</span>
                </button>
                {description && (
                  <button onClick={() => setTitleMenuOpen(!titleMenuOpen)}
                    className="text-[11px] text-gray-500 hover:text-gray-400 truncate px-2 leading-tight text-left transition-colors cursor-pointer"
                    title={description}>
                    {description}
                  </button>
                )}
                {titleMenuOpen && (
                  <TitleMenu
                    title={title} description={description}
                    onTitleChange={setTitle} onDescriptionChange={setDescription}
                    onExportMarkdown={handleExportCurrentMd}
                    onImportMarkdown={handleImportMarkdown}
                    onDelete={handleDeleteCurrent}
                    onCopyAsNew={handleCopyAsNew}
                    onRevert={handleRevert}
                    canRevert={isDirty}
                    createdAt={lastSavedSnapshot?.created_at}
                    lastSavedAt={lastSavedSnapshot?.updated_at}
                    onCheckConsistency={() => setConsistencyOpen(true)}
                    onLoadPrompt={() => openAnalysisModal('analysis')}
                    onGeneratePrevScene={() => openAnalysisModal('prev')}
                    onGenerateNextScene={() => openAnalysisModal('next')}
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
              <span className={`px-2 text-xs transition-colors ${saveStatusClass}`}>
                {saveStatusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-4">
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Positive</h2>
          {sectionsData.positive.map((section) => (
            <div key={section.key}>
              <PromptSection section={section} value={sections[section.key] || ''}
                onChange={(val) => updateSection(section.key, val)} type="positive"
                benchValue={bench[section.key]} onBenchChange={updateBench} translator={translator}
                sensitiveKeywords={sensitiveKeywords}
                onOpenGlobalBench={() => setSettingsOpen(true)} />
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
                onBenchChange={(_sectionKey, val) => { updateBench(benchKey, val) }}
                sensitiveKeywords={sensitiveKeywords}
                onOpenGlobalBench={() => setSettingsOpen(true)} />
            )
          })}

          {/* 生成結果ギャラリー — OutputPanel (sticky bottom) より DOM 上流に置くこと */}
          <GalleryPanel
            images={gallery.images}
            busy={gallery.busy}
            onAddFiles={handleGalleryFiles}
            onRemoveImage={gallery.removeImage}
            sensitiveKeywords={sensitiveKeywords}
            blurMode={galleryBlurMode}
            hasPrompt={!!currentId || hasEditorContent}
          />
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
      )}

      {/* Full-screen drop target while dragging files (editor view only) */}
      <DropOverlay
        enabled={viewMode === 'editor'}
        title={displayTitle}
        canRegister={!!currentId || hasEditorContent}
        onDropFiles={handleGalleryFiles}
      />

      {/* Prompt analysis / load modal */}
      {analysisOpen && (
        <PromptAnalysisModal
          onClose={() => { setAnalysisOpen(false); setModalAnchorScene(null); setAnalysisInitialTab(null) }}
          onImport={handleImportAnalysis}
          onImportAsNew={handleImportAnalysisAsNew}
          hasContent={sectionsData.positive.some(s => (sections[s.key] || '').trim())}
          initialTab={analysisInitialTab || (analysisModalTemplate === 'analysis' ? 'import' : 'template')}
          initialTemplate={analysisModalTemplate}
          currentScene={modalAnchorScene || { title, description, sections, negativeSections }}
        />
      )}

      {/* Markdown export modal */}
      {mdExportTarget && (
        <MarkdownExportModal
          prompt={mdExportTarget}
          defaultIncludeBench={mdExportIncludeBench}
          onExport={handleConfirmMdExport}
          onClose={() => setMdExportTarget(null)}
        />
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsModal
          translationProvider={translationProvider}
          onSetTranslationProvider={setTranslationProvider}
          translatorActiveProvider={translator.activeProvider}
          PROVIDERS={PROVIDERS}
          onResetBench={handleResetBench}
          onClearAll={handleClearAll}
          onExportJson={exportToJson}
          sensitiveKeywords={sensitiveKeywords}
          onUpdateSensitiveKeywords={handleUpdateSensitiveKeywords}
          galleryBlurMode={galleryBlurMode}
          onSetGalleryBlurMode={handleSetGalleryBlurMode}
          bench={bench}
          onUpdateBench={updateBench}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Consistency check modal */}
      {consistencyOpen && (
        <ConsistencyCheckModal
          title={title}
          description={description}
          sections={sections}
          negativeSections={negativeSections}
          onApplyDiff={handleApplyConsistencyDiff}
          onClose={() => setConsistencyOpen(false)}
        />
      )}
    </div>
  )
}
