/**
 * Parse text into segments of normal text and comments.
 *
 * Supported comment syntax:
 *   - Line comments: // until end of line
 *   - Block comments: /* until * /
 *
 * SD weight notation like (tag:1.3) contains a single `/` which must NOT
 * be treated as a comment start. Only `//` (two consecutive slashes) opens
 * a line comment.
 *
 * @param {string} text
 * @returns {Array<{text: string, type: 'normal'|'comment'}>}
 */
export function parseComments(text) {
  if (!text) return [{ text: '', type: 'normal' }]

  const segments = []
  let current = ''
  let mode = 'normal' // 'normal' | 'lineComment' | 'blockComment'
  let i = 0

  while (i < text.length) {
    if (mode === 'normal') {
      // Check for line comment start: //
      if (text[i] === '/' && i + 1 < text.length && text[i + 1] === '/') {
        // Flush current normal segment
        if (current) {
          segments.push({ text: current, type: 'normal' })
          current = ''
        }
        mode = 'lineComment'
        current += '//'
        i += 2
        continue
      }
      // Check for block comment start: /*
      if (text[i] === '/' && i + 1 < text.length && text[i + 1] === '*') {
        if (current) {
          segments.push({ text: current, type: 'normal' })
          current = ''
        }
        mode = 'blockComment'
        current += '/*'
        i += 2
        continue
      }
      current += text[i]
      i++
    } else if (mode === 'lineComment') {
      // Line comment ends at newline (newline itself is NOT part of the comment)
      if (text[i] === '\n') {
        segments.push({ text: current, type: 'comment' })
        current = '\n'
        mode = 'normal'
        i++
      } else {
        current += text[i]
        i++
      }
    } else if (mode === 'blockComment') {
      // Block comment ends at */
      if (text[i] === '*' && i + 1 < text.length && text[i + 1] === '/') {
        current += '*/'
        segments.push({ text: current, type: 'comment' })
        current = ''
        mode = 'normal'
        i += 2
      } else {
        current += text[i]
        i++
      }
    }
  }

  // Flush remaining
  if (current) {
    segments.push({ text: current, type: mode === 'normal' ? 'normal' : 'comment' })
  }

  return segments
}

/**
 * Strip comments from text and clean up leftover comma artifacts.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripComments(text) {
  if (!text) return ''

  const segments = parseComments(text)
  let result = segments
    .filter(s => s.type === 'normal')
    .map(s => s.text)
    .join('')

  // Clean up comma artifacts left after comment removal.
  // Process line by line to handle leading/trailing commas per line.
  result = result
    .split('\n')
    .map(line => {
      // Collapse multiple consecutive commas (with optional whitespace) into single comma
      let cleaned = line.replace(/,(\s*,)+/g, ',')
      // Remove leading commas (with optional whitespace)
      cleaned = cleaned.replace(/^\s*,\s*/, '')
      // Remove trailing commas followed only by whitespace
      cleaned = cleaned.replace(/,\s*$/, '')
      return cleaned
    })
    .join('\n')

  // Remove blank lines that resulted from comment-only lines
  result = result.replace(/\n\s*\n/g, '\n')

  return result
}
