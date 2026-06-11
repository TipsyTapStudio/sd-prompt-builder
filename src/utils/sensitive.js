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

/**
 * Partial-match variant for free prompt text (gallery blur judgement).
 * Splits the text into comma-separated tags and reports true when any tag
 * CONTAINS a sensitive keyword after normalization. matchesSensitive() is
 * exact-match and designed for bench meta-labels — raw prompts need this.
 */
export function textContainsSensitive(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false
  const normKeywords = keywords.map(normalize).filter(Boolean)
  if (normKeywords.length === 0) return false
  for (const tag of text.split(',')) {
    const t = normalize(tag)
    if (!t) continue
    if (normKeywords.some(k => t.includes(k))) return true
  }
  return false
}

// --- Gallery blur mode ---
const BLUR_MODE_KEY = 'sd-prompt-builder:gallery-blur'
export const BLUR_MODES = ['keyword', 'all', 'off'] // keyword一致のみ / 常に / なし

export function getGalleryBlurMode() {
  try {
    const v = localStorage.getItem(BLUR_MODE_KEY)
    return BLUR_MODES.includes(v) ? v : 'keyword'
  } catch {
    return 'keyword'
  }
}

export function setGalleryBlurMode(mode) {
  try {
    if (BLUR_MODES.includes(mode)) localStorage.setItem(BLUR_MODE_KEY, mode)
  } catch { /* ignore */ }
}
