import { useMemo } from 'react'
import sectionsData from '../data/sections.json'

export function usePromptBuilder(sections, negativeSections, includeHeaders) {
  const positivePrompt = useMemo(() => {
    const parts = []
    const breakIndex = sectionsData.positive.findIndex(s => s.key === sectionsData.breakAfter)
    let breakInserted = false

    for (let i = 0; i < sectionsData.positive.length; i++) {
      const section = sectionsData.positive[i]
      const text = (sections[section.key] || '').trim()

      // Insert BREAK before first post-break section that has content
      if (!breakInserted && i > breakIndex) {
        const hasContentBefore = sectionsData.positive.slice(0, breakIndex + 1).some(s => (sections[s.key] || '').trim())
        if (text && hasContentBefore) {
          parts.push('')
          parts.push('BREAK')
          parts.push('')
          breakInserted = true
        }
      }

      if (!text) continue

      if (includeHeaders) {
        parts.push(`### ${section.name}`)
      }
      parts.push(text)
    }

    return parts.join('\n').trim()
  }, [sections, includeHeaders])

  const negativePrompt = useMemo(() => {
    const parts = []

    for (const section of sectionsData.negative) {
      const text = (negativeSections[section.key] || '').trim()
      if (!text) continue

      if (includeHeaders) {
        parts.push(`### Negative - ${section.name}`)
      }
      parts.push(text)
    }

    return parts.join('\n').trim()
  }, [negativeSections, includeHeaders])

  return { positivePrompt, negativePrompt }
}
