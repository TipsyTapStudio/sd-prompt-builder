import { useState, useCallback } from 'react'
import samplePrompts from '../data/samplePrompts.js'
import sectionsData from '../data/sections.json'
import presetsData from '../data/presets.json'

function presetDefaultFor(presetKey) {
  const presets = presetsData[presetKey] || []
  if (presets.length === 0) return ''
  return presets.map(p => (p.tags || '').replace(/,\s*$/, '')).join(', ')
}

function benchKeyFor(section, isNegative) {
  if (isNegative && section.key === 'composition') return 'neg_composition'
  return section.key
}

const STORAGE_KEY = 'sd-prompt-builder:prompts'
const BENCH_STORAGE_KEY = 'sd-prompt-builder:bench'
const DRAFT_KEY = 'sd-prompt-builder:draft'
const FOLDERS_KEY = 'sd-prompt-builder:folders'

// --- Draft (auto-save) ---
export function saveDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function loadDraft() {
  try {
    const data = localStorage.getItem(DRAFT_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

function readFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
    // First launch: seed with sample prompts
    const samples = samplePrompts.map(p => ({ ...p }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples))
    return samples
  } catch {
    return []
  }
}

function writeToStorage(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
}

function readBenchFromStorage() {
  try {
    const data = localStorage.getItem(BENCH_STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function writeBenchToStorage(bench) {
  localStorage.setItem(BENCH_STORAGE_KEY, JSON.stringify(bench))
}

function formatTimestamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function useStorage() {
  const [prompts, setPrompts] = useState(readFromStorage)
  const [bench, setBench] = useState(readBenchFromStorage)

  // --- Bench ---
  const updateBench = useCallback((sectionKey, value) => {
    setBench(prev => {
      const updated = { ...prev, [sectionKey]: value }
      writeBenchToStorage(updated)
      return updated
    })
  }, [])

  const loadBench = useCallback((benchData) => {
    const newBench = benchData || {}
    writeBenchToStorage(newBench)
    setBench(newBench)
  }, [])

  // --- CRUD ---
  const savePrompt = useCallback((data) => {
    const now = new Date().toISOString()
    const saveData = {
      ...data,
      bench: data.bench !== undefined ? data.bench : { ...bench },
    }
    let resultId = saveData.id
    if (!resultId) {
      resultId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    }
    setPrompts(prev => {
      let updated
      if (saveData.id) {
        updated = prev.map(p =>
          p.id === saveData.id ? { ...p, ...saveData, updated_at: now } : p
        )
      } else {
        const newPrompt = { ...saveData, id: resultId, created_at: now, updated_at: now }
        updated = [newPrompt, ...prev]
      }
      writeToStorage(updated)
      return updated
    })
    return resultId
  }, [bench])

  const loadPrompt = useCallback((id) => {
    return prompts.find(p => p.id === id) || null
  }, [prompts])

  const deletePrompt = useCallback((id) => {
    setPrompts(prev => {
      const updated = prev.filter(p => p.id !== id)
      writeToStorage(updated)
      return updated
    })
  }, [])

  // --- Export / Import ---
  const exportToJson = useCallback(() => {
    let folders = []
    try {
      const raw = localStorage.getItem(FOLDERS_KEY)
      if (raw) folders = JSON.parse(raw) || []
    } catch { /* ignore */ }
    const payload = {
      app: 'sd-prompt-builder',
      version: '1.1',
      exported_at: new Date().toISOString(),
      prompts: prompts,
      folders: folders,
    }
    const json = JSON.stringify(payload, null, 2)
    const filename = `sd-prompts-${formatTimestamp()}.json`
    downloadFile(json, filename, 'application/json')
  }, [prompts])

  const exportToMarkdown = useCallback((prompt, options = {}) => {
    const { filename: customFilename, includeBench = true } = options
    const lines = []

    lines.push(`# ${prompt.title || 'Untitled'}`)
    if (prompt.description) {
      lines.push(`> ${prompt.description}`)
    }
    lines.push('')

    // Positive sections
    const positiveSections = sectionsData.positive
    const hasPositiveContent = positiveSections.some(s => (prompt.sections[s.key] || '').trim())

    if (hasPositiveContent) {
      lines.push('## Positive')
      lines.push('')

      const breakAfterKey = sectionsData.breakAfter
      let breakInserted = false
      let passedBreakSection = false

      for (const section of positiveSections) {
        const text = (prompt.sections[section.key] || '').trim()
        if (section.key === breakAfterKey) {
          passedBreakSection = true
        }

        if (!breakInserted && passedBreakSection && section.key !== breakAfterKey && text) {
          lines.push('BREAK')
          lines.push('')
          breakInserted = true
        }

        if (!text) continue

        lines.push(`### ${section.name}`)
        lines.push(text)
        lines.push('')
      }
    }

    // Negative sections
    const negativeSections = sectionsData.negative
    const hasNegativeContent = negativeSections.some(s => (prompt.negative_sections[s.key] || '').trim())

    if (hasNegativeContent) {
      lines.push('## Negative')
      lines.push('')

      for (const section of negativeSections) {
        const text = (prompt.negative_sections[section.key] || '').trim()
        if (!text) continue

        lines.push(`### ${section.name}`)
        lines.push(text)
        lines.push('')
      }
    }

    // Bench data (at the bottom, after separator).
    // Use effective bench: user override (prompt.bench[key]) when defined, otherwise presets.json default.
    const benchData = prompt.bench || {}
    const sectionEntries = [
      ...sectionsData.positive.map(s => ({ section: s, isNegative: false })),
      ...sectionsData.negative.map(s => ({ section: s, isNegative: true })),
    ]

    const resolveBench = (section, isNegative) => {
      const key = benchKeyFor(section, isNegative)
      const userValue = benchData[key]
      if (userValue !== undefined) return (userValue || '').trim()
      return presetDefaultFor(key).trim()
    }

    const hasBenchContent = sectionEntries.some(({ section, isNegative }) =>
      resolveBench(section, isNegative).length > 0
    )

    if (hasBenchContent && includeBench) {
      lines.push('---')
      lines.push('')
      lines.push('## Bench')
      lines.push('')

      for (const { section, isNegative } of sectionEntries) {
        const benchText = resolveBench(section, isNegative)
        if (!benchText) continue

        const heading = isNegative ? `Negative - ${section.name}` : section.name
        lines.push(`### ${heading}`)
        const parts = benchText.split(',').map(p => p.trim()).filter(Boolean)
        let currentTags = []
        for (const part of parts) {
          if (part.startsWith('#') || part.startsWith('//')) {
            if (currentTags.length > 0) {
              lines.push(currentTags.join(', '))
              currentTags = []
            }
            // Drop spacer sentinels (`//`, `//-`, `//---`) — render as blank line
            const rest = part.replace(/^\/\/\s*/, '').trim()
            if (part.startsWith('//') && (rest === '' || /^-+$/.test(rest))) {
              lines.push('')
            } else {
              lines.push(part)
            }
          } else {
            currentTags.push(part)
          }
        }
        if (currentTags.length > 0) {
          lines.push(currentTags.join(', '))
        }
        lines.push('')
      }
    }

    const md = lines.join('\n').trimEnd() + '\n'
    const filename = customFilename || `${prompt.title || 'untitled'}.md`
    downloadFile(md, filename, 'text/markdown')
  }, [])

  const importFromJson = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          let data
          try {
            data = JSON.parse(e.target.result)
          } catch {
            reject(new Error('Invalid JSON file'))
            return
          }

          if (data.app !== 'sd-prompt-builder') {
            reject(new Error('Not a valid SD Prompt Builder file'))
            return
          }

          if (!Array.isArray(data.prompts)) {
            reject(new Error('No prompts array found'))
            return
          }

          const existingIds = new Set(prompts.map(p => p.id))
          let imported = 0
          let skipped = 0
          const newPrompts = []

          for (const item of data.prompts) {
            if (!item.id || !item.title || !item.sections || !item.negative_sections) {
              skipped++
              continue
            }
            if (existingIds.has(item.id)) {
              skipped++
              continue
            }
            newPrompts.push(item)
            imported++
          }

          if (newPrompts.length > 0) {
            const updated = [...newPrompts, ...prompts]
            writeToStorage(updated)
            setPrompts(updated)
          }

          // Parse folders if present (v1.1+). Caller merges via useFolders.
          const parsedFolders = []
          if (Array.isArray(data.folders) && data.folders.length > 0) {
            const validIds = new Set([...prompts, ...newPrompts].map(p => p.id))
            for (const f of data.folders) {
              if (!f || !f.id || !f.name || !Array.isArray(f.sceneIds)) continue
              parsedFolders.push({
                ...f,
                sceneIds: f.sceneIds.filter(id => validIds.has(id)),
              })
            }
          }

          resolve({ imported, skipped, folders: parsedFolders })
        } catch (err) {
          reject(err)
        }
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }, [prompts])

  return {
    prompts,
    savePrompt,
    loadPrompt,
    deletePrompt,
    exportToJson,
    exportToMarkdown,
    importFromJson,
    bench,
    updateBench,
    loadBench,
    getFirstSamplePrompt: () => samplePrompts[0] || null,
  }
}
