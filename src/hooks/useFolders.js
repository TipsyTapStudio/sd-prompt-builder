import { useState, useCallback } from 'react'

const FOLDERS_KEY = 'sd-prompt-builder:folders'
const FOLDER_STATE_KEY = 'sd-prompt-builder:folder-state'

function readFolders() {
  try {
    const data = localStorage.getItem(FOLDERS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function writeFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

function readFolderState() {
  try {
    const data = localStorage.getItem(FOLDER_STATE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function writeFolderState(state) {
  localStorage.setItem(FOLDER_STATE_KEY, JSON.stringify(state))
}

function generateFolderId() {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// Functional updater wrapper: takes (prev) => next, persists, and returns next.
function applyFoldersUpdate(setFolders, updater) {
  let computed = null
  setFolders(prev => {
    computed = updater(prev)
    if (computed !== prev) writeFolders(computed)
    return computed
  })
  return computed
}

export function useFolders() {
  const [folders, setFolders] = useState(readFolders)
  const [collapsedState, setCollapsedState] = useState(readFolderState)

  const createFolder = useCallback((name = '新規フォルダ') => {
    const now = new Date().toISOString()
    const folder = {
      id: generateFolderId(),
      name: name.trim() || '新規フォルダ',
      sceneIds: [],
      description: '',
      created_at: now,
      updated_at: now,
    }
    setFolders(prev => {
      const next = [folder, ...prev]
      writeFolders(next)
      return next
    })
    return folder.id
  }, [])

  const renameFolder = useCallback((id, name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    setFolders(prev => {
      const next = prev.map(f =>
        f.id === id ? { ...f, name: trimmed, updated_at: new Date().toISOString() } : f
      )
      writeFolders(next)
      return next
    })
  }, [])

  const updateFolderDescription = useCallback((id, description) => {
    setFolders(prev => {
      const next = prev.map(f =>
        f.id === id ? { ...f, description: description || '', updated_at: new Date().toISOString() } : f
      )
      writeFolders(next)
      return next
    })
  }, [])

  const deleteFolder = useCallback((id) => {
    setFolders(prev => {
      const next = prev.filter(f => f.id !== id)
      writeFolders(next)
      return next
    })
    setCollapsedState(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      writeFolderState(next)
      return next
    })
  }, [])

  // Move a scene to a target folder. targetFolderId === null means unsorted.
  // targetIndex: insertion index within target folder. If null/undefined, append.
  const moveScene = useCallback((sceneId, targetFolderId, targetIndex = null) => {
    setFolders(prev => {
      const now = new Date().toISOString()
      const next = prev.map(f => {
        const has = f.sceneIds.includes(sceneId)
        if (f.id === targetFolderId) {
          const filtered = f.sceneIds.filter(id => id !== sceneId)
          const idx = targetIndex == null
            ? filtered.length
            : Math.max(0, Math.min(targetIndex, filtered.length))
          return {
            ...f,
            sceneIds: [...filtered.slice(0, idx), sceneId, ...filtered.slice(idx)],
            updated_at: now,
          }
        }
        if (has) {
          return { ...f, sceneIds: f.sceneIds.filter(id => id !== sceneId), updated_at: now }
        }
        return f
      })
      writeFolders(next)
      return next
    })
  }, [])

  const removeSceneFromFolders = useCallback((sceneId) => {
    setFolders(prev => {
      const now = new Date().toISOString()
      let changed = false
      const next = prev.map(f => {
        if (!f.sceneIds.includes(sceneId)) return f
        changed = true
        return { ...f, sceneIds: f.sceneIds.filter(id => id !== sceneId), updated_at: now }
      })
      if (!changed) return prev
      writeFolders(next)
      return next
    })
  }, [])

  const findFolderForScene = useCallback((sceneId) => {
    return folders.find(f => f.sceneIds.includes(sceneId)) || null
  }, [folders])

  const insertSceneAfter = useCallback((newSceneId, anchorSceneId) => {
    setFolders(prev => {
      const folder = prev.find(f => f.sceneIds.includes(anchorSceneId))
      if (!folder) return prev
      const idx = folder.sceneIds.indexOf(anchorSceneId)
      const now = new Date().toISOString()
      const next = prev.map(f => {
        if (f.id !== folder.id) {
          if (f.sceneIds.includes(newSceneId)) {
            return { ...f, sceneIds: f.sceneIds.filter(id => id !== newSceneId), updated_at: now }
          }
          return f
        }
        const filtered = f.sceneIds.filter(id => id !== newSceneId)
        const insertIdx = Math.max(0, Math.min(idx + 1, filtered.length))
        return {
          ...f,
          sceneIds: [...filtered.slice(0, insertIdx), newSceneId, ...filtered.slice(insertIdx)],
          updated_at: now,
        }
      })
      writeFolders(next)
      return next
    })
  }, [])

  const isCollapsed = useCallback((folderId) => collapsedState[folderId] === 'collapsed', [collapsedState])

  const toggleFolder = useCallback((folderId) => {
    setCollapsedState(prev => {
      const next = { ...prev }
      if (next[folderId] === 'collapsed') delete next[folderId]
      else next[folderId] = 'collapsed'
      writeFolderState(next)
      return next
    })
  }, [])

  const expandFolder = useCallback((folderId) => {
    setCollapsedState(prev => {
      if (!prev[folderId]) return prev
      const next = { ...prev }
      delete next[folderId]
      writeFolderState(next)
      return next
    })
  }, [])

  const replaceFolders = useCallback((newFolders) => {
    const arr = Array.isArray(newFolders) ? newFolders : []
    writeFolders(arr)
    setFolders(arr)
  }, [])

  return {
    folders,
    createFolder,
    renameFolder,
    updateFolderDescription,
    deleteFolder,
    moveScene,
    removeSceneFromFolders,
    insertSceneAfter,
    findFolderForScene,
    isCollapsed,
    toggleFolder,
    expandFolder,
    replaceFolders,
  }
}
