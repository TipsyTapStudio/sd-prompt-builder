import sectionsData from '../data/sections.json'

/**
 * Parse a flat block of `### SectionName` headers + optional `---` separator into
 * `{ sections, negativeSections }`.
 *
 * Recognized headers:
 *   ### Quality & Technical          → positive section by name
 *   ### Negative - General Quality   → negative section by name
 *   ---                              → switch to negative side; ### NegName works too
 *   BREAK                            → ignored
 *   ``` ... ```                      → fences are stripped
 */
export function parseAIOutput(text) {
  const sections = {}
  const negativeSections = {}
  let title = ''
  let currentKey = null
  let isTitleMode = false
  let isNegative = false
  let passedSeparator = false

  for (const line of text.split('\n')) {
    const trimmed = line.trim()

    if (trimmed === '---') {
      passedSeparator = true
      currentKey = null
      isTitleMode = false
      continue
    }

    if (trimmed === 'BREAK') { currentKey = null; isTitleMode = false; continue }

    const headerMatch = trimmed.match(/^###\s+(.+)$/)
    if (headerMatch) {
      isTitleMode = false
      const name = headerMatch[1].trim()
      const negMatch = name.match(/^Negative\s*-\s*(.+)$/)
      if (negMatch) {
        isNegative = true
        const negName = negMatch[1].trim()
        const section = sectionsData.negative.find(s => s.name === negName)
        currentKey = section ? section.key : null
      } else if (name === 'Title') {
        isTitleMode = true
        currentKey = null
      } else if (name === 'Description') {
        currentKey = null
      } else {
        const section = sectionsData.positive.find(s => s.name === name)
        if (section) {
          isNegative = false
          currentKey = section.key
        } else if (passedSeparator) {
          const negSection = sectionsData.negative.find(s => s.name === name)
          if (negSection) {
            isNegative = true
            currentKey = negSection.key
          } else {
            currentKey = null
          }
        } else {
          currentKey = null
        }
      }
      continue
    }

    if (trimmed.startsWith('```')) continue

    if (isTitleMode) {
      if (trimmed && !title) title = trimmed
    } else if (currentKey) {
      const target = isNegative ? negativeSections : sections
      target[currentKey] = (target[currentKey] || '') + (target[currentKey] ? '\n' : '') + line
    }
  }

  for (const key of Object.keys(sections)) sections[key] = sections[key].trim()
  for (const key of Object.keys(negativeSections)) negativeSections[key] = negativeSections[key].trim()

  return { sections, negativeSections, title: title.trim() }
}

/**
 * Parse a single scene block: pull ### Title and ### Description, then run
 * parseAIOutput on the remainder.
 */
function parseSceneBlock(blockText) {
  const lines = blockText.split('\n')
  let title = ''
  let description = ''
  const otherLines = []

  let mode = null // 'title' | 'description' | null
  for (const line of lines) {
    const trimmed = line.trim()
    const headerMatch = trimmed.match(/^###\s+(.+)$/)
    if (headerMatch) {
      const name = headerMatch[1].trim()
      if (name === 'Title') { mode = 'title'; continue }
      if (name === 'Description') { mode = 'description'; continue }
      mode = null
      otherLines.push(line)
      continue
    }
    if (trimmed.startsWith('```')) { otherLines.push(line); continue }
    if (mode === 'title') {
      if (trimmed) title = (title ? `${title}\n${trimmed}` : trimmed)
    } else if (mode === 'description') {
      description = (description ? `${description}\n${line}` : line)
    } else {
      otherLines.push(line)
    }
  }

  const { sections, negativeSections } = parseAIOutput(otherLines.join('\n'))
  return {
    title: title.trim(),
    description: description.trim(),
    sections,
    negativeSections,
  }
}

/**
 * Split text into top-level `## blockName` blocks. Returns array of
 * { name, body }.
 */
function splitTopLevelBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let current = null
  for (const line of lines) {
    const m = line.match(/^##\s+(?!#)(.+)$/) // ## name (not ###)
    if (m) {
      if (current) blocks.push(current)
      current = { name: m[1].trim(), body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else {
      // Lines before any ## block — ignore unless it's a # FolderName
    }
  }
  if (current) blocks.push(current)
  return blocks
}

/**
 * For SceneExpansion. Parses output containing `## prev` and/or `## next`
 * blocks. Returns { prev, next } where each is null or
 * { title, description, sections, negativeSections }.
 */
export function parsePrevNextOutput(text) {
  const blocks = splitTopLevelBlocks(text)
  let prev = null, next = null
  for (const b of blocks) {
    const lower = b.name.toLowerCase()
    if (lower === 'prev' || lower === 'previous' || lower === '前') {
      prev = parseSceneBlock(b.body)
    } else if (lower === 'next' || lower === '次') {
      next = parseSceneBlock(b.body)
    }
  }
  return { prev, next }
}

/**
 * For ConsistencyCheck (mode A). Parses LLM output that has:
 *   ## verdict          → free-form summary
 *   ## issues
 *     ### missing       → bullet list of missing items
 *     ### contradiction → bullet list
 *     ### excess        → bullet list
 *   ## suggested_diff   → ### SectionName blocks (uses parseAIOutput)
 *
 * Returns:
 * {
 *   verdict: string,
 *   missing: string[],
 *   contradiction: string[],
 *   excess: string[],
 *   diff: { sections, negativeSections },
 * }
 */
export function parseConsistencyOutput(text) {
  const result = {
    verdict: '',
    missing: [],
    contradiction: [],
    excess: [],
    diff: { sections: {}, negativeSections: {} },
  }
  const blocks = splitTopLevelBlocks(text)
  for (const b of blocks) {
    const lower = b.name.toLowerCase()
    if (lower === 'verdict') {
      result.verdict = b.body.replace(/^```[a-z]*\n?|```$/gm, '').trim()
    } else if (lower === 'issues') {
      // Parse ### missing / ### contradiction / ### excess sub-blocks
      let mode = null
      const buckets = { missing: [], contradiction: [], excess: [] }
      for (const line of b.body.split('\n')) {
        const trimmed = line.trim()
        const h = trimmed.match(/^###\s+(.+)$/)
        if (h) {
          const name = h[1].trim().toLowerCase()
          mode = name === 'missing' ? 'missing'
            : name === 'contradiction' ? 'contradiction'
            : name === 'excess' ? 'excess'
            : null
          continue
        }
        if (trimmed.startsWith('```')) continue
        if (!mode) continue
        if (!trimmed) continue
        // bullet `-` or numeric `1.` prefix → strip
        const itemMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.*)$/)
        const text = itemMatch ? itemMatch[1].trim() : trimmed
        if (!text || text === 'なし' || text.toLowerCase() === 'none') continue
        buckets[mode].push(text)
      }
      result.missing = buckets.missing
      result.contradiction = buckets.contradiction
      result.excess = buckets.excess
    } else if (lower === 'suggested_diff' || lower === 'suggested-diff' || lower === 'diff') {
      result.diff = parseAIOutput(b.body)
    }
  }
  return result
}

/**
 * For StoryDecompose. Parses output starting with optional `# FolderName`,
 * followed by `## Scene 1` `## Scene 2` ... blocks.
 * Returns { folderName, scenes: [{ title, description, sections, negativeSections }] }
 */
export function parseStoryDecomposeOutput(text) {
  // Folder name from leading # FolderName line
  let folderName = ''
  const folderMatch = text.match(/^\s*#\s+(?!#)(.+)$/m)
  if (folderMatch) {
    const candidate = folderMatch[1].trim()
    // Avoid catching `# FolderName` that's actually inside a fenced block
    folderName = candidate
  }

  const blocks = splitTopLevelBlocks(text)
  const scenes = []
  for (const b of blocks) {
    const lower = b.name.toLowerCase()
    // Accept `Scene 1`, `Scene 2`, `シーン1`, just digits, etc.
    if (/^scene\s*\d+/i.test(b.name) || /^シーン\s*\d+/.test(b.name) || /^\d+/.test(b.name)) {
      scenes.push(parseSceneBlock(b.body))
    }
  }
  return { folderName, scenes }
}
