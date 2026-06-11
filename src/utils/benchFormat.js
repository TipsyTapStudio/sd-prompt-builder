/**
 * Parse bench text (flat comma-separated) into structured items.
 * ;; prefix = pure comment (memo only, not rendered as chip)
 *
 * Line-based tokens (#, //, ;;) may contain `&#44;` as an escaped comma —
 * decoded here so comments with commas survive the flat-CSV round-trip.
 */
export function parseBenchItems(text) {
  if (!text || !text.trim()) return []
  const items = []
  const parts = text.split(',')
  let currentGroup = null
  let currentSublabel = null
  for (const part of parts) {
    let trimmed = part.trim()
    if (!trimmed) continue
    const isLineToken = trimmed.startsWith(';;') ||
      (trimmed.startsWith('#') && !trimmed.startsWith('##')) ||
      trimmed.startsWith('//')
    if (isLineToken) trimmed = trimmed.replace(/&#44;/g, ',')
    if (trimmed.startsWith(';;')) {
      const label = trimmed.replace(/^;;\s*/, '').trim()
      items.push({ type: 'pure_comment', text: trimmed, label, group: currentGroup })
    } else if (trimmed.startsWith('#') && !trimmed.startsWith('##')) {
      const label = trimmed.replace(/^#\s*/, '').trim() || trimmed
      currentGroup = label
      currentSublabel = null
      items.push({ type: 'comment', text: trimmed, label, isGroup: true, group: label })
    } else if (trimmed.startsWith('//')) {
      const rest = trimmed.replace(/^\/\/\s*/, '').trim()
      if (rest === '' || /^-+$/.test(rest)) {
        currentSublabel = null
        items.push({ type: 'spacer', text: trimmed, group: currentGroup })
      } else {
        const label = trimmed.replace(/^\/\/\s*-*\s*/, '').replace(/\s*-*\s*$/, '').trim() || trimmed
        currentSublabel = label
        items.push({ type: 'comment', text: trimmed, label, isGroup: false, group: currentGroup, sublabel: label })
      }
    } else {
      items.push({ type: 'tag', text: trimmed, group: currentGroup, sublabel: currentSublabel })
    }
  }
  return items
}

/**
 * Convert flat comma-separated bench text → formatted multi-line for editing.
 * # GROUP and // label stay on their own line; tags are grouped per line.
 */
export function benchTextToFormatted(text) {
  if (!text || !text.trim()) return ''
  const items = parseBenchItems(text)
  const lines = []
  let currentTags = []

  const flushTags = () => {
    if (currentTags.length > 0) {
      lines.push(currentTags.join(', '))
      currentTags = []
    }
  }

  for (const item of items) {
    if (item.type === 'spacer') {
      flushTags()
      lines.push('')
    } else if (item.type === 'comment' || item.type === 'pure_comment') {
      flushTags()
      lines.push(item.text)
    } else {
      currentTags.push(item.text)
    }
  }
  flushTags()
  return lines.join('\n')
}

/**
 * Convert formatted multi-line text → flat comma-separated bench text for storage.
 * Blank lines become spacer sentinels (//-).
 */
export function formattedToBenchText(formatted) {
  if (!formatted || !formatted.trim()) return ''
  const parts = []
  let hasContent = false
  for (const line of formatted.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (hasContent) parts.push('//-')
      continue
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith(';;')) {
      // Escape commas so the flat-CSV split doesn't fragment line-based tokens
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
