import sectionsData from '../data/sections.json'

/** Normalize a section name for fuzzy matching: lowercase, & → and, collapse whitespace. */
function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[\s　]+/g, ' ')
    .replace(/[\/_\-]/g, ' ')
    .trim()
}

/** Map normalized section name → key, for both positive and negative sections. */
function buildNameMaps() {
  const positive = new Map()
  const negative = new Map()
  for (const s of sectionsData.positive) positive.set(normalizeName(s.name), s.key)
  for (const s of sectionsData.negative) negative.set(normalizeName(s.name), s.key)
  return { positive, negative }
}

const NAME_MAPS = buildNameMaps()

function lookupKey(displayName, isNegative) {
  const norm = normalizeName(displayName)
  const map = isNegative ? NAME_MAPS.negative : NAME_MAPS.positive
  return map.get(norm) ?? null
}

/**
 * Parse a Markdown file (produced by exportToMarkdown) back into structured data.
 *
 * Returns: {
 *   title: string,
 *   description: string,
 *   sections: { [key]: text },          // positive
 *   negativeSections: { [key]: text },  // negative
 *   bench: { [key]: text } | null,      // null if no Bench block found
 *   warnings: string[],                 // unmatched section names etc.
 * }
 */
export function parseMarkdownPrompt(md) {
  const result = {
    title: '',
    description: '',
    sections: {},
    negativeSections: {},
    bench: null,
    warnings: [],
  }

  if (!md || !md.trim()) {
    result.warnings.push('ファイルが空です')
    return result
  }

  const lines = md.split('\n')

  // Three top-level zones: positive, negative, bench. Use ## headings to switch.
  // ZONE: 'top' (before first ##) -> 'positive' | 'negative' | 'bench'
  let zone = 'top'
  let currentH3 = null   // current ### heading (raw display name)
  let currentBuf = []    // lines accumulating for currentH3
  let benchBuf = {}      // { key: rawText } collected in bench zone
  let benchIsNeg = false // whether current bench h3 is "Negative - X"

  const flushH3 = () => {
    if (currentH3 == null) return
    const text = currentBuf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
    if (zone === 'positive') {
      const key = lookupKey(currentH3, false)
      if (key) result.sections[key] = text
      else result.warnings.push(`未知の Positive セクション: ${currentH3}`)
    } else if (zone === 'negative') {
      const key = lookupKey(currentH3, true)
      if (key) result.negativeSections[key] = text
      else result.warnings.push(`未知の Negative セクション: ${currentH3}`)
    } else if (zone === 'bench') {
      // Strip "Negative - " prefix to get the section name
      const isNeg = /^Negative\s*[-:]\s*/i.test(currentH3)
      const rawName = isNeg ? currentH3.replace(/^Negative\s*[-:]\s*/i, '') : currentH3
      const key = lookupKey(rawName, isNeg)
      if (key) {
        // For bench, key collides between positive composition & negative composition.
        // Use 'neg_composition' for negative composition.
        const benchKey = (isNeg && key === 'composition') ? 'neg_composition' : key
        benchBuf[benchKey] = text
      } else {
        result.warnings.push(`未知の Bench セクション: ${currentH3}`)
      }
    }
    currentH3 = null
    currentBuf = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Title (first # heading at top level)
    if (zone === 'top' && /^# (?!#)/.test(trimmed)) {
      result.title = trimmed.replace(/^#\s+/, '').trim()
      continue
    }

    // Description: > ... lines while still in top zone
    if (zone === 'top' && /^>\s?/.test(trimmed)) {
      const desc = trimmed.replace(/^>\s?/, '')
      result.description = result.description ? `${result.description}\n${desc}` : desc
      continue
    }

    // Top-level zone switch: ## Positive | ## Negative | ## Bench
    const h2Match = trimmed.match(/^##\s+(.+)$/)
    if (h2Match && !trimmed.startsWith('###')) {
      flushH3()
      const heading = h2Match[1].trim().toLowerCase()
      if (heading === 'positive') zone = 'positive'
      else if (heading === 'negative') zone = 'negative'
      else if (heading === 'bench') zone = 'bench'
      // Other ## headings: ignore (could be markdown table-of-contents etc.)
      continue
    }

    // ### Section name
    const h3Match = trimmed.match(/^###\s+(.+)$/)
    if (h3Match) {
      flushH3()
      currentH3 = h3Match[1].trim()
      continue
    }

    // BREAK marker — skip (it's structural, not content)
    if (trimmed === 'BREAK') continue

    // Horizontal rule — skip (it's structural between negative and bench)
    if (trimmed === '---') continue

    // Accumulate content under current ### heading
    if (currentH3 != null) {
      currentBuf.push(line)
    }
  }
  flushH3()

  // Convert bench multi-line text → flat-CSV format compatible with bench storage
  if (Object.keys(benchBuf).length > 0) {
    result.bench = {}
    for (const [key, raw] of Object.entries(benchBuf)) {
      result.bench[key] = benchMdToFlat(raw)
    }
  }

  return result
}

/**
 * Convert bench markdown text (multi-line, # GROUP / // sublabel headers on own lines,
 * blank lines = visual spacers) → flat comma-separated bench storage format.
 *
 * Mirrors what `formattedToBenchText` in benchFormat.js does.
 */
function benchMdToFlat(text) {
  if (!text || !text.trim()) return ''
  const parts = []
  let hasContent = false
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (hasContent) parts.push('//-')
      continue
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith(';;')) {
      parts.push(trimmed.replace(/,/g, '&#44;'))
    } else {
      const tags = trimmed.split(',').map(t => t.trim()).filter(Boolean)
      parts.push(...tags)
    }
    hasContent = true
  }
  while (parts.length > 0 && parts[parts.length - 1] === '//-') parts.pop()
  return parts.join(', ')
}
