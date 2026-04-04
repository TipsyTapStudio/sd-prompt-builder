import { useState, useCallback } from 'react'

const STORAGE_KEY = 'sd-prompt-builder:prompts'

function readFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function writeToStorage(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
}

export function useStorage() {
  const [prompts, setPrompts] = useState(readFromStorage)

  const savePrompt = useCallback((data) => {
    const now = new Date().toISOString()
    let updated

    if (data.id) {
      updated = prompts.map(p =>
        p.id === data.id
          ? { ...p, ...data, updated_at: now }
          : p
      )
    } else {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const newPrompt = {
        ...data,
        id,
        created_at: now,
        updated_at: now,
      }
      updated = [newPrompt, ...prompts]
      data.id = id
    }

    writeToStorage(updated)
    setPrompts(updated)
    return data.id
  }, [prompts])

  const loadPrompt = useCallback((id) => {
    return prompts.find(p => p.id === id) || null
  }, [prompts])

  const deletePrompt = useCallback((id) => {
    const updated = prompts.filter(p => p.id !== id)
    writeToStorage(updated)
    setPrompts(updated)
  }, [prompts])

  return { prompts, savePrompt, loadPrompt, deletePrompt }
}
