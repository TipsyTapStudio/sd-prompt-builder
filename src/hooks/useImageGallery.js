import { useState, useEffect, useCallback } from 'react'
import {
  addImage, getImagesForPrompt, deleteImage,
  newImageId, makeThumbnail,
} from '../utils/imageDb'
import { extractImageMetadata, isSupportedImageFile } from '../utils/imageMetadata'

/**
 * Gallery state for the prompt currently open in the editor.
 * Records live in IndexedDB (see utils/imageDb.js); this hook mirrors the
 * current prompt's records into React state.
 */
export function useImageGallery(promptId) {
  const [images, setImages] = useState([])
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!promptId) { setImages([]); return }
    try {
      setImages(await getImagesForPrompt(promptId))
    } catch { /* IndexedDB unavailable — gallery stays empty */ }
  }, [promptId])

  useEffect(() => {
    let cancelled = false
    if (!promptId) { setImages([]); return }
    getImagesForPrompt(promptId)
      .then(records => { if (!cancelled) setImages(records) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [promptId])

  /**
   * Register dropped files to a prompt. Returns { added, skipped }.
   * `targetPromptId` overrides the hook's promptId (used when the id is
   * created by flushing an auto-save right before the drop is processed).
   */
  const addFiles = useCallback(async (files, targetPromptId) => {
    const pid = targetPromptId || promptId
    const list = Array.from(files)
    const supported = list.filter(isSupportedImageFile)
    if (!pid || supported.length === 0) {
      return { added: 0, skipped: list.length }
    }
    let added = 0
    setBusy(true)
    try {
      for (const file of supported) {
        try {
          const [meta, thumbInfo] = await Promise.all([
            extractImageMetadata(file),
            makeThumbnail(file),
          ])
          await addImage({
            id: newImageId(),
            promptId: pid,
            thumb: thumbInfo.blob,
            width: thumbInfo.width,
            height: thumbInfo.height,
            fileName: file.name,
            fileSize: file.size,
            params: meta.params,
            positive: meta.positive,
            negative: meta.negative,
            settings: meta.settings,
            seed: meta.seed,
            createdAt: new Date().toISOString(),
          })
          added++
        } catch { /* unreadable file — count as skipped */ }
      }
    } finally {
      setBusy(false)
    }
    await reload()
    return { added, skipped: list.length - added }
  }, [promptId, reload])

  const removeImage = useCallback(async (id) => {
    try {
      await deleteImage(id)
      setImages(prev => prev.filter(img => img.id !== id))
    } catch { /* ignore */ }
  }, [])

  return { images, busy, addFiles, removeImage, reload }
}
