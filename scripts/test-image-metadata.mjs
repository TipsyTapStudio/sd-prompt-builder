// Quick parser check: synthesize a PNG (tEXt) and JPEG (EXIF UserComment)
// carrying SD parameters, then run extractImageMetadata logic on them.
// Run: node scripts/test-image-metadata.mjs
import { splitParameters } from '../src/utils/imageMetadata.js'
import zlib from 'node:zlib'

const PARAMS = `RAW photo, photorealistic, adult woman, mature female,
elegant dress, garden background,
BREAK
natural sunlight, cinematic lighting,
Negative prompt: worst quality, low quality, blurry,
bad anatomy, watermark,
Steps: 20, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 3, Seed: 1234567890, Size: 832x1216, Model: testModel, Version: v1.10.1`

// ---- build a minimal valid PNG with tEXt parameters ----
function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let c = -1
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function buildPng(paramsText) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8; ihdr[9] = 0 // 1x1 grayscale
  const text = Buffer.concat([Buffer.from('parameters\0', 'latin1'), Buffer.from(paramsText, 'utf8')])
  const idat = zlib.deflateSync(Buffer.from([0, 0])) // filter byte + 1 pixel
  return Buffer.concat([
    sig, chunk('IHDR', ihdr), chunk('tEXt', text), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- build a minimal JPEG with EXIF UserComment (UNICODE, little-endian) ----
function buildJpeg(paramsText) {
  const ucText = Buffer.from(paramsText, 'utf16le')
  const userComment = Buffer.concat([Buffer.from('UNICODE\0', 'latin1'), ucText])

  // TIFF: II header, IFD0 with one entry (ExifIFD pointer), ExifIFD with UserComment
  const ifd0Offset = 8
  const ifd0 = Buffer.alloc(2 + 12 + 4)
  ifd0.writeUInt16LE(1, 0)
  ifd0.writeUInt16LE(0x8769, 2)        // ExifIFD pointer tag
  ifd0.writeUInt16LE(4, 4)             // type LONG
  ifd0.writeUInt32LE(1, 6)
  const exifIfdOffset = ifd0Offset + ifd0.length
  ifd0.writeUInt32LE(exifIfdOffset, 10)

  const exifIfd = Buffer.alloc(2 + 12 + 4)
  exifIfd.writeUInt16LE(1, 0)
  exifIfd.writeUInt16LE(0x9286, 2)     // UserComment
  exifIfd.writeUInt16LE(7, 4)          // type UNDEFINED
  exifIfd.writeUInt32LE(userComment.length, 6)
  const valueOffset = exifIfdOffset + exifIfd.length
  exifIfd.writeUInt32LE(valueOffset, 10)

  const tiffHeader = Buffer.alloc(8)
  tiffHeader.write('II', 0, 'latin1')
  tiffHeader.writeUInt16LE(42, 2)
  tiffHeader.writeUInt32LE(ifd0Offset, 4)

  const tiff = Buffer.concat([tiffHeader, ifd0, exifIfd, userComment])
  const app1Body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (app1Body.length + 2) >> 8, (app1Body.length + 2) & 0xff]),
    app1Body,
  ])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])])
}

// ---- run the browser module's internals via a File-like shim ----
// Note: Node Buffers share a pooled ArrayBuffer — slice by byteOffset.
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length)
const mod = await import('../src/utils/imageMetadata.js')
const pngFile = { arrayBuffer: async () => toArrayBuffer(buildPng(PARAMS)) }
const jpegFile = { arrayBuffer: async () => toArrayBuffer(buildJpeg(PARAMS)) }

let failures = 0
function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) {
    failures++
    console.log(`NG ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
  } else {
    console.log(`OK ${label}`)
  }
}

const expectedSplit = splitParameters(PARAMS)
check('split.positive starts', expectedSplit.positive.startsWith('RAW photo'), true)
check('split.positive keeps BREAK', expectedSplit.positive.includes('BREAK'), true)
check('split.negative', expectedSplit.negative, 'worst quality, low quality, blurry,\nbad anatomy, watermark,')
check('split.settings starts', expectedSplit.settings.startsWith('Steps: 20'), true)
check('split.seed', expectedSplit.seed, '1234567890')

const pngMeta = await mod.extractImageMetadata(pngFile)
check('png.params roundtrip', pngMeta.params, PARAMS)
check('png.seed', pngMeta.seed, '1234567890')

const jpegMeta = await mod.extractImageMetadata(jpegFile)
check('jpeg.params roundtrip', jpegMeta.params, PARAMS)
check('jpeg.negative', jpegMeta.negative, expectedSplit.negative)

// no-metadata fallback: plain PNG without tEXt
const noMetaPng = { arrayBuffer: async () => toArrayBuffer(buildPng('')) }
const noMeta = await mod.extractImageMetadata(noMetaPng)
check('empty params → empty split', noMeta.positive, '')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
