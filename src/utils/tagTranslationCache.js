const KEY = 'sd-prompt-builder:tag-translations'

function readMap() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch { /* ignore quota */ }
}

function cacheKey(tag, lang = 'ja') {
  return `${tag.toLowerCase()}::${lang}`
}

let memoryCache = null
function ensureLoaded() {
  if (memoryCache === null) memoryCache = readMap()
  return memoryCache
}

export function getCached(tag, lang = 'ja') {
  if (!tag) return null
  const map = ensureLoaded()
  const v = map[cacheKey(tag, lang)]
  return v == null ? null : v
}

export function setCached(tag, value, lang = 'ja') {
  if (!tag) return
  const map = ensureLoaded()
  map[cacheKey(tag, lang)] = value
  writeMap(map)
}

export function clearCache() {
  memoryCache = {}
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
