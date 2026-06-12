/**
 * Helpers for the generation parameters that A1111/Forge embed in a PNG's
 * `parameters` text (the "Steps: 20, Sampler: ..., ..." tail after the prompts).
 * Shared by ImageDetailModal and the editor's GenerationResultPanel so the two
 * views can't drift.
 */

/** Curated keys shown in the compact main grid (the rest go under "その他"). */
export const MAIN_PARAM_KEYS = ['Steps', 'Sampler', 'Schedule type', 'CFG scale', 'Size', 'Model', 'Clip skip']

/** Split "Steps: 20, Sampler: ..., Lora hashes: \"a: b, c: d\"" respecting quotes. */
export function parseSettingsPairs(settings) {
  if (!settings) return []
  const parts = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < settings.length; i++) {
    const ch = settings[i]
    if (ch === '"') inQuote = !inQuote
    if (!inQuote && ch === ',' && settings[i + 1] === ' ') {
      parts.push(cur)
      cur = ''
      i++
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => {
    const idx = p.indexOf(': ')
    return idx > 0 ? [p.slice(0, idx).trim(), p.slice(idx + 2).trim()] : [p.trim(), '']
  }).filter(([k]) => k)
}
