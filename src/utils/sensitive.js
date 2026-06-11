const KEY = 'sd-prompt-builder:sensitive-keywords'
const DEFAULT_KEYWORDS = ['SENSITIVE', 'NSFW', 'R-18', 'R18', 'EXPLICIT']

function normalize(s) {
  return (s || '').toLowerCase().replace(/[\s_\-]+/g, '')
}

export function getSensitiveKeywords() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...DEFAULT_KEYWORDS]
    const arr = JSON.parse(raw)
    return Array.isArray(arr) && arr.length > 0 ? arr : [...DEFAULT_KEYWORDS]
  } catch {
    return [...DEFAULT_KEYWORDS]
  }
}

export function setSensitiveKeywords(list) {
  try {
    const arr = Array.isArray(list)
      ? list.map(s => String(s).trim()).filter(Boolean)
      : []
    if (arr.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(arr))
  } catch { /* ignore */ }
}

export function getDefaultSensitiveKeywords() {
  return [...DEFAULT_KEYWORDS]
}

/**
 * Returns true if any of the candidate strings (group / sublabel / own label)
 * matches a sensitive keyword (loose: case-insensitive, whitespace/dash-insensitive).
 */
export function matchesSensitive(candidates, keywords) {
  if (!candidates || !keywords || keywords.length === 0) return false
  const set = new Set(keywords.map(normalize).filter(Boolean))
  for (const c of candidates) {
    if (!c) continue
    if (set.has(normalize(c))) return true
  }
  return false
}
