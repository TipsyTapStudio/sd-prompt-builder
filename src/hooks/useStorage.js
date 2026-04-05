import { useState, useCallback } from 'react'
import samplePrompts from '../data/samplePrompts.js'
import sectionsData from '../data/sections.json'

const STORAGE_KEY = 'sd-prompt-builder:prompts'
const BENCH_STORAGE_KEY = 'sd-prompt-builder:bench'
const DRAFT_KEY = 'sd-prompt-builder:draft'

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
    let updated

    // Include bench data in saved prompt
    const saveData = { ...data, bench: { ...bench } }

    if (saveData.id) {
      updated = prompts.map(p =>
        p.id === saveData.id
          ? { ...p, ...saveData, updated_at: now }
          : p
      )
    } else {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const newPrompt = {
        ...saveData,
        id,
        created_at: now,
        updated_at: now,
      }
      updated = [newPrompt, ...prompts]
      saveData.id = id
      data.id = id
    }

    writeToStorage(updated)
    setPrompts(updated)
    return data.id
  }, [prompts, bench])

  const loadPrompt = useCallback((id) => {
    return prompts.find(p => p.id === id) || null
  }, [prompts])

  const deletePrompt = useCallback((id) => {
    const updated = prompts.filter(p => p.id !== id)
    writeToStorage(updated)
    setPrompts(updated)
  }, [prompts])

  // --- Export / Import ---
  const exportToJson = useCallback(() => {
    const payload = {
      app: 'sd-prompt-builder',
      version: '1.0',
      exported_at: new Date().toISOString(),
      prompts: prompts,
    }
    const json = JSON.stringify(payload, null, 2)
    const filename = `sd-prompts-${formatTimestamp()}.json`
    downloadFile(json, filename, 'application/json')
  }, [prompts])

  const exportToMarkdown = useCallback((prompt) => {
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

    // Bench data (at the bottom, after separator)
    const benchData = prompt.bench || {}
    const allSections = [...sectionsData.positive, ...sectionsData.negative]
    const hasBenchContent = allSections.some(s => {
      const key = s.key === 'composition' && sectionsData.negative.includes(s) ? 'neg_composition' : s.key
      return (benchData[key] || '').trim()
    })

    if (hasBenchContent) {
      lines.push('---')
      lines.push('')
      lines.push('## Bench')
      lines.push('')

      for (const section of allSections) {
        const key = sectionsData.negative.some(n => n.key === section.key && section === sectionsData.negative.find(n2 => n2.key === section.key))
          ? (section.key === 'composition' ? 'neg_composition' : section.key)
          : section.key
        const benchText = (benchData[key] || '').trim()
        if (!benchText) continue

        lines.push(`### ${section.name}`)
        // Format bench text with labels on separate lines
        const parts = benchText.split(',').map(p => p.trim()).filter(Boolean)
        let currentTags = []
        for (const part of parts) {
          if (part.startsWith('#') || part.startsWith('//')) {
            if (currentTags.length > 0) {
              lines.push(currentTags.join(', '))
              currentTags = []
            }
            lines.push(part)
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
    const filename = `${prompt.title || 'untitled'}.md`
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

          resolve({ imported, skipped })
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
