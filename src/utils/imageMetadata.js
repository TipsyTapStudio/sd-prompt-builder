/**
 * Extract Stable Diffusion generation parameters embedded in image files.
 *
 * - PNG: A1111/Forge write a `tEXt` (or `iTXt`) chunk with keyword "parameters".
 * - JPEG: parameters live in the EXIF UserComment tag (0x9286) inside APP1.
 *
 * The parameters text format:
 *   <positive prompt>
 *   Negative prompt: <negative prompt>
 *   Steps: 20, Sampler: ..., Seed: 123, ...
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function isPng(bytes) {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

function isJpeg(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8
}

function readUint32BE(bytes, pos) {
  return bytes[pos] * 0x1000000 + bytes[pos + 1] * 0x10000 + bytes[pos + 2] * 0x100 + bytes[pos + 3]
}

function ascii(bytes, pos, len) {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[pos + i])
  return s
}

const utf8Decoder = new TextDecoder('utf-8')

/** Walk PNG chunks and return the "parameters" text, or null. */
function parsePngParameters(bytes) {
  let pos = 8
  while (pos + 12 <= bytes.length) {
    const len = readUint32BE(bytes, pos)
    const type = ascii(bytes, pos + 4, 4)
    if (type === 'IDAT' || type === 'IEND') break
    if (type === 'tEXt' || type === 'iTXt') {
      const data = bytes.subarray(pos + 8, pos + 8 + len)
      const nullIdx = data.indexOf(0)
      if (nullIdx > 0) {
        const keyword = ascii(data, 0, nullIdx)
        if (keyword === 'parameters') {
          let textStart
          if (type === 'iTXt') {
            // keyword\0 compressionFlag(1) compressionMethod(1) lang\0 translatedKeyword\0 text
            const compressed = data[nullIdx + 1] === 1
            if (compressed) return null // A1111 writes uncompressed; skip exotic cases
            let p = nullIdx + 3
            while (p < data.length && data[p] !== 0) p++ // language tag
            p++
            while (p < data.length && data[p] !== 0) p++ // translated keyword
            textStart = p + 1
          } else {
            textStart = nullIdx + 1
          }
          return utf8Decoder.decode(data.subarray(textStart))
        }
      }
    }
    pos += 12 + len
  }
  return null
}

/** Minimal EXIF walk: find UserComment (0x9286) in the Exif sub-IFD. */
function parseJpegParameters(bytes) {
  // Find APP1 segment with "Exif\0\0"
  let pos = 2
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) break
    const marker = bytes[pos + 1]
    const segLen = bytes[pos + 2] * 0x100 + bytes[pos + 3]
    if (marker === 0xe1 && ascii(bytes, pos + 4, 6) === 'Exif\0\0') {
      return parseExifUserComment(bytes.subarray(pos + 10, pos + 2 + segLen))
    }
    if (marker === 0xda) break // start of scan — no more metadata
    pos += 2 + segLen
  }
  return null
}

function parseExifUserComment(tiff) {
  if (tiff.length < 8) return null
  const little = ascii(tiff, 0, 2) === 'II'
  const u16 = (p) => little ? tiff[p] + tiff[p + 1] * 0x100 : tiff[p] * 0x100 + tiff[p + 1]
  const u32 = (p) => little
    ? tiff[p] + tiff[p + 1] * 0x100 + tiff[p + 2] * 0x10000 + tiff[p + 3] * 0x1000000
    : tiff[p] * 0x1000000 + tiff[p + 1] * 0x10000 + tiff[p + 2] * 0x100 + tiff[p + 3]

  const findTag = (ifdOffset, tagId) => {
    if (ifdOffset + 2 > tiff.length) return null
    const count = u16(ifdOffset)
    for (let i = 0; i < count; i++) {
      const entry = ifdOffset + 2 + i * 12
      if (entry + 12 > tiff.length) return null
      if (u16(entry) === tagId) return entry
    }
    return null
  }

  const ifd0 = u32(4)
  const exifPointerEntry = findTag(ifd0, 0x8769)
  if (!exifPointerEntry) return null
  const exifIfd = u32(exifPointerEntry + 8)
  const ucEntry = findTag(exifIfd, 0x9286)
  if (!ucEntry) return null

  const byteCount = u32(ucEntry + 4)
  const valueOffset = byteCount <= 4 ? ucEntry + 8 : u32(ucEntry + 8)
  if (valueOffset + byteCount > tiff.length || byteCount < 8) return null

  const charset = ascii(tiff, valueOffset, 8)
  const body = tiff.subarray(valueOffset + 8, valueOffset + byteCount)
  if (charset.startsWith('UNICODE')) {
    // EXIF UNICODE means UTF-16; byte order follows the TIFF header in practice
    return new TextDecoder(little ? 'utf-16le' : 'utf-16be').decode(body).replace(/\0+$/, '')
  }
  return utf8Decoder.decode(body).replace(/\0+$/, '')
}

/**
 * Split raw parameters text into { positive, negative, settings, seed }.
 * Any part may be an empty string when absent.
 */
export function splitParameters(text) {
  if (!text) return { positive: '', negative: '', settings: '', seed: null }
  const negIdx = text.indexOf('\nNegative prompt:')
  // Settings = last line starting with "Steps:"
  const settingsMatch = text.match(/\nSteps: [^\n]*$/)
  const settingsIdx = settingsMatch ? settingsMatch.index : -1

  let positive, negative
  if (negIdx >= 0) {
    positive = text.slice(0, negIdx)
    const negStart = negIdx + '\nNegative prompt:'.length
    negative = settingsIdx > negIdx ? text.slice(negStart, settingsIdx) : text.slice(negStart)
  } else {
    positive = settingsIdx >= 0 ? text.slice(0, settingsIdx) : text
    negative = ''
  }
  const settings = settingsIdx >= 0 ? text.slice(settingsIdx + 1) : ''
  const seedMatch = settings.match(/\bSeed: (\d+)/)
  return {
    positive: positive.trim(),
    negative: negative.trim(),
    settings: settings.trim(),
    seed: seedMatch ? seedMatch[1] : null,
  }
}

/**
 * Read a dropped image File and extract its embedded parameters.
 * Returns { params, positive, negative, settings, seed } — params is null
 * when the file has no embedded metadata (still registrable).
 */
export async function extractImageMetadata(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let params = null
  if (isPng(bytes)) {
    params = parsePngParameters(bytes)
  } else if (isJpeg(bytes)) {
    params = parseJpegParameters(bytes)
  }
  return { params, ...splitParameters(params) }
}

/** Quick check used by drop handlers to filter non-image files. */
export function isSupportedImageFile(file) {
  return /^image\/(png|jpeg|webp)$/.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
}
