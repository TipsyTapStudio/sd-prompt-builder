/**
 * IndexedDB layer for the generation-result gallery.
 *
 * Stores thumbnails (Blob) + extracted parameters per prompt. Full-size
 * images are NOT stored — they stay under the user's own folder (Drive).
 *
 * Record shape (store "images", keyPath "id"):
 * {
 *   id: string,
 *   promptId: string,        // indexed
 *   thumb: Blob,             // downscaled webp/jpeg
 *   width: number,           // original pixel size
 *   height: number,
 *   fileName: string,
 *   fileSize: number,
 *   params: string|null,     // raw embedded parameters text
 *   positive: string,
 *   negative: string,
 *   settings: string,
 *   seed: string|null,
 *   createdAt: string,       // ISO
 * }
 */

const DB_NAME = 'sd-prompt-builder-images'
const DB_VERSION = 1
const STORE = 'images'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('promptId', 'promptId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbPromise = null; reject(req.error) }
  })
  return dbPromise
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addImage(record) {
  const db = await openDb()
  return requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record))
}

export async function getImagesForPrompt(promptId) {
  if (!promptId) return []
  const db = await openDb()
  const records = await requestToPromise(
    db.transaction(STORE).objectStore(STORE).index('promptId').getAll(promptId)
  )
  records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return records
}

/**
 * For a set of prompt ids, fetch the single newest image record for each.
 * One key-cursor pass over the promptId index (no thumbnails deserialized)
 * finds the latest id per prompt — ids are Date.now()-prefixed, so the max id
 * is the newest, matching getImagesForPrompt's createdAt-desc ordering — then
 * only those representative records are read in full. Avoids a getAll() per
 * scene (storyboard can hold many cards).
 * Returns { [promptId]: record }; prompts with no image are absent.
 */
export async function getLatestImageForPrompts(ids) {
  const want = new Set((ids || []).filter(Boolean))
  if (want.size === 0) return {}
  const db = await openDb()
  // Pass 1: cheap key scan — pick the max primary key per wanted promptId.
  const latestId = {}
  await new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).index('promptId').openKeyCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) { resolve(); return }
      const pid = cursor.key            // index key = promptId
      if (want.has(pid)) {
        const id = cursor.primaryKey    // record id
        if (!latestId[pid] || id > latestId[pid]) latestId[pid] = id
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
  // Pass 2: read only the chosen records (with their thumbnails) in one tx.
  const store = db.transaction(STORE).objectStore(STORE)
  const out = {}
  await Promise.all(Object.entries(latestId).map(async ([pid, id]) => {
    const rec = await requestToPromise(store.get(id))
    if (rec) out[pid] = rec
  }))
  return out
}

export async function getImageCounts() {
  const db = await openDb()
  const counts = {}
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).index('promptId').openKeyCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) { resolve(counts); return }
      counts[cursor.key] = (counts[cursor.key] || 0) + 1
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteImage(id) {
  const db = await openDb()
  return requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
}

export async function deleteImagesForPrompt(promptId) {
  if (!promptId) return
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const index = tx.objectStore(STORE).index('promptId')
  const keys = await requestToPromise(index.getAllKeys(promptId))
  for (const key of keys) tx.objectStore(STORE).delete(key)
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

/** Used by 設定 > データ管理 > 全消去. */
export function deleteImageDatabase() {
  dbPromise = null
  return requestToPromise(indexedDB.deleteDatabase(DB_NAME))
}

const THUMB_MAX_EDGE = 512

/**
 * Downscale an image File to a thumbnail Blob.
 * Returns { blob, width, height } where width/height are the ORIGINAL size.
 */
export async function makeThumbnail(file, maxEdge = THUMB_MAX_EDGE) {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    if (!blob) throw new Error('thumbnail encode failed')
    return { blob, width, height }
  } finally {
    bitmap.close()
  }
}

export function newImageId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
